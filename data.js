// Fortuna Talent Scout Dashboard – Datenmodell & Demodaten
// Persistenz über localStorage, Demodaten als Ausgangsbasis.

const POSITIONEN = ["Torwart", "Innenverteidiger", "Außenverteidiger", "Sechser", "Achter", "Zehner", "Flügelspieler", "Stürmer"];

// Feldpositionen für Grafik (x, y auf 0-100 Skala, 50,50 ist Feldmitte)
const FELDPOSITIONEN = {
  AVL: { x: 15, y: 30, label: "AVL", name: "Außenverteidiger Links" },
  AVR: { x: 85, y: 30, label: "AVR", name: "Außenverteidiger Rechts" },
  IVL: { x: 20, y: 50, label: "IVL", name: "Innenverteidiger Links" },
  IVR: { x: 80, y: 50, label: "IVR", name: "Innenverteidiger Rechts" },
  SECHSER: { x: 50, y: 40, label: "6", name: "Sechser" },
  ACHTERL: { x: 35, y: 55, label: "8", name: "Achter Links" },
  ACHTERR: { x: 65, y: 55, label: "8", name: "Achter Rechts" },
  ZEHNER: { x: 50, y: 65, label: "10", name: "Zehner" },
  FLUGEL_L: { x: 20, y: 70, label: "FL", name: "Flügelspieler Links" },
  FLUGEL_R: { x: 80, y: 70, label: "FR", name: "Flügelspieler Rechts" },
  STURMER_L: { x: 35, y: 85, label: "ST", name: "Stürmer Links" },
  STURMER_M: { x: 50, y: 90, label: "ST", name: "Stürmer Mitte" },
  STURMER_R: { x: 65, y: 85, label: "ST", name: "Stürmer Rechts" },
};

// Torwart-Positionen im Tor (x, y auf 0-100 Skala, Tor ist 50, 10)
const TORWART_POSITIONEN = {
  TOR_LINKS: { x: 30, y: 8, label: "L", name: "Linke Ecke" },
  TOR_MITTE_L: { x: 40, y: 8, label: "ML", name: "Mitte-Links" },
  TOR_MITTE: { x: 50, y: 8, label: "M", name: "Mitte" },
  TOR_MITTE_R: { x: 60, y: 8, label: "MR", name: "Mitte-Rechts" },
  TOR_RECHTS: { x: 70, y: 8, label: "R", name: "Rechte Ecke" },
};

// Vordefinierte Aufstellungen (Abkürzung -> Array von Feldpositionen)
const AUFSTELLUNGEN = {
  "4-3-3": ["AVL", "IVL", "IVR", "AVR", "ACHTERL", "SECHSER", "ACHTERR", "FLUGEL_L", "ZEHNER", "FLUGEL_R", "STURMER_M"],
  "4-2-3-1": ["AVL", "IVL", "IVR", "AVR", "SECHSER", "ACHTERL", "ACHTERR", "ZEHNER", "FLUGEL_L", "FLUGEL_R", "STURMER_M"],
  "3-5-2": ["IVL", "SECHSER", "IVR", "AVL", "ACHTERL", "ZEHNER", "ACHTERR", "AVR", "FLUGEL_L", "STURMER_L", "STURMER_R"],
  "5-3-2": ["AVL", "IVL", "SECHSER", "IVR", "AVR", "ACHTERL", "ZEHNER", "ACHTERR", "STURMER_L", "STURMER_R"],
  "4-4-2": ["AVL", "IVL", "IVR", "AVR", "FLUGEL_L", "ACHTERL", "ACHTERR", "FLUGEL_R", "STURMER_L", "STURMER_R"],
};

