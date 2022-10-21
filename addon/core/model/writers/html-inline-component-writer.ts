import { EmberComponent } from '@lblod/ember-rdfa-editor';
import { ModelInlineComponent } from '../inline-components/model-inline-component';

export default function writeHtmlInlineComponent(
  modelNode: ModelInlineComponent,
  dynamic = true
): { element: HTMLElement; emberComponent?: EmberComponent } {
  return modelNode.write(dynamic);
}
