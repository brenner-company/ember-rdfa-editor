import Controller from '../../controllers/controller';
import { Serializable } from '../../../utils/render-spec';
import {
  ModelInlineComponent,
  Properties,
  State,
} from './model-inline-component';

export interface InlineComponentArgs<
  A extends Properties = Properties,
  S extends State = State
> {
  componentController: InlineComponentController<A, S>;
  editorController: Controller;
}

export default class InlineComponentController<
  A extends Properties = Properties,
  S extends State = State
> {
  private _model: ModelInlineComponent<A, S>;

  constructor(model: ModelInlineComponent<A, S>) {
    this._model = model;
  }
  get props() {
    return this._model.props;
  }

  get state() {
    return this._model.state;
  }

  get model() {
    return this._model;
  }

  setStateProperty(property: keyof S, value: Serializable) {
    this._model.setStateProperty(property, value);
  }

  getStateProperty(property: keyof S) {
    return this._model.getStateProperty(property);
  }
}
