import { Command, EditorState, Transaction } from 'prosemirror-state';
import { EditorView, NodeView, NodeViewConstructor } from 'prosemirror-view';
import {
  DOMParser as ProseParser,
  DOMSerializer,
  MarkType,
  Node as PNode,
  Schema,
} from 'prosemirror-model';
import { baseKeymap, selectAll, toggleMark } from 'prosemirror-commands';
import {
  EditorStore,
  ProseStore,
} from '@lblod/ember-rdfa-editor/utils/datastore/datastore';
import { getPathFromRoot } from '@lblod/ember-rdfa-editor/utils/dom-helpers';
import { rdfaSchema } from '@lblod/ember-rdfa-editor/core/schema';
import { v4 as uuidv4 } from 'uuid';

// eslint-disable-next-line ember/no-classic-components
import Component from '@ember/component';
import { emDash, InputRule, inputRules } from 'prosemirror-inputrules';
import { gapCursor } from 'prosemirror-gapcursor';
import { keymap } from 'prosemirror-keymap';
import { history } from 'prosemirror-history';
import { defaultKeymap } from '@lblod/ember-rdfa-editor/core/keymap';
import tracked from 'tracked-built-ins/-private/decorator';
import { tableEditing } from 'prosemirror-tables';
import { dropCursor } from 'prosemirror-dropcursor';
import placeholder from '@lblod/ember-rdfa-editor/plugins/placeholder/placeholder';
import { hbs, TemplateFactory } from 'ember-cli-htmlbars';
import RdfaEditorPlugin from './rdfa-editor-plugin';
import { InternalWidgetSpec, WidgetLocation } from './controllers/controller';
import MapUtils from '../utils/map-utils';

export interface EmberInlineComponent
  extends Component,
    EmberInlineComponentArgs {
  appendTo(selector: string | Element): this;
}

export interface EmberInlineComponentArgs {
  getPos: () => number;
  node: PNode;
  updateAttribute: (attr: string, value: unknown) => void;
  contentDOM?: HTMLElement;
}

export function emberComponent(
  name: string,
  template: TemplateFactory,
  props: EmberInlineComponentArgs
): { node: HTMLElement; component: EmberInlineComponent } {
  const instance = window.__APPLICATION;
  const componentName = `${name}-${uuidv4()}`;
  instance.register(
    `component:${componentName}`,
    // eslint-disable-next-line ember/no-classic-classes, ember/require-tagless-components
    Component.extend({
      layout: template,
      tagName: '',
      ...props,
    })
  );
  const component = instance.lookup(
    `component:${componentName}`
  ) as EmberInlineComponent; // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const node = document.createElement('div');
  component.appendTo(node);
  return { node, component };
}

function initalizeProsePlugins(rdfaEditorPlugins: RdfaEditorPlugin[]) {
  const proseMirrorPlugins = [
    inputRules({
      rules: [
        emDash,
        new InputRule(/yeet/g, () => {
          console.log('found matching input');
          return null;
        }),
      ],
    }),
    placeholder(),
    dropCursor(),
    gapCursor(),
    keymap(defaultKeymap(rdfaSchema)),
    keymap(baseKeymap),
    history(),
    tableEditing({ allowTableNodeSelection: false }),
  ];
  rdfaEditorPlugins.forEach((plugin) => {
    proseMirrorPlugins.push(...plugin.proseMirrorPlugins());
  });
  return proseMirrorPlugins;
}

function initializeSchema(rdfaEditorPlugins: RdfaEditorPlugin[]) {
  const schema = rdfaSchema;
  let nodes = schema.spec.nodes;
  let marks = schema.spec.marks;
  rdfaEditorPlugins.forEach((plugin) => {
    plugin.nodes().forEach((nodeConfig) => {
      nodes = nodes.addToStart(nodeConfig.name, nodeConfig.spec);
    });
    plugin.marks().forEach((markConfig) => {
      marks = marks.addToStart(markConfig.name, markConfig.spec);
    });
  });
  return new Schema({
    nodes,
    marks,
  });
}

function initializeNodeViewConstructors(rdfaEditorPlugins: RdfaEditorPlugin[]) {
  const nodeViewConstructors: { [node: string]: NodeViewConstructor } = {};

  rdfaEditorPlugins.forEach((plugin) => {
    plugin.nodes().forEach((nodeConfig) => {
      if (nodeConfig.view) {
        nodeViewConstructors[nodeConfig.name] = nodeConfig.view;
      }
    });
  });

  return nodeViewConstructors;
}

export default class Prosemirror {
  view: EditorView;
  @tracked _state;
  @tracked datastore: ProseStore;
  @tracked widgets: Map<WidgetLocation, InternalWidgetSpec[]> = new Map();
  root: Element;
  baseIRI: string;
  pathFromRoot: Node[];