// Rollen pro Position
const ROLLEN_PRO_POSITION = {
  "Außenverteidiger": [
    { name: "Offensiver Außenverteidiger", sterne: 3 },
    { name: "Ballspielender Außenverteidiger", sterne: 3 },
    { name: "Defensiver Außenverteidiger", sterne: 2 },
    { name: "Inverted Fullback", sterne: 2 },
  ],
  "Innenverteidiger": [
    { name: "Ballspielender Innenverteidiger", sterne: 3 },
    { name: "Passspiel-Innenverteidiger", sterne: 3 },
    { name: "Defensiver Innenverteidiger", sterne: 2 },
    { name: "Luftspiel-Spezialist", sterne: 3 },
  ],
  "Sechser": [
    { name: "Balleroberungsexperte", sterne: 3 },
    { name: "Spielaufbau-Sechser", sterne: 3 },
    { name: "Defensiver Sechser", sterne: 2 },
    { name: "Box-to-Box Sechser", sterne: 2 },
  ],
  "Achter": [
    { name: "Box-to-Box Achter", sterne: 3 },
    { name: "Offensiver Achter", sterne: 3 },
    { name: "Defensiver Achter", sterne: 2 },
    { name: "Antreiber-Achter", sterne: 2 },
  ],
  "Zehner": [
    { name: "Kreativer Zehner", sterne: 3 },
    { name: "Torschützen-Zehner", sterne: 3 },
    { name: "Falsche 9", sterne: 2 },
    { name: "Passspiel-Zehner", sterne: 3 },
  ],
  "Flügelspieler": [
    { name: "Flügelspieler", sterne: 3 },
    { name: "Umschaltflügel", sterne: 2 },
    { name: "Mitarbeitender Flügelspieler", sterne: 2 },
    { name: "Inverser Umschaltflügel", sterne: 2 },
  ],
  "Stürmer": [
    { name: "Klassischer Stürmer", sterne: 3 },
    { name: "Torjäger", sterne: 3 },
    { name: "Arbeitsstürmer", sterne: 2 },
    { name: "Spielmacher-Stürmer", sterne: 2 },
  ],
};

const POOL_LISTEN = {
  beobachten: { titel: "Beobachten", desc: "Interessante Spieler – weiter beobachten, mehr Daten notwendig" },
  probetraining: { titel: "Probetraining", desc: "Einladung empfohlen" },
  verpflichtung: { titel: "Verpflichtung empfohlen", desc: "Höchste Priorität" },
  archiv: { titel: "Archiv", desc: "Nicht weiter verfolgen" },
};

const TRIAL_STATUS = ["Keine", "Einladung versendet", "Teilnahme bestätigt", "Teilnahme erfolgt", "Entscheidung offen"];

// Separate Bewertungsmodelle für Torwart und Feldspieler
const RATING_MODELL_TORWART = {
  torhuter: {
    titel: "Torschusswerte",
    attribute: {
      abschlag: "Abschlag", abwurf: "Abwurf", ballannahme: "Ballannahme", eins_gegen_eins: "Eins gegen Eins",
      exzentrizitaet: "Exzentrizität", fausten: "Fausten (Tendenz)", halten: "Halten", herauslaufen: "Herauslaufen",
      hohe_baelle: "Hohe Bälle", kommunikation: "Kommunikation", passen: "Passen", reflexe: "Reflexe", strafraumkontrolle: "Strafraumkontrolle"
    },
  },
  mental: {
    titel: "Mental",
    attribute: {
      aggressivitaet: "Aggressivität", antizipation: "Antizipation", einsatzfreude: "Einsatzfreude", entscheidungen: "Entscheidungen",
      flair: "Flair", fuehrungsqualitaet: "Führungsqualität", konzentration: "Konzentration", mut: "Mut",
      nervenstärke: "Nervenstärke", ohne_ball: "Ohne Ball", stellungsspiel: "Stellungsspiel", teamwork: "Teamwork",
      uebersicht: "Übersicht", zielstrebigkeit: "Zielstrebigkeit"
    },
  },
  athletik: {
    titel: "Athletik",
    attribute: {
      antritt: "Antritt", ausdauer: "Ausdauer", balance: "Balance", beweglichkeit: "Beweglichkeit",
      grundfitness: "Grundfitness", kraft: "Kraft", schnelligkeit: "Schnelligkeit", sprunghöhe: "Sprunghöhe"
    },
  },
  technik: {
    titel: "Technik",
    attribute: {
      elfmeter: "Elfmeter", freistoße: "Freistoße", technik: "Technik"
    },
  },
};

