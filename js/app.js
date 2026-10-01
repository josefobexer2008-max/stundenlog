// Maturaprojekt Doppelhaushälfte – Projektplan & Arbeitsprotokoll
(function () {
  "use strict";

  // ---------- Hilfsfunktionen ----------
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const pad = (n) => String(n).padStart(2, "0");
  const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* privat */ } };

  const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseDate = (s) => { if (!s) return null; const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return y ? new Date(y, m - 1, d) : null; };
  const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const toMin = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ""); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
  const fmtDate = (s) => { const d = parseDate(s); return d ? `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}` : "–"; };
  const fmtDay = (s) => { const d = parseDate(s); return d ? `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.` : "–"; };
  const fmtRange = (a, b) => {
    const A = parseDate(a), B = parseDate(b);
    if (!A || !B) return "ohne Datum";
    return A.getFullYear() === B.getFullYear() ? `${fmtDay(a)} – ${fmtDate(b)}` : `${fmtDate(a)} – ${fmtDate(b)}`;
  };
  const nf1 = new Intl.NumberFormat("de-AT", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
  const fmtH = (min) => `${nf1.format(Math.round(min / 6) / 10)} h`;
  const fmtDur = (min) => `${Math.floor(min / 60)}:${pad(Math.round(min % 60))}`;
  const fmtClock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; };
  const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const MONTHS = ["Jänner", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const DAY = 864e5;
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const weekStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  function isoWeek(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / DAY + 1) / 7);
  }
  // Dauer: "1:30", "1,5", "1.5", "90 min", "2 h"
  function parseDuration(s) {
    s = String(s || "").trim().toLowerCase().replace(/\s+/g, "");
    if (!s) return null;
    let m;
    if ((m = /^(\d+):(\d{1,2})h?$/.exec(s))) return Number(m[1]) * 60 + Number(m[2]);
    if ((m = /^(\d+)(min|m)$/.exec(s))) return Number(m[1]);
    if ((m = /^(\d+(?:[.,]\d+)?)(h|std)?$/.exec(s))) return Math.round(Number(m[1].replace(",", ".")) * 60);
    return NaN;
  }

  // ---------- Zustand ----------
  const TABLES = window.createStore.TABLES;
  let store = null;
  let db = Object.fromEntries(TABLES.map((t) => [t, []]));
  const ui = {
    me: lsGet("dhh-me") || "",
    view: null,
    tab: lsGet("dhh-tab") || "plan",
    edit: false,
    open: new Set(lsGet("dhh-open") || []),
    openTouched: lsGet("dhh-open") != null,
    fPerson: "",
    fPhase: "",
    status: "connecting",
  };

  // ---------- Abgeleitete Daten ----------
  const byId = (t, id) => db[t].find((x) => x.id === id);
  const groups = () => db.groups.slice().sort((a, b) => (a.sort || 0) - (b.sort || 0) || a.id.localeCompare(b.id));
  const members = (g) => (Array.isArray(g.members) ? g.members : []);
  const allPersons = () => groups().flatMap(members);
  const groupOf = (person) => groups().find((g) => members(g).includes(person)) || null;
  const phases = () => db.phases.slice().sort((a, b) => (a.sort || 0) - (b.sort || 0) || String(a.start_date).localeCompare(String(b.start_date)));
  const subsOf = (pid) => db.subphases.filter((s) => s.phase_id === pid).sort((a, b) => (a.sort || 0) - (b.sort || 0));
  const allSubs = () => phases().flatMap((p) => subsOf(p.id));
  const pct = (sid, gid) => { const r = byId("progress", `${sid}:${gid}`); return r ? Number(r.percent) || 0 : 0; };
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const viewGroup = () => byId("groups", ui.view) || groups()[0] || null;
  const myGroup = () => groupOf(ui.me);
  const canEditProgress = () => { const g = myGroup(); return !!g && !!viewGroup() && g.id === viewGroup().id; };
  const groupEntries = (gid) => db.entries.filter((e) => e.group_id === gid);
  const sumMin = (list) => list.reduce((a, e) => a + (Number(e.minutes) || 0), 0);

  // Anteil der verstrichenen Zeit einer Phase (0…1)
  function elapsed(p, now = Date.now()) {
    const s = parseDate(p.start_date), e = parseDate(p.end_date);
    if (!s || !e) return 0;
    const end = e.getTime() + DAY; // Enddatum zählt ganz mit
    if (now <= s.getTime()) return 0;
    if (now >= end) return 1;
    return (now - s.getTime()) / (end - s.getTime());
  }
  const isCurrent = (p) => { const t = today().getTime(), s = parseDate(p.start_date), e = parseDate(p.end_date); return !!s && !!e && s.getTime() <= t && t <= e.getTime(); };
  const currentPhase = () => phases().find(isCurrent) || null;

  function groupStats(gid) {
    const subs = allSubs();
    const vals = subs.map((s) => pct(s.id, gid));
    const ph = new Map(db.phases.map((p) => [p.id, elapsed(p)]));
    const entries = groupEntries(gid);
    return {
      pct: avg(vals),
      soll: avg(subs.map((s) => (ph.get(s.phase_id) || 0) * 100)),
      done: vals.filter((v) => v >= 100).length,
      total: subs.length,
      minutes: sumMin(entries),
      count: entries.length,
    };
  }
  function phaseStats(p, gid) {
    const subs = subsOf(p.id);
    const vals = subs.map((s) => pct(s.id, gid));
    return { pct: subs.length ? avg(vals) : null, done: vals.filter((v) => v >= 100).length, total: subs.length, soll: elapsed(p) * 100 };
  }
  function minutesBySub(gid) {
    const m = new Map();
    for (const e of groupEntries(gid)) m.set(e.subphase_id || "", (m.get(e.subphase_id || "") || 0) + (Number(e.minutes) || 0));
    return m;
  }
  const subLabel = (sid) => {
    const s = sid && byId("subphases", sid);
    if (!s) return "Allgemein";
    const p = byId("phases", s.phase_id);
    return p ? `${p.name} › ${s.name}` : s.name;
  };
  const phaseOfEntry = (e) => { const s = e.subphase_id && byId("subphases", e.subphase_id); return s ? s.phase_id : ""; };

  // ---------- Rückmeldungen ----------
  function flash(el, msg, err = false) {
    el.textContent = msg;
    el.classList.toggle("err", err);
    clearTimeout(el._t);
    if (msg) el._t = setTimeout(() => { el.textContent = ""; }, err ? 8000 : 4000);
  }
  function showAlert(msg) { const a = $("alert"); a.hidden = !msg; a.textContent = msg || ""; }

  // Einfacher Bestätigungsdialog; liefert den Wert des gewählten Knopfs
  function ask(text, buttons = [{ label: "Abbrechen", value: "" }, { label: "OK", value: "ok", cls: "primary" }]) {
    const dlg = $("dlg");
    $("dlgText").textContent = text;
    $("dlgBtns").innerHTML = buttons.map((b) => `<button value="${esc(b.value)}" class="${esc(b.cls || "")}">${esc(b.label)}</button>`).join("");
    return new Promise((resolve) => {
      dlg.returnValue = "";
      dlg.addEventListener("close", () => resolve(dlg.returnValue), { once: true });
      dlg.showModal();
    });
  }
  const confirmDelete = (text, label = "Löschen") => ask(text, [{ label: "Abbrechen", value: "" }, { label, value: "ok", cls: "primary" }]).then((v) => v === "ok");

  // ---------- Schreiben ----------
  // Lokal sofort anwenden, dann speichern. Bei Fehler: Hinweis und neu laden.
  function applyLocal(table, type, rows) {
    if (type === "put") {
      for (const r of rows) {
        const i = db[table].findIndex((x) => x.id === r.id);
        if (i >= 0) db[table][i] = { ...db[table][i], ...r }; else db[table].push({ ...r });
      }
    } else {
      const ids = new Set(rows.map((r) => (typeof r === "string" ? r : r.id)));
      db[table] = db[table].filter((x) => !ids.has(x.id));
    }
  }
  async function put(table, rows) {
    rows = Array.isArray(rows) ? rows : [rows];
    applyLocal(table, "put", rows);
    renderAll();
    try { await store.put(table, rows); } catch (err) { await writeFailed(err); throw err; }
  }
  async function del(table, ids) {
    ids = Array.isArray(ids) ? ids : [ids];
    applyLocal(table, "del", ids);
    renderAll();
    try { await store.del(table, ids); } catch (err) { await writeFailed(err); throw err; }
  }
  async function writeFailed(err) {
    console.error(err);
    showAlert(`Speichern fehlgeschlagen${err && err.message ? ` (${err.message})` : ""}. Bitte Internetverbindung prüfen – die Daten wurden neu geladen.`);
    try { replaceAll(await store.refresh()); } catch { /* offline */ }
  }

  // ---------- Daten von anderen Geräten ----------
  function mePosition() {
    for (const g of groups()) { const i = members(g).indexOf(ui.me); if (i >= 0) return [g.id, i]; }
    return null;
  }
  // Wurde "ich" auf einem anderen Gerät umbenannt, den neuen Namen übernehmen.
  function followRename(pos) {
    if (!pos || !ui.me || allPersons().includes(ui.me)) return;
    const g = byId("groups", pos[0]);
    const name = g && members(g)[pos[1]];
    if (name) { ui.me = name; lsSet("dhh-me", name); }
  }
  function replaceAll(data) {
    const pos = mePosition();
    db = Object.fromEntries(TABLES.map((t) => [t, Array.isArray(data[t]) ? data[t] : []]));
    followRename(pos);
    renderAll();
  }
  function onChange(table, type, row) {
    if (!row || row.id == null) return;
    const pos = table === "groups" ? mePosition() : null;
    applyLocal(table, type, [row]);
    if (pos) followRename(pos);
    scheduleRender();
  }
  let renderQueued = false;
  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => { renderQueued = false; renderAll(); });
  }
  function setStatus(s) {
    ui.status = s;
    const el = $("sync");
    el.className = `sync ${s}`;
    el.textContent = { live: "Live verbunden", connecting: "Verbinde …", offline: "Keine Verbindung", local: "Nur auf diesem Gerät" }[s] || s;
    renderConnInfo();
  }

  // ---------- Rendern mit Rücksicht auf laufende Eingaben ----------
  // Ein Bereich mit fokussiertem Textfeld wird erst neu gezeichnet, wenn der Fokus ihn verlässt.
  const isTyping = (el) => {
    const a = document.activeElement;
    return !!a && el.contains(a) && (a.tagName === "TEXTAREA" || (a.tagName === "INPUT" && a.type !== "range" && a.type !== "file" && a.type !== "checkbox"));
  };
  let dragging = false;
  function paint(el, html) {
    if (isTyping(el) || (dragging && el.contains(document.activeElement))) {
      el._pending = html;
      if (!el._hooked) {
        el._hooked = true;
        el.addEventListener("focusout", () => setTimeout(() => { if (el._pending != null && !isTyping(el) && !dragging) scheduleRender(); }, 0));
      }
      return;
    }
    el._pending = null;
    const key = document.activeElement && el.contains(document.activeElement) ? document.activeElement.dataset.k : null;
    if (el._html === html) return;
    el._html = html;
    el.innerHTML = html;
    if (key) { const f = el.querySelector(`[data-k="${CSS.escape(key)}"]`); if (f) f.focus({ preventScroll: true }); }
  }
  // Auswahlliste neu füllen, Auswahl behalten
  function fillSelect(sel, html, fallback = "") {
    const v = sel.value;
    if (sel._html !== html) { sel._html = html; sel.innerHTML = html; }
    sel.value = v;
    if (sel.value !== v || sel.selectedIndex < 0) sel.value = fallback;
  }
  function personOptions(extra = []) {
    const gs = groups();
    const known = new Set(allPersons());
    const others = [...new Set(extra.filter((p) => p && !known.has(p)))];
    return gs.map((g) => `<optgroup label="${esc(g.name)}">${members(g).map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join("")}</optgroup>`).join("")
      + (others.length ? `<optgroup label="Sonstige">${others.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join("")}</optgroup>` : "");
  }
  function subOptions() {
    return `<option value="">Allgemein (keine Unterphase)</option>` + phases().map((p) => {
      const subs = subsOf(p.id);
      return subs.length ? `<optgroup label="${esc(p.name)}">${subs.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("")}</optgroup>` : "";
    }).join("");
  }

  // ---------- Kopf, Karten, Reiter ----------
  function renderMe() {
    const sel = $("meSel");
    fillSelect(sel, `<option value="">– bitte wählen –</option>` + personOptions(), "");
    sel.value = allPersons().includes(ui.me) ? ui.me : "";
    $("meWrap").classList.toggle("unset", !sel.value);
  }
  function renderCards() {
    const g = groups();
    const vg = viewGroup();
    const mine = myGroup();
    $("groupCards").innerHTML = g.map((x) => {
      const st = groupStats(x.id);
      const running = db.timers.filter((t) => members(x).includes(t.id));
      return `<button type="button" class="gcard${vg && vg.id === x.id ? " active" : ""}" data-gid="${esc(x.id)}" aria-pressed="${vg && vg.id === x.id}">
        <span class="gtop"><span class="gname">${esc(x.name)}</span>${mine && mine.id === x.id ? `<span class="chip mine">deine Gruppe</span>` : ""}</span>
        <span class="gmem">${esc(members(x).join(" · ") || "keine Mitglieder")}</span>
        <span class="gnums"><span class="gpct">${Math.round(st.pct)}&thinsp;%</span><span class="ghrs">${fmtH(st.minutes)}</span></span>
        <span class="bar small"><span style="width:${st.pct.toFixed(1)}%"></span><i class="soll" style="left:${st.soll.toFixed(1)}%"></i></span>
        ${running.map((t) => `<span class="live">⏱ <span>${esc(t.id.split(" ")[0])} arbeitet · <span class="num" data-since="${Number(t.started_at)}">${fmtClock(Date.now() - t.started_at)}</span></span></span>`).join("")}
      </button>`;
    }).join("");
  }
  function renderTabs() {
    document.querySelectorAll(".tabs [data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === ui.tab)));
    document.querySelectorAll("[data-panel]").forEach((p) => { p.hidden = p.dataset.panel !== ui.tab; });
  }
  function renderBanner() {
    const t = ui.me && byId("timers", ui.me);
    const b = $("runBanner");
    b.hidden = !t;
    if (!t) { b.innerHTML = ""; return; }
    const html = `<div class="what"><span class="t" data-since="${Number(t.started_at)}">${fmtClock(Date.now() - t.started_at)}</span>
        &nbsp;Stoppuhr läuft · ${esc(subLabel(t.subphase_id))}${t.note ? ` · ${esc(t.note)}` : ""}</div>
      <div class="btns" style="margin:0"><button type="button" data-act="stop">Stopp &amp; eintragen</button></div>`;
    if (b._html !== html) { b._html = html; b.innerHTML = html; }
  }

  // ---------- Projektplan ----------
  function sched(diff) {
    const d = Math.round(diff);
    if (d === 0) return `<b>genau im Zeitplan</b>`;
    return `<b class="${d > 0 ? "ahead" : "behind"}">${Math.abs(d)} ${Math.abs(d) === 1 ? "Punkt" : "Punkte"} ${d > 0 ? "vor" : "hinter"} dem Zeitplan</b>`;
  }
  function renderSummary() {
    const g = viewGroup();
    if (!g) { $("planSummary").innerHTML = `<p class="empty">Noch keine Gruppen angelegt.</p>`; return; }
    const st = groupStats(g.id);
    const cur = currentPhase();
    const next = cur ? null : phases().find((p) => parseDate(p.start_date) && parseDate(p.start_date) > today());
    const daysLeft = cur ? Math.round((parseDate(cur.end_date) - today()) / DAY) : null;
    $("planSummary").innerHTML = `<div class="summary">
      <div class="summary-top">
        <div><div class="label">Gesamtfortschritt · ${esc(g.name)}</div><div class="big">${Math.round(st.pct)} <small>%</small></div></div>
        <div class="sched">Soll heute ${Math.round(st.soll)} % · ${sched(st.pct - st.soll)}</div>
      </div>
      <div class="bar" role="img" aria-label="Fortschritt ${Math.round(st.pct)} Prozent, Soll ${Math.round(st.soll)} Prozent">
        <span style="width:${st.pct.toFixed(1)}%"></span><i class="soll" style="left:${st.soll.toFixed(1)}%" title="Soll laut Zeitplan: ${Math.round(st.soll)} %"></i>
      </div>
      <div class="scale"><span>0 %</span><span>▼ Soll laut Zeitplan</span><span>100 %</span></div>
      <div class="facts">
        <div><span class="label">Unterphasen fertig</span><span class="v">${st.done} / ${st.total}</span></div>
        <div><span class="label">Aktuelle Phase</span><span class="v txt">${cur ? esc(cur.name) : next ? `– <span class="s">(ab ${fmtDay(next.start_date)}: ${esc(next.name)})</span>` : "–"}</span></div>
        <div><span class="label">Phasenende</span><span class="v">${cur ? fmtDate(cur.end_date) : "–"}</span>${cur ? `<span class="s">${daysLeft === 0 ? "heute" : daysLeft === 1 ? "noch 1 Tag" : `noch ${daysLeft} Tage`}</span>` : ""}</div>
      </div>
    </div>`;
  }
  function phaseOpen(p) { return ui.openTouched ? ui.open.has(p.id) : isCurrent(p); }
  function renderPlan() {
    const g = viewGroup();
    const list = phases();
    $("editPlan").setAttribute("aria-pressed", String(ui.edit));
    $("editPlan").textContent = ui.edit ? "Bearbeiten beenden" : "Plan bearbeiten";
    $("toggleAll").hidden = ui.edit;
    $("toggleAll").textContent = list.length && list.every(phaseOpen) ? "Alle zuklappen" : "Alle aufklappen";
    $("planTitle").innerHTML = ui.edit ? "Plan bearbeiten <span class='for'>(gilt für beide Gruppen)</span>" : `Projektplan <span class="for">· ${esc(g ? g.name : "")}</span>`;
    const me = myGroup();
    $("planHint").textContent = ui.edit ? "Änderungen werden sofort gespeichert. Fortschritt und Stunden bleiben beim Umbenennen erhalten."
      : !ui.me ? "Wähle oben aus, wer du bist – dann kannst du den Fortschritt deiner Gruppe einstellen."
      : !canEditProgress() ? `Du siehst gerade die andere Gruppe. Den Fortschritt können nur ${g ? esc(members(g).join(" und ")) : "deren Mitglieder"} ändern.`
      : `Fortschritt per Schieberegler einstellen – gespeichert wird beim Loslassen.${me ? "" : ""}`;
    paint($("phaseList"), ui.edit ? planEditHTML(list) : planViewHTML(list, g));
  }
  function planViewHTML(list, g) {
    if (!list.length) return `<p class="empty sheet">Noch keine Phasen. Über „Plan bearbeiten“ kannst du welche anlegen.</p>`;
    if (!g) return "";
    const mins = minutesBySub(g.id);
    const editable = canEditProgress();
    return list.map((p, i) => {
      const st = phaseStats(p, g.id);
      const subs = subsOf(p.id);
      const open = phaseOpen(p);
      const cur = isCurrent(p);
      const phMin = subs.reduce((a, s) => a + (mins.get(s.id) || 0), 0);
      const head = `<button type="button" class="phase-head" data-act="toggle" aria-expanded="${open}" data-k="ph-${esc(p.id)}">
          <span class="no"><span class="chev">▸</span> ${pad(i + 1)}</span>
          <span><span class="pname">${esc(p.name)}${cur ? `<span class="chip now">jetzt</span>` : ""}</span>
            <span class="pmeta"><span>${fmtRange(p.start_date, p.end_date)}</span><span>${st.done} / ${st.total} fertig</span><span>${fmtH(phMin)}</span></span></span>
          <span class="ppct">${st.pct == null ? "–" : `${Math.round(st.pct)} %`}</span>
          <span class="pbar"><span class="bar small"><span style="width:${(st.pct || 0).toFixed(1)}%"></span>${p.start_date ? `<i class="soll" style="left:${st.soll.toFixed(1)}%" title="Soll: ${Math.round(st.soll)} %"></i>` : ""}</span></span>
        </button>`;
      const body = !open ? "" : `<div class="phase-body">
          ${p.description ? `<p class="pdesc">${esc(p.description)}</p>` : ""}
          ${subs.length ? subs.map((s) => {
            const v = pct(s.id, g.id);
            return `<div class="sub${v >= 100 ? " done" : ""}" data-sid="${esc(s.id)}">
              <span class="tick" aria-hidden="true">✓</span>
              <div class="sname"><span>${esc(s.name)}</span><span class="shrs" title="Gearbeitete Stunden">${fmtH(mins.get(s.id) || 0)}</span>${s.description ? `<span class="sdesc">${esc(s.description)}</span>` : ""}</div>
              <input type="range" class="srange" min="0" max="100" step="5" value="${v}" style="--p:${v}%" data-k="r-${esc(s.id)}"
                aria-label="Fortschritt ${esc(s.name)}" ${editable ? "" : "disabled"}>
              <span class="spct">${v} %</span>
            </div>`;
          }).join("") : `<p class="empty">Keine Unterphasen.</p>`}
        </div>`;
      return `<div class="phase${cur ? " current" : ""}${open ? " open" : ""}" data-pid="${esc(p.id)}">${head}${body}</div>`;
    }).join("");
  }
  function planEditHTML(list) {
    const btn = (act, label, title, cls = "", dis = false) => `<button type="button" class="icon ${cls}" data-act="${act}" title="${title}" aria-label="${title}" data-k="${act}" ${dis ? "disabled" : ""}>${label}</button>`;
    return list.map((p, i) => {
      const subs = subsOf(p.id);
      return `<div class="phase edit" data-pid="${esc(p.id)}">
        <div class="edit-row">
          <label class="f ename">Phase ${pad(i + 1)}<input data-f="name" data-k="pn-${esc(p.id)}" value="${esc(p.name)}" maxlength="120"></label>
          <label class="f">Start<input type="date" data-f="start_date" data-k="ps-${esc(p.id)}" value="${esc(p.start_date || "")}"></label>
          <label class="f">Ende<input type="date" data-f="end_date" data-k="pe-${esc(p.id)}" value="${esc(p.end_date || "")}"></label>
          <div class="acts">${btn("pup", "↑", "Phase nach oben", "", i === 0)}${btn("pdown", "↓", "Phase nach unten", "", i === list.length - 1)}${btn("pdel", "Löschen", "Phase löschen", "danger")}</div>
        </div>
        <label class="f"><span>Beschreibung <span class="opt">(optional)</span></span><input data-f="description" data-k="pd-${esc(p.id)}" value="${esc(p.description || "")}" maxlength="400"></label>
        ${subs.map((s, j) => `<div class="sub-edit" data-sid="${esc(s.id)}">
            <input data-f="name" data-k="sn-${esc(s.id)}" value="${esc(s.name)}" aria-label="Name der Unterphase" maxlength="160">
            <input class="edesc" data-f="description" data-k="sd-${esc(s.id)}" value="${esc(s.description || "")}" placeholder="Beschreibung (optional)" aria-label="Beschreibung" maxlength="400">
            <div class="acts">${btn("sup", "↑", "Nach oben", "", j === 0)}${btn("sdown", "↓", "Nach unten", "", j === subs.length - 1)}${btn("sdel", "✕", "Unterphase löschen", "danger")}</div>
          </div>`).join("")}
        <div class="add-row"><button type="button" data-act="sadd" data-k="sadd-${esc(p.id)}">+ Unterphase</button></div>
      </div>`;
    }).join("") + `<div class="add-row"><button type="button" class="primary" data-act="padd" data-k="padd">+ Phase hinzufügen</button></div>`;
  }

  // ---------- Stoppuhr & Nachtragen ----------
  function entryFieldsHTML() {
    return `<div class="fields">
      <label class="f">Datum<input type="date" name="date" required></label>
      <label class="f">Von<input type="time" name="start"></label>
      <label class="f">Bis<input type="time" name="end"></label>
      <label class="f">Dauer<input name="dur" inputmode="decimal" placeholder="1:30 oder 1,5" autocomplete="off"></label>
      <label class="f wide">Person<select name="person"></select></label>
      <label class="f wide">Unterphase<select name="sub"></select></label>
      <label class="f wide">Tätigkeit<input name="note" maxlength="300" placeholder="Was hast du gemacht?"></label>
    </div>`;
  }
  function wireEntryForm(form) {
    form.querySelector(".entry-fields").innerHTML = entryFieldsHTML();
    const f = form.elements;
    const auto = () => {
      const a = toMin(f.start.value), b = toMin(f.end.value);
      if (a != null && b != null && b > a) { f.dur.value = fmtDur(b - a); f.dur.dataset.auto = "1"; }
      else if (f.dur.dataset.auto === "1") { f.dur.value = ""; }
    };
    f.start.addEventListener("input", auto);
    f.end.addEventListener("input", auto);
    f.dur.addEventListener("input", () => { f.dur.dataset.auto = ""; });
  }
  function fillEntryForm(form, e) {
    const f = form.elements;
    fillSelect(f.person, personOptions([e.person]), e.person);
    f.person.value = e.person || "";
    fillSelect(f.sub, subOptions(), "");
    f.sub.value = e.subphase_id || "";
    if (f.sub.value !== (e.subphase_id || "")) f.sub.value = "";
    f.date.value = e.date || isoDate(new Date());
    f.start.value = e.start_time || "";
    f.end.value = e.end_time || "";
    f.dur.value = e.minutes ? fmtDur(e.minutes) : "";
    f.dur.dataset.auto = e.start_time && e.end_time ? "1" : "";
    f.note.value = e.note || "";
  }
  function readEntryForm(form) {
    const f = form.elements;
    const date = f.date.value;
    if (!date) return { error: "Bitte ein Datum angeben." };
    const person = f.person.value;
    if (!person) return { error: "Bitte eine Person wählen." };
    let start = f.start.value || "", end = f.end.value || "";
    const a = toMin(start), b = toMin(end);
    let minutes;
    if (a != null && b != null) {
      if (b <= a) return { error: "„Bis“ muss nach „Von“ liegen." };
      minutes = b - a;
    } else {
      minutes = parseDuration(f.dur.value);
      if (minutes == null) return { error: "Bitte Von und Bis oder eine Dauer angeben." };
      if (!(minutes > 0)) return { error: "Dauer bitte als 1:30 oder 1,5 eingeben." };
      if (a != null && b == null) { const e = a + minutes; if (e < 1440) end = `${pad(Math.floor(e / 60))}:${pad(e % 60)}`; }
      if (b != null && a == null) { const s = b - minutes; if (s >= 0) start = `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; }
    }
    if (minutes > 24 * 60) return { error: "Ein Eintrag darf höchstens 24 Stunden lang sein." };
    return { data: { date, start_time: start || null, end_time: end || null, minutes, person, subphase_id: f.sub.value || null, note: f.note.value.trim() } };
  }
  let manualReady = false;
  function renderManual() {
    const form = $("manualForm");
    if (!manualReady) {
      manualReady = true;
      fillEntryForm(form, { person: ui.me, date: isoDate(new Date()) });
      return;
    }
    const f = form.elements;
    fillSelect(f.person, personOptions(), ui.me);
    fillSelect(f.sub, subOptions(), "");
  }
  function renderTimer() {
    const t = ui.me ? byId("timers", ui.me) : null;
    const box = $("timerBox");
    box.classList.toggle("running", !!t);
    $("timerFor").textContent = ui.me ? `· ${ui.me}` : "";
    $("timerState").textContent = t ? "läuft" : ui.me ? "bereit" : "wer bist du?";
    $("tStart").hidden = !!t;
    $("tStart").disabled = !ui.me;
    $("tStop").hidden = $("tDiscard").hidden = !t;
    const sel = $("tSub");
    fillSelect(sel, subOptions(), "");
    if (t && document.activeElement !== sel) sel.value = t.subphase_id || "";
    if (t && document.activeElement !== $("tNote")) $("tNote").value = t.note || "";
    const clock = $("clock");
    if (t) clock.dataset.since = Number(t.started_at); else { delete clock.dataset.since; clock.textContent = "0:00:00"; }
    if (!ui.me) flash($("tMsg"), "");
  }
  function tick() {
    const now = Date.now();
    document.querySelectorAll("[data-since]").forEach((el) => { el.textContent = fmtClock(now - Number(el.dataset.since)); });
  }

  async function timerStart() {
    if (!ui.me) { flash($("tMsg"), "Wähle oben zuerst aus, wer du bist.", true); return; }
    if (byId("timers", ui.me)) return;
    try {
      await put("timers", { id: ui.me, started_at: Date.now(), subphase_id: $("tSub").value || null, note: $("tNote").value.trim() });
      flash($("tMsg"), "Läuft – die Stoppuhr übersteht auch ein Neuladen der Seite.");
    } catch { /* gemeldet */ }
  }
  async function timerStop() {
    const t = ui.me && byId("timers", ui.me);
    if (!t) return;
    const g = myGroup();
    const st = new Date(Number(t.started_at)), en = new Date();
    const ms = en - st;
    const minutes = Math.round(ms / 60000);
    if (minutes < 1) {
      if (await confirmDelete("Weniger als eine Minute gemessen – Stoppuhr verwerfen?", "Verwerfen")) await del("timers", ui.me).catch(() => {});
      return;
    }
    if (minutes > 10 * 60 && !(await confirmDelete(`Die Stoppuhr läuft seit ${fmtDur(minutes)} Stunden. Trotzdem so eintragen?\nTipp: Sonst verwerfen und manuell nachtragen.`, "Eintragen"))) return;
    const note = (document.activeElement === $("tNote") ? $("tNote").value.trim() : t.note) || "";
    const sameDay = isoDate(st) === isoDate(en);
    const entry = {
      id: uid(), date: isoDate(st), start_time: hhmm(st), end_time: sameDay ? hhmm(en) : null,
      minutes: Math.min(minutes, 24 * 60), person: ui.me, group_id: g ? g.id : (viewGroup() || {}).id,
      subphase_id: $("tSub").value || t.subphase_id || null, note, created_at: new Date().toISOString(),
    };
    try {
      await put("entries", entry);
      await del("timers", ui.me);
      $("tNote").value = "";
      flash($("tMsg"), `${fmtDur(entry.minutes)} h eingetragen.`);
    } catch { /* gemeldet */ }
  }
  async function timerDiscard() {
    if (!ui.me || !byId("timers", ui.me)) return;
    if (!(await confirmDelete("Laufende Stoppuhr verwerfen? Die Zeit wird nicht eingetragen.", "Verwerfen"))) return;
    await del("timers", ui.me).catch(() => {});
    flash($("tMsg"), "Verworfen.");
  }
  // Unterphase/Notiz während die Stoppuhr läuft mitspeichern
  function timerFieldChanged() {
    const t = ui.me && byId("timers", ui.me);
    if (t) put("timers", { ...t, subphase_id: $("tSub").value || null, note: $("tNote").value.trim() }).catch(() => {});
  }

  // ---------- Auswertung ----------
  function barRows(rows, max) {
    if (!rows.length) return `<p class="empty">Noch keine Einträge.</p>`;
    return rows.map((r) => `<div class="hrow${r.me ? " me" : ""}">
        <span class="name" title="${esc(r.label)}">${esc(r.label)}</span>
        <span class="track"><span style="width:${max ? (r.min / max) * 100 : 0}%;${r.color ? `background:${r.color}` : ""}"></span></span>
        <span class="val">${fmtH(r.min)}</span></div>`).join("");
  }
  function projectStart() {
    const ds = db.phases.map((p) => p.start_date).filter(Boolean).sort();
    return ds.length ? parseDate(ds[0]) : null;
  }
  function renderStats() {
    const g = viewGroup();
    if (!g) return;
    $("statsFor").textContent = `· ${g.name}`;
    const list = groupEntries(g.id);
    const total = sumMin(list);
    const ws = weekStart(new Date());
    const wsIso = isoDate(ws), weIso = isoDate(new Date(ws.getTime() + 6.5 * DAY));
    const week = sumMin(list.filter((e) => e.date >= wsIso && e.date <= weIso));
    const first = [projectStart(), ...list.map((e) => parseDate(e.date))].filter(Boolean).sort((a, b) => a - b)[0];
    const weeks = first ? Math.max(1, Math.ceil(((weekStart(new Date()) - weekStart(first)) / DAY + 7) / 7)) : 1;
    $("statFacts").innerHTML = `
      <div><span class="label">Stunden gesamt</span><span class="v">${fmtH(total)}</span></div>
      <div><span class="label">Diese Woche</span><span class="v"><span class="mark">${fmtH(week)}</span></span><span class="s">KW ${isoWeek(new Date())}</span></div>
      <div><span class="label">Einträge</span><span class="v">${list.length}</span></div>
      <div><span class="label">Ø pro Woche</span><span class="v">${fmtH(total / weeks)}</span><span class="s">über ${weeks} ${weeks === 1 ? "Woche" : "Wochen"}</span></div>`;

    const persons = [...new Set([...members(g), ...list.map((e) => e.person)])];
    const pr = persons.map((p) => ({ label: p, min: sumMin(list.filter((e) => e.person === p)), me: p === ui.me }));
    $("statPersons").innerHTML = pr.length ? barRows(pr, Math.max(...pr.map((r) => r.min))) : `<p class="empty">Keine Mitglieder.</p>`;

    // Letzte 10 Kalenderwochen
    const wk = [];
    for (let i = 9; i >= 0; i--) {
      const s = new Date(ws); s.setDate(s.getDate() - 7 * i);
      const e = new Date(s); e.setDate(e.getDate() + 6);
      const a = isoDate(s), b = isoDate(e);
      wk.push({ kw: isoWeek(s), min: sumMin(list.filter((x) => x.date >= a && x.date <= b)), now: i === 0, from: s });
    }
    const max = Math.max(60, ...wk.map((w) => w.min));
    const W = 400, H = 170, top = 18, bottom = 22, bw = W / wk.length;
    const y = (m) => top + (H - top - bottom) * (1 - m / max);
    $("statWeeks").innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Stunden der letzten 10 Kalenderwochen">
      <line class="gridline" x1="0" x2="${W}" y1="${H - bottom}" y2="${H - bottom}"/>
      ${wk.map((w, i) => {
        const x = i * bw + bw * 0.18, bwid = bw * 0.64, yy = y(w.min);
        return `<g><title>KW ${w.kw} (ab ${fmtDay(isoDate(w.from))}): ${fmtH(w.min)}</title>
          <rect class="b${w.now ? " now" : ""}" x="${x.toFixed(1)}" y="${yy.toFixed(1)}" width="${bwid.toFixed(1)}" height="${Math.max(0, H - bottom - yy).toFixed(1)}" rx="1.5"/>
          ${w.min ? `<text class="vlabel" x="${(x + bwid / 2).toFixed(1)}" y="${(yy - 4).toFixed(1)}" text-anchor="middle">${nf1.format(Math.round(w.min / 6) / 10)}</text>` : ""}
          <text x="${(x + bwid / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${w.now ? "jetzt" : `KW${w.kw}`}</text></g>`;
      }).join("")}
    </svg><p class="hint">Stunden pro Kalenderwoche · gelb = aktuelle Woche</p>`;

    const byPhase = new Map();
    for (const e of list) { const pid = phaseOfEntry(e); byPhase.set(pid, (byPhase.get(pid) || 0) + (Number(e.minutes) || 0)); }
    const rows = phases().map((p) => ({ label: p.name, min: byPhase.get(p.id) || 0 }));
    rows.push({ label: "Allgemein", min: byPhase.get("") || 0, color: "var(--muted)" });
    $("statPhases").innerHTML = list.length ? barRows(rows, Math.max(...rows.map((r) => r.min))) : `<p class="empty">Noch keine Einträge.</p>`;
  }

  // ---------- Protokoll ----------
  function renderLog() {
    const g = viewGroup();
    if (!g) return;
    $("logFor").textContent = `· ${g.name}`;
    const list = groupEntries(g.id);
    const persons = [...new Set([...members(g), ...list.map((e) => e.person)])];
    if (ui.fPerson && !persons.includes(ui.fPerson)) ui.fPerson = "";
    if (ui.fPhase && ui.fPhase !== "_" && !byId("phases", ui.fPhase)) ui.fPhase = "";
    fillSelect($("fPerson"), `<option value="">Alle Personen</option>` + persons.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join(""), "");
    $("fPerson").value = ui.fPerson;
    fillSelect($("fPhase"), `<option value="">Alle Phasen</option>` + phases().map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("") + `<option value="_">Allgemein</option>`, "");
    $("fPhase").value = ui.fPhase;

    const shown = list.filter((e) => (!ui.fPerson || e.person === ui.fPerson) && (!ui.fPhase || (phaseOfEntry(e) || "_") === ui.fPhase))
      .sort((a, b) => b.date.localeCompare(a.date) || String(b.start_time || "").localeCompare(String(a.start_time || "")) || String(b.created_at || "").localeCompare(String(a.created_at || "")));
    $("logSum").textContent = `${shown.length} ${shown.length === 1 ? "Eintrag" : "Einträge"} · ${fmtH(sumMin(shown))}${ui.fPerson || ui.fPhase ? " (gefiltert)" : ""}`;
    if (!shown.length) {
      $("logList").innerHTML = `<p class="empty">${list.length ? "Keine Einträge für diesen Filter." : "Noch keine Einträge – starte die Stoppuhr oder trage Stunden nach."}</p>`;
      return;
    }
    const wsIso = isoDate(weekStart(new Date()));
    const months = new Map();
    for (const e of shown) { const k = e.date.slice(0, 7); if (!months.has(k)) months.set(k, []); months.get(k).push(e); }
    $("logList").innerHTML = [...months].map(([k, es]) => {
      const [y, m] = k.split("-").map(Number);
      return `<div class="month"><div class="month-head"><h3>${MONTHS[m - 1]} ${y}</h3><span class="num">${fmtH(sumMin(es))}</span></div>
        ${es.map((e) => {
          const d = parseDate(e.date);
          return `<div class="entry${e.date >= wsIso ? " thisweek" : ""}" data-eid="${esc(e.id)}">
            <div class="d">${WD[d.getDay()]} ${fmtDay(e.date)}<span class="t">${e.start_time ? `${esc(e.start_time)}${e.end_time ? `–${esc(e.end_time)}` : ""}` : ""}</span></div>
            <div class="body">
              <div class="note${e.note ? "" : " none"}">${e.note ? esc(e.note) : "ohne Beschreibung"}</div>
              <div class="meta"><span class="chip">${esc(e.person)}</span><span>${esc(subLabel(e.subphase_id))}</span></div>
            </div>
            <div><div class="dur">${fmtDur(e.minutes)} h</div>
              <div class="acts"><button type="button" class="ghost" data-act="edit">Bearbeiten</button><button type="button" class="ghost danger" data-act="del">Löschen</button></div></div>
          </div>`;
        }).join("")}</div>`;
    }).join("");
  }

  // ---------- Einstellungen ----------
  function groupEditHTML() {
    return groups().map((g, i) => `<fieldset data-gid="${esc(g.id)}">
        <legend>Gruppe ${i + 1}</legend>
        <label class="f">Gruppenname<input name="gname" value="${esc(g.name)}" maxlength="60" required data-k="gn-${esc(g.id)}"></label>
        <div class="label">Mitglieder</div>
        <div class="mlist">${members(g).map((m, j) => memberRow(m, `${g.id}-${j}`)).join("")}</div>
        <div><button type="button" class="ghost" data-act="madd">+ Mitglied</button></div>
      </fieldset>`).join("");
  }
  const memberRow = (name, k) => `<div class="member"><input name="member" value="${esc(name)}" data-orig="${esc(name)}" maxlength="60" aria-label="Name" data-k="m-${esc(k)}">
      <button type="button" class="icon ghost danger" data-act="mdel" title="Mitglied entfernen" aria-label="Mitglied entfernen">✕</button></div>`;
  let groupFormDirty = false;
  function renderSettings() {
    if (!groupFormDirty) paint($("groupEdit"), groupEditHTML());
    let t = "auto";
    try { t = localStorage.getItem("dhh-theme") || "auto"; } catch { /* privat */ }
    $("themeSel").value = t;
  }
  function renderConnInfo() {
    const info = {
      live: "Verbunden mit der gemeinsamen Datenbank (Supabase). Änderungen erscheinen sofort auf allen Geräten.",
      connecting: "Verbinde mit der gemeinsamen Datenbank …",
      offline: "Die Verbindung zur Datenbank ist unterbrochen. Neue Änderungen werden erst gespeichert, wenn sie wieder steht.",
      local: "Es ist keine gemeinsame Datenbank eingerichtet – alles wird nur in diesem Browser gespeichert. Wie Supabase eingerichtet wird, steht in der README.",
    };
    $("connInfo").textContent = info[ui.status] || "";
  }

  function renderAll() {
    if (!viewGroup() && groups().length) ui.view = groups()[0].id;
    renderMe();
    renderBanner();
    renderCards();
    renderTabs();
    renderSummary();
    renderPlan();
    renderTimer();
    renderManual();
    renderStats();
    renderLog();
    renderSettings();
    tick();
  }

  // ---------- Ereignisse ----------
  $("meSel").addEventListener("change", (e) => {
    ui.me = e.target.value;
    lsSet("dhh-me", ui.me || null);
    const g = myGroup();
    if (g) ui.view = g.id;
    const f = $("manualForm").elements;
    if (ui.me) f.person.value = ui.me;
    renderAll();
  });
  $("groupCards").addEventListener("click", (e) => {
    const b = e.target.closest("[data-gid]");
    if (!b) return;
    ui.view = b.dataset.gid;
    renderAll();
  });
  $("runBanner").addEventListener("click", (e) => { if (e.target.closest("[data-act=stop]")) timerStop(); });
  document.querySelector(".tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]");
    if (!b) return;
    ui.tab = b.dataset.tab;
    lsSet("dhh-tab", ui.tab);
    renderTabs();
  });
  document.querySelector(".tabs").addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const tabs = [...document.querySelectorAll(".tabs [data-tab]")];
    const i = tabs.findIndex((t) => t.dataset.tab === ui.tab);
    const n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    n.focus(); n.click();
  });

  // Projektplan
  document.addEventListener("pointerdown", (e) => { if (e.target.type === "range") dragging = true; });
  document.addEventListener("pointerup", () => { if (dragging) { dragging = false; setTimeout(scheduleRender, 0); } });
  document.addEventListener("pointercancel", () => { dragging = false; });
  const saveOpen = () => { ui.openTouched = true; lsSet("dhh-open", [...ui.open]); };
  $("toggleAll").addEventListener("click", () => {
    const list = phases();
    const all = list.every(phaseOpen);
    ui.open = new Set(all ? [] : list.map((p) => p.id));
    saveOpen();
    renderPlan();
  });
  $("editPlan").addEventListener("click", () => { ui.edit = !ui.edit; renderPlan(); });

  const pl = $("phaseList");
  pl.addEventListener("input", (e) => {
    if (e.target.type !== "range") return;
    const v = Number(e.target.value);
    const row = e.target.closest(".sub");
    e.target.style.setProperty("--p", `${v}%`);
    row.querySelector(".spct").textContent = `${v} %`;
    row.classList.toggle("done", v >= 100);
  });
  pl.addEventListener("change", async (e) => {
    const t = e.target;
    if (t.type === "range") {
      const sid = t.closest(".sub").dataset.sid;
      const g = viewGroup();
      if (!canEditProgress() || !g) { renderPlan(); return; }
      dragging = false;
      put("progress", { id: `${sid}:${g.id}`, subphase_id: sid, group_id: g.id, percent: Math.max(0, Math.min(100, Math.round(Number(t.value) / 5) * 5)) }).catch(() => {});
      return;
    }
    const field = t.dataset.f;
    if (!field) return;
    const subEl = t.closest("[data-sid]");
    const phEl = t.closest("[data-pid]");
    const val = t.value.trim();
    if (subEl) {
      const s = byId("subphases", subEl.dataset.sid);
      if (!s) return;
      if (field === "name" && !val) { t.value = s.name; return; }
      put("subphases", { ...s, [field]: val }).catch(() => {});
    } else if (phEl) {
      const p = byId("phases", phEl.dataset.pid);
      if (!p) return;
      if (field === "name" && !val) { t.value = p.name; return; }
      const next = { ...p, [field]: val || (field === "description" ? "" : null) };
      if (next.start_date && next.end_date && next.start_date > next.end_date) {
        await ask("Das Enddatum liegt vor dem Startdatum. Bitte die Daten prüfen.", [{ label: "OK", value: "ok", cls: "primary" }]);
        t.value = p[field] || "";
        return;
      }
      put("phases", next).catch(() => {});
    }
  });
  pl.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const act = b.dataset.act;
    const phEl = b.closest("[data-pid]");
    const subEl = b.closest("[data-sid]");
    const p = phEl && byId("phases", phEl.dataset.pid);
    if (act === "toggle" && p) {
      if (!ui.openTouched) ui.open = new Set(phases().filter(phaseOpen).map((x) => x.id));
      ui.open.has(p.id) ? ui.open.delete(p.id) : ui.open.add(p.id);
      saveOpen();
      renderPlan();
    } else if (act === "pup" || act === "pdown") {
      move("phases", phases(), p.id, act === "pup" ? -1 : 1);
    } else if (act === "sup" || act === "sdown") {
      const s = byId("subphases", subEl.dataset.sid);
      move("subphases", subsOf(s.phase_id), s.id, act === "sup" ? -1 : 1);
    } else if (act === "pdel" && p) {
      const subs = subsOf(p.id);
      const hrs = sumMin(db.entries.filter((x) => subs.some((s) => s.id === x.subphase_id)));
      if (!(await confirmDelete(`Phase „${p.name}“ mit ${subs.length} Unterphasen löschen?${hrs ? `\nDie ${fmtH(hrs)} erfassten Stunden bleiben erhalten und zählen dann zu „Allgemein“.` : ""}\nDer Fortschritt beider Gruppen geht dabei verloren.`))) return;
      try {
        await del("progress", db.progress.filter((r) => subs.some((s) => s.id === r.subphase_id)).map((r) => r.id));
        await del("subphases", subs.map((s) => s.id));
        await del("phases", p.id);
      } catch { /* gemeldet */ }
    } else if (act === "sdel") {
      const s = byId("subphases", subEl.dataset.sid);
      const hrs = sumMin(db.entries.filter((x) => x.subphase_id === s.id));
      if (!(await confirmDelete(`Unterphase „${s.name}“ löschen?${hrs ? `\nDie ${fmtH(hrs)} erfassten Stunden bleiben erhalten und zählen dann zu „Allgemein“.` : ""}`))) return;
      try {
        await del("progress", db.progress.filter((r) => r.subphase_id === s.id).map((r) => r.id));
        await del("subphases", s.id);
      } catch { /* gemeldet */ }
    } else if (act === "sadd" && p) {
      const subs = subsOf(p.id);
      const s = { id: uid(), phase_id: p.id, name: "Neue Unterphase", description: "", sort: (subs.length ? Math.max(...subs.map((x) => x.sort || 0)) : 0) + 1 };
      await put("subphases", s).catch(() => {});
      focusField(`sn-${s.id}`);
    } else if (act === "padd") {
      const list = phases();
      const last = list[list.length - 1];
      const start = last && parseDate(last.end_date) ? new Date(parseDate(last.end_date).getTime() + DAY) : today();
      const end = new Date(start.getTime() + 27 * DAY);
      const np = { id: uid(), name: "Neue Phase", start_date: isoDate(start), end_date: isoDate(end), description: "", sort: (list.length ? Math.max(...list.map((x) => x.sort || 0)) : 0) + 1 };
      await put("phases", np).catch(() => {});
      focusField(`pn-${np.id}`);
    }
  });
  function focusField(k) {
    const f = pl.querySelector(`[data-k="${CSS.escape(k)}"]`);
    if (f) { f.focus(); f.select && f.select(); f.scrollIntoView({ block: "center", behavior: "smooth" }); }
  }
  function move(table, list, id, dir) {
    const i = list.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    const arr = list.slice();
    [arr[i], arr[j]] = [arr[j], arr[i]];
    const changed = arr.map((x, k) => ({ ...x, sort: k + 1 })).filter((x, k) => (list.find((y) => y.id === x.id).sort || 0) !== k + 1);
    put(table, changed).catch(() => {});
  }

  // Stoppuhr
  $("tStart").addEventListener("click", timerStart);
  $("tStop").addEventListener("click", timerStop);
  $("tDiscard").addEventListener("click", timerDiscard);
  $("tSub").addEventListener("change", timerFieldChanged);
  $("tNote").addEventListener("change", timerFieldChanged);

  // Nachtragen
  wireEntryForm($("manualForm"));
  $("manualForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const r = readEntryForm(form);
    if (r.error) { flash($("mMsg"), r.error, true); return; }
    const g = groupOf(r.data.person);
    if (!g) { flash($("mMsg"), "Diese Person gehört zu keiner Gruppe.", true); return; }
    const entry = { id: uid(), ...r.data, group_id: g.id, created_at: new Date().toISOString() };
    try {
      await put("entries", entry);
      flash($("mMsg"), `${fmtDur(entry.minutes)} h für ${entry.person} eingetragen.`);
      const f = form.elements;
      f.start.value = f.end.value = f.dur.value = f.note.value = "";
      f.dur.dataset.auto = "";
    } catch { flash($("mMsg"), "Nicht gespeichert.", true); }
  });

  // Protokoll
  $("fPerson").addEventListener("change", (e) => { ui.fPerson = e.target.value; renderLog(); });
  $("fPhase").addEventListener("change", (e) => { ui.fPhase = e.target.value; renderLog(); });
  let editing = null;
  wireEntryForm($("editForm"));
  $("logList").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const en = byId("entries", b.closest("[data-eid]").dataset.eid);
    if (!en) return;
    if (b.dataset.act === "del") {
      if (await confirmDelete(`Eintrag vom ${fmtDate(en.date)} (${fmtDur(en.minutes)} h, ${en.person}) löschen?`)) del("entries", en.id).catch(() => {});
    } else {
      editing = en.id;
      fillEntryForm($("editForm"), en);
      flash($("eMsg"), "");
      $("editDlg").showModal();
    }
  });
  $("editCancel").addEventListener("click", () => $("editDlg").close());
  $("editForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const en = editing && byId("entries", editing);
    if (!en) { $("editDlg").close(); return; }
    const r = readEntryForm(e.currentTarget);
    if (r.error) { flash($("eMsg"), r.error, true); return; }
    const g = groupOf(r.data.person);
    try {
      await put("entries", { ...en, ...r.data, group_id: g ? g.id : en.group_id });
      $("editDlg").close();
    } catch { flash($("eMsg"), "Nicht gespeichert.", true); }
  });

  // Einstellungen: Gruppen
  const gf = $("groupForm");
  gf.addEventListener("input", () => { groupFormDirty = true; });
  gf.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    groupFormDirty = true;
    if (b.dataset.act === "madd") {
      const list = b.closest("fieldset").querySelector(".mlist");
      list.insertAdjacentHTML("beforeend", memberRow("", uid()));
      list.lastElementChild.querySelector("input").dataset.orig = "";
      list.lastElementChild.querySelector("input").focus();
    } else if (b.dataset.act === "mdel") {
      b.closest(".member").remove();
    }
  });
  gf.addEventListener("submit", async (e) => {
    e.preventDefault();
    const renames = new Map();
    const next = [];
    const seen = new Set();
    for (const fs of gf.querySelectorAll("fieldset[data-gid]")) {
      const g = byId("groups", fs.dataset.gid);
      if (!g) continue;
      const name = fs.querySelector("[name=gname]").value.trim();
      if (!name) { flash($("gMsg"), "Bitte jeder Gruppe einen Namen geben.", true); return; }
      const mem = [];
      for (const inp of fs.querySelectorAll("[name=member]")) {
        const v = inp.value.trim().replace(/\s+/g, " ");
        if (!v) continue;
        if (seen.has(v.toLowerCase())) { flash($("gMsg"), `„${v}“ kommt doppelt vor – Namen müssen eindeutig sein.`, true); return; }
        seen.add(v.toLowerCase());
        mem.push(v);
        const o = inp.dataset.orig;
        if (o && o !== v) renames.set(o, v);
      }
      next.push({ ...g, name, members: mem });
    }
    // Umbenennen nur, wenn der alte Name nicht weiter verwendet wird
    for (const [o] of renames) if (next.some((g) => g.members.includes(o))) renames.delete(o);
    const affected = db.entries.filter((x) => renames.has(x.person)).map((x) => ({ ...x, person: renames.get(x.person) }));
    const timers = db.timers.filter((t) => renames.has(t.id));
    try {
      await put("groups", next);
      if (affected.length) await put("entries", affected);
      for (const t of timers) { await del("timers", t.id); await put("timers", { ...t, id: renames.get(t.id) }); }
      if (renames.has(ui.me)) { ui.me = renames.get(ui.me); lsSet("dhh-me", ui.me); }
      groupFormDirty = false;
      $("groupEdit")._html = null;
      renderAll();
      flash($("gMsg"), affected.length ? `Gespeichert – ${affected.length} ${affected.length === 1 ? "Eintrag" : "Einträge"} umbenannt.` : "Gespeichert.");
    } catch { flash($("gMsg"), "Nicht gespeichert.", true); }
  });
  $("themeSel").addEventListener("change", (e) => {
    const v = e.target.value;
    try { if (v === "auto") localStorage.removeItem("dhh-theme"); else localStorage.setItem("dhh-theme", v); } catch { /* */ }
    if (v === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = v;
  });

  // ---------- Export ----------
  function download(filename, data, mime) {
    const url = URL.createObjectURL(new Blob([data], { type: mime }));
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  const stamp = () => isoDate(new Date());
  const xlDate = (iso) => { const d = parseDate(iso); return d ? (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / DAY : ""; };
  const xlTime = (t) => (toMin(t) != null ? toMin(t) / 1440 : "");
  const hours = (m) => Math.round((m / 60) * 100) / 100;
  function sheetName(name, used) {
    let n = String(name).replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Blatt";
    let k = n, i = 2;
    while (used.has(k.toLowerCase())) k = `${n.slice(0, 28)} ${i++}`;
    used.add(k.toLowerCase());
    return k;
  }
  // formats: { Spaltenindex: Zahlenformat }, gilt ab firstRow
  function makeSheet(aoa, { widths = [], formats = {}, firstRow = 0, cells = {} } = {}) {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = widths.map((w) => ({ wch: w }));
    const range = XLSX.utils.decode_range(ws["!ref"]);
    for (let r = firstRow; r <= range.e.r; r++) {
      for (const [c, z] of Object.entries(formats)) {
        const cell = ws[XLSX.utils.encode_cell({ r, c: Number(c) })];
        if (cell && cell.t === "n") cell.z = z;
      }
    }
    for (const [a, z] of Object.entries(cells)) if (ws[a]) ws[a].z = z;
    return ws;
  }
  function buildWorkbook() {
    const wb = XLSX.utils.book_new();
    wb.Props = { Title: "Maturaprojekt Doppelhaushälfte", Author: "Projektplan & Arbeitsprotokoll" };
    const gs = groups();
    const used = new Set(["übersicht", "projektplan"]);

    // Übersicht
    const ov = [["Maturaprojekt Doppelhaushälfte – Übersicht"], ["Stand", xlDate(stamp())], [],
      ["Gruppe", "Mitglieder", "Fortschritt", "Soll laut Zeitplan", "Unterphasen fertig", "Stunden", "Einträge"]];
    for (const g of gs) {
      const st = groupStats(g.id);
      ov.push([g.name, members(g).join(", "), st.pct / 100, st.soll / 100, `${st.done} / ${st.total}`, hours(st.minutes), st.count]);
    }
    ov.push([], ["Stunden pro Person"], ["Person", "Gruppe", "", "", "", "Stunden", "Einträge"]);
    const pStart = ov.length + 1;
    const persons = [...new Set([...allPersons(), ...db.entries.map((e) => e.person)])];
    for (const p of persons) {
      const es = db.entries.filter((e) => e.person === p);
      const g = groupOf(p) || byId("groups", (es[0] || {}).group_id);
      ov.push([p, g ? g.name : "", "", "", "", hours(sumMin(es)), es.length]);
    }
    if (persons.length) ov.push(["Gesamt", "", "", "", "", { t: "n", f: `SUM(F${pStart}:F${ov.length})` }, { t: "n", f: `SUM(G${pStart}:G${ov.length})` }]);
    const ovWs = makeSheet(ov, { widths: [26, 34, 12, 18, 18, 10, 10], formats: { 2: "0%", 3: "0%", 5: "0.00" }, firstRow: 4, cells: { B2: "dd.mm.yyyy" } });
    XLSX.utils.book_append_sheet(wb, ovWs, "Übersicht");

    // Projektplan
    const head = ["Phase", "Unterphase", "Beschreibung", "Start", "Ende"];
    for (const g of gs) head.push(`% ${g.name}`, `Stunden ${g.name}`);
    const plan = [head];
    const mins = new Map(gs.map((g) => [g.id, minutesBySub(g.id)]));
    for (const p of phases()) {
      const subs = subsOf(p.id);
      const row = [p.name, "", p.description || "", xlDate(p.start_date), xlDate(p.end_date)];
      for (const g of gs) {
        const st = phaseStats(p, g.id);
        row.push(st.pct == null ? "" : st.pct / 100, hours(subs.reduce((a, s) => a + (mins.get(g.id).get(s.id) || 0), 0)));
      }
      plan.push(row);
      for (const s of subs) {
        const r = [p.name, s.name, s.description || "", "", ""];
        for (const g of gs) r.push(pct(s.id, g.id) / 100, hours(mins.get(g.id).get(s.id) || 0));
        plan.push(r);
      }
    }
    const gen = ["Allgemein", "(ohne Unterphase)", "", "", ""];
    for (const g of gs) gen.push("", hours(mins.get(g.id).get("") || 0));
    plan.push(gen);
    const fmt = { 3: "dd.mm.yyyy", 4: "dd.mm.yyyy" };
    gs.forEach((g, i) => { fmt[5 + i * 2] = "0%"; fmt[6 + i * 2] = "0.00"; });
    const planWs = makeSheet(plan, { widths: [22, 44, 30, 11, 11, ...gs.flatMap(() => [12, 12])], formats: fmt, firstRow: 1 });
    planWs["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col(head.length - 1)}${plan.length}` };
    XLSX.utils.book_append_sheet(wb, planWs, "Projektplan");

    // Protokoll pro Gruppe
    for (const g of gs) {
      const es = groupEntries(g.id).slice().sort((a, b) => (a.date + (a.start_time || "")).localeCompare(b.date + (b.start_time || "")));
      const aoa = [["Datum", "Von", "Bis", "Stunden", "Person", "Phase", "Unterphase", "Tätigkeit"],
        ...es.map((e) => {
          const s = e.subphase_id && byId("subphases", e.subphase_id);
          const p = s && byId("phases", s.phase_id);
          return [xlDate(e.date), xlTime(e.start_time), xlTime(e.end_time), hours(e.minutes), e.person, p ? p.name : "Allgemein", s ? s.name : "", e.note || ""];
        })];
      aoa.push(["Summe", "", "", es.length ? { t: "n", f: `SUM(D2:D${es.length + 1})` } : 0]);
      const ws = makeSheet(aoa, { widths: [11, 7, 7, 9, 18, 20, 36, 60], formats: { 0: "dd.mm.yyyy", 1: "hh:mm", 2: "hh:mm", 3: "0.00" }, firstRow: 1 });
      if (es.length) ws["!autofilter"] = { ref: `A1:H${es.length + 1}` };
      XLSX.utils.book_append_sheet(wb, ws, sheetName(`Protokoll ${g.name}`, used));
    }
    return wb;
  }
  $("expXlsx").addEventListener("click", () => {
    if (!window.XLSX) { flash($("xMsg"), "Die Excel-Bibliothek ist noch nicht geladen – bitte Internetverbindung prüfen.", true); return; }
    try {
      const buf = XLSX.write(buildWorkbook(), { bookType: "xlsx", type: "array", compression: true });
      download(`Maturaprojekt_Doppelhaushaelfte_${stamp()}.xlsx`, new Uint8Array(buf), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      flash($("xMsg"), "Excel-Datei erstellt.");
    } catch (err) { console.error(err); flash($("xMsg"), "Excel-Datei konnte nicht erstellt werden.", true); }
  });
  $("expJson").addEventListener("click", () => {
    const data = { app: "doppelhaus-projektplan", version: 2, exportedAt: new Date().toISOString(), ...Object.fromEntries(TABLES.filter((t) => t !== "timers").map((t) => [t, db[t]])) };
    download(`Projekt_Sicherung_${stamp()}.json`, JSON.stringify(data, null, 2), "application/json");
    flash($("xMsg"), "Sicherung gespeichert.");
  });
  $("impBtn").addEventListener("click", () => $("impFile").click());
  $("impFile").addEventListener("change", async (ev) => {
    const file = ev.target.files[0];
    ev.target.value = "";
    if (!file) return;
    let d;
    try { d = JSON.parse(await file.text()); } catch { flash($("xMsg"), "Die Datei ist kein gültiges JSON.", true); return; }
    try {
      if (d && d.app === "matura-stundenlog" && Array.isArray(d.entries)) await importOld(d);
      else if (d && d.app === "doppelhaus-projektplan") await importBackup(d);
      else throw new Error("unbekannt");
    } catch (err) {
      if (err && err.message === "abgebrochen") return;
      flash($("xMsg"), "Diese Datei ist keine gültige Sicherung.", true);
    }
  });
  const T = ["groups", "phases", "subphases", "progress", "entries"];
  async function importBackup(d) {
    const counts = T.map((t) => (Array.isArray(d[t]) ? d[t].length : 0));
    if (!Array.isArray(d.groups) || !Array.isArray(d.entries)) throw new Error("unbekannt");
    const mode = await ask(`Sicherung vom ${d.exportedAt ? fmtDate(d.exportedAt.slice(0, 10)) : "?"}: ${counts[1]} Phasen, ${counts[2]} Unterphasen, ${counts[4]} Einträge.\n\n„Ersetzen“ löscht zuerst alle aktuellen Daten.\n„Zusammenführen“ ergänzt und überschreibt nur gleiche Einträge.`,
      [{ label: "Abbrechen", value: "" }, { label: "Zusammenführen", value: "merge" }, { label: "Ersetzen", value: "replace", cls: "primary" }]);
    if (!mode) throw new Error("abgebrochen");
    if (mode === "replace") {
      for (const t of ["entries", "progress", "subphases", "phases"]) {
        const keep = new Set((d[t] || []).map((r) => r.id));
        const gone = db[t].filter((r) => !keep.has(r.id)).map((r) => r.id);
        if (gone.length) await del(t, gone);
      }
    }
    for (const t of T) if (Array.isArray(d[t]) && d[t].length) await put(t, d[t].filter((r) => r && r.id != null));
    flash($("xMsg"), `Importiert: ${counts[4]} Einträge, ${counts[2]} Unterphasen.`);
  }
  // Sicherung der alten Stundenlog-Version: Einträge landen unter „Allgemein“
  async function importOld(d) {
    const have = new Set(db.entries.map((e) => e.id));
    const rows = [];
    let skipped = 0;
    for (const e of d.entries) {
      if (!e || !e.id || !e.date || !(Number(e.minutes) > 0) || have.has(String(e.id))) { skipped++; continue; }
      const g = groupOf(e.person);
      if (!g) { skipped++; continue; }
      rows.push({
        id: String(e.id), date: String(e.date).slice(0, 10), start_time: e.start || null, end_time: e.end || null, minutes: Math.round(Number(e.minutes)),
        person: e.person, group_id: g.id, subphase_id: null, note: [e.category, e.note].filter(Boolean).join(": "),
        created_at: e.createdAt ? new Date(e.createdAt).toISOString() : new Date().toISOString(),
      });
    }
    if (!(await confirmDelete(`Alte Stundenlog-Sicherung: ${rows.length} Einträge werden unter „Allgemein“ übernommen${skipped ? `, ${skipped} übersprungen (schon vorhanden oder Person unbekannt)` : ""}.`, "Importieren"))) throw new Error("abgebrochen");
    if (rows.length) await put("entries", rows);
    flash($("xMsg"), `${rows.length} Einträge importiert.`);
  }

  // ---------- Start ----------
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  async function start() {
    renderTabs();
    const cfg = window.APP_CONFIG || {};
    const cloud = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
    if (cloud && !window.supabase) {
      try { await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js"); }
      catch { setStatus("offline"); showAlert("Die Datenbank-Bibliothek konnte nicht geladen werden. Bitte Internetverbindung prüfen und die Seite neu laden."); return; }
    }
    store = window.createStore();
    try {
      const data = await store.init({ onChange, onReload: replaceAll, onStatus: setStatus });
      db = Object.fromEntries(TABLES.map((t) => [t, Array.isArray(data[t]) ? data[t] : []]));
    } catch (err) {
      console.error(err);
      setStatus("offline");
      showAlert(`Verbindung zur Datenbank fehlgeschlagen${err && err.message ? ` (${err.message})` : ""}. Sind Adresse und Schlüssel in js/config.js richtig und wurde supabase/schema.sql ausgeführt?`);
      return;
    }
    const g = myGroup();
    ui.view = g ? g.id : (groups()[0] || {}).id;
    renderAll();
    setInterval(tick, 1000);
  }
  start();
})();
