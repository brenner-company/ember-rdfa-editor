import { handleUndo } from '@lblod/ember-rdfa-editor/input/history';
import {
  handleInsertLineBreak,
  handleInsertListItem,
  handleInsertText,
} from '@lblod/ember-rdfa-editor/input/insert';
import { mapKeyEvent } from '@lblod/ember-rdfa-editor/input/keymap';
import SelectionReader from '@lblod/ember-rdfa-editor/model/readers/selection-reader';
import { getWindowSelection } from '@lblod/ember-rdfa-editor/utils/dom-helpers';
import Controller from '../model/controller';
import { NotImplementedError } from '../utils/errors';
import { createLogger } from '../utils/logging-utils';
import handleCutCopy from './cut-copy';
import { handleDelete } from './delete';
import handlePaste from './paste';

/**
 * Represents an object which collects all the various dom-events
 * that are needed to respond to user input
 * */
export interface InputHandler {
  keydown(event: KeyboardEvent): void;

  dragstart(event: DragEvent): void;

  /**
   * Handles the (relatively) new "beforeinput" events as specified here:
   * https://www.w3.org/TR/input-events-1/#events-inputevents
   * There are fired _before_ the browser handles a user input and describe what the
   * browser is planning to do in a much more descriptive way than handling bare keyboardevents
   *
   * Using these to capture input is always preferred if possible
   * */
  beforeInput(event: InputEvent): void;

  afterInput(event: InputEvent): void;

  /**
   * Corresponds to the "selectionstart" event
   * */
  beforeSelectionChange(event: Event): void;

  afterSelectionChange(event: Event): void;
}

export class EditorInputHandler implements InputHandler {
  private inputController: Controller;

  constructor(controller: Controller) {
    this.inputController = controller;
  }

  keydown(event: KeyboardEvent) {
    mapKeyEvent(this.inputController, event);
  }

  dragstart(event: DragEvent) {
    event.preventDefault();
  }

  paste(
    event: ClipboardEvent,
    pasteHTML?: boolean,
    pasteExtendedHTML?: boolean
  ) {
    event.preventDefault();
    handlePaste(this.inputController, event, pasteHTML, pasteExtendedHTML);
  }

  cut(event: ClipboardEvent) {
    event.preventDefault();
    handleCutCopy(this.inputController, event, true);
  }

  copy(event: ClipboardEvent) {
    event.preventDefault();
    handleCutCopy(this.inputController, event, false);
  }

  afterInput(event: InputEvent): void {
    const logger = createLogger('afterInput');
    logger(JSON.stringify(event));
    logger(event);
    logger(event.target);
    logger(event.getTargetRanges());
  }

  beforeInput(event: InputEvent): void {
    // check manipulation by plugins
    for (const plugin of this.inputController.currentState.plugins) {
      if (plugin.handleEvent) {
        const { handled } = plugin.handleEvent(event);
        if (handled) {
          return;
        }
      }
    }
    console.log('handling beforeInput with type', event.inputType);
    switch (event.inputType) {
      case 'insertText':
        handleInsertText(this.inputController, event);
        break;
      case 'insertReplacementText':
        handleInsertText(this.inputController, event);
        break;
      case 'insertLineBreak':
        handleInsertLineBreak(this.inputController, event);
        break;
      case 'insertParagraph':
        handleInsertLineBreak(this.inputController, event);
        break;
      case 'insertOrderedList':
        handleInsertListItem(this.inputController, event, 'ol');
        break;
      case 'insertUnorderedList':
        handleInsertListItem(this.inputController, event, 'ul');
        break;
      case 'insertHorizontalRule':
        break;
      case 'insertCompositionText':
        break;
      case 'insertFromPaste':
        break;
      case 'deleteWordBackward':
        handleDelete(this.inputController, event, -1);
        break;
      case 'deleteWordForward':
        handleDelete(this.inputController, event, 1);
        break;
      case 'deleteSoftLineBackward':
        break;
      case 'deleteSoftLineForward':
        event.preventDefault();
        break;
      case 'deleteEntireSoftLine':
        break;
      case 'deleteHardLineBackward':
        break;
      case 'deleteHardLineForward':
        event.preventDefault();
        break;
      case 'deleteContent':
        event.preventDefault();
        break;
      case 'deleteContentBackward':
        handleDelete(this.inputController, event, -1);
        break;
      case 'deleteContentForward':
        handleDelete(this.inputController, event, 1);
        break;
      case 'historyUndo':
        handleUndo(this.inputController, event);
        break;
      case 'historyRedo':
        event.preventDefault();
        break;

      default:
        console.warn('Unhandled beforeinput event type:', event.inputType);
        break;
    }
  }

  beforeSelectionChange(event: Event): void {
    throw new NotImplementedError(`did not handle ${event.type}`);
  }

  afterSelectionChange(): void {
    console.log('handling selectionChanged');
    const currentSelection = getWindowSelection();
    const viewRoot = this.inputController.view.domRoot;
    if (
      !viewRoot.contains(currentSelection.anchorNode) ||
      !viewRoot.contains(currentSelection.focusNode) ||
      (currentSelection.type != 'Caret' &&
        viewRoot === currentSelection.anchorNode &&
        currentSelection.anchorOffset === currentSelection.focusOffset)
    ) {
      return;
    }
    const selectionReader = new SelectionReader();
    const newSelection = selectionReader.read(
      this.inputController.currentState,
      this.inputController.view.domRoot,
      currentSelection
    );
    if (!this.inputController.currentState.selection.sameAs(newSelection)) {
      const tr = this.inputController.createTransaction();
      tr.setSelection(newSelection);
      this.inputController.dispatchTransaction(tr, false);
    }
  }
}
