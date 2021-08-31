import Command from "@lblod/ember-rdfa-editor/commands/command";
import Model from "@lblod/ember-rdfa-editor/model/model";
import ModelSelection from "@lblod/ember-rdfa-editor/model/model-selection";
import {
  ImpossibleModelStateError,
  MisbehavedSelectionError
} from "@lblod/ember-rdfa-editor/utils/errors";
import ModelTreeWalker from "@lblod/ember-rdfa-editor/model/util/model-tree-walker";
import ModelNode from "@lblod/ember-rdfa-editor/model/model-node";
import ModelElement from "@lblod/ember-rdfa-editor/model/model-element";
import ModelRange from "@lblod/ember-rdfa-editor/model/model-range";
import ModelPosition from "@lblod/ember-rdfa-editor/model/model-position";
import ModelNodeUtils from "@lblod/ember-rdfa-editor/model/util/model-node-utils";

export default class DeleteSelectionCommand extends Command<unknown[], ModelNode[]> {
  name = "delete-selection";

  constructor(model: Model) {
    super(model);
  }

  execute(selection: ModelSelection = this.model.selection): ModelNode[] {
    if (!ModelSelection.isWellBehaved(selection)) {
      throw new MisbehavedSelectionError();
    }

    let modelNodes: ModelNode[] = [];
    const range = selection.lastRange;
    let commonAncestor = range.getCommonAncestor();

    if (ModelNodeUtils.isListContainer(commonAncestor)
      || (ModelNodeUtils.isListElement(commonAncestor) && this.isElementFullySelected(commonAncestor, range))
    ) {
      const newAncestor = ModelNodeUtils.findAncestor(commonAncestor, node => !ModelNodeUtils.isListContainer(node));
      if (!newAncestor || !ModelElement.isModelElement(newAncestor)) {
        throw new ImpossibleModelStateError("No ancestor found that is not list container.");
      }

      commonAncestor = newAncestor;
    }

    this.model.change(mutator => {
      let contentRange = mutator.splitRangeUntilElements(range, commonAncestor, commonAncestor);
      let treeWalker = new ModelTreeWalker({
        range: contentRange,
        descend: false
      });

      // Check if selection is inside table cell. If this is the case, cut children of said cell.
      // Assumption: if table cell is selected, no other nodes at the same level can be selected.
      const firstModelNode = treeWalker.currentNode;
      if (ModelNodeUtils.isTableCell(firstModelNode)) {
        contentRange = range;
        treeWalker = new ModelTreeWalker({
          range: contentRange,
          descend: false
        });
      }

      modelNodes = [...treeWalker];
      selection.selectRange(mutator.insertNodes(contentRange));
    });

    return modelNodes;
  }

  isElementFullySelected(element: ModelElement, range: ModelRange): boolean {
    let startPosition = range.start;
    while (startPosition.parent !== element && startPosition.parentOffset === 0) {
      startPosition = ModelPosition.fromBeforeNode(startPosition.parent);
    }

    if (startPosition.parentOffset !== 0) {
      return false;
    }

    let endPosition = range.end;
    while (endPosition.parent !== element && endPosition.parentOffset === endPosition.parent.getMaxOffset()) {
      endPosition = ModelPosition.fromAfterNode(endPosition.parent);
    }

    return endPosition.parentOffset === endPosition.parent.getMaxOffset();
  }
}