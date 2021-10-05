import {EditorPlugin} from "@lblod/ember-rdfa-editor/plugins/editor-plugin";
import EditorController from "@lblod/ember-rdfa-editor/core/editor-controller";
import MakeBoldCommand from "@lblod/ember-rdfa-editor/plugins/text-styles/commands/make-bold-command";
import RemoveBoldCommand from "@lblod/ember-rdfa-editor/plugins/text-styles/commands/remove-bold-command";

export default class TextStylesPlugin implements EditorPlugin {
  get name(): string {
    return "text-styles";
  }

  async initialize(controller: EditorController): Promise<void> {
    controller.registerCommand(MakeBoldCommand);
    // controller.registerCommand(RemoveBoldCommand);
    controller.registerWidget({
      desiredLocation: "toolbar",
      componentName: "bold-button",
      identifier: "text-styles-bold-button"
    });

  }


}
