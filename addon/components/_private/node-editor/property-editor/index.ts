import Component from '@glimmer/component';
import SayController from '@lblod/ember-rdfa-editor/core/say-controller';
import { ResolvedNode } from '@lblod/ember-rdfa-editor/plugins/_private/editable-node';
import { OutgoingProp } from '@lblod/ember-rdfa-editor/core/say-parser';
import { tracked } from '@glimmer/tracking';
import PropertyEditorModal from './modal';

type Args = {
  controller: SayController;
  node: ResolvedNode;
};

export default class PropertyEditor extends Component<Args> {
  Modal = PropertyEditorModal;
  @tracked modalOpen = false;

  openModal = () => {
    this.modalOpen = true;
  };

  closeModal = () => {
    this.modalOpen = false;
  };

  get controller() {
    return this.args.controller;
  }

  get attributeProperties() {
    const properties = this.args.node.value.attrs.properties as
      | Record<string, OutgoingProp>
      | undefined;
    if (properties) {
      const filteredEntries = Object.entries(properties).filter(
        ([_, prop]) => prop.type === 'attr',
      );
      return Object.fromEntries(filteredEntries);
    } else {
      return;
    }
  }
}
