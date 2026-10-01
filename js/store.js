// Datenschicht: Supabase (gemeinsam, live) oder localStorage (nur dieses Gerät).
// Beide bieten dieselbe Schnittstelle:
//   init(handlers)        -> Promise<data>   data = { groups: [], phases: [], ... }
//   put(table, rows)      -> Promise          Einfügen oder Aktualisieren (nach id)
//   del(table, ids)       -> Promise
//   refresh()             -> Promise<data>
// handlers.onChange(table, "put"|"del", row)  einzelne Änderung von einem anderen Gerät
// handlers.onReload(data)                      kompletter Neustand
// handlers.onStatus("live"|"connecting"|"offline"|"local")
(function () {
  "use strict";
  const TABLES = ["groups", "phases", "subphases", "progress", "entries", "timers"];
  const empty = () => Object.fromEntries(TABLES.map((t) => [t, []]));

  // Die App legt die Startdaten selbst an, wenn noch keine Gruppen existieren.
  // Feste IDs sorgen dafür, dass zwei gleichzeitig startende Geräte nichts doppelt anlegen.
  function seedRows() {
    const s = window.SEED || {};
    return { groups: s.groups || [], phases: s.phases || [], subphases: s.subphases || [], progress: s.progress || [] };
  }

  // ---------- Lokal ----------
  function localStore() {
    const KEY = "dhh-db-v1";
    let data = empty();
    let handlers = {};
    const read = () => {
      try { const d = JSON.parse(localStorage.getItem(KEY)); return d && typeof d === "object" ? d : null; } catch { return null; }
    };
    const write = () => {
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* voll oder gesperrt: bleibt im Speicher */ }
    };
    const load = () => {
      const d = read();
      data = empty();
      if (d) for (const t of TABLES) if (Array.isArray(d[t])) data[t] = d[t];
      return data;
    };
    return {
      mode: "local",
      async init(h) {
        handlers = h;
        load();
        if (!data.groups.length) {
          Object.assign(data, seedRows());
          write();
        }
        // Andere Tabs im selben Browser
        window.addEventListener("storage", (e) => { if (e.key === KEY) handlers.onReload(clone(load())); });
        handlers.onStatus("local");
        return clone(data);
      },
      async put(table, rows) {
        const list = data[table];
        for (const r of rows) {
          const i = list.findIndex((x) => x.id === r.id);
          if (i >= 0) list[i] = { ...list[i], ...r }; else list.push({ ...r });
        }
        write();
      },
      async del(table, ids) {
        const set = new Set(ids);
        data[table] = data[table].filter((x) => !set.has(x.id));
        write();
      },
      async refresh() { return clone(load()); },
    };
  }

  // ---------- Supabase ----------
  function cloudStore(url, key) {
    const client = window.supabase.createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 20 } },
    });
    let handlers = {};
    let channel = null;
    let subscribedOnce = false;

    async function fetchTable(t) {
      const rows = [];
      const page = 1000;
      for (let from = 0; ; from += page) {
        const { data, error } = await client.from(t).select("*").order("id").range(from, from + page - 1);
        if (error) throw error;
        rows.push(...data);
        if (data.length < page) break;
      }
      return rows;
    }
    async function fetchAll() {
      const res = await Promise.all(TABLES.map(fetchTable));
      return Object.fromEntries(TABLES.map((t, i) => [t, res[i]]));
    }
    async function seedIfEmpty(data) {
      if (data.groups.length) return data;
      const seed = seedRows();
      for (const t of ["groups", "phases", "subphases", "progress"]) {
        if (!seed[t].length) continue;
        const { error } = await client.from(t).upsert(seed[t], { onConflict: "id", ignoreDuplicates: true });
        if (error) throw error;
      }
      return fetchAll();
    }
    function subscribe() {
      channel = client.channel("projekt-live");
      for (const t of TABLES) {
        channel.on("postgres_changes", { event: "*", schema: "public", table: t }, (p) => {
          if (p.eventType === "DELETE") handlers.onChange(t, "del", p.old);
          else handlers.onChange(t, "put", p.new);
        });
      }
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          handlers.onStatus("live");
          // Nach einem Verbindungsabbruch alles neu laden, damit nichts verpasst wird.
          if (subscribedOnce) fetchAll().then(handlers.onReload).catch(() => {});
          subscribedOnce = true;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          handlers.onStatus("offline");
        }
      });
    }
    const check = ({ error }) => { if (error) throw error; };

    return {
      mode: "cloud",
      async init(h) {
        handlers = h;
        handlers.onStatus("connecting");
        const data = await seedIfEmpty(await fetchAll());
        subscribe();
        // Handy aus dem Standby: frisch laden
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") fetchAll().then(handlers.onReload).catch(() => handlers.onStatus("offline"));
        });
        return data;
      },
      async put(table, rows) {
        if (!rows.length) return;
        check(await client.from(table).upsert(rows, { onConflict: "id" }));
      },
      async del(table, ids) {
        if (!ids.length) return;
        check(await client.from(table).delete().in("id", ids));
      },
      refresh: fetchAll,
    };
  }

  function clone(d) { return JSON.parse(JSON.stringify(d)); }

  window.createStore = function () {
    const c = window.APP_CONFIG || {};
    if (c.SUPABASE_URL && c.SUPABASE_ANON_KEY && window.supabase) return cloudStore(c.SUPABASE_URL.trim(), c.SUPABASE_ANON_KEY.trim());
    return localStore();
  };
  window.createStore.TABLES = TABLES;
})();
