# Maturaprojekt Doppelhaushälfte – Projektplan & Arbeitsprotokoll

Web-App für das Maturaprojekt (Bautechnik): ein **Projektplan mit Fortschrittsanzeige** und ein
**Arbeitsprotokoll für Stunden** – für zwei Gruppen auf einer Seite, am Handy und am Laptop.

- **Gruppen:** „Engl & Bürgstaller“ und „Obexer & Taferner“ – Fortschritt und Stunden werden getrennt gezählt.
- **Ich bin …:** Jede Person wählt oben einmal ihren Namen (wird im Browser gemerkt, kein Login).
- **Projektplan:** 7 Phasen, 74 Unterphasen (aus `Projektzeitplan.xlsx`). Fortschritt pro Unterphase per Regler in 5-%-Schritten,
  Soll-Linie aus den Phasendaten („X Punkte vor/hinter dem Zeitplan“), Plan im Bearbeitungsmodus änderbar.
- **Stunden:** Stoppuhr (überlebt Neuladen) oder manuell nachtragen, jeweils mit Unterphase.
- **Auswertung, Protokoll, Excel-Export, JSON-Sicherung.**

Gemeinsam gespeichert wird in einer **Google-Tabelle** (über ein kleines Apps-Script). Die Seite läuft auf **GitHub Pages**:
**https://josefobexer2008-max.github.io/stundenlog/**

---

## Umstellen von der alten Stunden-App (bestehende Google-Tabelle)

Die Tabelle, die Web-App-Adresse, der Team-Code und die Einladungslinks bleiben gleich – nur das Skript wird ausgetauscht.

1. Die Google-Tabelle öffnen → **Erweiterungen → Apps Script**.
2. Im alten Code die Zeile `const TEAM_CODE = "…";` suchen und **den eigenen Team-Code notieren**.
3. Den gesamten Code löschen und den Inhalt von [`google-apps-script/Code.gs`](google-apps-script/Code.gs) einfügen.
4. In der Zeile `const TEAM_CODE = "doppelhaus-2026";` wieder **den eigenen Team-Code** eintragen.
5. **Speichern** (Diskettensymbol).
6. **Bereitstellen → Bereitstellungen verwalten** → beim vorhandenen Eintrag auf den **Stift** →
   bei *Version* **„Neue Version“** wählen → **Bereitstellen**.
   (Nicht „Neue Bereitstellung“ – sonst ändert sich die Adresse und die Einladungslinks funktionieren nicht mehr.)
7. Die App mit dem bisherigen Einladungslink öffnen. Beim ersten Öffnen
   - legt die App den Projektplan aus der Excel an (inkl. der Prozentwerte für „Obexer & Taferner“),
   - übernimmt die bisherigen Stunden automatisch ins neue Blatt **„Protokoll“**
     und benennt das alte Blatt in **„Einträge (alt)“** um (nichts wird gelöscht).
8. Oben bei **„Ich bin …“** den eigenen Namen wählen – fertig. Die anderen öffnen einfach ihren bisherigen Link neu.

## Neu einrichten (ohne bestehende Tabelle)

1. Auf <https://sheets.new> eine neue Google-Tabelle anlegen → **Erweiterungen → Apps Script**.
2. Den Code aus [`google-apps-script/Code.gs`](google-apps-script/Code.gs) einfügen, bei `TEAM_CODE` einen eigenen Code eintragen, speichern.
3. **Bereitstellen → Neue Bereitstellung** → Zahnrad → **Web-App** → *Ausführen als:* **Ich**, *Zugriff:* **Jeder** → **Bereitstellen**.
   Zugriff erlauben (bei „Google hat diese App nicht überprüft“: *Erweitert → Weiter zu …* – es ist das eigene Skript).
4. Die **Web-App-URL** (endet auf `/exec`) kopieren.
5. In der App **Einstellungen → Team-Tabelle** → Adresse und Team-Code eintragen → **Verbinden**.
6. **Link kopieren** und an das Team schicken.

---

## Was steht in der Google-Tabelle?

| Blatt | Inhalt |
|---|---|
| **Protokoll** | alle Arbeitsstunden: Datum, Von, Bis, Stunden, Person, Gruppe, Phase, Unterphase, Tätigkeit |
| **Fortschritt** | Prozent je Gruppe und Unterphase, wer zuletzt geändert hat |
| **Konfiguration** | Gruppen und Projektplan (von der App verwaltet – nicht von Hand ändern) |
| Einträge (alt) | die Liste der alten Stunden-App, nur noch zur Sicherheit |

Bitte in der Tabelle keine Zeilen von Hand löschen oder umsortieren – Änderungen am besten in der App machen.
Frühere Stände lassen sich über **Datei → Versionsverlauf** wiederherstellen.

## Gut zu wissen

- **Abgleich:** Die Seite gleicht alle 15 Sekunden und beim Zurückkehren in den Tab ab. Oben rechts steht der Stand.
- **Einladungslink** nur im Team teilen – darin stehen Adresse und Team-Code. Am besten direkt in Safari/Chrome öffnen
  und als Lesezeichen bzw. „Zum Home-Bildschirm“ speichern.
- **Sicherung:** Ab und zu unter **Einstellungen → Als Excel exportieren** bzw. **Sicherung (JSON)** eine Kopie speichern.
- **Ohne Verbindung** funktioniert die App auch, speichert dann aber nur im jeweiligen Browser.

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | die komplette App (HTML, CSS, JavaScript) |
| `google-apps-script/Code.gs` | Skript für die Google-Tabelle |
