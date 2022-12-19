import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { Schema } from 'prosemirror-model';
import {
  em,
  link,
  strikethrough,
  strong,
  underline,
} from '@lblod/ember-rdfa-editor/marks';
import {
  block_rdfa,
  blockquote,
  bullet_list,
  code_block,
  doc,
  hard_break,
  heading,
  horizontal_rule,
  image,
  inline_rdfa,
  list_item,
  ordered_list,
  paragraph,
  repaired_block,
  text,
} from '@lblod/ember-rdfa-editor/nodes';
import { tableNodes } from '@lblod/ember-rdfa-editor/plugins/table';
import { code } from 'dummy/dummy-plugins/code-mark-plugin';

/**
 * Utility to get the editor element in a type-safe way
 * This avoids having to nullcheck everywhere where a null editor would be an error anyway.
 * @returns the editor element
 */
export function getEditorElement(): Element {
  const editor = document.querySelector('div[contenteditable]');
  if (!editor) throw new Error('Editor element not found in dom');
  return editor;
}

/**
 * Promise which waits for ms milliseconds
 * @param ms number of milliseconds to wait
 * @returns A Promise which waits for ms milliseconds
 */
export function delayMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Setup and render the editor
 * @returns A promise which renders the editor
 */
export async function renderEditor() {
  await render(hbs`
      <Rdfa::RdfaEditor
              @rdfaEditorInit={{this.rdfaEditorInit}}
              @profile="default"
              class="rdfa-playground"
              @editorOptions={{hash showToggleRdfaAnnotations="true" showInsertButton=null showRdfa="true"
                                    showRdfaHighlight="true" showRdfaHover="true"}}
              @toolbarOptions={{hash showTextStyleButtons="true" showListButtons="true" showIndentButtons="true"}}
      />`);
  return getEditorElement();
}

const nodes = {
  doc,
  paragraph,

  repaired_block,

  list_item,
  ordered_list,
  bullet_list,
  ...tableNodes({ tableGroup: 'block', cellContent: 'inline*' }),
  heading,
  blockquote,

  horizontal_rule,
  code_block,

  text,

  image,

  hard_break,
  inline_rdfa,
  block_rdfa,
};
const marks = {
  code,
  link,
  em,
  strong,
  underline,
  strikethrough,
};

const TEST_SCHEMA = new Schema({ nodes, marks });
export default TEST_SCHEMA;
