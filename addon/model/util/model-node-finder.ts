import ModelNode from "@lblod/ember-rdfa-editor/model/model-node";
import {Direction} from "@lblod/ember-rdfa-editor/model/util/types";
import ModelElement from "@lblod/ember-rdfa-editor/model/model-element";
import NodeFinder from "@lblod/ember-rdfa-editor/model/util/node-finder";


/**
 * {@link ModelNode} implementation of a {@link NodeFinder}
 */
export default class ModelNodeFinder<R extends ModelNode = ModelNode> extends NodeFinder<ModelNode, R> {

  protected nextSibling(node: ModelNode, direction: Direction): ModelNode | null {
    if (direction === Direction.FORWARDS) {
      return node.nextSibling;
    } else {
      return node.previousSibling;
    }
  }

  protected getChildren(node: ModelNode): ModelNode[] | null {
    if (node instanceof ModelElement) {
      return node.childCount ? node.children : null;
    }
    return null;
  }

  protected getParent(node: ModelNode): ModelNode | null {
    return node.parent;
  }
}