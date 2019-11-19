import { A } from '@ember/array';
import { notEmpty } from '@ember/object/computed';
import Component from '@ember/component';
import { inject } from '@ember/service';
import { later } from '@ember/runloop';
import { debug, warn } from '@ember/debug';

import layout from '../../templates/components/rdfa-editor';
import HintsRegistry from '../utils/hints-registry';
import EventProcessor from '../utils/event-processor';
import forgivingAction from '../utils/forgiving-action';
import RdfaBackspaceHandler from '../utils/handlers/rdfa-backspace-handler';
import { analyse as analyseRdfa } from '@lblod/marawa/rdfa-context-scanner';
import TextInputDataFlaggedRemoveHandler from '../utils/handlers/text-input-data-flagged-remove-handler';

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
export default Component.extend({
  layout,
  classNames: ["container-flex--contain"],

  /**
   * Plugin profile of the RDFa editor
   *
   * @property profile
   * @type string
   * @default 'default'
   *
   * @public
   */
  profile: 'default',

  /**
   * Function accepting a debug object containing the components used for debugging
   *   (e.g. hints registry, context scanner, editor)
   * @property initDebug
   * @type function
   *
   * @public
   */
  initDebug: null,

  /**
   * @property rdfaEditorDispatcher
   * @type RdfaEditorDispatcher
   *
   * @private
   */
  rdfaEditorDispatcher: inject(),

  /**
   * @property eventProcessor
   * @type EventProcessor
   *
   * @private
   */
  eventProcessor: null,

  /**
   * @property hinstRegistry
   * @type HintsRegistry
   *
   * @private
   */
  hintsRegistry: null,

  /**
   * @property hasHints
   * @type boolean
   *
   * @private
   */
  hasHints: notEmpty('hintsRegistry.registry'),

  /**
   * @property hasActiveHints
   * @type boolean
   *
   * @private
   */
  hasActiveHints: notEmpty('hintsRegistry.activeHints'),

  /**
   * @property hasSuggestedHints
   */
  hasSuggestedHints: notEmpty('suggestedHints'),

  /**
   * Contains extra handlers for input events on the editor.
   *
   * @property handlers
   * @type Ember.A
   *
   * @private
   */
  handlers: null,

  init() {
    this._super(...arguments);
    this.set('handlers', A());
  },

  didUpdateAttrs() {
    if (this.profile != this.get('eventProcessor.profile')) {
      this.set('eventProcessor.profile', this.profile);
    }
  },

  /**
   * This function is called when an action is fired on the editor,
   * before the editor itself has been set up.  When this happens, we
   * can't dispatch the action to the correct component.
   *
   * @method warnNotSetup
   * @private
   */
  warnNotSetup(){
    warn("An action was fired before the editor was set up", { id: "rdfa-editor.not-setup" } );
  },

  /**
   * This is called in cases where an optional action is triggered
   * from the frontend.  This noop can be called as a fallback in case no operation
   * needs to occur if the action is not defined.
   * @method noop
   */
  noop(){ return; },

  actions: {
    /**
     * Handle init of rawEditor
     *
     * @method handleRawEditorInit
     *
     * @param {RawEditor} editor, the editor interface
     *
     * @private
     */
    handleRawEditorInit(editor) {
      this.set('editor', editor);
      const handlers = [
        RdfaBackspaceHandler.create({rawEditor: editor }),
        TextInputDataFlaggedRemoveHandler.create({rawEditor: editor})
      ];
      this.set('handlers', handlers);
      const hintsRegistry = HintsRegistry.create();
      hintsRegistry.set('rawEditor', editor);
      this.set('hintsRegistry', hintsRegistry);
      const eventProcessor = EventProcessor.create({
        registry: hintsRegistry,
        profile: this.profile,
        dispatcher: this.rdfaEditorDispatcher,
        editor: editor
      });
      this.set('eventProcessor', eventProcessor);
      hintsRegistry.addRegistryObserver( function(registry) {
        eventProcessor.handleRegistryChange(registry);
      });

      hintsRegistry.addNewCardObserver( function(card) {
        eventProcessor.handleNewCardInRegistry(card);
      });

      hintsRegistry.addRemovedCardObserver( function(card) {
        eventProcessor.handleRemovedCardInRegistry(card);
      });


      if (this.initDebug) {
        const debugInfo = {
          hintsRegistry: hintsRegistry,
          editor: eventProcessor.editor,
          contextScanner: eventProcessor.scanner
        };
        this.initDebug(debugInfo);
      }
      forgivingAction('rdfaEditorInit', this)(editor);
    },

    /**
     * Highlights a node for a short time span and scrolls to it
     * @method highlightStructuredItem
     *
     * @param {DOMNode} node Node to highlight and scroll to
     */
    highlightStructureItem(node) {
      const editorOffset = this.editor.rootNode.offsetTop;
      node.classList.add('u-marker');
      later(this, function() {
        node.classList.remove('u-marker');
      }, 1500);
      this.element.scrollTo(0, node.offsetTop + editorOffset);
    },

    /**
     * requests hints from plugins
     *
     * @method triggerHints
     */
    async triggerHints() {
      const rootNode = this.editor.rootNode;
      const currentNode = this.editor.currentNode;
      let region = [];
      if (currentNode) {
        const currentRichNode = this.editor.getRichNodeFor(currentNode);
        region = currentRichNode.region;
      } else {
        region = this.editor.currentSelection;
      }
      const contexts = analyseRdfa(rootNode, region);
      if (contexts && contexts.length) {
        const context = contexts[0];
        const hints = await this.rdfaEditorDispatcher.requestHints(this.profile, context, this.editor);
        this.set('suggestedHints', hints);
      } else {
        debug('No RDFa blocks found in currentNode. Cannot hint suggestions.');
      }

    }
  }
});
