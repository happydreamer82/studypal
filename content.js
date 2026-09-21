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
// Gestaltung: an die Model-Performance-App angelehnt (modellab-Theme:
// Tuerkis/Jade, Radien 8/10/16, Inter + IBM Plex Mono). Jede Frage-Antwort
// ist eine Karte; das Etikett (FRAGE/ANTWORT) steht in eigener Zeile, der
// Text darunter. Eine erledigte Frage einklappt zu einer Zeile, damit man
// sieht, wo man steht.
//
// Hinweis: color-mix() wird nicht benutzt — der Firefox des Nutzers ist
// aelter als 113 und kennt es nicht. Alle Farben sind feste Werte.

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

  const css = `
    :host {
      --base-100: #ffffff;
      --base-200: #eef2f1;
      --base-300: #dbe4e2;
      --content: #101d1b;
      --primary: #0d6a61;
      --primary-content: #ffffff;
      --accent: #6d4fa8;
      --success: #0a5038;
      --error: #a4302a;
      --primary-soft: rgba(13,106,97,.12);
      --done-bg: #e4efe9;
      --done-border: #0a5038;
      --r-sel: 8px;
      --r-field: 10px;
      --r-box: 16px;
      --font-sans: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
      --font-mono: "IBM Plex Mono", ui-monospace, "SF Mono", Consolas, monospace;
      color-scheme: light;
    }
    @media (prefers-color-scheme: dark) {
      :host {
        --base-100: #151d20;
        --base-200: #0f1618;
        --base-300: #232d31;
        --content: #e9f0ee;
        --primary: #73e0d1;
        --primary-content: #0c1a19;
        --accent: #c7a7f5;
        --success: #45b88b;
        --error: #f08c7b;
        --primary-soft: rgba(115,224,209,.14);
        --done-bg: #16241d;
        --done-border: #45b88b;
        color-scheme: dark;
      }
    }

    * { box-sizing: border-box; font-family: var(--font-sans); }

    .knopf {
      position: absolute; top: 12px; right: 12px;
      width: 42px; height: 42px; border-radius: 50%;
      border: 1px solid var(--base-300);
      background: var(--base-100); color: var(--content);
      font-size: 19px; cursor: pointer;
      box-shadow: 0 1px 2px rgba(0,0,0,.06), 0 10px 28px -14px rgba(0,0,0,.22);
      display: flex; align-items: center; justify-content: center;
      transition: transform .1s;
    }
    .knopf:hover { transform: scale(1.06); }

    .panel {
      position: absolute; top: 62px; right: 12px;
      width: 380px; max-height: calc(100vh - 84px);
      overflow-y: auto;
      background: var(--base-100); color: var(--content);
      border: 1px solid var(--base-300); border-radius: var(--r-box);
      box-shadow: 0 1px 2px rgba(0,0,0,.06), 0 10px 28px -14px rgba(0,0,0,.22);
      font-size: 14px;
    }
    .panel[hidden] { display: none; }

    .kopf {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: 8px; padding: 14px 16px 12px;
      border-bottom: 1px solid var(--base-300);
      position: sticky; top: 0; background: var(--base-100); z-index: 1;
    }
    .kopf-titel { min-width: 0; }
    .eyebrow {
      display: inline-block; font-family: var(--font-mono);
      font-size: 10px; text-transform: uppercase; letter-spacing: .12em;
      padding: 2px 7px; border-radius: 999px;
      background: var(--primary-soft); color: var(--primary);
    }
    h1 { font-size: 15px; margin: 6px 0 0; font-weight: 600; line-height: 1.2; }
    .schliessen {
      border: none; background: none; cursor: pointer;
      font-size: 16px; color: var(--content); opacity: .6;
      padding: 2px 8px; border-radius: var(--r-sel); line-height: 1;
    }
    .schliessen:hover { background: var(--base-200); opacity: 1; }

    .quelle {
      margin: 0; padding: 8px 16px; font-size: 12px;
      color: var(--content); opacity: .7;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      border-bottom: 1px solid var(--base-300);
    }
    .quelle[hidden] { display: none; }

    .inhalt { padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }

    button.haupt {
      padding: 11px; border: none; border-radius: var(--r-sel);
      font: inherit; font-weight: 600; color: var(--primary-content);
      background: var(--primary); cursor: pointer;
      transition: filter .12s, transform .08s;
    }
    button.haupt:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
    button.haupt:disabled { opacity: .6; cursor: wait; }

    .status { font-size: 13px; color: var(--content); opacity: .75; margin: 0; }
    .status[hidden] { display: none; }
    .status.fehler { color: var(--error); opacity: 1; }

    .fortschritt {
      font-family: var(--font-mono); font-size: 11px;
      color: var(--content); opacity: .7; text-align: center;
    }
    .fortschritt[hidden] { display: none; }

    .antwort { display: flex; flex-direction: column; gap: 10px; }
    .antwort:empty { display: none; }
    .antwort > p { margin: 0; line-height: 1.5; }
    .antwort code {
      background: var(--base-200); border: 1px solid var(--base-300);
      border-radius: 4px; padding: 1px 5px; font-size: .92em;
      font-family: var(--font-mono);
    }
    .antwort ul { margin: 0; padding-left: 18px; line-height: 1.5; }

    /* Frage-Antwort-Karte. Das Etikett steht in eigener Zeile, der Text
       darunter — volle Breite, keine Einrueckung neben dem Etikett. */
    .qa {
      background: var(--base-200); border: 1px solid var(--base-300);
      border-radius: var(--r-field); padding: 10px 12px;
    }
    .qa-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .etikett {
      font-family: var(--font-mono); font-size: 10px; font-weight: 500;
      text-transform: uppercase; letter-spacing: .12em;
    }
    .etikett.frage { color: var(--primary); }
    .etikett.antwort { color: var(--success); }
    .qa-text { font-size: 14px; line-height: 1.5; margin-top: 4px; }
    .qa-antwort { margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--base-300); }

    .done {
      flex: none; width: 24px; height: 24px; border-radius: 50%;
      border: 1px solid var(--base-300); background: var(--base-100);
      color: var(--content); cursor: pointer; opacity: .5;
      display: flex; align-items: center; justify-content: center;
      transition: opacity .12s, background .12s, color .12s;
    }
    .done:hover { opacity: 1; }
    .done svg { width: 14px; height: 14px; }

    /* Erledigt: Karte einklappt zu einer Zeile, Antwort verschwindet. */
    .qa.done { border-color: var(--done-border); background: var(--done-bg); }
    .qa.done .qa-antwort { display: none; }
    .qa.done .etikett.frage { color: var(--success); }
    .qa.done .done { opacity: 1; background: var(--success); border-color: var(--success);
                      color: var(--base-100); }
    .qa.done .qa-text { opacity: .8; }

    details { border-top: 1px solid var(--base-300); padding-top: 10px; font-size: 13px; margin-top: 2px; }
    details summary { cursor: pointer; color: var(--content); opacity: .75; user-select: none; padding: 2px 0; }
    details summary:hover { opacity: 1; }
    details form { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
    details label { display: flex; flex-direction: column; gap: 3px; }
    details input, details textarea {
      padding: 7px 9px; border: 1px solid var(--base-300); border-radius: var(--r-sel);
      font: inherit; background: var(--base-100); color: var(--content); resize: vertical;
    }
    details button {
      padding: 8px; border: none; border-radius: var(--r-sel);
      font: inherit; font-weight: 600; background: var(--primary); color: var(--primary-content);
      cursor: pointer;
    }
    details button:hover:not(:disabled) { filter: brightness(1.08); }
    details button:disabled { opacity: .6; cursor: wait; }
  `;

  const html = `
    <button class="knopf" title="SeitenFrager oeffnen" aria-label="SeitenFrager oeffnen">❓</button>

    <section class="panel" hidden>
      <div class="kopf">
        <div class="kopf-titel">
          <span class="eyebrow">Assistent</span>
          <h1>SeitenFrager</h1>
        </div>
        <button class="schliessen" title="Schliessen" aria-label="Schliessen">✕</button>
      </div>

      <p class="quelle" hidden></p>

      <div class="inhalt">
        <button class="haupt" id="beantworten"
          title="Die Frage(n) auf dieser Seite finden und beantworten">
          Frage beantworten
        </button>

        <p class="status" id="status-haupt" hidden></p>
        <p class="fortschritt" id="fortschritt" hidden></p>
        <div class="antwort" id="antwort"></div>
      </div>

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
          <p class="status" id="status-ein" hidden></p>
        </form>
      </details>
    </section>
  `;

  shadow.innerHTML = `<style>${css}</style>${html}`;

  // --- Markdown sicher rendern ------------------------------------------
  // Erst alle HTML-Zeichen escapen, dann nur eigene, sichere Tags einfuegen.
  // So kann der Modell-Text kein HTML/JS in die Seite schmuggeln.
  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function escAttr(s) {
    return esc(s).replace(/"/g, "&quot;");
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

  // Eine Frage-Antwort-Karte. Das Etikett steht in eigener Zeile, der Text
  // darunter. Der data-frage-Wert ist der Schluessel fuer den Erledigt-Zustand.
  function qaKarte(f, a) {
    const key = f.trim().toLowerCase();
    return (
      '<div class="qa" data-frage="' + escAttr(key) + '">' +
      '<div class="qa-top">' +
      '<span class="etikett frage">Frage</span>' +
      '<button class="done" type="button" aria-pressed="false" ' +
      'title="Als erledigt markieren" aria-label="Frage als erledigt markieren">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M20 6L9 17l-5-5"/></svg></button>' +
      "</div>" +
      '<div class="qa-text">' + md(f) + "</div>" +
      '<div class="qa-antwort">' +
      '<span class="etikett antwort">Antwort</span>' +
      '<div class="qa-text">' + md(a).replace(/\n/g, "<br>") + "</div>" +
      "</div>" +
      "</div>"
    );
  }

  // Antwort-Text in HTML: jede **Frage:**/**Antwort:**-Kombination wird
  // eine Karte, der Rest ein Absatz (mit Listen- und Inline-Unterstuetzung).
  function renderAntwort(text) {
    const blöcke = text.split(/\n[ \t]*\n+/);
    const out = [];
    for (const block of blöcke) {
      const zeilen = block.split("\n").filter((z) => z.trim() !== "");
      if (zeilen.length === 0) continue;

      const fi = zeilen.findIndex((z) => /^\*\*\s*Frage/i.test(z));
      const ai = zeilen.findIndex((z) => /^\*\*\s*Antwort/i.test(z));
      if (fi !== -1 && ai !== -1 && ai >= fi) {
        const f = zeilen[fi].replace(/^\*\*\s*Frage[^*]*\*\*\s*:?\s*/i, "");
        // Die Antwort darf ueber mehrere Zeilen reichen; alles nach der
        // Antwort-Zeile gehoert dazu.
        const a = zeilen
          .slice(ai)
          .map((z, i) => (i === 0 ? z.replace(/^\*\*\s*Antwort[^*]*\*\*\s*:?\s*/i, "") : z))
          .join("\n");
        out.push(qaKarte(f, a));
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
  const status = shadow.querySelector("#status-haupt");
  const forschritt = shadow.querySelector("#fortschritt");
  const antwort = shadow.querySelector("#antwort");
  const eigeneFormular = shadow.querySelector("form.eigene");
  const eigeneFeld = shadow.querySelector("form.eigene textarea");
  const eigeneKnopf = shadow.querySelector("form.eigene button");
  const einstellungenFormular = shadow.querySelector("form.einstellungen");
  const keyFeld = shadow.querySelector(".api-key");
  const modellFeld = shadow.querySelector(".modell");
  const basisFeld = shadow.querySelector(".basis-url");
  const einstellungenStatus = shadow.querySelector("#status-ein");

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

  // --- Erledigt-Zustand --------------------------------------------------
  // Jede Frage-Karte hat einen Haken. Angeklickt einklappt sie zu
  // einer Zeile, damit man sieht, wo man steht, ohne die Beantworteten zu
  // lesen. Der Zustand wird pro URL in storage.local gemerkt und ueberlebt
  // so ein Neuladen der Seite.
  function forschrittAktualisieren(gesamt) {
    if (!gesamt) {
      forschritt.hidden = true;
      return;
    }
    const fertig = antwort.querySelectorAll(".qa.done").length;
    forschritt.textContent = `${fertig} von ${gesamt} erledigt`;
    forschritt.hidden = false;
  }

  async function erledigtVerwalten() {
    const karten = [...antwort.querySelectorAll(".qa")];
    forschrittAktualisieren(karten.length);
    if (!karten.length) return;

    const url = location.href;
    const speicher = (await browser.storage.local.get("erledigt")).erledigt ?? {};
    const erledigt = new Set(speicher[url] ?? []);

    for (const karte of karten) {
      const key = karte.dataset.frage;
      const knopf2 = karte.querySelector(".done");
      if (erledigt.has(key)) karte.classList.add("done");
      knopf2.setAttribute("aria-pressed", karte.classList.contains("done") ? "true" : "false");
      knopf2.addEventListener("click", () => {
        const neu = karte.classList.toggle("done");
        knopf2.setAttribute("aria-pressed", neu ? "true" : "false");
        if (neu) erledigt.add(key);
        else erledigt.delete(key);
        forschrittAktualisieren(karten.length);
        browser.storage.local.set({ erledigt: { ...speicher, [url]: [...erledigt] } });
      });
    }
    forschrittAktualisieren(karten.length);
  }

  // --- Anfrage an das Modell --------------------------------------------
  // Beide Wege nutzen denselben Ablauf: Seite lesen, an den Hintergrund
  // schicken, Antwort anzeigen. Der Message-Typ waehlt, ob das Modell die
  // Frage auf der Seite findet ("seite_fragen") oder eine eingegebene
  // beantwortet ("frage_stellen").
  async function stellen(typ, frage) {
    beantwortenKnopf.disabled = true;
    eigeneKnopf.disabled = true;
    antwort.innerHTML = "";
    quelle.hidden = true;
    status.textContent = "Seite wird gelesen und das Modell befragt …";
    status.hidden = false;
    status.classList.remove("fehler");

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
      await erledigtVerwalten();
    } catch (fehler) {
      status.textContent = `Fehler: ${fehler.message ?? fehler}`;
      status.hidden = false;
      status.classList.add("fehler");
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
