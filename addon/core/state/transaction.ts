import State, {
  cloneStateShallow,
} from '@lblod/ember-rdfa-editor/core/state/index';
import ModelRange, {
  ModelRangeFactory,
  RangeFactory,
} from '@lblod/ember-rdfa-editor/core/model/model-range';
import { Mark, MarkSet, MarkSpec } from '../model/marks/mark';
import ModelNode from '../model/nodes/model-node';
import ModelSelection from '../model/model-selection';
import {
  PositionMapConfig,
  RangeMapConfig,
  SimpleRangeMapper,
} from '../model/range-mapper';
import { HtmlReaderContext, readHtml } from '../model/readers/html-reader';
import SelectionReader from '../model/readers/selection-reader';
import { getWindowSelection } from '../../utils/dom-helpers';
import {
  AssertionError,
  IllegalArgumentError,
  ModelError,
  NotImplementedError,
} from '../../utils/errors';
import { View } from '../view';
import ModelElement from '../model/nodes/model-element';
import ModelPosition from '../model/model-position';
import { EditorStore } from '../../utils/datastore/datastore';
import { AttributeSpec } from '../../utils/render-spec';
import {
  CommandExecutor,
  commandMapToCommandExecutor,
} from '../../commands/command-manager';
import { CommandName, Commands } from '@lblod/ember-rdfa-editor';
import { isOperationStep, Step, StepResult } from './steps/step';
import SelectionStep from './steps/selection-step';
import ConfigStep from './steps/config-step';
import { createLogger } from '@lblod/ember-rdfa-editor/utils/logging-utils';
import MarksManager from '../model/marks/marks-manager';
import { ViewController } from '../controllers/view-controller';
import { ResolvedPluginConfig } from '@lblod/ember-rdfa-editor/components/rdfa/rdfa-editor';
import PluginStep from './steps/plugin-step';
import Controller, { WidgetSpec } from '../controllers/controller';
import { InlineComponentSpec } from '../model/inline-components/model-inline-component';
import MapUtils from '@lblod/ember-rdfa-editor/utils/map-utils';
import {
  modelRangeToSimpleRange,
  SimpleRange,
  simpleRangeToModelRange,
} from '@lblod/ember-rdfa-editor/core/model/simple-range';
import StateStep from '@lblod/ember-rdfa-editor/core/state/steps/state-step';
import MarkStep from '@lblod/ember-rdfa-editor/core/state/steps/mark-step';
import ReplaceStep from '@lblod/ember-rdfa-editor/core/state/steps/replace-step';
import RemoveStep from '@lblod/ember-rdfa-editor/core/state/steps/remove-step';
import {
  modelPosToSimplePos,
  SimplePosition,
  simplePosToModelPos,
} from '@lblod/ember-rdfa-editor/core/model/simple-position';
import SplitStep from '@lblod/ember-rdfa-editor/core/state/steps/split-step';
import AttributeStep from '@lblod/ember-rdfa-editor/core/state/steps/attribute-step';
import ModelText from '../model/nodes/model-text';
import unwrap from '@lblod/ember-rdfa-editor/utils/unwrap';

interface TextInsertion {
  range: ModelRange;
  text: string;
  marks?: MarkSet;
}

export type TransactionStepListener = (
  transaction: Transaction,
  steps: Step[]
) => void;

export type TransactionDispatchListener = (transaction: Transaction) => void;
/**
 * This is the main way to produce a new state based on an initial state.
 * As such, this class implements all editing primitives available.
 * */
export default class Transaction {
  initialState: State;
  private _steps: Step[];
  private _shouldFocus: boolean;
  private stepCache: StepResult[];
  private stepCount: number;
  // we clone the nodes, so rdfa is invalid even if nothing happens to them
  // TODO: improve this
  rdfInvalid = false;
  marksInvalid = false;
  mapper: SimpleRangeMapper;
  logger = createLogger('transaction');
  private _commandCache?: CommandExecutor;
  private willCreateSnapshot = false;

