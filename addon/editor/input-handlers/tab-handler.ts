import { InputHandler } from './input-handler';
import { Manipulation, ManipulationExecutor, Editor, ManipulationGuidance } from './manipulation';
import { warn /*, debug, deprecate*/ } from '@ember/debug';
import { RawEditor } from '../raw-editor';
import { isVoidElement, isVisibleElement } from '@lblod/ember-rdfa-editor/utils/ce/dom-helpers';

/**
 * Interface for specific plugins.
 */
export interface TabInputPlugin {
  /**
   * One-liner explaining what the plugin solves.
   */
  label: string;

  /**
   * Callback executed to see if the plugin allows a certain
   * manipulation and/or if it intends to handle the manipulation
   * itself.
   */
  guidanceForManipulation: (manipulation: Manipulation) => ManipulationGuidance | null;
}


/**
 * Tab Input Handler, a event handler to handle tab input
 *
 * @module contenteditable-editor
 * @class TabInputHandler
 * @constructor
 */
export default class TabInputHandler implements InputHandler {
  rawEditor: RawEditor;
  plugins: Array<TabInputPlugin>;

  constructor( {rawEditor} : { rawEditor: RawEditor} ) {
    this.rawEditor = rawEditor;
    this.plugins = [
    ];
  }

  isHandlerFor(event: Event) {
    const selection = window.getSelection();

    if(!selection || !selection.isCollapsed) return false;

    const keyboardEvent = event as KeyboardEvent;
    //TODO: include shift key here?
    return event.type === "keydown" && keyboardEvent.key === "Tab" && this.rawEditor.rootNode.contains(selection.anchorNode)

  }

  handleEvent() {
    const manipulation = this.getNextManipulation();
    // check if we can execute it
    const { mayExecute, dispatchedExecutor } = this.checkManipulationByPlugins( manipulation );

    // error if we're not allowed to
    if ( ! mayExecute ) {
      warn( `Not allowed to execute manipulation for ${this.constructor}`, { id: "tab-input-handler-manipulation-not-allowed" } );
      return { allowPropagation: false };
    }

    // run the manipulation
    if( dispatchedExecutor ) {
      // NOTE: we should pass some sort of editor interface here in the future.
      dispatchedExecutor( manipulation, this.rawEditor as Editor);
    }
    else {
      this.handleNativeManipulation( manipulation );
    }
    return { allowPropagation: false };
  }

  handleNativeManipulation(manipulation: Manipulation) {
    if (manipulation.type == "moveCursorAtStartOfNonVoidAndVisibleElement") {
      const element = manipulation.node as HTMLElement;
      let textNode;
      if(element.firstChild && element.firstChild.nodeType == Node.TEXT_NODE){
        textNode = element.firstChild;
      }
      else {
        textNode = document.createTextNode('');
        element.prepend(textNode);
      }

      this.rawEditor.updateRichNode();
      this.rawEditor.setCarret(textNode, 0);
    }
    else if(manipulation.type == "moveCursorAfterElement"){
      const element = manipulation.node as HTMLElement;
      let textNode;
      if(element.nextSibling && element.nextSibling.nodeType == Node.TEXT_NODE){
        textNode = element.nextSibling;
      }
      else {
        textNode = document.createTextNode('');
        element.after(textNode);
      }

      this.rawEditor.updateRichNode();
      this.rawEditor.setCarret(textNode, 0);
    }
    else {
      throw "unsupport manipulation";
    }
  }

  //TODO: fix end of document. fix invisible elements
  getNextManipulation() : Manipulation {
    const selection = window.getSelection();

    if(!(selection && selection.isCollapsed))
      throw "selection is required for tab input"

    const { anchorNode } = selection;

    if(! (anchorNode && anchorNode.parentElement) )
      throw 'Tab input expected anchorNode and parentElement';

    const parentElement = anchorNode.parentElement;

    //TODO: this first check is to make linter happy.
    if(parentElement.lastChild && parentElement.lastChild.isSameNode(anchorNode)){
      return { type: "moveCursorAfterElement", node: parentElement };
    }
    else {

      const childNodes = Array.from(parentElement.childNodes);
      const offsetAnchorNode = childNodes.indexOf(anchorNode as ChildNode);
      const remainingSiblings = childNodes.slice(offsetAnchorNode + 1);

      const nextElementForCursor = remainingSiblings.find(node => {
        return !isVoidElement(node) && node.nodeType == Node.ELEMENT_NODE && isVisibleElement(node);
      });

      if(nextElementForCursor){
        return { type: "moveCursorAtStartOfNonVoidAndVisibleElement", node: nextElementForCursor as HTMLElement};
      }
      else {
        return { type: "moveCursorAfterElement", node: parentElement };
      }

    }
  }

    /**
   * Checks whether all plugins agree the manipulation is allowed.
   *
   * This method asks each plugin individually if the manipulation is
   * allowed.  If it is not allowed by *any* plugin, it yields a
   * negative response, otherwise it yields a positive response.
   *
   * We expect this method to be extended in the future with more rich
   * responses from plugins.  Something like "skip" or "merge" to
   * indicate this manipulation should be lumped together with a
   * previous manipulation.  Plugins may also want to execute the
   * changes themselves to ensure correct behaviour.
   *
   * @method checkManipulationByPlugins
   * @private
   *
   * @param {Manipulation} manipulation DOM manipulation which will be
   * checked by plugins.
   **/
  checkManipulationByPlugins(manipulation: Manipulation) : { mayExecute: boolean, dispatchedExecutor: ManipulationExecutor | null } {
    // calculate reports submitted by each plugin
    const reports : Array<{ plugin: TabInputPlugin, allow: boolean, executor: ManipulationExecutor | undefined }> = [];
    for ( const plugin of this.plugins ) {
      const guidance = plugin.guidanceForManipulation( manipulation );
      if( guidance ) {
        const allow = guidance.allow === undefined ? true : guidance.allow;
        const executor = guidance.executor;
        reports.push( { plugin, allow, executor } );
      }
    }

    // filter reports based on our interests
    const reportsNoExecute = reports.filter( ({ allow }) => !allow );
    const reportsWithExecutor = reports.filter( ({ executor }) => executor );

    // debug reporting
    if (reports.length > 1) {
      console.warn(`Multiple plugins want to alter this manipulation`, reports);
    }
    if (reportsNoExecute.length > 1 && reportsWithExecutor.length > 1) {
      console.error(`Some plugins don't want execution, others want custom execution`, { reportsNoExecute, reportsWithExecutor });
    }
    if (reportsWithExecutor.length > 1) {
      console.warn(`Multiple plugins want to execute this plugin. First entry in the list wins: ${reportsWithExecutor[0].plugin.label}`);
    }

    for( const { plugin } of reportsNoExecute ) {
      console.debug(`Was not allowed to execute tab manipulation by plugin ${plugin.label}`, { manipulation, plugin });
    }

    // yield result
    return {
      mayExecute: reportsNoExecute.length === 0,
      dispatchedExecutor: reportsWithExecutor.length ? reportsWithExecutor[0].executor as ManipulationExecutor : null
    };
  }

}
