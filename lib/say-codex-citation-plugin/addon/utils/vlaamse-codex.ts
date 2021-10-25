import fetch from 'fetch';
import { LEGISLATION_TYPE_CONCEPTS } from './legislation-types';
const SPARQL_ENDPOINT = '/codex/sparql/';
import { warn } from '@ember/debug';
import { htmlSafe } from '@ember/template';

//const SPARQL_ENDPOINT = 'https://codex.opendata.api.vlaanderen.be:8888/sparql';

export class Decision {
  uri: string;
  legislationType: {label: string, value: string};
  title: string;
  publicationDate: Date;
  documentDate: Date;

  constructor({ uri, legislationTypeUri, title, publicationDate, documentDate } : {uri: string, legislationTypeUri: string, title: string, publicationDate: Date, documentDate: Date}) {
    this.uri = uri;
    this.legislationType = LEGISLATION_TYPE_CONCEPTS.find(t => t.value == legislationTypeUri);
    this.title = title;
    this.publicationDate = publicationDate;
    this.documentDate = documentDate;
  }

  get fullTitle() {
    return `${this.legislationType.label} ${this.title}`;
  }
}

class Article {
  constructor({ uri, number, content, dateInForce, dateNoLongerInForce }) {
    this.uri = uri;
    this.number = number;
    this.content = htmlSafe(content);
    this.dateInForce = dateInForce;
    this.dateNoLongerInForce = dateNoLongerInForce;
  }
}


/*
 * flemish codex encodes certain characters as a html character, which breaks our search
 * this is an ugly work around
 */
function replaceDiacriticsInWord(word) {
  const characters= 'Ë À Ì Â Í Ã Î Ä Ï Ç Ò È Ó É Ô Ê Õ Ö ê Ù ë Ú î Û ï Ü ô Ý õ â û ã ÿ ç'.split(" ");
  for (let char of characters) {
    word = word.replace(new RegExp(`${char}`, 'g'), `&#${char.charCodeAt(0)};`);
  }
  return word;
}

async function fetchDecisions(words, filter, pageNumber = 0, pageSize = 5) {
  // TBD/NOTE: in the context of a <http://data.europa.eu/eli/ontology#LegalResource>
  // the eli:cites can have either a <http://xmlns.com/foaf/0.1/Document> or <http://data.europa.eu/eli/ontology#LegalResource>
  // as range (see AP https://data.vlaanderen.be/doc/applicatieprofiel/besluit-publicatie/#Rechtsgrond),
  // but I currently don't think in the editor you'll ever directly work on a LegalResource.
  const { type, documentDateFrom, documentDateTo, publicationDateFrom, publicationDateTo } = filter || {};

  let documentDateFilter = 'OPTIONAL { ?legalResourceUri eli:date_document ?documentDate . }';
  if (documentDateFrom || documentDateTo) {
    documentDateFilter = '?legalResourceUri eli:date_document ?documentDate . ';
    if (documentDateFrom)
      documentDateFilter += `FILTER (?documentDate >= "${documentDateFrom}"^^xsd:date) `;
    if (documentDateTo)
      documentDateFilter += `FILTER (?documentDate <= "${documentDateTo}"^^xsd:date) `;
  }

  let publicationDateFilter = 'OPTIONAL { ?expressionUri eli:date_publication ?publicationDate . }';
  if (publicationDateFrom || publicationDateTo) {
    publicationDateFilter = '?expressionUri eli:date_publication ?publicationDate . ';
    if (publicationDateFrom)
      publicationDateFilter += `FILTER (?publicationDate >= "${publicationDateFrom}"^^xsd:date) `;
    if (publicationDateTo)
      publicationDateFilter += `FILTER (?publicationDate <= "${publicationDateTo}"^^xsd:date) `;
  }

  const excludeAdaptationFilters = [];
  if (! words.includes('houdende')) {
    excludeAdaptationFilters.push('FILTER(! STRSTARTS(LCASE(?title),"houdende"))');
  }
  if (! words.includes('wijziging')) {
    excludeAdaptationFilters.push('FILTER(! STRSTARTS(LCASE(?title),"tot wijziging"))');
  }
  const totalCount = await executeCountQuery(`
      PREFIX eli: <http://data.europa.eu/eli/ontology#>

      SELECT COUNT(DISTINCT(?expressionUri)) as ?count
      WHERE {
        ?legalResourceUri eli:type_document <${type}> ;
                          eli:is_realized_by ?expressionUri .
        ?expressionUri a <http://data.europa.eu/eli/ontology#LegalExpression> .
        ?expressionUri eli:title ?title .
        ${words.map((word) => `FILTER (CONTAINS(LCASE(?title), "${replaceDiacriticsInWord(word).toLowerCase()}"))`).join("\n")}
        ${excludeAdaptationFilters.join("\n")}
        ${documentDateFilter}
        ${publicationDateFilter}
      }`);

  if (totalCount > 0) {
    const response = await executeQuery(`
        PREFIX eli: <http://data.europa.eu/eli/ontology#>

        SELECT DISTINCT ?expressionUri as ?uri ?title ?publicationDate ?documentDate
        WHERE {
          ?legalResourceUri eli:type_document <${type}> ;
                            eli:is_realized_by ?expressionUri .
          ?expressionUri a <http://data.europa.eu/eli/ontology#LegalExpression> .
          ?expressionUri eli:title ?title .
          ${words.map((word) => `FILTER (CONTAINS(LCASE(?title), "${replaceDiacriticsInWord(word).toLowerCase()}"))`).join("\n")}
          OPTIONAL { ?expressionUri eli:date_publication ?publicationDate . }
          ${excludeAdaptationFilters.join("\n")}
          ${documentDateFilter}
          ${publicationDateFilter}
        } ORDER BY ?title LIMIT ${pageSize} OFFSET ${pageNumber * pageSize}`);

    const decisions = response.results.bindings.map((binding) => {
      const escapedTitle = escapeValue(binding.title.value);
      const publicationDate = dateValue(binding.publicationDate && binding.publicationDate.value);
      const documentDate = dateValue(binding.documentDate && binding.documentDate.value);
      return new Decision({
        uri: binding.uri.value,
        title: escapedTitle,
        legislationTypeUri: type,
        publicationDate,
        documentDate
      });
    });

    return {
      totalCount,
      decisions
    };
  } else {
    return {
      totalCount,
      decisions: []
    };
  }
}

