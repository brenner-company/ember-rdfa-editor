import Command from "./command";
import Model from "@lblod/ember-rdfa-editor/model/model";
import ModelSelection from "@lblod/ember-rdfa-editor/model/model-selection";
import ModelTable from "@lblod/ember-rdfa-editor/model/model-table";
import {MisbehavedSelectionError} from "@lblod/ember-rdfa-editor/utils/errors";


export default class RemoveTableRowCommand extends Command {
  name = "remove-table-row";

  constructor(model: Model) {
    super(model);
  }

  canExecute(): boolean {
    return true;
  }

  execute(): void {

    const selection= this.model.selection;
    if (!ModelSelection.isWellBehaved(selection)) {
      throw new MisbehavedSelectionError();
    }
    const cell = ModelTable.getCellFromSelection(selection);
    if(!cell) {
      throw new Error('The selection is not inside a cell');
    }

    const table = ModelTable.getTableFromSelection(selection);

    if(!table) {
      throw new Error('The selection is not inside a table');
    }

    const position = ModelTable.getCellIndex(cell);
    if(!position || position.x === null) {
      //Shouldn't happen
      throw new Error('Position is null');
    }

    const tableDimensions = table.getDimensions();
    
    let cellYToSelect = position.y + 1;
    if(cellYToSelect >= tableDimensions.y) {
      cellYToSelect = position.y -1;
    }
    const cellToSelect = table.getCell(position.x, cellYToSelect);
    if(cellToSelect) {
      selection.collapseOn(cellToSelect);
    }
    this.model.write();

    table.removeRow(position.y);

    this.model.write();
  }
}