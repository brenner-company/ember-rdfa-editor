import Component from '@glimmer/component';
import EditorController from 'dummy/core/editor-controller';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { ContentChangedEvent, SelectionChangedEvent } from '@lblod/ember-rdfa-editor/core/editor-events';

interface SayCodexCitationCardArgs {
  controller: EditorController
}

const MOTIVATION_PREDICATE = 'http://data.vlaanderen.be/ns/besluit#motivering';
const CITATION_PREDICATE = 'http://data.europa.eu/eli/ontology#cites';
export default class SayCodexCitationCard extends Component<SayCodexCitationCardArgs> {
  @tracked insideMotivation = false;
  @tracked insideCitation = false;
  @tracked context;

  constructor() {
    super(...arguments);
    this.args.controller.onEvent('selectionChanged', this.trackContext);
    this.args.controller.onEvent('contentChanged', this.trackContent);
  }

  get controller() {
    return this.args.controller;
  }

  @action
  trackContent(event: ContentChangedEvent) {
    console.log(event);
  }

  @action
  trackContext(event: SelectionChangedEvent) {
    this.insideCitation = event.payload.parentDataset.some((quad) => quad.predicate.value === CITATION_PREDICATE)
    this.insideMotivation = ! this.insideCitation && event.payload.parentDataset.some((quad) => quad.predicate.value === MOTIVATION_PREDICATE);
    this.context = event.payload.parentDataset;
  }
}
