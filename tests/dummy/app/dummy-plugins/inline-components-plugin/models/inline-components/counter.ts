import Controller from '@lblod/ember-rdfa-editor/core/controllers/controller';
import {
  InlineComponentSpec,
  Properties,
  State,
} from '@lblod/ember-rdfa-editor/core/model/inline-components/model-inline-component';
import { isElement } from '@lblod/ember-rdfa-editor/utils/dom-helpers';
import { hbs } from 'ember-cli-htmlbars';

declare module '@lblod/ember-rdfa-editor' {
  export interface InlineComponents {
    counter: CounterSpec;
  }
}
export default class CounterSpec extends InlineComponentSpec {
  tag: keyof HTMLElementTagNameMap = 'span';
  atomic = true;
  template = hbs`
      <InlineComponentsPlugin::Counter @componentController={{this.componentController}}/>
  `;
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

  _renderStatic(props?: Properties, state?: State): string {
    const count = (state?.count as number) || 0;
    return `<p>${count}</p>`;
  }

  constructor(controller: Controller) {
    super(controller, 'counter');
  }
}
