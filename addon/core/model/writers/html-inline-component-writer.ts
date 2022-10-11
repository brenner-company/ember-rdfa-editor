import { ModelInlineComponent } from '../inline-components/model-inline-component';

export default function writeHtmlInlineComponent(
  modelNode: ModelInlineComponent,
  dynamic = true
): HTMLElement {
  const result = modelNode.write(dynamic);
  return result;
}
