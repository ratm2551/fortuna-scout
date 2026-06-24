// Fortuna Talent Scout Dashboard – Prototyp-Logik
"use strict";

let SPIELER = [];
const HEUTE = new Date();

// ---------- Helfer ----------
const $ = (sel, root = document) => root.querySelector(sel);
const main = $("#main");

function speichern() {
  speichereSpieler(SPIELER);
  speichereFirebase(SPIELER);
}
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
function getStatWert(p, feld) {
  if (p.sbRef) {
    if (feld === "xg" && p.sbRef.xg != null) return p.sbRef.xg;
    if (feld === "xa" && p.sbRef.xa != null) return p.sbRef.xa;
    if (feld === "tore" && p.sbRef.tore != null) return p.sbRef.tore;
    if (feld === "vorlagen" && p.sbRef.assists != null) return p.sbRef.assists;
  }
  const v = (p.statistiken || {})[feld];
  return v != null && v !== "" ? +v : null;
}
function fortunaFit(p) {
  const cfg = SCORE_CONFIG;
  const gruppeKeys = ["technik","taktik","athletik","mentalitaet"];
  const total = gruppeKeys.reduce((s,k) => s + (cfg[k]||0), 0)
    + STAT_KRITERIEN.reduce((s,kr) => s + (cfg[kr.id]||0), 0);
  if (!total) return 0;
  let score = 0;
  for (const k of gruppeKeys) {
    const w = cfg[k] || 0;
    if (w) score += gruppenSchnitt(p, k) * 10 * w;
  }
  for (const kr of STAT_KRITERIEN) {
    const w = cfg[kr.id] || 0;
    if (!w) continue;
    const refMax = cfg["ref_" + kr.feld] || kr.refDefault;
    const wert = getStatWert(p, kr.feld);
    if (wert == null) continue;
    const s = kr.invers
      ? (refMax > 1 ? Math.max(0, 1 - (Math.max(wert - 1, 0) / (refMax - 1))) : (wert <= 1 ? 1 : 0)) * 100
      : Math.min(Math.max(wert, 0) / refMax, 1) * 100;
    score += s * w;
  }
  return Math.round(score / total);
}
function scorePill(wert) {
  const cls = wert >= 75 ? "score-hoch" : wert >= 55 ? "score-mittel" : "score-niedrig";
  return `<span class="score-pill ${cls}">${wert}</span>`;
}

// ---------- Authentifizierung ----------
const ROLLEN = ["Koordinator", "Scout", "Trainer", "Administrator"];
const USERS_KEY = "fortuna-users-v1";
const SESSION_KEY = "fortuna-session";
const DEFAULT_USERS = [
  { nutzername: "koordinator", passwort: "f95scout",   rolle: "Koordinator",   gesperrt: false },
  { nutzername: "scout",       passwort: "scout123",   rolle: "Scout",         gesperrt: false },
  { nutzername: "trainer",     passwort: "trainer123", rolle: "Trainer",       gesperrt: false },
  { nutzername: "admin",       passwort: "admin2024",  rolle: "Administrator", gesperrt: false },
];
function ladeBenutzer() {
  try { const s = localStorage.getItem(USERS_KEY); if (s) return JSON.parse(s); } catch {}
  return DEFAULT_USERS.map(u => ({ ...u }));
}
function speichereBenutzer() { localStorage.setItem(USERS_KEY, JSON.stringify(BENUTZER)); }
let BENUTZER = ladeBenutzer();

// ---------- Fortuna-Score-Konfiguration ----------
const SCORE_CONFIG_KEY = "fortuna-score-config-v2";
const STAT_KRITERIEN = [
  { id: "stat_xg",       label: "xG (Erwartete Tore)",     feld: "xg",       einheit: "xG",    refDefault: 15,  invers: false },
  { id: "stat_xa",       label: "xA (Erwartete Assists)",   feld: "xa",       einheit: "xA",    refDefault: 10,  invers: false },
  { id: "stat_postxg",   label: "Post-xG (nach Schuss)",    feld: "postxg",   einheit: "pxG",   refDefault: 15,  invers: false },
  { id: "stat_tore",     label: "Tore",                      feld: "tore",     einheit: "Tore",  refDefault: 25,  invers: false },
  { id: "stat_vorlagen", label: "Vorlagen (Assists)",        feld: "vorlagen", einheit: "Ass.",  refDefault: 20,  invers: false },
  { id: "stat_lauf",     label: "Laufleistung (km/Spiel)",  feld: "lauf",     einheit: "km",    refDefault: 12,  invers: false },
  { id: "stat_karriere", label: "Spiele in Karriere",        feld: "karriere", einheit: "Sp.",   refDefault: 300, invers: false },
  { id: "stat_vereine",  label: "Anzahl Vereine (invers)",   feld: "vereine",  einheit: "Ver.",  refDefault: 5,   invers: true  },
  { id: "stat_xt",       label: "Expected Threat (xT)",      feld: "xt",       einheit: "xT",    refDefault: 5,   invers: false },
  { id: "stat_pitch",    label: "Pitch Control (%)",          feld: "pitch",    einheit: "%",     refDefault: 100, invers: false },
];
const DEFAULT_SCORE_CONFIG = {
  technik: 10, taktik: 25, athletik: 20, mentalitaet: 45,
  stat_xg: 0, stat_xa: 0, stat_postxg: 0, stat_tore: 0, stat_vorlagen: 0,
  stat_lauf: 0, stat_karriere: 0, stat_vereine: 0, stat_xt: 0, stat_pitch: 0,
  ref_xg: 15, ref_xa: 10, ref_postxg: 15, ref_tore: 25, ref_vorlagen: 20,
  ref_lauf: 12, ref_karriere: 300, ref_vereine: 5, ref_xt: 5, ref_pitch: 100,
};
function ladeScoreConfig() {
  try { const s = localStorage.getItem(SCORE_CONFIG_KEY); if (s) return JSON.parse(s); } catch {}
  return { ...DEFAULT_SCORE_CONFIG };
}
function speichereScoreConfig() { localStorage.setItem(SCORE_CONFIG_KEY, JSON.stringify(SCORE_CONFIG)); }
let SCORE_CONFIG = ladeScoreConfig();

// ---------- Berechtigungen ----------
const BERECHTIGUNGEN_KEY = "fortuna-berechtigungen-v1";
const ALLE_RECHTE = [
  { id: "spieler_sehen",      label: "Spielerdatenbank ansehen" },
  { id: "spieler_anlegen",    label: "Spieler anlegen" },
  { id: "spieler_bearbeiten", label: "Spieler bearbeiten" },
  { id: "spieler_loeschen",   label: "Spieler löschen" },
  { id: "csv_export",         label: "CSV exportieren" },
  { id: "talentpool",         label: "Talentpool verwalten" },
  { id: "berichte",           label: "Scoutingberichte erstellen" },
  { id: "videos",             label: "Videos verwalten" },
  { id: "entwicklung",        label: "Entwicklungsmonitor" },
  { id: "probetraining",      label: "Probetraining-Modul" },
  { id: "spielervergleich",   label: "Spielervergleich" },
  { id: "profilsuche",        label: "Profilsuche" },
  { id: "bundesliga",         label: "Bundesliga / StatsBomb-Daten" },
];
const DEFAULT_BERECHTIGUNGEN = {
  Koordinator: ["spieler_sehen","spieler_anlegen","spieler_bearbeiten","spieler_loeschen","csv_export","talentpool","berichte","videos","entwicklung","probetraining","spielervergleich","profilsuche","bundesliga"],
  Scout:       ["spieler_sehen","spieler_anlegen","spieler_bearbeiten","csv_export","talentpool","berichte","videos","probetraining","spielervergleich","profilsuche","bundesliga"],
  Trainer:     ["spieler_sehen","spieler_bearbeiten","berichte","entwicklung","spielervergleich"],
};
function ladeBerechtigungen() {
  try { const s = localStorage.getItem(BERECHTIGUNGEN_KEY); if (s) return JSON.parse(s); } catch {}
  return JSON.parse(JSON.stringify(DEFAULT_BERECHTIGUNGEN));
}
function speichereBerechtigungen(b) { localStorage.setItem(BERECHTIGUNGEN_KEY, JSON.stringify(b)); }
let BERECHTIGUNGEN = ladeBerechtigungen();

function hatRecht(id) {
  const n = aktuellerNutzer();
  if (!n) return false;
  if (n.rolle === "Administrator") return true;
  return (BERECHTIGUNGEN[n.rolle] || []).includes(id);
}

function aktuellerNutzer() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; }
}
function anmelden(nutzername, passwort) {
  const u = BENUTZER.find(b => b.nutzername === nutzername);
  if (!u || u.passwort !== passwort) return { ok: false, fehler: "Benutzername oder Passwort falsch." };
  if (u.gesperrt) return { ok: false, fehler: "Dieser Zugang wurde gesperrt. Bitte Administrator kontaktieren." };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ nutzername: u.nutzername, rolle: u.rolle }));
  return { ok: true };
}
function abmelden() {
  sessionStorage.removeItem(SESSION_KEY);
  const layout = document.querySelector(".layout");
  if (layout) layout.style.display = "none";
  viewLogin();
}
window.abmelden = abmelden;

