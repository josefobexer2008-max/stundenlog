/**
 * Maturaprojekt Doppelhaushälfte – gemeinsamer Speicher in einer Google-Tabelle (Version 3).
 *
 * Blätter (werden automatisch angelegt):
 *   „Protokoll“      – alle Arbeitsstunden (lesbar wie eine Excel-Liste)
 *   „Fortschritt“    – Prozent je Person und Unterphase
 *   „Konfiguration“  – Personen, Phasen und die Unterphasen jeder Person (von der App verwaltet)
 * Ein Blatt „Einträge“ der alten Stunden-App wird von der App einmalig übernommen
 * und danach in „Einträge (alt)“ umbenannt (nichts wird gelöscht).
 *
 * Einrichtung bzw. Aktualisierung: siehe README.
 */

// Nur wer diesen Code kennt, kann lesen und eintragen. Eigenen Code eintragen!
const TEAM_CODE = "doppelhaus-2026";

const SH_LOG = "Protokoll";
const SH_PROGRESS = "Fortschritt";
const SH_CONFIG = "Konfiguration";
const SH_LEGACY = "Einträge";
const SH_LEGACY_DONE = "Einträge (alt)";

const LOG_HEAD = ["Datum", "Von", "Bis", "Stunden", "Person", "(frei)", "Phase", "Unterphase", "Tätigkeit", "ID", "Minuten", "Unterphasen-ID", "Personen-ID"];
const PROG_HEAD = ["Personen-ID", "Unterphasen-ID", "Prozent", "Person", "Unterphase", "Geändert von", "Geändert am"];

function doGet(e) {
  return run_(() => {
    checkCode_(e.parameter.key);
    return { ok: true, version: 3, ...readAll_() };
  });
}

function doPost(e) {
  return run_(() => {
    const req = JSON.parse(e.postData.contents);
    checkCode_(req.key);
    const lock = LockService.getScriptLock();
    lock.waitLock(25000);
    try {
      switch (req.action) {
        case "putConfig": putConfig_(req.id, req.data); break;
        case "putProgress": putProgress_(req.list); break;
        case "putEntries": putEntries_(req.list); break;
        case "delEntry": delEntry_(req.id); break;
        case "renamePerson": renamePerson_(req.from, req.to); break;
        case "archiveLegacy": archiveLegacy_(); break;
        default: throw new Error("Veraltete App-Version – bitte die Seite neu laden");
      }
    } finally {
      lock.releaseLock();
    }
    return { ok: true };
  });
}

