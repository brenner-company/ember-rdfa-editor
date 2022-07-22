import Command, {
  CommandMap,
  CommandName,
} from '@lblod/ember-rdfa-editor/commands/command';
import {
  AnyEventName,
  EditorEventListener,
  ListenerConfig,
} from '@lblod/ember-rdfa-editor/utils/event-bus';
import ModelSelection from '@lblod/ember-rdfa-editor/model/model-selection';
import { EditorPlugin } from '@lblod/ember-rdfa-editor/utils/editor-plugin';
import {
  ModelRangeFactory,
  RangeFactory,
} from '@lblod/ember-rdfa-editor/model/model-range';
import Datastore from '@lblod/ember-rdfa-editor/model/util/datastore/datastore';
import GenTreeWalker, {
  TreeWalkerFactory,
} from '@lblod/ember-rdfa-editor/model/util/gen-tree-walker';
import { toFilterSkipFalse } from '@lblod/ember-rdfa-editor/model/util/model-tree-walker';
import ModelElement, {
  ElementType,
} from '@lblod/ember-rdfa-editor/model/model-element';
import { Mark, MarkSpec } from '@lblod/ember-rdfa-editor/model/mark';
import LiveMarkSet, {
  LiveMarkSetArgs,
} from '@lblod/ember-rdfa-editor/model/live-mark-set';
import MarksRegistry from '@lblod/ember-rdfa-editor/model/marks-registry';
import ImmediateModelMutator from '@lblod/ember-rdfa-editor/model/mutators/immediate-model-mutator';
import { InlineComponentSpec } from './inline-components/model-inline-component';
import { Editor } from '../core/editor';
import Transaction, { TransactionListener } from '../core/transaction';
import { CommandArgs, CommandReturn } from '../core/state';
import { AttributeSpec } from './util/render-spec';
import MapUtils from './util/map-utils';

export type WidgetLocation = 'toolbar' | 'sidebar' | 'insertSidebar';

export interface WidgetSpec {
  componentName: string;
  desiredLocation: WidgetLocation;
  plugin: EditorPlugin;
}

export type InternalWidgetSpec = WidgetSpec & {
  controller: Controller;
};

interface EditorUtils {
  toFilterSkipFalse: typeof toFilterSkipFalse;
}

export default interface Controller {
  get name(): string;

  get selection(): ModelSelection;

  get rangeFactory(): RangeFactory;

  get treeWalkerFactory(): TreeWalkerFactory;

  get datastore(): Datastore;

  get util(): EditorUtils;

  get ownMarks(): Set<Mark>;

  get modelRoot(): ModelElement;

  get marksRegistry(): MarksRegistry;

  getMarksFor(owner: string): Set<Mark>;

  createLiveMarkSet(args: LiveMarkSetArgs): LiveMarkSet;

  createModelElement(type: ElementType): ModelElement;

  createTransaction(): Transaction;

  dispatchTransaction(tr: Transaction): void;

  executeCommand<N extends CommandName>(
    commandName: N,
    args: CommandArgs<N>
  ): CommandReturn<N>;

  executeCommand<N extends CommandName>(
    commandName: N,
    ...args: unknown[]
  ): CommandReturn<N>;

  canExecuteCommand<N extends CommandName>(
    commandName: N,
    args: CommandArgs<N>
  ): boolean;

  canExecuteCommand<N extends CommandName>(
    commandName: N,
    ...args: unknown[]
  ): boolean;

  registerCommand<A extends unknown[], R>(command: Command<A, R>): void;

  registerWidget(spec: WidgetSpec): void;

  registerMark(spec: MarkSpec): void;

  registerInlineComponent(component: InlineComponentSpec): void;

  onEvent<E extends AnyEventName>(
    eventName: E,
    callback: EditorEventListener<E>,
    config?: ListenerConfig
  ): void;

  offEvent<E extends AnyEventName>(
    eventName: E,
    callback: EditorEventListener<E>,
    config?: ListenerConfig
  ): void;

  addTransactionListener(callback: TransactionListener): void;

  removeTransactionListener(callback: TransactionListener): void;
}