async function fetchArticles(legalExpression, pageNumber = 0, pageSize = 10, articleFilter) {
  const numberFilter = articleFilter ? `FILTER( !BOUND(?number) || CONTAINS(?number, "${articleFilter}"))` : '';
  const totalCount = await executeCountQuery(`
    PREFIX eli: <http://data.europa.eu/eli/ontology#>
    PREFIX dct: <http://purl.org/dc/terms/>

    SELECT COUNT(DISTINCT(?article)) as ?count
    WHERE {
        ?legalResource eli:is_realized_by <${legalExpression}> ;
                       eli:has_part ?articleResource .
        ?articleResource eli:is_realized_by ?article ;
                         dct:type <https://data.vlaanderen.be/id/concept/TypeRechtsbrononderdeel/Artikel>.
        OPTIONAL {
           ?article eli:first_date_entry_in_force ?dateInForce .
           FILTER (?dateInForce <= NOW() )
        }
        OPTIONAL { ?article eli:date_no_longer_in_force ?dateNoLongerInForce }
        FILTER( !BOUND(?dateNoLongerInForce) || ?dateNoLongerInForce > NOW() )
        OPTIONAL { ?article eli:number ?number . }
        ${numberFilter}
    }`);

  if (totalCount > 0) {
    // ?number has format like "Artikel 12." We parse the number from the string for ordering
    // Second degree ordering on ?numberStr to make sure "Artikel 3/1." comes after "Artikel 3."
    const response = await executeQuery(`
    PREFIX eli: <http://data.europa.eu/eli/ontology#>
    PREFIX prov: <http://www.w3.org/ns/prov#>
    PREFIX dct: <http://purl.org/dc/terms/>

    SELECT DISTINCT ?article ?dateInForce ?dateNoLongerInForce ?number ?content WHERE {
        ?legalResource eli:is_realized_by <${legalExpression}> ;
                       eli:has_part ?articleResource .
        ?articleResource eli:is_realized_by ?article ;
                         dct:type <https://data.vlaanderen.be/id/concept/TypeRechtsbrononderdeel/Artikel>.
        OPTIONAL {
          ?article eli:first_date_entry_in_force ?dateInForce .
          FILTER (?dateInForce <= NOW() )
        }
        OPTIONAL { ?article eli:date_no_longer_in_force ?dateNoLongerInForce }
        FILTER( !BOUND(?dateNoLongerInForce) || ?dateNoLongerInForce > NOW() )
        OPTIONAL { ?article prov:value ?content . }
        OPTIONAL { ?article eli:number ?number . }
        ${numberFilter}
        BIND(REPLACE(?number, "Artikel ", "") as ?numberStr)
        BIND(STRDT(?numberStr, xsd:integer) as ?numberInt)
    } ORDER BY ?numberInt ?numberStr LIMIT ${pageSize} OFFSET ${pageNumber * pageSize}`);

    const articles = response.results.bindings.map((binding) => {
      const escapedContent = escapeValue(binding.content && binding.content.value);
      const dateInForce = dateValue(binding.dateInForce && binding.dateInForce.value);
      const dateNoLongerInForce = dateValue(binding.dateNoLongerInForce && binding.dateNoLongerInForce.value);
      return new Article({
        uri: binding.article.value,
        number: binding.number && binding.number.value,
        content: escapedContent,
        dateInForce,
        dateNoLongerInForce
      });
    });

    return {
      totalCount,
      articles
    };
  } else {
    return {
      totalCount,
      articles: []
    };
  }
}

function escapeValue(value) {
  if (value) {
    const shadowDomElement = document.createElement('textarea');
    shadowDomElement.innerHTML = value;
    return shadowDomElement.textContent;
  } else {
    return null;
  }
}

function dateValue(value) {
  if (value) {
    try {
      return new Date(Date.parse(value));
    } catch (e) {
      warn(`Error parsing date ${value}: ${e.message}`, { id: 'date-parsing-error' });
      return null;
    }
  } else {
    return null;
  }
}

async function executeCountQuery(query) {
  const response = await executeQuery(query);
  return parseInt(response.results.bindings[0].count.value);
}

async function executeQuery(query) {
  const encodedQuery = encodeURIComponent(query.trim());
  const endpoint = `${SPARQL_ENDPOINT}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {'Accept': 'application/sparql-results+json', 'Content-Type': "application/x-www-form-urlencoded; charset=UTF-8" },
    body: `query=${encodedQuery}`
  });

  if (response.ok) {
    return response.json();
  } else {
    throw new Error(`Request to Vlaamse Codex was unsuccessful: [${response.status}] ${response.statusText}`);
  }
}

export {
  fetchDecisions,
  fetchArticles
}
