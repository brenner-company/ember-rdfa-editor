import { ModelInlineComponent } from '../inline-components/model-inline-component';
import writeHtmlInlineComponent from './html-inline-component-writer';

export default function writeUnpollutedHtmlInlineComponent(
  modelNode: ModelInlineComponent
): HTMLElement {
  return writeHtmlInlineComponent(modelNode, false).element;
}
