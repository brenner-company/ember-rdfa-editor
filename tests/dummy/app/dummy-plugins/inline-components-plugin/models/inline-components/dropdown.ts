import { InlineComponentSpec } from '@lblod/ember-rdfa-editor/core/model/inline-components/model-inline-component';
import { isElement } from '@lblod/ember-rdfa-editor/utils/dom-helpers';
import { hbs } from 'ember-cli-htmlbars';
import { TemplateFactory } from 'htmlbars-inline-precompile';

declare module '@lblod/ember-rdfa-editor' {
  export interface InlineComponents {
    dropdown: DropdownSpec;
  }
}
export default class DropdownSpec extends InlineComponentSpec {
  name = 'dropdown';
  tag: keyof HTMLElementTagNameMap = 'span';
  template: TemplateFactory = hbs`<InlineComponentsPlugin::Dropdown/>`;
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
  _renderStatic() {
    return `
      <p>Dropdown</p>
    `;
  }
}
