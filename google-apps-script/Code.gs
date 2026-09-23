/**
 * Maturaprojekt Stundenlog – gemeinsamer Speicher in einer Google-Tabelle.
 *
 * Einrichtung (einmalig, siehe README):
 *   1. Neue Google-Tabelle anlegen → Erweiterungen → Apps Script
 *   2. Diesen Code einfügen, TEAM_CODE ändern, speichern
 *   3. Bereitstellen → Neue Bereitstellung → Web-App,
 *      „Ausführen als: Ich“, „Zugriff: Jeder“ → URL kopieren
 */

// Nur wer diesen Code kennt, kann lesen und eintragen. Bitte ändern!
const TEAM_CODE = "doppelhaus-2026";

const SHEET_ENTRIES = "Einträge";
const SHEET_CONFIG = "Einstellungen";
const HEADERS = ["Datum", "Von", "Bis", "Stunden", "Person", "Kategorie", "Tätigkeit", "ID", "Minuten", "Erstellt"];

function doGet(e) {
  return handle_(() => {
    checkCode_(e.parameter.key);
    return { ok: true, entries: readEntries_(), settings: readSettings_() };
  });
}

function doPost(e) {
  return handle_(() => {
    const req = JSON.parse(e.postData.contents);
    checkCode_(req.key);
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      if (req.action === "add" || req.action === "update") upsertEntry_(req.entry);
      else if (req.action === "remove") removeEntry_(req.id);
      else if (req.action === "settings") writeSettings_(req.settings);
      else throw new Error("Unbekannte Aktion");
    } finally {
      lock.releaseLock();
    }
    return { ok: true };
  });
}

function handle_(fn) {
  let out;
  try { out = fn(); } catch (err) { out = { ok: false, error: String(err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function checkCode_(key) {
  if (String(key || "") !== TEAM_CODE) throw new Error("Falscher Team-Code");
}

function entriesSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_ENTRIES);
  if (!sh) {
    sh = ss.insertSheet(SHEET_ENTRIES, 0);
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight("bold");
    sh.setFrozenRows(1);
    // Alles als Text speichern, damit Google Datum/Uhrzeit nicht umwandelt; Stunden als Zahl
    sh.getRange("A:C").setNumberFormat("@");
    sh.getRange("E:J").setNumberFormat("@");
    sh.getRange("D:D").setNumberFormat("0.00");
    sh.setColumnWidth(7, 380);
    sh.hideColumns(8, 3);
  }
  return sh;
}

function readEntries_() {
  const sh = entriesSheet_();
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, HEADERS.length).getValues()
    .filter((r) => r[7])
    .map((r) => ({
      date: String(r[0]), start: String(r[1]), end: String(r[2]),
      person: String(r[4]), category: String(r[5]), note: String(r[6]),
      id: String(r[7]), minutes: Number(r[8]) || Math.round(Number(r[3]) * 60), createdAt: Number(r[9]) || 0,
    }));
}

function rowOf_(e) {
  const minutes = Math.round(Number(e.minutes));
  if (!e.id || !/^\d{4}-\d{2}-\d{2}$/.test(e.date) || !(minutes > 0)) throw new Error("Ungültiger Eintrag");
  return [e.date, e.start || "", e.end || "", Math.round((minutes / 60) * 100) / 100,
    e.person || "", e.category || "", e.note || "", String(e.id), String(minutes), String(e.createdAt || Date.now())];
}

function findRow_(sh, id) {
  const n = sh.getLastRow() - 1;
  if (n < 1) return -1;
  const ids = sh.getRange(2, 8, n, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

function upsertEntry_(e) {
  const sh = entriesSheet_();
  const row = rowOf_(e);
  const at = findRow_(sh, e.id);
  if (at > 0) sh.getRange(at, 1, 1, row.length).setValues([row]);
  else sh.appendRow(row);
}

function removeEntry_(id) {
  const sh = entriesSheet_();
  const at = findRow_(sh, id);
  if (at > 0) sh.deleteRow(at);
}

function configSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_CONFIG);
  if (!sh) {
    sh = ss.insertSheet(SHEET_CONFIG);
    sh.getRange("A1").setValue("Von der App verwaltet – bitte nicht von Hand ändern.");
    sh.getRange("A2").setNumberFormat("@");
  }
  return sh;
}

function readSettings_() {
  const v = configSheet_().getRange("A2").getValue();
  try { return v ? JSON.parse(v) : null; } catch (err) { return null; }
}

function writeSettings_(s) {
  if (!s || typeof s !== "object") throw new Error("Ungültige Einstellungen");
  configSheet_().getRange("A2").setValue(JSON.stringify(s));
}