  constructor(target: Element, baseIRI: string, plugins: RdfaEditorPlugin[]) {
    this.root = target;
    this.baseIRI = baseIRI;
    this.view = new EditorView(target, {
      state: EditorState.create({
        doc: ProseParser.fromSchema(initializeSchema(plugins)).parse(target),
        plugins: initalizeProsePlugins(plugins),
      }),
      attributes: { class: 'say-editor__inner say-content' },
      nodeViews: initializeNodeViewConstructors(plugins),
      dispatchTransaction: this.dispatch,
    });
    this._state = this.view.state;
    this.pathFromRoot = getPathFromRoot(this.root, false);
    this.datastore = EditorStore.fromParse<PNode>({
      root: this._state.doc,
      textContent,
      tag,
      children,
      attributes,
      isText,
      getParent,

      pathFromDomRoot: this.pathFromRoot,
      baseIRI,
    });
    this.initializeEditorWidgets(plugins);
  }

  initializeEditorWidgets(rdfaEditorPlugins: RdfaEditorPlugin[]) {
    const widgetMap: Map<WidgetLocation, InternalWidgetSpec[]> = new Map();
    rdfaEditorPlugins.forEach((plugin) => {
      plugin.widgets().forEach((widgetSpec) => {
        MapUtils.setOrPush(widgetMap, widgetSpec.desiredLocation, {
          ...widgetSpec,
          controller: new ProseController(this),
        });
      });
    });
    this.widgets = widgetMap;
  }

  get editable() {
    return this.view.editable;
  }

  get state() {
    return this._state;
  }

  focus() {
    this.view.focus();
  }

  dispatch = (tr: Transaction) => {
    const newState = this.state.apply(tr);

    if (tr.docChanged) {
      this.datastore = EditorStore.fromParse({
        textContent,
        tag,
        children,
        attributes,
        isText,
        getParent,

        root: newState.doc,
        pathFromDomRoot: this.pathFromRoot,
        baseIRI: this.baseIRI,
      });
    }
    console.log('Parsed triples', this.datastore.size);

    this.view.updateState(newState);
    this._state = newState;
  };
}

export class ProseController {
  constructor(private pm: Prosemirror) {}

  toggleMark(name: string) {
    this.focus();
    this.doCommand(toggleMark(this.schema.marks[name]));
  }

  focus() {
    this.pm.focus();
  }

  setHtmlContent(content: string) {
    this.focus();
    this.doCommand(selectAll);
    const tr = this.pm.state.tr;
    const domParser = new DOMParser();
    tr.deleteSelection().insert(
      0,
      ProseParser.fromSchema(this.schema).parse(
        domParser.parseFromString(content, 'text/html')
      )
    );
    this.pm.dispatch(tr);
  }

  doCommand(command: Command): boolean {
    return command(this.pm.state, this.pm.view.dispatch, this.pm.view);
  }

  checkCommand(command: Command): boolean {
    return command(this.pm.state);
  }

  checkAndDoCommand(command: Command): boolean {
    if (command(this.pm.state)) {
      return command(this.pm.state, this.pm.view.dispatch, this.pm.view);
    }
    return false;
  }

  isMarkActive(markType: MarkType) {
    const { from, $from, to, empty } = this.state.selection;
    if (empty) {
      return !!markType.isInSet(this.state.storedMarks || $from.marks());
    } else {
      return this.state.doc.rangeHasMark(from, to, markType);
    }
  }

  withTransaction(callback: (tr: Transaction) => Transaction | null) {
    const tr = this.state.tr;
    const result = callback(tr);
    if (result) {
      this.pm.view.dispatch(result);
    }
  }

  get widgets() {
    return this.pm.widgets;
  }

  get schema(): Schema {
    return this.pm.state.schema;
  }

  get state(): EditorState {
    return this.pm.state;
  }

  get xmlContent(): string {
    return '';
  }

  get xmlContentPrettified(): string {
    return '';
  }

  get htmlContent(): string {
    console.log('DOCUMENT: ', this.pm.state.doc);
    const fragment = DOMSerializer.fromSchema(this.schema).serializeFragment(
      this.pm.state.doc.content,
      {
        document,
      }
    );
    console.log('FRAGMENT: ', fragment);
    const div = document.createElement('div');
    div.appendChild(fragment);
    return div.innerHTML;
  }

  set xmlContent(content: string) {}
}

function textContent(node: PNode) {
  return node.textContent;
}

function isText(node: PNode) {
  return node.isText;
}

function children(node: PNode): Iterable<PNode> {
  const rslt: PNode[] = [];
  node.forEach((child) => rslt.push(child));
  return rslt;
}

function tag(node: PNode) {
  return node.type.name;
}

function attributes(node: PNode) {
  return node.attrs;
}

function getParent(node: PNode, root: PNode): PNode | null {
  if (node === root) {
    return null;
  }
  let found = false;
  root.descendants((descendant: PNode, pos, parent: PNode | null) => {
    if (descendant === node) {
      found = true;
    }
    return !found;
  });
  return null;
}