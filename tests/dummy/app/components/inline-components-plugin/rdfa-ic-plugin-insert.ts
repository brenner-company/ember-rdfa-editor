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
        children: [
          new ModelText(
            `Lorem ipsum dolor sit amet, 
             consectetur adipiscing elit, sed do eiusmod tempor
             incididunt ut labore et dolore magna aliqua. 
             Ut enim ad minim veniam, quis nostrud exercitation 
             ullamco laboris nisi ut aliquip ex ea commodo consequat.
             Duis aute irure dolor in reprehenderit in voluptate 
             velit esse cillum dolore eu fugiat nulla pariatur. 
             Excepteur sint occaecat cupidatat non proident, 
             sunt in culpa qui officia deserunt mollit anim id est laborum.`
          ),
        ],
      });
    });
  }
}