const RATING_MODELL_FELDSPIELER = {
  technik: {
    titel: "Technisch",
    attribute: {
      torabschluss: "Abschluss", ballannahme: "Ballannahme", pressing: "Deckung", dribbling: "Dribbling",
      flanken: "Flanken", kopfball: "Kopfballtechnik", passspiel: "Passspiel", spielverstaendnis: "Spielverstädnis",
      wettbewerb: "Wettbewerb", schnelligkeit: "Schnelligkeit"
    },
  },
  taktik: {
    titel: "Taktik",
    attribute: {
      spielverstaendnis: "Spielverständnis", positionierung: "Positionierung", entscheidungen: "Entscheidungsverhalten",
      antizipation: "Antizipation", pressing: "Pressingverhalten"
    },
  },
  mentalitaet: {
    titel: "Mentalität",
    attribute: {
      lernbereitschaft: "Lernbereitschaft", disziplin: "Disziplin", teamfaehigkeit: "Teamfähigkeit",
      wettbewerb: "Wettbewerbsmentalität", fuehrung: "Führungsverhalten"
    },
  },
  athletik: {
    titel: "Athletik",
    attribute: {
      antritt: "Antritt", ausdauer: "Ausdauer", beweglichkeit: "Beweglichkeit", robustheit: "Robustheit",
      schnelligkeit: "Schnelligkeit"
    },
  },
};

// Kompatibilität: generisches RATING_MODELL (wird für allgemeine Funktionen verwendet)
const RATING_MODELL = RATING_MODELL_FELDSPIELER;

const REPORT_SECTIONS = ["Allgemeiner Eindruck", "Ballbesitz", "Gegen den Ball", "Umschaltspiel", "Persönlichkeit", "Entwicklungspotenzial", "Empfehlung"];

function leereRatings() {
  const r = {};
  for (const grp of Object.values(RATING_MODELL)) {
    for (const key of Object.keys(grp.attribute)) r[key] = 5;
  }
  return r;
}

function demoRatings(overrides) {
  return Object.assign(leereRatings(), overrides);
}

