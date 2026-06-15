// Fortuna Talent Scout Dashboard – Prototyp-Logik
"use strict";

let SPIELER = ladeSpieler();
const HEUTE = new Date();

// ---------- Helfer ----------
const $ = (sel, root = document) => root.querySelector(sel);
const main = $("#main");

function speichern() { speichereSpieler(SPIELER); }
function findSpieler(id) { return SPIELER.find(p => p.id === id); }
function jahrgang(p) { return p.geburtsdatum ? p.geburtsdatum.slice(0, 4) : "–"; }
function alter(p) {
  if (!p.geburtsdatum) return "–";
  const g = new Date(p.geburtsdatum);
  let a = HEUTE.getFullYear() - g.getFullYear();
  if (HEUTE < new Date(HEUTE.getFullYear(), g.getMonth(), g.getDate())) a--;
  return a;
}
function initialen(p) { return (p.vorname[0] || "") + (p.nachname[0] || ""); }
function fmtDatum(iso) {
  if (!iso) return "–";
  const [j, m, t] = iso.split("-");
  return `${t}.${m}.${j}`;
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- Scores ----------
function gruppenSchnitt(p, gruppe) {
  const keys = Object.keys(RATING_MODELL[gruppe].attribute);
  const sum = keys.reduce((s, k) => s + (p.ratings[k] || 0), 0);
  return sum / keys.length;
}
function gesamtScore(p) {
  const g = ["technik", "taktik", "athletik", "mentalitaet"].map(x => gruppenSchnitt(p, x));
  return Math.round((g.reduce((a, b) => a + b, 0) / g.length) * 10);
}
function potenzialScore(p) { return Math.round(gruppenSchnitt(p, "potenzial") * 10); }
function fortunaFit(p) {
  // Gewichtung: Mentalität & Entwicklungsfähigkeit im Fokus der Fortuna-Philosophie
  const fit = gruppenSchnitt(p, "mentalitaet") * 0.3
    + (p.ratings.entwicklung || 0) * 0.25
    + gruppenSchnitt(p, "athletik") * 0.2
    + gruppenSchnitt(p, "taktik") * 0.25;
  return Math.round(fit * 10);
}
function scorePill(wert) {
  const cls = wert >= 75 ? "score-hoch" : wert >= 55 ? "score-mittel" : "score-niedrig";
  return `<span class="score-pill ${cls}">${wert}</span>`;
}

// ---------- Routing ----------
function route() {
  const hash = location.hash.replace(/^#\//, "") || "dashboard";
  const [seite, param] = hash.split("/");
  document.querySelectorAll("#nav a").forEach(a => {
    a.classList.toggle("active", a.dataset.route === seite);
  });
  const views = {
    dashboard: viewDashboard,
    spieler: () => (param ? viewSpielerDetail(param) : viewSpielerListe()),
    talentpool: viewTalentpool,
    vergleich: viewVergleich,
    probetraining: viewProbetraining,
    bundesliga: viewBundesliga,
  };
  (views[seite] || viewDashboard)();
  main.scrollTop = 0;
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);

// ---------- Dashboard ----------
function viewDashboard() {
  const neue30 = SPIELER.filter(p => (HEUTE - new Date(p.erstelltAm)) / 86400000 <= 30).length;
  const offen = SPIELER.filter(p => p.pool === "beobachten").length;
  const hohesPotenzial = SPIELER.filter(p => potenzialScore(p) >= 80).length;
  const probeEmpf = SPIELER.filter(p => p.pool === "probetraining").length;
  const vertrag12 = SPIELER.filter(p => {
    if (!p.vertragsende) return false;
    const ende = new Date(p.vertragsende);
    const diff = (ende - HEUTE) / 86400000;
    return diff >= 0 && diff <= 365;
  }).length;

  // Talentwarnungen (KI-Hinweise, Prototyp: regelbasiert)
  const warnungen = [];
  for (const p of SPIELER) {
    if (p.pool === "archiv") continue;
    const letzter = p.berichte.length ? p.berichte.map(b => b.datum).sort().at(-1) : null;
    if (!letzter) {
      warnungen.push({ cls: "", text: `<span class="link" onclick="location.hash='#/spieler/${p.id}'">${esc(p.vorname)} ${esc(p.nachname)}</span> wurde noch nie gesichtet – Beobachtung planen.` });
    } else if ((HEUTE - new Date(letzter)) / 86400000 > 45) {
      warnungen.push({ cls: "", text: `<span class="link" onclick="location.hash='#/spieler/${p.id}'">${esc(p.vorname)} ${esc(p.nachname)}</span> seit ${fmtDatum(letzter)} nicht mehr beobachtet.` });
    }
    if (potenzialScore(p) >= 85 && p.pool === "beobachten") {
      warnungen.push({ cls: "gruen", text: `<span class="link" onclick="location.hash='#/spieler/${p.id}'">${esc(p.vorname)} ${esc(p.nachname)}</span>: Potenzial-Score ${potenzialScore(p)} – Probetraining empfohlen.` });
    }
  }

  const letzteBerichte = SPIELER.flatMap(p => p.berichte.map(b => ({ p, b })))
    .sort((a, b) => b.b.datum.localeCompare(a.b.datum)).slice(0, 5);

  main.innerHTML = `
    <div class="page-header">
      <div><h1>Dashboard</h1><div class="sub">Überblick Talentidentifikation · ${HEUTE.toLocaleDateString("de-DE")}</div></div>
      <div class="quick-actions">
        <button class="btn" onclick="modalNeuerSpieler()">+ Neuer Spieler</button>
        <button class="btn btn-secondary" onclick="location.hash='#/vergleich'">Spielervergleich</button>
        <button class="btn btn-secondary" onclick="location.hash='#/talentpool'">Talentpool öffnen</button>
      </div>
    </div>
    <div class="kpi-grid">
      ${kpi(SPIELER.length, "Spieler im System", "#/spieler")}
      ${kpi(neue30, "Neue Spieler (30 Tage)", "#/spieler")}
      ${kpi(offen, "Beobachtungen offen", "#/talentpool")}
      ${kpi(hohesPotenzial, "Hohes Potenzial (≥80)", "#/spieler")}
      ${kpi(probeEmpf, "Probetraining empfohlen", "#/probetraining")}
      ${kpi(vertrag12, "Vertragsende ≤ 12 Monate", "#/spieler")}
    </div>
    <div class="grid-2">
      <div class="card">
        <h3>🔔 Talentwarnungen</h3>
        ${warnungen.length ? warnungen.map(w => `<div class="warnung ${w.cls}">${w.text}</div>`).join("") : `<div class="empty">Keine offenen Hinweise.</div>`}
      </div>
      <div class="card">
        <h3>📝 Letzte Scoutingberichte</h3>
        ${letzteBerichte.length ? `<table><thead><tr><th>Datum</th><th>Spieler</th><th>Gegner</th><th>Beobachter</th></tr></thead><tbody>
          ${letzteBerichte.map(({ p, b }) => `<tr onclick="location.hash='#/spieler/${p.id}'">
            <td>${fmtDatum(b.datum)}</td><td><strong>${esc(p.vorname)} ${esc(p.nachname)}</strong></td>
            <td>${esc(b.gegner)}</td><td>${esc(b.beobachter)}</td></tr>`).join("")}
        </tbody></table>` : `<div class="empty">Noch keine Berichte.</div>`}
      </div>
    </div>
    <div class="card mt">
      <h3>🏆 Top-Talente nach Potenzial</h3>
      ${spielerTabelle(SPIELER.filter(p => p.pool !== "archiv").sort((a, b) => potenzialScore(b) - potenzialScore(a)).slice(0, 5))}
    </div>`;
}
function kpi(wert, label, ziel) {
  return `<div class="kpi" onclick="location.hash='${ziel}'"><div class="kpi-value">${wert}</div><div class="kpi-label">${label}</div></div>`;
}

// ---------- Spielerliste ----------
let filter = { suche: "", position: "", jahrgang: "", verein: "", minGesamt: "", minPotenzial: "" };

function viewSpielerListe() {
  const jahrgaenge = [...new Set(SPIELER.map(jahrgang))].sort().reverse();
  const vereine = [...new Set(SPIELER.map(p => p.verein))].sort();

  main.innerHTML = `
    <div class="page-header">
      <div><h1>Spielerdatenbank</h1><div class="sub">${SPIELER.length} Spieler erfasst</div></div>
      <button class="btn" onclick="modalNeuerSpieler()">+ Neuer Spieler</button>
    </div>
    <div class="card mb">
      <div class="filters">
        <div class="field" style="flex:1;min-width:200px"><label>Suche</label>
          <input id="f-suche" placeholder="Name, Verein…" value="${esc(filter.suche)}"></div>
        <div class="field"><label>Position</label>
          <select id="f-position"><option value="">Alle</option>${POSITIONEN.map(p => `<option ${filter.position === p ? "selected" : ""}>${p}</option>`).join("")}</select></div>
        <div class="field"><label>Jahrgang</label>
          <select id="f-jahrgang"><option value="">Alle</option>${jahrgaenge.map(j => `<option ${filter.jahrgang === j ? "selected" : ""}>${j}</option>`).join("")}</select></div>
        <div class="field"><label>Verein</label>
          <select id="f-verein"><option value="">Alle</option>${vereine.map(v => `<option ${filter.verein === v ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></div>
        <div class="field"><label>Min. Gesamt</label>
          <input id="f-gesamt" type="number" min="0" max="100" style="width:90px" value="${filter.minGesamt}"></div>
        <div class="field"><label>Min. Potenzial</label>
          <input id="f-potenzial" type="number" min="0" max="100" style="width:90px" value="${filter.minPotenzial}"></div>
        <button class="btn btn-secondary btn-sm" id="f-reset">Zurücksetzen</button>
      </div>
      <div id="spieler-tabelle"></div>
    </div>`;

  const render = () => { $("#spieler-tabelle").innerHTML = spielerTabelle(gefilterteSpieler()); };
  for (const [id, key] of [["#f-suche", "suche"], ["#f-position", "position"], ["#f-jahrgang", "jahrgang"], ["#f-verein", "verein"], ["#f-gesamt", "minGesamt"], ["#f-potenzial", "minPotenzial"]]) {
    $(id).addEventListener("input", e => { filter[key] = e.target.value; render(); });
  }
  $("#f-reset").addEventListener("click", () => { filter = { suche: "", position: "", jahrgang: "", verein: "", minGesamt: "", minPotenzial: "" }; viewSpielerListe(); });
  render();
}

function gefilterteSpieler() {
  return SPIELER.filter(p => {
    const s = filter.suche.toLowerCase();
    if (s && !`${p.vorname} ${p.nachname} ${p.verein}`.toLowerCase().includes(s)) return false;
    if (filter.position && p.hauptposition !== filter.position && !p.nebenpositionen.includes(filter.position)) return false;
    if (filter.jahrgang && jahrgang(p) !== filter.jahrgang) return false;
    if (filter.verein && p.verein !== filter.verein) return false;
    if (filter.minGesamt && gesamtScore(p) < +filter.minGesamt) return false;
    if (filter.minPotenzial && potenzialScore(p) < +filter.minPotenzial) return false;
    return true;
  }).sort((a, b) => gesamtScore(b) - gesamtScore(a));
}

function spielerTabelle(liste) {
  if (!liste.length) return `<div class="empty">Keine Spieler gefunden.</div>`;
  return `<table><thead><tr>
    <th>Spieler</th><th>Jahrgang</th><th>Position</th><th>Verein</th><th>Pool</th>
    <th>Gesamt</th><th>Potenzial</th><th>Fortuna-Fit</th></tr></thead><tbody>
    ${liste.map(p => `<tr onclick="location.hash='#/spieler/${p.id}'">
      <td><strong>${esc(p.vorname)} ${esc(p.nachname)}</strong></td>
      <td>${jahrgang(p)} (${alter(p)} J.)</td>
      <td>${esc(p.hauptposition)}</td>
      <td>${esc(p.verein)}</td>
      <td><span class="badge ${poolBadge(p.pool)}">${POOL_LISTEN[p.pool].titel}</span></td>
      <td>${scorePill(gesamtScore(p))}</td>
      <td>${scorePill(potenzialScore(p))}</td>
      <td>${scorePill(fortunaFit(p))}</td>
    </tr>`).join("")}
  </tbody></table>`;
}
function poolBadge(pool) {
  return { beobachten: "badge-gelb", probetraining: "badge-rot", verpflichtung: "badge-gruen", archiv: "badge-grau" }[pool] || "badge-grau";
}

// ---------- Spielerdetail ----------
let aktiverTab = "profil";

function viewSpielerDetail(id, tab) {
  const p = findSpieler(id);
  if (!p) { main.innerHTML = `<div class="empty">Spieler nicht gefunden.</div>`; return; }
  if (tab) aktiverTab = tab;

  main.innerHTML = `
    <div class="mb"><a class="link" href="#/spieler">← Zur Spielerdatenbank</a></div>
    <div class="player-head">
      <div class="avatar">${esc(initialen(p))}</div>
      <div>
        <h1>${esc(p.vorname)} ${esc(p.nachname)}</h1>
        <div class="player-meta">${esc(p.hauptposition)} · Jahrgang ${jahrgang(p)} (${alter(p)} Jahre) · ${esc(p.verein)} · ${esc(p.liga)}</div>
        <div class="player-meta mt" style="margin-top:6px">
          Pool: <select onchange="setPool('${p.id}', this.value)" style="padding:4px 6px;border-radius:6px;border:1px solid var(--border)">
            ${Object.entries(POOL_LISTEN).map(([k, v]) => `<option value="${k}" ${p.pool === k ? "selected" : ""}>${v.titel}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="scores-row">
        <div class="score-box"><div class="val" style="color:var(--rot)">${gesamtScore(p)}</div><div class="lbl">Gesamt</div></div>
        <div class="score-box"><div class="val" style="color:var(--gruen)">${potenzialScore(p)}</div><div class="lbl">Potenzial</div></div>
        <div class="score-box"><div class="val">${fortunaFit(p)}</div><div class="lbl">Fortuna-Fit</div></div>
      </div>
    </div>
    <div class="tabs">
      ${[["profil", "Profil"], ["bewertung", "Bewertung"], ["berichte", `Berichte (${p.berichte.length})`], ["videos", `Videos (${p.videos.length})`], ["entwicklung", "Entwicklungsmonitor"]]
      .map(([k, t]) => `<button class="${aktiverTab === k ? "active" : ""}" onclick="viewSpielerDetail('${p.id}','${k}')">${t}</button>`).join("")}
    </div>
    <div id="tab-inhalt"></div>`;

  const inhalt = $("#tab-inhalt");
  if (aktiverTab === "profil") inhalt.innerHTML = tabProfil(p);
  else if (aktiverTab === "bewertung") { inhalt.innerHTML = tabBewertung(p); bindRatings(p); }
  else if (aktiverTab === "berichte") inhalt.innerHTML = tabBerichte(p);
  else if (aktiverTab === "videos") inhalt.innerHTML = tabVideos(p);
  else if (aktiverTab === "entwicklung") inhalt.innerHTML = tabEntwicklung(p);
}
window.viewSpielerDetail = viewSpielerDetail;

function setPool(id, pool) { findSpieler(id).pool = pool; speichern(); route(); }
window.setPool = setPool;

function tabProfil(p) {
  const zeile = (l, w) => `<tr><th style="width:180px">${l}</th><td>${w}</td></tr>`;
  return `<div class="grid-2">
    <div class="card"><h3>Stammdaten</h3><table><tbody>
      ${zeile("Geburtsdatum", `${fmtDatum(p.geburtsdatum)} (${alter(p)} Jahre)`)}
      ${zeile("Nationalität", esc(p.nationalitaet))}
      ${zeile("Größe / Gewicht", `${p.groesse} cm / ${p.gewicht} kg`)}
      ${zeile("Starker Fuß", esc(p.starkerFuss))}
      ${zeile("Schwacher Fuß", `<span class="stars">${"★".repeat(p.schwacherFuss)}${"☆".repeat(5 - p.schwacherFuss)}</span>`)}
      ${zeile("Hauptposition", esc(p.hauptposition))}
      ${zeile("Nebenpositionen", p.nebenpositionen.length ? p.nebenpositionen.map(n => `<span class="tag">${esc(n)}</span>`).join("") : "–")}
    </tbody></table></div>
    <div class="card"><h3>Verein & Vertrag</h3><table><tbody>
      ${zeile("Verein", esc(p.verein))}
      ${zeile("Liga", esc(p.liga))}
      ${zeile("Verband", esc(p.verband))}
      ${zeile("Vertragsstatus", esc(p.vertragsstatus || "–"))}
      ${zeile("Vertragsende", fmtDatum(p.vertragsende))}
      ${zeile("Berater", esc(p.berater || "–"))}
      ${zeile("Kontakt", esc(p.kontakt || "–"))}
      ${zeile("Probetraining", `${esc(p.trialStatus)}${p.trialUrteil ? ` · Urteil: <strong>${esc(p.trialUrteil)}</strong>` : ""}`)}
    </tbody></table></div>
  </div>
  <div class="card mt"><h3>🤖 KI-Kurzprofil (Prototyp)</h3><p style="font-size:13.5px;line-height:1.6">${kiKurzprofil(p)}</p></div>`;
}

function kiKurzprofil(p) {
  const g = gesamtScore(p), pot = potenzialScore(p), fit = fortunaFit(p);
  const staerken = topAttribute(p, 3).map(a => a.label).join(", ");
  const schwaechen = topAttribute(p, 3, true).map(a => a.label).join(", ");
  return `${esc(p.vorname)} ${esc(p.nachname)} (Jahrgang ${jahrgang(p)}) ist ${esc(p.hauptposition)} bei ${esc(p.verein)}. ` +
    `Mit einem Gesamt-Score von <strong>${g}</strong> und einem Potenzial-Score von <strong>${pot}</strong> ` +
    `${pot >= 80 ? "zählt er zu den auffälligsten Talenten im System" : pot >= 65 ? "zeigt er eine solide Entwicklungsperspektive" : "liegt er aktuell im Durchschnittsbereich"}. ` +
    `Auffälligste Stärken: ${staerken}. Entwicklungsfelder: ${schwaechen}. ` +
    `Der Fortuna-Fit-Score von <strong>${fit}</strong> ${fit >= 75 ? "spricht klar für eine intensivere Verfolgung." : fit >= 60 ? "rechtfertigt weitere Beobachtungen." : "mahnt zu realistischer Einordnung."}`;
}

function topAttribute(p, n, schwaechste = false) {
  const alle = [];
  for (const grp of Object.values(RATING_MODELL)) {
    if (grp === RATING_MODELL.potenzial) continue;
    for (const [k, label] of Object.entries(grp.attribute)) alle.push({ key: k, label, wert: p.ratings[k] || 0 });
  }
  alle.sort((a, b) => schwaechste ? a.wert - b.wert : b.wert - a.wert);
  return alle.slice(0, n);
}

function tabBewertung(p) {
  return `<div class="card">
    <div class="flex-between mb"><h3 style="margin:0">Bewertungsmodell (1–10)</h3>
      <span style="font-size:12.5px;color:var(--muted)">Änderungen werden sofort gespeichert, Scores aktualisieren sich automatisch.</span></div>
    <div class="grid-2">
      ${Object.entries(RATING_MODELL).map(([gk, grp]) => `
        <div class="rating-group">
          <h4>${grp.titel} · Ø ${gruppenSchnitt(p, gk).toFixed(1)}</h4>
          ${Object.entries(grp.attribute).map(([k, label]) => `
            <div class="rating-row">
              <label>${label}</label>
              <input type="range" min="1" max="10" value="${p.ratings[k] || 5}" data-rating="${k}">
              <span class="rating-val" id="val-${k}">${p.ratings[k] || 5}</span>
            </div>`).join("")}
        </div>`).join("")}
    </div>
  </div>`;
}

function bindRatings(p) {
  document.querySelectorAll("[data-rating]").forEach(input => {
    input.addEventListener("input", e => {
      const k = e.target.dataset.rating;
      p.ratings[k] = +e.target.value;
      $(`#val-${k}`).textContent = e.target.value;
      speichern();
    });
    input.addEventListener("change", () => viewSpielerDetail(p.id, "bewertung"));
  });
}

function tabBerichte(p) {
  return `<div class="flex-between mb">
    <h3 style="margin:0">Scoutingberichte</h3>
    <button class="btn btn-sm" onclick="modalNeuerBericht('${p.id}')">+ Neue Sichtung</button>
  </div>
  ${p.berichte.length ? [...p.berichte].sort((a, b) => b.datum.localeCompare(a.datum)).map(b => `
    <div class="report">
      <div class="report-head">
        <strong>${fmtDatum(b.datum)} · vs. ${esc(b.gegner)}</strong>
        <span style="color:var(--muted)">${esc(b.wettbewerb)} · ${esc(b.spielort)} · ${esc(b.wetter)} · Beobachter: ${esc(b.beobachter)}</span>
      </div>
      ${REPORT_SECTIONS.filter(s => b.abschnitte[s]).map(s => `
        <div class="report-section"><div class="rs-label">${s}</div><p>${esc(b.abschnitte[s])}</p></div>`).join("")}
    </div>`).join("") : `<div class="card"><div class="empty">Noch keine Berichte – Spieler wurde noch nicht gesichtet.</div></div>`}`;
}

function tabVideos(p) {
  return `<div class="flex-between mb">
    <h3 style="margin:0">Video-Modul</h3>
    <button class="btn btn-sm" onclick="modalNeuesVideo('${p.id}')">+ Video verlinken</button>
  </div>
  ${p.videos.length ? `<div class="grid-3">${p.videos.map(v => `
    <div class="card">
      <h3>🎬 ${esc(v.titel)}</h3>
      <div style="font-size:12.5px;color:var(--muted);word-break:break-all">${esc(v.url)}</div>
      <div class="mt">${v.tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>
    </div>`).join("")}</div>` : `<div class="card"><div class="empty">Keine Videos hinterlegt.</div></div>`}`;
}

function tabEntwicklung(p) {
  return `<div class="flex-between mb">
    <h3 style="margin:0">Entwicklungsmonitor</h3>
    <button class="btn btn-sm" onclick="modalNeuerEintrag('${p.id}')">+ Eintrag</button>
  </div>
  ${p.entwicklung.length ? [...p.entwicklung].sort((a, b) => b.datum.localeCompare(a.datum)).map(e => `
    <div class="report">
      <div class="report-head"><strong>${fmtDatum(e.datum)}</strong></div>
      <div class="report-section"><div class="rs-label">Zielsetzung</div><p>${esc(e.ziel)}</p></div>
      <div class="report-section"><div class="rs-label">Trainingsschwerpunkte</div><p>${esc(e.schwerpunkte)}</p></div>
      <div class="report-section"><div class="rs-label">Fortschritte</div><p>${esc(e.fortschritt)}</p></div>
      <div class="report-section"><div class="rs-label">Trainerfeedback</div><p>${esc(e.feedback)}</p></div>
    </div>`).join("") : `<div class="card"><div class="empty">Spieler ist nicht im Fördertraining bzw. es liegen keine Einträge vor.</div></div>`}`;
}

// ---------- Talentpool ----------
function viewTalentpool() {
  main.innerHTML = `
    <div class="page-header"><div><h1>Talentpool-Management</h1>
      <div class="sub">Spieler per Auswahl zwischen den Listen verschieben</div></div></div>
    <div class="kanban">
      ${Object.entries(POOL_LISTEN).map(([key, liste]) => {
        const spieler = SPIELER.filter(p => p.pool === key).sort((a, b) => potenzialScore(b) - potenzialScore(a));
        return `<div class="kanban-col">
          <h3>${liste.titel} <span class="badge badge-grau">${spieler.length}</span></h3>
          <div class="col-desc">${liste.desc}</div>
          ${spieler.map(p => `<div class="kanban-card">
            <div class="kc-name" onclick="location.hash='#/spieler/${p.id}'">${esc(p.vorname)} ${esc(p.nachname)}</div>
            <div class="kc-meta">${esc(p.hauptposition)} · ${jahrgang(p)} · Potenzial ${potenzialScore(p)}</div>
            <select onchange="setPool('${p.id}', this.value)">
              ${Object.entries(POOL_LISTEN).map(([k, v]) => `<option value="${k}" ${k === key ? "selected" : ""}>${v.titel}</option>`).join("")}
            </select>
          </div>`).join("") || `<div class="empty">Leer</div>`}
        </div>`;
      }).join("")}
    </div>`;
}

// ---------- Spielervergleich ----------
let vergleichAuswahl = [];
const VERGLEICH_FARBEN = ["#d31920", "#1a5fb4", "#1a9c4b"];

function viewVergleich() {
  if (!vergleichAuswahl.length) {
    vergleichAuswahl = SPIELER.slice(0, 2).map(p => p.id);
  }
  const optionen = sel => SPIELER.map(p =>
    `<option value="${p.id}" ${sel === p.id ? "selected" : ""}>${esc(p.vorname)} ${esc(p.nachname)} (${esc(p.hauptposition)}, ${jahrgang(p)})</option>`).join("");

  main.innerHTML = `
    <div class="page-header"><div><h1>Spielervergleich</h1>
      <div class="sub">Bis zu drei Spieler im direkten Vergleich</div></div></div>
    <div class="card mb">
      <div class="compare-picker">
        ${[0, 1, 2].map(i => `<div class="field"><label>Spieler ${i + 1}${i === 2 ? " (optional)" : ""}</label>
          <select data-vgl="${i}">
            ${i === 2 ? `<option value="">– keiner –</option>` : ""}
            ${optionen(vergleichAuswahl[i])}
          </select></div>`).join("")}
      </div>
      <div id="vergleich-inhalt"></div>
    </div>`;

  document.querySelectorAll("[data-vgl]").forEach(sel => {
    sel.addEventListener("change", () => {
      vergleichAuswahl = [...document.querySelectorAll("[data-vgl]")].map(s => s.value).filter(Boolean);
      renderVergleich();
    });
  });
  renderVergleich();
}

function renderVergleich() {
  const spieler = vergleichAuswahl.map(findSpieler).filter(Boolean);
  if (spieler.length < 2) { $("#vergleich-inhalt").innerHTML = `<div class="empty">Mindestens zwei Spieler wählen.</div>`; return; }

  const achsen = [["technik", "Technik"], ["taktik", "Taktik"], ["athletik", "Athletik"], ["mentalitaet", "Mentalität"], ["potenzial", "Potenzial"]];
  const daten = spieler.map(p => achsen.map(([k]) => gruppenSchnitt(p, k)));

  $("#vergleich-inhalt").innerHTML = `
    <div class="radar-wrap">${radarChart(achsen.map(a => a[1]), daten)}</div>
    <div class="legend">${spieler.map((p, i) =>
      `<span><i style="background:${VERGLEICH_FARBEN[i]}"></i>${esc(p.vorname)} ${esc(p.nachname)}</span>`).join("")}</div>
    <h3 class="mt">Attributvergleich</h3>
    <table class="compare-table"><thead><tr><th>Attribut</th>${spieler.map(p => `<th>${esc(p.nachname)}</th>`).join("")}</tr></thead><tbody>
      ${vergleichZeile("Gesamt-Score", spieler.map(gesamtScore))}
      ${vergleichZeile("Potenzial-Score", spieler.map(potenzialScore))}
      ${vergleichZeile("Fortuna-Fit", spieler.map(fortunaFit))}
      ${Object.values(RATING_MODELL).flatMap(grp =>
        Object.entries(grp.attribute).map(([k, label]) =>
          vergleichZeile(label, spieler.map(p => p.ratings[k] || 0)))).join("")}
    </tbody></table>
    <h3 class="mt">Stärken / Schwächen</h3>
    <div class="grid-3">${spieler.map(p => `<div class="card">
      <h3>${esc(p.vorname)} ${esc(p.nachname)}</h3>
      <div class="rs-label" style="font-size:11.5px;font-weight:700;color:var(--gruen)">STÄRKEN</div>
      <p style="font-size:13px;margin-bottom:8px">${topAttribute(p, 3).map(a => `${a.label} (${a.wert})`).join(" · ")}</p>
      <div class="rs-label" style="font-size:11.5px;font-weight:700;color:var(--rot)">SCHWÄCHEN</div>
      <p style="font-size:13px">${topAttribute(p, 3, true).map(a => `${a.label} (${a.wert})`).join(" · ")}</p>
    </div>`).join("")}</div>`;
}

function vergleichZeile(label, werte) {
  const max = Math.max(...werte);
  return `<tr><td>${label}</td>${werte.map(w => `<td class="${w === max && werte.filter(x => x === max).length === 1 ? "best" : ""}">${w}</td>`).join("")}</tr>`;
}

function radarChart(labels, datensaetze) {
  const size = 380, cx = size / 2, cy = size / 2, r = 130, n = labels.length;
  const punkt = (i, wert) => {
    const winkel = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(winkel) * r * (wert / 10), cy + Math.sin(winkel) * r * (wert / 10)];
  };
  let svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
  // Gitternetz
  for (const stufe of [2.5, 5, 7.5, 10]) {
    const pts = labels.map((_, i) => punkt(i, stufe).join(",")).join(" ");
    svg += `<polygon points="${pts}" fill="none" stroke="#dadde2" stroke-width="1"/>`;
  }
  // Achsen + Beschriftung
  labels.forEach((label, i) => {
    const [x, y] = punkt(i, 10);
    const [lx, ly] = punkt(i, 12.2);
    svg += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#dadde2"/>`;
    svg += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" font-size="12" font-weight="600" fill="#4b5563">${label}</text>`;
  });
  // Datensätze
  datensaetze.forEach((werte, di) => {
    const farbe = VERGLEICH_FARBEN[di];
    const pts = werte.map((w, i) => punkt(i, w).join(",")).join(" ");
    svg += `<polygon points="${pts}" fill="${farbe}22" stroke="${farbe}" stroke-width="2.5"/>`;
    werte.forEach((w, i) => {
      const [x, y] = punkt(i, w);
      svg += `<circle cx="${x}" cy="${y}" r="3.5" fill="${farbe}"/>`;
    });
  });
  return svg + "</svg>";
}

// ---------- Probetraining ----------
function viewProbetraining() {
  const relevant = SPIELER.filter(p => p.pool === "probetraining" || p.trialStatus !== "Keine");
  main.innerHTML = `
    <div class="page-header"><div><h1>Probetrainings-Modul</h1>
      <div class="sub">Verwaltung von Einladungen, Teilnahmen und Entscheidungen</div></div></div>
    <div class="card">
      ${relevant.length ? `<table><thead><tr>
        <th>Spieler</th><th>Position</th><th>Jahrgang</th><th>Status</th><th>Gesamturteil</th><th>Pool</th></tr></thead><tbody>
        ${relevant.map(p => `<tr>
          <td onclick="location.hash='#/spieler/${p.id}'"><strong class="link">${esc(p.vorname)} ${esc(p.nachname)}</strong></td>
          <td>${esc(p.hauptposition)}</td>
          <td>${jahrgang(p)}</td>
          <td><select onchange="setTrial('${p.id}','trialStatus',this.value)" style="padding:5px 6px;border:1px solid var(--border);border-radius:6px">
            ${TRIAL_STATUS.map(s => `<option ${p.trialStatus === s ? "selected" : ""}>${s}</option>`).join("")}</select></td>
          <td><select onchange="setTrial('${p.id}','trialUrteil',this.value)" style="padding:5px 6px;border:1px solid var(--border);border-radius:6px">
            <option value="">– offen –</option>
            ${["Ja", "Vielleicht", "Nein"].map(u => `<option ${p.trialUrteil === u ? "selected" : ""}>${u}</option>`).join("")}</select></td>
          <td><span class="badge ${poolBadge(p.pool)}">${POOL_LISTEN[p.pool].titel}</span></td>
        </tr>`).join("")}
      </tbody></table>` : `<div class="empty">Aktuell keine Spieler im Probetrainings-Prozess.</div>`}
    </div>`;
}
function setTrial(id, feld, wert) { findSpieler(id)[feld] = wert; speichern(); }
window.setTrial = setTrial;

// ---------- Modals ----------
function zeigeModal(html, onSubmit) {
  const root = $("#modal-root");
  root.innerHTML = `<div class="modal-backdrop"><div class="modal">${html}</div></div>`;
  $(".modal-backdrop").addEventListener("click", e => { if (e.target.classList.contains("modal-backdrop")) schliesseModal(); });
  const form = $("#modal-form");
  if (form) form.addEventListener("submit", e => { e.preventDefault(); onSubmit(new FormData(form)); });
}
function schliesseModal() { $("#modal-root").innerHTML = ""; }
window.schliesseModal = schliesseModal;

function feld(label, name, typ = "text", attrs = "", optionen = null) {
  if (optionen) return `<div class="field"><label>${label}</label><select name="${name}" ${attrs}>${optionen.map(o => `<option>${o}</option>`).join("")}</select></div>`;
  return `<div class="field"><label>${label}</label><input name="${name}" type="${typ}" ${attrs}></div>`;
}

function modalNeuerSpieler() {
  zeigeModal(`
    <h2>Neuen Spieler anlegen</h2>
    <form id="modal-form">
      <div class="form-grid">
        ${feld("Vorname *", "vorname", "text", "required")}
        ${feld("Nachname *", "nachname", "text", "required")}
        ${feld("Geburtsdatum *", "geburtsdatum", "date", "required")}
        ${feld("Nationalität", "nationalitaet")}
        ${feld("Verein *", "verein", "text", "required")}
        ${feld("Liga", "liga")}
        ${feld("Verband", "verband", "text", 'value="FVN"')}
        ${feld("Größe (cm)", "groesse", "number")}
        ${feld("Gewicht (kg)", "gewicht", "number")}
        ${feld("Starker Fuß", "starkerFuss", "text", "", ["Rechts", "Links", "Beidfüßig"])}
        ${feld("Schwacher Fuß (1–5)", "schwacherFuss", "number", 'min="1" max="5" value="3"')}
        ${feld("Hauptposition *", "hauptposition", "text", "required", POSITIONEN)}
        ${feld("Vertragsstatus", "vertragsstatus")}
        ${feld("Vertragsende", "vertragsende", "date")}
        ${feld("Berater", "berater")}
        ${feld("Kontakt", "kontakt")}
      </div>
      <div class="field mt"><label>Nebenpositionen (Mehrfachauswahl mit Strg)</label>
        <select name="nebenpositionen" multiple size="4">${POSITIONEN.map(p => `<option>${p}</option>`).join("")}</select></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" onclick="schliesseModal()">Abbrechen</button>
        <button type="submit" class="btn">Spieler anlegen</button>
      </div>
    </form>`, fd => {
    const neu = {
      id: "p" + Date.now(),
      vorname: fd.get("vorname"), nachname: fd.get("nachname"),
      geburtsdatum: fd.get("geburtsdatum"), nationalitaet: fd.get("nationalitaet") || "Deutschland",
      verein: fd.get("verein"), liga: fd.get("liga") || "", verband: fd.get("verband") || "",
      groesse: +fd.get("groesse") || 0, gewicht: +fd.get("gewicht") || 0,
      starkerFuss: fd.get("starkerFuss"), schwacherFuss: Math.min(5, Math.max(1, +fd.get("schwacherFuss") || 3)),
      hauptposition: fd.get("hauptposition"), nebenpositionen: fd.getAll("nebenpositionen"),
      vertragsstatus: fd.get("vertragsstatus") || "", vertragsende: fd.get("vertragsende") || "",
      berater: fd.get("berater") || "", kontakt: fd.get("kontakt") || "",
      pool: "beobachten", trialStatus: "Keine", trialUrteil: "",
      erstelltAm: HEUTE.toISOString().slice(0, 10),
      ratings: leereRatings(), videos: [], berichte: [], entwicklung: [],
    };
    SPIELER.push(neu);
    speichern();
    schliesseModal();
    location.hash = `#/spieler/${neu.id}`;
  });
}
window.modalNeuerSpieler = modalNeuerSpieler;

function modalNeuerBericht(id) {
  zeigeModal(`
    <h2>Neue Sichtung erfassen</h2>
    <form id="modal-form">
      <div class="form-grid">
        ${feld("Datum *", "datum", "date", `required value="${HEUTE.toISOString().slice(0, 10)}"`)}
        ${feld("Gegner *", "gegner", "text", "required")}
        ${feld("Wettbewerb", "wettbewerb")}
        ${feld("Spielort", "spielort")}
        ${feld("Wetter", "wetter")}
        ${feld("Beobachter *", "beobachter", "text", "required")}
      </div>
      <h3 class="mt mb" style="font-size:14px">Freitextbericht</h3>
      ${REPORT_SECTIONS.map(s => `<div class="field mb"><label>${s}</label><textarea name="abschnitt-${s}" rows="2"></textarea></div>`).join("")}
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" onclick="schliesseModal()">Abbrechen</button>
        <button type="submit" class="btn">Bericht speichern</button>
      </div>
    </form>`, fd => {
    const abschnitte = {};
    for (const s of REPORT_SECTIONS) {
      const t = fd.get(`abschnitt-${s}`);
      if (t && t.trim()) abschnitte[s] = t.trim();
    }
    findSpieler(id).berichte.push({
      datum: fd.get("datum"), gegner: fd.get("gegner"), wettbewerb: fd.get("wettbewerb") || "",
      spielort: fd.get("spielort") || "", wetter: fd.get("wetter") || "", beobachter: fd.get("beobachter"),
      abschnitte,
    });
    speichern();
    schliesseModal();
    viewSpielerDetail(id, "berichte");
  });
}
window.modalNeuerBericht = modalNeuerBericht;

function modalNeuesVideo(id) {
  const TAGS = ["Tore", "Assists", "Pressing", "1 gegen 1", "Defensivaktionen", "Standards"];
  zeigeModal(`
    <h2>Video verlinken</h2>
    <form id="modal-form">
      ${feld("Titel *", "titel", "text", "required")}
      <div class="mt">${feld("URL (Wyscout, YouTube, Upload) *", "url", "url", "required")}</div>
      <div class="field mt"><label>Tags (Mehrfachauswahl mit Strg)</label>
        <select name="tags" multiple size="6">${TAGS.map(t => `<option>${t}</option>`).join("")}</select></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" onclick="schliesseModal()">Abbrechen</button>
        <button type="submit" class="btn">Speichern</button>
      </div>
    </form>`, fd => {
    findSpieler(id).videos.push({ titel: fd.get("titel"), url: fd.get("url"), tags: fd.getAll("tags") });
    speichern();
    schliesseModal();
    viewSpielerDetail(id, "videos");
  });
}
window.modalNeuesVideo = modalNeuesVideo;

function modalNeuerEintrag(id) {
  zeigeModal(`
    <h2>Entwicklungsmonitor: Neuer Eintrag</h2>
    <form id="modal-form">
      ${feld("Datum *", "datum", "date", `required value="${HEUTE.toISOString().slice(0, 10)}"`)}
      <div class="field mt"><label>Zielsetzung *</label><textarea name="ziel" rows="2" required></textarea></div>
      <div class="field mt"><label>Trainingsschwerpunkte</label><textarea name="schwerpunkte" rows="2"></textarea></div>
      <div class="field mt"><label>Fortschritte</label><textarea name="fortschritt" rows="2"></textarea></div>
      <div class="field mt"><label>Trainerfeedback</label><textarea name="feedback" rows="2"></textarea></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" onclick="schliesseModal()">Abbrechen</button>
        <button type="submit" class="btn">Speichern</button>
      </div>
    </form>`, fd => {
    findSpieler(id).entwicklung.push({
      datum: fd.get("datum"), ziel: fd.get("ziel"),
      schwerpunkte: fd.get("schwerpunkte") || "", fortschritt: fd.get("fortschritt") || "", feedback: fd.get("feedback") || "",
    });
    speichern();
    schliesseModal();
    viewSpielerDetail(id, "entwicklung");
  });
}
window.modalNeuerEintrag = modalNeuerEintrag;

// ---------- Bundesliga (StatsBomb Live-Daten) ----------
let sbFilter = { suche: "", position: "", team: "" };

function viewBundesliga() {
  const cached = sbCacheVorhanden();
  const cacheObj = cached ? JSON.parse(localStorage.getItem("statsbomb-bundesliga-v2") || "{}") : null;
  const geladen = cacheObj?.geladen ? new Date(cacheObj.geladen).toLocaleDateString("de-DE") : null;

  main.innerHTML = `
    <div class="page-header">
      <div>
        <h1>🇩🇪 Bundesliga 2023/24 <span style="font-size:13px;font-weight:400;color:var(--muted)">via StatsBomb Open Data</span></h1>
        <div class="sub">${cached ? `${cacheObj.spieler?.length || 0} Spieler geladen · Stand: ${geladen}` : "Noch keine Daten geladen"}</div>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        ${cached ? `<button class="btn btn-secondary btn-sm" onclick="sbCacheLeeren();viewBundesliga()">Cache leeren</button>` : ""}
        <button class="btn" id="sbLadenBtn" onclick="sbStartLaden()">${cached ? "Neu laden" : "📡 Daten laden"}</button>
      </div>
    </div>

    <div id="sb-progress" style="display:none" class="card mb">
      <div style="font-size:13.5px;font-weight:600;margin-bottom:10px" id="sb-progress-text">Lade…</div>
      <div style="background:#eceef1;border-radius:99px;height:8px;overflow:hidden">
        <div id="sb-progress-bar" style="height:100%;background:var(--rot);border-radius:99px;width:0%;transition:width .3s"></div>
      </div>
    </div>

    ${cached ? sbSpielertabelle(cacheObj) : `
    <div class="card" style="text-align:center;padding:40px">
      <div style="font-size:32px;margin-bottom:12px">📡</div>
      <div style="font-weight:700;font-size:16px;margin-bottom:8px">Echte Bundesliga-Spieler laden</div>
      <div style="color:var(--muted);font-size:13.5px;max-width:480px;margin:0 auto 18px">
        Lädt Lineup- und Eventdaten aus dem StatsBomb Open-Data-GitHub für die Bundesliga-Saison 2023/24.
        Die Daten werden lokal gecacht — einmalig ~30 Sekunden Ladezeit.
      </div>
      <div style="font-size:12.5px;color:var(--muted);margin-bottom:6px">Datenquelle: github.com/statsbomb/open-data · Lizenz: CC BY-SA 4.0</div>
      <button class="btn" onclick="sbStartLaden()">📡 Bundesliga-Daten laden</button>
    </div>`}
  `;
}

function sbSpielertabelle(cacheObj) {
  const { spieler = [], matches = [] } = cacheObj;
  const teams = [...new Set(spieler.flatMap(s => s.teams))].sort();
  const pos = [...new Set(spieler.map(s => s.hauptposition))].sort();

  const gefiltert = spieler.filter(s => {
    const su = sbFilter.suche.toLowerCase();
    if (su && !s.name.toLowerCase().includes(su) && !(s.teams.join(" ").toLowerCase().includes(su))) return false;
    if (sbFilter.position && s.hauptposition !== sbFilter.position) return false;
    if (sbFilter.team && !s.teams.includes(sbFilter.team)) return false;
    return true;
  });

  return `
    <div class="card mb">
      <h3>Matches im Datensatz (${matches.length})</h3>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${matches.map(m => `<span class="tag">${m.heim} ${m.heimTore}:${m.gastTore} ${m.gast} · ${fmtDatum(m.datum)}</span>`).join("")}
      </div>
    </div>
    <div class="card">
      <div class="filters">
        <div class="field" style="flex:1;min-width:180px"><label>Suche Spieler/Team</label>
          <input id="sb-suche" placeholder="Name oder Verein…" value="${esc(sbFilter.suche)}"></div>
        <div class="field"><label>Position</label>
          <select id="sb-pos"><option value="">Alle</option>${pos.map(p => `<option ${sbFilter.position === p ? "selected" : ""}>${p}</option>`).join("")}</select></div>
        <div class="field"><label>Team</label>
          <select id="sb-team"><option value="">Alle</option>${teams.map(t => `<option ${sbFilter.team === t ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></div>
      </div>
      <div style="font-size:12.5px;color:var(--muted);margin-bottom:10px">${gefiltert.length} Spieler gefunden</div>
      ${gefiltert.length ? `<table><thead><tr>
        <th>Spieler</th><th>Nation</th><th>Position</th><th>Team(s)</th><th>#</th><th>Einsätze</th><th>Tore</th><th>Assists</th><th>Schüsse</th><th>Aktion</th>
      </tr></thead><tbody>
        ${gefiltert.map(s => `<tr>
          <td><strong>${esc(s.name)}</strong>${s.nickname ? `<br><span style="font-size:11.5px;color:var(--muted)">"${esc(s.nickname)}"</span>` : ""}</td>
          <td><span class="tag">${esc(s.nationalitaet)}</span></td>
          <td>${esc(s.hauptposition)}</td>
          <td style="font-size:12.5px">${s.teams.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</td>
          <td style="color:var(--muted)">${s.trikot || "–"}</td>
          <td>${s.einsaetze}</td>
          <td>${s.tore > 0 ? `<strong style="color:var(--gruen)">${s.tore}</strong>` : "–"}</td>
          <td>${s.assists > 0 ? `<strong>${s.assists}</strong>` : "–"}</td>
          <td>${s.schuesse || "–"}</td>
          <td><button class="btn btn-sm btn-secondary" onclick="sbZuScout('${s.sbId}')">+ Scout</button></td>
        </tr>`).join("")}
      </tbody></table>` : `<div class="empty">Keine Spieler gefunden.</div>`}
    </div>`;
}

async function sbStartLaden() {
  const progressBox = $("#sb-progress");
  const progressText = $("#sb-progress-text");
  const progressBar = $("#sb-progress-bar");
  if (!progressBox) return;

  progressBox.style.display = "block";
  document.getElementById("sbLadenBtn").disabled = true;

  try {
    await sbLadeBundesligaSpieler((text, pct) => {
      if (progressText) progressText.textContent = text;
      if (progressBar) progressBar.style.width = pct + "%";
    });
    viewBundesliga();
  } catch (e) {
    if (progressText) progressText.textContent = "⚠️ Fehler: " + e.message;
    if (progressBar) progressBar.style.background = "var(--rot)";
    const btn = document.getElementById("sbLadenBtn");
    if (btn) btn.disabled = false;
  }
}
window.sbStartLaden = sbStartLaden;

// StatsBomb-Spieler als Scout-Lead übernehmen
function sbZuScout(sbId) {
  const cacheObj = JSON.parse(localStorage.getItem("statsbomb-bundesliga-v2") || "{}");
  const sbSp = cacheObj.spieler?.find(s => s.sbId == sbId);
  if (!sbSp) return;

  const teile = sbSp.name.split(" ");
  const vorname = teile.slice(0, -1).join(" ") || sbSp.name;
  const nachname = teile.at(-1) || "";

  const neu = {
    id: "sb-" + sbId,
    vorname, nachname,
    geburtsdatum: "",
    nationalitaet: sbSp.nationalitaet,
    verein: sbSp.teams[0] || "",
    liga: "1. Bundesliga",
    verband: "DFB",
    groesse: 0, gewicht: 0,
    starkerFuss: "Rechts", schwacherFuss: 3,
    hauptposition: sbSp.hauptposition,
    nebenpositionen: sbSp.positionen.filter(p => p !== sbSp.hauptposition),
    vertragsstatus: "", vertragsende: "", berater: "", kontakt: "",
    pool: "beobachten", trialStatus: "Keine", trialUrteil: "",
    erstelltAm: HEUTE.toISOString().slice(0, 10),
    ratings: leereRatings(),
    videos: [], berichte: [], entwicklung: [],
    sbRef: { tore: sbSp.tore, assists: sbSp.assists, schuesse: sbSp.schuesse, einsaetze: sbSp.einsaetze },
  };

  if (SPIELER.find(p => p.id === neu.id)) {
    alert(`${sbSp.name} ist bereits in der Scout-Datenbank.`);
    return;
  }

  SPIELER.push(neu);
  speichern();

  if (confirm(`${sbSp.name} wurde zur Scout-Datenbank hinzugefügt. Jetzt zum Profil?`)) {
    location.hash = `#/spieler/${neu.id}`;
  }
}
window.sbZuScout = sbZuScout;

// Filter-Events für Bundesliga-Tabelle
document.addEventListener("input", e => {
  if (e.target.id === "sb-suche") { sbFilter.suche = e.target.value; renderSbTabelle(); }
});
document.addEventListener("change", e => {
  if (e.target.id === "sb-pos") { sbFilter.position = e.target.value; renderSbTabelle(); }
  if (e.target.id === "sb-team") { sbFilter.team = e.target.value; renderSbTabelle(); }
});
function renderSbTabelle() {
  const cacheObj = JSON.parse(localStorage.getItem("statsbomb-bundesliga-v2") || "{}");
  const container = document.querySelector(".card:last-child");
  if (!container || !cacheObj.spieler) return;
  // Re-render nur die Tabelle
  const wrap = document.createElement("div");
  wrap.innerHTML = sbSpielertabelle(cacheObj);
  // Ersetze Content-Card (letzte)
  main.querySelector("#sb-progress")?.remove();
  viewBundesliga();
}

// ---------- Init ----------
$("#resetData").addEventListener("click", () => {
  if (confirm("Alle Änderungen verwerfen und Demodaten neu laden?")) {
    resetDemodaten();
    SPIELER = ladeSpieler();
    route();
  }
});
route();
