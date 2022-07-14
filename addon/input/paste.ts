import { Editor } from '../core/editor';
import ModelRangeUtils from '../model/util/model-range-utils';
import { PropertyState } from '../model/util/types';
import { MisbehavedSelectionError } from '../utils/errors';
import HTMLInputParser, { LIMITED_SAFE_TAGS } from '../utils/html-input-parser';

// export function handlePaste(editor: Editor, event: PasteEvent) {
//   throw new NotImplementedError();
// }

export default function handlePaste(
  editor: Editor,
  event: ClipboardEvent,
  pasteHTML?: boolean,
  pasteExtendedHTML?: boolean
) {
  const clipboardData = event.clipboardData;

  if (!clipboardData) {
    // this.logger('No clipboardData object found, ignoring paste.');
    return { allowPropagation: false, allowBrowserDefault: false };
  }

  const isInTable =
    editor.state.selection.inTableState === PropertyState.enabled;
  const canPasteHTML =
    !isInTable &&
    (pasteHTML || pasteExtendedHTML) &&
    hasClipboardHtmlContent(clipboardData);

  const range = editor.state.selection.lastRange;
  if (!range) {
    throw new MisbehavedSelectionError();
  }

  const pasteRange = ModelRangeUtils.getExtendedToPlaceholder(range);
  if (canPasteHTML) {
    try {
      const inputParser = pasteExtendedHTML
        ? new HTMLInputParser({})
        : new HTMLInputParser({ safeTags: LIMITED_SAFE_TAGS });

      const htmlPaste = clipboardData.getData('text/html');
      const cleanHTML = inputParser.cleanupHTML(htmlPaste);
      editor.executeCommand('insert-html', {
        htmlString: cleanHTML,
        range: pasteRange,
      });
    } catch (error) {
      // Fall back to text pasting.
      console.warn(error); //eslint-disable-line no-console
      const text = getClipboardContentAsText(clipboardData);
      editor.executeCommand('insert-text', { text, range: pasteRange });
    }
  } else {
    const text = getClipboardContentAsText(clipboardData);
    editor.executeCommand('insert-text', { text, range: pasteRange });
  }
}

function hasClipboardHtmlContent(clipboardData: DataTransfer): boolean {
  const potentialContent = clipboardData.getData('text/html') || '';
  return potentialContent.length > 0;
}

function getClipboardContentAsText(clipboardData: DataTransfer): string {
  const text = clipboardData.getData('text/plain') || '';
  if (text.length === 0) {
    return clipboardData.getData('text') || '';
  }

  return text;
}