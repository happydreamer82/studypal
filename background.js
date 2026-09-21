// Kern des Add-ons: fragt das lokale Modell ueber die Fassade ab und
// liefert die Antwort an das Panel auf der Seite.
//
// Das Panel selbst lebt im Content-Script (content.js) und schickt den
// Seitentext gleich mit — der Hintergrund muss deshalb kein Tab mehr
// anfragen.

const STANDARD = {
  basis_url: "http://127.0.0.1:4000/v1",
  modell: "agent",
  api_key: "",
};

const MAX_ANTWORT_TOKENS = 2048;

browser.runtime.onMessage.addListener((nachricht) => {
  if (nachricht?.type !== "frage_stellen") return;
  return frageStellen(nachricht.frage, nachricht.seite);
});

async function frageStellen(frage, seite) {
  const einstellungen = await browser.storage.local.get(STANDARD);
  if (!einstellungen.api_key) {
    throw new Error("Kein API-Key gesetzt. Im Panel unter 'Einstellungen' eintragen.");
  }

  const antwort = await modellFragen(einstellungen, seite, frage);
  return { antwort, titel: seite.titel, url: seite.url };
}

async function modellFragen(einstellungen, seite, frage) {
  // Frage zuerst und explizit "direkt beantworten, nicht beschreiben":
  // hinter einem langen Inhalt-Block am Ende verliert das Modell (ohne
  // Thinking) gern den Fokus und fasst die Seite zusammen, statt zu antworten.
  const system =
    "Du beantwortest eine konkrete Frage zum Inhalt einer Webseite. " +
    "Antworte direkt und knapp auf die gestellte Frage — beschreibe nicht " +
    "die Seite oder ihren Typ. Halte dich strikt an den angegebenen Inhalt " +
    "und erfinde nichts hinzu. Steht die Antwort nicht im Inhalt, sage das " +
    "in einem Satz. Antworte auf Deutsch.";
  const nutzer =
    `Frage: ${frage}\n\n` +
    `Webseite: ${seite.titel} (${seite.url})\n\n` +
    `Inhalt:\n${seite.text}`;

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
