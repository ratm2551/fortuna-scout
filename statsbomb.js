// StatsBomb Open Data Integration
// Basis-URL: raw.githubusercontent.com/statsbomb/open-data/master/data
"use strict";

const SB_BASE = "https://raw.githubusercontent.com/statsbomb/open-data/master/data";

// Bundesliga 2023/24
const SB_COMPETITION_ID = 9;
const SB_SEASON_ID = 281;

// Auswahl representativer Matches für schnellen Import (5-0 Leverkusen, etc.)
const SB_SAMPLE_MATCHES = [
  3895302, // Leverkusen 5-0 Werder
  3895292, // Union Berlin 0-1 Leverkusen
  3895107, // Leverkusen 3-0 Köln
  3895158, // Leverkusen 1-1 Dortmund
  3895220, // Darmstadt 0-2 Leverkusen
  3895250, // Leverkusen 2-1 Mainz
  3895266, // Leverkusen 2-0 Wolfsburg
];

const SB_CACHE_KEY = "statsbomb-bundesliga-v3";

// Position-Mapping: StatsBomb → Fortuna-Positionen
const SB_POS_MAP = {
  "Goalkeeper": "Torwart",
  "Right Back": "Außenverteidiger",
  "Left Back": "Außenverteidiger",
  "Right Center Back": "Innenverteidiger",
  "Left Center Back": "Innenverteidiger",
  "Center Back": "Innenverteidiger",
  "Right Wing Back": "Außenverteidiger",
  "Left Wing Back": "Außenverteidiger",
  "Right Defensive Midfield": "Sechser",
  "Left Defensive Midfield": "Sechser",
  "Center Defensive Midfield": "Sechser",
  "Right Center Midfield": "Achter",
  "Left Center Midfield": "Achter",
  "Center Midfield": "Achter",
  "Right Attacking Midfield": "Zehner",
  "Left Attacking Midfield": "Zehner",
  "Center Attacking Midfield": "Zehner",
  "Right Midfield": "Flügelspieler",
  "Left Midfield": "Flügelspieler",
  "Right Wing": "Flügelspieler",
  "Left Wing": "Flügelspieler",
  "Right Center Forward": "Stürmer",
  "Left Center Forward": "Stürmer",
  "Center Forward": "Stürmer",
  "Secondary Striker": "Stürmer",
};

function sbPos(rawPos) {
  if (!rawPos) return "Flügelspieler";
  return SB_POS_MAP[rawPos] || "Achter";
}

