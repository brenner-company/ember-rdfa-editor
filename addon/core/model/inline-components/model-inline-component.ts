import { tracked } from 'tracked-built-ins';
import Controller from '../../controllers/controller';
import { DomNodeMatcher } from '../marks/mark';
import ModelElement from '../nodes/model-element';
import ModelNode, { DirtyType, ModelNodeType } from '../nodes/model-node';
import { AttributeSpec, Serializable } from '../../../utils/render-spec';
import { InlineComponentName } from '@lblod/ember-rdfa-editor';

export type Properties = Record<string, Serializable | undefined>;

export type State = Record<string, Serializable | undefined>;
export abstract class InlineComponentSpec {
  name: InlineComponentName;
  tag: keyof HTMLElementTagNameMap;
  atomic: boolean;

  abstract matcher: DomNodeMatcher<AttributeSpec>;
  controller: Controller;

  constructor(
    name: InlineComponentName,
    tag: keyof HTMLElementTagNameMap,
    controller: Controller,
    atomic = true
  ) {
    this.name = name;
    this.tag = tag;
    this.controller = controller;
    this.atomic = atomic;
  }

  abstract _renderStatic(props?: Properties, state?: State): string;
}

function render(
  spec: InlineComponentSpec,
  props?: Properties,
  state?: State,
  dynamic = true
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
  if (!dynamic) {
    node.innerHTML = spec._renderStatic(props, state);
  }
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
  write(dynamic = true): HTMLElement {
    return render(this.spec, this.props, this.state, dynamic);
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
    if (
      !ModelNode.isModelInlineComponent(other) ||
      this.type !== other.type ||
      this.spec !== other.spec ||
      this.props !== other.props
    ) {
      dirtiness.add('node');
    }

    return dirtiness;
  }
}
