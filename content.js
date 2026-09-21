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
    auto_neu: true,
  };

  // --- Geruest: Host-Element + Shadow-DOM --------------------------------
  const host = document.createElement("div");
  host.id = "studypal-host";
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
      --led: #0d6a61;
      --led-glow: rgba(13,106,97,.5);
      --led-halo: rgba(13,106,97,.22);
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
        --led: #73e0d1;
        --led-glow: rgba(115,224,209,.65);
        --led-halo: rgba(115,224,209,.3);
        color-scheme: dark;
      }
    }

    * { box-sizing: border-box; font-family: var(--font-sans); }

    .knopf {
      position: absolute; top: 12px; right: 12px;
      width: 44px; height: 44px; border-radius: 50%;
      border: 1px solid var(--base-300);
      background: var(--base-100);
      cursor: pointer; padding: 0;
      box-shadow: 0 1px 2px rgba(0,0,0,.06), 0 10px 28px -14px rgba(0,0,0,.22);
      display: flex; align-items: center; justify-content: center;
      transition: transform .1s;
    }
    .knopf:hover { transform: scale(1.06); }
    /* Flache LED im Add-on-Tuerkis: einfarbiger Punkt + weicher Halo.
       Kein Verlauf, kein Glanzpunkt, keine Kuppel — bewusst flach. */
    .knopf .led {
      width: 14px; height: 14px; border-radius: 50%;
      background: var(--led);
      box-shadow: 0 0 3px 1px var(--led-glow), 0 0 9px 2px var(--led-halo);
      transition: filter .15s;
    }
    .knopf:hover .led { filter: brightness(1.15); }
    /* Waehrend das Modell laeuft pulsiert die LED. */
    .knopf.laden .led { animation: led-puls 1.1s ease-in-out infinite; }
    @keyframes led-puls {
      0%, 100% { filter: brightness(1); }
      50% { filter: brightness(1.7); }
    }

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

    /* Block statt Flex: in aelterem Firefox ueberlappen sich verschachtelte
       Flex-Spalten. Block-Layout mit Margins ist hier robuster. */
    .inhalt { padding: 14px 16px; }
    .inhalt > *:not(:first-child) { margin-top: 12px; }

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

    /* Block statt Flex: In aelterem Firefox ueberlappen sich die Kindelemente
       einer verschachtelten Flex-Spalte (Intro + erste Karte). Block-Layout
       mit Abstaenden ueber Margins ist hier robuster. */
    .antwort { display: block; }
    .antwort:empty { display: none; }
    .antwort > *:not(:first-child) { margin-top: 10px; }
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

    /* Wichtig: .done hier ist der HAKEN-Knopf, kein Zustand. Die erledigte
       KARTHE heisst .qa.done (beide Klassen auf EINEM Element). Deshalb die
       Selektoren auf ".qa .done" einschränken — sonst würde die Regel auch
       die KARTHE treffen und sie zu einem 24x24-Flex-Box zusammenklappen. */
    .qa .done {
      flex: none; width: 24px; height: 24px; border-radius: 50%;
      border: 1px solid var(--base-300); background: var(--base-100);
      color: var(--content); cursor: pointer; opacity: .5;
      display: flex; align-items: center; justify-content: center;
      transition: opacity .12s, background .12s, color .12s;
    }
    .qa .done:hover { opacity: 1; }
    .qa .done svg { width: 14px; height: 14px; }

    /* Erledigt: Karte einklappt zu einer Zeile, Antwort verschwindet. */
    .qa.done { border-color: var(--done-border); background: var(--done-bg); }
    .qa.done .qa-antwort { display: none; }
    .qa.done .etikett.frage { color: var(--success); }
    .qa.done .done { opacity: 1; background: var(--success); border-color: var(--success);
                      color: var(--base-100); }
    .qa.done .qa-text { opacity: .8; }

    details { border-top: 1px solid var(--base-300); padding: 10px 16px 14px; font-size: 13px; }
    details summary { cursor: pointer; color: var(--content); opacity: .75; user-select: none; padding: 2px 0; }
    details summary:hover { opacity: 1; }
    /* Checkbox-Zeile: waagerecht, nicht wie die anderen Labels gestapelt. */
    details .auto-zeile { flex-direction: row; align-items: center; gap: 8px; }
    details .auto-zeile input { width: 16px; height: 16px; }
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
    <button class="knopf" title="StudyPal oeffnen" aria-label="StudyPal oeffnen">
      <span class="led"></span>
    </button>

    <section class="panel" hidden>
      <div class="kopf">
        <div class="kopf-titel">
          <span class="eyebrow">Lokales Modell</span>
          <h1>StudyPal</h1>
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
          <label class="auto-zeile">
            <input type="checkbox" class="auto-neu">
            <span>Automatisch bei Seitenwechsel</span>
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

      // Frage-/Antwort-Zeilen erkennen — mit oder ohne fette **Markierung**
      // und mit oder ohne Doppelpunkt. Das Modell liefert beides (nicht
      // deterministisch), daher tolerant matchen, damit die Karte nicht mal
      // so, mal anders rendert.
      const fi = zeilen.findIndex((z) => /^\*{0,2}\s*Frage\b/i.test(z));
      const ai = zeilen.findIndex((z) => /^\*{0,2}\s*Antwort\b/i.test(z));
      if (fi !== -1 && ai !== -1 && ai >= fi) {
        const f = zeilen[fi].replace(/^\*{0,2}\s*Frage\b\s*:?\s*\*{0,2}\s*/i, "");
        // Die Antwort darf ueber mehrere Zeilen reichen; alles nach der
        // Antwort-Zeile gehoert dazu.
        const a = zeilen
          .slice(ai)
          .map((z, i) => (i === 0 ? z.replace(/^\*{0,2}\s*Antwort\b\s*:?\s*\*{0,2}\s*/i, "") : z))
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
  const autoFeld = shadow.querySelector(".auto-neu");

  // --- Panel oeffnen / schliessen ---------------------------------------
  knopf.addEventListener("click", () => (panel.hidden = !panel.hidden));
  schliessen.addEventListener("click", () => (panel.hidden = true));

  // Host sicherstellen, damit er sichtbar bleibt. Zwei Probleme:
  //   1. SPA raeumt fremde Knoten weg -> neu anhaengen.
  //   2. VOLLBILD: Die Pruefung ruft die Fullscreen-API auf. Im Vollbild
  //      rendert der Browser NUR das Vollbild-Element und seine KINDER —
  //      Geschwister (wie unser Host am Body) verschwinden. Deshalb den Host
  //      im Vollbild als Kind VON diesem Element legen, sonst am Body.
  // Ohne die parentNode-Pruefung wirft beides einen Fehler, wenn der Host
  // losgeloescht ist — dann waere das Panel fuer immer weg.
  function hostSichern() {
    const ziel =
      document.fullscreenElement ||
      (document.body ?? document.documentElement);
    if (host.parentNode !== ziel) {
      ziel.appendChild(host);
    } else if (host.nextSibling) {
      // Neue Elemente hinter uns -> ans Ende ziehen, dass sie uns nicht
      // in der Reihenfolge ueberdecken.
      ziel.appendChild(host);
    }
  }

  // Toolbar-Button des Add-ons: schaltet das Panel wie der Knopf auf der
  // Seite — ueberlebt auch, wenn die Seite den Knopf verdeckt hat.
  browser.runtime.onMessage.addListener((nachricht) => {
    if (nachricht?.type === "panel_umschalten") {
      hostSichern();
      panel.hidden = !panel.hidden;
    }
  });

  // Tastenkuerzel: Alt+Shift+S oeffnet/schliesst das Panel — auch wenn die
  // Seite den Knopf verdeckt oder entfernt hat.
  const TASTEN_KUERZEL = { alt: true, shift: true, buchstabe: "s" };
  window.addEventListener(
    "keydown",
    (e) => {
      if (
        e.altKey === TASTEN_KUERZEL.alt &&
        e.shiftKey === TASTEN_KUERZEL.shift &&
        !e.ctrlKey &&
        !e.metaKey &&
        e.key.toLowerCase() === TASTEN_KUERZEL.buchstabe
      ) {
        e.preventDefault();
        e.stopPropagation();
        hostSichern();
        panel.hidden = !panel.hidden;
      }
    },
    true
  );

  // --- Einstellungen laden ----------------------------------------------
  browser.storage.local.get(STANDARD).then((e) => {
    keyFeld.value = e.api_key ?? "";
    modellFeld.value = e.modell ?? "";
    basisFeld.value = e.basis_url ?? "";
    autoFeld.checked = e.auto_neu ?? true;
  });

  einstellungenFormular.addEventListener("submit", async (ereignis) => {
    ereignis.preventDefault();
    await browser.storage.local.set({
      api_key: keyFeld.value.trim(),
      modell: modellFeld.value.trim() || STANDARD.modell,
      basis_url: basisFeld.value.trim() || STANDARD.basis_url,
      auto_neu: autoFeld.checked,
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

  // Eine Karte per Frage-Schluessel als erledigt / nicht erledigt setzen und
  // den Fortschritt aktualisieren. Wird vom manuellen Haken UND vom
  // Auto-Markieren (Frage wurde auf der Seite beantwortet) genutzt.
  function setzeErledigt(key, neu) {
    const karte = [...antwort.querySelectorAll(".qa")].find((el) => el.dataset.frage === key);
    if (!karte) return;
    karte.classList.toggle("done", neu);
    karte.querySelector(".done").setAttribute("aria-pressed", neu ? "true" : "false");
    forschrittAktualisieren(antwort.querySelectorAll(".qa").length);
  }

  // Alle aktuell erledigten Karten pro URL in storage.local schreiben.
  function speichereErledigt() {
    const url = location.href;
    const erledigt = [...antwort.querySelectorAll(".qa.done")].map((el) => el.dataset.frage);
    browser.storage.local.get("erledigt").then((s) => {
      const speicher = s.erledigt ?? {};
      browser.storage.local.set({ erledigt: { ...speicher, [url]: erledigt } });
    });
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
      const ist = erledigt.has(key);
      karte.classList.toggle("done", ist);
      knopf2.setAttribute("aria-pressed", ist ? "true" : "false");
      knopf2.onclick = () => {
        setzeErledigt(key, !karte.classList.contains("done"));
        speichereErledigt();
      };
    }
  }

  // --- Anfrage an das Modell --------------------------------------------
  // Beide Wege nutzen denselben Ablauf: Seite lesen, an den Hintergrund
  // schicken, Antwort anzeigen. Der Message-Typ waehlt, ob das Modell die
  // Frage auf der Seite findet ("seite_fragen") oder eine eingegebene
  // beantwortet ("frage_stellen").
  async function stellen(typ, frage) {
    beantwortenKnopf.disabled = true;
    eigeneKnopf.disabled = true;
    knopf.classList.add("laden");
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
      // Nur bei seite_fragen: Antwort + erkannte Fragen pro URL im Cache
      // merken. So erkennen wir spaeter (auch nach einem Neuladen), ob die
      // Fragen noch dieselben sind -> dann kein erneutes Befragen.
      if (typ === "seite_fragen") {
        const fragen = [...antwort.querySelectorAll(".qa")].map((el) => el.dataset.frage);
        // Fingerabdruck = aktueller Seitentext, damit wir spaeter messen
        // koennen, wie viel sich seit diesem Befragen auf der Seite geaendert hat.
        await cacheSpeichern(ergebnis.antwort, fragen, normSeitentext());
      }
    } catch (fehler) {
      status.textContent = `Fehler: ${fehler.message ?? fehler}`;
      status.hidden = false;
      status.classList.add("fehler");
    } finally {
      beantwortenKnopf.disabled = false;
      eigeneKnopf.disabled = false;
      knopf.classList.remove("laden");
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

  // --- Automatisch beobachten --------------------------------------------
  // Das Modell wird NUR befragt, wenn sich die FRAGEN auf der Seite aendern
  // (neue Seite, naechstes Quiz, "NEXT" in einer Pruefung). Wenn der Nutzer
  // nur eine Antwort auf der Seite markiert (Radio, "CHECK", Rueckmeldung wie
  // "Congratulations") oder die Seite neu laedt, wird NICHT neu befragt — die
  // passende Karte wird stattdessen automatisch als erledigt eingeklappt.
  //
  // Signal ist die Groesse der Text-Aenderung auf der SEITE seit dem letzten
  // Befragen (nicht der Modell-Text, der unzuverlaessig ist):
  //   - kleine Aenderung (Rueckmeldung, Timer) -> dieselbe Frage -> nur
  //     erledigt setzen.
  //   - grosse Aenderung (ganz neue Frage + Optionen) -> neu befragen.
  // Nach jedem Befragen merken wir uns den Seitentext (Fingerabdruck) pro URL
  // im Cache. Der manuelle Knopf "Frage beantworten" fragt IMMER neu.
  const DEBOUNCE_MS = 900;
  const MIN_REFETCH_MS = 3000; // Schutz gegen Re-Query-Schleifen
  const START_VERZOEGERUNG_MS = 1500;
  // Darunter gilt die Aenderung als "dieselbe Frage" (Rueckmeldung/Timer);
  // drueber als "neue Frage" (Frage + Optionen wurden ersetzt).
  const KLEIN_SCHWELLE = 100;

  // Typische Quiz-Rueckmeldungen nach dem Pruefen einer Antwort. Bewusst als
  // Wortgruppen, damit Antwortoptionen mit "correct" o. a. nicht treffen.
  const FEEDBACK =
    /(congratulations|that was the (right|wrong) answer|correct answer|wrong answer|nice work|well done|correct!|incorrect|richtige antwort|falsche antwort|leider falsch)/i;

  let autoTimer = null;
  let letzterRefetch = 0;
  let letzteUrl = location.href;

  // --- Cache pro URL -----------------------------------------------------
  // { text: rohe Modell-Antwort, fragen: [Frage-Schluessel], fp: Seitentext,
  //   zeit }
  async function cacheLaden() {
    const c = (await browser.storage.local.get("cache")).cache ?? {};
    return c[location.href] ?? null;
  }
  async function cacheSpeichern(text, fragen, fp) {
    const c = (await browser.storage.local.get("cache")).cache ?? {};
    c[location.href] = { text, fragen, fp, zeit: Date.now() };
    await browser.storage.local.set({ cache: c });
  }

  function normSeitentext() {
    return (document.body?.innerText ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  // Groesse des geaenderten Textbereichs zwischen zwei Seitentexten: laenge
  // des Mittelstuecks, das sich unterscheidet (gemeinsames Praefix und Suffix
  // ausgeklammert). Ein Timer-Tick sind ~1 Zeichen, eine neue Frage (Frage +
  // Optionen) hunderte.
  function aenderungsgroesse(a, b) {
    if (a === b) return 0;
    const laengeA = a.length, laengeB = b.length;
    const grenze = Math.min(laengeA, laengeB);
    let vorne = 0;
    while (vorne < grenze && a[vorne] === b[vorne]) vorne++;
    let hinten = 0;
    while (hinten < grenze - vorne && a[laengeA - 1 - hinten] === b[laengeB - 1 - hinten]) hinten++;
    return Math.max(laengeA, laengeB) - vorne - hinten;
  }

  // Stabile Signatur einer Frage: erste Woerter, unempfindlich gegen
  // Ueberschreibungen am Ende oder leicht geaenderte Formulierungen.
  function signatur(key) {
    return key.split(/\s+/).filter(Boolean).slice(0, 6).join(" ");
  }

  // Welche gemerkten Fragen haben auf der Seite eine Rueckmeldung?
  function erkennBeantwortet(fragen, text) {
    const neu = new Set();
    if (!fragen.length) return neu;
    const pos = fragen
      .map((key) => ({ key, idx: text.indexOf(signatur(key)) }))
      .filter((p) => p.idx !== -1)
      .sort((a, b) => a.idx - b.idx);
    for (let i = 0; i < pos.length; i++) {
      const ende = i + 1 < pos.length ? pos[i + 1].idx : text.length;
      if (FEEDBACK.test(text.slice(pos[i].idx, ende))) neu.add(pos[i].key);
    }
    return neu;
  }

  // Gedebounced Pruefung nach einer Seiten-Aenderung.
  async function autoPruefen() {
    const e = await browser.storage.local.get(["auto_neu", "api_key"]);
    if (!e.auto_neu || !e.api_key || beantwortenKnopf.disabled) return;

    const cache = await cacheLaden();
    if (!cache || !cache.fp) return; // nichts gemerkt -> warten auf Start/Klick

    const text = normSeitentext();
    const aenderung = aenderungsgroesse(cache.fp, text);

    // Grosse Aenderung: neue Frage -> neu befragen.
    if (aenderung >= KLEIN_SCHWELLE) {
      if (Date.now() - letzterRefetch < MIN_REFETCH_MS) return;
      letzterRefetch = Date.now();
      stellen("seite_fragen");
      return;
    }

    // Kleine Aenderung: dieselbe Frage. Nur NEU beantwortete Fragen erledigt
    // markieren (z. B. nach "CHECK").
    const neu = erkennBeantwortet(cache.fragen, text);
    let geaendert = false;
    for (const key of neu) {
      const karte = [...antwort.querySelectorAll(".qa")].find((el) => el.dataset.frage === key);
      if (karte && !karte.classList.contains("done")) {
        setzeErledigt(key, true);
        geaendert = true;
      }
    }
    if (geaendert) speichereErledigt();
  }

  // Beim Oeffnen / nach URL-Wechsel: wenn die Seite (nahezu) gleich ist wie
  // beim letzten Befragen, die Antwort aus dem Cache zeigen (kein Re-Query).
  // Sonst neu befragen.
  async function autoStart() {
    const e = await browser.storage.local.get(["auto_neu", "api_key"]);
    if (!e.auto_neu || !e.api_key || beantwortenKnopf.disabled) return;

    const cache = await cacheLaden();
    if (cache && cache.fp && aenderungsgroesse(cache.fp, normSeitentext()) < KLEIN_SCHWELLE) {
      antwort.innerHTML = renderAntwort(cache.text);
      quelle.textContent = `Quelle: ${document.title}`;
      quelle.hidden = false;
      await erledigtVerwalten();
      return;
    }
    stellen("seite_fragen");
  }

  // In-Page-Aenderungen beobachten. Das Panel liegt im Shadow-DOM und loest
  // den Beobachter nicht aus. attributes: viele Quiz-Seiten wechseln Fragen
  // nur per CSS-Klasse oder Inline-Style (die Knoten bleiben gleich) — das
  // feuert nur mit attributeFilter.
  const beobachter = new MutationObserver(() => {
    if (autoTimer) clearTimeout(autoTimer);
    autoTimer = setTimeout(autoPruefen, DEBOUNCE_MS);
  });
  beobachter.observe(document.body, {
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: ["class", "style", "hidden"],
  });

  // Vollbild-Wechsel (z. B. "Start test" in einer Pruefung): sofort den Host
  // neu einlagern — im Vollbild muss er Kind des Vollbild-Elements sein,
  // sonst rendert der Browser ihn nicht.
  document.addEventListener("fullscreenchange", hostSichern);

  // Sicherheitsnetz: Manche Seiten tauschen Fragen so aus, dass kein
  // Mutation-Event ankommt (reine Style-Wechsel, Aenderungen aus Web-Workers
  // o. a.). Alle 2 s vergleichen wir den SICHTBAREN Text mit dem letzten
  // Stand. innerText zahlt nur sichtbare Elemente — ausgeblendete Fragen
  // bleiben draussen. Kleine Aenderungen (Timer-Tick ~1 Zeichen) ignorieren
  // wir, damit das nicht bei jedem Tick feuert.
  let letzterSichtbar = normSeitentext();
  setInterval(() => {
    // SPA-Abwehr: Host sichern (neu anhaengen, falls die Seite ihn entfernt
    // hat; ans Ende ziehen, falls neue Elemente ueber uns liegen).
    hostSichern();

    const fp = normSeitentext();
    const diff = aenderungsgroesse(letzterSichtbar, fp);
    letzterSichtbar = fp;
    if (diff > 5) autoPruefen();
  }, 2000);

  // URL-Wechsel: pushState/replaceState feuert kein Event, daher abfragen.
  const urlPruefen = () => {
    if (location.href !== letzteUrl) {
      letzteUrl = location.href;
      letzterRefetch = Date.now();
      autoStart();
    }
  };
  window.addEventListener("popstate", urlPruefen);
  window.addEventListener("hashchange", urlPruefen);
  setInterval(urlPruefen, 800);

  // Einmalig beim Oeffnen: kurz warten, bis die Seite steht, dann starten.
  setTimeout(autoStart, START_VERZOEGERUNG_MS);
})();