function viewLogin() {
  const layout = document.querySelector(".layout");
  if (layout) layout.style.display = "none";
  let root = document.getElementById("login-root");
  if (!root) { root = document.createElement("div"); root.id = "login-root"; document.body.appendChild(root); }
  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f1013">
      <div style="background:#1c1e21;border-radius:16px;padding:40px;width:360px;box-shadow:0 8px 32px rgba(0,0,0,.4)">
        <div style="text-align:center;margin-bottom:28px">
          <div style="font-size:36px;font-weight:800;color:#d31920;margin-bottom:4px">F95</div>
          <div style="font-weight:700;font-size:18px;color:#fff">Fortuna Talent Scout</div>
          <div style="font-size:12.5px;color:#6b7280;margin-top:4px">Bitte anmelden</div>
        </div>
        <div id="login-fehler" style="display:none;background:#3b0707;border:1px solid #d31920;color:#f87171;padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:16px">
          Benutzername oder Passwort falsch.
        </div>
        <div style="margin-bottom:14px"><label style="display:block;font-size:12.5px;color:#9ca3af;margin-bottom:6px">Benutzername</label>
          <input id="login-user" type="text" autocomplete="username" placeholder="z.B. scout"
            style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;border:1px solid #374151;background:#111317;color:#fff;font-size:14px">
        </div>
        <div style="margin-bottom:20px"><label style="display:block;font-size:12.5px;color:#9ca3af;margin-bottom:6px">Passwort</label>
          <input id="login-pw" type="password" autocomplete="current-password" placeholder="••••••••"
            style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;border:1px solid #374151;background:#111317;color:#fff;font-size:14px">
        </div>
        <button id="login-btn" style="width:100%;padding:11px;background:#d31920;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">Anmelden</button>
      </div>
    </div>`;

  const tryLogin = () => {
    const u = (document.getElementById("login-user")?.value || "").trim().toLowerCase();
    const pw = document.getElementById("login-pw")?.value || "";
    const result = anmelden(u, pw);
    if (result.ok) {
      root.innerHTML = "";
      const layout = document.querySelector(".layout");
      if (layout) layout.style.display = "";
      const nutzer = aktuellerNutzer();
      const sel = document.getElementById("roleSelect");
      if (sel && nutzer?.rolle) sel.value = nutzer.rolle;
      updateNav();
      route();
    } else {
      const err = document.getElementById("login-fehler");
      if (err) { err.style.display = "block"; err.textContent = result.fehler; }
    }
  };
  document.getElementById("login-btn")?.addEventListener("click", tryLogin);
  document.getElementById("login-pw")?.addEventListener("keydown", e => { if (e.key === "Enter") tryLogin(); });
  document.getElementById("login-user")?.addEventListener("keydown", e => { if (e.key === "Enter") document.getElementById("login-pw")?.focus(); });
}

const ROUTE_RECHTE = {
  spieler:      "spieler_sehen",
  talentpool:   "talentpool",
  vergleich:    "spielervergleich",
  probetraining:"probetraining",
  profilsuche:  "profilsuche",
  bundesliga:   "bundesliga",
};

function updateNav() {
  const nav = document.getElementById("nav");
  if (!nav) return;
  for (const [route, recht] of Object.entries(ROUTE_RECHTE)) {
    const link = nav.querySelector(`a[data-route="${route}"]`);
    if (link) link.style.display = hatRecht(recht) ? "" : "none";
  }
  nav.querySelector('a[data-route="admin"]')?.remove();
  nav.querySelector(".nav-admin-section")?.remove();
  const nutzer = aktuellerNutzer();
  if (nutzer?.rolle === "Administrator") {
    const sec = document.createElement("div");
    sec.className = "nav-section nav-admin-section";
    sec.textContent = "System";
    const link = document.createElement("a");
    link.href = "#/admin";
    link.dataset.route = "admin";
    link.textContent = "⚙️ Administration";
    nav.appendChild(sec);
    nav.appendChild(link);
  }
}

// ---------- Setup-Link (Zugangsdaten per URL verteilen) ----------
(function setupImport() {
  const hash = location.hash || "";
  if (!hash.startsWith("#setup=")) return;
  try {
    const payload = JSON.parse(atob(hash.slice(7)));
    if (Array.isArray(payload.users) && payload.users.length) {
      localStorage.setItem(USERS_KEY, JSON.stringify(payload.users));
      BENUTZER = payload.users;
      history.replaceState(null, "", location.pathname + "#/dashboard");
      toast("✅ Zugangsdaten wurden eingerichtet. Bitte jetzt anmelden.");
    }
  } catch (e) {}
})();

function setupLinkErstellen() {
  const payload = btoa(JSON.stringify({ users: BENUTZER, version: 1 }));
  const url = location.origin + location.pathname + "#setup=" + payload;
  navigator.clipboard.writeText(url).then(function() {
    toast("Setup-Link in Zwischenablage kopiert! Diesen Link an neue Nutzer senden.");
  }).catch(function() {
    const root = document.getElementById("modal-root");
    root.innerHTML = `<div class="modal-backdrop"><div class="modal" style="max-width:520px">
      <h3>Setup-Link</h3>
      <p style="font-size:12px;color:var(--muted);margin-bottom:8px">Diesen Link an neue Nutzer senden. Beim Öffnen werden alle Zugangsdaten automatisch eingerichtet.</p>
      <textarea readonly onclick="this.select()" style="width:100%;font-size:11px;padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card);color:var(--text);min-height:80px;resize:none;word-break:break-all">${esc(url)}</textarea>
      <div style="display:flex;justify-content:flex-end;margin-top:12px">
        <button class="btn" onclick="document.getElementById('modal-root').innerHTML=''">Schließen</button>
      </div>
    </div></div>`;
  });
}
window.setupLinkErstellen = setupLinkErstellen;

// ---------- Routing ----------
function route() {
  if (!aktuellerNutzer()) { viewLogin(); return; }
  const layout = document.querySelector(".layout");
  if (layout) layout.style.display = "";
  const hash = location.hash.replace(/^#\//, "") || "dashboard";
  const [seite, param] = hash.split("/");
  updateNav();
  document.querySelectorAll("#nav a").forEach(a => {
    a.classList.toggle("active", a.dataset.route === seite);
  });
  if (ROUTE_RECHTE[seite] && !hatRecht(ROUTE_RECHTE[seite])) {
    main.innerHTML = `<div class="card mt"><div class="empty">🔒 Kein Zugriff – deine Rolle hat keine Berechtigung für diesen Bereich.</div></div>`;
    return;
  }
  const views = {
    dashboard: viewDashboard,
    spieler: () => (param ? viewSpielerDetail(param) : viewSpielerListe()),
    talentpool: viewTalentpool,
    vergleich: viewVergleich,
    probetraining: viewProbetraining,
    bundesliga: viewBundesliga,
    profilsuche: viewProfilsuche,
    admin: viewAdmin,
  };
  (views[seite] || viewDashboard)();
  main.scrollTop = 0;
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);

// ---------- Mobile sidebar toggle ----------
(function() {
  const toggle = document.getElementById("menuToggle");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  if (!toggle || !sidebar || !overlay) return;
  function openNav() { sidebar.classList.add("nav-open"); overlay.classList.add("nav-open"); }
  function closeNav() { sidebar.classList.remove("nav-open"); overlay.classList.remove("nav-open"); }
  toggle.addEventListener("click", function() {
    sidebar.classList.contains("nav-open") ? closeNav() : openNav();
  });
  overlay.addEventListener("click", closeNav);
  document.querySelectorAll("#nav a").forEach(function(a) {
    a.addEventListener("click", function() { if (window.innerWidth <= 768) closeNav(); });
  });
})();

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
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${hatRecht("csv_export") ? `<button class="btn btn-secondary" onclick="exportiereCSV(gefilterteSpieler(),'spielerdatenbank')">↓ CSV exportieren</button>` : ""}
        ${hatRecht("spieler_anlegen") ? `<button class="btn btn-secondary" onclick="csvImportieren()">↑ CSV importieren</button>` : ""}
        ${hatRecht("spieler_anlegen") ? `<button class="btn" onclick="modalNeuerSpieler()">+ Neuer Spieler</button>` : ""}
      </div>
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
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
        <div class="avatar" style="${p.foto ? "padding:0;overflow:hidden" : ""}">
          ${p.foto ? `<img src="${p.foto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : esc(initialen(p))}
        </div>
        ${hatRecht("spieler_bearbeiten") ? `<div style="display:flex;gap:4px">
          <button class="btn btn-ghost btn-sm" onclick="fotoHochladen('${p.id}')" style="font-size:11px;padding:3px 8px">📷 ${p.foto ? "Ändern" : "Foto"}</button>
          ${p.foto ? `<button class="btn btn-ghost btn-sm" onclick="fotoEntfernen('${p.id}')" style="font-size:11px;padding:3px 6px;color:var(--muted)" title="Foto entfernen">✕</button>` : ""}
        </div>` : ""}
      </div>
      <div>
        <h1>${esc(p.vorname)} ${esc(p.nachname)}</h1>
        <div class="player-meta">${esc(p.hauptposition)} · Jahrgang ${jahrgang(p)} (${alter(p)} Jahre) · ${esc(p.verein)} · ${esc(p.liga)}</div>
        <div class="player-meta mt" style="margin-top:6px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          Pool: <select onchange="setPool('${p.id}', this.value)" style="padding:4px 6px;border-radius:6px;border:1px solid var(--border)">
            ${Object.entries(POOL_LISTEN).map(([k, v]) => `<option value="${k}" ${p.pool === k ? "selected" : ""}>${v.titel}</option>`).join("")}
          </select>
          ${hatRecht("spieler_bearbeiten") ? `<button class="btn btn-ghost btn-sm" onclick="modalSpielerBearbeiten('${p.id}')">✏️ Bearbeiten</button>` : ""}
          ${hatRecht("spieler_loeschen") ? `<button class="btn btn-ghost btn-sm" style="color:var(--rot);border-color:var(--rot)" onclick="spielerLoeschen('${p.id}')">🗑 Löschen</button>` : ""}
        </div>
      </div>
      <div class="scores-row">
        <div class="score-box"><div class="val" style="color:var(--rot)">${gesamtScore(p)}</div><div class="lbl">Gesamt</div></div>
        <div class="score-box"><div class="val" style="color:var(--gruen)">${potenzialScore(p)}</div><div class="lbl">Potenzial</div></div>
        <div class="score-box"><div class="val">${fortunaFit(p)}</div><div class="lbl">Fortuna-Fit</div></div>
      </div>
    </div>
    <div class="tabs">
      ${[
        ["profil",     "Profil",                                          null],
        ["bewertung",  "Bewertung",                                       "spieler_bearbeiten"],
        ["berichte",   `Berichte (${p.berichte.length})`,                 "berichte"],
        ["videos",     `Videos (${p.videos.length})`,                     "videos"],
        ["entwicklung","Entwicklungsmonitor",                             "entwicklung"],
        ["extern",     `Externe Quellen (${(p.externeQuellen||[]).length})`, null],
        ["notizen",    "Notizen",                                         null],
      ].filter(([,,r]) => !r || hatRecht(r))
       .map(([k, t]) => `<button class="${aktiverTab === k ? "active" : ""}" onclick="viewSpielerDetail('${p.id}','${k}')">${t}</button>`).join("")}
    </div>
    <div id="tab-inhalt"></div>`;

  const inhalt = $("#tab-inhalt");
  if (aktiverTab === "profil") inhalt.innerHTML = tabProfil(p);
  else if (aktiverTab === "bewertung") { inhalt.innerHTML = tabBewertung(p); bindRatings(p); }
  else if (aktiverTab === "berichte") inhalt.innerHTML = tabBerichte(p);
  else if (aktiverTab === "videos") inhalt.innerHTML = tabVideos(p);
  else if (aktiverTab === "entwicklung") inhalt.innerHTML = tabEntwicklung(p);
  else if (aktiverTab === "extern") inhalt.innerHTML = tabExterneQuellen(p);
  else if (aktiverTab === "notizen") inhalt.innerHTML = tabNotizen(p);
}
window.viewSpielerDetail = viewSpielerDetail;

function setPool(id, pool) { findSpieler(id).pool = pool; speichern(); route(); }
window.setPool = setPool;

function fotoHochladen(id) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = function(e) {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toast("Bild zu groß – max. 2 MB erlaubt."); return; }
    const reader = new FileReader();
    reader.onload = function(ev) {
      const p = findSpieler(id);
      if (!p) return;
      p.foto = ev.target.result;
      speichern();
      toast("Foto gespeichert.");
      viewSpielerDetail(id, aktiverTab);
    };
    reader.readAsDataURL(f);
  };
  input.click();
}
window.fotoHochladen = fotoHochladen;

function fotoEntfernen(id) {
  const p = findSpieler(id);
  if (!p) return;
  p.foto = null;
  speichern();
  toast("Foto entfernt.");
  viewSpielerDetail(id, aktiverTab);
}
window.fotoEntfernen = fotoEntfernen;

function tabProfil(p) {
  const zeile = (l, w) => `<tr><th style="width:180px">${l}</th><td>${w}</td></tr>`;
  return `<div class="grid-2">
    <div class="card"><h3>Stammdaten</h3><table><tbody>
      ${zeile("Geburtsdatum", `${fmtDatum(p.geburtsdatum)} (${alter(p)} Jahre)`)}
      ${zeile("Nationalität", esc(p.nationalitaet))}
      ${zeile("Talent-Kategorie", p.talent ? `<span class="badge ${p.talent==="A"?"badge-gruen":p.talent==="B"?"badge-gelb":"badge-grau"}">${p.talent}</span>` : "–")}
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
      ${zeile("Vertragsende", `<input type="date" value="${p.vertragsende || ""}" onchange="setFeld('${p.id}','vertragsende',this.value)" style="border:1px solid var(--border);border-radius:6px;padding:4px 6px">`)}
      ${zeile("Marktwert (€)", `<input type="number" min="0" step="10000" value="${p.marktwert ?? ""}" placeholder="manuell eintragen" onchange="setFeld('${p.id}','marktwert',this.value?+this.value:null)" style="border:1px solid var(--border);border-radius:6px;padding:4px 6px;width:140px">`)}
      ${zeile("Berater", esc(p.berater || "–"))}
      ${zeile("Kontakt", esc(p.kontakt || "–"))}
      ${zeile("Probetraining", `${esc(p.trialStatus)}${p.trialUrteil ? ` · Urteil: <strong>${esc(p.trialUrteil)}</strong>` : ""}`)}
    </tbody></table></div>
  </div>
  ${p.sbRef ? `<div class="card mt"><h3>⚽ StatsBomb-Referenzwerte <span class="badge badge-gelb">Experimentell</span></h3>
    <div class="grid-3">
      <div class="score-box"><div class="val">${p.sbRef.xg ?? "–"}</div><div class="lbl">xG (erwartete Tore)</div></div>
      <div class="score-box"><div class="val">${p.sbRef.xa ?? "–"}</div><div class="lbl">xA (erwartete Assists)</div></div>
      <div class="score-box"><div class="val">${p.sbRef.passQuote != null ? p.sbRef.passQuote + "%" : "–"}</div><div class="lbl">Passquote</div></div>
    </div>
    <div style="font-size:12px;color:var(--muted);margin-top:10px">Echtes StatsBomb-xG-Modell aus Schussdaten · Tore: ${p.sbRef.tore} · Assists: ${p.sbRef.assists} · Einsätze im Datensatz: ${p.sbRef.einsaetze}</div>
  </div>` : ""}
  <div class="card mt"><h3>🤖 KI-Kurzprofil (Prototyp)</h3><p style="font-size:13.5px;line-height:1.6">${kiKurzprofil(p)}</p></div>
  ${hatRecht("spieler_bearbeiten") ? renderStatistikFelder(p) : ""}`;
}
function renderStatistikFelder(p) {
  const felder = STAT_KRITERIEN.map(function(kr) {
    const v = (p.statistiken || {})[kr.feld];
    const sbRef = p.sbRef || {};
    const sbVal = kr.feld === "xg" ? sbRef.xg : kr.feld === "xa" ? sbRef.xa : kr.feld === "tore" ? sbRef.tore : kr.feld === "vorlagen" ? sbRef.assists : null;
    const sbHinweis = sbVal != null ? ' <span style="color:var(--gruen);font-size:11px">StatsBomb: ' + sbVal + "</span>" : "";
    return '<div class="field">'
      + "<label>" + esc(kr.label) + " (" + esc(kr.einheit) + ")" + sbHinweis + "</label>"
      + '<input type="number" min="0" step="any" value="' + (v != null ? v : "") + '" placeholder="–"'
      + ' oninput="setStatFeld(\'' + p.id + '\',\'' + kr.feld + '\',this.value)"'
      + ' style="border:1px solid var(--border);border-radius:6px;padding:6px 8px;font-size:13px;background:var(--bg-card);color:var(--text)">'
      + "</div>";
  }).join("");
  return '<div class="card mt">'
    + '<h3>📊 Statistiken <span style="font-size:12px;font-weight:400;color:var(--muted)">(manuell erfasst · werden durch StatsBomb-Daten ergänzt)</span></h3>'
    + '<div class="form-grid">' + felder + "</div>"
    + '<div style="font-size:12px;color:var(--muted);margin-top:8px">Änderungen werden gespeichert. StatsBomb-Werte haben im Score-Modell Vorrang.</div>'
    + "</div>";
}
function setFeld(id, feld, wert) { findSpieler(id)[feld] = wert; speichern(); }
window.setFeld = setFeld;
function setStatFeld(id, feld, wert) {
  const p = findSpieler(id);
  if (!p) return;
  if (!p.statistiken) p.statistiken = {};
  p.statistiken[feld] = wert === "" ? null : +wert;
  speichern();
}
window.setStatFeld = setStatFeld;

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
    ${hatRecht("berichte") ? `<button class="btn btn-sm" onclick="modalNeuerBericht('${p.id}')">+ Neue Sichtung</button>` : ""}
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

const EXTERNE_QUELLEN = [
  { name: "Transfermarkt", url: q => `https://www.transfermarkt.de/schnellsuche/ergebnis/schnellsuche?query=${q}` },
  { name: "FotMob", url: q => `https://www.fotmob.com/search?term=${q}` },
  { name: "Sofascore", url: q => `https://www.sofascore.com/search?q=${q}` },
  { name: "FBref", url: q => `https://fbref.com/en/search/search.fcgi?search=${q}` },
  { name: "Google", url: q => `https://www.google.com/search?q=${q}+fussball` },
];