  constructor(state: State) {
    this.initialState = state;
    /*
     * Current implementation is heavily influenced by time and complexity constraints.
     * By simply copying the state and then mutating the copy, most logic could be ported over verbatim.
     * However this simplicity comes at a cost of awkward workarounds in certain situations,
     * so is an immediate target for improvement later.
     */
    this._steps = [];
    this._shouldFocus = false;
    this.stepCache = [];
    this.stepCount = 0;
    this.mapper = new SimpleRangeMapper();
  }

  get currentDocument() {
    return this.apply().document;
  }

  get workingCopy() {
    return this.apply();
  }

  get currentSelection() {
    return this.apply().selection;
  }

  get rangeFactory(): RangeFactory {
    return new ModelRangeFactory(this.currentDocument);
  }

  get size() {
    return this._steps.length;
  }

  get steps() {
    return this._steps;
  }

  get shouldFocus(): boolean {
    return this._shouldFocus;
  }

  getCurrentDataStore() {
    return this.apply().datastore;
  }

  getMarksManager() {
    return this.apply().marksManager;
  }

  async setPlugins(configs: ResolvedPluginConfig[], view: View): Promise<void> {
    for (const plugin of this.apply().plugins) {
      if (plugin.willDestroy) {
        await plugin.willDestroy(this);
      }
    }
    const step = new PluginStep(configs, view);
    this.addStep(step);
    for (const config of configs) {
      const plugin = config.instance;
      const controller = new ViewController(plugin.name, view);
      await plugin.initialize(this, controller, config.options);
    }
  }

  editState(manip: (state: State) => void) {
    this.addStep(
      new StateStep({
        manip: (state) => {
          const clone = cloneStateShallow(state);
          manip(clone);
          return clone;
        },
      })
    );
  }

  setBaseIRI(iri: string): void {
    this.editState((state) => (state.baseIRI = iri));
  }

  setPathFromDomRoot(path: Node[]) {
    this.editState((state) => (state.pathFromDomRoot = path));
  }

  addTransactionStepListener(listener: TransactionStepListener) {
    this.editState((state) => state.transactionStepListeners.add(listener));
  }

  removeTransactionStepListener(listener: TransactionStepListener) {
    this.editState((state) => state.transactionStepListeners.delete(listener));
  }

  addTransactionDispatchListener(listener: TransactionDispatchListener) {
    this.editState((state) => state.transactionDispatchListeners.add(listener));
  }

  removeTransactionDispatchListener(listener: TransactionDispatchListener) {
    this.editState((state) =>
      state.transactionDispatchListeners.delete(listener)
    );
  }

  addMark(
    range: ModelRange,
    spec: MarkSpec,
    attributes: AttributeSpec
  ): ModelRange {
    const defaultRange = this.addAndCommitOperationStep(
      new MarkStep({
        range: modelRangeToSimpleRange(range),
        spec,
        attributes,
        action: 'add',
      })
    );
    this.createSnapshot();
    return simpleRangeToModelRange(defaultRange, this.apply().document);
  }

  /**
   * Build the new state from the viewstate (aka the DOM)
   * Typically done as (one of) the first transaction upon loading the editor.
   * */
  readFromView(view: View): void {
    const context = new HtmlReaderContext({
      marksRegistry: this.apply().marksRegistry,
      inlineComponentsRegistry: this.apply().inlineComponentsRegistry,
    });
    const parsedNodes = readHtml(view.domRoot, context);
    if (parsedNodes.length !== 1) {
      throw new NotImplementedError();
    }
    const newVdom = parsedNodes[0];
    if (!ModelNode.isModelElement(newVdom)) {
      throw new NotImplementedError();
    }
    const selectionReader = new SelectionReader();
    const newSelection = selectionReader.read(
      this.apply(),
      view.domRoot,
      getWindowSelection()
    );
    this.editState((state) => {
      state.document = newVdom;
      state.selection = newSelection;
    });
    this.createSnapshot();
  }

  setSelectionFromView(view: View): void {
    const selectionReader = new SelectionReader();
    const newSelection = selectionReader.read(
      this.apply(),
      view.domRoot,
      getWindowSelection()
    );

    this.addStep(new SelectionStep(newSelection));
  }

