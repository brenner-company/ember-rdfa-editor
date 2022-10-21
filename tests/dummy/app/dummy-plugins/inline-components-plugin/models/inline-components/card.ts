import Controller from '@lblod/ember-rdfa-editor/core/controllers/controller';
import {
  InlineComponentSpec,
  Properties,
  State,
} from '@lblod/ember-rdfa-editor/core/model/inline-components/model-inline-component';
import { isElement } from '@lblod/ember-rdfa-editor/utils/dom-helpers';
import { hbs } from 'ember-cli-htmlbars';
import { TemplateFactory } from 'htmlbars-inline-precompile';

declare module '@lblod/ember-rdfa-editor' {
  export interface InlineComponents {
    card: CardSpec;
  }
}
export default class CardSpec extends InlineComponentSpec {
  tag: keyof HTMLElementTagNameMap = 'span';
  template: TemplateFactory = hbs`<InlineComponentsPlugin::Card/>`;
  atomic = true;
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
    return `<div>
              <h1>Title</h1>
              <p>Subtitle</p>
              <span data-slot />
            </div>`;
  }

  constructor(controller: Controller) {
    super(controller, 'card');
  }
}
