// Kern des Add-ons: fragt das lokale Modell ueber die Fassade ab und
// liefert die Antwort an das Panel auf der Seite.
//
// Zwei Wege:
//  - "seite_fragen":  Das Modell findet die Frage(n), die AUF der Seite
//    stehen (z. B. ein Quiz), und beantwortet sie.
//  - "frage_stellen": Eine vom Nutzer eingegebene Frage zur Seite.
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
  if (nachricht?.type === "seite_fragen") return seiteFragen(nachricht.seite);
  if (nachricht?.type === "frage_stellen") return frageStellen(nachricht.frage, nachricht.seite);
});

// Die Frage(n) auf der Seite finden und beantworten. Die Antwort kann
// sowohl im Seiteninhalt stehen als auch aus dem Wissen des Modells
// kommen — eine Kursseite zeigt oft nur die Quiz-Frage, nicht die Lektion.
async function seiteFragen(seite) {
  const einstellungen = await browser.storage.local.get(STANDARD);
  if (!einstellungen.api_key) {
    throw new Error("Kein API-Key gesetzt. Im Panel unter 'Einstellungen' eintragen.");
  }
  const system =
    "Diese Webseite enthält eine Quiz-Frage oder mehrere Fragen. " +
    "Finde die Frage(n) im Inhalt und beantworte sie. Nutze den Inhalt der " +
    "Seite und dein Wissen. Gib für jede Frage zuerst die Frage, dann die " +
    "Antwort aus. Steht eine Antwort nirgends und ist sie nicht bekannt, sage " +
    "das in einem Satz. Antworte auf Deutsch.";
  const nutzer =
    `Webseite: ${seite.titel} (${seite.url})\n\n` +
    `Inhalt:\n${seite.text}`;
  const antwort = await modellFragen(einstellungen, system, nutzer);
  return { antwort, titel: seite.titel, url: seite.url };
}

// Eine vom Nutzer eingegebene Frage zur Seite beantworten.
async function frageStellen(frage, seite) {
  const einstellungen = await browser.storage.local.get(STANDARD);
  if (!einstellungen.api_key) {
    throw new Error("Kein API-Key gesetzt. Im Panel unter 'Einstellungen' eintragen.");
  }
  const system =
    "Du beantwortest eine konkrete Frage zum Inhalt einer Webseite. " +
    "Antworte direkt und knapp auf die gestellte Frage — beschreibe nicht " +
    "die Seite oder ihren Typ. Halte dich an den angegebenen Inhalt und dein " +
    "Wissen und erfinde nichts hinzu. Steht die Antwort nicht im Inhalt, sage " +
    "das in einem Satz. Antworte auf Deutsch.";
  const nutzer =
    `Frage: ${frage}\n\n` +
    `Webseite: ${seite.titel} (${seite.url})\n\n` +
    `Inhalt:\n${seite.text}`;
  const antwort = await modellFragen(einstellungen, system, nutzer);
  return { antwort, titel: seite.titel, url: seite.url };
}

async function modellFragen(einstellungen, system, nutzer) {
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