  /**
   * Produce the new state from the initial state.
   * It is left to implementation details what this means,
   * providing flexibility to implement batch-style editing or otherwise.
   * */
  apply(): State {
    let cur = this.stepCache[this.stepCount - 1]?.state ?? this.initialState;
    for (let i = this.stepCount; i < this.steps.length; i++) {
      const step = this.steps[i];
      const result = step.getResult(cur);
      this.stepCache[i] = result;
      cur = result.state;
      this.mapper.appendMapper(result.mapper);
      this.stepCount += 1;
    }
    if (
      this.initialState.baseIRI !== cur.baseIRI ||
      this.initialState.pathFromDomRoot !== cur.pathFromDomRoot ||
      this.initialState.document !== cur.document
    ) {
      if (this.rdfInvalid) {
        this.logger('Recalculating datastore');
        cur.datastore = EditorStore.fromParse({
          modelRoot: cur.document,
          baseIRI: cur.baseIRI,
          pathFromDomRoot: cur.pathFromDomRoot,
        });
        this.rdfInvalid = false;
      }
      if (this.marksInvalid) {
        cur.marksManager = MarksManager.fromDocument(cur.document);
        this.marksInvalid = false;
      }
    }
    if (cur !== this.initialState && this.willCreateSnapshot) {
      cur.previousState = this.initialState;
    }
    return cur;
  }

  insertText({ range, text, marks }: TextInsertion): ModelRange {
    // const defaultRange = this.addAndCommitOperationStep(
    //   new InsertTextStep({
    //     text,
    //     marks: marks || new MarkSet(),
    //     range: modelRangeToSimpleRange(range),
    //   })
    // );

    // this.createSnapshot();
    // return simpleRangeToModelRange(defaultRange, this.apply().document);
    const textNode = new ModelText(text);
    if (marks) {
      textNode.marks = marks;
    }

    return this.insertNodes(range, textNode);
  }

  insertNodes(range: ModelRange, ...nodes: ModelNode[]): ModelRange {
    const defaultRange = this.addAndCommitOperationStep(
      new ReplaceStep({
        range: modelRangeToSimpleRange(range),
        nodes: nodes,
      })
    );
    this.createSnapshot();
    return simpleRangeToModelRange(defaultRange, this.apply().document);
  }

  /**
   * Sets a new selection and returns whether the new selection differs from the old one
   * */
  setSelection(selection: ModelSelection) {
    const clone = this.cloneSelection(selection);
    const changed = !clone.sameAs(this.apply().selection);
    if (changed) {
      this.addStep(new SelectionStep(clone));
    }
    return changed;
  }

  setProperty(nodePos: SimplePosition, key: string, value: string) {
    this.addStep(new AttributeStep({ nodePos, action: 'set', key, value }));
  }

  setConfig(key: string, value: string | null): void {
    this.addStep(new ConfigStep(key, value));
  }

  removeProperty(nodePos: SimplePosition, key: string) {
    this.addStep(new AttributeStep({ nodePos, action: 'remove', key }));
  }

  removeNodes(range: ModelRange): ModelRange {
    const defaultRange = this.addAndCommitOperationStep(
      new RemoveStep({
        range: modelRangeToSimpleRange(range),
      })
    );
    this.createSnapshot();
    return simpleRangeToModelRange(defaultRange, this.apply().document);
  }

  addStep(step: Step) {
    this.steps.push(step);
  }

  private addAndCommitOperationStep(step: Step): SimpleRange {
    if (!isOperationStep(step)) {
      throw new IllegalArgumentError();
    }
    const lastState = this.apply();
    this.addStep(step);
    const { defaultRange } = step.getResult(lastState);
    return defaultRange;
  }

  selectRange(range: ModelRange): void {
    const clone = this.cloneSelection(this.apply().selection);
    clone.selectRange(range, clone.isRightToLeft);
    clone.isRightToLeft = this.apply().selection.isRightToLeft;
    this.addStep(new SelectionStep(clone));
  }

  addMarkToSelection(mark: Mark) {
    const clone = this.cloneSelection(this.apply().selection);
    clone.activeMarks.add(mark);
    this.addStep(new SelectionStep(clone));
    this.createSnapshot();
  }