function tabExterneQuellen(p) {
  const suchbegriff = encodeURIComponent(`${p.vorname} ${p.nachname} ${p.verein || ""}`.trim());
  const eintraege = p.externeQuellen || [];
  return `
  <div class="card mb">
    <h3>Spieler auf externen Seiten nachschlagen</h3>
    <div style="font-size:12.5px;color:var(--muted);margin-bottom:12px">
      Öffnet die Suche nach "${esc(p.vorname)} ${esc(p.nachname)}" auf der jeweiligen Seite in einem neuen Tab.
      Werte, die du dort siehst, kannst du unten manuell erfassen — so bleibt alles an einem Ort.
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${EXTERNE_QUELLEN.map(q => `<a class="btn btn-secondary btn-sm" href="${q.url(suchbegriff)}" target="_blank" rel="noopener">${esc(q.name)} öffnen ↗</a>`).join("")}
    </div>
  </div>
  <div class="flex-between mb">
    <h3 style="margin:0">Erfasste externe Werte</h3>
    <button class="btn btn-sm" onclick="modalNeueExterneQuelle('${p.id}')">+ Wert erfassen</button>
  </div>
  ${eintraege.length ? `<div class="card"><table><thead><tr>
    <th>Quelle</th><th>Feld</th><th>Wert</th><th>Datum</th><th></th>
  </tr></thead><tbody>
    ${eintraege.map((e, i) => `<tr>
      <td><span class="tag">${esc(e.quelle)}</span></td>
      <td>${esc(e.feld)}</td>
      <td><strong>${esc(e.wert)}</strong></td>
      <td style="color:var(--muted)">${fmtDatum(e.datum)}</td>
      <td>
        ${e.feld === "Marktwert" ? `<button class="btn btn-sm btn-secondary" onclick="externWertUebernehmen('${p.id}',${i})">In Profil übernehmen</button>` : ""}
        <button class="btn btn-sm btn-ghost" style="color:var(--rot);border-color:var(--rot)" onclick="externWertLoeschen('${p.id}',${i})">Löschen</button>
      </td>
    </tr>`).join("")}
  </tbody></table></div>` : `<div class="card"><div class="empty">Noch keine externen Werte erfasst.</div></div>`}
  `;
}

function modalNeueExterneQuelle(id) {
  const QUELLEN_NAMEN = EXTERNE_QUELLEN.map(q => q.name).concat("Wyscout", "Sonstige");
  zeigeModal(`
    <h2>Externen Wert erfassen</h2>
    <form id="modal-form">
      <div class="form-grid">
        ${feld("Quelle *", "quelle", "text", "required", QUELLEN_NAMEN)}
        ${feld("Feld *", "feld", "text", 'required placeholder="z.B. Marktwert, xG, FotMob-Rating"')}
        ${feld("Wert *", "wert", "text", 'required placeholder="z.B. 3,5 Mio € oder 7.2"')}
        ${feld("Datum *", "datum", "date", `required value="${HEUTE.toISOString().slice(0, 10)}"`)}
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" onclick="schliesseModal()">Abbrechen</button>
        <button type="submit" class="btn">Speichern</button>
      </div>
    </form>`, fd => {
    const p = findSpieler(id);
    if (!p.externeQuellen) p.externeQuellen = [];
    p.externeQuellen.push({ quelle: fd.get("quelle"), feld: fd.get("feld"), wert: fd.get("wert"), datum: fd.get("datum") });
    speichern();
    schliesseModal();
    viewSpielerDetail(id, "extern");
  });
}
window.modalNeueExterneQuelle = modalNeueExterneQuelle;

function externWertLoeschen(id, idx) {
  const p = findSpieler(id);
  p.externeQuellen.splice(idx, 1);
  speichern();
  viewSpielerDetail(id, "extern");
}
window.externWertLoeschen = externWertLoeschen;

