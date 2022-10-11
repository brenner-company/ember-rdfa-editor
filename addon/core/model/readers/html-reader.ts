import MarksRegistry, {
  SpecAttributes,
} from '@lblod/ember-rdfa-editor/core/model/marks/marks-registry';
import ModelNode from '@lblod/ember-rdfa-editor/core/model/nodes/model-node';
import readHtmlNode from '@lblod/ember-rdfa-editor/core/model/readers/html-node-reader';
import InlineComponentsRegistry from '../inline-components/inline-components-registry';
import { ModelInlineComponent } from '../inline-components/model-inline-component';
import { calculateRdfaPrefixes } from '../../../utils/rdfa-utils';

export interface HtmlReaderContextArgs {
  rdfaPrefixes?: Map<string, string>;
  shouldConvertWhitespace?: boolean;
  marksRegistry: MarksRegistry;
  inlineComponentsRegistry: InlineComponentsRegistry;
}
export class HtmlReaderContext {
  private readonly _textAttributes: Map<string, string>;
  private marksRegistry: MarksRegistry;
  private inlineComponentsRegistry: InlineComponentsRegistry;
  private _rdfaPrefixes: Map<string, string>;
  private _shouldConvertWhitespace: boolean;
  activeMarks: Set<SpecAttributes> = new Set<SpecAttributes>();
  markViewRootStack: Node[] = [];

  constructor({
    marksRegistry,
    inlineComponentsRegistry,
    rdfaPrefixes = new Map<string, string>(),
    shouldConvertWhitespace = false,
  }: HtmlReaderContextArgs) {
    this._textAttributes = new Map<string, string>();
    this._rdfaPrefixes = rdfaPrefixes;
    this._shouldConvertWhitespace = shouldConvertWhitespace;
    this.marksRegistry = marksRegistry;
    this.inlineComponentsRegistry = inlineComponentsRegistry;
  }

  get shouldConvertWhitespace() {
    return this._shouldConvertWhitespace;
  }

  get textAttributes() {
    return this._textAttributes;
  }

  get rdfaPrefixes() {
    return this._rdfaPrefixes;
  }
  set rdfaPrefixes(value: Map<string, string>) {
    this._rdfaPrefixes = value;
  }

  matchMark(node: Node): Set<SpecAttributes> {
    return this.marksRegistry.matchMarkSpec(node);
  }

  matchInlineComponent(node: Node) {
    return this.inlineComponentsRegistry.matchInlineComponentSpec(node);
  }

  addComponentInstance(
    element: HTMLElement,
    children: Node[],
    componentName: string,
    component: ModelInlineComponent
  ) {
    this.inlineComponentsRegistry.addComponentInstance(
      element,
      children,
      componentName,
      component
    );
  }
}

/**
 * Top-level reader for HTML documents
 */

export function readHtml(from: Node, context: HtmlReaderContext): ModelNode[] {
  const prefixes = calculateRdfaPrefixes(from);
  context.rdfaPrefixes = prefixes;
  return readHtmlNode(from, context);
}