  moveToPosition(
    rangeToMove: ModelRange,
    targetPosition: ModelPosition
  ): ModelRange {
    const startState = this.apply();
    if (targetPosition.isBetween(rangeToMove.start, rangeToMove.end)) {
      throw new AssertionError(
        'Cannot move range to position within that range'
      );
    }
    if (rangeToMove.root !== startState.document) {
      throw new AssertionError(
        'Root of range not equal to current working state'
      );
    }
    const range = modelRangeToSimpleRange(rangeToMove);
    const position = modelPosToSimplePos(targetPosition);

    const splitStep = new SplitStep({ range });
    this.addStep(splitStep);
    const stateAfterSplit = this.apply();

    const rangeAfterSplit = this.mapRange(range, { fromState: startState });

    const modelRangeAfterSplit = simpleRangeToModelRange(
      rangeAfterSplit,
      stateAfterSplit.document
    );
    const confinedRanges = modelRangeAfterSplit.getMinimumConfinedRanges();

    const nodesToMove: ModelNode[] = [];
    for (const range of confinedRanges) {
      let currentNode = range.start.nodeAfter();
      while (currentNode) {
        nodesToMove.push(currentNode);
        if (currentNode === range.end.nodeBefore()) {
          currentNode = null;
        } else {
          currentNode = currentNode.getNextSibling(stateAfterSplit.document);
        }
      }
    }

    const deleteStep = new ReplaceStep({ range: rangeAfterSplit, nodes: [] });
    this.addStep(deleteStep);

    const positionAfterDelete = this.mapPosition(position, {
      fromState: startState,
    });

    this.addStep(
      new ReplaceStep({
        range: { start: positionAfterDelete, end: positionAfterDelete },
        nodes: [...nodesToMove],
      })
    );
    return simpleRangeToModelRange(
      this.mapRange(range, { fromState: startState }),
      this.apply().document
    );
  }

  mapPosition(
    position: SimplePosition,
    config: PositionMapConfig & {
      fromState?: State;
    } = {}
  ): SimplePosition {
    const fromState = config.fromState ?? this.initialState;
    return this.getMapper(fromState).mapPosition(position, config);
  }

  mapModelPosition(position: ModelPosition, { bias }: PositionMapConfig = {}) {
    const latestState = this.apply();
    if (position.root === latestState.document) {
      return position;
    }
    const simplePos = modelPosToSimplePos(position);
    const stepResult =
      this.stepCache.find((result) => result.state.document === position.root)
        ?.state ?? this.initialState;
    if (!stepResult || stepResult.document !== position.root) {
      throw new AssertionError(
        'The root of this position did not arise from this transaction'
      );
    }
    return simplePosToModelPos(
      this.mapPosition(simplePos, { bias, fromState: stepResult }),
      latestState.document
    );
  }

  mapRange(
    range: SimpleRange,
    config: RangeMapConfig & {
      fromState?: State;
    } = {}
  ): SimpleRange {
    const fromState = config.fromState ?? this.initialState;
    return this.getMapper(fromState).mapRange(range, config);
  }

  mapModelRange(range: ModelRange, config?: RangeMapConfig) {
    const latestState = this.apply();
    if (range.root === latestState.document) {
      return range;
    }
    const simpleRange = modelRangeToSimpleRange(range);
    const stepResult =
      this.stepCache.find((result) => result.state.document === range.root)
        ?.state ?? this.initialState;
    if (!stepResult || stepResult.document !== range.root) {
      throw new AssertionError(
        'The root of this position did not arise from this transaction'
      );
    }
    return simpleRangeToModelRange(
      this.mapRange(simpleRange, {
        ...config,
        fromState: stepResult,
      }),
      latestState.document
    );
  }

