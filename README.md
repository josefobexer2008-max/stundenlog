# Maturaprojekt Stundenlog

Web-App zum Erfassen der Arbeitsstunden im Maturaprojekt – für ein Team, in dem jede Person
ihre eigenen Stunden einträgt. Niemand braucht ein Claude-Konto: Die App läuft im Browser,
gemeinsam gespeichert wird in einer Google-Tabelle.

## Funktionen

- **Teammitglieder**: Jede Person wählt oben einmal „Ich bin …“ (wird pro Gerät gemerkt) und trägt dann ihre eigenen Stunden ein. Fortschritt und Stoppuhr sind persönlich, die Team-Übersicht zeigt alle.
- **Stoppuhr**: Start drücken, arbeiten, „Stopp & eintragen“ – die Zeit landet automatisch im Protokoll.
- **Stunden nachtragen**: Datum, Von/Bis oder nur die Dauer (`1:30` oder `1,5`), Kategorie und Tätigkeit.
- **Fortschritt**: eigene Stunden gegenüber dem Ziel pro Person, Team-Summe gegenüber dem Gesamtziel, nötiges Wochenpensum bis zur Abgabe.
- **Excel-Export (.xlsx)**: Blatt „Übersicht“, Blatt „Alle Einträge“ und ein Blatt pro Person – mit echten Datums-/Zeitwerten und Summenformeln.
- **Google-Tabelle**: Alle Einträge stehen zusätzlich live in eurer Google-Tabelle (Blatt „Einträge“).

## Einrichtung (einmalig, ca. 10 Minuten – macht eine Person)

### 1. Google-Tabelle als gemeinsamen Speicher anlegen

1. Auf <https://sheets.new> eine neue Tabelle anlegen, z. B. „Stundenlog Maturaprojekt“.
2. Menü **Erweiterungen → Apps Script**.
3. Den vorhandenen Code löschen und den Inhalt von [`google-apps-script/Code.gs`](google-apps-script/Code.gs) einfügen.
4. In der Zeile `const TEAM_CODE = "doppelhaus-2026";` einen **eigenen Team-Code** eintragen (wie ein Passwort).
5. Speichern (Diskettensymbol).
6. **Bereitstellen → Neue Bereitstellung** → Zahnrad → **Web-App**:
   - Ausführen als: **Ich**
   - Zugriff: **Jeder**
7. **Bereitstellen** klicken, Google nach Zugriff fragen lassen und erlauben
   (bei „Google hat diese App nicht überprüft“: *Erweitert → Weiter zu … (unsicher)* – das ist euer eigenes Skript).
8. Die **Web-App-URL** kopieren (endet auf `/exec`).

> Wird der Code später geändert: *Bereitstellen → Bereitstellungen verwalten → Bearbeiten → Version: Neue Version*, damit die URL gleich bleibt.

### 2. App online stellen (GitHub Pages)

1. Auf GitHub im Repository **Settings → General → Danger Zone → Change visibility → Public**
   (GitHub Pages ist für private Repositories nur mit bezahltem Plan verfügbar).
2. **Settings → Pages** → *Source: Deploy from a branch* → Branch auswählen, Ordner `/ (root)` → **Save**.
3. Nach ca. 1 Minute ist die App erreichbar unter `https://<benutzername>.github.io/<repository>/`.

### 3. Verbinden und Team einladen

1. Die App öffnen → Abschnitt **Team verbinden** → Web-App-URL und Team-Code eintragen → **Verbinden**.
2. Unter **Projekt einrichten** Titel, Namen, Zielstunden pro Person und Abgabetermin eintragen.
3. Bei **Team verbinden** auf **Link kopieren** und den Einladungslink an das Team schicken
   (z. B. per WhatsApp). Wer ihn öffnet, ist sofort verbunden und wählt nur noch „Ich bin …“.

Der Team-Code steht im Einladungslink – den Link also nur im Team teilen.

## Ohne Einrichtung

`index.html` lässt sich auch direkt im Browser öffnen. Dann wird nur in diesem Browser gespeichert.
Einträge lassen sich über **Sicherung (JSON)** exportieren und bei einer anderen Person über
**Sicherung importieren** zusammenführen. Nach dem Verbinden mit der Google-Tabelle bietet die App an,
bisher lokal gespeicherte Einträge in die Tabelle zu übertragen.
