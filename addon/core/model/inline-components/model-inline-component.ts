import { tracked } from 'tracked-built-ins';
import Controller from '../../controllers/controller';
import { DomNodeMatcher } from '../marks/mark';
import ModelElement from '../nodes/model-element';
import ModelNode, { DirtyType, ModelNodeType } from '../nodes/model-node';
import { AttributeSpec, Serializable } from '../../../utils/render-spec';
import { TemplateFactory } from 'htmlbars-inline-precompile';
import InlineComponentController from './inline-component-controller';
import { v4 as uuidv4 } from 'uuid';
import { EmberComponent, InlineComponentName } from '@lblod/ember-rdfa-editor';
// eslint-disable-next-line ember/no-classic-components
import Component from '@ember/component';

export type Properties = Record<string, Serializable | undefined>;

export type State = Record<string, Serializable | undefined>;
export abstract class InlineComponentSpec {
  name: InlineComponentName;
  controller: Controller;
  abstract tag: keyof HTMLElementTagNameMap;
  abstract template: TemplateFactory;
  abstract atomic: boolean;

  abstract matcher: DomNodeMatcher<AttributeSpec>;

  constructor(controller: Controller, name: InlineComponentName) {
    this.controller = controller;
    this.name = name;
  }

  abstract _renderStatic(props?: Properties, state?: State): string;
}

function createWrapper(
  spec: InlineComponentSpec,
  props?: Properties,
  state?: State
) {
  const node = document.createElement(spec.tag);
  if (props) {
    node.dataset['__props'] = JSON.stringify(props);
  }
  if (state) {
    node.dataset['__state'] = JSON.stringify(state);
  }
  node.contentEditable = 'false';
  node.classList.add('inline-component', spec.name);
  return node;
}

export class ModelInlineComponent<
  A extends Properties = Properties,
  S extends State = State
> extends ModelElement {
  modelNodeType: ModelNodeType = 'INLINE-COMPONENT';
  private _spec: InlineComponentSpec;
  private _props: A;

  @tracked
  private _state: S;

  constructor(spec: InlineComponentSpec, props: A, state: S) {
    super(spec.tag);
    this._spec = spec;
    this._props = props;
    this._state = tracked(state);
  }

  get props() {
    return this._props;
  }

  get state() {
    return this._state;
  }

  setStateProperty(property: keyof S, value: Serializable) {
    this._state = tracked({ ...this.state, [property]: value });
  }

  getStateProperty(property: keyof S) {
    if (property in this.state) {
      return this.state[property];
    } else {
      return null;
    }
  }

  get spec() {
    return this._spec;
  }
  write(dynamic = true): {
    element: HTMLElement;
    emberComponent?: EmberComponent;
  } {
    const node = createWrapper(this.spec, this.props, this.state);
    if (dynamic) {
      const instance = window.__APPLICATION;
      const componentName = `${this.spec.name}-${uuidv4()}`;
      instance?.register(
        `component:${componentName}`,
        // eslint-disable-next-line ember/no-classic-classes, ember/require-tagless-components
        Component.extend({
          layout: this.spec.template,
          tagName: '',
          // eslint-disable-next-line ember/avoid-leaking-state-in-ember-objects
          componentController: new InlineComponentController(this),
          editorController: this.spec.controller,
        })
      );
      const component = instance?.lookup(
        `component:${componentName}`
      ) as EmberComponent;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      component.appendTo(node);
      return {
        element: node,
        emberComponent: component,
      };
    } else {
      node.innerHTML = this.spec._renderStatic(this.props, this.state);
      return {
        element: node,
      };
    }
  }

  clone(): ModelInlineComponent<A, S> {
    const result = new ModelInlineComponent(this.spec, this.props, this.state);
    const clonedChildren = this.children.map((c) => c.clone());
    result.appendChildren(...clonedChildren);
    return result;
  }

  get isLeaf() {
    return false;
  }

  diff(other: ModelNode): Set<DirtyType> {
    const dirtiness: Set<DirtyType> = new Set();
    if (!ModelNode.isModelInlineComponent(other)) {
      dirtiness.add('node');
      dirtiness.add('content');
    } else {
      if (
        this.type !== other.type ||
        this.spec !== other.spec ||
        this.props !== other.props
      ) {
        dirtiness.add('node');
      }
      if (this.length !== other.length) {
        dirtiness.add('content');
      } else {
        for (let i = 0; i < this.length; i++) {
          const child1 = this.children[i];
          const child2 = other.children[i];
          if (ModelNode.isModelText(child1) || ModelNode.isModelText(child2)) {
            const diff = child1.diff(child2);
            if (diff.has('mark') || diff.has('node')) {
              dirtiness.add('content');
              break;
            }
          }
        }
      }
    }
    return dirtiness;
  }
}
