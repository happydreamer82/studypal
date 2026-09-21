// Baut ein schwebendes Panel am rechten Seitenrand.
//
// Das Panel lebt in einem Shadow-DOM: Die Seite kann es nicht per CSS
// ueberschreiben, und der Panel-Text (Frage, Antwort) taucht nicht im
// Seitentext auf, den wir dem Modell schicken.

(() => {
  // Nur im obersten Frame; in Iframes waere das Panel falsch verankert.
  if (window.self !== window.top) return;

  const MAX_ZEICHEN = 24000;
  const STANDARD = {
    basis_url: "http://127.0.0.1:4000/v1",
    modell: "agent",
    api_key: "",
  };

  // --- Geruest: Host-Element + Shadow-DOM --------------------------------
  const host = document.createElement("div");
  host.id = "seitenfrager-host";
  // Inline-Styles, damit sie gegen Seiten-CSS gewinnen (außer !important).
  host.style.position = "fixed";
  host.style.top = "0";
  host.style.right = "0";
  host.style.width = "0";
  host.style.height = "0";
  host.style.zIndex = "2147483647";
  (document.body ?? document.documentElement).appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      * { box-sizing: border-box; font-family: system-ui, sans-serif; }

      .knopf {
        position: absolute; top: 12px; right: 12px;
        width: 40px; height: 40px; border-radius: 50%;
        border: 1px solid #8884; background: #fff; color: #222;
        font-size: 18px; cursor: pointer;
        box-shadow: 0 2px 8px #0002;
      }
      .knopf:hover { background: #f0f0f0; }

      .panel {
        position: absolute; top: 60px; right: 12px;
        width: 340px; max-height: calc(100vh - 80px);
        overflow: auto;
        background: #fff; color: #222;
        border: 1px solid #8884; border-radius: 10px;
        box-shadow: 0 8px 28px #0003;
        padding: 12px;
        display: flex; flex-direction: column; gap: 10px;
        font-size: 14px;
      }
      .panel[hidden] { display: none; }

      header { display: flex; align-items: center; justify-content: space-between; }
      h1 { font-size: 15px; margin: 0; }
      .schliessen {
        border: none; background: none; cursor: pointer;
        font-size: 16px; color: #666; padding: 2px 6px;
      }

      .quelle {
        margin: 0; font-size: 12px; opacity: 0.7;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .quelle[hidden] { display: none; }

      form { display: flex; flex-direction: column; gap: 8px; }
      textarea {
        width: 100%; padding: 8px; border: 1px solid #8884;
        border-radius: 6px; font: inherit; resize: vertical;
      }
      button.haupt {
        padding: 8px; border: none; border-radius: 6px;
        font: inherit; font-weight: 600; background: #4a6cf7; color: #fff;
        cursor: pointer;
      }
      button.haupt:disabled { opacity: 0.6; cursor: wait; }

      .knopfleiste { display: flex; gap: 8px; }
      .knopfleiste .haupt { flex: 1; }
      button.neben {
        padding: 8px; border: 1px solid #8884; border-radius: 6px;
        font: inherit; background: #fff; color: #222; cursor: pointer;
      }
      button.neben:disabled { opacity: 0.6; cursor: wait; }

      .status { font-size: 13px; opacity: 0.8; margin: 0; }
      .status[hidden] { display: none; }

      .antwort { white-space: pre-wrap; word-break: break-word; line-height: 1.5; }

      details { border-top: 1px solid #8884; padding-top: 8px; font-size: 13px; }
      details form { gap: 6px; }
      details label { display: flex; flex-direction: column; gap: 2px; }
      details input {
        padding: 6px; border: 1px solid #8884; border-radius: 6px;
        font: inherit;
      }
      details button {
        padding: 6px; border: none; border-radius: 6px;
        font: inherit; background: #8884; cursor: pointer;
      }
    </style>

    <button class="knopf" title="SeitenFrager oeffnen" aria-label="SeitenFrager oeffnen">❓</button>

    <section class="panel" hidden>
      <header>
        <h1>SeitenFrager</h1>
        <button class="schliessen" title="Schliessen" aria-label="Schliessen">✕</button>
      </header>

      <p class="quelle" hidden></p>

      <form class="frage">
        <textarea rows="3" placeholder="Frage zur aktuellen Seite, z. B. 'Was kostet das Angebot?'" required></textarea>
        <div class="knopfleiste">
          <button class="haupt" type="submit">Fragen</button>
          <button class="neben" type="button"
            title="Seite ohne eigene Frage zusammenfassen">Zusammenfassen</button>
        </div>
      </form>

      <p class="status" hidden></p>
      <div class="antwort"></div>

      <details>
        <summary>Einstellungen</summary>
        <form class="einstellungen">
          <label>API-Key
            <input type="password" class="api-key" autocomplete="off"
              placeholder="Key aus ~/agenthub/config/agent-keys.env">
          </label>
          <label>Modell
            <input type="text" class="modell" placeholder="agent">
          </label>
          <label>Modell-Adresse
            <input type="text" class="basis-url" placeholder="http://127.0.0.1:4000/v1">
          </label>
          <button type="submit">Speichern</button>
          <p class="status" hidden></p>
        </form>
      </details>
    </section>
  `;

  // --- Referenzen --------------------------------------------------------
  const knopf = shadow.querySelector(".knopf");
  const panel = shadow.querySelector(".panel");
  const schliessen = shadow.querySelector(".schliessen");
  const quelle = shadow.querySelector(".quelle");
  const frageFormular = shadow.querySelector("form.frage");
  const frageFeld = shadow.querySelector("form.frage textarea");
  const sendenKnopf = shadow.querySelector("form.frage button");
  const status = shadow.querySelector(".panel > .status");
  const antwort = shadow.querySelector(".antwort");
  const einstellungenFormular = shadow.querySelector("form.einstellungen");
  const keyFeld = shadow.querySelector(".api-key");
  const modellFeld = shadow.querySelector(".modell");
  const basisFeld = shadow.querySelector(".basis-url");
  const einstellungenStatus = shadow.querySelector("details .status");

  // --- Panel oeffnen / schliessen ---------------------------------------
  knopf.addEventListener("click", () => (panel.hidden = !panel.hidden));
  schliessen.addEventListener("click", () => (panel.hidden = true));

  // --- Einstellungen laden ----------------------------------------------
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

  // --- Seite lesen -------------------------------------------------------
  // Der Panel-Text steht im Shadow-DOM und taucht hier nicht auf.
  function seiteLesen() {
    return {
      titel: document.title,
      url: location.href,
      text: (document.body?.innerText ?? "").slice(0, MAX_ZEICHEN),
    };
  }

  // --- Frage stellen -----------------------------------------------------
  // Beide Wege nutzen denselben Ablauf: Seite lesen, an den Hintergrund
  // schicken, Antwort anzeigen. "Zusammenfassen" stellt nur eine feste
  // Frage, damit man nichts tippen muss.
  const zusammenfassenKnopf = shadow.querySelector("button.neben");

  async function stellen(frage) {
    sendenKnopf.disabled = true;
    zusammenfassenKnopf.disabled = true;
    antwort.textContent = "";
    quelle.hidden = true;
    status.textContent = "Seite wird gelesen und das Modell befragt …";
    status.hidden = false;

    try {
      const ergebnis = await browser.runtime.sendMessage({
        type: "frage_stellen",
        frage,
        seite: seiteLesen(),
      });
      antwort.textContent = ergebnis.antwort;
      quelle.textContent = `Quelle: ${ergebnis.titel}`;
      quelle.hidden = false;
      status.hidden = true;
    } catch (fehler) {
      status.textContent = `Fehler: ${fehler.message ?? fehler}`;
      status.hidden = false;
    } finally {
      sendenKnopf.disabled = false;
      zusammenfassenKnopf.disabled = false;
    }
  }

  frageFormular.addEventListener("submit", (ereignis) => {
    ereignis.preventDefault();
    const frage = frageFeld.value.trim();
    if (frage) stellen(frage);
  });

  zusammenfassenKnopf.addEventListener("click", () => {
    stellen("Fasse den Inhalt dieser Webseite in wenigen, klaren Sätzen zusammen.");
  });
})();
