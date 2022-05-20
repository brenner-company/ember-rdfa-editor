import { ModelInlineComponent } from '../inline-components/model-inline-component';
import NodeView from '../node-view';
import Writer from './writer';

export default class HtmlInlineComponentWriter
  implements Writer<ModelInlineComponent, NodeView | null>
{
  write(modelNode: ModelInlineComponent, child?: Node): NodeView {
    const result = modelNode.write(child)!;
    return { viewRoot: result, contentRoot: result };
  }
}
