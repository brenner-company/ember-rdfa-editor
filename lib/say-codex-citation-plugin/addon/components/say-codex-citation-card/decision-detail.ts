import Component from '@glimmer/component';
import { task, timeout } from 'ember-concurrency';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { Decision, fetchArticles } from '../../utils/vlaamse-codex';

interface SayCodexCitationDecisionDetailArgs {
  decision: Decision
}

export default class SayCodexCitationCardDecisionDetail extends Component<SayCodexCitationDecisionDetailArgs> {
  @tracked error: string | null = null;
  @tracked pageNumber = 0;
  @tracked pageSize = 5;
  @tracked totalCount = 0;
  @tracked articles = [];
  @tracked articleFilter:string = "";

  constructor() {
    super(...arguments);
    this.search.perform();
  }

  @task({restartable: true})
  *updateArticleFilter() {
    yield timeout(200);
    this.pageNumber = 0;
    yield this.search.perform(this.pageNumber);
  }

  @task({restartable: true})
    *search (pageNumber: number) {
    this.pageNumber = pageNumber || 0;
    this.error = null;
    try {
      const results = yield fetchArticles(this.args.decision.uri, this.pageNumber, this.pageSize, this.articleFilter);
      this.totalCount = results.totalCount;
      this.articles = results.articles;
    }
    catch(e) {
      console.warn(e); // eslint-ignore-line no-console
      this.totalCount = 0;
      this.articles = [];
      this.error = e;
    }
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
