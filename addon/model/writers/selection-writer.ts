import Writer from "@lblod/ember-rdfa-editor/model/writers/writer";
import ModelSelection from "@lblod/ember-rdfa-editor/model/model-selection";
import {getWindowSelection} from "@lblod/ember-rdfa-editor/utils/dom-helpers";
import ModelRange from "@lblod/ember-rdfa-editor/model/model-range";
import ModelPosition from "@lblod/ember-rdfa-editor/model/model-position";
import {SelectionError} from "@lblod/ember-rdfa-editor/utils/errors";

/**
 * Writer to convert a {@link ModelSelection} to a {@link Selection}
 * Note, unlike most readers, this is not a functional reader, since we cannot (or should not)
 * create a {@link Selection}
 */
export default class SelectionWriter implements Writer<ModelSelection, void> {
  write(modelSelection: ModelSelection): void {
    const domSelection = getWindowSelection();
    domSelection.removeAllRanges();
    for (const range of modelSelection.ranges) {
      domSelection.addRange(this.writeDomRange(range));
    }

  }

  /**
   * Convert a single {@link ModelRange} to a {@link Range}
   * @param range
   */
  writeDomRange(range: ModelRange): Range {
    const rslt = document.createRange();
    const startPos = this.writeDomPosition(range.start);
    const endPos = this.writeDomPosition(range.end);
    rslt.setStart(startPos.anchor, startPos.offset);
    rslt.setEnd(endPos.anchor, endPos.offset);

    return rslt;
  }

  /**
   * Convert a single {@link ModelPosition} to a DOM position
   * (aka a {@link Node} and an offset)
   * @param position
   */
  writeDomPosition(position: ModelPosition): { anchor: Node, offset: number } {
    const anchor = position.parent.boundNode;
    if (!anchor) {
      throw new SelectionError("trying to write a selection with an unbound position");
    }
    return {anchor, offset: position.parentOffset};

  }

}