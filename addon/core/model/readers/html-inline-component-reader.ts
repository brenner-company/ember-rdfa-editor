import { INLINE_COMPONENT_CHILDREN_SELECTOR } from '@lblod/ember-rdfa-editor/utils/constants';
import { isElement } from '@lblod/ember-rdfa-editor/utils/dom-helpers';
import {
  InlineComponentSpec,
  ModelInlineComponent,
  Properties,
  State,
} from '../inline-components/model-inline-component';
import readHtmlNode from './html-node-reader';
import { HtmlReaderContext } from './html-reader';

export default function readHtmlInlineComponent(
  element: HTMLElement,
  spec: InlineComponentSpec,
  context: HtmlReaderContext
) {
  const propsAttribute = element.dataset['__props'];
  let props: Properties = {};
  if (propsAttribute) {
    props = JSON.parse(propsAttribute) as Properties;
  }
  const stateAttribute = element.dataset['__state'];
  let state: State = {};
  if (stateAttribute) {
    state = JSON.parse(stateAttribute) as State;
  }
  const component = new ModelInlineComponent(spec, props, state);
  const childrenWrapper = element.querySelector(
    INLINE_COMPONENT_CHILDREN_SELECTOR
  );
  if (childrenWrapper && isElement(childrenWrapper)) {
    for (const child of childrenWrapper.childNodes) {
      const parsedChildren = readHtmlNode(child, context);
      component.appendChildren(...parsedChildren);
    }
  }
  // const childNodes = childrenWrapper?.childNodes
  //   ? [...childrenWrapper.childNodes.values()]
  //   : [];
  return [component];
}
