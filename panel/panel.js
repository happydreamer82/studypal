// Side-Panel: Frage eingeben, Antwort des Modells anzeigen,
// Einstellungen einmal eintragen.
const STANDARD = {
  basis_url: "http://127.0.0.1:4000/v1",
  modell: "agent",
  api_key: "",
};

const frageFormular = document.getElementById("frage-formular");
const frageFeld = document.getElementById("frage");
const sendenKnopf = document.getElementById("senden");
const antwortFeld = document.getElementById("antwort");
const statusZeile = document.getElementById("status");
const quelleZeile = document.getElementById("quelle");

const einstellungenFormular = document.getElementById("einstellungen-formular");
const keyFeld = document.getElementById("api-key");
const modellFeld = document.getElementById("modell");
const basisFeld = document.getElementById("basis-url");
const einstellungenStatus = document.getElementById("einstellungen-status");

// Beim Oeffnen die gespeicherten Einstellungen in die Felder rueckspielen.
browser.storage.local.get(STANDARD).then((e) => {
  keyFeld.value = e.api_key ?? "";
  modellFeld.value = e.modell ?? "";
  basisFeld.value = e.basis_url ?? "";
});

einstellungenFormular.addEventListener("submit", async (ereignis) => {
  ereignis.preventDefault();
  await browser.storage.local.set({
    api_key: keyFeld.value.trim(),
    modell: modellFeld.value.trim() || STANDARD.modell,
    basis_url: basisFeld.value.trim() || STANDARD.basis_url,
  });
  einstellungenStatus.textContent = "Gespeichert.";
  einstellungenStatus.hidden = false;
  setTimeout(() => (einstellungenStatus.hidden = true), 2000);
});

function statusZeigen(text) {
  statusZeile.textContent = text;
  statusZeile.hidden = false;
}

frageFormular.addEventListener("submit", async (ereignis) => {
  ereignis.preventDefault();
  const frage = frageFeld.value.trim();
  if (!frage) return;

  sendenKnopf.disabled = true;
  antwortFeld.textContent = "";
  quelleZeile.hidden = true;
  statusZeigen("Seite wird gelesen und das Modell befragt …");

  try {
    const ergebnis = await browser.runtime.sendMessage({
      type: "frage_stellen",
      frage,
    });
    antwortFeld.textContent = ergebnis.antwort;
    quelleZeile.textContent = `Quelle: ${ergebnis.titel}`;
    quelleZeile.hidden = false;
    statusZeile.hidden = true;
  } catch (fehler) {
    statusZeile.textContent = `Fehler: ${fehler.message ?? fehler}`;
    statusZeile.hidden = false;
  } finally {
    sendenKnopf.disabled = false;
  }
});