function externWertUebernehmen(id, idx) {
  const p = findSpieler(id);
  const eintrag = p.externeQuellen[idx];
  const zahl = +String(eintrag.wert).replace(/[^\d,.]/g, "").replace(",", ".");
  if (!isNaN(zahl) && zahl > 0) {
    const multi = /mio/i.test(eintrag.wert) ? 1000000 : /tsd|k€/i.test(eintrag.wert) ? 1000 : 1;
    p.marktwert = Math.round(zahl * multi);
    speichern();
    toast(`Marktwert von ${eintrag.quelle} übernommen: ${fmtMarktwert(p.marktwert)}`);
    viewSpielerDetail(id, "extern");
  } else {
    toast("Wert konnte nicht als Zahl erkannt werden — bitte im Profil-Tab manuell eintragen.");
  }
}
window.externWertUebernehmen = externWertUebernehmen;

function tabNotizen(p) {
  const kannBearbeiten = hatRecht("spieler_bearbeiten");
  return `<div class="card">
    <div class="flex-between mb">
      <h3 style="margin:0">Notizen & interne Einschätzung</h3>
      <span style="font-size:12px;color:var(--muted)">Nur intern sichtbar</span>
    </div>
    <textarea id="notizen-ta" rows="16"
      style="width:100%;box-sizing:border-box;border:1px solid var(--border);border-radius:8px;padding:14px;background:var(--bg-card);color:var(--text);font-size:14px;line-height:1.65;resize:vertical;font-family:inherit"
      placeholder="Persönliche Notizen – z.B. Beobachtungshinweise, Gesprächsnotizen, Einschätzungen…"
      ${kannBearbeiten ? "" : "readonly"}>${esc(p.notizen || "")}</textarea>
    ${kannBearbeiten ? `<div class="modal-actions" style="margin-top:12px">
      <button class="btn" onclick="notizenSpeichern('${p.id}',document.getElementById('notizen-ta').value)">💾 Notiz speichern</button>
    </div>` : ""}
  </div>`;
}
function notizenSpeichern(id, text) {
  const p = findSpieler(id);
  if (!p) return;
  p.notizen = text;
  speichern();
  toast("Notiz gespeichert.");
}
window.notizenSpeichern = notizenSpeichern;

function tabVideos(p) {
  return `<div class="flex-between mb">
    <h3 style="margin:0">Video-Modul</h3>
    ${hatRecht("videos") ? `<button class="btn btn-sm" onclick="modalNeuesVideo('${p.id}')">+ Video verlinken</button>` : ""}
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
      <div class="sub">Spieler per Auswahl zwischen den Listen verschieben</div></div>
      ${hatRecht("csv_export") ? `<button class="btn btn-secondary" onclick="exportiereCSV(SPIELER.filter(p=>p.pool!=='archiv'),'talentpool')">CSV exportieren</button>` : ""}
    </div>
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
            ${key !== "archiv" ? `<button class="btn btn-ghost btn-sm" style="color:var(--muted);margin-top:6px;width:100%;font-size:11.5px" onclick="setPool('${p.id}','archiv')">✕ Archivieren</button>` : ""}
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

// ---------- Profilsuche ("Profil zusammenklicken") ----------
let psKriterien = {
  position: "", minJahrgang: "", maxJahrgang: "",
  maxMarktwert: "", vertragsendeVor: "",
  minGesamt: "", minPotenzial: "", minXg: "", minXa: "", minTore: "", minAssists: "",
};

function fmtMarktwert(w) {
  if (w == null || w === "") return "–";
  if (w >= 1000000) return (w / 1000000).toFixed(1).replace(".0", "") + " Mio €";
  if (w >= 1000) return Math.round(w / 1000) + " Tsd €";
  return w + " €";
}

function viewProfilsuche() {
  const alleJahrgaenge = [...new Set(SPIELER.map(jahrgang).filter(j => j !== "–"))].sort();

  main.innerHTML = `
    <div class="page-header">
      <div><h1>🔍 Profilsuche</h1>
        <div class="sub">Kriterien zusammenklicken — durchsucht eigene Scout-Datenbank + importierte Referenzspieler</div></div>
    </div>
    <div class="card mb">
      <h3>Suchprofil</h3>
      <div class="form-grid">
        <div class="field"><label>Position</label>
          <select id="ps-position"><option value="">Alle</option>${POSITIONEN.map(p => `<option ${psKriterien.position === p ? "selected" : ""}>${p}</option>`).join("")}</select></div>
        <div class="field"><label>Jahrgang von</label>
          <select id="ps-minJahrgang"><option value="">Egal</option>${alleJahrgaenge.map(j => `<option ${psKriterien.minJahrgang === j ? "selected" : ""}>${j}</option>`).join("")}</select></div>
        <div class="field"><label>Jahrgang bis</label>
          <select id="ps-maxJahrgang"><option value="">Egal</option>${alleJahrgaenge.map(j => `<option ${psKriterien.maxJahrgang === j ? "selected" : ""}>${j}</option>`).join("")}</select></div>
        <div class="field"><label>Marktwert max. (€)</label>
          <input id="ps-maxMarktwert" type="number" min="0" step="50000" placeholder="z.B. 5000000" value="${psKriterien.maxMarktwert}"></div>
        <div class="field"><label>Vertragsende vor</label>
          <input id="ps-vertragsendeVor" type="date" value="${psKriterien.vertragsendeVor}"></div>
        <div class="field"><label>Min. Gesamt-Score</label>
          <input id="ps-minGesamt" type="number" min="0" max="100" value="${psKriterien.minGesamt}"></div>
        <div class="field"><label>Min. Potenzial-Score</label>
          <input id="ps-minPotenzial" type="number" min="0" max="100" value="${psKriterien.minPotenzial}"></div>
        <div class="field"><label>Min. xG <span class="badge badge-gelb" style="font-size:9.5px">Exp.</span></label>
          <input id="ps-minXg" type="number" min="0" step="0.1" value="${psKriterien.minXg}"></div>
        <div class="field"><label>Min. xA <span class="badge badge-gelb" style="font-size:9.5px">Exp.</span></label>
          <input id="ps-minXa" type="number" min="0" step="0.1" value="${psKriterien.minXa}"></div>
        <div class="field"><label>Min. Tore</label>
          <input id="ps-minTore" type="number" min="0" value="${psKriterien.minTore}"></div>
        <div class="field"><label>Min. Assists</label>
          <input id="ps-minAssists" type="number" min="0" value="${psKriterien.minAssists}"></div>
      </div>
      <div class="mt"><button class="btn btn-secondary btn-sm" id="ps-reset">Kriterien zurücksetzen</button></div>
    </div>
    <div id="ps-ergebnis"></div>
  `;

  const ids = ["position", "minJahrgang", "maxJahrgang", "maxMarktwert", "vertragsendeVor", "minGesamt", "minPotenzial", "minXg", "minXa", "minTore", "minAssists"];
  for (const k of ids) {
    $(`#ps-${k}`).addEventListener("input", e => { psKriterien[k] = e.target.value; renderPsErgebnis(); });
    $(`#ps-${k}`).addEventListener("change", e => { psKriterien[k] = e.target.value; renderPsErgebnis(); });
  }
  $("#ps-reset").addEventListener("click", () => {
    psKriterien = { position: "", minJahrgang: "", maxJahrgang: "", maxMarktwert: "", vertragsendeVor: "", minGesamt: "", minPotenzial: "", minXg: "", minXa: "", minTore: "", minAssists: "" };
    viewProfilsuche();
  });
  renderPsErgebnis();
}

function psPasstKriterien(p) {
  const k = psKriterien;
  const xg = p.sbRef?.xg ?? null, xa = p.sbRef?.xa ?? null, tore = p.sbRef?.tore ?? 0, assists = p.sbRef?.assists ?? 0;

  if (k.position && p.hauptposition !== k.position && !p.nebenpositionen.includes(k.position)) return false;
  if (k.minJahrgang && jahrgang(p) !== "–" && jahrgang(p) < k.minJahrgang) return false;
  if (k.maxJahrgang && jahrgang(p) !== "–" && jahrgang(p) > k.maxJahrgang) return false;
  if (k.maxMarktwert && (p.marktwert == null || p.marktwert > +k.maxMarktwert)) return false;
  if (k.vertragsendeVor && (!p.vertragsende || p.vertragsende > k.vertragsendeVor)) return false;
  if (k.minGesamt && gesamtScore(p) < +k.minGesamt) return false;
  if (k.minPotenzial && potenzialScore(p) < +k.minPotenzial) return false;
  if (k.minXg && (xg == null || xg < +k.minXg)) return false;
  if (k.minXa && (xa == null || xa < +k.minXa)) return false;
  if (k.minTore && tore < +k.minTore) return false;
  if (k.minAssists && assists < +k.minAssists) return false;
  return true;
}

function renderPsErgebnis() {
  const box = $("#ps-ergebnis");
  if (!box) return;
  const treffer = SPIELER.filter(psPasstKriterien).sort((a, b) => fortunaFit(b) - fortunaFit(a));
  const irgendeinKriteriumGesetzt = Object.values(psKriterien).some(v => v !== "");

  if (!irgendeinKriteriumGesetzt) {
    box.innerHTML = `<div class="card"><div class="empty">Stelle mindestens ein Kriterium ein, um passende Spieler zu finden.</div></div>`;
    return;
  }

  box.innerHTML = `<div class="card">
    <div class="flex-between mb"><h3 style="margin:0">Treffer (${treffer.length})</h3>
      <span style="font-size:12px;color:var(--muted)">Sortiert nach Fortuna-Fit</span></div>
    ${treffer.length ? `<table><thead><tr>
      <th>Spieler</th><th>Position</th><th>Jahrgang</th><th>Marktwert</th><th>Vertragsende</th>
      <th>Gesamt</th><th>Potenzial</th><th>Fit</th><th>Tore/xG</th><th>Assists/xA</th>
    </tr></thead><tbody>
      ${treffer.map(p => `<tr onclick="location.hash='#/spieler/${p.id}'">
        <td><strong>${esc(p.vorname)} ${esc(p.nachname)}</strong></td>
        <td>${esc(p.hauptposition)}</td>
        <td>${jahrgang(p)}</td>
        <td>${fmtMarktwert(p.marktwert)}</td>
        <td>${fmtDatum(p.vertragsende)}</td>
        <td>${scorePill(gesamtScore(p))}</td>
        <td>${scorePill(potenzialScore(p))}</td>
        <td>${scorePill(fortunaFit(p))}</td>
        <td>${p.sbRef ? `${p.sbRef.tore} / ${p.sbRef.xg ?? "–"}` : "–"}</td>
        <td>${p.sbRef ? `${p.sbRef.assists} / ${p.sbRef.xa ?? "–"}` : "–"}</td>
      </tr>`).join("")}
    </tbody></table>` : `<div class="empty">Keine Spieler erfüllen aktuell diese Kriterien.</div>`}
  </div>`;
}

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