export class EditorController implements Controller {
  private _name: string;
  protected _editor: Editor;
  constructor(name: string, editor: Editor) {
    this._name = name;
    this._editor = editor;
  }
  get name(): string {
    return this._name;
  }
  get selection(): ModelSelection {
    return this._editor.state.selection;
  }
  get rangeFactory(): RangeFactory {
    return new ModelRangeFactory(this._editor.state.document);
  }
  get treeWalkerFactory(): TreeWalkerFactory {
    return GenTreeWalker;
  }
  get datastore(): Datastore {
    return this._editor.state.datastore;
  }
  get util(): EditorUtils {
    throw new Error('Method not implemented.');
  }
  get ownMarks(): Set<Mark<AttributeSpec>> {
    return this.getMarksFor(this.name);
  }
  get modelRoot(): ModelElement {
    return this._editor.state.document;
  }
  get marksRegistry(): MarksRegistry {
    return this._editor.state.marksRegistry;
  }
  createTransaction(): Transaction {
    return this._editor.state.createTransaction();
  }
  dispatchTransaction(tr: Transaction): void {
    this._editor.dispatchTransaction(tr);
  }
  executeCommand<N extends keyof CommandMap>(
    commandName: N,
    args: CommandArgs<N>
  ): ReturnType<CommandMap[N]['execute']> {
    return this._editor.executeCommand(commandName, args);
  }

  createModelElement(type: ElementType): ModelElement {
    return new ModelElement(type);
  }
  registerInlineComponent(component: InlineComponentSpec) {
    this._editor.state.inlineComponentsRegistry.registerComponent(component);
    // this._rawEditor.registerComponent(component);
  }
  canExecuteCommand<N extends keyof CommandMap>(
    commandName: N,
    args: CommandArgs<N>
  ): boolean {
    return this._editor.canExecuteCommand(commandName, args);
  }
  getMutator(): ImmediateModelMutator {
    throw new Error('Method not implemented.');
  }
  getMarksFor(owner: string): Set<Mark<AttributeSpec>> {
    return this.marksRegistry.getMarksFor(owner);
  }
  createLiveMarkSet(args: LiveMarkSetArgs): LiveMarkSet {
    return new LiveMarkSet(this, args);
  }
  registerCommand<A extends unknown[], R>(command: Command<A, R>): void {
    this._editor.registerCommand(command);
  }
  registerWidget(spec: WidgetSpec): void {
    MapUtils.setOrPush(this._editor.state.widgetMap, spec.desiredLocation, {
      controller: this,
      ...spec,
    });
  }
  registerMark(spec: MarkSpec<AttributeSpec>): void {
    this.marksRegistry.registerMark(spec);
  }
  onEvent<E extends string>(
    eventName: E,
    callback: EditorEventListener<E>,
    config?: ListenerConfig
  ): void {
    this._editor.onEvent(eventName, callback, config);
  }
  offEvent<E extends string>(
    eventName: E,
    callback: EditorEventListener<E>,
    config?: ListenerConfig
  ): void {
    this._editor.offEvent(eventName, callback, config);
  }

  addTransactionListener(callback: TransactionListener): void {
    this._editor.addTransactionListener(callback);
  }

  removeTransactionListener(callback: TransactionListener): void {
    this._editor.removeTransactionListener(callback);
  }
}

export class EditorControllerCompat extends EditorController {
  executeCommand<N extends keyof CommandMap>(
    commandName: N,
    ...args: unknown[]
  ): ReturnType<CommandMap[N]['execute']> {
    const command: Command<CommandArgs<N>, CommandReturn<N>> = this._editor
      .state.commands[commandName];
    const objectArgs = parsePositionalToNamed(command.arguments, ...args);
    return super.executeCommand(commandName, objectArgs);
  }

  canExecuteCommand<N extends keyof CommandMap>(
    commandName: N,
    ...args: unknown[]
  ): boolean {
    const command: Command<CommandArgs<N>, CommandReturn<N>> = this._editor
      .state.commands[commandName];
    const objectArgs = parsePositionalToNamed(command.arguments, ...args);
    return super.canExecuteCommand(commandName, objectArgs);
  }
}

function parsePositionalToNamed(argument_names: string[], ...args: unknown[]) {
  let objectArgs: { [key: string]: unknown } = {};
  objectArgs = {};
  for (let i = 0; i < Math.min(argument_names.length, args.length); i++) {
    const k = argument_names[i];
    objectArgs[k] = args[i];
  }
  return objectArgs;
}
