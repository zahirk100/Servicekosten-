/* Servicekosten — interface.

   Twee rollen op één pagina:
   - Huurder: dashboard met eigen dossiers, een controle in vier stappen,
     en na indienen een bevestiging dat er contact wordt opgenomen.
   - Beheer: binnengekomen aanvragen, verwerken, en een rapport opstellen.

   De huurder krijgt de uitkomst in gewone taal; de juridische onderbouwing
   staat er wel, maar weggeklapt. */

(function () {
  "use strict";

  const D = window.SERVICEKOSTEN_DATA;
  Kern.init({ normen: D.normen });
  Parser.init({ classificatie: D.classificatie });

  const UITLEG = D.uitleg.regels;
  const STAT = D.uitleg.statussen;
  const MERK = { ROOD: "!", ORANJE: "?", GROEN: "✓", BUITEN_BEVOEGDHEID: "–" };
  const RANG = ["ROOD", "ORANJE", "GROEN", "BUITEN_BEVOEGDHEID"];
  const REGELINFO = {};
  for (const r of D.beslisregels.regels) REGELINFO[r.id] = r;

  const STATUSSEN = {
    nieuw:        { label: "Nieuw",           klasse: "st-nieuw" },
    behandeling:  { label: "In behandeling",  klasse: "st-behandeling" },
    afgehandeld:  { label: "Afgehandeld",     klasse: "st-afgehandeld" },
    afgewezen:    { label: "Geen actie",      klasse: "st-afgewezen" },
  };

  let rol = "huurder";
  let dossier = leegDossier();
  let uitkomst = null;
  let isVoorbeeld = false;
  let vraagIndex = 0;
  let filter = "alle";
  let zoekterm = "";
  let geopendDossier = null;
  let bijlagen = [];
  let ingediend = false;
  let stil = false;   // waar tijdens terugnavigatie: dan geen nieuwe geschiedenis
  let navN = 0;

  /* ───────────────────────────────────────────────────────────── hulpjes */
  const $ = (s) => document.querySelector(s);
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") n.className = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) {
      if (kid === null || kid === undefined || kid === false) continue;
      n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return n;
  }
  const euro = (w) => {
    const n = Number(w);
    if (!isFinite(n)) return "—";
    return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);
  };
  const datum = (iso) => {
    try { return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }); }
    catch { return iso; }
  };
  const datumTijd = (iso) => {
    try { return new Date(iso).toLocaleString("nl-NL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
    catch { return iso; }
  };
  function melding(tekst, soort) {
    const n = el("div", { class: "melding " + (soort || "info") }, tekst);
    $("#meldingen").append(n);
    if (soort !== "fout") setTimeout(() => n.remove(), 9000);
    return n;
  }
  const wisMeldingen = () => { $("#meldingen").textContent = ""; };
  const chip = (status) => {
    const s = STATUSSEN[status] || STATUSSEN.nieuw;
    return el("span", { class: "chip " + s.klasse }, el("span", { class: "stip", "aria-hidden": "true" }), s.label);
  };

  function leegDossier() {
    return {
      huurder: { naam: "", email: "", telefoon: "", adres: "", verhuurder: "" },
      woonruimte: { zelfstandig: true, aantal_woonruimten_op_aansluiting: 1, gebruikt_gemeenschappelijke_ruimten: true },
      periode: { jaar: null, maand_van: 1, maand_tot_en_met: 12 },
      procedure: {}, voorschot_in_rekening_gebracht: null, overeengekomen_maximum: null,
      kostenposten: [], bron: "",
    };
  }

  const SCHERMEN = ["dash", "gegevens", "invoer", "vragen", "uitkomst", "bedankt", "mijn", "beheer", "dossier"];
  // Tijdens de controle zelf helpt de rolwissel niemand; hij kost alleen een
  // tweede kopregel op een telefoon. Hij komt terug zodra je ergens kunt kiezen.
  const MET_ROLWISSEL = new Set(["dash", "mijn", "beheer", "dossier"]);

  function toon(naam) {
    for (const s of SCHERMEN) $("#s-" + s).hidden = s !== naam;
    const rollen = MET_ROLWISSEL.has(naam);
    $("#rollen").hidden = !rollen;
    $("#balk").classList.toggle("zonder-rollen", !rollen);
    if (stil) { /* we komen hier via de terugknop: de geschiedenis klopt al */ }
    else if (history.state && history.state.scherm === naam) { /* zelfde scherm, geen dubbele stap */ }
    else {
      navN += 1;
      try { history.pushState({ scherm: naam, n: navN }, ""); } catch { /* geschiedenis niet beschikbaar */ }
    }
    window.scrollTo({ top: 0 });
  }

  /* De terugknop van de telefoon hoort binnen de applicatie te blijven. Elk
     scherm krijgt daarom een eigen stap in de geschiedenis; popstate zet het
     bijbehorende scherm terug uit wat er nog in het geheugen staat. */
  function naarScherm(naam) {
    wisMeldingen();
    if (naam === "beheer") { rol = "beheer"; rolKnoppen(); rendBeheer(); return toon("beheer"); }
    if (naam === "dash") { rol = "huurder"; rolKnoppen(); rendDash(); return toon("dash"); }
    if (naam === "gegevens") { voortgang("#vg-gegevens", 1, 4); vulGegevensVelden(); return toon("gegevens"); }
    if (naam === "invoer") {
      voortgang("#vg-invoer", 2, 4);
      rendFotos();
      if (dossier.kostenposten.length && $("#handblok").hidden) toonControle();
      return toon("invoer");
    }
    if (naam === "vragen") {
      if (!dossier.kostenposten.length) return naarScherm("invoer");
      toonVraag(); return toon("vragen");
    }
    if (naam === "uitkomst") {
      if (!uitkomst || ingediend) return naarScherm("dash");
      rendUitkomst(); return toon("uitkomst");
    }
    if (naam === "mijn") {
      const a = mijnDossiers().find((x) => x.id === geopendDossier);
      return a ? openMijnDossier(a) : naarScherm("dash");
    }
    if (naam === "dossier") {
      const a = Opslag.lijst().find((x) => x.id === geopendDossier);
      return a ? openDossier(a) : naarScherm("beheer");
    }
    if (naam === "bedankt") return naarScherm("dash");
    return toon(naam);
  }
  function herstel(naam) { stil = true; try { naarScherm(naam); } finally { stil = false; } }
  /* Terug: liefst een echte stap terug in de geschiedenis, zodat de knop in de
     applicatie en de knop van de telefoon hetzelfde doen. */
  function terug(valTerug) {
    if (history.state && history.state.n > 0) history.back();
    else naarScherm(valTerug);
  }
  function voortgang(id, stap, totaal) {
    const bak = $(id);
    if (!bak) return;
    bak.textContent = "";
    for (let i = 1; i <= totaal; i++) bak.append(el("span", { class: i <= stap ? "klaar" : "" }));
  }

  /* ───────────────────────────────────────────── huurder · dashboard */

  const mijnDossiers = () => {
    const alles = Opslag.lijst();
    if (Opslag.modus !== "gedeeld" || !Opslag.viewerId) return alles;
    return alles.filter((a) => a.viewer_id === Opslag.viewerId);
  };

  function rendDash() {
    const bak = $("#dash-inhoud");
    bak.textContent = "";
    const eigen = mijnDossiers();

    const concept = Opslag.leesConcept();
    if (concept && concept.dossier) {
      bak.append(el("div", { class: "hervat" },
        el("p", { class: "oog" }, "Niet afgemaakt"),
        el("h3", {}, "Je hebt een controle openstaan"),
        el("p", { class: "klein" }, conceptRegel(concept)),
        el("div", { class: "knoppen rij", style: "margin-top:13px" },
          el("button", { class: "primair", type: "button", onclick: () => hervatConcept(concept) }, "Verder waar je was"),
          el("button", { class: "link", type: "button", onclick: () => { Opslag.wisConcept(); rendDash(); } }, "Weggooien"))));
    }

    if (!eigen.length) {
      bak.append(
        el("div", { class: "opener" },
          el("p", { class: "oog" }, "Controle jaarafrekening"),
          el("h1", {}, "Wat mag je verhuurder je écht in rekening brengen?"),
          el("p", { class: "lead" },
            "Deze check rekent je servicekostenafrekening na volgens het beleidsboek van de Huurcommissie, " +
            "post voor post. Je ziet meteen waar je mogelijk recht op hebt — en daarna kijken wij er nog met " +
            "de hand naar.")),
        el("div", { class: "route" },
          [["1", "Je gegevens", "Zodat we contact met je kunnen opnemen over je dossier."],
           ["2", "Je afrekening erin", "Upload het bestand, plak de tekst, of voer de posten zelf in."],
           ["3", "Vijf korte vragen", "Over je woning en wat je verhuurder heeft aangeleverd."],
           ["4", "Je uitkomst", "Direct een voorlopig oordeel. Dien je het in, dan volgt een rapport."]]
            .map(([n, t, s]) => el("div", { class: "route-item" },
              el("span", { class: "stap" }, n),
              el("span", {}, el("b", {}, t), el("span", {}, s))))),
        el("div", { class: "knoppen" },
          el("button", { class: "primair vol", type: "button", onclick: startControle }, "Begin de check"),
          el("button", { class: "vol", type: "button", onclick: toonVoorbeeld }, "Bekijk eerst een voorbeeld")),
        el("p", { class: "notitie" }, el("b", {}, "Gratis en privé. "),
          "De berekening gebeurt in je eigen browser. Er gaat pas iets weg als je zelf op indienen drukt."));
      return;
    }

    const totaal = eigen.reduce((s, a) => s + Number(a.correctie || 0), 0);
    const open = eigen.filter((a) => a.status === "nieuw" || a.status === "behandeling").length;

    bak.append(
      el("p", { class: "oog" }, "Mijn dossiers"),
      el("h1", {}, eigen.length === 1 ? "Je dossier" : "Je dossiers"),
      el("p", { class: "klein" }, "Hier zie je wat je hebt ingediend en hoe ver het staat."),
      el("div", { class: "kpi", style: "margin-top:20px" },
        el("div", {}, el("div", { class: "k" }, "Ingediend"), el("div", { class: "v" }, String(eigen.length)),
          el("div", { class: "t" }, eigen.length === 1 ? "dossier" : "dossiers")),
        el("div", {}, el("div", { class: "k" }, "In behandeling"), el("div", { class: "v" }, String(open)),
          el("div", { class: "t" }, "wacht op ons")),
        el("div", {}, el("div", { class: "k" }, "Mogelijk terug"), el("div", { class: "v" }, euro(totaal)),
          el("div", { class: "t" }, "over alle dossiers"))),
      el("div", { class: "knoppen", style: "margin-top:18px" },
        el("button", { class: "primair vol", type: "button", onclick: startControle }, "Nieuwe controle starten")),
      el("div", { class: "groepkop" }, el("h2", {}, "Overzicht")),
      el("ul", { class: "dossiers" }, eigen.map((a) => el("li", {},
        el("button", { type: "button", onclick: () => openMijnDossier(a) },
          el("span", { class: "chip " + (STATUSSEN[a.status] || STATUSSEN.nieuw).klasse },
            el("span", { class: "stip", "aria-hidden": "true" }), (STATUSSEN[a.status] || STATUSSEN.nieuw).label),
          el("span", { class: "naam" }, "Boekjaar " + a.jaar + (a.huurder && a.huurder.adres ? " · " + a.huurder.adres : "")),
          el("span", { class: "som" }, euro(a.correctie)),
          el("span", { class: "meta" }, a.id + " · ingediend " + datum(a.ingediend_op)))))));
  }

  function conceptRegel(c) {
    const d = c.dossier || {};
    const posten = (d.kostenposten || []).length;
    const wie = (d.huurder && d.huurder.naam) ? d.huurder.naam + " · " : "";
    const fotos = (c.bijlagen || []).length;
    return wie +
      (posten ? posten + " " + (posten === 1 ? "post" : "posten") + " ingevoerd" : "nog geen posten") +
      (fotos ? " · " + fotos + (fotos === 1 ? " foto" : " foto's") : "") +
      " · bewaard " + datumTijd(new Date(c.bewaard_op).toISOString());
  }

  function hervatConcept(c) {
    isVoorbeeld = false; ingediend = false; uitkomst = null;
    dossier = c.dossier;
    bijlagen = c.bijlagen || [];
    vraagIndex = Math.min(c.vraagIndex || 0, VRAGEN.length - 1);
    naarScherm(c.scherm || "gegevens");
  }

  /* Een halfingevulde controle blijft staan als het tabblad dichtgaat. Lukt het
     bewaren niet door de foto's, dan bewaren we de rest liever wel. */
  function bewaar(scherm) {
    if (isVoorbeeld || ingediend) return;
    if (!Opslag.bewaarConcept({ scherm, vraagIndex, dossier, bijlagen })) {
      Opslag.bewaarConcept({ scherm, vraagIndex, dossier, bijlagen: [] });
    }
  }

  function openMijnDossier(a) {
    geopendDossier = a.id;
    const bak = $("#mijn-inhoud");
    bak.textContent = "";
    bak.append(
      el("p", { class: "oog" }, "Dossier " + a.id),
      el("h1", {}, "Boekjaar " + a.jaar),
      el("div", { style: "margin:10px 0 18px" }, chip(a.status)),
      a.afhandeling && a.afhandeling.uitkomst ? el("div", { class: "kaart uitslagkaart" },
        el("p", { class: "oog" }, "Uitkomst"),
        el("h2", {}, afloopLabel(a.afhandeling.uitkomst)),
        a.afhandeling.bedrag != null
          ? el("div", { class: "groot" }, euro(a.afhandeling.bedrag),
              el("span", { class: "klein" }, " daadwerkelijk gecorrigeerd")) : null,
        a.afhandeling.toelichting ? el("p", { class: "klein" }, a.afhandeling.toelichting) : null,
        el("p", { class: "mini" }, "Afgerond op " + datumTijd(a.afhandeling.op))) : null,

      el("div", { class: "kaart" },
        el("p", { class: "oog" }, "Stand van zaken"),
        el("p", { class: "klein" }, statusTekstHuurder(a)),
        huurderVoortgang(a),
        el("ul", { class: "tijdlijn" },
          el("li", {}, el("span", { class: "wie" }, "Ingediend"),
            el("div", { class: "wanneer" }, datumTijd(a.ingediend_op))),
          (a.notities || []).map((n) => el("li", {},
            el("span", { class: "wie" }, n.titel || "Update"),
            el("div", {}, n.tekst),
            el("div", { class: "wanneer" }, datumTijd(n.op)))))),
      el("div", { class: "kpi", style: "margin-top:14px" },
        el("div", {}, el("div", { class: "k" }, "Afgerekend"), el("div", { class: "v" }, euro(a.totaal_verhuurder))),
        el("div", {}, el("div", { class: "k" }, "Toegestaan"), el("div", { class: "v" }, euro(a.totaal_model))),
        el("div", {}, el("div", { class: "k" }, "Verschil"), el("div", { class: "v" }, euro(a.correctie)))),
      el("div", { class: "groepkop" }, el("h2", {}, "Bevindingen")),
      rendGroepenUit(a.bevindingen || []));
    toon("mijn");
  }

  const afloopLabel = (w) => {
    const g = AFLOOP.find((x) => x.w === w);
    return (g && g.l) || String(w);
  };

  /* De huurder ziet wat er met zijn dossier gebeurt, in zijn eigen woorden —
     niet de werklijst van de beoordelaar. */
  const HUURDERSTAPPEN = [
    ["ontvankelijkheid", "Gecontroleerd of je verzoek behandeld kan worden"],
    ["posten", "Je posten nagelopen"],
    ["stukken", "Ontbrekende stukken opgevraagd"],
    ["herbeoordeeld", "Opnieuw berekend met de nieuwe gegevens"],
    ["rapport", "Rapport naar je verstuurd"],
    ["afgerond", "Dossier afgerond"],
  ];

  function huurderVoortgang(a) {
    const gedaan = HUURDERSTAPPEN.filter(([k]) => (a.stappen || {})[k]);
    if (!gedaan.length) return null;
    return el("ul", { class: "stappen klein-stappen" }, gedaan.map(([k, l]) =>
      el("li", { class: "klaar" },
        el("span", { class: "vink stil", "aria-hidden": "true" }, "✓"),
        el("span", { class: "wat" }, el("b", {}, l)),
        el("span", { class: "wanneer" }, datum(a.stappen[k])))));
  }

  function statusTekstHuurder(a) {
    if (a.status === "nieuw") return "Je dossier is binnen. We bekijken het en nemen contact met je op met " +
      "een rapport en onze bevindingen.";
    if (a.status === "behandeling") return "We zijn met je dossier bezig. Zodra het rapport klaar is, hoor je van ons.";
    if (a.status === "afgehandeld") return "Je dossier is afgerond. Zie de updates hieronder.";
    if (a.status === "afgewezen") return "We hebben besloten geen vervolgstappen te nemen. De toelichting staat hieronder.";
    return "";
  }

  /* ─────────────────────────────────────────────── huurder · controle */

  function startControle() {
    wisMeldingen();
    isVoorbeeld = false;
    ingediend = false;
    uitkomst = null;
    dossier = leegDossier();
    bijlagen = [];
    handRijen = [];
    Opslag.wisConcept();
    naarScherm("gegevens");
  }

  function vulGegevensVelden() {
    $("#g-naam").value = dossier.huurder.naam;
    $("#g-email").value = dossier.huurder.email;
    $("#g-tel").value = dossier.huurder.telefoon;
    $("#g-adres").value = dossier.huurder.adres;
    $("#g-verhuurder").value = dossier.huurder.verhuurder;
  }

  function leesGegevens() {
    dossier.huurder = {
      naam: $("#g-naam").value.trim(), email: $("#g-email").value.trim(),
      telefoon: $("#g-tel").value.trim(), adres: $("#g-adres").value.trim(),
      verhuurder: $("#g-verhuurder").value.trim(),
    };
  }

  /* ─────────────────────────────────────────────────── inlezen */

  function neemConceptOver(concept, bron) {
    dossier.bron = bron;
    dossier.periode.jaar = concept.jaar;
    dossier.periode.maand_van = concept.maand_van;
    dossier.periode.maand_tot_en_met = concept.maand_tot_en_met;
    dossier.voorschot_in_rekening_gebracht = concept.voorschot;
    if (concept.aantal_woonruimten) dossier.woonruimte.aantal_woonruimten_complex = concept.aantal_woonruimten;
    dossier.kostenposten = concept.posten.map((p, i) => ({
      id: "P" + (i + 1), categorie: p.categorie, omschrijving: p.omschrijving,
      bedrag_verhuurder: p.bedrag, overeengekomen: true, bewijs: [],
      levering_gemotiveerd_betwist: false, parameters: {}, _alt: p.alternatieve_bedragen,
    }));
    for (const post of dossier.kostenposten) {
      if (post.categorie && /^NUT-.*-METER$/.test(post.categorie)) {
        if (concept.meterstanden.beginstand) post.parameters.beginstand = concept.meterstanden.beginstand;
        if (concept.meterstanden.eindstand) post.parameters.eindstand = concept.meterstanden.eindstand;
      }
    }
    const zonder = dossier.kostenposten.filter((p) => !p.categorie).length;
    if (zonder) {
      melding(zonder + " van de " + dossier.kostenposten.length + " regels herkende ik niet als kostenpost. " +
        "Die laat ik buiten de berekening.", "letop");
      dossier.kostenposten = dossier.kostenposten.filter((p) => p.categorie);
    }
    return dossier.kostenposten.length;
  }

  function leesTekst(tekst, bron) {
    const concept = Parser.parseAfrekening(tekst, {});
    const aantal = neemConceptOver(concept, bron);
    if (!aantal) {
      melding("Ik herkende geen kostenposten. Controleer of dit de servicekostenafrekening is, of voer de " +
        "posten zelf in.", "fout");
      return false;
    }
    melding(aantal + " " + (aantal === 1 ? "kostenpost" : "kostenposten") + " ingelezen. Controleer ze hieronder.", "ok");
    return true;
  }

  async function leesBestand(file) {
    wisMeldingen();
    const naam = file.name || "bestand";
    const ext = (naam.split(".").pop() || "").toLowerCase();
    const bezig = melding("Bezig met lezen van " + naam + "…", "info");
    try {
      let tekst;
      if (ext === "pdf") {
        tekst = await pdfNaarTekst(await file.arrayBuffer());
        if (tekst.trim().length < 40) {
          throw new Error("Uit deze pdf komt geen tekst — waarschijnlijk een scan of foto. Kies " +
            "'Tekst plakken' of voer de posten zelf in.");
        }
      } else if (["csv", "tsv"].includes(ext)) tekst = Parser.csvNaarTekst(await file.text());
      else if (["txt", "md", ""].includes(ext)) tekst = await file.text();
      else throw new Error("Bestanden van het type ." + ext + " kan ik niet lezen. Gebruik pdf, csv of tekst.");
      bezig.remove();
      if (leesTekst(tekst, naam)) toonControle();
    } catch (fout) { bezig.remove(); melding(fout.message, "fout"); }
  }

  async function pdfNaarTekst(buffer) {
    if (!window.pdfjsLib) throw new Error("De pdf-lezer kon niet laden. Kies 'Tekst plakken' — dat werkt altijd.");
    const doc = await window.pdfjsLib.getDocument({ data: buffer }).promise;
    const paginas = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const inhoud = await (await doc.getPage(i)).getTextContent();
      const regels = new Map();
      for (const item of inhoud.items) {
        if (!item.str) continue;
        const y = Math.round(item.transform[5]);
        if (!regels.has(y)) regels.set(y, []);
        regels.get(y).push({ x: item.transform[4], t: item.str });
      }
      paginas.push([...regels.entries()].sort((a, b) => b[0] - a[0])
        .map(([, d]) => d.sort((a, b) => a.x - b.x).map((x) => x.t).join(" ")).join("\n"));
    }
    return paginas.join("\n");
  }

  /* ─────────────────────────────────────────────────────────── foto's */

  function rendFotos() {
    const strook = $("#fotostrook");
    strook.textContent = "";
    bijlagen.forEach((f, i) => {
      strook.append(el("figure", { class: "fototegel" },
        el("img", { src: f.data, alt: "Foto " + (i + 1) + " van je afrekening" }),
        el("figcaption", {}, Fotos.leesbaar(f.bytes)),
        el("button", { class: "weg", type: "button", "aria-label": "Foto " + (i + 1) + " verwijderen",
          onclick: () => { bijlagen.splice(i, 1); rendFotos(); bewaar("invoer"); } }, "✕")));
    });
    const knop = $("#foto-toevoegen");
    knop.textContent = bijlagen.length
      ? "Nog een foto toevoegen (" + bijlagen.length + " van " + Fotos.MAX_FOTOS + ")"
      : "Foto maken of kiezen";
    knop.disabled = bijlagen.length >= Fotos.MAX_FOTOS;
  }

  async function voegFotosToe(files) {
    wisMeldingen();
    const ruimte = Fotos.MAX_FOTOS - bijlagen.length;
    if (ruimte <= 0) return melding("Je kunt maximaal " + Fotos.MAX_FOTOS + " foto's meesturen.", "letop");
    const gekozen = [...files].slice(0, ruimte);
    if (files.length > ruimte) {
      melding("Er passen er nog " + ruimte + " bij; de rest heb ik laten staan.", "letop");
    }
    const bezig = melding(gekozen.length === 1 ? "Bezig met de foto…" : "Bezig met " + gekozen.length + " foto's…", "info");
    let gelukt = 0;
    for (const file of gekozen) {
      try { bijlagen.push(await Fotos.verklein(file)); gelukt++; }
      catch (fout) { melding((file.name || "Deze foto") + ": " + fout.message, "fout"); }
    }
    bezig.remove();
    rendFotos();
    bewaar("invoer");
    if (gelukt) {
      melding(bijlagen.length + (bijlagen.length === 1 ? " foto gaat" : " foto's gaan") +
        " mee met je dossier. Onze beoordelaar kijkt er met de hand naar.", "ok");
    }
  }

  /* Ingelezen posten gaan eerst langs de huurder. Een verkeerd gelezen bedrag
     of een verkeerd geraden soort kosten verandert de hele uitkomst, en alleen
     de huurder ziet op de afrekening wat er echt staat. */
  function toonControle() {
    handRijen = dossier.kostenposten.map((post) => ({
      omschrijving: post.omschrijving, categorie: post.categorie,
      bedrag: post.bedrag_verhuurder, handmatigGekozen: true, bron: post,
    }));
    $("#plakblok").hidden = true;
    $("#handblok").hidden = false;
    $("#handkop").textContent = "Klopt dit?";
    $("#handuitleg").textContent = "Dit heb ik uit je afrekening gehaald. Loop het even na — een verkeerd " +
      "bedrag of een verkeerde soort kosten verandert de uitkomst. Pas aan wat niet klopt en ga dan verder.";
    rendHand();
    bewaar("invoer");
    $("#handblok").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toonHandmatig() {
    $("#plakblok").hidden = true;
    $("#handblok").hidden = false;
    $("#handkop").textContent = "Je posten";
    $("#handuitleg").textContent = "Neem de posten over zoals ze op je afrekening staan, met het bedrag " +
      "dat bij jou in rekening is gebracht.";
    if (!handRijen.length) handRijen = [{ omschrijving: "", categorie: null, bedrag: 0 }];
    rendHand();
  }

  /* handmatige invoer */
  let handRijen = [];
  function rendHand() {
    const bak = $("#handposten");
    bak.textContent = "";
    handRijen.forEach((rij, i) => {
      const groepen = {};
      for (const [code, def] of Object.entries(D.categorieen.categorieen)) {
        (groepen[def.groep] = groepen[def.groep] || []).push([code, def.label]);
      }
      bak.append(el("div", { class: "kaart", style: "margin-bottom:9px;padding:15px" },
        el("div", { class: "veldrij", style: "margin-top:0" },
          el("div", {}, el("label", {}, "Omschrijving"),
            el("input", { type: "text", value: rij.omschrijving, placeholder: "Zoals op de afrekening",
              onchange: (e) => { rij.omschrijving = e.target.value;
                const c = Parser.classificeer(e.target.value);
                if (c.categorie && !rij.handmatigGekozen) { rij.categorie = c.categorie; rendHand(); } } }))),
        el("div", { class: "veldrij postrij" },
          el("div", {}, el("label", {}, "Soort kosten"),
            el("select", { onchange: (e) => { rij.categorie = e.target.value || null; rij.handmatigGekozen = true; } },
              el("option", { value: "" }, "— kies —"),
              Object.entries(groepen).map(([g, items]) => el("optgroup", { label: g },
                items.map(([code, label]) => el("option", { value: code, selected: rij.categorie === code }, label)))))),
          el("div", {}, el("label", {}, "Bedrag (€)"),
            el("input", { type: "number", step: "0.01", inputmode: "decimal", value: rij.bedrag,
              onchange: (e) => { rij.bedrag = Number(e.target.value) || 0; } }))),
        handRijen.length > 1 ? el("div", { class: "knoppen" },
          el("button", { class: "link", type: "button", onclick: () => { handRijen.splice(i, 1); rendHand(); } },
            "Verwijder deze post")) : null));
    });
  }

  /* ──────────────────────────────────────────────────────── vragen */

  const VRAGEN = [
    {
      kop: "Over welk jaar gaat deze afrekening?",
      hulp: "Het boekjaar bepaalt welke normbedragen en termijnen gelden.",
      render: () => el("div", {}, el("label", { for: "q-jaar" }, "Boekjaar"),
        el("input", { type: "number", id: "q-jaar", inputmode: "numeric", value: dossier.periode.jaar || "" }),
        el("div", { class: "hulp" }, "Normbedragen beschikbaar voor " + D.jaren.join(", ") + ".")),
      lees: () => { dossier.periode.jaar = Number($("#q-jaar").value) || null; },
      geldig: () => dossier.periode.jaar ? null : "Vul het boekjaar in.",
    },
    {
      kop: "Wat voor woonruimte huur je?",
      hulp: "Dit bepaalt met welk normverbruik wordt gerekend als er iets aan de meterstanden mankeert.",
      render() {
        const w = dossier.woonruimte;
        const bak = el("div", {});
        const keuzes = el("div", { class: "keuzes" });
        const opties = D.woningtypen.map((t) => ({ w: t.waarde, l: t.label, zelf: true }));
        opties.push({ w: "kamer", l: "Een kamer (gedeelde keuken of douche)", zelf: false });
        for (const o of opties) {
          const actief = o.zelf ? (w.zelfstandig && w.woningtype === o.w) : !w.zelfstandig;
          keuzes.append(el("button", { class: "keuze", type: "button", "aria-pressed": String(actief),
            onclick: () => { w.zelfstandig = o.zelf; w.woningtype = o.zelf ? o.w : null; toonVraag(); } },
            el("span", { class: "kt" }, o.l)));
        }
        bak.append(keuzes);
        if (!w.zelfstandig) bak.append(el("div", { style: "margin-top:18px" },
          el("label", { for: "q-m2" }, "Hoe groot is je kamer ongeveer? (m²)"),
          el("input", { type: "number", id: "q-m2", inputmode: "decimal", value: w.oppervlakte_m2 || "" }),
          el("div", { class: "hulp" }, "Voor een kamer rekent de Huurcommissie met 25 m³ gas per m². Een ruwe schatting is prima.")));
        return bak;
      },
      lees() { if (!dossier.woonruimte.zelfstandig && $("#q-m2")) dossier.woonruimte.oppervlakte_m2 = Number($("#q-m2").value) || null; },
      geldig: () => (dossier.woonruimte.zelfstandig && !dossier.woonruimte.woningtype) ? "Kies wat voor woning je huurt." : null,
    },
    {
      kop: "Hoe zit het gebouw in elkaar?",
      hulp: "Gedeelde kosten worden over de woningen verdeeld, dus het aantal telt mee.",
      render() {
        const w = dossier.woonruimte;
        return el("div", {},
          el("label", { for: "q-bew" }, "Met hoeveel mensen woon je er?"),
          el("input", { type: "number", id: "q-bew", inputmode: "numeric", min: "1", value: w.aantal_bewoners || "" }),
          el("div", { class: "hulp" }, "Bepaalt het normverbruik voor water en elektriciteit."),
          el("div", { style: "margin-top:18px" },
            el("label", { for: "q-complex" }, "Hoeveel woningen zitten er in het complex?"),
            el("input", { type: "number", id: "q-complex", inputmode: "numeric", min: "1", value: w.aantal_woonruimten_complex || "" }),
            el("div", { class: "hulp" }, "Weet je het niet? Laat leeg — dan meld ik het als openstaande vraag in plaats van te gokken.")));
      },
      lees() {
        dossier.woonruimte.aantal_bewoners = Number($("#q-bew").value) || null;
        dossier.woonruimte.aantal_woonruimten_complex = Number($("#q-complex").value) || null;
      },
      geldig: () => dossier.woonruimte.aantal_bewoners ? null : "Vul in met hoeveel mensen je er woont.",
    },
    {
      kop: "Heeft je verhuurder facturen laten zien?",
      hulp: "Dit is het belangrijkste punt van de hele check. Wie zijn kosten niet onderbouwt, mag ze vaak niet rekenen.",
      render() {
        const nu = dossier._onderbouwing;
        const opties = [
          { w: "volledig", t: "Ja, facturen én een gespecificeerd overzicht", s: "Alles uitgesplitst per post." },
          { w: "deels", t: "Alleen een totaalbedrag per post", s: "Wel een overzicht, geen onderliggende facturen." },
          { w: "geen", t: "Nee, ik heb niets gezien", s: "Alleen de afrekening zelf." },
          { w: "onbekend", t: "Weet ik niet", s: "Dan zet ik het als openstaande vraag neer." },
        ];
        return el("div", { class: "keuzes" }, opties.map((o) =>
          el("button", { class: "keuze", type: "button", "aria-pressed": String(nu === o.w),
            onclick: () => { dossier._onderbouwing = o.w; toonVraag(); } },
            el("span", { class: "kt" }, o.t), el("span", { class: "ks" }, o.s))));
      },
      lees() {
        const k = dossier._onderbouwing;
        const bewijs = k === "volledig" ? ["facturen", "specificatieformulier"] : k === "deels" ? ["specificatieformulier"] : [];
        for (const post of dossier.kostenposten) if (!post._bewijsHandmatig) post.bewijs = bewijs.slice();
      },
      geldig: () => dossier._onderbouwing ? null : "Kies een van de vier antwoorden.",
    },
    {
      kop: "Wat heb je aan voorschot betaald?",
      hulp: "Optioneel. Hiermee zie je of je geld terugkrijgt of moet bijbetalen.",
      render: () => el("div", {}, el("label", { for: "q-vs" }, "Totaal betaald voorschot over dit jaar (€)"),
        el("input", { type: "number", id: "q-vs", inputmode: "decimal", step: "0.01", value: dossier.voorschot_in_rekening_gebracht || "" }),
        el("div", { class: "hulp" }, "Meestal je maandbedrag × 12. Weet je het niet? Laat leeg.")),
      lees: () => { dossier.voorschot_in_rekening_gebracht = Number($("#q-vs").value) || null; },
      geldig: () => null,
    },
  ];

  function startVragen() { vraagIndex = 0; bewaar("vragen"); naarScherm("vragen"); }

  function toonVraag() {
    const v = VRAGEN[vraagIndex];
    voortgang("#voortgang", 3, 4);
    $("#vraagteller").textContent = "Stap 3 van 4 · Vraag " + (vraagIndex + 1) + " van " + VRAGEN.length;
    $("#vraagkop").textContent = v.kop;
    $("#vraaghulp").textContent = v.hulp;
    $("#vraaginhoud").textContent = "";
    $("#vraaginhoud").append(v.render());
    $("#v-volgende").textContent = vraagIndex === VRAGEN.length - 1 ? "Bekijk de uitkomst" : "Volgende";
    $("#v-vorige").textContent = vraagIndex === 0 ? "Terug" : "Vorige";
  }

  function volgendeVraag() {
    wisMeldingen();
    const v = VRAGEN[vraagIndex];
    v.lees();
    const fout = v.geldig();
    if (fout) return melding(fout, "fout");
    if (vraagIndex < VRAGEN.length - 1) { vraagIndex++; toonVraag(); bewaar("vragen"); window.scrollTo({ top: 0 }); }
    else bereken();
  }

  /* ────────────────────────────────────────────────────── uitkomst */

  function bereken() {
    wisMeldingen();
    try { uitkomst = Kern.beoordeelDossier(dossier); }
    catch (fout) { return melding("Er ging iets mis bij het berekenen: " + fout.message, "fout"); }
    bewaar("vragen");
    rendUitkomst();
    toon("uitkomst");
  }

  function besteRegel(b) {
    let beste = null;
    for (const id of b.regels) {
      const u = UITLEG[id];
      if (u && (!beste || u.prioriteit > UITLEG[beste].prioriteit)) beste = id;
    }
    return beste;
  }

  function rendUitkomst() {
    $("#voorbeeldstrook").hidden = !isVoorbeeld;
    $("#indienkaart").hidden = isVoorbeeld;
    $("#indienbalk").hidden = isVoorbeeld;
    $("#s-uitkomst").classList.toggle("met-balk", !isVoorbeeld);
    voortgang("#vg-uitkomst", 4, 4);
    const f = uitkomst.financieel;
    const rood = uitkomst.tellingen.ROOD, oranje = uitkomst.tellingen.ORANJE;

    let oog, bedrag, zin;
    if (f.potentiele_correctie > 0) {
      oog = "Je hebt mogelijk recht op";
      bedrag = euro(f.potentiele_correctie);
      zin = "Op " + rood + " " + (rood === 1 ? "post" : "posten") + " rekent je verhuurder meer dan volgens " +
        "het beleidsboek mag.";
      if (oranje) zin += " Voor " + oranje + " " + (oranje === 1 ? "post" : "posten") + " ontbreekt nog " +
        "informatie; samen " + euro(f.onbeoordeeld_bedrag) + ". Blijken die ook onterecht, dan loopt het op " +
        "tot " + euro(f.bandbreedte_max) + ".";
    } else if (oranje) {
      oog = "Nog niet te zeggen";
      bedrag = euro(f.onbeoordeeld_bedrag);
      zin = "Ik vond geen harde fout, maar voor " + oranje + " " + (oranje === 1 ? "post" : "posten") +
        " ontbreekt informatie. Dien je dossier in, dan zoeken we dat voor je uit.";
    } else {
      oog = "Geen afwijking gevonden";
      bedrag = euro(0);
      zin = "Alle beoordeelde posten passen binnen wat de Huurcommissie toestaat.";
    }

    const kop = $("#uitslag-kop");
    kop.textContent = "";
    kop.append(el("p", { class: "oog" }, oog), el("div", { class: "bedrag" }, bedrag),
      el("p", { class: "zin" }, zin));

    const som = {}, aantal = {};
    for (const b of uitkomst.beoordelingen) {
      som[b.status] = (som[b.status] || 0) + b.bedrag_verhuurder;
      aantal[b.status] = (aantal[b.status] || 0) + 1;
    }
    const boek = $("#grootboek");
    boek.textContent = "";
    for (const s of RANG) {
      if (!aantal[s]) continue;
      boek.append(el("li", {}, el("button", { type: "button",
        onclick: () => { const d = document.getElementById("groep-" + s); if (d) d.scrollIntoView({ behavior: "smooth", block: "start" }); } },
        el("span", { class: "merkje merk-" + s, "aria-hidden": "true" }, MERK[s]),
        el("span", { class: "omschrijving" }, el("b", {}, STAT[s].kop),
          el("span", {}, aantal[s] + " " + (aantal[s] === 1 ? "post" : "posten"))),
        el("span", { class: "geld" }, euro(som[s])),
        el("span", { class: "pijl", "aria-hidden": "true" }, "›"))));
    }
    if (f.voorschot_betaald !== undefined) {
      const saldo = f.saldo_volgens_model;
      boek.append(el("li", {}, el("button", { type: "button", style: "cursor:default" },
        el("span", { class: "merkje merk-neutraal", "aria-hidden": "true" }, "€"),
        el("span", { class: "omschrijving" },
          el("b", {}, saldo >= 0 ? "Je krijgt mogelijk terug" : "Je moet mogelijk bijbetalen"),
          el("span", {}, "voorschot " + euro(f.voorschot_betaald))),
        el("span", { class: "geld" }, euro(Math.abs(saldo))))));
    }

    const ontv = $("#ontvankelijk");
    ontv.textContent = "";
    if (uitkomst.blokkerend.length) {
      ontv.append(el("div", { class: "melding fout" }, el("b", {}, "Let op. "),
        uitkomst.blokkerend.map((r) => r.replace(/^ROOD - /, "")).join(" ")));
    }
    $("#groepen").textContent = "";
    $("#groepen").append(rendGroepenUit(uitkomst.beoordelingen, { dossier, na: bereken }));

    $("#advies").textContent = f.potentiele_correctie > 0
      ? "Dit is een voorlopige uitkomst uit de rekenregels. Dien je dossier in, dan loopt een beoordelaar " +
        "het met de hand na, vraagt zo nodig stukken op bij je verhuurder, en stuurt je een rapport met de " +
        "bevindingen en de brief die je kunt versturen."
      : oranje
        ? "Er ontbreekt informatie die je verhuurder moet aanleveren. Dien je dossier in, dan vragen wij " +
          "die voor je op en nemen we contact met je op."
        : "Er is geen aanleiding voor bezwaar gevonden. Wil je dat iemand er toch met de hand naar kijkt, " +
          "dien het dossier dan in.";
  }

  function rendGroepenUit(beoordelingen, ctx) {
    const bak = el("div", {});
    for (const status of RANG) {
      const posten = beoordelingen.filter((b) => b.status === status)
        .sort((a, b) => (b.verschil || 0) - (a.verschil || 0));
      if (!posten.length) continue;
      bak.append(el("div", { class: "groepkop", id: "groep-" + status },
        el("h2", {}, STAT[status].kop),
        el("span", { class: "telling" }, posten.length + " " + (posten.length === 1 ? "post" : "posten"))));
      bak.append(el("p", { class: "klein", style: "margin:0 0 10px" }, STAT[status].uitleg));
      for (const b of posten) bak.append(postKaart(b, ctx));
    }
    return bak;
  }

  function postKaart(b, ctx) {
    const regelId = besteRegel(b);
    const uitleg = regelId ? UITLEG[regelId] : null;
    const kaart = el("div", { class: "post " + b.status });

    let geld, klasse = "post-geld";
    if (b.status === "ROOD" && b.verschil > 0) { geld = euro(b.verschil) + " te veel"; klasse += " min"; }
    else if (b.status === "ORANJE") geld = euro(b.bedrag_verhuurder);
    else geld = euro(b.bedrag_verhuurder);

    const body = el("div", { class: "post-body" },
      el("div", { class: "post-titel" }, el("h3", {}, b.omschrijving), el("span", { class: klasse }, geld)));
    if (uitleg) {
      body.append(el("div", { class: "post-kop2" }, uitleg.kop));
      body.append(el("div", { class: "post-tekst" }, uitleg.uitleg));
    }
    if (b.status !== "BUITEN_BEVOEGDHEID" && b.bedrag_model !== null) {
      body.append(el("div", { class: "rekenregel" },
        el("span", {}, "Gerekend ", el("b", {}, euro(b.bedrag_verhuurder))),
        el("span", {}, (b.voorlopig ? "Voorlopig toegestaan " : "Toegestaan "), el("b", {}, euro(b.bedrag_model)))));
    }
    if (b.status === "ORANJE" && b.ontbrekende_informatie.length) {
      body.append(el("div", { class: "post-tekst", style: "margin-top:11px" },
        el("b", {}, "Nog nodig: "), vereenvoudig(b.ontbrekende_informatie[0])));
    }
    const def = D.categorieen.categorieen[b.categorie];
    if (ctx && def && def.velden.length && (ctx.alle || b.status === "ORANJE")) {
      body.append(el("div", { class: "post-acties" },
        el("button", { class: "klein", type: "button", onclick: () => openBlad(b, ctx.dossier, ctx.na) },
          ctx.label || "Zelf beantwoorden")));
    }
    kaart.append(body);

    const inhoud = el("div", { class: "inhoud" });
    const dl = el("dl", { style: "margin:0" });
    if (b.berekening.length) { dl.append(el("dt", {}, "Zo is het gerekend")); for (const r of b.berekening) dl.append(el("dd", { class: "reken" }, r)); }
    if (b.toelichting.length) { dl.append(el("dt", {}, "Uit het beleidsboek")); for (const r of b.toelichting) dl.append(el("dd", {}, r)); }
    if (b.ontbrekende_informatie.length) { dl.append(el("dt", {}, "Wat ontbreekt")); for (const r of b.ontbrekende_informatie) dl.append(el("dd", {}, r)); }
    inhoud.append(dl);
    if (b.regels.length) inhoud.append(el("div", { class: "codes" }, b.regels.map((id) =>
      el("code", { title: REGELINFO[id] ? REGELINFO[id].onderwerp + " — " + REGELINFO[id].bron : id }, id))));
    kaart.append(el("details", { class: "diep" }, el("summary", {}, "Waarom? Toon de regel en de berekening"), inhoud));
    return kaart;
  }

  const vereenvoudig = (t) => t.replace(/\s*\((?:par\.|Beleidsboek|voetnoot|art\.)[^)]*\)\s*/gi, " ")
    .replace(/\s*\(p\.\s*\d+[^)]*\)\s*/gi, " ").replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1").trim();

  /* ─────────────────────────────────────────────────────────── blad */

  let veldTeller = 0;
  function veld(def, waarde, opslaan) {
    const id = "bv" + (++veldTeller);
    if (def.type === "ja_nee") {
      return el("div", { style: "margin-top:16px" },
        el("label", { for: id, style: "display:flex;gap:10px;align-items:flex-start;font-weight:500;color:var(--inkt)" },
          el("input", { type: "checkbox", id, checked: waarde === true, style: "width:22px;height:22px;margin-top:2px;flex:none",
            onchange: (e) => opslaan(e.target.checked) }), def.label),
        def.hulp ? el("div", { class: "hulp" }, def.hulp) : null);
    }
    let invoer;
    if (def.type === "ja_nee_onbekend") {
      invoer = el("select", { id, onchange: (e) => opslaan(e.target.value === "" ? null : e.target.value === "ja") },
        el("option", { value: "", selected: waarde == null }, "Weet ik niet"),
        el("option", { value: "ja", selected: waarde === true }, "Ja"),
        el("option", { value: "nee", selected: waarde === false }, "Nee"));
    } else if (def.type === "keuze") {
      invoer = el("select", { id, onchange: (e) => opslaan(e.target.value || null) },
        el("option", { value: "" }, "— kies —"),
        def.opties.map((o) => {
          const w = typeof o === "string" ? o : o.waarde, t = typeof o === "string" ? o : o.label;
          return el("option", { value: w, selected: String(waarde) === String(w) }, t);
        }));
    } else if (def.type === "meerkeuze") {
      const gekozen = new Set(Array.isArray(waarde) ? waarde : []);
      return el("div", { style: "margin-top:16px" }, el("label", {}, def.label),
        el("div", {}, def.opties.map((o) => el("label", { style: "display:flex;gap:10px;align-items:flex-start;font-weight:400;color:var(--inkt);margin-bottom:8px" },
          el("input", { type: "checkbox", checked: gekozen.has(o), style: "width:22px;height:22px;margin-top:2px;flex:none",
            onchange: (e) => { if (e.target.checked) gekozen.add(o); else gekozen.delete(o); opslaan([...gekozen]); } }), o))));
    } else {
      const getal = ["getal", "geheel", "bedrag"].includes(def.type);
      const type = def.type === "datum" ? "date" : getal ? "number" : "text";
      invoer = el("input", { type, id, inputmode: type === "number" ? "decimal" : null,
        step: def.type === "bedrag" ? "0.01" : def.type === "geheel" ? "1" : "any",
        value: waarde == null ? "" : waarde,
        // Een datum of vrije tekst blijft tekst; die door Number() halen gaf NaN.
        onchange: (e) => {
          const r = e.target.value;
          if (r === "") return opslaan(null);
          if (def.type === "geheel") { const n = parseInt(r, 10); return opslaan(isNaN(n) ? null : n); }
          if (getal) { const n = Number(r); return opslaan(isNaN(n) ? null : n); }
          opslaan(r);
        } });
    }
    return el("div", { style: "margin-top:16px" }, el("label", { for: id }, def.label), invoer,
      def.hulp ? el("div", { class: "hulp" }, def.hulp) : null);
  }

  /* Zowel de huurder (tijdens de controle) als de beoordelaar (in het dossier)
     vult hier gegevens aan; alleen het bronbestand en het vervolg verschillen. */
  function openBlad(b, brondossier, na) {
    const bron = brondossier || dossier;
    const post = (bron.kostenposten || []).find((p) => p.id === b.kostenpost_id);
    if (!post) return melding("Deze post staat niet meer in het dossier.", "fout");
    const def = D.categorieen.categorieen[post.categorie];
    if (!def) return melding("Voor deze soort kosten zijn geen aanvullende velden bekend.", "letop");
    const blad = el("div", { class: "blad" },
      el("p", { class: "oog" }, "Aanvullen"),
      el("h2", {}, post.omschrijving),
      el("p", { class: "klein" }, "Beantwoord wat je weet. Wat je openlaat blijft een openstaande vraag — ik vul niets in wat ik niet weet."));
    for (const d of def.velden) {
      blad.append(veld(d, post.parameters[d.naam] !== undefined ? post.parameters[d.naam] : d.standaard,
        (v) => { post.parameters[d.naam] = v; }));
    }
    blad.append(el("div", { style: "margin-top:18px" },
      el("label", {}, "Wat heeft je verhuurder voor deze post laten zien?"),
      el("div", {}, D.categorieen.bewijsopties.slice(0, 4).map((o) =>
        el("label", { style: "display:flex;gap:10px;align-items:center;font-weight:400;color:var(--inkt);margin-bottom:8px" },
          el("input", { type: "checkbox", checked: post.bewijs.includes(o.waarde), style: "width:22px;height:22px;flex:none",
            onchange: (e) => {
              const set = new Set(post.bewijs);
              if (e.target.checked) set.add(o.waarde); else set.delete(o.waarde);
              post.bewijs = [...set]; post._bewijsHandmatig = true;
            } }), o.label)))));
    const achter = el("div", { class: "blad-achter", onclick: (e) => { if (e.target === achter) achter.remove(); } }, blad);
    blad.append(el("div", { class: "knoppen" },
      el("button", { class: "primair vol", type: "button", onclick: () => { achter.remove(); (na || bereken)(); } }, "Opslaan en opnieuw berekenen"),
      el("button", { class: "link", type: "button", onclick: () => achter.remove() }, "Annuleren")));
    document.body.append(achter);
  }

  /* ───────────────────────────────────────────────────────── indienen */

  /* De ingevulde posten gaan mee het dossier in. Zonder die invoer kan de
     beoordelaar de aangevulde gegevens niet opnieuw laten doorrekenen en blijft
     de beheerkant een leesscherm. */
  function samenvattingVoorOpslag() {
    return Object.assign(uitkomstVelden(uitkomst, dossier), {
      huurder: dossier.huurder,
      bron: dossier.bron,
      invoer: dossier,
      stappen: {},
      stukken: [],
      afhandeling: null,
    });
  }

  async function dienIn() {
    wisMeldingen();
    if (!dossier.huurder.naam || !dossier.huurder.email) {
      naarScherm("gegevens");
      return melding("Vul eerst je naam en e-mailadres in — anders kunnen we geen contact met je opnemen.", "fout");
    }
    const knop = $("#doe-indienen");
    knop.disabled = true;
    knop.textContent = "Bezig met indienen…";
    try {
      const doc = await Opslag.dienIn(Object.assign(samenvattingVoorOpslag(), { bijlagen }));
      ingediend = true;
      Opslag.wisConcept();
      rendBedankt(doc);
      toon("bedankt");
    } catch (fout) {
      melding("Indienen lukte niet: " + (fout.message || fout.code || "onbekende fout"), "fout");
    } finally {
      knop.disabled = false;
      knop.textContent = "Dien mijn dossier in";
    }
  }

  function rendBedankt(doc) {
    const bak = $("#bedankt-inhoud");
    bak.textContent = "";
    bak.append(
      el("div", { class: "opener" },
        el("p", { class: "oog" }, "Ingediend"),
        el("h1", {}, "Bedankt, we gaan ermee aan de slag"),
        el("p", { class: "lead" },
          "Je dossier is ontvangen. We bekijken je afrekening met de hand, stellen een rapport op met onze " +
          "bevindingen, en nemen daarover contact met je op via " + (doc.huurder.email || "je e-mailadres") + ".")),
      el("div", { class: "kaart", style: "margin-top:22px" },
        el("p", { class: "oog" }, "Je dossiernummer"),
        el("div", { style: "font-family:var(--display);font-size:2rem;font-weight:600;letter-spacing:-.03em" }, doc.id),
        el("p", { class: "klein", style: "margin-top:8px" }, "Bewaar dit nummer. Je vindt je dossier ook terug op je dashboard." +
          (bijlagen.length ? " Je " + (bijlagen.length === 1 ? "foto is" : bijlagen.length + " foto's zijn") + " meegestuurd." : "")),
        el("div", { class: "kpi", style: "margin-top:16px" },
          el("div", {}, el("div", { class: "k" }, "Boekjaar"), el("div", { class: "v" }, String(doc.jaar))),
          el("div", {}, el("div", { class: "k" }, "Mogelijk terug"), el("div", { class: "v" }, euro(doc.correctie))),
          el("div", {}, el("div", { class: "k" }, "Nog uit te zoeken"), el("div", { class: "v" }, euro(doc.onbeoordeeld))))),
      el("div", { class: "kaart" },
        el("p", { class: "oog" }, "Wat gebeurt er nu?"),
        el("ul", { class: "tijdlijn" },
          el("li", {}, el("span", { class: "wie" }, "Je dossier is binnen"),
            el("div", { class: "wanneer" }, datumTijd(doc.ingediend_op))),
          el("li", {}, el("span", { class: "wie" }, "Wij controleren je afrekening"),
            el("div", {}, "Een beoordelaar loopt de bevindingen na en vraagt zo nodig stukken op bij je verhuurder.")),
          el("li", {}, el("span", { class: "wie" }, "Je ontvangt een rapport"),
            el("div", {}, "Met de bevindingen per post en wat je kunt doen.")))),
      el("div", { class: "knoppen" },
        el("button", { class: "primair vol", type: "button", onclick: () => naarScherm("dash") },
          "Naar mijn dossiers"),
        el("button", { class: "vol", type: "button", onclick: startControle },
          "Nog een afrekening controleren")));
  }

  /* ───────────────────────────────────────────────────────── beheer */

  function past(a, t) {
    if (!t) return true;
    const h = a.huurder || {};
    const hooi = [a.id, a.jaar, h.naam, h.adres, h.email, h.verhuurder].join(" ").toLowerCase();
    return t.split(/\s+/).every((woord) => hooi.includes(woord));
  }

  function rendBeheer() {
    const alle = Opslag.lijst();
    const alles = alle.filter((a) => past(a, zoekterm));
    $("#beheer-modus").textContent = Opslag.modus === "gedeeld"
      ? "Aanvragen komen live binnen van huurders die de check invullen."
      : "Let op: gedeelde opslag is hier niet beschikbaar, dus je ziet alleen aanvragen die op dít apparaat zijn ingediend.";

    const open = alle.filter((a) => a.status === "nieuw").length;
    const inBeh = alle.filter((a) => a.status === "behandeling").length;
    const claim = alle.reduce((s, a) => s + Number(a.correctie || 0), 0);
    const kpi = $("#kpi");
    kpi.textContent = "";
    kpi.append(
      el("div", {}, el("div", { class: "k" }, "Nieuw"), el("div", { class: "v" }, String(open)),
        el("div", { class: "t" }, "wacht op beoordeling")),
      el("div", {}, el("div", { class: "k" }, "In behandeling"), el("div", { class: "v" }, String(inBeh))),
      el("div", {}, el("div", { class: "k" }, "Totale claim"), el("div", { class: "v" }, euro(claim)),
        el("div", { class: "t" }, "over " + alle.length + " " + (alle.length === 1 ? "dossier" : "dossiers"))),
      el("div", {}, el("div", { class: "k" }, "Gemiddeld"), el("div", { class: "v" }, euro(alle.length ? claim / alle.length : 0)),
        el("div", { class: "t" }, "per dossier")));

    const filters = $("#filters");
    filters.textContent = "";
    const opties = [["alle", "Alle"], ["nieuw", "Nieuw"], ["behandeling", "In behandeling"],
                    ["afgehandeld", "Afgehandeld"], ["afgewezen", "Geen actie"]];
    for (const [w, l] of opties) {
      const n = w === "alle" ? alles.length : alles.filter((a) => a.status === w).length;
      filters.append(el("button", { type: "button", "aria-pressed": String(filter === w),
        onclick: () => { filter = w; rendBeheer(); } }, l + " (" + n + ")"));
    }

    const lijst = $("#dossierlijst");
    lijst.textContent = "";
    const zichtbaar = filter === "alle" ? alles : alles.filter((a) => a.status === filter);
    if (!zichtbaar.length) {
      const zoekt = Boolean(zoekterm);
      lijst.append(el("div", { class: "leeg" },
        el("h3", {}, zoekt ? "Geen dossier gevonden" : alles.length ? "Niets in deze categorie" : "Nog geen aanvragen"),
        el("p", { class: "klein" }, zoekt
          ? "Geen enkel dossier past op wat je zocht. Pas de zoekterm aan, of maak hem leeg om alles te zien."
          : alles.length
            ? "Kies een ander filter om de rest te zien."
            : "Zodra een huurder de check invult en indient, verschijnt het dossier hier."),
        zoekt ? el("div", { class: "knoppen", style: "margin-top:12px" },
          el("button", { type: "button", onclick: () => { zoekterm = ""; $("#zoek").value = ""; rendBeheer(); } },
            "Wis de zoekregel")) : null));
      return;
    }
    lijst.append(el("ul", { class: "dossiers" }, zichtbaar.map((a) => el("li", {},
      el("button", { type: "button", onclick: () => openDossier(a) },
        el("span", { class: "chip " + (STATUSSEN[a.status] || STATUSSEN.nieuw).klasse },
          el("span", { class: "stip", "aria-hidden": "true" }), (STATUSSEN[a.status] || STATUSSEN.nieuw).label),
        el("span", { class: "naam" }, (a.huurder && a.huurder.naam) || "Onbekende huurder"),
        el("span", { class: "som" }, euro(a.correctie)),
        el("span", { class: "meta" }, a.id + " · boekjaar " + a.jaar + " · " + datum(a.ingediend_op)))))));
  }

  /* ═════════════════════════════════════════════ beheer · één dossier

     De beheerkant is een werkblad, geen leesscherm. Een dossier doorloopt zes
     stappen; elke stap is hier uit te voeren en wordt met een tijdstempel
     vastgelegd, zodat niemand hoeft te raden hoe ver het staat. */

  const STAPPEN = [
    { s: "ontvankelijkheid", label: "Ontvankelijkheid getoetst", doel: "Mag dit verzoek behandeld worden?" },
    { s: "posten", label: "Posten nagelopen", doel: "Kloppen de posten, de bedragen en het boekjaar?" },
    { s: "stukken", label: "Stukken opgevraagd", doel: "Wat moet er bij de verhuurder vandaan komen?" },
    { s: "herbeoordeeld", label: "Opnieuw beoordeeld", doel: "Met de aangevulde gegevens opnieuw gerekend." },
    { s: "rapport", label: "Rapport verstuurd", doel: "De bevindingen op papier, naar de huurder." },
    { s: "afgerond", label: "Afgerond", doel: "Uitkomst vastgelegd en het dossier gesloten." },
  ];

  const AFLOOP = [
    { w: "verhuurder_gecorrigeerd", l: "Verhuurder heeft gecorrigeerd", st: "afgehandeld" },
    { w: "huurcommissie", l: "Voorgelegd aan de Huurcommissie", st: "behandeling" },
    { w: "geen_grond", l: "Geen grond voor bezwaar", st: "afgewezen" },
    { w: "huurder_ziet_af", l: "Huurder ziet ervan af", st: "afgewezen" },
    { w: "anders", l: "Anders", st: "afgehandeld" },
  ];

  let werkDossier = null;   // de invoer van de huurder, hier bewerkbaar
  let werkUitkomst = null;  // de laatste doorrekening daarvan

  const bewerkbaar = (a) => Boolean(a.invoer && (a.invoer.kostenposten || []).length);

  async function schrijf(a, velden, bericht) {
    try {
      await Opslag.werkBij(a.id, velden);
      Object.assign(a, velden);
      if (bericht) melding(bericht, "ok");
      herteken();
      return true;
    } catch (f) {
      melding("Opslaan lukte niet: " + (f.message || f.code || "onbekende fout"), "fout");
      return false;
    }
  }

  const metNotitie = (a, titel, tekst) =>
    ({ notities: (a.notities || []).concat([{ op: new Date().toISOString(), titel, tekst }]) });

  const stapKlaar = (a, sleutel) => Boolean((a.stappen || {})[sleutel]);

  function zetStap(a, sleutel, aan, bericht) {
    const stappen = Object.assign({}, a.stappen);
    if (aan) stappen[sleutel] = new Date().toISOString();
    else delete stappen[sleutel];
    const velden = { stappen };
    // Zodra er aan gewerkt wordt, is het dossier niet meer "nieuw".
    if (aan && a.status === "nieuw") velden.status = "behandeling";
    return schrijf(a, velden, bericht);
  }

  /* De velden die de uitkomst van de kern in het opgeslagen dossier zetten.
     Eén plek, zodat indienen en herbeoordelen hetzelfde opleveren. */
  function uitkomstVelden(u, d) {
    return {
      jaar: u.jaar,
      totaal_verhuurder: u.financieel.totaal_verhuurder,
      totaal_model: u.financieel.totaal_model,
      correctie: u.financieel.potentiele_correctie,
      onbeoordeeld: u.financieel.onbeoordeeld_bedrag,
      bandbreedte_max: u.financieel.bandbreedte_max,
      voorschot: u.financieel.voorschot_betaald ?? null,
      saldo: u.financieel.saldo_volgens_model ?? null,
      tellingen: u.tellingen,
      blokkerend: u.blokkerend,
      ontvankelijkheid: u.ontvankelijkheid,
      sterkte: u.sterkte,
      woonruimte: d.woonruimte,
      periode: d.periode,
      bevindingen: u.beoordelingen.map((b) => ({
        kostenpost_id: b.kostenpost_id, categorie: b.categorie, omschrijving: b.omschrijving,
        status: b.status, voorlopig: b.voorlopig, bedrag_verhuurder: b.bedrag_verhuurder,
        bedrag_model: b.bedrag_model, verschil: b.verschil, regels: b.regels,
        berekening: b.berekening, toelichting: b.toelichting,
        ontbrekende_informatie: b.ontbrekende_informatie,
      })),
    };
  }

  async function herbeoordeel(a, stilzwijgend) {
    if (!bewerkbaar(a)) {
      return melding("Dit dossier is met een oudere versie ingediend; de onderliggende posten zijn " +
        "niet meegestuurd. Herbeoordelen kan alleen bij dossiers die daarna zijn binnengekomen.", "letop");
    }
    let u;
    try { u = Kern.beoordeelDossier(werkDossier); }
    catch (f) { return melding("Herberekenen lukte niet: " + f.message, "fout"); }
    werkUitkomst = u;
    const nu = new Date().toISOString();
    const velden = Object.assign(uitkomstVelden(u, werkDossier), {
      invoer: werkDossier,
      herzien_op: nu,
      stappen: Object.assign({}, a.stappen, { herbeoordeeld: nu }),
    });
    if (a.status === "nieuw") velden.status = "behandeling";
    const oud = Number(a.correctie || 0), nieuw = Number(u.financieel.potentiele_correctie);
    if (!stilzwijgend && Math.abs(nieuw - oud) >= 0.005) {
      Object.assign(velden, metNotitie(a, "Beoordeling bijgewerkt",
        "Na aanvulling van de gegevens komt de berekende correctie uit op " + euro(nieuw) +
        " (was " + euro(oud) + ")."));
    }
    await schrijf(a, velden, stilzwijgend ? null : "Opnieuw beoordeeld volgens het beleidsboek.");
  }

  /* ─────────────────────────────────────────────── op te vragen stukken */

  /* De lijst volgt uit de posten die nog niet te beoordelen zijn. Bestaande
     regels houden hun stand, nieuwe komen erbij, vervallen regels verdwijnen. */
  function stukkenVoor(a) {
    const vers = [];
    for (const b of a.bevindingen || []) {
      if (b.status !== "ORANJE") continue;
      (b.ontbrekende_informatie || []).forEach((tekst, i) => {
        vers.push({
          id: b.kostenpost_id + "#" + i, post: b.omschrijving, categorie: b.categorie,
          vraag: vereenvoudig(tekst), belang: b.bedrag_verhuurder, status: "open", op: null,
        });
      });
    }
    const oud = new Map((a.stukken || []).map((s) => [s.id, s]));
    vers.sort((x, y) => y.belang - x.belang);
    return vers.map((s) => {
      const b = oud.get(s.id);
      return b ? Object.assign({}, s, { status: b.status, op: b.op }) : s;
    });
  }

  const STUKSTAND = [["open", "Nog niet gevraagd"], ["opgevraagd", "Opgevraagd"], ["ontvangen", "Ontvangen"]];

  /* ───────────────────────────────────────────────────── het werkblad */

  function openDossier(a) {
    geopendDossier = a.id;
    werkDossier = a.invoer ? JSON.parse(JSON.stringify(a.invoer)) : null;
    werkUitkomst = null;
    const bak = $("#dossier-inhoud");
    bak.textContent = "";
    const h = a.huurder || {};

    bak.append(
      el("p", { class: "oog" }, "Dossier " + a.id),
      el("h1", {}, h.naam || "Onbekende huurder"),
      el("div", { class: "kopregel" },
        chip(a.status),
        el("span", { class: "klein" }, "Boekjaar " + a.jaar + " · ingediend " + datumTijd(a.ingediend_op)),
        a.herzien_op ? el("span", { class: "klein" }, "· herzien " + datumTijd(a.herzien_op)) : null));

    bak.append(blokVoortgang(a));
    bak.append(blokBedragen(a));
    bak.append(blokContact(a, h));
    bak.append(blokOntvankelijkheid(a));
    bak.append(blokPosten(a));
    bak.append(blokStukken(a));
    bak.append(blokFotos(a));
    bak.append(blokRapport(a));
    bak.append(blokAfronden(a));
    bak.append(blokVerloop(a));

    bak.append(el("div", { class: "groepkop" }, el("h2", {}, "Alle bevindingen"),
      el("span", { class: "telling" }, (a.bevindingen || []).length + " posten")));
    bak.append(rendGroepenUit(a.bevindingen || [], werkBladContext(a)));

    bak.append(el("div", { class: "knoppen", style: "margin-top:26px" },
      el("button", { class: "link", type: "button", onclick: async () => {
        if (!confirm("Dit dossier definitief verwijderen? Dat kan niet ongedaan worden gemaakt.")) return;
        try { await Opslag.verwijder(a.id); geopendDossier = null; naarScherm("beheer"); melding("Dossier verwijderd.", "ok"); }
        catch (f) { melding("Verwijderen lukte niet: " + (f.message || f.code), "fout"); }
      } }, "Dossier verwijderen")));

    toon("dossier");
  }

  const werkBladContext = (a) => (bewerkbaar(a)
    ? { dossier: werkDossier, na: () => herbeoordeel(a), label: "Gegevens aanvullen", alle: true }
    : null);

  /* ─────────────────────────────────────────────────────── de blokken */

  function blokVoortgang(a) {
    const gedaan = STAPPEN.filter((st) => stapKlaar(a, st.s)).length;
    return el("div", { class: "kaart", style: "margin-top:14px" },
      el("p", { class: "oog" }, "Behandeling"),
      el("h2", {}, gedaan === STAPPEN.length ? "Alle stappen gedaan" : "Stap " + (gedaan + 1) + " van " + STAPPEN.length),
      el("p", { class: "klein" }, "Vink af wat je hebt gedaan. De stappen hieronder staan in dezelfde volgorde."),
      el("ul", { class: "stappen" }, STAPPEN.map((st) => {
        const klaar = stapKlaar(a, st.s);
        return el("li", { class: klaar ? "klaar" : "" },
          el("button", { class: "vink", type: "button", "aria-pressed": String(klaar),
            "aria-label": st.label + (klaar ? " ongedaan maken" : " afvinken"),
            onclick: () => zetStap(a, st.s, !klaar) }, "✓"),
          el("span", { class: "wat" }, el("b", {}, st.label), el("span", {}, st.doel)),
          klaar ? el("span", { class: "wanneer" }, datum(a.stappen[st.s])) : null);
      })));
  }

  function blokBedragen(a) {
    const kpi = el("div", { class: "kpi", style: "margin-top:12px" },
      el("div", {}, el("div", { class: "k" }, "Afgerekend"), el("div", { class: "v" }, euro(a.totaal_verhuurder))),
      el("div", {}, el("div", { class: "k" }, "Toegestaan"), el("div", { class: "v" }, euro(a.totaal_model))),
      el("div", {}, el("div", { class: "k" }, "Verschil"), el("div", { class: "v" }, euro(a.correctie))),
      el("div", {}, el("div", { class: "k" }, "Onbeoordeeld"), el("div", { class: "v" }, euro(a.onbeoordeeld)),
        el("div", { class: "t" }, "tot " + euro(a.bandbreedte_max))));
    if (!bewerkbaar(a)) {
      return el("div", {}, kpi, el("div", { class: "melding letop", style: "margin-top:10px" },
        el("b", {}, "Alleen lezen. "),
        "Dit dossier is met een oudere versie ingediend, zonder de onderliggende posten. " +
        "Aanvullen en herbeoordelen kan hier niet; het rapport en de afhandeling wel."));
    }
    return kpi;
  }

  function blokContact(a, h) {
    const w = a.woonruimte || {};
    const p = a.periode || {};
    const regel = (k, v) => el("div", {}, el("div", { class: "mini" }, k), el("div", {}, v || "—"));
    return el("div", { class: "kaart", style: "margin-top:12px" },
      el("p", { class: "oog" }, "Huurder en woning"),
      el("div", { class: "veldrij twee", style: "margin-top:4px" },
        regel("E-mail", h.email), regel("Telefoon", h.telefoon)),
      el("div", { class: "veldrij twee" },
        regel("Adres", h.adres), regel("Verhuurder", h.verhuurder)),
      el("div", { class: "veldrij twee" },
        regel("Woonruimte", w.zelfstandig === false ? "Onzelfstandig (kamer)"
          : (w.woningtype || "").replace(/_/g, " ") || "Zelfstandig"),
        regel("Bewoners", w.aantal_bewoners ? String(w.aantal_bewoners) : null)),
      el("div", { class: "veldrij twee" },
        regel("Woningen in complex", w.aantal_woonruimten_complex ? String(w.aantal_woonruimten_complex) : null),
        regel("Periode", p.jaar ? (p.maand_van || 1) + " t/m " + (p.maand_tot_en_met || 12) + " " + p.jaar : String(a.jaar))),
      el("div", { class: "veldrij" }, regel("Aangeleverd als", a.bron)));
  }

  function blokOntvankelijkheid(a) {
    const kaart = el("div", { class: "kaart", style: "margin-top:12px" },
      el("p", { class: "oog" }, "Stap 1"),
      el("h2", {}, "Ontvankelijkheid"),
      el("p", { class: "klein" }, "De huurdersstroom vraagt hier niet naar. Vul aan wat je weet; " +
        "wat je openlaat blijft een openstaand punt in plaats van een aanname."));

    const lijst = a.ontvankelijkheid || (a.blokkerend || []);
    if (lijst.length) {
      kaart.append(el("ul", { class: "toets" }, lijst.map((r) => {
        const merk = r.startsWith("ROOD") ? "ROOD" : r.startsWith("OK") ? "GROEN"
          : r.startsWith("LET OP") ? "ORANJE" : "ORANJE";
        return el("li", {},
          el("span", { class: "merkje merk-" + merk, "aria-hidden": "true" }, MERK[merk]),
          el("span", {}, r.replace(/^(ROOD|ORANJE|OK|LET OP) - /, "")));
      })));
    }

    if (!bewerkbaar(a)) return kaart;

    const proc = werkDossier.procedure = werkDossier.procedure || {};
    const velden = [
      { naam: "contract_gesloten_op", label: "Huurovereenkomst gesloten op", type: "datum",
        hulp: "Bepaalt of de Huurcommissie uitspraak kan doen of alleen kan adviseren (par. 6.2.1, p. 51-52)." },
      { naam: "sector", label: "Sector", type: "keuze",
        opties: [{ waarde: "sociaal", label: "Sociale huur" }, { waarde: "vrij", label: "Vrije sector" }] },
      { naam: "afrekening_ontvangen", label: "Afrekening ontvangen van de verhuurder", type: "ja_nee_onbekend" },
      { naam: "bezwaar_gemaakt", label: "Schriftelijk bezwaar gemaakt bij de verhuurder", type: "ja_nee_onbekend",
        hulp: "Zonder die kennisgeving verklaart de Huurcommissie het verzoek niet-ontvankelijk (par. 6.3.1, p. 56)." },
      { naam: "afrekening_opgevraagd", label: "Afrekening schriftelijk opgevraagd", type: "ja_nee_onbekend",
        hulp: "Alleen van belang als er geen afrekening is ontvangen (par. 6.3.2, p. 57)." },
      { naam: "verzoekdatum", label: "Datum verzoek aan de Huurcommissie", type: "datum",
        hulp: "Laat leeg zolang er geen verzoek is; dan wordt met vandaag getoetst." },
    ];
    const vak = el("div", {});
    for (const d of velden) {
      vak.append(veld(d, proc[d.naam] === undefined ? null : proc[d.naam],
        (v) => { proc[d.naam] = v; }));
    }
    kaart.append(vak, el("div", { class: "knoppen rij" },
      el("button", { class: "primair", type: "button", onclick: () => herbeoordeel(a) },
        "Opslaan en opnieuw toetsen"),
      el("button", { type: "button", onclick: () => zetStap(a, "ontvankelijkheid", true, "Stap afgevinkt.") },
        "Stap afvinken")));
    return kaart;
  }

  function blokPosten(a) {
    const oranje = (a.bevindingen || []).filter((b) => b.status === "ORANJE");
    const kaart = el("div", { class: "kaart", style: "margin-top:12px" },
      el("p", { class: "oog" }, "Stap 2"),
      el("h2", {}, oranje.length
        ? oranje.length + (oranje.length === 1 ? " post kan nog niet beoordeeld worden" : " posten kunnen nog niet beoordeeld worden")
        : "Alle posten zijn beoordeeld"));

    if (!oranje.length) {
      kaart.append(el("p", { class: "klein" }, "Er ontbreekt niets meer om te kunnen rekenen. " +
        "Onderaan staan alle bevindingen; daar kun je gegevens alsnog aanpassen."));
      return kaart;
    }
    kaart.append(el("p", { class: "klein" },
      "Vul in wat de verhuurder heeft aangeleverd. Elke aanvulling laat de kern opnieuw rekenen — " +
      "er wordt niets ingevuld wat niet is opgegeven."));
    const ctx = werkBladContext(a);
    kaart.append(el("ul", { class: "openlijst" }, oranje.map((b) => el("li", {},
      el("span", { class: "wat" },
        el("b", {}, b.omschrijving),
        el("span", {}, vereenvoudig((b.ontbrekende_informatie || [])[0] || "Aanvullende gegevens nodig."))),
      el("span", { class: "som" }, euro(b.bedrag_verhuurder)),
      ctx ? el("button", { class: "klein", type: "button", onclick: () => openBlad(b, ctx.dossier, ctx.na) },
        "Aanvullen") : null))));
    kaart.append(el("div", { class: "knoppen rij" },
      el("button", { type: "button", onclick: () => herbeoordeel(a) }, "Opnieuw beoordelen"),
      el("button", { type: "button", onclick: () => zetStap(a, "posten", true, "Stap afgevinkt.") }, "Stap afvinken")));
    return kaart;
  }

  function blokStukken(a) {
    const stukken = stukkenVoor(a);
    const kaart = el("div", { class: "kaart", style: "margin-top:12px" },
      el("p", { class: "oog" }, "Stap 3"),
      el("h2", {}, "Op te vragen stukken"));

    if (!stukken.length) {
      kaart.append(el("p", { class: "klein" }, "Er staat niets meer open. Zodra een post gegevens mist, " +
        "verschijnt die hier vanzelf."));
      return kaart;
    }
    const open = stukken.filter((s) => s.status !== "ontvangen");
    kaart.append(el("p", { class: "klein" },
      open.length + " van de " + stukken.length + " nog niet ontvangen. De huurder heeft op grond van " +
      "artikel 7:259 lid 4 BW recht op inzage in de onderliggende stukken."));

    async function zet(id, stand) {
      const bij = stukken.map((s) => s.id === id
        ? Object.assign({}, s, { status: stand, op: stand === "open" ? null : new Date().toISOString() })
        : s);
      const velden = { stukken: bij };
      if (a.status === "nieuw") velden.status = "behandeling";
      await schrijf(a, velden);
    }

    kaart.append(el("ul", { class: "stukken" }, stukken.map((s) => el("li", { class: "stuk" },
      el("div", { class: "post" }, s.post, el("span", { class: "mini" }, " · " + euro(s.belang))),
      el("div", { class: "vraag" }, s.vraag),
      el("div", { class: "keuze3" }, STUKSTAND.map(([w, l]) =>
        el("button", { type: "button", "aria-pressed": String(s.status === w), onclick: () => zet(s.id, w) }, l))),
      s.op ? el("div", { class: "mini", style: "margin-top:6px" },
        (s.status === "ontvangen" ? "Ontvangen " : "Opgevraagd ") + datum(s.op)) : null))));

    kaart.append(el("div", { class: "knoppen rij" },
      el("button", { class: "primair", type: "button", onclick: () => toonBriefBlad(
        "Opvraagbrief aan de verhuurder", inzagebrief(a, stukken), a) }, "Opvraagbrief opstellen"),
      el("button", { type: "button", onclick: async () => {
        const bij = stukken.map((s) => s.status === "open"
          ? Object.assign({}, s, { status: "opgevraagd", op: new Date().toISOString() }) : s);
        await schrijf(a, { stukken: bij }, "Alles als opgevraagd gemarkeerd.");
      } }, "Alles als opgevraagd markeren"),
      el("button", { type: "button", onclick: () => zetStap(a, "stukken", true, "Stap afgevinkt.") }, "Stap afvinken")));
    return kaart;
  }

  function blokFotos(a) {
    const kaart = el("div", { class: "kaart", hidden: true, style: "margin-top:12px" });
    Opslag.laadBijlagen(a.id).then((bij) => {
      if (!bij.length || geopendDossier !== a.id) return;
      kaart.hidden = false;
      kaart.append(
        el("p", { class: "oog" }, "Meegestuurd"),
        el("h2", {}, bij.length + (bij.length === 1 ? " foto" : " foto's") + " van de huurder"),
        el("p", { class: "klein" }, "Tik een foto aan om hem op volle grootte te bekijken."),
        el("div", { class: "bijlagen-groot" }, bij.map((f, i) =>
          el("a", { href: f.data, target: "_blank", rel: "noopener" },
            el("img", { src: f.data, alt: "Foto " + (i + 1) + " bij dossier " + a.id })))));
    });
    return kaart;
  }

  function blokRapport(a) {
    return el("div", { class: "kaart", style: "margin-top:12px" },
      el("p", { class: "oog" }, "Stap 5"),
      el("h2", {}, "Rapport en brieven"),
      el("p", { class: "klein" }, "Het rapport bevat alle bevindingen met de berekening en de regel " +
        "waarop die berust. De brieven zijn concepten voor de huurder om zelf te versturen."),
      el("div", { class: "knoppen rij" },
        el("button", { class: "primair", type: "button", onclick: () => toonRapport(a) }, "Rapport opstellen"),
        el("button", { type: "button", onclick: () => toonBriefBlad(
          "Bezwaarbrief aan de verhuurder", bezwaarbriefUit(a), a) }, "Bezwaarbrief"),
        el("button", { type: "button", onclick: () => toonBriefBlad(
          "Brief: afrekening opvragen", opvraagbriefUit(a), a) }, "Afrekening opvragen")),
      el("div", { class: "knoppen rij" },
        el("button", { type: "button", onclick: () => {
          const notitie = metNotitie(a, "Rapport verstuurd",
            "Het rapport met de bevindingen is naar de huurder gestuurd.");
          schrijf(a, Object.assign(notitie, {
            stappen: Object.assign({}, a.stappen, { rapport: new Date().toISOString() }),
            status: a.status === "nieuw" ? "behandeling" : a.status,
          }), "Vastgelegd dat het rapport is verstuurd.");
        } }, "Markeer rapport als verstuurd")));
  }

  function blokAfronden(a) {
    const af = a.afhandeling || {};
    const kaart = el("div", { class: "kaart", style: "margin-top:12px" },
      el("p", { class: "oog" }, "Stap 6"),
      el("h2", {}, af.uitkomst ? "Afgerond" : "Dossier afronden"));

    if (af.uitkomst) {
      const gekozen = AFLOOP.find((x) => x.w === af.uitkomst);
      kaart.append(
        el("div", { class: "veldrij twee", style: "margin-top:4px" },
          el("div", {}, el("div", { class: "mini" }, "Uitkomst"), el("div", {}, (gekozen && gekozen.l) || af.uitkomst)),
          el("div", {}, el("div", { class: "mini" }, "Daadwerkelijk gecorrigeerd"),
            el("div", {}, af.bedrag == null ? "—" : euro(af.bedrag)))),
        af.toelichting ? el("p", { class: "klein", style: "margin-top:10px" }, af.toelichting) : null,
        el("p", { class: "mini", style: "margin-top:8px" }, "Afgerond op " + datumTijd(af.op)),
        el("div", { class: "knoppen" },
          el("button", { class: "link", type: "button", onclick: () => {
            // undefined overleeft het serialiseren niet; de sleutel moet weg.
            const stappen = Object.assign({}, a.stappen);
            delete stappen.afgerond;
            schrijf(a, { afhandeling: null, stappen, status: "behandeling" },
              "Afhandeling ongedaan gemaakt.");
          } }, "Afhandeling ongedaan maken")));
      return kaart;
    }

    let keuze = null, bedrag = null;
    const toelichting = el("textarea", { id: "afronding", style: "min-height:90px",
      placeholder: "Wat is er afgesproken of besloten? Deze tekst ziet de huurder ook." });
    const keuzes = el("div", { class: "keuzes" }, AFLOOP.map((o) =>
      el("button", { class: "keuze", type: "button", "aria-pressed": "false", onclick: (e) => {
        keuze = o.w;
        for (const k of keuzes.querySelectorAll(".keuze")) k.setAttribute("aria-pressed", "false");
        e.currentTarget.setAttribute("aria-pressed", "true");
      } }, el("span", { class: "kt" }, o.l))));

    kaart.append(
      el("p", { class: "klein" }, "Leg vast hoe het is afgelopen. De huurder ziet de uitkomst op zijn eigen pagina."),
      keuzes,
      veld({ naam: "bedrag", label: "Daadwerkelijk gecorrigeerd bedrag (optioneel)", type: "bedrag",
        hulp: "Laat leeg als er niets is gecorrigeerd of als het nog niet vaststaat." }, null, (v) => { bedrag = v; }),
      el("div", { style: "margin-top:16px" }, el("label", { for: "afronding" }, "Toelichting"), toelichting),
      el("div", { class: "knoppen" },
        el("button", { class: "primair vol", type: "button", onclick: async () => {
          if (!keuze) return melding("Kies eerst een uitkomst.", "fout");
          const gekozen = AFLOOP.find((x) => x.w === keuze);
          const nu = new Date().toISOString();
          const afh = { uitkomst: keuze, bedrag: bedrag, op: nu, toelichting: toelichting.value.trim() };
          await schrijf(a, Object.assign(
            metNotitie(a, "Dossier afgerond",
              gekozen.l + (bedrag != null ? " — gecorrigeerd: " + euro(bedrag) : "") +
              (afh.toelichting ? " " + afh.toelichting : "")),
            { afhandeling: afh, status: gekozen.st,
              stappen: Object.assign({}, a.stappen, { afgerond: nu }) }),
            "Dossier afgerond.");
        } }, "Dossier afronden")));
    return kaart;
  }

  function blokVerloop(a) {
    const kaart = el("div", { class: "kaart", style: "margin-top:12px" },
      el("p", { class: "oog" }, "Verloop"),
      el("h2", {}, "Aantekeningen"));
    if (a.notities && a.notities.length) {
      kaart.append(el("ul", { class: "tijdlijn" }, a.notities.map((n) => el("li", {},
        el("span", { class: "wie" }, n.titel || "Update"), el("div", {}, n.tekst),
        el("div", { class: "wanneer" }, datumTijd(n.op))))));
    } else {
      kaart.append(el("p", { class: "klein" }, "Nog geen aantekeningen."));
    }
    const vak = el("textarea", { id: "notitie", style: "min-height:90px",
      placeholder: "Aantekening bij het dossier — ook zichtbaar voor de huurder." });
    kaart.append(el("div", { style: "margin-top:14px" },
      el("label", { for: "notitie" }, "Aantekening toevoegen"), vak),
      el("div", { class: "knoppen rij" },
        el("button", { class: "primair", type: "button", onclick: async () => {
          const tekst = vak.value.trim();
          if (!tekst) return melding("Schrijf eerst een aantekening.", "fout");
          await schrijf(a, metNotitie(a, "Update van de beoordelaar", tekst), "Aantekening opgeslagen.");
        } }, "Aantekening opslaan"),
        el("div", { class: "filters", style: "margin:0" },
          Object.entries(STATUSSEN).map(([w, s]) => el("button", { type: "button",
            "aria-pressed": String(a.status === w),
            onclick: () => schrijf(a, { status: w }, "Status bijgewerkt naar " + s.label + ".") }, s.label)))));
    return kaart;
  }

  const herteken = () => {
    const a = Opslag.lijst().find((x) => x.id === geopendDossier);
    if (a) openDossier(a);
  };

  /* ══════════════════════════════════════════════════════════ rapport

     Het rapport wordt als DOM opgebouwd en voor het afdrukken naar een nieuw
     venster gekopieerd. Zo hoeft er nergens tekst in HTML te worden geplakt. */

  /* Alleen .rapport-regels, zodat dezelfde stijl ook in het voorbeeldvenster
     kan worden gebruikt zonder de rest van de pagina te raken. */
  const RAPPORTPAPIER = `
@page { margin: 18mm 15mm; }
body { font: 10.5pt/1.5 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
       color: #14150f; margin: 0; background: #fff; }
`;

  const RAPPORTSTIJL = `
.rapport { max-width: 720px; margin: 0 auto; }
.rapport h1 { font-size: 1.82em; margin: 0 0 2mm; letter-spacing: -.02em; }
.rapport h2 { font-size: 1.15em; margin: 8mm 0 2mm; padding-bottom: 1.5mm;
              border-bottom: 1px solid #c9c6b9; page-break-after: avoid; }
.rapport h3 { font-size: 1em; margin: 4mm 0 1mm; page-break-after: avoid; }
.rapport p { margin: 0 0 2mm; max-width: none; }
.rapport .oog { font-size: .76em; letter-spacing: .12em; text-transform: uppercase; color: #8b8d82;
                font-weight: 700; margin-bottom: 1mm; }
.rapport .mini { font-size: .81em; color: #5a5c53; }
.rapport table { width: 100%; border-collapse: collapse; margin: 2mm 0 4mm; font-size: .9em; }
.rapport th, .rapport td { text-align: left; padding: 1.6mm 2mm; border-bottom: 1px solid #e1dfd6;
                           vertical-align: top; }
.rapport th { font-size: .76em; text-transform: uppercase; letter-spacing: .07em; color: #5a5c53; }
.rapport td.geld, .rapport th.geld { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.rapport tr.som td { border-top: 1.5px solid #14150f; border-bottom: none; font-weight: 700; }
.rapport .post { border-left: 2.5pt solid #c9c6b9; padding: 0 0 0 3mm; margin: 0 0 4mm;
                 page-break-inside: avoid; }
.rapport .post.ROOD { border-left-color: #d03b3b; }
.rapport .post.ORANJE { border-left-color: #b87400; }
.rapport .post.GROEN { border-left-color: #0ca30c; }
.rapport .post.BUITEN_BEVOEGDHEID { border-left-color: #8b8d82; }
.rapport .reken { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: .81em;
                  color: #5a5c53; margin: 1mm 0 0; }
.rapport .regels { font-size: .76em; color: #8b8d82; margin-top: 1mm; }
.rapport ul { margin: 1mm 0 2mm; padding-left: 5mm; }
.rapport li { margin-bottom: 1mm; }
.rapport .slot { margin-top: 8mm; padding-top: 3mm; border-top: 1px solid #c9c6b9;
                 font-size: .81em; color: #5a5c53; }
`;

  function rapportNode(a) {
    const h = a.huurder || {};
    const r = el("div", { class: "rapport" });
    const rij = (k, v) => el("tr", {}, el("th", {}, k), el("td", {}, v || "—"));

    r.append(
      el("p", { class: "oog" }, "Rapport servicekostencontrole"),
      el("h1", {}, "Afrekening " + a.jaar + " — " + (h.naam || "huurder")),
      el("p", { class: "mini" }, "Dossier " + a.id + " · opgesteld " + datumTijd(new Date().toISOString())));

    r.append(el("h2", {}, "Gegevens"),
      el("table", {}, el("tbody", {},
        rij("Huurder", h.naam), rij("Adres", h.adres), rij("Verhuurder", h.verhuurder),
        rij("Boekjaar", String(a.jaar)), rij("Ingediend", datumTijd(a.ingediend_op)),
        rij("Aangeleverd als", a.bron),
        a.herzien_op ? rij("Laatst herzien", datumTijd(a.herzien_op)) : null)));

    const somrij = (k, v, som) => el("tr", { class: som ? "som" : "" },
      el("td", {}, k), el("td", { class: "geld" }, v));
    r.append(el("h2", {}, "Samenvatting"),
      el("table", {}, el("tbody", {},
        somrij("In rekening gebracht", euro(a.totaal_verhuurder)),
        somrij("Toegestaan volgens het beleidsboek", euro(a.totaal_model)),
        Number(a.onbeoordeeld) > 0
          ? somrij("Nog niet te beoordelen", euro(a.onbeoordeeld)) : null,
        somrij("Verschil", euro(a.correctie), true))));
    if (Number(a.onbeoordeeld) > 0) {
      r.append(el("p", { class: "mini" },
        "Het verschil is het bedrag dat nu al vaststaat. Blijken de nog niet te beoordelen posten " +
        "eveneens onterecht, dan loopt het op tot " + euro(a.bandbreedte_max) + ". Er wordt niets " +
        "berekend zonder de gegevens die daarvoor nodig zijn."));
    }
    if (a.voorschot != null) {
      r.append(el("p", {}, "Betaald voorschot: " + euro(a.voorschot) + ". " +
        (a.saldo != null
          ? (Number(a.saldo) >= 0 ? "Op basis van deze berekening staat daar " + euro(a.saldo) +
             " tegenover die terugbetaald zou moeten worden."
             : "Op basis van deze berekening resteert een bij te betalen bedrag van " + euro(Math.abs(a.saldo)) + ".")
          : "")));
    }

    const ontv = a.ontvankelijkheid || a.blokkerend || [];
    if (ontv.length) {
      r.append(el("h2", {}, "Ontvankelijkheid"),
        el("ul", {}, ontv.map((t) => el("li", {}, t.replace(/^(ROOD|ORANJE|OK|LET OP) - /, "")))));
    }

    r.append(el("h2", {}, "Bevindingen per post"));
    for (const status of RANG) {
      const posten = (a.bevindingen || []).filter((b) => b.status === status);
      if (!posten.length) continue;
      r.append(el("h3", {}, STAT[status].kop + " (" + posten.length + ")"));
      for (const b of posten) {
        const regelId = besteRegel(b);
        const uitleg = regelId ? UITLEG[regelId] : null;
        const vak = el("div", { class: "post " + b.status },
          el("p", {}, el("b", {}, b.omschrijving), " — in rekening gebracht " + euro(b.bedrag_verhuurder) +
            (b.bedrag_model !== null ? ", toegestaan " + euro(b.bedrag_model) : "") +
            (b.verschil ? ", verschil " + euro(b.verschil) : "")));
        if (uitleg) vak.append(el("p", {}, el("b", {}, uitleg.kop + ". "), uitleg.uitleg));
        for (const t of b.toelichting) vak.append(el("p", { class: "mini" }, t));
        for (const t of b.berekening) vak.append(el("p", { class: "reken" }, t));
        for (const t of b.ontbrekende_informatie) vak.append(el("p", { class: "mini" }, "Nog nodig: " + t));
        if (b.regels.length) vak.append(el("p", { class: "regels" }, "Regels: " + b.regels.join(", ")));
        r.append(vak);
      }
    }

    const open = (a.stukken || []).filter((s) => s.status !== "ontvangen");
    if (open.length) {
      r.append(el("h2", {}, "Nog op te vragen"),
        el("p", {}, "Op grond van artikel 7:259 lid 4 BW heeft de huurder recht op inzage in de boeken " +
          "en andere bescheiden die aan de afrekening ten grondslag liggen. Voor deze punten is dat nodig:"),
        el("ul", {}, open.map((s) => el("li", {}, s.post + ": " + s.vraag +
          (s.status === "opgevraagd" ? " (opgevraagd " + datum(s.op) + ")" : "")))));
    }

    r.append(el("h2", {}, "Conclusie"));
    const rood = (a.tellingen || {}).ROOD || 0, oranje = (a.tellingen || {}).ORANJE || 0;
    if (Number(a.correctie) > 0) {
      r.append(el("p", {}, "Op " + rood + " " + (rood === 1 ? "post" : "posten") + " rekent de verhuurder " +
        "meer dan het Beleidsboek Servicekosten toestaat. Het verschil bedraagt " + euro(a.correctie) + "."));
    } else if (oranje) {
      r.append(el("p", {}, "Er is geen harde afwijking vastgesteld, maar voor " + oranje + " " +
        (oranje === 1 ? "post" : "posten") + " ontbreken gegevens die de verhuurder moet aanleveren."));
    } else {
      r.append(el("p", {}, "Alle beoordeelde posten passen binnen wat de Huurcommissie toestaat. " +
        "Er is op basis van deze afrekening geen aanleiding voor bezwaar."));
    }

    const af = a.afhandeling;
    if (af && af.uitkomst) {
      const gek = AFLOOP.find((x) => x.w === af.uitkomst);
      r.append(el("h2", {}, "Afhandeling"),
        el("p", {}, ((gek && gek.l) || af.uitkomst) +
          (af.bedrag != null ? " — daadwerkelijk gecorrigeerd: " + euro(af.bedrag) : "") + "."),
        af.toelichting ? el("p", {}, af.toelichting) : null,
        el("p", { class: "mini" }, "Vastgelegd op " + datumTijd(af.op)));
    } else {
      r.append(el("h2", {}, "Vervolgstappen"), el("ul", {}, [
        Number(a.correctie) > 0
          ? "Maak schriftelijk bezwaar bij de verhuurder en verzoek om correctie van " + euro(a.correctie) + "."
          : null,
        open.length ? "Vraag de ontbrekende stukken op; zonder die stukken blijft een deel onbeoordeeld." : null,
        "Reageert de verhuurder niet binnen drie weken of neemt de reactie het bezwaar niet weg, " +
        "leg het geschil dan voor aan de Huurcommissie (artikel 7:260 BW).",
        "Let op de termijn: een verzoek kan tot tweeëneenhalf jaar na afloop van het kalenderjaar " +
        "worden ingediend (Tabel 10, p. 56).",
      ].filter(Boolean).map((t) => el("li", {}, t))));
    }

    if (a.notities && a.notities.length) {
      r.append(el("h2", {}, "Verloop"),
        el("ul", {}, a.notities.map((n) => el("li", {},
          datumTijd(n.op) + " — " + (n.titel ? n.titel + ": " : "") + n.tekst))));
    }

    r.append(el("div", { class: "slot" },
      el("p", {}, "Opgesteld op basis van het Beleidsboek Servicekosten van de Huurcommissie, " +
        "versie 1 juli 2026. Bedragen zijn berekend volgens de daarin opgenomen normen, tarieven en " +
        "verdeelsleutels; per post staat de toegepaste regel vermeld."),
      el("p", {}, "Dit rapport is geen juridisch advies. De Huurcommissie handelt naar haar beleid " +
        "maar kan daarvan gemotiveerd afwijken.")));
    return r;
  }

  function rapportTekst(a) {
    const h = a.huurder || {};
    const lijn = "─".repeat(64);
    const r = ["RAPPORT SERVICEKOSTENCONTROLE", lijn, ""];
    r.push("Dossier:      " + a.id);
    r.push("Huurder:      " + (h.naam || "—"));
    r.push("Adres:        " + (h.adres || "—"));
    r.push("Verhuurder:   " + (h.verhuurder || "—"));
    r.push("Boekjaar:     " + a.jaar);
    r.push("Ingediend:    " + datumTijd(a.ingediend_op));
    if (a.herzien_op) r.push("Herzien:      " + datumTijd(a.herzien_op));
    r.push("Opgesteld:    " + datumTijd(new Date().toISOString()));
    r.push("", lijn, "SAMENVATTING", lijn, "");
    r.push("In rekening gebracht:           " + euro(a.totaal_verhuurder));
    r.push("Toegestaan volgens beleidsboek: " + euro(a.totaal_model));
    r.push("Verschil:                       " + euro(a.correctie));
    if (Number(a.onbeoordeeld) > 0) {
      r.push("Nog niet te beoordelen:         " + euro(a.onbeoordeeld));
      r.push("Bandbreedte:                    " + euro(a.correctie) + " tot " + euro(a.bandbreedte_max));
    }
    if (a.voorschot != null) r.push("Betaald voorschot:              " + euro(a.voorschot));
    r.push("");
    const ontv = a.ontvankelijkheid || a.blokkerend || [];
    if (ontv.length) {
      r.push(lijn, "ONTVANKELIJKHEID", lijn, "");
      for (const t of ontv) r.push("- " + t.replace(/^(ROOD|ORANJE|OK|LET OP) - /, ""));
      r.push("");
    }
    for (const status of RANG) {
      const posten = (a.bevindingen || []).filter((b) => b.status === status);
      if (!posten.length) continue;
      r.push(lijn, STAT[status].kop.toUpperCase() + " (" + posten.length + ")", lijn, "");
      for (const b of posten) {
        const regelId = besteRegel(b);
        const uitleg = regelId ? UITLEG[regelId] : null;
        r.push(b.omschrijving);
        r.push("  In rekening gebracht: " + euro(b.bedrag_verhuurder) +
          (b.bedrag_model !== null ? "   Toegestaan: " + euro(b.bedrag_model) : "") +
          (b.verschil ? "   Verschil: " + euro(b.verschil) : ""));
        if (uitleg) r.push("  " + uitleg.kop + ". " + uitleg.uitleg);
        for (const t of b.toelichting) r.push("  " + t);
        for (const t of b.berekening) r.push("  " + t);
        for (const t of b.ontbrekende_informatie) r.push("  Nog nodig: " + t);
        if (b.regels.length) r.push("  Regels: " + b.regels.join(", "));
        r.push("");
      }
    }
    const open = (a.stukken || []).filter((s) => s.status !== "ontvangen");
    if (open.length) {
      r.push(lijn, "NOG OP TE VRAGEN", lijn, "");
      for (const s of open) r.push("- " + s.post + ": " + s.vraag);
      r.push("");
    }
    const af = a.afhandeling;
    if (af && af.uitkomst) {
      const gek = AFLOOP.find((x) => x.w === af.uitkomst);
      r.push(lijn, "AFHANDELING", lijn, "");
      r.push(((gek && gek.l) || af.uitkomst) +
        (af.bedrag != null ? " — daadwerkelijk gecorrigeerd: " + euro(af.bedrag) : ""));
      if (af.toelichting) r.push(af.toelichting);
      r.push("");
    }
    if (a.notities && a.notities.length) {
      r.push(lijn, "VERLOOP", lijn, "");
      for (const n of a.notities) r.push(datumTijd(n.op) + " — " + (n.titel ? n.titel + ": " : "") + n.tekst);
      r.push("");
    }
    r.push(lijn);
    r.push("Opgesteld op basis van het Beleidsboek Servicekosten van de Huurcommissie, versie 1 juli 2026.");
    r.push("Dit rapport is geen juridisch advies. De Huurcommissie kan gemotiveerd van haar beleid afwijken.");
    return r.join("\n");
  }

  function rapportstijlLaden() {
    if (document.getElementById("rapportstijl")) return;
    const st = document.createElement("style");
    st.id = "rapportstijl";
    st.textContent = RAPPORTSTIJL;
    document.head.append(st);
  }

  function toonRapport(a) {
    rapportstijlLaden();
    const voorbeeld = el("div", { class: "rapportvoorbeeld" }, rapportNode(a));
    const blad = el("div", { class: "blad" },
      el("p", { class: "oog" }, "Rapport"),
      el("h2", {}, "Dossier " + a.id),
      el("p", { class: "klein" }, "Zo komt het eruit te zien. Afdrukken geeft dezelfde opmaak; " +
        "de tekstversie is bedoeld om in een e-mail te plakken."),
      voorbeeld);
    const achter = el("div", { class: "blad-achter", onclick: (e) => { if (e.target === achter) achter.remove(); } }, blad);
    blad.append(el("div", { class: "knoppen rij" },
      el("button", { class: "primair", type: "button", onclick: () => drukAf(a) }, "Afdrukken of pdf"),
      el("button", { type: "button", onclick: async () => {
        try { await navigator.clipboard.writeText(rapportTekst(a)); melding("Rapport als tekst gekopieerd.", "ok"); }
        catch { melding("Kopiëren lukte niet. Gebruik 'Afdrukken of pdf'.", "letop"); }
      } }, "Kopieer als tekst"),
      el("button", { class: "link", type: "button", onclick: () => achter.remove() }, "Sluiten")));
    document.body.append(achter);
  }

  function drukAf(a) {
    const venster = window.open("", "_blank");
    if (!venster) return melding("Je browser blokkeerde het afdrukvenster.", "letop");
    const doc = venster.document;
    doc.title = "Rapport " + a.id + " — servicekosten " + a.jaar;
    const stijl = doc.createElement("style");
    stijl.textContent = RAPPORTPAPIER + RAPPORTSTIJL;
    doc.head.append(stijl);
    doc.body.append(doc.importNode(rapportNode(a), true));
    venster.focus();
    setTimeout(() => venster.print(), 350);
  }

  /* Brieven in de beheeromgeving werken op het opgeslagen dossier in plaats
     van op de lopende controle. */
  function toonBriefBlad(titel, tekst, a) {
    const vak = el("textarea", { spellcheck: "false", style: "min-height:320px;margin-top:12px" });
    vak.value = tekst;
    const blad = el("div", { class: "blad" },
      el("p", { class: "oog" }, "Concept"),
      el("h2", {}, titel),
      el("p", { class: "klein" }, "Controleer de stukken tussen [ ] en pas aan wat nodig is."),
      vak);
    const achter = el("div", { class: "blad-achter", onclick: (e) => { if (e.target === achter) achter.remove(); } }, blad);
    blad.append(el("div", { class: "knoppen rij" },
      el("button", { class: "primair", type: "button", onclick: async () => {
        try { await navigator.clipboard.writeText(vak.value); melding("Brief gekopieerd.", "ok"); }
        catch { vak.select(); melding("Kopiëren lukte niet automatisch — de tekst is geselecteerd.", "letop"); }
      } }, "Kopieer de brief"),
      a ? el("button", { type: "button", onclick: () => {
        achter.remove();
        schrijf(a, metNotitie(a, titel, "Concept opgesteld en aan de huurder verstrekt."),
          "Vastgelegd in het verloop.");
      } }, "Vastleggen in het dossier") : null,
      el("button", { class: "link", type: "button", onclick: () => achter.remove() }, "Sluiten")));
    document.body.append(achter);
  }

  /* ───────────────────────────────────────────────────────── brieven */

  const eu = (w) => "EUR " + Number(w).toFixed(2).replace(".", ",");
  const nlDat = (d) => d.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });

  /* Brieven zijn werk van de beoordelaar, niet van de huurder: ze verwijzen
     naar wetsartikelen en termijnen waar een verkeerde keuze geld kost. De
     huurder krijgt de brief die bij zijn dossier hoort van ons toegestuurd. */
  function bezwaarbriefUit(a) {
    const nu = new Date(), over3w = new Date(Date.now() + 21 * 864e5);
    const alle = a.bevindingen || [];
    const rood = alle.filter((b) => b.status === "ROOD" && (b.verschil || 0) > 0);
    const oranje = alle.filter((b) => b.status === "ORANJE");
    const h = a.huurder || {};
    const r = [h.naam || "[Uw naam]", h.adres || "[Uw adres]", "", "Aan: " + (h.verhuurder || "[naam verhuurder]"),
      "[adres verhuurder]", "", "Datum: " + nlDat(nu),
      "Betreft: bezwaar tegen de afrekening servicekosten " + a.jaar, "", "Geachte heer/mevrouw,", "",
      "Op [datum] ontving ik van u de afrekening servicekosten over " + a.jaar + ". Ik ben het niet " +
      "eens met een aantal posten. Hieronder licht ik per kostenpost toe waarom, zoals artikel 7:260 BW en " +
      "het Beleidsboek Servicekosten van de Huurcommissie van mij verlangen.", ""];
    if (rood.length) {
      r.push("1. Posten waartegen ik bezwaar maak", "");
      rood.forEach((b, i) => {
        r.push((i + 1) + ". " + b.omschrijving + " - in rekening gebracht: " + eu(b.bedrag_verhuurder));
        for (const t of b.toelichting) r.push("   " + t);
        for (const t of b.berekening) r.push("   " + t);
        r.push("   Volgens het beleidsboek kom ik uit op " + eu(b.bedrag_model) + ". Ik verzoek u dit te corrigeren met " + eu(b.verschil) + ".", "");
      });
      r.push("Het totaal van de door mij betwiste correcties bedraagt " + eu(a.correctie) + ".", "");
    }
    if (oranje.length) {
      r.push((rood.length ? "2" : "1") + ". Posten waarvoor ik aanvullende informatie nodig heb", "",
        "Op grond van artikel 7:259 lid 4 BW heb ik recht op inzage in de boeken en andere bescheiden die aan " +
        "de afrekening ten grondslag liggen. Voor de volgende posten verzoek ik u die stukken te verstrekken:", "");
      for (const b of oranje) {
        r.push("- " + b.omschrijving + " (" + eu(b.bedrag_verhuurder) + "):");
        for (const t of b.ontbrekende_informatie) r.push("  " + t);
      }
      r.push("");
    }
    r.push("Ik verzoek u binnen drie weken, dus uiterlijk " + nlDat(over3w) + ", op dit bezwaar te reageren en " +
      "de afrekening zo nodig aan te passen. Ontvang ik binnen die termijn geen reactie, of neemt uw reactie " +
      "mijn bezwaren niet weg, dan leg ik het geschil voor aan de Huurcommissie.", "", "Met vriendelijke groet,",
      "", h.naam || "[Uw naam]", "", "---",
      "Concept op basis van het Beleidsboek Servicekosten (versie 1 juli 2026). Controleer de gegevens tussen " +
      "[ ] voordat u verstuurt. Dit is geen juridisch advies.");
    return r.join("\n");
  }

  function opvraagbriefUit(a) {
    const nu = new Date(), over3w = new Date(Date.now() + 21 * 864e5);
    const jaar = Number(a.jaar);
    const h = a.huurder || {};
    return [h.naam || "[Uw naam]", h.adres || "[Uw adres]", "", "Aan: " + (h.verhuurder || "[naam verhuurder]"),
      "[adres verhuurder]", "", "Datum: " + nlDat(nu), "Betreft: verzoek om de afrekening servicekosten " + jaar,
      "", "Geachte heer/mevrouw,", "",
      "Op grond van artikel 7:259 lid 2 BW bent u verplicht mij uiterlijk zes maanden na afloop van het " +
      "kalenderjaar een naar soort uitgesplitst overzicht te verstrekken van de in dat jaar in rekening " +
      "gebrachte kosten, met vermelding van de wijze van berekening. Voor het jaar " + jaar + " was die " +
      "termijn uiterlijk 30 juni " + (jaar + 1) + ".", "",
      "Ik heb deze afrekening niet ontvangen. Hierbij verzoek ik u die alsnog te verstrekken, uiterlijk " +
      "binnen drie weken, dus vóór " + nlDat(over3w) + ".", "",
      "Ontvang ik de afrekening niet binnen die termijn, dan leg ik de vaststelling van mijn " +
      "betalingsverplichting voor aan de Huurcommissie (artikel 7:260 BW).", "", "Met vriendelijke groet,",
      "", h.naam || "[Uw naam]", "", "---",
      "Concept op basis van het Beleidsboek Servicekosten, paragraaf 6.3.2. Dit is geen juridisch advies."].join("\n");
  }

  /* Verzoek om inzage in de onderliggende stukken, per openstaand punt. */
  function inzagebrief(a, stukken) {
    const nu = new Date(), over3w = new Date(Date.now() + 21 * 864e5);
    const h = a.huurder || {};
    const open = (stukken || []).filter((s) => s.status !== "ontvangen");
    const r = [h.naam || "[Uw naam]", h.adres || "[Uw adres]", "",
      "Aan: " + (h.verhuurder || "[naam verhuurder]"), "[adres verhuurder]", "",
      "Datum: " + nlDat(nu),
      "Betreft: verzoek om inzage in de stukken bij de afrekening servicekosten " + a.jaar, "",
      "Geachte heer/mevrouw,", "",
      "Op grond van artikel 7:259 lid 4 BW heb ik recht op inzage in de boeken en andere bescheiden " +
      "die aan de afrekening servicekosten over " + a.jaar + " ten grondslag liggen. Van een aantal " +
      "posten kan ik zonder die stukken niet nagaan of het in rekening gebrachte bedrag juist is.", "",
      "Ik verzoek u de volgende gegevens te verstrekken:", ""];
    if (open.length) {
      const perPost = new Map();
      for (const s of open) {
        if (!perPost.has(s.post)) perPost.set(s.post, []);
        perPost.get(s.post).push(s.vraag);
      }
      for (const [post, vragen] of perPost) {
        r.push("- " + post + ":");
        for (const q of vragen) r.push("    " + q);
      }
    } else {
      r.push("- [vul hier in welke stukken u nodig hebt]");
    }
    r.push("",
      "Ik verzoek u deze stukken binnen drie weken, dus uiterlijk " + nlDat(over3w) + ", te verstrekken. " +
      "Ontvang ik ze niet, dan leg ik de vaststelling van mijn betalingsverplichting voor aan de " +
      "Huurcommissie (artikel 7:260 BW). Bij het ontbreken van een onderbouwing stelt de Huurcommissie " +
      "de kosten vast op een wettelijk forfait, dat doorgaans lager uitvalt dan het in rekening " +
      "gebrachte bedrag.", "",
      "Met vriendelijke groet,", "", h.naam || "[Uw naam]", "", "---",
      "Concept op basis van het Beleidsboek Servicekosten (versie 1 juli 2026), paragraaf 6.4. " +
      "Controleer de gegevens tussen [ ] voordat u verstuurt. Dit is geen juridisch advies.");
    return r.join("\n");
  }

  /* ──────────────────────────────────────────────────────── voorbeeld */

  function toonVoorbeeld() {
    wisMeldingen();
    isVoorbeeld = true;
    dossier = leegDossier();
    dossier.huurder = { naam: "J. van Dijk", email: "j.vandijk@voorbeeld.nl", telefoon: "",
      adres: "Kastanjelaan 42-3, 1000 AB Amsterdam", verhuurder: "Woonstichting De Meidoorn" };
    leesTekst(D.voorbeeld, "voorbeeldafrekening");
    wisMeldingen();
    dossier.woonruimte.woningtype = "flatwoning_appartement";
    dossier.woonruimte.aantal_bewoners = 2;
    dossier.woonruimte.aantal_woonruimten_complex = 48;
    dossier._onderbouwing = "volledig";
    for (const post of dossier.kostenposten) post.bewijs = ["facturen", "specificatieformulier"];
    dossier.procedure = { contract_gesloten_op: "2022-03-01", sector: "sociaal", afrekening_ontvangen: true, bezwaar_gemaakt: true };
    bereken();
  }

  /* ──────────────────────────────────────────────────────────── rol */

  function rolKnoppen() {
    $("#rol-huurder").setAttribute("aria-selected", String(rol === "huurder"));
    $("#rol-beheer").setAttribute("aria-selected", String(rol === "beheer"));
  }
  function zetRol(nieuw) {
    if (rol === nieuw) return;
    naarScherm(nieuw === "beheer" ? "beheer" : "dash");
  }

  /* ─────────────────────────────────────────────────────────── start */

  function init() {
    // In de Artifact-omgeving levert de runtime het <html>-element; die krijgt
    // de taal hier, zodat afbreken en voorlezen ook daar klopt.
    document.documentElement.lang = "nl";

    $("#rol-huurder").addEventListener("click", () => zetRol("huurder"));
    $("#rol-beheer").addEventListener("click", () => zetRol("beheer"));
    $("#thema").addEventListener("click", () => {
      const nu = document.documentElement.getAttribute("data-theme");
      const donker = nu === "dark" || (nu !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.setAttribute("data-theme", donker ? "light" : "dark");
    });

    $("#gegevens-terug").addEventListener("click", () => terug("dash"));
    $("#gegevens-verder").addEventListener("click", () => {
      wisMeldingen();
      leesGegevens();
      if (!dossier.huurder.naam || !dossier.huurder.email) return melding("Vul je naam en e-mailadres in.", "fout");
      if (!dossier.kostenposten.length) { $("#plakblok").hidden = true; $("#handblok").hidden = true; }
      bewaar("invoer");
      naarScherm("invoer");
    });

    $("#foto-toevoegen").addEventListener("click", () => $("#fotoinvoer").click());
    $("#fotoinvoer").addEventListener("change", async (e) => {
      if (e.target.files && e.target.files.length) await voegFotosToe(e.target.files);
      e.target.value = "";
    });
    $("#invoer-verder").addEventListener("click", () => {
      wisMeldingen();
      if (!$("#plakblok").hidden && $("#plakvak").value.trim().length >= 20) return $("#plak-lezen").click();
      if (!$("#handblok").hidden && handRijen.some((r) => r.categorie && Number(r.bedrag) > 0)) return $("#hand-klaar").click();
      if (dossier.kostenposten.length) return naarScherm("vragen");
      melding(bijlagen.length
        ? "Je foto staat klaar en gaat mee met je dossier. Voer de posten er nog bij in — kies 'Posten zelf invoeren' — dan kan ik ook rekenen."
        : "Kies eerst hoe je je afrekening invoert: een bestand uploaden, de tekst plakken, of de posten zelf invoeren.",
        "letop");
    });

    $("#k-bestand").addEventListener("click", () => $("#bestand").click());
    $("#bestand").addEventListener("change", (e) => e.target.files[0] && leesBestand(e.target.files[0]));
    $("#k-plakken").addEventListener("click", () => { $("#handblok").hidden = true; $("#plakblok").hidden = false; $("#plakvak").focus(); });
    $("#k-handmatig").addEventListener("click", toonHandmatig);
    $("#hand-toevoegen").addEventListener("click", () => { handRijen.push({ omschrijving: "", categorie: null, bedrag: 0 }); rendHand(); });
    $("#hand-klaar").addEventListener("click", () => {
      wisMeldingen();
      const bruikbaar = handRijen.filter((r) => r.categorie && Number(r.bedrag) > 0);
      if (!bruikbaar.length) return melding("Voeg minstens één post toe met een soort en een bedrag.", "fout");
      if (!dossier.bron) dossier.bron = "handmatig ingevoerd";
      dossier.kostenposten = bruikbaar.map((r, i) => {
        const post = r.bron || {
          overeengekomen: true, bewijs: [], levering_gemotiveerd_betwist: false, parameters: {},
        };
        post.id = "P" + (i + 1);
        post.categorie = r.categorie;
        post.omschrijving = r.omschrijving || "Kostenpost " + (i + 1);
        post.bedrag_verhuurder = Number(r.bedrag);
        return post;
      });
      startVragen();
    });
    $("#plak-lezen").addEventListener("click", () => {
      wisMeldingen();
      const tekst = $("#plakvak").value;
      if (tekst.trim().length < 20) return melding("Plak eerst de tekst van je afrekening.", "fout");
      if (leesTekst(tekst, "geplakte tekst")) toonControle();
    });
    $("#invoer-terug").addEventListener("click", () => terug("gegevens"));

    $("#v-volgende").addEventListener("click", volgendeVraag);
    $("#v-vorige").addEventListener("click", () => {
      wisMeldingen();
      if (vraagIndex > 0) { vraagIndex--; toonVraag(); window.scrollTo({ top: 0 }); }
      else terug("invoer");
    });
    $("#uitkomst-terug").addEventListener("click", () => terug("vragen"));
    $("#zoek").addEventListener("input", (e) => { zoekterm = e.target.value.trim().toLowerCase(); rendBeheer(); });

    $("#doe-indienen").addEventListener("click", dienIn);
    $("#doe-aanpassen").addEventListener("click", () => { vraagIndex = 0; naarScherm("vragen"); });
    $("#voorbeeld-stop").addEventListener("click", () => { isVoorbeeld = false; startControle(); });
    $("#mijn-terug").addEventListener("click", () => terug("dash"));
    $("#dossier-terug").addEventListener("click", () => terug("beheer"));

    window.addEventListener("popstate", (e) => {
      navN = (e.state && e.state.n) || 0;
      herstel((e.state && e.state.scherm) || "dash");
    });

    Opslag.opWijziging(() => {
      if (rol === "beheer") {
        if (!$("#s-dossier").hidden) herteken(); else rendBeheer();
      } else if (!$("#s-dash").hidden) rendDash();
      $("#privacy-regel").textContent = Opslag.modus === "gedeeld"
        ? "De berekening gebeurt in je browser. Een dossier dat je indient, gaat naar de beheerder."
        : "De berekening gebeurt in je browser. Een dossier dat je indient, blijft op dit apparaat.";
    });
    Opslag.start();

    try { history.replaceState({ scherm: "dash", n: 0 }, ""); } catch { /* geschiedenis niet beschikbaar */ }
    rolKnoppen();
    rendDash();
    toon("dash");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
