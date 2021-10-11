import ModelSelection from "@lblod/ember-rdfa-editor/core/model/model-selection";
import {getWindowSelection} from "@lblod/ember-rdfa-editor/archive/utils/dom-helpers";
import EventBus, {SelectionChangedEvent} from "@lblod/ember-rdfa-editor/archive/utils/event-bus";
import {HtmlModel} from "@lblod/ember-rdfa-editor/core/editor-model";

export default class ModelSelectionTracker {
  model: HtmlModel;

  constructor(model: HtmlModel) {
    this.model = model;
  }

  startTracking() {
    document.addEventListener('selectionchange', this.updateSelection);
  }

  stopTracking() {
    document.removeEventListener('selectionchange', this.updateSelection);
  }

  updateSelection = () => {
    const currentSelection = getWindowSelection();
    if (!this.model.rootElement.contains(currentSelection.anchorNode) || !this.model.rootElement.contains(currentSelection.focusNode) ||
      (currentSelection.type != 'Caret' && this.model.rootElement === currentSelection.anchorNode && (currentSelection.anchorOffset === currentSelection.focusOffset))) {
      // this.model.selection.clearRanges();
      return;
    }
    this.model.readSelection();
    const modelSelectionUpdatedEvent = new CustomEvent<ModelSelection>(
      'richSelectionUpdated',
      {detail: this.model.selection}
    );
    document.dispatchEvent(modelSelectionUpdatedEvent);
    EventBus.emitDebounced(100, new SelectionChangedEvent());
  };
}