const DEMO_SPIELER = [
  {
    id: "p1", vorname: "Leon", nachname: "Brandt", geburtsdatum: "2010-03-14", nationalitaet: "Deutschland",
    verein: "SC West Düsseldorf", liga: "Bezirksliga U16", verband: "FVN", groesse: 176, gewicht: 64,
    starkerFuss: "Rechts", schwacherFuss: 3, hauptposition: "Flügelspieler", nebenpositionen: ["Stürmer", "Zehner"],
    vertragsstatus: "Vereinsmitglied", vertragsende: "2026-06-30", berater: "", kontakt: "Eltern: 0211-555123",
    pool: "probetraining", trialStatus: "Einladung versendet", trialUrteil: "",
    erstelltAm: "2026-05-28",
    ratings: demoRatings({ schnelligkeit: 9, antritt: 9, dribbling: 8, ballannahme: 7, passspiel: 6, torabschluss: 7, spielverstaendnis: 6, entscheidungen: 6, lernbereitschaft: 8, wettbewerb: 8, aktuellesNiveau: 7, potenzialniveau: 9, entwicklung: 8 }),
    videos: [{ titel: "Highlight-Clips Saison 25/26", url: "https://youtube.com/beispiel", tags: ["Tore", "1 gegen 1"] }],
    berichte: [
      { datum: "2026-05-24", gegner: "TuRU Düsseldorf U16", wettbewerb: "Meisterschaft", spielort: "Düsseldorf", wetter: "Sonnig", beobachter: "M. Weber",
        abschnitte: { "Allgemeiner Eindruck": "Auffälligster Spieler auf dem Platz, sucht ständig das 1-gegen-1.", "Ballbesitz": "Sehr guter erster Kontakt, zieht gern von außen nach innen.", "Gegen den Ball": "Arbeitet nach hinten noch unregelmäßig mit.", "Umschaltspiel": "Brandgefährlich nach Ballgewinn, enormes Tempo.", "Persönlichkeit": "Selbstbewusst, fordert den Ball auch nach Fehlern.", "Entwicklungspotenzial": "Klar überdurchschnittlich für den Jahrgang.", "Empfehlung": "Zum Probetraining einladen." } },
    ],
    entwicklung: [],
  },
  {
    id: "p2", vorname: "Emre", nachname: "Yildiz", geburtsdatum: "2011-08-02", nationalitaet: "Deutschland / Türkei",
    verein: "Ratingen 04/19", liga: "Niederrheinliga U15", verband: "FVN", groesse: 168, gewicht: 57,
    starkerFuss: "Links", schwacherFuss: 4, hauptposition: "Achter", nebenpositionen: ["Sechser"],
    vertragsstatus: "Vereinsmitglied", vertragsende: "2027-06-30", berater: "", kontakt: "",
    pool: "verpflichtung", trialStatus: "Teilnahme erfolgt", trialUrteil: "Ja",
    erstelltAm: "2026-04-12",
    ratings: demoRatings({ passspiel: 9, spielverstaendnis: 9, ballannahme: 8, positionierung: 8, entscheidungen: 8, antizipation: 8, ausdauer: 8, lernbereitschaft: 9, disziplin: 8, teamfaehigkeit: 9, aktuellesNiveau: 8, potenzialniveau: 9, entwicklung: 9 }),
    videos: [],
    berichte: [
      { datum: "2026-04-05", gegner: "Bayer 04 U15", wettbewerb: "Niederrheinliga", spielort: "Ratingen", wetter: "Bewölkt", beobachter: "S. Krause",
        abschnitte: { "Allgemeiner Eindruck": "Spielintelligenz weit über Jahrgangsniveau.", "Ballbesitz": "Öffnet mit dem ersten Kontakt das Feld, hervorragendes Passspiel über alle Distanzen.", "Gegen den Ball": "Antizipiert Passwege sehr gut.", "Umschaltspiel": "Schaltet schnell um, sichert klug ab.", "Persönlichkeit": "Ruhig, dirigiert die Mitspieler.", "Entwicklungspotenzial": "Möglicher Unterschiedsspieler im Zentrum.", "Empfehlung": "Verpflichtung empfohlen – höchste Priorität." } },
      { datum: "2026-05-17", gegner: "MSV Duisburg U15", wettbewerb: "Niederrheinliga", spielort: "Duisburg", wetter: "Regen", beobachter: "M. Weber",
        abschnitte: { "Allgemeiner Eindruck": "Bestätigt den starken Eindruck auch auf tiefem Boden.", "Ballbesitz": "Auch unter Druck kaum Ballverluste.", "Gegen den Ball": "Gute Pressingauslösung.", "Umschaltspiel": "Erste Anspielstation nach Ballgewinn.", "Persönlichkeit": "Kapitän, übernimmt Verantwortung.", "Entwicklungspotenzial": "Hoch.", "Empfehlung": "Schnell handeln, Konkurrenz beobachtet ebenfalls." } },
    ],
    entwicklung: [],
  },
  {
    id: "p3", vorname: "Mats", nachname: "Hoffmann", geburtsdatum: "2010-11-21", nationalitaet: "Deutschland",
    verein: "VfL Benrath", liga: "Leistungsklasse U16", verband: "FVN", groesse: 187, gewicht: 74,
    starkerFuss: "Rechts", schwacherFuss: 2, hauptposition: "Innenverteidiger", nebenpositionen: ["Sechser"],
    vertragsstatus: "Vereinsmitglied", vertragsende: "2026-12-31", berater: "Sportsfirst GmbH", kontakt: "berater@sportsfirst.de",
    pool: "beobachten", trialStatus: "Keine", trialUrteil: "",
    erstelltAm: "2026-06-01",
    ratings: demoRatings({ kopfball: 8, robustheit: 8, positionierung: 7, antizipation: 7, passspiel: 6, schnelligkeit: 5, disziplin: 8, aktuellesNiveau: 6, potenzialniveau: 7, entwicklung: 7 }),
    videos: [],
    berichte: [
      { datum: "2026-05-31", gegner: "Fortuna U16", wettbewerb: "Testspiel", spielort: "Benrath", wetter: "Sonnig", beobachter: "S. Krause",
        abschnitte: { "Allgemeiner Eindruck": "Körperlich präsenter Innenverteidiger mit guter Grundordnung.", "Ballbesitz": "Solide im Aufbau, noch wenig mutige Anspiele ins Zentrum.", "Gegen den Ball": "Stark in der Luft und im direkten Duell.", "Umschaltspiel": "Restverteidigung verlässlich.", "Persönlichkeit": "Lautstark, organisiert die Kette.", "Entwicklungspotenzial": "Solide, Tempo limitiert.", "Empfehlung": "Weiter beobachten, mehr Daten notwendig." } },
    ],
    entwicklung: [],
  },
  {
    id: "p4", vorname: "Noah", nachname: "Schneider", geburtsdatum: "2012-02-09", nationalitaet: "Deutschland",
    verein: "Garather SV", liga: "Kreisliga U14", verband: "FVN", groesse: 158, gewicht: 47,
    starkerFuss: "Rechts", schwacherFuss: 3, hauptposition: "Zehner", nebenpositionen: ["Flügelspieler"],
    vertragsstatus: "Vereinsmitglied", vertragsende: "", berater: "", kontakt: "Vater: 0172-9988776",
    pool: "beobachten", trialStatus: "Keine", trialUrteil: "",
    erstelltAm: "2026-06-08",
    ratings: demoRatings({ dribbling: 8, ballannahme: 8, spielverstaendnis: 7, beweglichkeit: 8, schnelligkeit: 7, lernbereitschaft: 9, aktuellesNiveau: 6, potenzialniveau: 8, entwicklung: 9 }),
    videos: [],
    berichte: [],
    entwicklung: [],
  },
  {
    id: "p5", vorname: "Luca", nachname: "Petrović", geburtsdatum: "2009-07-30", nationalitaet: "Deutschland / Serbien",
    verein: "1. FC Mönchengladbach", liga: "Niederrheinliga U17", verband: "FVN", groesse: 181, gewicht: 71,
    starkerFuss: "Beidfüßig", schwacherFuss: 5, hauptposition: "Stürmer", nebenpositionen: ["Zehner", "Flügelspieler"],
    vertragsstatus: "Fördervertrag", vertragsende: "2026-06-30", berater: "ProTalent Management", kontakt: "office@protalent.de",
    pool: "probetraining", trialStatus: "Entscheidung offen", trialUrteil: "Vielleicht",
    erstelltAm: "2026-03-19",
    ratings: demoRatings({ torabschluss: 9, ballannahme: 8, dribbling: 7, kopfball: 7, antritt: 8, robustheit: 7, wettbewerb: 9, aktuellesNiveau: 8, potenzialniveau: 8, entwicklung: 6 }),
    videos: [{ titel: "Wyscout: Saisontore 25/26", url: "https://wyscout.com/beispiel", tags: ["Tore", "Standards"] }],
    berichte: [
      { datum: "2026-03-15", gegner: "RW Essen U17", wettbewerb: "Niederrheinliga", spielort: "Essen", wetter: "Windig", beobachter: "M. Weber",
        abschnitte: { "Allgemeiner Eindruck": "Klassischer Strafraumstürmer mit ausgeprägtem Torriecher.", "Ballbesitz": "Gute Ablagen mit dem Rücken zum Tor.", "Gegen den Ball": "Anlaufverhalten verbesserungswürdig.", "Umschaltspiel": "Tiefenläufe gut getimt.", "Persönlichkeit": "Ehrgeizig, teils ungeduldig.", "Entwicklungspotenzial": "Aktuell stark, Entwicklungskurve flacht ab.", "Empfehlung": "Probetraining zur finalen Einschätzung." } },
    ],
    entwicklung: [],
  },
  {
    id: "p6", vorname: "Jonas", nachname: "Klein", geburtsdatum: "2011-12-05", nationalitaet: "Deutschland",
    verein: "DJK Sparta Bilk", liga: "Leistungsklasse U15", verband: "FVN", groesse: 171, gewicht: 60,
    starkerFuss: "Links", schwacherFuss: 2, hauptposition: "Außenverteidiger", nebenpositionen: ["Flügelspieler"],
    vertragsstatus: "Vereinsmitglied", vertragsende: "", berater: "", kontakt: "",
    pool: "archiv", trialStatus: "Teilnahme erfolgt", trialUrteil: "Nein",
    erstelltAm: "2026-02-02",
    ratings: demoRatings({ schnelligkeit: 7, ausdauer: 7, flanken: 6, positionierung: 4, entscheidungen: 4, aktuellesNiveau: 5, potenzialniveau: 5, entwicklung: 5 }),
    videos: [],
    berichte: [],
    entwicklung: [],
  },
  {
    id: "p7", vorname: "Tom", nachname: "Lindner", geburtsdatum: "2010-05-18", nationalitaet: "Deutschland",
    verein: "Fortuna Fußballschule", liga: "Fördertraining", verband: "FVN", groesse: 173, gewicht: 62,
    starkerFuss: "Rechts", schwacherFuss: 3, hauptposition: "Sechser", nebenpositionen: ["Achter", "Innenverteidiger"],
    vertragsstatus: "Fördertraining", vertragsende: "2027-06-30", berater: "", kontakt: "",
    pool: "verpflichtung", trialStatus: "Teilnahme erfolgt", trialUrteil: "Ja",
    erstelltAm: "2025-11-10",
    ratings: demoRatings({ passspiel: 7, spielverstaendnis: 8, positionierung: 8, antizipation: 7, ausdauer: 8, disziplin: 9, teamfaehigkeit: 8, aktuellesNiveau: 7, potenzialniveau: 8, entwicklung: 8 }),
    videos: [],
    berichte: [],
    entwicklung: [
      { datum: "2026-03-01", ziel: "Spieleröffnung unter Druck verbessern", schwerpunkte: "Erste Ballkontakte, Körperstellung, Passspiel ins Zentrum", fortschritt: "Deutlich sicherer im Aufbauspiel, weniger Rückpässe", feedback: "Trainer: sehr lernwillig, setzt Hinweise schnell um" },
      { datum: "2026-05-01", ziel: "Zweikampfverhalten im Zentrum", schwerpunkte: "Timing im Pressing, Tackling-Technik", fortschritt: "Gewinnt deutlich mehr zweite Bälle", feedback: "Trainer: körperlich gewachsen, gutes Stellungsspiel" },
    ],
  },
  {
    id: "p8", vorname: "Finn", nachname: "Bachmann", geburtsdatum: "2012-09-27", nationalitaet: "Deutschland",
    verein: "SG Unterrath", liga: "Leistungsklasse U14", verband: "FVN", groesse: 160, gewicht: 49,
    starkerFuss: "Rechts", schwacherFuss: 3, hauptposition: "Torwart", nebenpositionen: [],
    vertragsstatus: "Vereinsmitglied", vertragsende: "", berater: "", kontakt: "Mutter: 0151-2233445",
    pool: "beobachten", trialStatus: "Keine", trialUrteil: "",
    erstelltAm: "2026-05-20",
    ratings: demoRatings({ ballannahme: 6, passspiel: 6, beweglichkeit: 8, antizipation: 7, positionierung: 7, lernbereitschaft: 8, aktuellesNiveau: 6, potenzialniveau: 8, entwicklung: 8 }),
    videos: [],
    berichte: [],
    entwicklung: [],
  },
];

