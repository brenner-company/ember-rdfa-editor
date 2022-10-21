import { tagName } from '@lblod/ember-rdfa-editor/utils/dom-helpers';
import { TagMatch } from '../marks/mark';
import MapUtils from '../../../utils/map-utils';
import { InlineComponentSpec } from './model-inline-component';
import { InlineComponentName } from '@lblod/ember-rdfa-editor';

export interface InlineComponentsRegistryArgs {
  registeredComponents?: Map<InlineComponentName, InlineComponentSpec>;
  componentMatchMap?: Map<TagMatch, InlineComponentSpec[]>;
}
export default class InlineComponentsRegistry {
  private registeredComponents: Map<InlineComponentName, InlineComponentSpec>;
  private componentMatchMap: Map<TagMatch, InlineComponentSpec[]>;

  constructor(args?: InlineComponentsRegistryArgs) {
    this.registeredComponents =
      args?.registeredComponents ??
      new Map<InlineComponentName, InlineComponentSpec>();
    this.componentMatchMap =
      args?.componentMatchMap ?? new Map<TagMatch, InlineComponentSpec[]>();
  }

  matchInlineComponentSpec(node: Node): InlineComponentSpec | null {
    const potentialMatches =
      this.componentMatchMap.get(tagName(node) as TagMatch) || [];
    let result: InlineComponentSpec | null = null;
    for (const spec of potentialMatches) {
      if (spec.matcher.attributeBuilder) {
        const baseAttributesMatch = spec.matcher.attributeBuilder(node);
        if (baseAttributesMatch) {
          result = spec;
          break;
        }
      } else {
        result = spec;
      }
    }
    return result;
  }

  registerComponent(componentSpec: InlineComponentSpec) {
    this.registeredComponents.set(componentSpec.name, componentSpec);
    MapUtils.setOrPush(
      this.componentMatchMap,
      componentSpec.matcher.tag,
      componentSpec
    );
  }

  lookUpComponent(name: InlineComponentName) {
    return this.registeredComponents.get(name);
  }
}
