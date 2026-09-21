// Baut ein schwebendes Panel am rechten Seitenrand.
//
// Das Panel lebt in einem Shadow-DOM: Die Seite kann es nicht per CSS
// ueberschreiben, und der Panel-Text (Frage, Antwort) taucht nicht im
// gelesenen Seitentext auf, den wir dem Modell schicken.
//
// Hauptaktion "Frage beantworten": Das Modell findet die Frage(n), die AUF
// der Seite stehen (z. B. ein Quiz), und beantwortet sie. "Eigene Frage"
// ist ein Rueckfall, wenn man selbst etwas fragen will.
//
// Die Antwort kommt vom Modell als Markdown (z. B. **Frage:** / **Antwort:**).
// renderAntwort() rendert das sicher (erst HTML-escapen, dann nur eigene
// Tags einfuegen) und zeigt jede Frage-Antwort als eigene Karte.

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
      :host {
        --bg: #ffffff;
        --fg: #1a1a1a;
        --muted: #6b7280;
        --border: #e5e7eb;
        --card: #f9fafb;
        --accent: #4a6cf7;
        --accent-2: #6a5cf7;
        --accent-fg: #ffffff;
        --frage-bg: #eef2ff;
        --frage-fg: #3730a3;
        --antwort-bg: #ecfdf5;
        --antwort-fg: #065f46;
        --shadow: 0 10px 30px rgba(0,0,0,.16);
        color-scheme: light;
      }
      @media (prefers-color-scheme: dark) {
        :host {
          --bg: #1b1e24;
          --fg: #e5e7eb;
          --muted: #9ca3af;
          --border: #2f333b;
          --card: #23262d;
          --accent: #5b7cfa;
          --accent-2: #7c6cf7;
          --accent-fg: #ffffff;
          --frage-bg: #2a2f45;
          --frage-fg: #c3cbff;
          --antwort-bg: #16301f;
          --antwort-fg: #a7f3d0;
          --shadow: 0 10px 30px rgba(0,0,0,.55);
          color-scheme: dark;
        }
      }

      * { box-sizing: border-box;
          font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }

      .knopf {
        position: absolute; top: 12px; right: 12px;
        width: 42px; height: 42px; border-radius: 50%;
        border: 1px solid var(--border);
        background: var(--bg); color: var(--fg);
        font-size: 19px; cursor: pointer;
        box-shadow: 0 2px 10px rgba(0,0,0,.2);
        display: flex; align-items: center; justify-content: center;
        transition: transform .1s;
      }
      .knopf:hover { transform: scale(1.06); }

      .panel {
        position: absolute; top: 62px; right: 12px;
        width: 360px; max-height: calc(100vh - 84px);
        overflow-y: auto;
        background: var(--bg); color: var(--fg);
        border: 1px solid var(--border); border-radius: 14px;
        box-shadow: var(--shadow);
        padding: 14px;
        display: flex; flex-direction: column; gap: 12px;
        font-size: 14px;
      }
      .panel[hidden] { display: none; }

      header { display: flex; align-items: center; justify-content: space-between; }
      h1 { font-size: 15px; margin: 0; font-weight: 700; letter-spacing: .2px;
           display: flex; align-items: center; gap: 8px; }
      h1::before { content: ""; width: 10px; height: 10px; border-radius: 3px;
           background: linear-gradient(135deg, var(--accent), var(--accent-2)); }
      .schliessen {
        border: none; background: none; cursor: pointer;
        font-size: 16px; color: var(--muted); padding: 2px 8px; border-radius: 6px;
      }
      .schliessen:hover { background: var(--card); color: var(--fg); }

      .quelle {
        margin: 0; font-size: 12px; color: var(--muted);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .quelle[hidden] { display: none; }

      button.haupt {
        padding: 11px; border: none; border-radius: 10px;
        font: inherit; font-weight: 600; color: var(--accent-fg);
        background: linear-gradient(135deg, var(--accent), var(--accent-2));
        cursor: pointer; transition: transform .08s, filter .12s;
      }
      button.haupt:hover:not(:disabled) { filter: brightness(1.06); transform: translateY(-1px); }
      button.haupt:disabled { opacity: .6; cursor: wait; }

      .status { font-size: 13px; color: var(--muted); margin: 0; }
      .status[hidden] { display: none; }

      .antwort { display: flex; flex-direction: column; gap: 10px; }
      .antwort:empty { display: none; }
      .antwort p { margin: 0; line-height: 1.5; }
      .antwort code {
        background: var(--card); border: 1px solid var(--border);
        border-radius: 4px; padding: 1px 5px; font-size: .92em;
        font-family: ui-monospace, "SF Mono", Menlo, monospace;
      }
      .antwort ul { margin: 0; padding-left: 18px; line-height: 1.5; }

      .qa {
        background: var(--card); border: 1px solid var(--border);
        border-radius: 10px; padding: 10px 12px;
      }
      .qa-zeile { display: flex; gap: 8px; align-items: flex-start; line-height: 1.5; }
      .qa-zeile + .qa-zeile { margin-top: 8px; padding-top: 8px;
        border-top: 1px dashed var(--border); }
      .qa-text { flex: 1; }
      .badge {
        flex: none; font-size: 10px; font-weight: 700; text-transform: uppercase;
        letter-spacing: .4px; padding: 2px 7px; border-radius: 999px; margin-top: 1px;
      }
      .badge-frage { background: var(--frage-bg); color: var(--frage-fg); }
      .badge-antwort { background: var(--antwort-bg); color: var(--antwort-fg); }

      details { border-top: 1px solid var(--border); padding-top: 10px; font-size: 13px; }
      details summary { cursor: pointer; color: var(--muted); user-select: none; padding: 2px 0; }
      details summary:hover { color: var(--fg); }
      details form { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
      details label { display: flex; flex-direction: column; gap: 3px; }
      details input, details textarea {
        padding: 7px 9px; border: 1px solid var(--border); border-radius: 8px;
        font: inherit; background: var(--card); color: var(--fg); resize: vertical;
      }
      details button {
        padding: 8px; border: none; border-radius: 8px;
        font: inherit; font-weight: 600; background: var(--accent); color: var(--accent-fg);
        cursor: pointer;
      }
      details button:hover:not(:disabled) { filter: brightness(1.06); }
      details button:disabled { opacity: .6; cursor: wait; }
    </style>

    <button class="knopf" title="SeitenFrager oeffnen" aria-label="SeitenFrager oeffnen">❓</button>

    <section class="panel" hidden>
      <header>
        <h1>SeitenFrager</h1>
        <button class="schliessen" title="Schliessen" aria-label="Schliessen">✕</button>
      </header>

      <p class="quelle" hidden></p>

      <button class="haupt" id="beantworten"
        title="Die Frage(n) auf dieser Seite finden und beantworten">
        Frage beantworten
      </button>

      <p class="status" hidden></p>
      <div class="antwort"></div>

      <details>
        <summary>Eigene Frage stellen</summary>
        <form class="eigene">
          <textarea rows="2" placeholder="Eigene Frage zur Seite…"></textarea>
          <button type="submit">Fragen</button>
        </form>
      </details>

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

  // --- Markdown sicher rendern ------------------------------------------
  // Erst alle HTML-Zeichen escapen, dann nur eigene, sichere Tags einfuegen.
  // So kann der Modell-Text kein HTML/JS in die Seite schmuggeln.
  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function inline(s) {
    // s ist bereits escaped; nur Fett und Inline-Code.
    return s
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  }

  // Erst escapen, dann Markdown-Formatierung — in dieser Reihenfolge,
  // sonst wuerde Modell-HTML (z. B. <script>) ungefiltert durchgehen.
  function md(s) {
    return inline(esc(s));
  }

  // Antwort-Text in HTML: jede **Frage:**/**Antwort:**-Kombination wird
  // eine Karte, der Rest ein Absatz (mit Listen- und Inline-Unterstuetzung).
  function renderAntwort(text) {
    const blöcke = text.split(/\n[ \t]*\n+/);
    const out = [];
    for (const block of blöcke) {
      const zeilen = block.split("\n").filter((z) => z.trim() !== "");
      if (zeilen.length === 0) continue;

      const frageZeile = zeilen.find((z) => /^\*\*\s*Frage/i.test(z));
      const antwortZeile = zeilen.find((z) => /^\*\*\s*Antwort/i.test(z));
      if (frageZeile && antwortZeile) {
        const f = frageZeile.replace(/^\*\*\s*Frage[^*]*\*\*\s*:?\s*/i, "");
        const a = antwortZeile.replace(/^\*\*\s*Antwort[^*]*\*\*\s*:?\s*/i, "");
        out.push(
          '<div class="qa">' +
            '<div class="qa-zeile"><span class="badge badge-frage">Frage</span>' +
              '<span class="qa-text">' + md(f) + "</span></div>" +
            '<div class="qa-zeile"><span class="badge badge-antwort">Antwort</span>' +
              '<span class="qa-text">' + md(a) + "</span></div>" +
          "</div>"
        );
        continue;
      }

      if (zeilen.length > 1 && zeilen.every((z) => /^\s*[-*]\s+/.test(z))) {
        out.push(
          "<ul>" +
            zeilen.map((z) => "<li>" + md(z.replace(/^\s*[-*]\s+/, "")) + "</li>").join("") +
            "</ul>"
        );
        continue;
      }

      out.push("<p>" + zeilen.map(md).join("<br>") + "</p>");
    }
    return out.join("");
  }

  // --- Referenzen --------------------------------------------------------
  const knopf = shadow.querySelector(".knopf");
  const panel = shadow.querySelector(".panel");
  const schliessen = shadow.querySelector(".schliessen");
  const quelle = shadow.querySelector(".quelle");
  const beantwortenKnopf = shadow.querySelector("#beantworten");
  const status = shadow.querySelector(".panel > .status");
  const antwort = shadow.querySelector(".antwort");
  const eigeneFormular = shadow.querySelector("form.eigene");
  const eigeneFeld = shadow.querySelector("form.eigene textarea");
  const eigeneKnopf = shadow.querySelector("form.eigene button");
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

  // --- Anfrage an das Modell --------------------------------------------
  // Beide Wege nutzen denselben Ablauf: Seite lesen, an den Hintergrund
  // schicken, Antwort anzeigen. Der Message-Typ waehlt, ob das Modell die
  // Frage auf der Seite findet ("seite_fragen") oder eine eingegebene
  // beantwortet ("frage_stellen").
  async function stellen(typ, frage) {
    beantwortenKnopf.disabled = true;
    eigeneKnopf.disabled = true;
    antwort.textContent = "";
    quelle.hidden = true;
    status.textContent = "Seite wird gelesen und das Modell befragt …";
    status.hidden = false;

    try {
      const ergebnis = await browser.runtime.sendMessage({
        type: typ,
        frage,
        seite: seiteLesen(),
      });
      antwort.innerHTML = renderAntwort(ergebnis.antwort);
      quelle.textContent = `Quelle: ${ergebnis.titel}`;
      quelle.hidden = false;
      status.hidden = true;
    } catch (fehler) {
      status.textContent = `Fehler: ${fehler.message ?? fehler}`;
      status.hidden = false;
    } finally {
      beantwortenKnopf.disabled = false;
      eigeneKnopf.disabled = false;
    }
  }

  // Hauptaktion: Frage(n) auf der Seite finden und beantworten.
  beantwortenKnopf.addEventListener("click", () => stellen("seite_fragen"));

  // Rueckfall: eigene Frage zur Seite.
  eigeneFormular.addEventListener("submit", (ereignis) => {
    ereignis.preventDefault();
    const frage = eigeneFeld.value.trim();
    if (frage) stellen("frage_stellen", frage);
  });
})();
