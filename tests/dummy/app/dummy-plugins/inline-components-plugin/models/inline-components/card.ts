import Controller from '@lblod/ember-rdfa-editor/core/controllers/controller';
import {
  InlineComponentSpec,
  Properties,
  State,
} from '@lblod/ember-rdfa-editor/core/model/inline-components/model-inline-component';
import { isElement } from '@lblod/ember-rdfa-editor/utils/dom-helpers';

declare module '@lblod/ember-rdfa-editor' {
  export interface InlineComponents {
    'inline-components-plugin/card': CardSpec;
  }
}
export default class CardSpec extends InlineComponentSpec {
  matcher = {
    tag: this.tag,
    attributeBuilder: (node: Node) => {
      if (isElement(node)) {
        if (
          node.classList.contains('inline-component') &&
          node.classList.contains(this.name)
        ) {
          return {};
        }
      }
      return null;
    },
  };
  _renderStatic(_props: Properties, _state: State) {
    return '';
  }
  constructor(controller: Controller) {
    super('inline-components-plugin/card', 'span', controller);
  }
}
