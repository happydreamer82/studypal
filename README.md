# seitenfrager

Firefox-Add-on: Frage zur aktuellen Webseite eingeben, Antwort des lokalen
Modells erscheint in einem schwebenden Panel rechts auf der Seite.

## Einrichten

Nichts zu bauen — plain HTML/JS/CSS, kein npm.

1. Firefox oeffnen, `about:debugging#/runtime/this-firefox`
2. "Zuegiges Add-on laden…" → `manifest.json` aus diesem Verzeichnis waehlen
3. Auf eine Webseite gehen: oben rechts erscheint ein "❓"-Knopf
4. Knopf klicken → Panel oeffnet sich rechts
5. Im Panel unter **Einstellungen** den API-Key eintragen
   (aus `~/agenthub/config/agent-keys.env`) und speichern
6. Frage eingeben und "Fragen" klicken — oder einfach "Zusammenfassen"
   klicken, dann fasst das Modell die Seite ohne eigene Frage zusammen

Der Key wird nur im `browser.storage.local` von Firefox gehalten,
nie im Code.

## Wie es laeuft

1. Content-Script (`content.js`) baut das Panel in ein **Shadow-DOM** am
   rechten Seitenrand. Die Seite kann es per CSS nicht ueberschreiben, und
   der Panel-Text (Frage, Antwort) taucht nicht im gelesenen Seitentext auf.
2. Beim Absenden liest das Content-Script den sichtbaren Text des Tabs
   (gekuerzt auf 24.000 Zeichen, passt in den 64k-Kontext) und schickt
   Frage + Inhalt an den Hintergrund.
3. Hintergrund (`background.js`) baut daraus den Prompt und fragt die
   Fassade `http://127.0.0.1:4000/v1` ab (Modell `agent`,
   `enable_thinking: false` — sonst frisst das Nachdenken das Token-Budget).
4. Die Antwort erscheint im Panel mit Hinweis auf die Quellseite.

**Warum kein Side-Panel:** Das Side-Panel-API (`side_panel`, Permission
`sidePanel`) gibt es erst ab Firefox 113. Der Firefox hier erkennt es nicht
(Manifest-Warnung), daher das Content-Script-Panel. Laeuft spaeter ein
Firefox ≥ 113, kann der Weg zurueck zum fest verankerten Panel gehen.

Die Fassade muss laufen (`19-fassade.sh`); sonst meldet das Panel den Fehler.

## Pruefen

```bash
# Fassade erreichbar und Key gueltig:
curl -s http://127.0.0.1:4000/v1/models -H "Authorization: Bearer <key>"
```

Funktionsnachweis des Add-ons selbst nur in Firefox: Seite oeffnen, "❓"
klicken, Frage stellen, Antwort im Panel. Interne Firefox-Seiten (`about:*`,
PDFs, Web-Store) bekommen kein Content-Script und zeigen daher keinen Knopf.

## Modelle

Ueber die lokale Fassade auf `http://127.0.0.1:4000/v1`:
`agent` (Voreinstellung) fuer diese Programmzugriffe, `coder` fuer
Editorarbeit, `extractor` fuer kleine schnelle Aufgaben. 64k Token je Anfrage.
