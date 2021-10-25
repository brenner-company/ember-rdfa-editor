import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { task, timeout } from 'ember-concurrency';
import { LEGISLATION_TYPES, LEGISLATION_TYPE_CONCEPTS } from 'say-codex-citation-plugin/utils/legislation-types';
import { fetchDecisions } from 'say-codex-citation-plugin/utils/vlaamse-codex';

function getISODate(date: Date) {
  if (date) {
    // Flatpickr captures the date in local time. Hence date.toISOString() may return the day before the selected date
    // E.g. selected date 2020-04-15 00:00:00 GMT+0200 will become 2020-04-14 22:00:00 UTC
    // We will pretend the selected date is UTC because that's what's meant as date for filtering
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  } else {
    return null;
  }
}

interface SayCodexCitationCardSearchModalArgs {
  selectedDecision: unknown
  legislationTypeUri: string
  words: [string]
}

export default class SayCodexCitationCardSearchModal extends Component<SayCodexCitationCardSearchModalArgs> {
  @tracked text
  // Vlaamse Codex currently doesn't contain captions and content of decisions
  // @tracked isEnabledSearchCaption = false
  // @tracked isEnabledSearchContent = false
  @tracked legislationTypeUri
  @tracked pageNumber = 0
  @tracked pageSize = 5
  @tracked totalCount
  @tracked decisions = []
  @tracked error
  @tracked selectedDecision
  @tracked documentDateFrom = null
  @tracked documentDateTo = null
  @tracked publicationDateFrom = null
  @tracked publicationDateTo = null

  constructor() {
    super(...arguments);
    this.selectedDecision = this.args.selectedDecision;
    this.legislationTypeUri = this.args.legislationTypeUri || LEGISLATION_TYPES['decreet'];
    this.text = (this.args.words || []).join(' ');
    this.search.perform();
  }

  get legislationTypes() {
    return LEGISLATION_TYPE_CONCEPTS;
  }
  @(task(function * () {
    yield timeout(500);
    yield this.search.perform();
  }).keepLatest()) searchText

  @(task(function * (pageNumber) {
    this.pageNumber = pageNumber || 0; // reset page to 0 for a new search task
    this.error = null;
    try {
      // Split search string by grouping on non-whitespace characters
      // This probably needs to be more complex to search on group of words
      const words = (this.text || '').match(/\S+/g) || [];
      const filter = {
        type: this.legislationTypeUri,
        documentDateFrom: getISODate(this.documentDateFrom),
        documentDateTo: getISODate(this.documentDateTo),
        publicationDateFrom: getISODate(this.publicationDateFrom),
        publicationDateTo: getISODate(this.publicationDateTo)
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
  }).keepLatest()) search

  @action
  selectLegislationType(event) {
    this.legislationTypeUri = event.target.value;
    this.search.perform();
  }

  @action
  updateDocumentDateFrom(dates) {
    this.documentDateFrom = dates.firstObject || null;
    this.search.perform();
  }

  @action
  updateDocumentDateTo(dates) {
    this.documentDateTo = dates.firstObject || null;
    this.search.perform();
  }

  @action
  updatePublicationDateFrom(dates) {
    this.publicationDateFrom = dates.firstObject || null;
    this.search.perform();
  }

  @action
  updatePublicationDateTo(dates) {
    this.publicationDateTo = dates.firstObject || null;
    this.search.perform();
  }

  @action
  insertDecisionCitation(decision) {
    this.args.insertCitation(decision.legislationType.label, decision.uri, decision.title);
    this.args.closeModal();
  }

  @action
  insertArticleCitation(decision, article) {
    const title = `${decision.title}, ${article.number}`;
    this.args.insertCitation(decision.legislationType.label, article.uri, title);
    this.args.closeModal();
  }

  @action
  closeDecisionDetail() {
    this.selectedDecision = null;
  }

  @action
  openDecisionDetail(decision) {
    this.selectedDecision = decision;
  }


  // Pagination

  @action
  previousPage() {
    this.search.perform(this.pageNumber - 1);
  }

  @action
  nextPage() {
    this.search.perform(this.pageNumber + 1);
  }

  get rangeStart() {
    return this.pageNumber * this.pageSize + 1;
  }

  get rangeEnd() {
    const end = this.rangeStart + this.pageSize - 1;
    return end > this.totalCount ? this.totalCount : end;
  }

  get isFirstPage() {
    return this.pageNumber == 0;
  }

  get isLastPage() {
    return this.rangeEnd == this.totalCount;
  }

}
