# Maturaprojekt Doppelhaushälfte – Projektplan & Arbeitsprotokoll

Web-App für das Maturaprojekt (Fach Bautechnik): ein **Projektplan mit Fortschrittsanzeige** und ein
**Arbeitsprotokoll für Stunden**. Zwei Gruppen teilen sich die Website, Fortschritt und Stunden werden pro Gruppe gezählt.
Alle vier Personen sehen von ihren eigenen Geräten dieselben Daten – live.

## Funktionen

- **Ich bin …** – oben auswählen (wird im Browser gemerkt, kein Login). Danach zeigt die Seite die eigene Gruppe.
  Die zwei Gruppenkarten zeigen Fortschritt und Stunden; ein Klick wechselt die Ansicht.
- **Projektplan** – Phasen mit Unterphasen (gleich für beide Gruppen). Fortschritt per Schieberegler in 5-%-Schritten,
  gespeichert beim Loslassen. Nur Mitglieder der angezeigten Gruppe können ihn ändern. Die aktuelle Phase ist offen und mit „jetzt“ markiert.
  Die **Soll-Linie** zeigt, wie weit man laut Zeitplan heute sein sollte („X Punkte vor/hinter dem Zeitplan“).
- **Plan bearbeiten** – Phasen und Unterphasen anlegen, umbenennen, Beschreibung und Daten ändern, verschieben, löschen.
- **Stunden erfassen** – Stoppuhr pro Person (läuft weiter nach Neuladen und sogar geräteübergreifend) oder manuell nachtragen
  (Von/Bis oder nur Dauer wie `1:30` / `1,5`).
- **Auswertung** – Stunden gesamt, diese Woche, Einträge, Ø pro Woche, Stunden pro Person, letzte 10 Kalenderwochen, Stunden pro Phase.
- **Protokoll** – nach Monat gruppiert, Filter nach Person und Phase, Einträge bearbeiten und löschen.
- **Einstellungen** – Gruppennamen und Mitglieder ändern (Einträge werden mit umbenannt), Excel-Export,
  JSON-Sicherung exportieren/importieren, hell/dunkel.

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html`, `css/style.css` | Oberfläche |
| `js/app.js` | Logik der App |
| `js/store.js` | Speicherung: Supabase (gemeinsam, live) oder nur lokal im Browser |
| `js/config.js` | **Hier kommen Supabase-Adresse und Schlüssel hinein** |
| `js/seed.js` | Startdaten (Phasen/Unterphasen aus `Projektzeitplan.xlsx`) |
| `supabase/schema.sql` | Datenbank-Tabellen für Supabase |
| `tools/excel_to_seed.py` | erzeugt `js/seed.js` aus der Excel-Datei neu |

Es gibt keinen Build-Schritt – die Seite besteht nur aus statischen Dateien.

---

## Einrichtung (einmalig, ca. 15 Minuten – macht eine Person)

### 1. Datenbank bei Supabase anlegen (kostenlos)

1. Auf <https://supabase.com> mit dem GitHub-Konto anmelden → **New project**.
   Name z. B. `doppelhaus`, ein Datenbank-Passwort vergeben (wird für die App nicht gebraucht), Region **Central EU (Frankfurt)**.
2. Warten, bis das Projekt bereit ist (1–2 Minuten).
3. Links **SQL Editor** → **New query** → den kompletten Inhalt von [`supabase/schema.sql`](supabase/schema.sql) einfügen → **Run**.
   Es sollte „Success. No rows returned“ erscheinen.
4. Oben auf **Connect** (oder **Project Settings → API / API Keys**) klicken und zwei Werte kopieren:
   - die **Project URL** (`https://xxxxxxxx.supabase.co`)
   - den **anon public** Schlüssel (bei neuen Projekten heißt er **publishable key**, beginnt mit `sb_publishable_…`)
5. Beide Werte in [`js/config.js`](js/config.js) eintragen und committen:

   ```js
   window.APP_CONFIG = {
     SUPABASE_URL: "https://xxxxxxxx.supabase.co",
     SUPABASE_ANON_KEY: "eyJhbGciOi…",
   };
   ```

Beim ersten Öffnen legt die App die zwei Gruppen und den Projektplan aus der Excel automatisch an
(die Prozentwerte aus der Excel gehören zu „Obexer & Taferner“, die andere Gruppe startet bei 0 %).

> **Den `service_role`-/`secret`-Schlüssel nie eintragen** – nur den öffentlichen `anon`/`publishable` Schlüssel.

### 2. Seite online stellen

**Variante A – Vercel**

1. <https://vercel.com> → mit GitHub anmelden → **Add New… → Project** → dieses Repository **Import**.
2. Framework Preset: **Other**, Build Command leer lassen, Output Directory leer lassen (bzw. `.`) → **Deploy**.
3. Nach ca. 30 Sekunden ist die Seite unter `https://<projektname>.vercel.app` erreichbar.

**Variante B – Netlify**

1. <https://app.netlify.com> → **Add new site → Import an existing project** → GitHub → Repository wählen.
2. Build command leer lassen, Publish directory `.` → **Deploy**.

Beide funktionieren auch mit einem **privaten** GitHub-Repository. Jede Änderung, die auf den gewählten Branch gepusht wird,
geht automatisch online.

### 3. Team einladen

Link an alle schicken (z. B. per WhatsApp). Jede Person öffnet ihn, wählt oben **Ich bin …** – fertig.
Tipp: Auf dem Handy über „Zum Startbildschirm hinzufügen“ wie eine App ablegen.

---

## Sicherheit – bitte lesen

Es gibt kein Login: **Wer den Link kennt, kann Daten lesen und ändern.** Der Schlüssel in `config.js` ist öffentlich
sichtbar (das ist bei Supabase so vorgesehen). Für ein Schulprojekt ist das in Ordnung, aber:

- Den Link nur im Team teilen und das GitHub-Repository am besten **privat** halten.
- Ab und zu unter **Einstellungen → Sicherung (JSON)** eine Sicherung speichern.

## Ohne Datenbank

Bleibt `js/config.js` leer, speichert die App alles nur im aktuellen Browser (Anzeige „Nur auf diesem Gerät“).
Zum Ausprobieren lokal starten mit `python3 -m http.server` im Projektordner und <http://localhost:8000> öffnen.
Eine Sicherung aus der lokalen Variante lässt sich später unter **Sicherung importieren** in die gemeinsame Datenbank übernehmen.
Auch Sicherungen der alten Stundenlog-Version werden übernommen (die Einträge landen dann unter „Allgemein“).

## Projektplan aus der Excel neu einlesen

Der Plan lässt sich direkt in der App bearbeiten. Soll er dennoch neu aus der Excel erzeugt werden:

```bash
pip install openpyxl
python3 tools/excel_to_seed.py tools/Projektzeitplan.xlsx
```

Das schreibt `js/seed.js` neu. Die Startdaten werden nur verwendet, solange die Datenbank noch leer ist.