const STORAGE_KEY = "fortuna-scout-data-v1";

function ladeSpieler() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) return JSON.parse(raw) || [];
  } catch (e) {}
  return [];
}

async function speichereSpieler(spieler) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(spieler));
  if (window.DB) {
    for (const s of spieler) {
      await window.indexedDBPut("spieler", s);
    }
  }
}

function resetDemodaten() {
  const kopie = JSON.parse(JSON.stringify(DEMO_SPIELER));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(kopie));
  speichereFirebase(kopie);
}

// ── Firebase Realtime Database ──────────────────────────────────────────────
var _fbDb = null;
var _fbSuppressUpdate = false;

function toArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  return Object.values(v);
}

function normalisiereSpieler(p) {
  p.videos      = toArray(p.videos);
  p.berichte    = toArray(p.berichte);
  p.entwicklung = toArray(p.entwicklung);
  p.nebenpositionen = toArray(p.nebenpositionen);
  if (!p.ratings)     p.ratings     = leereRatings();
  if (!p.statistiken) p.statistiken = {};
  if (!p.notizen)     p.notizen     = "";
  if (!p.talent)      p.talent      = "";
  if (!p.sessionBadge) p.sessionBadge = "";
  if (!p.gesamtbewertungSession) p.gesamtbewertungSession = 0;
  return p;
}

