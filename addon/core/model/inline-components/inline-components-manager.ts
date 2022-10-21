import { ModelInlineComponent } from './model-inline-component';
// eslint-disable-next-line ember/no-classic-components
import Component from '@ember/component';
import MapUtils from '@lblod/ember-rdfa-editor/utils/map-utils';

export type ActiveComponentEntry = {
  model: ModelInlineComponent;
  node: HTMLElement;
  emberComponentInstance: Component;
};
export default class InlineComponentsManager {
  activeComponents: Map<string, ActiveComponentEntry[]>;

  constructor(activeComponents?: Map<string, ActiveComponentEntry[]>) {
    this.activeComponents =
      activeComponents ?? new Map<string, ActiveComponentEntry[]>();
  }

  addComponentInstance(
    model: ModelInlineComponent,
    node: HTMLElement,
    emberComponentInstance: Component
  ) {
    MapUtils.setOrPush(this.activeComponents, model.spec.name, {
      model,
      node,
      emberComponentInstance,
    });
  }

  // updateComponentInstanceNode(
  //   model: ModelInlineComponent,
  //   node: HTMLElement,
  //   children: Node[]
  // ) {
  //   const entry = this.activeComponents.get(model);
  //   if (entry) {
  //     entry.node = node;
  //     entry.children = children;
  //   }
  // }

  clean() {
    for (const [
      componentName,
      componentInstances,
    ] of this.activeComponents.entries()) {
      const filteredComponentInstances = [];
      for (const componentInstance of componentInstances) {
        if (componentInstance.node.isConnected) {
          filteredComponentInstances.push(componentInstance);
        } else {
          componentInstance.emberComponentInstance.destroy();
        }
      }
      this.activeComponents.set(componentName, filteredComponentInstances);
    }
  }
}
