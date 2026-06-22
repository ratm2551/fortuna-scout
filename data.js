// Fortuna Talent Scout Dashboard – Datenmodell & Demodaten
// Persistenz über localStorage, Demodaten als Ausgangsbasis.

const POSITIONEN = ["Torwart", "Innenverteidiger", "Außenverteidiger", "Sechser", "Achter", "Zehner", "Flügelspieler", "Stürmer"];

const POOL_LISTEN = {
  beobachten: { titel: "Beobachten", desc: "Interessante Spieler – weiter beobachten, mehr Daten notwendig" },
  probetraining: { titel: "Probetraining", desc: "Einladung empfohlen" },
  verpflichtung: { titel: "Verpflichtung empfohlen", desc: "Höchste Priorität" },
  archiv: { titel: "Archiv", desc: "Nicht weiter verfolgen" },
};

const TRIAL_STATUS = ["Keine", "Einladung versendet", "Teilnahme bestätigt", "Teilnahme erfolgt", "Entscheidung offen"];

const RATING_MODELL = {
  technik: {
    titel: "Technische Fähigkeiten",
    attribute: { ballannahme: "Ballannahme", passspiel: "Passspiel", dribbling: "Dribbling", torabschluss: "Torabschluss", flanken: "Flanken", kopfball: "Kopfballspiel" },
  },
  taktik: {
    titel: "Taktische Fähigkeiten",
    attribute: { spielverstaendnis: "Spielverständnis", positionierung: "Positionierung", entscheidungen: "Entscheidungsverhalten", antizipation: "Antizipation", pressing: "Pressingverhalten" },
  },
  athletik: {
    titel: "Athletik",
    attribute: { schnelligkeit: "Schnelligkeit", antritt: "Antritt", ausdauer: "Ausdauer", beweglichkeit: "Beweglichkeit", robustheit: "Robustheit" },
  },
  mentalitaet: {
    titel: "Mentalität",
    attribute: { lernbereitschaft: "Lernbereitschaft", disziplin: "Disziplin", teamfaehigkeit: "Teamfähigkeit", wettbewerb: "Wettbewerbsmentalität", fuehrung: "Führungsverhalten" },
  },
  potenzial: {
    titel: "Potenzial",
    attribute: { aktuellesNiveau: "Aktuelles Niveau", potenzialniveau: "Potenzialniveau", entwicklung: "Entwicklungsfähigkeit" },
  },
};

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
  localStorage.setItem(STORAGE_KEY, "[]");
  return [];
}

function speichereSpieler(spieler) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(spieler));
}

function resetDemodaten() {
  const kopie = JSON.parse(JSON.stringify(DEMO_SPIELER));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(kopie));
  speichereFirebase(kopie);
}

// ── Firebase Realtime Database ──────────────────────────────────────────────
var _fbDb = null;
var _fbSuppressUpdate = false;

function initFirebase(onFirstData, onRemoteUpdate) {
  if (!window.FIREBASE_CONFIG) return false;
  try {
    if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
    _fbDb = firebase.database();
    var firstLoad = true;
    _fbDb.ref('spieler').on('value', function(snapshot) {
      var data = snapshot.val();
      var liste = data ? Object.values(data) : [];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(liste));
      if (firstLoad) {
        firstLoad = false;
        onFirstData(liste);
      } else if (!_fbSuppressUpdate) {
        onRemoteUpdate(liste);
      }
    }, function(error) {
      console.error('Firebase Verbindungsfehler:', error);
      if (firstLoad) {
        firstLoad = false;
        onFirstData(ladeSpieler());
      }
    });
    return true;
  } catch (e) {
    console.error('Firebase Init fehlgeschlagen:', e);
    return false;
  }
}

function speichereFirebase(spieler) {
  if (!_fbDb || !spieler) return;
  _fbSuppressUpdate = true;
  var obj = {};
  spieler.forEach(function(p) { obj[p.id] = p; });
  _fbDb.ref('spieler').set(obj)
    .then(function() { setTimeout(function() { _fbSuppressUpdate = false; }, 1500); })
    .catch(function(e) { _fbSuppressUpdate = false; console.error('Firebase Schreibfehler:', e); });
}
