const LEGISLATION_TYPES: Record<string,string> = {
  'decreet': 'https://data.vlaanderen.be/id/concept/AardWetgeving/Decreet',
  'koninklijk besluit': 'https://data.vlaanderen.be/id/concept/AardWetgeving/KoninklijkBesluit',
  'wet': 'https://data.vlaanderen.be/id/concept/AardWetgeving/Wet',
  'ministerieel besluit': 'https://data.vlaanderen.be/id/concept/AardWetgeving/MinisterieelBesluit',
  'besluit van de vlaamse regering': 'https://data.vlaanderen.be/id/concept/AardWetgeving/BesluitVanDeVlaamseRegering',
  'omzendbrief': 'https://data.vlaanderen.be/id/concept/AardWetgeving/Omzendbrief',
  'verdrag': 'https://data.vlaanderen.be/id/concept/AardWetgeving/Verdrag',
  'grondwet': 'https://data.vlaanderen.be/id/concept/AardWetgeving/Grondwet',
  'grondwetswijziging': 'https://data.vlaanderen.be/id/concept/AardWetgeving/Grondwetwijziging',
  'samenwerkingsakkoord': 'https://data.vlaanderen.be/id/concept/AardWetgeving/Samenwerkingsakkoord',
  'wetboek': 'https://data.vlaanderen.be/id/concept/AardWetgeving/Wetboek',
  'gecoordineerde wetten': 'https://data.vlaanderen.be/id/concept/AardWetgeving/GecoordineerdeWetten',
  'gecoördineerde wetten': 'https://data.vlaanderen.be/id/concept/AardWetgeving/GecoordineerdeWetten',
  'bijzondere wet': 'https://data.vlaanderen.be/id/concept/AardWetgeving/BijzondereWet',
  'genummerd koninklijk besluit': 'https://data.vlaanderen.be/id/concept/AardWetgeving/GenummerdKoninklijkBesluit',
  'protocol': 'https://data.vlaanderen.be/id/concept/AardWetgeving/Protocol'
};

const LEGISLATION_TYPE_CONCEPTS: Array<{label:string, value: string}> = Object.keys(LEGISLATION_TYPES).map(key => {
  return { label: key, value: LEGISLATION_TYPES[key] };
});

export { LEGISLATION_TYPES, LEGISLATION_TYPE_CONCEPTS };
