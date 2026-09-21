# StudyPal

Firefox-Add-on: Die Frage(n), die auf einer Webseite stehen (z. B. ein
Quiz), werden vom lokalen Modell gefunden und beantwortet — die Antwort
erscheint in einem schwebenden Panel rechts auf der Seite.

## Einrichten

Nichts zu bauen — plain HTML/JS/CSS, kein npm.

1. Firefox oeffnen, `about:debugging#/runtime/this-firefox`
2. "Zuegiges Add-on laden…" → `manifest.json` aus diesem Verzeichnis waehlen
3. Auf eine Webseite gehen
4. **Toolbar-Button** des Add-ons klicken (Tuerkis-Punkt in der
   Browser-Leiste) → Panel oeffnet sich rechts
   (alternativ **Alt+Shift+S** — funktioniert auch, wenn die Seite eigene
   Overlays zeigt)
5. Im Panel unter **Einstellungen** den API-Key eintragen
   (aus `~/agenthub/config/agent-keys.env`) und speichern
6. **"Frage beantworten"** klicken — das Modell findet die Frage(n), die
   auf der Seite stehen (z. B. ein Quiz), und beantwortet sie

Der Key wird nur im `browser.storage.local` von Firefox gehalten,
nie im Code.

## Wie es laeuft

1. Content-Script (`content.js`) baut das Panel in ein **Shadow-DOM** am
   rechten Seitenrand. Die Seite kann es per CSS nicht ueberschreiben, und
   der Panel-Text (Frage, Antwort) taucht nicht im gelesenen Seitentext auf.
2. Beim Klick liest das Content-Script den sichtbaren Text des Tabs
   (gekuerzt auf 24.000 Zeichen, passt in den 64k-Kontext) und schickt ihn
   an den Hintergrund.
3. Hintergrund (`background.js`) fragt die Fassade `http://127.0.0.1:4000/v1`
   ab (Modell `agent`, `enable_thinking: false` — sonst frisst das Nachdenken
   das Token-Budget). Zwei Wege:
   - **`seite_fragen`** (Hauptknopf): Das Modell findet die Frage(n) im
     Inhalt und beantwortet sie. Die Antwort darf aus dem Seiteninhalt oder
     dem Wissen des Modells kommen — eine Kursseite zeigt oft nur die
     Quiz-Frage, nicht die Lektion.
   - **`frage_stellen`** (aufgeklappt "Eigene Frage"): Eine eingegebene Frage.
4. Die Antwort erscheint im Panel mit Hinweis auf die Quellseite.

## Aussehen und Erledigt-Zustand

Das Panel ist an die Model-Performance-App angelehnt (modellab-Theme:
Tuerkis/Jade, Radien 8/10/16, Inter + IBM Plex Mono, Hell/Dunkel per
`prefers-color-scheme`). Jede Frage-Antwort ist eine Karte; das Etikett
(FRAGE/ANTWORT) steht in eigener Zeile, der Text darunter.

Jede Karte hat einen Haken: angeklickt einklappt sie zu einer Zeile, damit
man sieht, wo man steht, ohne die Beantworteten zu lesen. Der Zustand wird
pro URL in `browser.storage.local` gemerkt und ueberlebt ein Neuladen.

**Warum `color-mix()` nicht:** Der Firefox des Nutzers ist aelter als 113
(kennt auch kein Side-Panel). `color-mix()` gibt es erst ab 113 — alle
Farben sind deshalb feste Werte.

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

Funktionsnachweis des Add-ons selbst nur in Firefox: Seite oeffnen,
Toolbar-Button klicken, Frage stellen, Antwort im Panel. Interne
Firefox-Seiten (`about:*`, PDFs, Web-Store) bekommen kein Content-Script und
zeigen daher kein Panel.

## Modelle

Ueber die lokale Fassade auf `http://127.0.0.1:4000/v1`:
`agent` (Voreinstellung) fuer diese Programmzugriffe, `coder` fuer
Editorarbeit, `extractor` fuer kleine schnelle Aufgaben. 64k Token je Anfrage.
