# Maturaprojekt Doppelhaushälfte – Projektplan & Arbeitsprotokoll

Web-App für das Maturaprojekt (Bautechnik): ein **Projektplan mit Fortschrittsanzeige** und ein
**Arbeitsprotokoll für Stunden** – für zwei Gruppen auf einer Seite, am Handy und am Laptop.

- **Gruppen:** „Engl & Bürgstaller“ und „Obexer & Taferner“ – Fortschritt und Stunden werden getrennt gezählt.
- **Ich bin …:** Jede Person wählt oben einmal ihren Namen (wird im Browser gemerkt, kein Login).
- **Projektplan:** 7 Phasen, 74 Unterphasen (aus `Projektzeitplan.xlsx`). Fortschritt pro Unterphase per Regler in 5-%-Schritten,
  Soll-Linie aus den Phasendaten („X Punkte vor/hinter dem Zeitplan“), Plan im Bearbeitungsmodus änderbar.
- **Stunden:** Stoppuhr (überlebt Neuladen) oder manuell nachtragen, jeweils mit Unterphase.
- **Auswertung, Protokoll, Excel-Export, JSON-Sicherung.**

Alle vier sehen dieselben Daten über eine kostenlose **Supabase**-Datenbank. Die Seite läuft auf **GitHub Pages**.

---

## Einrichtung (einmalig, ca. 15 Minuten – macht eine Person)

### 1. Supabase-Projekt anlegen

1. Auf <https://supabase.com> → **Start your project** → mit GitHub anmelden.
2. **New project**
   - Name: z. B. `maturaprojekt`
   - Database Password: beliebig (gut aufheben, wird für die App nicht gebraucht)
   - Region: **Central EU (Frankfurt)**
   - Plan: **Free**
3. Ca. 2 Minuten warten, bis das Projekt bereit ist.

### 2. Tabellen anlegen

1. Links im Menü **SQL Editor** → **New query**.
2. Den kompletten Inhalt von [`supabase/schema.sql`](supabase/schema.sql) einfügen → **Run**.
3. Unten sollte „Success. No rows returned“ stehen.

### 3. Adresse und Schlüssel kopieren

1. Oben auf **Connect** klicken (oder **Project Settings → API Keys**).
2. Kopieren:
   - **Project URL** – sieht aus wie `https://abcd1234.supabase.co`
   - **Publishable key** – beginnt mit `sb_publishable_…`
     (falls nur „anon public“ angezeigt wird: diesen Schlüssel nehmen)
   - ⚠️ **Nicht** den *secret* / *service_role* key verwenden.

### 4. App verbinden

1. Die App öffnen: **https://josefobexer2008-max.github.io/stundenlog/**
2. Reiter **Einstellungen** → **Team-Datenbank** → Project URL und Publishable key einfügen → **Verbinden**.
3. Beim ersten Verbinden legt die App automatisch den Projektplan aus der Excel an
   (inkl. der bisherigen Prozentwerte für „Obexer & Taferner“).
4. Oben rechts steht jetzt ein grüner Punkt „Live“.

### 5. Team einladen

1. **Einstellungen → Team-Datenbank → Link kopieren** und den Link in die Gruppe schicken.
2. Die anderen öffnen den Link (am besten direkt in Safari/Chrome, nicht im WhatsApp-Browser)
   und wählen oben **„Ich bin …“**. Fertig.
3. Tipp: Seite danach als Lesezeichen bzw. „Zum Home-Bildschirm“ speichern – die Verbindung bleibt erhalten.

> Der Schlüssel steht nur im Einladungslink, nicht im öffentlichen Code. Wer den Link hat, kann lesen und eintragen –
> den Link also nur im Team teilen.

---

## Stunden aus der alten App übernehmen

Auf einem Gerät, auf dem die alte Stunden-App (Google-Tabelle) schon benutzt wurde, erscheint unter
**Einstellungen** automatisch der Abschnitt **„Alte Stundenliste übernehmen“** → Knopf drücken.
Alternativ einmal den **alten Einladungslink** öffnen, danach den neuen.

Die Einträge landen bei der richtigen Person und Gruppe (Unterphase „Allgemein“, die alte Kategorie steht vor der Tätigkeit).
Doppelte Einträge werden übersprungen. Auch eine JSON-Sicherung der alten App kann unter **Sicherung importieren** eingelesen werden.

---

## Online stellen

Die Seite liegt schon auf **GitHub Pages** (Repository `stundenlog`, Branch `main`). Jede Änderung im Repository
ist nach ca. 1 Minute online – es ist nichts weiter zu tun.

**Alternative Netlify** (falls gewünscht):
<https://app.netlify.com> → mit GitHub anmelden → **Add new site → Import an existing project** → GitHub →
`stundenlog` auswählen → Build command leer lassen, Publish directory `/` → **Deploy**.
(Vercel funktioniert genauso: *Add New → Project → Import*, Framework „Other“.)
Danach in der neuen Adresse einmal verbinden und den neuen Einladungslink verteilen.

---

## Gut zu wissen

- **Live-Abgleich:** Die Seite gleicht alle 10 Sekunden und beim Zurückkehren in den Tab ab. Oben rechts steht der Stand.
- **Supabase Free pausiert Projekte nach 7 Tagen ohne Nutzung** (z. B. in den Ferien). Dann zeigt die App
  „Datenbank nicht erreichbar“ → im Supabase-Dashboard beim Projekt auf **Restore** klicken. Die Daten bleiben erhalten.
- **Sicherung:** Ab und zu unter **Einstellungen → Sicherung (JSON)** bzw. **Als Excel exportieren** eine Kopie speichern.
- **Ohne Datenbank** funktioniert die App auch, speichert dann aber nur im jeweiligen Browser.

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | die komplette App (HTML, CSS, JavaScript) |
| `supabase/schema.sql` | Tabellen und Zugriffsregeln für Supabase |
