// Kern des Add-ons: liest die aktuelle Seite, fragt das lokale Modell
// ueber die Fassade ab und liefert die Antwort an das Side-Panel.

const STANDARD = {
  basis_url: "http://127.0.0.1:4000/v1",
  modell: "agent",
  api_key: "",
};

const MAX_ANTWORT_TOKENS = 2048;

// Das Panel ist immer auf dem aktuellen Pfad, egal wie es geoeffnet wurde.
browser.sidePanel
  .setOptions({ path: "panel/panel.html" })
  .catch(() => {});

// Der Werkzeugknopf oeffnet das Panel im aktuellen Tab.
browser.action.onClicked.addListener((tab) => {
  browser.sidePanel.open({ tabId: tab.id });
});

browser.runtime.onMessage.addListener((nachricht) => {
  if (nachricht?.type !== "frage_stellen") return;
  return frageStellen(nachricht.frage);
});

async function frageStellen(frage) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("Kein aktives Tab gefunden.");

  let seite;
  try {
    seite = await browser.tabs.sendMessage(tab.id, { type: "seite_lesen" });
  } catch {
    throw new Error(
      "Auf dieser Seite ist das Add-on nicht verfuegbar (interne Firefox-Seiten, PDFs, Web-Store)."
    );
  }
  if (!seite?.text) throw new Error("Der Seitentext konnte nicht gelesen werden.");

  const einstellungen = await browser.storage.local.get(STANDARD);
  if (!einstellungen.api_key) {
    throw new Error("Kein API-Key gesetzt. Im Panel unter 'Einstellungen' eintragen.");
  }

  const antwort = await modellFragen(einstellungen, seite, frage);
  return { antwort, titel: seite.titel, url: seite.url };
}

async function modellFragen(einstellungen, seite, frage) {
  const system =
    "Du beantwortest Fragen zum Inhalt der aktuellen Webseite. " +
    "Halte dich an den angegebenen Inhalt, erfinde nichts hinzu und antworte auf Deutsch.";
  const nutzer =
    `Webseite: ${seite.titel} (${seite.url})\n\n` +
    `Inhalt:\n${seite.text}\n\n` +
    `Frage: ${frage}`;

  const antwort = await fetch(`${einstellungen.basis_url}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${einstellungen.api_key}`,
    },
    body: JSON.stringify({
      model: einstellungen.modell,
      messages: [
        { role: "system", content: system },
        { role: "user", content: nutzer },
      ],
      max_tokens: MAX_ANTWORT_TOKENS,
      // Das Modell ist ein Thinking-Modell; ohne diese Flag frisst das
      // Nachdenken das Token-Budget, bevor eine Antwort entsteht.
      chat_template_kwargs: { enable_thinking: false },
    }),
  });

  if (!antwort.ok) {
    const text = await antwort.text();
    throw new Error(`Modell-Antwort ${antwort.status}: ${text.slice(0, 300)}`);
  }

  const daten = await antwort.json();
  const text = daten.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Das Modell lieferte keine Antwort.");
  return text;
}