async function sbFetch(path) {
  const url = `${SB_BASE}/${path}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);
  return r.json();
}

// Gibt gecachte Spielerliste oder lädt neu
async function sbLadeBundesligaSpieler(onProgress) {
  try {
    const cached = localStorage.getItem(SB_CACHE_KEY);
    if (cached) {
      const obj = JSON.parse(cached);
      if (obj.spieler && obj.matches) return obj;
    }
  } catch (e) { /* Cache defekt → neu laden */ }

  onProgress && onProgress("Lade Bundesliga-Matches…", 0);

  // Alle Matches der Saison
  let allMatches = [];
  try {
    allMatches = await sbFetch(`matches/${SB_COMPETITION_ID}/${SB_SEASON_ID}.json`);
  } catch (e) {
    throw new Error("Bundesliga-Matches konnten nicht geladen werden: " + e.message);
  }

  // Nimm Sample-Matches + fülle bis max 12 auf
  const sampleIds = new Set(SB_SAMPLE_MATCHES);
  const extra = allMatches
    .filter(m => !sampleIds.has(m.match_id))
    .slice(0, 5)
    .map(m => m.match_id);
  const ladeIds = [...SB_SAMPLE_MATCHES, ...extra];

  const spielerMap = {}; // player_id → Spielerprofil
  const matchInfos = [];

  for (let i = 0; i < ladeIds.length; i++) {
    const matchId = ladeIds[i];
    onProgress && onProgress(`Lade Lineup ${i + 1}/${ladeIds.length}…`, Math.round((i / ladeIds.length) * 70));

    let lineup, matchInfo;
    try {
      [lineup, matchInfo] = await Promise.all([
        sbFetch(`lineups/${matchId}.json`),
        Promise.resolve(allMatches.find(m => m.match_id === matchId)),
      ]);
    } catch (e) { continue; }

    if (matchInfo) {
      matchInfos.push({
        id: matchId,
        datum: matchInfo.match_date,
        heim: matchInfo.home_team?.home_team_name,
        gast: matchInfo.away_team?.away_team_name,
        heimTore: matchInfo.home_score,
        gastTore: matchInfo.away_score,
        spieltag: matchInfo.match_week,
      });
    }

    for (const team of lineup) {
      const teamName = team.team_name;
      for (const sp of team.lineup) {
        const pid = sp.player_id;
        const hauptPos = sbPos(sp.positions?.[0]?.position);
        if (!spielerMap[pid]) {
          spielerMap[pid] = {
            sbId: pid,
            name: sp.player_name,
            nickname: sp.player_nickname || null,
            trikot: sp.jersey_number,
            nationalitaet: sp.country?.name || "–",
            teams: new Set([teamName]),
            positionen: new Set([hauptPos]),
            rawPositionen: new Set(sp.positions?.map(p => p.position) || []),
            einsaetze: 1,
          };
        } else {
          spielerMap[pid].teams.add(teamName);
          spielerMap[pid].positionen.add(hauptPos);
          sp.positions?.forEach(p => {
            spielerMap[pid].rawPositionen.add(p.position);
            spielerMap[pid].positionen.add(sbPos(p.position));
          });
          spielerMap[pid].einsaetze++;
        }
      }
    }
  }

  onProgress && onProgress("Lade Tore, xG & Assists…", 75);

  // Echte xG/xA + Tore/Assists/Pässe aus den StatsBomb-Events (statsbomb_xg-Modell, kein Scraping nötig)
  const toreMap = {}, assistsMap = {}, schuesse = {}, xgMap = {}, xaMap = {}, passOkMap = {}, passGesamtMap = {};
  for (let i = 0; i < ladeIds.length; i++) {
    const matchId = ladeIds[i];
    onProgress && onProgress(`Lade xG/xA Match ${i + 1}/${ladeIds.length}…`, 75 + Math.round((i / ladeIds.length) * 20));
    try {
      const events = await sbFetch(`events/${matchId}.json`);
      for (const ev of events) {
        const pid = ev.player?.id;
        if (!pid) continue;

        if (ev.type?.name === "Shot") {
          schuesse[pid] = (schuesse[pid] || 0) + 1;
          xgMap[pid] = (xgMap[pid] || 0) + (ev.shot?.statsbomb_xg || 0);
          if (ev.shot?.outcome?.name === "Goal" && ev.shot?.type?.name !== "Penalty") {
            toreMap[pid] = (toreMap[pid] || 0) + 1;
          }
        }
        if (ev.type?.name === "Pass") {
          passGesamtMap[pid] = (passGesamtMap[pid] || 0) + 1;
          if (!ev.pass?.outcome) passOkMap[pid] = (passOkMap[pid] || 0) + 1; // kein outcome = erfolgreich
          if (ev.pass?.goal_assist) assistsMap[pid] = (assistsMap[pid] || 0) + 1;
        }
      }
      // xA: StatsBomb verlinkt den Schlüsselpass direkt über pass.assisted_shot_id mit dem Schuss
      const eventsById = new Map(events.map(e => [e.id, e]));
      for (const ev of events) {
        if (ev.type?.name === "Pass" && ev.pass?.assisted_shot_id && ev.player?.id) {
          const shotEv = eventsById.get(ev.pass.assisted_shot_id);
          if (shotEv?.type?.name === "Shot") {
            xaMap[ev.player.id] = (xaMap[ev.player.id] || 0) + (shotEv.shot?.statsbomb_xg || 0);
          }
        }
      }
    } catch (e) { /* ignorieren */ }
  }

  onProgress && onProgress("Verarbeite Daten…", 96);

  const spieler = Object.values(spielerMap).map(sp => {
    const passGesamt = passGesamtMap[sp.sbId] || 0;
    const passOk = passOkMap[sp.sbId] || 0;
    return {
      sbId: sp.sbId,
      name: sp.name,
      nickname: sp.nickname,
      trikot: sp.trikot,
      nationalitaet: sp.nationalitaet,
      teams: [...sp.teams],
      hauptposition: [...sp.positionen][0] || "Flügelspieler",
      positionen: [...sp.positionen],
      rawPositionen: [...sp.rawPositionen],
      einsaetze: sp.einsaetze,
      tore: toreMap[sp.sbId] || 0,
      assists: assistsMap[sp.sbId] || 0,
      schuesse: schuesse[sp.sbId] || 0,
      xg: Math.round((xgMap[sp.sbId] || 0) * 100) / 100,
      xa: Math.round((xaMap[sp.sbId] || 0) * 100) / 100,
      passQuote: passGesamt ? Math.round((passOk / passGesamt) * 100) : null,
      passeGesamt: passGesamt,
      marktwert: null,
      vertragsende: "",
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const ergebnis = { spieler, matches: matchInfos, geladen: new Date().toISOString() };
  localStorage.setItem(SB_CACHE_KEY, JSON.stringify(ergebnis));
  onProgress && onProgress("Fertig!", 100);
  return ergebnis;
}

function sbCacheLeeren() {
  localStorage.removeItem(SB_CACHE_KEY);
}

function sbCacheVorhanden() {
  return !!localStorage.getItem(SB_CACHE_KEY);
}
