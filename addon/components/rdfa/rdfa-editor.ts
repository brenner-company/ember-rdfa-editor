import { warn } from '@ember/debug';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import RdfaDocument from '../../utils/rdfa/rdfa-document';
import RdfaDocumentController from '../../utils/rdfa/rdfa-document';
import type IntlService from 'ember-intl/services/intl';
import RawEditor from '@lblod/ember-rdfa-editor/utils/ce/raw-editor';
import PernetRawEditor from '@lblod/ember-rdfa-editor/utils/ce/pernet-raw-editor';
import { EditorPlugin } from '@lblod/ember-rdfa-editor/utils/editor-plugin';
import ApplicationInstance from '@ember/application/instance';
import Controller, {
  InternalWidgetSpec,
  RawEditorController,
} from '@lblod/ember-rdfa-editor/model/controller';
import {
  createLogger,
  Logger,
} from '@lblod/ember-rdfa-editor/utils/logging-utils';
import BasicStyles from '@lblod/ember-rdfa-editor/plugins/basic-styles/basic-styles';

interface RdfaEditorArgs {
  /**
   * callback that is called with an interface to the editor after editor init completed
   * @default 'default'
   * @public
   */
  rdfaEditorInit(editor: RdfaDocument): void;

  plugins: string[];
}

/**
 * RDFa editor
 *
 * This module contains all classes and components provided by the @lblod/ember-rdfa-editor addon.
 * The main entrypoint is the {{#crossLink "RdfaEditorComponent"}}{{/crossLink}}.
 * @module rdfa-editor
 * @main rdfa-editor
 */

/**
 * RDFa editor component
 *
 * This component wraps around a {{#crossLink "ContentEditableComponent"}}{{/crossLink}}
 * and provides an architecture to interact with the document through plugins.
 * {{#crossLinkModule "rdfa-editor"}}rdfa-editor{{/crossLinkModule}}.
 * @module rdfa-editor
 * @class RdfaEditorComponent
 * @extends Component
 */
export default class RdfaEditor extends Component<RdfaEditorArgs> {
  @service declare intl: IntlService;
  @tracked profile = 'default';

  @tracked toolbarWidgets: InternalWidgetSpec[] = [];
  @tracked sidebarWidgets: InternalWidgetSpec[] = [];
  @tracked insertSidebarWidgets: InternalWidgetSpec[] = [];
  @tracked toolbarController: Controller | null = null;
  private owner: ApplicationInstance;
  activePlugins: EditorPlugin[] = [];
  private logger: Logger;

  get plugins(): string[] {
    return this.args.plugins || [];
  }

  /**
   * editor controller
   */
  @tracked editor?: PernetRawEditor;

  constructor(owner: ApplicationInstance, args: RdfaEditorArgs) {
    super(owner, args);
    this.owner = owner;
    const userLocale = navigator.language || navigator.languages[0];
    this.intl.setLocale([userLocale, 'nl-BE']);
    this.logger = createLogger(this.constructor.name);
  }

  /**
   * This function is called when an action is fired on the editor,
   * before the editor itself has been set up.  When this happens, we
   * can't dispatch the action to the correct component.
   *
   * @method warnNotSetup
   * @private
   */
  warnNotSetup() {
    warn('An action was fired before the editor was set up', {
      id: 'rdfa-editor.not-setup',
    });
  }

  /**
   * This is called in cases where an optional action is triggered
   * from the frontend.  This noop can be called as a fallback in case no operation
   * needs to occur if the action is not defined.
   * @method noop
   */
  noop() {
    return;
  }

  /**
   * Handle init of rawEditor
   *
   * @method handleRawEditorInit
   *
   * @param {RawEditor} editor, the editor interface
   *
   * @private
   */
  @action
  async handleRawEditorInit(editor: PernetRawEditor) {
    this.editor = editor;
    await this.initializePlugins(editor);
    this.toolbarWidgets = editor.widgetMap.get('toolbar') || [];
    this.sidebarWidgets = editor.widgetMap.get('sidebar') || [];
    this.insertSidebarWidgets = editor.widgetMap.get('insertSidebar') || [];
    this.toolbarController = new RawEditorController('toolbar', editor);
    const rdfaDocument = new RdfaDocumentController('host-controller', editor);
    if (this.args.rdfaEditorInit) {
      this.args.rdfaEditorInit(rdfaDocument);
    }
  }

  async initializePlugins(editor: RawEditor) {
    const plugins = this.getPlugins();
    for (const plugin of plugins) {
      await this.initializePlugin(plugin, editor);
    }
  }

  getPlugins(): EditorPlugin[] {
    const pluginNames = this.plugins;
    const plugins = [new BasicStyles()];
    for (const name of pluginNames) {
      const plugin = this.owner.lookup(`plugin:${name}`) as EditorPlugin | null;
      if (plugin) {
        plugins.push(plugin);
      } else {
        this.logger(`plugin ${name} not found! Skipping...`);
      }
    }
    return plugins;
  }

  async initializePlugin(
    plugin: EditorPlugin,
    editor: RawEditor
  ): Promise<void> {
    const controller = new RawEditorController(plugin.name, editor);
    await plugin.initialize(controller);
    this.logger(`Initialized plugin ${plugin.name}`);
    this.activePlugins.push(plugin);
  }

  // Toggle RDFA blocks
  @tracked showRdfaBlocks = false;

  @action
  toggleRdfaBlocks() {
    this.showRdfaBlocks = !this.showRdfaBlocks;
    if (this.editor?.model) {
      this.editor.model.writeSelection();
    }
  }
}