  getMapper(fromState = this.initialState): SimpleRangeMapper {
    this.apply();
    if (fromState === this.initialState) {
      return this.mapper;
    } else {
      const stateIndex = this.stepCache.findIndex(
        (result) => result.state === fromState
      );
      if (stateIndex < 0) {
        throw new IllegalArgumentError(
          'Provided state is not a state that was produced in this transaction'
        );
      }
      const mapper = new SimpleRangeMapper();
      for (let i = stateIndex + 1; i < this.steps.length; i++) {
        mapper.appendMapper(this.stepCache[i].mapper);
      }
      return mapper;
    }
  }

  removeMarkFromSelection(markname: string) {
    const clone = this.cloneSelection(this.workingCopy.selection);

    for (const mark of clone.activeMarks) {
      if (mark.name === markname) {
        clone.activeMarks.delete(mark);
      }
    }
    this.addStep(new SelectionStep(clone));
    this.createSnapshot();
  }

  /**
   * Make a snapshot of the new state, meaning that it will be registered
   * in the history and can be recalled later.
   * */
  createSnapshot() {
    this.willCreateSnapshot = true;
  }

  /**
   * Reset this transaction, discarding any changes made
   * */
  rollback(): State {
    this._steps = [];
    this.stepCache = [];
    return this.initialState;
  }

  /**
   * Reset only the document
   */
  rollbackDocument(): State {
    this.logger('Rolling back document');
    this.editState((state) => (state.document = this.initialState.document));
    return this.apply();
  }

  /**
   * Split the given range until start.parent === startLimit
   * and end.parent === endLimit
   * The resulting range fully contains the split-off elements
   * @param range
   * @param startLimit
   * @param endLimit
   * @param splitAtEnds
   */
  splitRangeUntilElements(
    range: ModelRange,
    startLimit: ModelElement,
    endLimit: ModelElement,
    splitAtEnds = false
  ) {
    this.logger(
      'Mapping may not correspond to expected result as splits are not always executed/necessary'
    );
    const clonedRange = this.cloneRange(range);
    const endPos = this.splitUntilElement(
      clonedRange.end,
      endLimit,
      splitAtEnds
    );
    const startPos = this.mapModelPosition(clonedRange.start, {
      bias: 'right',
    });
    const newStartLimit = this.inWorkingCopy(startLimit);
    const resultPos = this.splitUntilElement(
      startPos,
      newStartLimit,
      splitAtEnds
    );

    // Currently we cant use the range-mapper for this result-range as they yield unexpected results
    return new ModelRange(resultPos, this.mapModelPosition(endPos));
  }

  splitUntilElement(
    position: ModelPosition,
    limitElement: ModelElement,
    splitAtEnds = false
  ): ModelPosition {
    this.createSnapshot();
    return this.splitUntil(
      position,
      (element) => element === this.inWorkingCopy(limitElement),
      splitAtEnds
    );
  }

  splitUntil(
    position: ModelPosition,
    untilPredicate: (element: ModelElement) => boolean,
    splitAtEnds = false
  ): ModelPosition {
    let pos = this.mapModelPosition(position, { bias: 'right' });
    // Execute split at least once
    if (pos.parent === pos.root || untilPredicate(pos.parent)) {
      return this.executeSplit(pos, splitAtEnds, false, false);
    }

    while (pos.parent !== pos.root && !untilPredicate(pos.parent)) {
      pos = this.executeSplit(pos, splitAtEnds, true);
    }

    this.createSnapshot();
    return pos;
  }

  private executeSplit(
    position: ModelPosition,
    splitAtEnds = false,
    splitParent = true,
    wrapAround = true
  ): ModelPosition {
    if (!splitAtEnds) {
      if (position.parentOffset === 0) {
        return !wrapAround || position.parent === position.root
          ? position
          : ModelPosition.fromBeforeNode(this.currentDocument, position.parent);
      } else if (position.parentOffset === position.parent.getMaxOffset()) {
        return !wrapAround || position.parent === position.root
          ? position
          : ModelPosition.fromAfterNode(this.currentDocument, position.parent);
      }
    }

    this.createSnapshot();
    const simplePos = modelPosToSimplePos(position);

    this.addStep(
      new SplitStep({
        range: { start: simplePos, end: simplePos },
        splitParent,
      })
    );
    return this.mapModelPosition(position);
  }