function fbStatusAnzeigen(text, farbe) {
  var el = document.getElementById('fb-status');
  if (el) { el.textContent = text; el.style.color = farbe || '#9ca3af'; }
}

function initFirebase(onFirstData, onRemoteUpdate) {
  if (typeof FIREBASE_CONFIG === 'undefined' || !FIREBASE_CONFIG) {
    fbStatusAnzeigen('💾 Lokaler Modus', '#9ca3af');
    return false;
  }
  try {
    if (typeof firebase === 'undefined') {
      fbStatusAnzeigen('❌ Firebase SDK fehlt', '#f87171');
      return false;
    }
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    _fbDb = firebase.database();
    fbStatusAnzeigen('⏳ Verbinde...', '#fbbf24');
    var firstLoad = true;
    _fbDb.ref('spieler').on('value', function(snapshot) {
      var data = snapshot.val();
      var liste = data ? Object.values(data).map(normalisiereSpieler) : [];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(liste));
      fbStatusAnzeigen('🟢 Online · ' + liste.length + ' Spieler', '#4ade80');
      if (firstLoad) {
        firstLoad = false;
        onFirstData(liste);
      } else if (!_fbSuppressUpdate) {
        onRemoteUpdate(liste);
      }
    }, function(error) {
      console.error('Firebase Verbindungsfehler:', error);
      fbStatusAnzeigen('❌ ' + (error.code || 'Verbindungsfehler'), '#f87171');
      if (firstLoad) {
        firstLoad = false;
        onFirstData(ladeSpieler());
      }
    });
    return true;
  } catch (e) {
    console.error('Firebase Init fehlgeschlagen:', e);
    fbStatusAnzeigen('❌ Init-Fehler: ' + e.message, '#f87171');
    return false;
  }
}

