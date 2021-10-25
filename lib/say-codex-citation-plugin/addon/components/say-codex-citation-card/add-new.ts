import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { task, timeout } from 'ember-concurrency';
import { action } from '@ember/object';
import { LEGISLATION_TYPES, LEGISLATION_TYPE_CONCEPTS } from 'say-codex-citation-plugin/utils/legislation-types';
import { fetchDecisions } from 'say-codex-citation-plugin/utils/vlaamse-codex';
import EditorController from 'dummy/core/editor-controller';

interface SayCodexCitationCardAddNewArgs {
  controller: EditorController
}

export default class SayCodexCitationCardAddNew extends Component<SayCodexCitationCardAddNewArgs> {
  @tracked pageNumber = 0;
  @tracked pageSize = 5;
  @tracked totalCount: number = 0;
  @tracked decisions = [];
  @tracked error: string | null = null;
  @tracked showModal = false;
  @tracked decision;
  @tracked legislationTypeUri: string =  LEGISLATION_TYPES['decreet'] ;
  @tracked text: string = "";

  constructor() {
    super(...arguments);
  }

  get legislationTypes() {
    return LEGISLATION_TYPE_CONCEPTS;
  }

  @task({restartable: true})
  * search() {
    this.error = null;
    try {
      // Split search string by grouping on non-whitespace characters
      // This probably needs to be more complex to search on group of words
      const words = (this.text || '').match(/\S+/g) || [];
      const filter = {
        type: this.legislationTypeUri,
      };
      const results = yield fetchDecisions(words, filter, this.pageNumber, this.pageSize);
      this.totalCount = results.totalCount;
      this.decisions = results.decisions;
    }
    catch(e) {
      console.warn(e); // eslint-ignore-line no-console
      this.totalCount = 0;
      this.decisions = [];
      this.error = e;
    }
  }

  @action
  selectLegislationType(event) {
    this.legislationTypeUri = event.target.value;
    this.search.perform();
  }

  @task({restartable: true})
  * updateSearch() {
    yield timeout(200);
    yield this.search.perform();
  }

  @action
  openDecisionDetailModal(decision) {
    console.log(decision);
    this.decision = decision;
    this.showModal = true;
  }

  @action
  openSearchModal() {
    this.decision = null;
    this.showModal = true;
  }

  @action
  closeModal() {
    this.showModal = false;
    this.decision = null;
  }

  @action
  insertCitation(type: string, uri: string, title: string) {
    const citationHtml = `${type ? type : ''} <a class="annotation" href="${uri}" property="eli:cites" typeof="eli:LegalExpression">${title}</a>&nbsp;`;
    this.args.controller.executeCommand('insert-html', citationHtml);
  }

  @action
  prevPage() {
    this.pageNumber = this.pageNumber - 1;
    this.search.perform();
  }

  @action
  nextPage() {
    this.pageNumber = this.pageNumber + 1;
    this.search.perform();
  }

  get legislationType() {
    const type = this.legislationTypes.find((type) => type.value === this.legislationTypeUri);
    if (type)
      return type.label;
    else
      return "";
  }

}
