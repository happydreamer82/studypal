# AGENTS.md — StudyPal

Wird von opencode jedem Request vorangestellt. Kurz halten: was hier steht,
wird bei jedem Zug mitbezahlt.

## Aufbau

- `manifest.json` — Deklaration (MV3, Content-Script, Hintergrund-Skript)
- `background.js` — fragt das Modell ueber die Fassade ab, liefert ans Panel
- `content.js` — baut das schwebende Panel rechts auf der Seite (Shadow-DOM),
  liest den Seitentext, schickt ihn an den Hintergrund

## Zweck

Das Add-on findet die Frage(n), die AUF der Seite stehen (z. B. ein Quiz),
und laesst sie vom lokalen Modell beantworten. Hauptknopf "Frage
beantworten" (`seite_fragen`); Rueckfall "Eigene Frage" (`frage_stellen`).

## Regeln

1. Kein Build-Schritt: plain HTML/JS/CSS, keine Abhaengigkeiten, kein npm.
2. Das Modell laeuft nur ueber die Fassade `http://127.0.0.1:4000/v1`,
   nie direkt gegen einen Anbieter.
3. Der API-Key steht nur im `browser.storage.local` des Nutzers,
   nie im Code oder im Repo.
4. Das Panel lebt im Shadow-DOM: Seiten-CSS darf es nicht erreichen,
   und Panel-Text darf nicht in den gelesenen Seitentext gelangen.
5. Kein Side-Panel-API: der Firefox des Nutzers kennt es nicht.
   Das Panel ist ein Content-Script-Element, kein Browser-Panel.
6. Deutsch, auch in Kommentaren.

## Pruefen

```bash
# Modell-Endpunkt erreichbar? (Key aus ~/agenthub/config/agent-keys.env)
curl -s http://127.0.0.1:4000/v1/models -H "Authorization: Bearer <key>"
```

Das Add-on selbst laeuft nur in Firefox: `about:debugging#/runtime/this-firefox`
→ "Zuegiges Add-on laden" → `manifest.json` waehlen. Das Panel oeffnet der
Toolbar-Button des Browsers (alternativ Alt+Shift+S) — kein Knopf auf der Seite.
