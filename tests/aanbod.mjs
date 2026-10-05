// Verwachte inhoud, letterlijk uit opdracht.md (WhatsApp-bericht van Yoly) + besluiten B1, B10.
// Geen emoji's, geen "Vanaf". Het streepje in de duur is een half kastlijntje; tests behandelen – en - als gelijk.

export const BEHANDELINGEN = [
  {
    id: 'basis',
    naam: 'Yoly Luxe Basic Facial',
    prijs: 55,
    prijsTekst: '€55',
    duurNorm: '60',
    duurTekst: '± 60 min',
    zinnen: ['Een zachte en verzorgende gezichtsbehandeling voor een frisse, schone en verzorgde huid.'],
    lijstkop: 'De behandeling omvat',
    punten: ['Reiniging van de huid', 'Diepe reiniging', 'Exfoliatie', 'Masker afgestemd op de huid', 'Hydratatie', 'Verzorgende afsluiting'],
    extra: { kop: 'Ideaal voor', zin: 'Een eerste kennismaking met professionele gezichtsverzorging of als regelmatig onderhoud van de huid.' },
  },
  {
    id: 'diepe',
    naam: 'Deep Clean Facial',
    prijs: 75,
    prijsTekst: '€75',
    duurNorm: '75',
    duurTekst: '± 75 min',
    zinnen: ['Een intensievere gezichtsbehandeling gericht op het grondig reinigen van de huid en het verwijderen van onzuiverheden.'],
    lijstkop: 'De behandeling omvat',
    punten: ['Dubbele reiniging', 'Exfoliatie', 'Intensieve poriënreiniging', 'Verwijdering van mee-eters en onzuiverheden', 'Verzorgend masker', 'Hydratatie', 'Afwerking met passende huidverzorging'],
    extra: { kop: 'Ideaal voor', zin: 'Een huid met verstopte poriën, mee-eters en zichtbare onzuiverheden.' },
  },
  {
    id: 'hydrafacial',
    naam: 'HydraFacial',
    prijs: 95,
    prijsTekst: '€95',
    duurNorm: '75-90',
    duurTekst: '± 75–90 min',
    zinnen: [
      'Een intensieve behandeling voor een diep gereinigde, gehydrateerde en stralende huid.',
      'De huid wordt grondig gereinigd en onzuiverheden worden verwijderd, terwijl de huid tegelijkertijd wordt verzorgd en gehydrateerd.',
    ],
    lijstkop: 'De behandeling omvat',
    punten: ['Reiniging', 'Exfoliatie', 'Diepe poriënreiniging', 'Verwijdering van onzuiverheden', 'Intensieve hydratatie', 'Verzorgende finishing treatment'],
    extra: { kop: 'Resultaat', zin: 'Een frisse, zachte en zichtbaar stralende huid.' },
  },
  {
    id: 'dermapen',
    naam: 'Dermapen',
    prijs: 55,
    prijsTekst: '€55',
    duurNorm: '45-60',
    duurTekst: '± 45–60 min',
    zinnen: [
      'Een professionele behandeling die de huid stimuleert en de natuurlijke huidvernieuwing ondersteunt.',
      'Dermapen wordt toegepast om de huidtextuur te verfijnen en de huid een gladdere en egalere uitstraling te geven.',
    ],
    lijstkop: 'Geschikt voor',
    punten: ['Oneffen huidstructuur', 'Grove poriën', 'Huid die haar glans heeft verloren', 'Fijne lijntjes', 'Acne-littekentjes'],
    extra: null,
  },
  {
    id: 'lips',
    naam: 'Lip Hydration',
    prijs: 30,
    prijsTekst: '€30',
    duurNorm: '20-30',
    duurTekst: '± 20–30 min',
    zinnen: ['Een verzorgende behandeling voor zachte, gehydrateerde en mooi verzorgde lippen.'],
    lijstkop: 'De behandeling omvat',
    punten: ['Zachte exfoliatie', 'Intensieve hydratatie', 'Verzorgende lip treatment'],
    extra: { kop: null, zin: 'Perfect als kleine beauty treatment of als aanvulling op een gezichtsbehandeling.' },
  },
  {
    id: 'melanin',
    naam: 'Melanin Glow',
    prijs: null,
    prijsTekst: 'Prijs op aanvraag',
    duurNorm: null,
    duurTekst: null,
    zinnen: [
      'Professionele verzorging voor een mooie, egale en stralende huid',
      'Een behandeling speciaal afgestemd op de behoeften van een huid met meer melanine.',
      'De focus ligt op een gezonde huidbarrière, hydratatie, een egale uitstraling en een mooie natuurlijke glow.',
      'De behandeling wordt afgestemd op de conditie en behoeften van jouw huid.',
    ],
    lijstkop: null,
    punten: [],
    extra: null,
  },
];

export const IDS = BEHANDELINGEN.map((b) => b.id);

export const PAGINAKOP = {
  h1: 'Professionele gezichtsbehandelingen',
  zinnen: [
    'Ontdek een moment voor jezelf met professionele huidverzorging, afgestemd op de behoeften van jouw huid.',
    'Bij Yoly Luxe staat een gezonde, stralende en verzorgde huid centraal.',
  ],
};

// Prijzen voor 1, 3 en 5 behandelingen (gebruikt vanaf cp2).
export const PAKKETTEN = {
  basis: { naam: 'Basic Facial', prijzen: [55, 150, 240] },
  diepe: { naam: 'Deep Clean Facial', prijzen: [75, 210, 335] },
  hydrafacial: { naam: 'HydraFacial', prijzen: [95, 270, 425] },
};

export const SLOT = {
  kop: 'Jouw huid, jouw moment',
  zinnen: [
    'Elke huid is anders. Daarom wordt iedere behandeling afgestemd op de actuele behoeften van jouw huid.',
    'Heb je vragen over welke behandeling het beste bij jou past?',
    'Plan jouw afspraak bij Yoly Luxe en geef jouw huid het moment dat ze verdient.',
  ],
};