  insertAtPosition(position: ModelPosition, ...nodes: ModelNode[]): ModelRange {
    const posClone = this.clonePos(position);
    this.createSnapshot();
    return this.insertNodes(new ModelRange(posClone, posClone), ...nodes);
  }

  deleteNode(node: ModelNode): ModelRange {
    const range = this.cloneRange(
      ModelRange.fromAroundNode(this.currentDocument, node)
    );
    this.createSnapshot();
    return this.delete(range);
  }

  delete(range: ModelRange): ModelRange {
    const defaultRange = this.addAndCommitOperationStep(
      new ReplaceStep({
        range: modelRangeToSimpleRange(range),
      })
    );
    this.createSnapshot();
    return simpleRangeToModelRange(defaultRange, this.apply().document);
  }

  collapseSelection(left = false) {
    const sel = this.cloneSelection(this.currentSelection);
    sel.lastRange?.collapse(left);
    this.setSelection(sel);
  }

  /**
   * Clone a range and set its root in the new state.
   * This is currently public to provide a workaround for various editing implementations
   * which depended on stateful logic, but should eventually become private or dissapear
   * */
  cloneRange(range: ModelRange): ModelRange {
    return this.mapModelRange(range);
  }

  /**
   * Position version of @link{cloneRange}
   * */
  clonePos(pos: ModelPosition): ModelPosition {
    return this.mapModelPosition(pos);
  }

  /**
   * Selection version of @link{cloneRange}
   * */
  cloneSelection(selection: ModelSelection): ModelSelection {
    return selection.clone(this.apply().document);
  }

  collapseIn(node: ModelNode, offset = 0) {
    const clone = this.cloneSelection(this.apply().selection);

    clone.clearRanges();
    clone.addRange(
      this.cloneRange(
        ModelRange.fromInNode(this.currentDocument, node, offset, offset)
      )
    );
    this.addStep(new SelectionStep(clone));
  }

  /**
   * Replaces the element by its children. Returns a range containing the unwrapped children
   * TODO while it works, this interface doesn't work intuitively with the immutable style
   * @param element
   * @param ensureBlock ensure the unwrapped children are rendered as a block by surrounding them with br elements when necessary
   */
  unwrap(nodePos: SimplePosition, ensureBlock = false): ModelRange {
    const modelPos = simplePosToModelPos(nodePos, this.apply().document);
    const targetElement = modelPos.nodeAfter();
    if (!targetElement) {
      throw new AssertionError('Could not find node to unwrap');
    }
    if (targetElement.isLeaf || !ModelNode.isModelElement(targetElement)) {
      throw new AssertionError('Cannot unwrap a leafnode');
    }
    // const srcRange = ModelRange.fromInElement(
    //   this.currentDocument,
    //   targetElement,
    //   0,
    //   targetElement.getMaxOffset()
    // );
    // const target = ModelPosition.fromBeforeNode(
    //   this.currentDocument,
    //   targetElement
    // );
    const targetRange = modelRangeToSimpleRange(
      ModelRange.fromAroundNode(this.currentDocument, targetElement)
    );
    const resultRange = simpleRangeToModelRange(
      this.addAndCommitOperationStep(
        new ReplaceStep({
          range: targetRange,
          nodes: targetElement.children,
        })
      ),
      this.apply().document
    );

    // const resultRange = this.moveToPosition(srcRange, target);
    // this.deleteNode(resultRange.end.nodeAfter()!);

    if (ensureBlock) {
      const nodeBeforeStart = resultRange.start.nodeBefore();
      const nodeAfterStart = resultRange.start.nodeAfter();
      const nodeBeforeEnd = resultRange.end.nodeBefore();
      const nodeAfterEnd = resultRange.end.nodeAfter();

      if (
        nodeBeforeEnd &&
        nodeAfterEnd &&
        nodeBeforeEnd !== nodeAfterEnd &&
        !nodeBeforeEnd.isBlock &&
        !nodeAfterEnd.isBlock
      ) {
        this.insertAtPosition(resultRange.end, new ModelElement('br'));
      }
      if (
        nodeBeforeStart &&
        nodeAfterStart &&
        nodeBeforeStart !== nodeAfterStart &&
        !nodeBeforeStart.isBlock &&
        !nodeAfterStart.isBlock
      ) {
        this.insertAtPosition(resultRange.start, new ModelElement('br'));
      }
    }

    this.createSnapshot();
    return resultRange;
  }

