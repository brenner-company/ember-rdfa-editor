import { action } from '@ember/object';
import Component from '@glimmer/component';
import Controller from '@lblod/ember-rdfa-editor/core/controllers/controller';
import ModelText from '@lblod/ember-rdfa-editor/core/model/nodes/model-text';

type RdfaIcPluginInsertComponentArgs = {
  controller: Controller;
};

export default class RdfaIcPluginInsertComponent extends Component<RdfaIcPluginInsertComponentArgs> {
  @action
  insertCounter() {
    this.args.controller.perform((transaction) => {
      transaction.commands.insertComponent({
        componentName: 'counter',
      });
    });
  }

  @action
  insertDropdown() {
    this.args.controller.perform((transaction) => {
      transaction.commands.insertComponent({
        componentName: 'dropdown',
      });
    });
  }

  @action
  insertCard() {
    this.args.controller.perform((transaction) => {
      transaction.commands.insertComponent({
        componentName: 'card',
        children: [new ModelText('test')],
      });
    });
  }
}
