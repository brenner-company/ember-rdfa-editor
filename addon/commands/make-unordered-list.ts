import Model from "@lblod/ember-rdfa-editor/model/model";
import ModelNodeFinder from "@lblod/ember-rdfa-editor/model/util/model-node-finder";
import ModelNode from "@lblod/ember-rdfa-editor/model/model-node";
import {Direction} from "@lblod/ember-rdfa-editor/model/util/types";
import ModelSelection from "@lblod/ember-rdfa-editor/model/model-selection";
import Command from "@lblod/ember-rdfa-editor/commands/command";
import ModelElement from "../model/model-element";


/**
 * command will convert all nodes in the selection to a list if they are not already in a list
 */
export default class MakeUnorderedListCommand extends Command {
  name = "make-unordered-list";

  constructor(model: Model) {
    super(model);
  }

  execute(selection: ModelSelection = this.model.selection) {
    if (!ModelSelection.isWellBehaved(selection)) {
      throw new MisbehavedSelectionError();
    }
    const commonAncestor = selection.getCommonAncestor();
    const parentElement = commonAncestor?.parentElement;
    if(!commonAncestor) return;
    let nodes = [];
    if(selection.isCollapsed) {
      nodes = [commonAncestor.parent];
      let nextElement = commonAncestor.parent.nextSibling;
      while(nextElement && nextElement.boundNode?.nodeName !== 'BR') {
        nodes.push(nextElement);
        nextElement = nextElement.nextSibling;
      }
      let previousElement = commonAncestor.parent.previousSibling;
      while(previousElement && previousElement.boundNode?.nodeName !== 'BR') {
        nodes.push(previousElement);
        previousElement = previousElement.previousSibling;
      }
    } else {
      const nodeFinder = new ModelNodeFinder({
        startNode: selection.lastRange.start.parent,
        endNode: selection.lastRange.end.parent,
        rootNode: commonAncestor.parent,
        direction: Direction.FORWARDS
      });

      nodes = Array.from(nodeFinder) as ModelNode[];
    }
    const items = [];
    let index = 0;
    const lastNode = nodes[nodes.length-1];
    if(lastNode.nextSibling && ModelNode.isModelElement(lastNode.nextSibling) && lastNode.nextSibling.boundNode?.nodeName === 'BR') {
      this.model.removeModelNode(lastNode.nextSibling);
    }
    for(const node of nodes) {
      if(ModelNode.isModelElement(node) && node.boundNode?.nodeName === 'BR') {
        index++;
        this.model.removeModelNode(node);
        continue;
      } else {
        if(items[index]) {
          items[index].push(node);
        } else {
          items[index] = [node];
        }
      }
      this.model.removeModelNode(node);
    }
    const listNode = this.buildList('ul', items);
    if(parentElement) {
      parentElement.addChild(listNode, selection.lastRange.start.parentOffset);
      this.model.write(parentElement);
    }
    
  }
  buildList(type: String, items: ModelNode[][]) {
    const rootNode = new ModelElement(type);
    for(const item of items) {
      const listItem = new ModelElement('li');
      for(const child of item) {
        listItem.addChild(child);
      }
      rootNode.addChild(listItem);
    }
    return rootNode;
  }
}