  replaceNode(oldNode: ModelNode, ...newNodes: ModelNode[]): void {
    this.insertNodes(
      ModelRange.fromAroundNode(this.currentDocument, oldNode),
      ...newNodes
    );
  }

  removeMark(range: ModelRange, spec: MarkSpec, attributes: AttributeSpec) {
    const defaultRange = this.addAndCommitOperationStep(
      new MarkStep({
        range: modelRangeToSimpleRange(range),
        spec,
        attributes,
        action: 'remove',
      })
    );
    this.createSnapshot();
    return simpleRangeToModelRange(defaultRange, this.apply().document);
  }

  registerCommand<N extends CommandName>(name: N, command: Commands[N]): void {
    this.editState((state) => {
      state.commands[name] = command;
      this._commandCache = undefined;
    });
  }

  registerWidget(spec: WidgetSpec, controller: Controller): void {
    this.editState((state) => {
      MapUtils.setOrPush(state.widgetMap, spec.desiredLocation, {
        controller,
        ...spec,
      });
    });
  }

  registerMark(spec: MarkSpec): void {
    this.editState((state) => state.marksRegistry.registerMark(spec));
  }

  registerInlineComponent(component: InlineComponentSpec) {
    this.editState((state) =>
      state.inlineComponentsRegistry.registerComponent(component)
    );
  }

  get commands(): CommandExecutor {
    if (!this._commandCache) {
      this._commandCache = commandMapToCommandExecutor(
        this.workingCopy.commands,
        this
      );
    }
    return this._commandCache;
  }

  /* Restore a state from the history
   * @param steps Amount of steps to look back
   * */
  restoreSnapshot(steps: number) {
    let prev: State | null = this.initialState;
    let reverts = 0;
    let resultState: State;
    while (prev && reverts < steps) {
      resultState = prev;
      prev = prev.previousState;
      reverts++;
    }
    if (prev) {
      resultState = prev;
    }
    this.addStep(new StateStep({ manip: () => resultState }));
  }

  /**
   * Find the relative node in the workingcopy
   * TODO: this is a shortcut, should ultimately not be needed
   * */
  inWorkingCopy<N extends ModelNode>(node: N): N {
    if (node.isConnected(this.apply().document)) {
      return node;
    }
    for (const result of [{ state: this.initialState }, ...this.stepCache]) {
      if (node.isConnected(result.state.document)) {
        if (
          ModelNode.isModelElement(node) &&
          node === this.initialState.document
        ) {
          return this.apply().document as unknown as N;
        } else {
          const pos = this.mapModelPosition(
            ModelPosition.fromBeforeNode(this.initialState.document, node)
          );
          return unwrap(pos.nodeAfter()) as N;
        }
      }
    }
    throw new ModelError('Cannot match node that didnt come from initialState');
  }

  mapSelection(
    selection: ModelSelection,
    config?: RangeMapConfig
  ): ModelSelection {
    let simpleRanges = selection.ranges.map((range) =>
      modelRangeToSimpleRange(range)
    );
    simpleRanges = simpleRanges.map((range) => this.mapRange(range, config));
    const modelRanges = simpleRanges.map((range) =>
      simpleRangeToModelRange(range, this.apply().document)
    );
    return new ModelSelection(modelRanges);
    // return clone;
  }

  mapInitialSelection(config?: RangeMapConfig): ModelSelection {
    return this.mapSelection(this.initialState.selection, config);
  }

  mapInitialSelectionAndSet(config?: RangeMapConfig): void {
    const result = this.mapInitialSelection(config);
    this.setSelection(result);
  }

  /**
   * Tell the view that it needs to focus the viewRoot after applying changes.
   * Mostly needed for things like toolbar buttons which steal the focus.
   */
  focus() {
    this._shouldFocus = true;
  }
}