// Nicht-blockierende Benachrichtigung (statt confirm()/alert())
function toast(text, aktion) {
  const id = "toast-" + Date.now();
  const div = document.createElement("div");
  div.id = id;
  div.style.cssText = "position:fixed;bottom:24px;right:24px;background:#1c1e21;color:#fff;padding:14px 18px;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.25);z-index:200;font-size:13.5px;display:flex;gap:14px;align-items:center;max-width:360px";
  div.innerHTML = `<span>${esc(text)}</span>${aktion ? `<button class="btn btn-sm" style="white-space:nowrap" onclick="${aktion.onclick}">${esc(aktion.label)}</button>` : ""}`;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 6000);
}
window.toast = toast;

function feld(label, name, typ = "text", attrs = "", optionen = null, selected = null) {
  if (optionen) return `<div class="field"><label>${label}</label><select name="${name}" ${attrs}>${optionen.map(o => `<option ${selected === o ? "selected" : ""}>${o}</option>`).join("")}</select></div>`;
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
      berater: fd.get("berater") || "", kontakt: fd.get("kontakt") || "", marktwert: null,
      pool: "beobachten", trialStatus: "Keine", trialUrteil: "",
      erstelltAm: HEUTE.toISOString().slice(0, 10),
      ratings: leereRatings(), videos: [], berichte: [], entwicklung: [],
    };
    neu.notizen = "";
    neu.statistiken = {};
    SPIELER.push(neu);
    speichern();
    schliesseModal();
    location.hash = `#/spieler/${neu.id}`;
  });
}
window.modalNeuerSpieler = modalNeuerSpieler;

function modalSpielerBearbeiten(id) {
  const p = findSpieler(id);
  if (!p) return;
  zeigeModal(`
    <h2>Spieler bearbeiten – ${esc(p.vorname)} ${esc(p.nachname)}</h2>
    <form id="modal-form">
      <div class="form-grid">
        ${feld("Vorname *", "vorname", "text", `required value="${esc(p.vorname)}"`)}
        ${feld("Nachname *", "nachname", "text", `required value="${esc(p.nachname)}"`)}
        ${feld("Geburtsdatum *", "geburtsdatum", "date", `required value="${p.geburtsdatum || ""}"`)}
        ${feld("Nationalität", "nationalitaet", "text", `value="${esc(p.nationalitaet || "")}"`)}
        ${feld("Talent-Kategorie", "talent", "text", "", ["", "A", "B", "C"], p.talent || "")}
        ${feld("Verein *", "verein", "text", `required value="${esc(p.verein)}"`)}
        ${feld("Liga", "liga", "text", `value="${esc(p.liga || "")}"`)}
        ${feld("Verband", "verband", "text", `value="${esc(p.verband || "")}"`)}
        ${feld("Größe (cm)", "groesse", "number", `value="${p.groesse || ""}"`)}
        ${feld("Gewicht (kg)", "gewicht", "number", `value="${p.gewicht || ""}"`)}
        ${feld("Starker Fuß", "starkerFuss", "text", "", ["Rechts", "Links", "Beidfüßig"])}
        ${feld("Schwacher Fuß (1–5)", "schwacherFuss", "number", `min="1" max="5" value="${p.schwacherFuss || 3}"`)}
        ${feld("Hauptposition *", "hauptposition", "text", "required", POSITIONEN)}
        ${feld("Vertragsstatus", "vertragsstatus", "text", `value="${esc(p.vertragsstatus || "")}"`)}
        ${feld("Vertragsende", "vertragsende", "date", `value="${p.vertragsende || ""}"`)}
        ${feld("Berater", "berater", "text", `value="${esc(p.berater || "")}"`)}
        ${feld("Kontakt", "kontakt", "text", `value="${esc(p.kontakt || "")}"`)}
      </div>
      <div class="field mt"><label>Nebenpositionen (Mehrfachauswahl mit Strg)</label>
        <select name="nebenpositionen" multiple size="4">${POSITIONEN.map(pos => `<option ${(p.nebenpositionen||[]).includes(pos) ? "selected" : ""}>${pos}</option>`).join("")}</select>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" onclick="schliesseModal()">Abbrechen</button>
        <button type="submit" class="btn">Änderungen speichern</button>
      </div>
    </form>`, fd => {
    p.vorname = fd.get("vorname");
    p.nachname = fd.get("nachname");
    p.geburtsdatum = fd.get("geburtsdatum");
    p.nationalitaet = fd.get("nationalitaet") || "Deutschland";
    p.talent = fd.get("talent") || "";
    p.verein = fd.get("verein");
    p.liga = fd.get("liga") || "";
    p.verband = fd.get("verband") || "";
    p.groesse = +fd.get("groesse") || 0;
    p.gewicht = +fd.get("gewicht") || 0;
    p.starkerFuss = fd.get("starkerFuss");
    p.schwacherFuss = Math.min(5, Math.max(1, +fd.get("schwacherFuss") || 3));
    p.hauptposition = fd.get("hauptposition");
    p.nebenpositionen = fd.getAll("nebenpositionen");
    p.vertragsstatus = fd.get("vertragsstatus") || "";
    p.vertragsende = fd.get("vertragsende") || "";
    p.berater = fd.get("berater") || "";
    p.kontakt = fd.get("kontakt") || "";
    speichern();
    schliesseModal();
    toast("Spielerprofil gespeichert.");
    viewSpielerDetail(id, aktiverTab);
  });
  setTimeout(() => {
    const sfSel = document.querySelector('[name="starkerFuss"]');
    if (sfSel) sfSel.value = p.starkerFuss || "Rechts";
    const hpSel = document.querySelector('[name="hauptposition"]');
    if (hpSel) hpSel.value = p.hauptposition || "";
  }, 0);
}
window.modalSpielerBearbeiten = modalSpielerBearbeiten;

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
  const cacheObj = cached ? JSON.parse(localStorage.getItem("statsbomb-bundesliga-v3") || "{}") : null;
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
      <div style="font-size:12.5px;color:var(--muted);margin-bottom:10px">${gefiltert.length} Spieler gefunden · xG/xA aus echtem StatsBomb-Modell (kein Scraping)</div>
      ${gefiltert.length ? `<table><thead><tr>
        <th>Spieler</th><th>Nation</th><th>Position</th><th>Team(s)</th><th>Einsätze</th><th>Tore</th><th>xG</th><th>Assists</th><th>xA</th><th>Pass%</th><th>Aktion</th>
      </tr></thead><tbody>
        ${gefiltert.map(s => `<tr>
          <td><strong>${esc(s.name)}</strong>${s.nickname ? `<br><span style="font-size:11.5px;color:var(--muted)">"${esc(s.nickname)}"</span>` : ""}</td>
          <td><span class="tag">${esc(s.nationalitaet)}</span></td>
          <td>${esc(s.hauptposition)}</td>
          <td style="font-size:12.5px">${s.teams.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</td>
          <td>${s.einsaetze}</td>
          <td>${s.tore > 0 ? `<strong style="color:var(--gruen)">${s.tore}</strong>` : "–"}</td>
          <td>${s.xg ?? "–"}</td>
          <td>${s.assists > 0 ? `<strong>${s.assists}</strong>` : "–"}</td>
          <td>${s.xa ?? "–"}</td>
          <td>${s.passQuote != null ? s.passQuote + "%" : "–"}</td>
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
  const cacheObj = JSON.parse(localStorage.getItem("statsbomb-bundesliga-v3") || "{}");
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
    vertragsstatus: "", vertragsende: sbSp.vertragsende || "", berater: "", kontakt: "", marktwert: sbSp.marktwert ?? null,
    pool: "beobachten", trialStatus: "Keine", trialUrteil: "",
    erstelltAm: HEUTE.toISOString().slice(0, 10),
    ratings: leereRatings(),
    videos: [], berichte: [], entwicklung: [],
    sbRef: { tore: sbSp.tore, assists: sbSp.assists, schuesse: sbSp.schuesse, einsaetze: sbSp.einsaetze, xg: sbSp.xg, xa: sbSp.xa, passQuote: sbSp.passQuote },
  };

  if (SPIELER.find(p => p.id === neu.id)) {
    toast(`${sbSp.name} ist bereits in der Scout-Datenbank.`);
    return;
  }

  SPIELER.push(neu);
  speichern();
  toast(`${sbSp.name} zur Scout-Datenbank hinzugefügt.`, { label: "Profil öffnen", onclick: `location.hash='#/spieler/${neu.id}'` });
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
  const cacheObj = JSON.parse(localStorage.getItem("statsbomb-bundesliga-v3") || "{}");
  const container = document.querySelector(".card:last-child");
  if (!container || !cacheObj.spieler) return;
  // Re-render nur die Tabelle
  const wrap = document.createElement("div");
  wrap.innerHTML = sbSpielertabelle(cacheObj);
  // Ersetze Content-Card (letzte)
  main.querySelector("#sb-progress")?.remove();
  viewBundesliga();
}

// ---------- Administration ----------
let adminTab = "benutzer";

function viewAdmin() {
  const nutzer = aktuellerNutzer();
  if (nutzer?.rolle !== "Administrator") {
    main.innerHTML = `<div class="card mt"><div class="empty">🔒 Kein Zugriff – nur für Administratoren.</div></div>`;
    return;
  }
  main.innerHTML = `
    <div class="page-header">
      <div><h1>⚙️ Administration</h1>
        <div class="sub">Benutzerverwaltung &amp; System-Konfiguration</div></div>
    </div>
    <div class="tabs">
      ${[["benutzer","👥 Benutzerverwaltung"],["score","⭐ Fortuna-Score"],["rechte","🔐 Berechtigungen"],["daten","💾 Datenverwaltung"]]
        .map(([k,t]) => `<button class="${adminTab===k?"active":""}" onclick="switchAdminTab('${k}')">${t}</button>`).join("")}
    </div>
    <div id="admin-tab-inhalt"></div>`;
  renderAdminTab();
}
window.viewAdmin = viewAdmin;

function switchAdminTab(tab) { adminTab = tab; renderAdminTab(); }
window.switchAdminTab = switchAdminTab;

function renderAdminTab() {
  const el = document.getElementById("admin-tab-inhalt");
  if (!el) return;
  if (adminTab === "benutzer") el.innerHTML = adminTabBenutzer();
  else if (adminTab === "score") el.innerHTML = adminTabScore();
  else if (adminTab === "daten") el.innerHTML = adminTabDaten();
  else el.innerHTML = adminTabBerechtigungen();
}
window.renderAdminTab = renderAdminTab;