function run_(fn) {
  let out;
  try { out = fn(); } catch (err) { out = { ok: false, error: String((err && err.message) || err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function checkCode_(key) {
  if (String(key || "") !== TEAM_CODE) throw new Error("Falscher Team-Code");
}

// ---------- Hilfen ----------
const ss_ = () => SpreadsheetApp.getActiveSpreadsheet();
function tz_() { return ss_().getSpreadsheetTimeZone(); }
// Google wandelt Datum/Uhrzeit in Datumswerte um – hier zurück in Text
function txt_(v, pattern) { return v instanceof Date ? Utilities.formatDate(v, tz_(), pattern) : String(v == null ? "" : v); }

function sheet_(name, head, setup) {
  let sh = ss_().getSheetByName(name);
  if (!sh) {
    sh = ss_().insertSheet(name);
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight("bold");
    sh.setFrozenRows(1);
    if (setup) setup(sh);
  } else if (sh.getRange(1, 1, 1, head.length).getValues()[0].join("|") !== head.join("|")) {
    sh.getRange(1, 1, 1, head.length).setValues([head]); // Überschriften älterer Versionen aktualisieren
  }
  return sh;
}
const logSheet_ = () => sheet_(SH_LOG, LOG_HEAD, (sh) => {
  sh.getRange("A:A").setNumberFormat("dd.mm.yyyy");
  sh.getRange("B:C").setNumberFormat("hh:mm");
  sh.getRange("D:D").setNumberFormat("0.00");
  sh.getRange("E:M").setNumberFormat("@");
  sh.setColumnWidth(7, 160); sh.setColumnWidth(8, 260); sh.setColumnWidth(9, 380);
  sh.hideColumns(10, 4);
});
const progSheet_ = () => sheet_(SH_PROGRESS, PROG_HEAD, (sh) => {
  sh.getRange("A:B").setNumberFormat("@"); sh.getRange("D:F").setNumberFormat("@");
  sh.setColumnWidth(5, 300);
});
const cfgSheet_ = () => sheet_(SH_CONFIG, ["Schlüssel", "Inhalt (von der App verwaltet – bitte nicht ändern)"], (sh) => sh.getRange("A:B").setNumberFormat("@"));

function rows_(sh, width) {
  const n = sh.getLastRow() - 1;
  return n > 0 ? sh.getRange(2, 1, n, width).getValues() : [];
}

// ---------- Lesen ----------
function readAll_() {
  const cfg = {};
  rows_(cfgSheet_(), 2).forEach((r) => { if (r[0]) { try { cfg[r[0]] = JSON.parse(r[1]); } catch (e) {} } });
  const progress = rows_(progSheet_(), 3).filter((r) => r[0] && r[1]).map((r) => ({ g: String(r[0]), s: String(r[1]), pct: Number(r[2]) || 0 }));
  const entries = rows_(logSheet_(), LOG_HEAD.length).filter((r) => r[9]).map((r) => ({
    id: String(r[9]), date: txt_(r[0], "yyyy-MM-dd"), start: txt_(r[1], "HH:mm"), end: txt_(r[2], "HH:mm"),
    minutes: Number(r[10]) || Math.round(Number(r[3]) * 60), person: String(r[4]), group: String(r[12]),
    sub: String(r[11] || ""), note: String(r[8] || ""),
  }));
  return { config: cfg, progress, entries, legacy: readLegacy_() };
}

// Blatt der alten Stunden-App (Datum, Von, Bis, Stunden, Person, Kategorie, Tätigkeit, ID, Minuten, …)
function readLegacy_() {
  const sh = ss_().getSheetByName(SH_LEGACY);
  if (!sh) return null;
  return rows_(sh, 10).filter((r) => r[7]).map((r) => ({
    id: String(r[7]), date: txt_(r[0], "yyyy-MM-dd"), start: txt_(r[1], "HH:mm"), end: txt_(r[2], "HH:mm"),
    minutes: Number(r[8]) || Math.round(Number(r[3]) * 60), person: String(r[4]), category: String(r[5] || ""), note: String(r[6] || ""),
  }));
}

// ---------- Schreiben ----------
function putConfig_(id, data) {
  if (!/^(people|plan|subs:[\w-]+)$/.test(String(id)) || !data || typeof data !== "object") throw new Error("Ungültige Konfiguration");
  const sh = cfgSheet_(), json = JSON.stringify(data);
  if (json.length > 49000) throw new Error("Zu viele Unterphasen für eine Zelle");
  const keys = rows_(sh, 1).map((r) => String(r[0]));
  const i = keys.indexOf(id);
  if (i >= 0) sh.getRange(i + 2, 2).setValue(json); else sh.appendRow([id, json]);
}

function putProgress_(list) {
  const sh = progSheet_(), rows = rows_(sh, 2), now = new Date();
  const index = {}; rows.forEach((r, i) => (index[r[0] + "|" + r[1]] = i + 2));
  const add = [];
  (list || []).forEach((p) => {
    const pct = Math.max(0, Math.min(100, Math.round(Number(p.pct) || 0)));
    const row = [String(p.g), String(p.s), pct, p.gName || "", p.sName || "", p.by || "", now];
    const at = index[p.g + "|" + p.s];
    if (at) sh.getRange(at, 1, 1, row.length).setValues([row]); else add.push(row);
  });
  if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, add[0].length).setValues(add);
}

function entryRow_(e) {
  const minutes = Math.round(Number(e.minutes));
  if (!e.id || !/^\d{4}-\d{2}-\d{2}$/.test(e.date) || !(minutes > 0 && minutes <= 1440) || !e.person) throw new Error("Ungültiger Eintrag");
  return [e.date, e.start || "", e.end || "", Math.round((minutes / 60) * 100) / 100, e.person, "", e.phaseName || "",
    e.subName || (e.sub ? "" : "Allgemein"), e.note || "", String(e.id), String(minutes), e.sub || "", e.group || ""];
}

function putEntries_(list) {
  const sh = logSheet_(), ids = rows_(sh, LOG_HEAD.length).map((r) => String(r[9]));
  const add = [];
  (list || []).forEach((e) => {
    const row = entryRow_(e), at = ids.indexOf(String(e.id));
    if (at >= 0) sh.getRange(at + 2, 1, 1, row.length).setValues([row]); else { add.push(row); ids.push(String(e.id)); }
  });
  if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, add[0].length).setValues(add);
}

function delEntry_(id) {
  const sh = logSheet_(), ids = rows_(sh, LOG_HEAD.length).map((r) => String(r[9]));
  const at = ids.indexOf(String(id));
  if (at >= 0) sh.deleteRow(at + 2);
}

function renamePerson_(from, to) {
  if (!from || !to) throw new Error("Ungültiger Name");
  const sh = logSheet_(), n = sh.getLastRow() - 1;
  if (n < 1) return;
  const range = sh.getRange(2, 5, n, 1), vals = range.getValues();
  let changed = false;
  vals.forEach((r) => { if (String(r[0]) === from) { r[0] = to; changed = true; } });
  if (changed) range.setValues(vals);
}

function archiveLegacy_() {
  const sh = ss_().getSheetByName(SH_LEGACY);
  if (!sh) return;
  let name = SH_LEGACY_DONE, k = 2;
  while (ss_().getSheetByName(name)) name = SH_LEGACY_DONE + " " + k++;
  sh.setName(name);
}
