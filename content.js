// Liest den sichtbaren Text der aktuellen Seite fuer das Add-on.
// Der Text wird gekuerzt, damit er in den 64k-Kontext des Modells passt,
// ohne dass die Fassade ihn zurueckweist.
const MAX_ZEICHEN = 24000;

browser.runtime.onMessage.addListener((nachricht, _sender, senden) => {
  if (nachricht?.type !== "seite_lesen") return;
  senden({
    titel: document.title,
    url: location.href,
    text: (document.body?.innerText ?? "").slice(0, MAX_ZEICHEN),
  });
});
