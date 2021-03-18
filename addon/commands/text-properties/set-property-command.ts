import Command from "../command";
import Model from "@lblod/ember-rdfa-editor/model/model";
import ModelText, {TextAttribute} from "@lblod/ember-rdfa-editor/model/model-text";
import ModelSelection from "@lblod/ember-rdfa-editor/model/model-selection";
import ModelRange from "@lblod/ember-rdfa-editor/model/model-range";
import {FilterResult, ModelTreeWalker} from "@lblod/ember-rdfa-editor/model/util/tree-walker";
import ModelNode from "@lblod/ember-rdfa-editor/model/model-node";
import {INVISIBLE_SPACE} from "@lblod/ember-rdfa-editor/model/util/constants";

export default abstract class SetPropertyCommand extends Command {
  constructor(model: Model) {
    super(model);
  }

  execute(property: TextAttribute, value: boolean, selection: ModelSelection = this.model.selection) {


    if (!ModelSelection.isWellBehaved(selection)) {
      console.info("Not executing SetPropertyCommand because selection is missing");
      return;
    }

    const range = selection.lastRange;

    if (range.collapsed) {

      range.start.split(true);

      //insert new textNode with property set
      const node = new ModelText(INVISIBLE_SPACE);
      node.setTextAttribute(property, value);
      const insertionIndex = range.start.parent.offsetToIndex(range.start.parentOffset);
      range.start.parent.addChild(node, insertionIndex );

      //put the cursor inside that node
      const cursorPath = node.getOffsetPath();
      const newRange = ModelRange.fromPaths(range.root, cursorPath, cursorPath);
      selection.selectRange(newRange);

    } else {

      range.start.split(true);
      range.end.split(true);

      const walker = new ModelTreeWalker({
        range,
        filter: (node: ModelNode) => {
          return ModelNode.isModelText(node) ? FilterResult.FILTER_ACCEPT : FilterResult.FILTER_SKIP;
        }
      });
      const textNodes = Array.from(walker);

      for (const node of textNodes) {
        node.setTextAttribute(property, value);
      }
    }
    this.model.write();
  }
}