function adminTabBenutzer() {
  const ich = aktuellerNutzer()?.nutzername;
  return `
    <div class="warnung" style="margin-top:16px">
      <strong>Neue Nutzer einrichten:</strong> Erstelle zunächst die Zugänge, dann klicke <em>Setup-Link erstellen</em> und sende den Link an die Person. Beim ersten Öffnen werden die Zugangsdaten automatisch in deren Browser geladen.
    </div>
    <div class="flex-between mb">
      <h3 style="margin:0">Zugänge (${BENUTZER.length})</h3>
      <div style="display:flex;gap:8px">
        <button class="btn btn-sm btn-secondary" onclick="setupLinkErstellen()">🔗 Setup-Link erstellen</button>
        <button class="btn btn-sm" onclick="modalNeuerBenutzer()">+ Neuer Zugang</button>
      </div>
    </div>
    <div class="card">
      <table><thead><tr><th>Nutzername</th><th>Rolle</th><th>Status</th><th>Aktionen</th></tr></thead><tbody>
        ${BENUTZER.map(u => `<tr>
          <td><strong>${esc(u.nutzername)}</strong>${u.nutzername === ich ? ' <span class="badge badge-gruen" style="font-size:10px">Du</span>' : ""}</td>
          <td><select onchange="benutzerRolleSetzen('${esc(u.nutzername)}',this.value)" ${u.nutzername === ich ? "disabled" : ""}
              style="padding:4px 6px;border-radius:6px;border:1px solid var(--border)">
            ${ROLLEN.map(r => `<option ${u.rolle===r?"selected":""}>${r}</option>`).join("")}
          </select></td>
          <td><span class="badge ${u.gesperrt?"badge-grau":"badge-gruen"}">${u.gesperrt?"Gesperrt":"Aktiv"}</span></td>
          <td style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
            <button class="btn btn-sm btn-secondary" onclick="modalPasswortAendern('${esc(u.nutzername)}')">Passwort ändern</button>
            ${u.nutzername !== ich ? `
              <button class="btn btn-sm ${u.gesperrt?"":"btn-ghost"}" style="${u.gesperrt?"":"color:var(--rot);border-color:var(--rot)"}"
                onclick="benutzerSperren('${esc(u.nutzername)}',${!u.gesperrt})">
                ${u.gesperrt?"✓ Entsperren":"⊘ Sperren"}
              </button>
              <button class="btn btn-sm btn-ghost" style="color:var(--muted)" onclick="benutzerLoeschen('${esc(u.nutzername)}')">✕</button>` : ""}
          </td>
        </tr>`).join("")}
      </tbody></table>
    </div>`;
}

function adminTabScore() {
  const cfg = SCORE_CONFIG;
  const allKeys = ["technik","taktik","athletik","mentalitaet",...STAT_KRITERIEN.map(k=>k.id)];
  const gesamt = allKeys.reduce((s,k) => s + (cfg[k]||0), 0);
  const ok = gesamt === 100;
  return `
    <div class="card mt">
      <h3>Fortuna-Fit Gewichtung</h3>
      <p style="font-size:13px;color:var(--muted);margin-bottom:20px">
        Der Fortuna-Fit-Score berechnet sich als gewichtetes Mittel aller aktiven Kriterien.
        Statistik-Kriterien mit Gewicht 0 werden ignoriert.
        Die Summe <strong>aller</strong> Gewichte muss genau 100 % ergeben.
      </p>

      <h4 style="margin:0 0 12px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)">Bewertungsgruppen</h4>
      <div class="form-grid">
        ${["technik","taktik","athletik","mentalitaet"].map(k => `
          <div class="field">
            <label>${RATING_MODELL[k].titel}
              <strong style="color:var(--rot);margin-left:6px" id="sc-${k}-val">${cfg[k]||0}%</strong>
            </label>
            <input type="range" min="0" max="100" value="${cfg[k]||0}" id="sc-${k}"
              oninput="scoreSliderUpdate('${k}',this.value)" style="width:100%">
          </div>`).join("")}
      </div>

      <h4 style="margin:24px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)">Statistik-Kriterien</h4>
      <p style="font-size:12px;color:var(--muted);margin-bottom:12px">Gewicht 0 = deaktiviert. Referenzwert = Maximalwert für Normalisierung auf 100 %.</p>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${STAT_KRITERIEN.map(kr => {
          const w = cfg[kr.id] || 0;
          const ref = cfg["ref_" + kr.feld] || kr.refDefault;
          return `<div style="display:grid;grid-template-columns:1fr 140px;gap:12px;align-items:center;padding:10px 14px;border:1px solid var(--border);border-radius:8px;background:${w>0?"rgba(211,25,32,.06)":"transparent"}">
            <div>
              <div style="font-size:13px;font-weight:600;margin-bottom:4px">${kr.label}${kr.invers ? ` <span style="font-size:11px;font-weight:400;color:var(--muted)">(invers)</span>` : ""}</div>
              <div style="display:flex;align-items:center;gap:8px">
                <input type="range" min="0" max="50" value="${w}" id="sc-${kr.id}"
                  oninput="scoreSliderUpdate('${kr.id}',this.value)" style="flex:1;accent-color:var(--rot)">
                <strong style="color:var(--rot);min-width:30px;text-align:right" id="sc-${kr.id}-val">${w}%</strong>
              </div>
            </div>
            <div>
              <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:4px">Referenzwert (${kr.einheit})</label>
              <input type="number" min="0.01" step="any" value="${ref}"
                onchange="scoreRefUpdate('${kr.feld}',this.value)"
                style="width:100%;border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:13px;background:var(--bg-card);color:var(--text)">
            </div>
          </div>`;
        }).join("")}
      </div>

      <div style="margin-top:20px;font-size:14px;font-weight:600" id="score-summe">
        Summe: <span style="color:${ok?"var(--gruen)":"var(--rot)"}">${gesamt}%</span>
        ${ok ? "" : "&nbsp;⚠️ muss 100 ergeben"}
      </div>
      <div style="margin-top:6px;font-size:12px;color:var(--muted)">
        Standard: Technik 10 % · Taktik 25 % · Athletik 20 % · Mentalität 45 % · Alle Statistiken 0 %
      </div>
      <div class="modal-actions" style="margin-top:16px">
        <button class="btn btn-secondary" onclick="scoreZuruecksetzen()">Standard wiederherstellen</button>
        <button class="btn" id="score-speichern-btn" onclick="scoreSpeichern()" ${ok ? "" : "disabled"}>✓ Speichern &amp; anwenden</button>
      </div>
    </div>`;
}

function adminTabBerechtigungen() {
  const gesteuerteRollen = ROLLEN.filter(r => r !== "Administrator");
  return `
    <div class="card mt">
      <h3>Berechtigungen pro Rolle</h3>
      <p style="font-size:13px;color:var(--muted);margin-bottom:16px">
        Legt fest, welche Funktionen jede Rolle nutzen darf.
        Administratoren haben immer Vollzugriff. Änderungen greifen sofort.
      </p>
      <div style="overflow-x:auto">
        <table class="compare-table">
          <thead><tr>
            <th style="text-align:left;min-width:220px">Berechtigung</th>
            ${gesteuerteRollen.map(r => `<th style="text-align:center">${r}</th>`).join("")}
          </tr></thead>
          <tbody>
            ${ALLE_RECHTE.map(recht => `<tr>
              <td style="font-size:13px">${esc(recht.label)}</td>
              ${gesteuerteRollen.map(rolle => {
                const hat = (BERECHTIGUNGEN[rolle] || []).includes(recht.id);
                return `<td style="text-align:center">
                  <input type="checkbox" ${hat ? "checked" : ""}
                    onchange="rechtToggle('${rolle}','${recht.id}',this.checked)"
                    style="width:16px;height:16px;cursor:pointer;accent-color:var(--rot)">
                </td>`;
              }).join("")}
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
      <div class="modal-actions" style="margin-top:20px">
        <button class="btn btn-secondary" onclick="berechtigungenZuruecksetzen()">Standard wiederherstellen</button>
      </div>
    </div>`;
}

function rechtToggle(rolle, rechtId, aktiv) {
  if (!BERECHTIGUNGEN[rolle]) BERECHTIGUNGEN[rolle] = [];
  if (aktiv) {
    if (!BERECHTIGUNGEN[rolle].includes(rechtId)) BERECHTIGUNGEN[rolle].push(rechtId);
  } else {
    BERECHTIGUNGEN[rolle] = BERECHTIGUNGEN[rolle].filter(r => r !== rechtId);
  }
  speichereBerechtigungen(BERECHTIGUNGEN);
  const recht = ALLE_RECHTE.find(r => r.id === rechtId);
  toast(`„${recht?.label || rechtId}" für ${rolle} ${aktiv ? "aktiviert" : "deaktiviert"}.`);
  updateNav();
}
window.rechtToggle = rechtToggle;

function adminTabDaten() {
  return `
    <div class="card mt">
      <h3>🗑️ Datenverwaltung</h3>
      <p style="font-size:13px;color:var(--muted);margin-bottom:16px">
        Verwalte die komplette Spielerdatenbank.
      </p>
      <div class="warnung gruen" style="margin-bottom:20px">
        <strong>Aktuelle Datenbank:</strong> ${SPIELER.length} Spieler
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn" style="background:var(--rot);border-color:var(--rot);color:#fff" onclick="modalDatenbankLoeschen()">
          🗑️ Komplette Datenbank löschen
        </button>
      </div>
      <p style="font-size:12px;color:var(--muted);margin-top:12px">
        ⚠️ Diese Aktion kann nicht rückgängig gemacht werden. Du wirst zur Bestätigung aufgefordert.
      </p>
    </div>`;
}

