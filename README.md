# seitenfrager

Firefox-Add-on: Frage zur aktuellen Webseite eingeben, Antwort des lokalen
Modells erscheint im Side-Panel rechts im Browser.

## Einrichten

Nichts zu bauen — plain HTML/JS/CSS, kein npm.

1. Firefox oeffnen, `about:debugging#/runtime/this-firefox`
2. "Zuegiges Add-on laden…" → `manifest.json` aus diesem Verzeichnis waehlen
3. Werkzeugknopf klicken (oder `Strg+Shift+Y` nach Wunsch zuweisen) → Panel
4. Im Panel unter **Einstellungen** den API-Key eintragen
   (aus `~/agenthub/config/agent-keys.env`) und speichern

Der Key wird nur im `browser.storage.local` von Firefox gehalten,
nie im Code.

## Wie es laeuft

1. Content-Script (`content.js`) liest den sichtbaren Text des aktiven Tabs
   (gekuerzt auf 24.000 Zeichen, passt in den 64k-Kontext).
2. Background (`background.js`) baut daraus den Prompt und fragt die
   Fassade `http://127.0.0.1:4000/v1` ab (Modell `agent`,
   `enable_thinking: false` — sonst frisst das Nachdenken das Token-Budget).
3. Die Antwort erscheint im Side-Panel mit Hinweis auf die Quellseite.

Die Fassade muss laufen (`19-fassade.sh`); sonst meldet das Panel den Fehler.

## Pruefen

```bash
# Fassade erreichbar und Key gueltig:
curl -s http://127.0.0.1:4000/v1/models -H "Authorization: Bearer <key>"
```

Funktionsnachweis des Add-ons selbst nur in Firefox: Seite oeffnen, Frage
stellen, Antwort im Panel. Interne Firefox-Seiten (`about:*`, PDFs) werden
klar als nicht verfuegbar gemeldet.

## Modelle

Ueber die lokale Fassade auf `http://127.0.0.1:4000/v1`:
`agent` (Voreinstellung) fuer diese Programmzugriffe, `coder` fuer
Editorarbeit, `extractor` fuer kleine schnelle Aufgaben. 64k Token je Anfrage.
