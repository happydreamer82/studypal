# AGENTS.md — seitenfrager

Wird von opencode jedem Request vorangestellt. Kurz halten: was hier steht,
wird bei jedem Zug mitbezahlt.

## Aufbau

- `manifest.json` — Deklaration (MV3, Side-Panel, Content-Script)
- `background.js` — liest die Seite, fragt das Modell ab, liefert ans Panel
- `content.js` — extrahiert den sichtbaren Text des aktiven Tabs
- `panel/` — Side-Panel (HTML/JS/CSS)

## Regeln

1. Kein Build-Schritt: plain HTML/JS/CSS, keine Abhaengigkeiten, kein npm.
2. Das Modell laeuft nur ueber die Fassade `http://127.0.0.1:4000/v1`,
   nie direkt gegen einen Anbieter.
3. Der API-Key steht nur im `browser.storage.local` des Nutzers,
   nie im Code oder im Repo.
4. Deutsch, auch in Kommentaren.

## Pruefen

```bash
# Modell-Endpunkt erreichbar? (Key aus ~/agenthub/config/agent-keys.env)
curl -s http://127.0.0.1:4000/v1/models -H "Authorization: Bearer <key>"
```

Das Add-on selbst laeuft nur in Firefox: `about:debugging#/runtime/this-firefox`
→ "Zuegiges Add-on laden" → `manifest.json` waehlen.
