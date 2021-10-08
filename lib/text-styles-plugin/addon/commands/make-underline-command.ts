import ModelSelection from "@lblod/ember-rdfa-editor/core/model/model-selection";
import SetPropertyCommand from "text-styles-plugin/commands/set-property-command";

export default class MakeUnderlineCommand extends SetPropertyCommand<[ModelSelection]> {
  name = 'make-underline';

  execute(executedBy: string, selection: ModelSelection = this.model.selection) {
    super.setProperty(executedBy, "underline", true, selection);
  }
}