function modalDatenbankLoeschen() {
  const root = document.getElementById("modal-root");
  root.innerHTML = `<div class="modal-backdrop"><div class="modal" style="max-width:500px">
    <h3 style="color:var(--rot)">⚠️ Datenbank löschen?</h3>
    <p style="margin:16px 0;color:var(--muted);line-height:1.6">
      <strong>Achtung!</strong> Dies löscht alle <strong>${SPIELER.length} Spieler</strong> aus der Datenbank.
      Diese Aktion <strong>kann nicht rückgängig gemacht werden</strong>.
    </p>
    <p style="margin:16px 0;font-size:13px">
      Um zu bestätigen, gib <strong style="font-family:monospace;background:var(--bg-card);padding:2px 4px;border-radius:3px">LÖSCHEN</strong> ein:
    </p>
    <input id="loeschen-confirm" type="text" placeholder="LÖSCHEN" autocomplete="off"
      style="width:100%;border:1px solid var(--border);border-radius:6px;padding:8px;background:var(--bg-card);color:var(--text);font-size:13px;margin-bottom:16px">
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="schliesseModal()">Abbrechen</button>
      <button class="btn" style="background:var(--rot);border-color:var(--rot)" onclick="datenbankLoeschenBestaetigt()" disabled id="loeschen-btn">
        Unwiderruflich löschen
      </button>
    </div>
  </div></div>`;
  const input = document.getElementById("loeschen-confirm");
  const btn = document.getElementById("loeschen-btn");
  input.addEventListener("input", () => {
    btn.disabled = input.value !== "LÖSCHEN";
  });
  input.focus();
  document.querySelector(".modal-backdrop").addEventListener("click", e => {
    if (e.target.classList.contains("modal-backdrop")) schliesseModal();
  });
}
window.modalDatenbankLoeschen = modalDatenbankLoeschen;

function datenbankLoeschenBestaetigt() {
  SPIELER = [];
  speichern();
  loescheFirebaseEintrag("spieler");
  _fbDb?.ref('spieler').remove();
  schliesseModal();
  toast("✓ Datenbank vollständig gelöscht. Du kannst jetzt neue Daten importieren.");
  renderAdminTab();
}
window.datenbankLoeschenBestaetigt = datenbankLoeschenBestaetigt;

function berechtigungenZuruecksetzen() {
  BERECHTIGUNGEN = JSON.parse(JSON.stringify(DEFAULT_BERECHTIGUNGEN));
  speichereBerechtigungen(BERECHTIGUNGEN);
  renderAdminTab();
  updateNav();
  toast("Berechtigungen auf Standard zurückgesetzt.");
}
window.berechtigungenZuruecksetzen = berechtigungenZuruecksetzen;

function benutzerRolleSetzen(nutzername, rolle) {
  const u = BENUTZER.find(b => b.nutzername === nutzername);
  if (u) { u.rolle = rolle; speichereBenutzer(); toast(`Rolle für ${nutzername} auf „${rolle}" geändert.`); }
}
window.benutzerRolleSetzen = benutzerRolleSetzen;

function benutzerSperren(nutzername, sperren) {
  const u = BENUTZER.find(b => b.nutzername === nutzername);
  if (u) { u.gesperrt = sperren; speichereBenutzer(); renderAdminTab(); toast(`${nutzername} wurde ${sperren?"gesperrt":"entsperrt"}.`); }
}
window.benutzerSperren = benutzerSperren;

function benutzerLoeschen(nutzername) {
  const root = $("#modal-root");
  root.innerHTML = `<div class="modal-backdrop"><div class="modal">
    <h2>Zugang löschen</h2>
    <p style="margin:16px 0">Soll der Zugang <strong>${esc(nutzername)}</strong> dauerhaft gelöscht werden?</p>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="schliesseModal()">Abbrechen</button>
      <button class="btn" style="background:var(--rot);border-color:var(--rot)" onclick="benutzerLoeschenBestaetigt('${esc(nutzername)}')">Löschen</button>
    </div>
  </div></div>`;
  $(".modal-backdrop").addEventListener("click", e => { if (e.target.classList.contains("modal-backdrop")) schliesseModal(); });
}
window.benutzerLoeschen = benutzerLoeschen;

function benutzerLoeschenBestaetigt(nutzername) {
  BENUTZER = BENUTZER.filter(b => b.nutzername !== nutzername);
  speichereBenutzer();
  schliesseModal();
  renderAdminTab();
  toast(`Zugang „${nutzername}" wurde gelöscht.`);
}
window.benutzerLoeschenBestaetigt = benutzerLoeschenBestaetigt;

function modalPasswortAendern(nutzername) {
  zeigeModal(`
    <h2>Passwort ändern – ${esc(nutzername)}</h2>
    <form id="modal-form">
      <div class="form-grid">
        ${feld("Neues Passwort *", "passwort", "password", 'required minlength="6" placeholder="Mind. 6 Zeichen"')}
        ${feld("Wiederholen *", "passwort2", "password", 'required minlength="6"')}
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" onclick="schliesseModal()">Abbrechen</button>
        <button type="submit" class="btn">Speichern</button>
      </div>
    </form>`, fd => {
    const pw = fd.get("passwort"), pw2 = fd.get("passwort2");
    if (pw !== pw2) { toast("Passwörter stimmen nicht überein."); return; }
    const u = BENUTZER.find(b => b.nutzername === nutzername);
    if (u) { u.passwort = pw; speichereBenutzer(); schliesseModal(); toast(`Passwort für „${nutzername}" geändert.`); }
  });
}
window.modalPasswortAendern = modalPasswortAendern;

function modalNeuerBenutzer() {
  zeigeModal(`
    <h2>Neuen Zugang anlegen</h2>
    <form id="modal-form">
      <div class="form-grid">
        ${feld("Nutzername *", "nutzername", "text", "required")}
        ${feld("Passwort *", "passwort", "password", 'required minlength="6" placeholder="Mind. 6 Zeichen"')}
        ${feld("Rolle *", "rolle", "text", "required", ROLLEN)}
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" onclick="schliesseModal()">Abbrechen</button>
        <button type="submit" class="btn">Anlegen</button>
      </div>
    </form>`, fd => {
    const nutzername = (fd.get("nutzername") || "").trim().toLowerCase();
    if (!nutzername) { toast("Nutzername darf nicht leer sein."); return; }
    if (BENUTZER.find(b => b.nutzername === nutzername)) { toast("Nutzername bereits vergeben."); return; }
    BENUTZER.push({ nutzername, passwort: fd.get("passwort"), rolle: fd.get("rolle"), gesperrt: false });
    speichereBenutzer();
    schliesseModal();
    renderAdminTab();
    toast(`Zugang „${nutzername}" wurde angelegt.`);
  });
}
window.modalNeuerBenutzer = modalNeuerBenutzer;

function scoreSliderUpdate(key, value) {
  SCORE_CONFIG[key] = +value;
  const valEl = document.getElementById(`sc-${key}-val`);
  if (valEl) valEl.textContent = (+value) + "%";
  const allKeys = ["technik","taktik","athletik","mentalitaet",...STAT_KRITERIEN.map(k=>k.id)];
  const gesamt = allKeys.reduce((s,k) => s + (SCORE_CONFIG[k]||0), 0);
  const ok = gesamt === 100;
  const sumEl = document.getElementById("score-summe");
  if (sumEl) sumEl.innerHTML = `Summe: <span style="color:${ok?"var(--gruen)":"var(--rot)"}">${gesamt}%</span>${ok?"":" &nbsp;⚠️ muss 100 ergeben"}`;
  const btn = document.getElementById("score-speichern-btn");
  if (btn) btn.disabled = !ok;
}
window.scoreSliderUpdate = scoreSliderUpdate;
function scoreRefUpdate(feld, value) {
  SCORE_CONFIG["ref_" + feld] = +value || 1;
}
window.scoreRefUpdate = scoreRefUpdate;

function scoreSpeichern() {
  speichereScoreConfig();
  toast("Fortuna-Score-Gewichtung gespeichert – alle Scores werden neu berechnet.");
  renderAdminTab();
}
window.scoreSpeichern = scoreSpeichern;

function scoreZuruecksetzen() {
  SCORE_CONFIG = { ...DEFAULT_SCORE_CONFIG };
  speichereScoreConfig();
  renderAdminTab();
  toast("Fortuna-Score auf Standardwerte zurückgesetzt.");
}
window.scoreZuruecksetzen = scoreZuruecksetzen;

// ---------- Spieler löschen ----------
function spielerLoeschen(id) {
  const p = findSpieler(id);
  if (!p) return;
  const root = $("#modal-root");
  root.innerHTML = `<div class="modal-backdrop"><div class="modal">
    <h2>Spieler löschen</h2>
    <p style="margin:16px 0">Soll <strong>${esc(p.vorname)} ${esc(p.nachname)}</strong> dauerhaft aus der Datenbank entfernt werden?<br>
    <span style="color:var(--rot);font-size:13px">Diese Aktion kann nicht rückgängig gemacht werden.</span></p>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="schliesseModal()">Abbrechen</button>
      <button class="btn" style="background:var(--rot);border-color:var(--rot)" onclick="spielerLoeschenBestaetigt('${id}')">Endgültig löschen</button>
    </div>
  </div></div>`;
  $(".modal-backdrop").addEventListener("click", e => { if (e.target.classList.contains("modal-backdrop")) schliesseModal(); });
}
window.spielerLoeschen = spielerLoeschen;

function spielerLoeschenBestaetigt(id) {
  const p = findSpieler(id);
  const name = p ? `${p.vorname} ${p.nachname}` : "Spieler";
  SPIELER = SPIELER.filter(s => s.id !== id);
  speichern();
  loescheFirebaseEintrag(id);
  schliesseModal();
  toast(`${name} wurde aus der Datenbank gelöscht.`);
  if (location.hash.startsWith("#/spieler/")) {
    location.hash = "#/spieler";
  } else {
    route();
  }
}
window.spielerLoeschenBestaetigt = spielerLoeschenBestaetigt;

// ---------- CSV-Export ----------
function exportiereCSV(spielerListe, dateiname) {
  const kopf = ["Vorname","Nachname","Position","Jahrgang","Verein","Liga","Pool","Gesamt","Potenzial","Fortuna-Fit","Marktwert (EUR)","Vertragsende","xG","xA","Tore","Assists"];
  const zeilen = spielerListe.map(p => [
    p.vorname, p.nachname, p.hauptposition, jahrgang(p), p.verein, p.liga,
    POOL_LISTEN[p.pool]?.titel || p.pool,
    gesamtScore(p), potenzialScore(p), fortunaFit(p),
    p.marktwert ?? "", p.vertragsende || "",
    p.sbRef?.xg ?? "", p.sbRef?.xa ?? "", p.sbRef?.tore ?? "", p.sbRef?.assists ?? "",
  ].map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));

  const csv = "﻿" + [kopf.join(","), ...zeilen].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fortuna-${dateiname}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast(`${spielerListe.length} Spieler als CSV exportiert.`);
}
window.exportiereCSV = exportiereCSV;

// ---------- CSV-Import ----------
let _csvKandidaten = null;

function csvImportieren() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv,text/csv";
  input.onchange = e => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => csvVerarbeitenUndPreview(ev.target.result);
    reader.readAsText(f, "UTF-8");
  };
  input.click();
}
window.csvImportieren = csvImportieren;

