import ModelElement from '@lblod/ember-rdfa-editor/core/model/nodes/model-element';

const INTERNAL_ATTRIBUTES = [
  'data-editor-highlight',
  'data-editor-position-level',
  'data-editor-rdfa-position-level',
  'contenteditable',
];

export default function writeUnpollutedHtmlElement(
  modelNode: ModelElement
): HTMLElement {
  const result = document.createElement(modelNode.type);

  for (const [key, value] of modelNode.attributeMap.entries()) {
    if (!INTERNAL_ATTRIBUTES.includes(key)) {
      result.setAttribute(key, value);
    }
  }
  return result;
}