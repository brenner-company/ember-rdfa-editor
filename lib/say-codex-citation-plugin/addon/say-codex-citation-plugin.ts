import {EditorPlugin} from "@lblod/ember-rdfa-editor/core/editor-plugin";
import EditorController from "@lblod/ember-rdfa-editor/core/editor-controller";
import {UninitializedError} from "@lblod/ember-rdfa-editor/util/errors";


export default class SayCodexCitationPlugin implements EditorPlugin {
  private _controller?: EditorController;

  get name(): string {
    return 'say-codex-citation';
  }

  static create() {
    return new SayCodexCitationPlugin();
  }

  get controller(): EditorController {
    if (!this._controller) {
      throw new UninitializedError();
    }
    return this._controller;

  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async initialize(controller: EditorController) {
    controller.registerWidget({
      desiredLocation: 'sidebar',
      componentName: 'say-codex-citation-card',
      identifier: 'say-codex-citation-card'
    });
    this._controller = controller;
  }
}