function csvZeilenParsern(text) {
  const clean = text.replace(/^﻿/, "");
  const sep = (clean.split("\n")[0] || "").includes(";") ? ";" : ",";
  return clean.split(/\r?\n/).filter(z => z.trim()).map(z => {
    const felder = [];
    let cur = "", inQ = false;
    for (let i = 0; i < z.length; i++) {
      const c = z[i];
      if (c === '"') { if (inQ && z[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
      else if (c === sep && !inQ) { felder.push(cur); cur = ""; }
      else cur += c;
    }
    felder.push(cur);
    return felder;
  });
}

function parsiereDatum(str) {
  if (!str || typeof str !== "string") return "";
  str = str.trim();
  // ISO-Format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // Deutsches Format DD.MM.YYYY oder DD/MM/YYYY
  const match = str.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return "";
}

function csvVerarbeitenUndPreview(text) {
  const zeilen = csvZeilenParsern(text);
  if (zeilen.length < 2) { toast("CSV enthält keine Daten."); return; }
  const kopf = zeilen[0].map(h => h.trim());
  const COL_MAP = {
    "Vorname": "vorname", "Nachname": "nachname", "Position": "hauptposition", "Torhüter/in": "hauptposition",
    "Verein": "verein", "Heimatverein": "verein", "Liga": "liga", "Pool": "pool",
    "Nationalität": "nationalitaet", "Nationalitaet": "nationalitaet", "Jahrgang": "jahrgang",
    "Geburtsdatum": "geburtsdatum", "Geburtstag": "geburtsdatum", "Geburt": "geburtsdatum", "Geb.datum": "geburtsdatum", "Geb": "geburtsdatum",
    "E-Mail": "kontakt", "Email": "kontakt", "E-Mail-Adresse": "kontakt",
    "Marktwert (EUR)": "marktwert", "Marktwert": "marktwert",
    "Vertragsende": "vertragsende", "Vertrag": "vertragsende",
    "Kommentar": "notizen", "Notizen": "notizen", "Anmerkungen": "notizen", "Besonderheiten": "notizen",
    "Talent-Kommentar": "notizen", "Talent Kommentar": "notizen", "Talent Beobachtung": "notizen", "Talent-Beobachtung": "notizen", "Beobachtung": "notizen",
    "Talent": "_talent", "Talent-Kategorie": "_talent", "Talent Kategorie": "_talent", "Talentbewertung": "_talent",
    "Größe": "groesse", "Groesse": "groesse", "Groeße": "groesse",
    "Gewicht": "gewicht",
    "Starker Fuß": "starkerFuss", "Starker Fuss": "starkerFuss",
    "xG": "_xg", "xA": "_xa", "Tore": "_tore", "Assists": "_vorlagen",
    "Laufleistung": "_lauf", "Karrierespiele": "_karriere",
  };
  // Case-insensitive Matching
  const cols = kopf.map(h => {
    const direktMatch = COL_MAP[h];
    if (direktMatch) return direktMatch;
    const lower = h.toLowerCase();
    for (const [key, val] of Object.entries(COL_MAP)) {
      if (key.toLowerCase() === lower) return val;
    }
    return null;
  });
  if (!cols.includes("vorname") || !cols.includes("nachname")) {
    toast('CSV: Pflichtfelder "Vorname" und "Nachname" nicht gefunden. Bitte Format prüfen.'); return;
  }
  const kandidaten = zeilen.slice(1).map(zeile => {
    const obj = {};
    cols.forEach((k, i) => { if (k) obj[k] = (zeile[i] || "").trim(); });
    return obj;
  }).filter(o => o.vorname && o.nachname);
  if (!kandidaten.length) { toast("Keine gültigen Zeilen gefunden."); return; }
  _csvKandidaten = kandidaten;

  const root = $("#modal-root");
  root.innerHTML = `<div class="modal-backdrop"><div class="modal" style="max-width:720px;width:95vw">
    <h2>CSV-Import · ${kandidaten.length} Spieler erkannt</h2>
    <p style="color:var(--muted);font-size:13px;margin:8px 0 16px">Vorschau der ersten 5 Zeilen. Spieler mit bereits vorhandenem Namen werden übersprungen.</p>
    <div style="overflow-x:auto;max-height:260px;overflow-y:auto;border:1px solid var(--border);border-radius:8px">
      <table style="font-size:12.5px;min-width:500px">
        <thead><tr><th>Vorname</th><th>Nachname</th><th>Position</th><th>Verein</th><th>Liga</th><th>Pool</th></tr></thead>
        <tbody>${kandidaten.slice(0, 5).map(c => `<tr>
          <td>${esc(c.vorname)}</td><td>${esc(c.nachname)}</td>
          <td>${esc(c.hauptposition||"–")}</td><td>${esc(c.verein||"–")}</td>
          <td>${esc(c.liga||"–")}</td><td>${esc(c.pool||"–")}</td>
        </tr>`).join("")}
        ${kandidaten.length > 5 ? `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:8px">… und ${kandidaten.length - 5} weitere</td></tr>` : ""}
        </tbody>
      </table>
    </div>
    <div class="modal-actions" style="margin-top:18px">
      <button class="btn btn-secondary" onclick="schliesseModal()">Abbrechen</button>
      <button class="btn" onclick="csvImportBestaetigen()">✓ ${kandidaten.length} Spieler importieren</button>
    </div>
  </div></div>`;
  $(".modal-backdrop").addEventListener("click", e => { if (e.target.classList.contains("modal-backdrop")) schliesseModal(); });
}

function csvImportBestaetigen() {
  const kandidaten = _csvKandidaten;
  if (!kandidaten) return;
  _csvKandidaten = null;
  const POOL_MAP = { "Beobachtung": "beobachten", "Probetraining": "probetraining", "Verpflichtung": "verpflichtung", "Archiv": "archiv" };
  let neu = 0;
  for (const k of kandidaten) {
    const exists = SPIELER.find(p =>
      p.vorname.toLowerCase() === k.vorname.toLowerCase() &&
      p.nachname.toLowerCase() === k.nachname.toLowerCase()
    );
    if (exists) continue;
    const geb = k.geburtsdatum ? parsiereDatum(k.geburtsdatum) : (k.jahrgang && /^\d{4}$/.test(k.jahrgang) ? k.jahrgang + "-07-01" : "");
    const stats = {};
    if (k._xg)       stats.xg       = +k._xg;
    if (k._xa)       stats.xa       = +k._xa;
    if (k._tore)     stats.tore     = +k._tore;
    if (k._vorlagen) stats.vorlagen = +k._vorlagen;
    if (k._lauf)     stats.lauf     = +k._lauf;
    if (k._karriere) stats.karriere = +k._karriere;
    SPIELER.push({
      id: "p" + Date.now() + Math.random().toString(36).slice(2, 6),
      vorname: k.vorname, nachname: k.nachname,
      geburtsdatum: geb, nationalitaet: k.nationalitaet || "Deutschland",
      verein: k.verein || "", liga: k.liga || "", verband: "",
      groesse: k.groesse ? +k.groesse : 0, gewicht: k.gewicht ? +k.gewicht : 0,
      starkerFuss: k.starkerFuss || "Rechts", schwacherFuss: 3,
      hauptposition: k.hauptposition || "Mittelfeld (Zentral)",
      nebenpositionen: [],
      vertragsstatus: "", vertragsende: k.vertragsende || "",
      berater: "", kontakt: k.kontakt || "",
      marktwert: k.marktwert ? (+k.marktwert || null) : null,
      talent: (k._talent && /^[ABC]$/.test(k._talent.toUpperCase())) ? k._talent.toUpperCase() : "",
      pool: POOL_MAP[k.pool] || "beobachten",
      trialStatus: "Keine", trialUrteil: "",
      erstelltAm: HEUTE.toISOString().slice(0, 10),
      ratings: leereRatings(), videos: [], berichte: [], entwicklung: [],
      notizen: k.notizen || "", statistiken: stats,
    });
    neu++;
  }
  speichern();
  schliesseModal();
  const skip = kandidaten.length - neu;
  toast(`${neu} Spieler importiert${skip ? ` · ${skip} übersprungen (Name vorhanden)` : ""}.`);
  viewSpielerListe();
}
window.csvImportBestaetigen = csvImportBestaetigen;

// ---------- Lade-Overlay ----------
function zeigeLadeOverlay(sichtbar) {
  let el = document.getElementById("lade-overlay");
  if (!el && sichtbar) {
    el = document.createElement("div");
    el.id = "lade-overlay";
    el.style.cssText = "position:fixed;inset:0;background:#13151a;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;gap:14px";
    el.innerHTML = '<div style="font-size:40px">⚽</div><div style="color:#fff;font-size:14px;font-weight:600">Verbindung zur Datenbank…</div><div style="color:#9ca3af;font-size:12px">Bitte kurz warten</div>';
    document.body.appendChild(el);
  }
  if (el) el.style.display = sichtbar ? "flex" : "none";
}

// ---------- App-Start ----------
function startApp() {
  const hatFirebase = initFirebase(
    function(liste) {        // Erste Daten angekommen
      if (liste.length === 0) {
        // Firebase ist leer → lokale Spieler einmalig hochladen (Migration)
        const lokal = ladeSpieler();
        if (lokal.length > 0) {
          SPIELER = lokal;
          speichereFirebase(SPIELER);
          toast("✅ " + lokal.length + " lokale Spieler in die Cloud-Datenbank übertragen.");
        } else {
          SPIELER = [];
        }
      } else {
        SPIELER = liste;
      }
      zeigeLadeOverlay(false);
      route();
    },
    function(liste) {        // Remote-Änderung durch anderen Nutzer
      SPIELER = liste;
      route();
    }
  );
  if (!hatFirebase) {
    // Kein Firebase konfiguriert – localStorage-Modus
    SPIELER = ladeSpieler();
    route();
  } else {
    zeigeLadeOverlay(true);
  }
}

// ---------- Init ----------
$("#resetData").addEventListener("click", () => {
  const root = $("#modal-root");
  root.innerHTML = `<div class="modal-backdrop"><div class="modal">
    <h2>Demodaten zurücksetzen?</h2>
    <p style="margin:16px 0">Alle Änderungen werden verworfen und die ursprünglichen Demodaten neu geladen.</p>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="schliesseModal()">Abbrechen</button>
      <button class="btn" onclick="schliesseModal();resetDemodaten();SPIELER=ladeSpieler();speichern();route()">Zurücksetzen</button>
    </div>
  </div></div>`;
  $(".modal-backdrop").addEventListener("click", e => { if (e.target.classList.contains("modal-backdrop")) schliesseModal(); });
});
startApp();
