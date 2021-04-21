import Operation from "@lblod/ember-rdfa-editor/model/operations/operation";
import ModelRange from "@lblod/ember-rdfa-editor/model/model-range";
import ModelNode from "@lblod/ember-rdfa-editor/model/model-node";
import ModelPosition from "@lblod/ember-rdfa-editor/model/model-position";
import OperationAlgorithms from "@lblod/ember-rdfa-editor/model/operations/operation-algorithms";

export default class InsertOperation extends Operation {
  private _nodes: ModelNode[];

  constructor(range: ModelRange, ...nodes: ModelNode[]) {
    super(range);
    this._nodes = nodes;
  }

  get nodes(): ModelNode[] {
    return this._nodes;
  }

  set nodes(value: ModelNode[]) {
    this._nodes = value;
  }

  execute(): ModelRange {
    if(!this.nodes.length) {
      return this.range;
    }
    OperationAlgorithms.insert(this.range, ...this.nodes);
    if(this.range.collapsed) {
      const last = this.nodes[this.nodes.length - 1];
      const pos = ModelPosition.fromAfterNode(last);
      return new ModelRange(pos, pos);
    }
    const first = this.nodes[0];
    const last = this.nodes[this.nodes.length - 1];
    const start = ModelPosition.fromBeforeNode(first);
    const end = ModelPosition.fromAfterNode(last);
    return new ModelRange(start, end);
  }

}