function speichereFirebase(spieler) {
  if (!_fbDb || !spieler) return;
  _fbSuppressUpdate = true;
  var obj = {};
  spieler.forEach(function(p) { obj[p.id] = p; });
  // update() statt set(): merged nur geänderte Spieler, überschreibt nicht
  // Einträge anderer Geräte die wir lokal nicht haben
  _fbDb.ref('spieler').update(obj)
    .then(function() { setTimeout(function() { _fbSuppressUpdate = false; }, 1500); })
    .catch(function(e) { _fbSuppressUpdate = false; console.error('Firebase Schreibfehler:', e); });
}

function loescheFirebaseEintrag(id) {
  if (!_fbDb || !id) return;
  _fbDb.ref('spieler/' + id).remove()
    .catch(function(e) { console.error('Firebase Lösch-Fehler:', e); });
}

function speichereBenutzerFirebase(benutzer) {
  if (!_fbDb || !benutzer) return;
  var obj = {};
  benutzer.forEach(function(u) { obj[u.nutzername] = u; });
  _fbDb.ref('benutzer').update(obj)
    .catch(function(e) { console.error('Firebase Benutzer Schreibfehler:', e); });
}

function ladeBenutzerFirebase(callback) {
  if (!_fbDb) { callback(null); return; }
  _fbDb.ref('benutzer').once('value', function(snapshot) {
    var data = snapshot.val();
    if (!data) { callback(null); return; }
    var benutzer = Object.values(data);
    callback(benutzer);
  }).catch(function(e) { console.error('Firebase Benutzer Lade-Fehler:', e); callback(null); });
}

function speichereBerechtigungenFirebase(berechtigungen) {
  if (!_fbDb || !berechtigungen) return;
  _fbDb.ref('berechtigungen').update(berechtigungen)
    .catch(function(e) { console.error('Firebase Berechtigungen Schreibfehler:', e); });
}
