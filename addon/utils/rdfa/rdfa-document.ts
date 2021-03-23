import RawEditor from '../ce/raw-editor';
import ModelSelection from '@lblod/ember-rdfa-editor/model/model-selection';

/**
 * RdfaDocument is a virtual representation of the document
 * it creates a DOM copy that does not include highlights
 * both richNode and rootNode are calculated on the fly.
 *
 * This is both to protect the internal dom of the editor and to remove internals
 */
export default class RdfaDocument {
  private _editor: RawEditor;

  constructor(editor: RawEditor) {
    this._editor = editor;
  }

  get htmlContent() {
    // TODO: this no longer removes the highlights and should be fixed
    return this._editor.rootNode.innerHTML;
  }

  set htmlContent(html: string) {
    const selection = this._editor.createSelection();
    selection.selectRange(this._editor.createRangeFromPaths([], []));
    this._editor.executeCommand("insert-html", html, selection);
  }

  setHtmlContent(html: string) {
    this.htmlContent = html;
  }
}
