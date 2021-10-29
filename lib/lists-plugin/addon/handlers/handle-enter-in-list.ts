import EditorController from "@lblod/ember-rdfa-editor/core/editor-controller";
import { PropertyState } from "@lblod/ember-rdfa-editor/util/types";
import {KeydownEvent} from "@lblod/ember-rdfa-editor/core/editor-events";

export default function handleEnterInList(controller: EditorController, event: KeydownEvent) {
  const selection = controller.selection;
  if(selection.inListState === PropertyState.enabled) {
    event.stopPropagation();
    controller.executeCommand('insert-newLi');
  }
}
