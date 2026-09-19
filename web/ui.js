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
      el("div", { class: "kaart" },
        el("p", { class: "oog" }, "Stand van zaken"),
        el("p", { class: "klein" }, statusTekstHuurder(a)),
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
    $("#groepen").append(rendGroepenUit(uitkomst.beoordelingen));

    $("#advies").textContent = f.potentiele_correctie > 0
      ? "Dien je dossier in, dan kijken wij er met de hand naar en sturen we je een rapport met onze bevindingen en wat je kunt doen. Je kunt ook meteen zelf een bezwaarbrief maken."
      : oranje
        ? "Er ontbreekt informatie die wij voor je kunnen opvragen. Dien je dossier in, dan nemen we contact met je op."
        : "Er is geen aanleiding voor bezwaar gevonden. Wil je dat iemand er toch naar kijkt, dien het dan in.";
    $("#briefblok").hidden = true;
  }

  function rendGroepenUit(beoordelingen) {
    const bak = el("div", {});
    for (const status of RANG) {
      const posten = beoordelingen.filter((b) => b.status === status)
        .sort((a, b) => (b.verschil || 0) - (a.verschil || 0));
      if (!posten.length) continue;
      bak.append(el("div", { class: "groepkop", id: "groep-" + status },
        el("h2", {}, STAT[status].kop),
        el("span", { class: "telling" }, posten.length + " " + (posten.length === 1 ? "post" : "posten"))));
      bak.append(el("p", { class: "klein", style: "margin:0 0 10px" }, STAT[status].uitleg));
      for (const b of posten) bak.append(postKaart(b));
    }
    return bak;
  }

  function postKaart(b) {
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
      const def = D.categorieen.categorieen[b.categorie];
      if (def && def.velden.length && uitkomst) {
        body.append(el("div", { class: "post-acties" },
          el("button", { class: "klein", type: "button", onclick: () => openBlad(b) }, "Zelf beantwoorden")));
      }
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
      const type = def.type === "datum" ? "date" : ["getal", "geheel", "bedrag"].includes(def.type) ? "number" : "text";
      invoer = el("input", { type, id, inputmode: type === "number" ? "decimal" : null,
        step: def.type === "bedrag" ? "0.01" : def.type === "geheel" ? "1" : "any",
        value: waarde == null ? "" : waarde,
        onchange: (e) => { const r = e.target.value; opslaan(r === "" ? null : def.type === "geheel" ? parseInt(r, 10) : Number(r)); } });
    }
    return el("div", { style: "margin-top:16px" }, el("label", { for: id }, def.label), invoer,
      def.hulp ? el("div", { class: "hulp" }, def.hulp) : null);
  }

  function openBlad(b) {
    const post = dossier.kostenposten.find((p) => p.id === b.kostenpost_id);
    if (!post) return;
    const def = D.categorieen.categorieen[post.categorie];
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
      el("button", { class: "primair vol", type: "button", onclick: () => { achter.remove(); bereken(); } }, "Opslaan en opnieuw berekenen"),
      el("button", { class: "link", type: "button", onclick: () => achter.remove() }, "Annuleren")));
    document.body.append(achter);
  }

  /* ───────────────────────────────────────────────────────── indienen */

  function samenvattingVoorOpslag() {
    return {
      jaar: uitkomst.jaar,
      huurder: dossier.huurder,
      bron: dossier.bron,
      totaal_verhuurder: uitkomst.financieel.totaal_verhuurder,
      totaal_model: uitkomst.financieel.totaal_model,
      correctie: uitkomst.financieel.potentiele_correctie,
      onbeoordeeld: uitkomst.financieel.onbeoordeeld_bedrag,
      bandbreedte_max: uitkomst.financieel.bandbreedte_max,
      voorschot: uitkomst.financieel.voorschot_betaald ?? null,
      tellingen: uitkomst.tellingen,
      blokkerend: uitkomst.blokkerend,
      sterkte: uitkomst.sterkte,
      woonruimte: dossier.woonruimte,
      bevindingen: uitkomst.beoordelingen.map((b) => ({
        kostenpost_id: b.kostenpost_id, categorie: b.categorie, omschrijving: b.omschrijving,
        status: b.status, voorlopig: b.voorlopig, bedrag_verhuurder: b.bedrag_verhuurder,
        bedrag_model: b.bedrag_model, verschil: b.verschil, regels: b.regels,
        berekening: b.berekening, toelichting: b.toelichting,
        ontbrekende_informatie: b.ontbrekende_informatie,
      })),
    };
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
        el("button", { class: "vol", type: "button", onclick: () => {
          $("#indienbalk").hidden = true;
          toon("uitkomst");
          toonBrief(bezwaarbrief());
        } }, "Maak alvast zelf een bezwaarbrief"),
        el("button", { class: "primair vol", type: "button", onclick: () => naarScherm("dash") },
          "Naar mijn dossiers")));
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

  function openDossier(a) {
    geopendDossier = a.id;
    const bak = $("#dossier-inhoud");
    bak.textContent = "";
    const h = a.huurder || {};

    bak.append(
      el("p", { class: "oog" }, "Dossier " + a.id),
      el("h1", {}, h.naam || "Onbekende huurder"),
      el("div", { style: "margin:8px 0 18px;display:flex;gap:10px;flex-wrap:wrap;align-items:center" },
        chip(a.status), el("span", { class: "klein" }, "Ingediend " + datumTijd(a.ingediend_op))),

      el("div", { class: "kaart" },
        el("p", { class: "oog" }, "Contactgegevens"),
        el("div", { class: "veldrij twee", style: "margin-top:4px" },
          el("div", {}, el("div", { class: "mini" }, "E-mail"), el("div", {}, h.email || "—")),
          el("div", {}, el("div", { class: "mini" }, "Telefoon"), el("div", {}, h.telefoon || "—"))),
        el("div", { class: "veldrij twee" },
          el("div", {}, el("div", { class: "mini" }, "Adres"), el("div", {}, h.adres || "—")),
          el("div", {}, el("div", { class: "mini" }, "Verhuurder"), el("div", {}, h.verhuurder || "—")))),

      el("div", { class: "kpi", style: "margin-top:12px" },
        el("div", {}, el("div", { class: "k" }, "Afgerekend"), el("div", { class: "v" }, euro(a.totaal_verhuurder))),
        el("div", {}, el("div", { class: "k" }, "Toegestaan"), el("div", { class: "v" }, euro(a.totaal_model))),
        el("div", {}, el("div", { class: "k" }, "Verschil"), el("div", { class: "v" }, euro(a.correctie))),
        el("div", {}, el("div", { class: "k" }, "Onbeoordeeld"), el("div", { class: "v" }, euro(a.onbeoordeeld)),
          el("div", { class: "t" }, "tot " + euro(a.bandbreedte_max)))));

    if (a.blokkerend && a.blokkerend.length) {
      bak.append(el("div", { class: "melding fout", style: "margin-top:12px" },
        el("b", {}, "Ontvankelijkheid: "), a.blokkerend.map((r) => r.replace(/^ROOD - /, "")).join(" ")));
    }

    /* Foto's staan in een aparte collectie en komen dus na. */
    const fotokaart = el("div", { class: "kaart", hidden: true, style: "margin-top:12px" });
    bak.append(fotokaart);
    Opslag.laadBijlagen(a.id).then((bij) => {
      if (!bij.length || geopendDossier !== a.id) return;
      fotokaart.hidden = false;
      fotokaart.append(
        el("p", { class: "oog" }, "Meegestuurd"),
        el("h2", {}, bij.length + (bij.length === 1 ? " foto" : " foto's") + " van de huurder"),
        el("p", { class: "klein" }, "Tik een foto aan om hem op volle grootte te bekijken."),
        el("div", { class: "bijlagen-groot" }, bij.map((f, i) =>
          el("a", { href: f.data, target: "_blank", rel: "noopener" },
            el("img", { src: f.data, alt: "Foto " + (i + 1) + " bij dossier " + a.id })))));
    });

    /* verwerken */
    const verwerk = el("div", { class: "kaart", style: "margin-top:12px" },
      el("p", { class: "oog" }, "Verwerken"),
      el("h2", {}, "Status en aantekening"));
    const statusKeuze = el("div", { class: "filters", style: "margin:12px 0" },
      Object.entries(STATUSSEN).map(([w, s]) => el("button", { type: "button",
        "aria-pressed": String(a.status === w),
        onclick: async () => {
          try { await Opslag.werkBij(a.id, { status: w }); a.status = w; melding("Status bijgewerkt naar " + s.label + ".", "ok"); herteken(); }
          catch (f) { melding("Bijwerken lukte niet: " + (f.message || f.code), "fout"); }
        } }, s.label)));
    const notitieVeld = el("textarea", { id: "notitie", placeholder: "Aantekening voor het dossier — ook zichtbaar voor de huurder.", style: "min-height:100px" });
    verwerk.append(statusKeuze, el("label", { for: "notitie" }, "Aantekening toevoegen"), notitieVeld,
      el("div", { class: "knoppen rij" },
        el("button", { class: "primair", type: "button", onclick: async () => {
          const tekst = notitieVeld.value.trim();
          if (!tekst) return melding("Schrijf eerst een aantekening.", "fout");
          const notities = (a.notities || []).concat([{ op: new Date().toISOString(), titel: "Update van de beoordelaar", tekst }]);
          try { await Opslag.werkBij(a.id, { notities }); a.notities = notities; notitieVeld.value = ""; melding("Aantekening opgeslagen.", "ok"); herteken(); }
          catch (f) { melding("Opslaan lukte niet: " + (f.message || f.code), "fout"); }
        } }, "Aantekening opslaan"),
        el("button", { type: "button", onclick: () => toonRapport(a) }, "Rapport opstellen")));
    bak.append(verwerk);

    if (a.notities && a.notities.length) {
      bak.append(el("div", { class: "kaart", style: "margin-top:12px" },
        el("p", { class: "oog" }, "Verloop"),
        el("ul", { class: "tijdlijn" }, a.notities.map((n) => el("li", {},
          el("span", { class: "wie" }, n.titel || "Update"), el("div", {}, n.tekst),
          el("div", { class: "wanneer" }, datumTijd(n.op)))))));
    }

    bak.append(el("div", { class: "groepkop" }, el("h2", {}, "Bevindingen")),
      rendGroepenUit(a.bevindingen || []));

    bak.append(el("div", { class: "knoppen", style: "margin-top:24px" },
      el("button", { class: "link", type: "button", onclick: async () => {
        if (!confirm("Dit dossier definitief verwijderen?")) return;
        try { await Opslag.verwijder(a.id); geopendDossier = null; naarScherm("beheer"); melding("Dossier verwijderd.", "ok"); }
        catch (f) { melding("Verwijderen lukte niet: " + (f.message || f.code), "fout"); }
      } }, "Dossier verwijderen")));

    toon("dossier");
  }

  const herteken = () => {
    const a = Opslag.lijst().find((x) => x.id === geopendDossier);
    if (a) openDossier(a);
  };

  /* ──────────────────────────────────────────────────────── rapport */

  function rapportTekst(a) {
    const r = [];
    const lijn = "─".repeat(64);
    r.push("RAPPORT SERVICEKOSTENCONTROLE", lijn, "");
    r.push("Dossier:      " + a.id);
    r.push("Huurder:      " + ((a.huurder && a.huurder.naam) || "—"));
    r.push("Adres:        " + ((a.huurder && a.huurder.adres) || "—"));
    r.push("Verhuurder:   " + ((a.huurder && a.huurder.verhuurder) || "—"));
    r.push("Boekjaar:     " + a.jaar);
    r.push("Ingediend:    " + datumTijd(a.ingediend_op));
    r.push("Opgesteld:    " + datumTijd(new Date().toISOString()));
    r.push("", lijn, "SAMENVATTING", lijn, "");
    r.push("In rekening gebracht:          " + euro(a.totaal_verhuurder));
    r.push("Toegestaan volgens beleidsboek: " + euro(a.totaal_model));
    r.push("Verschil:                      " + euro(a.correctie));
    if (Number(a.onbeoordeeld) > 0) {
      r.push("Nog niet te beoordelen:        " + euro(a.onbeoordeeld));
      r.push("Bandbreedte:                   " + euro(a.correctie) + " tot " + euro(a.bandbreedte_max));
    }
    if (a.voorschot != null) r.push("Betaald voorschot:             " + euro(a.voorschot));
    r.push("");
    if (a.blokkerend && a.blokkerend.length) {
      r.push(lijn, "ONTVANKELIJKHEID", lijn, "");
      for (const b of a.blokkerend) r.push("- " + b.replace(/^ROOD - /, ""));
      r.push("");
    }
    for (const status of RANG) {
      const posten = (a.bevindingen || []).filter((b) => b.status === status);
      if (!posten.length) continue;
      r.push(lijn, STAT[status].kop.toUpperCase() + " (" + posten.length + ")", lijn, "");
      for (const b of posten) {
        r.push(b.omschrijving);
        r.push("  In rekening gebracht: " + euro(b.bedrag_verhuurder) +
          (b.bedrag_model !== null ? "   Toegestaan: " + euro(b.bedrag_model) : "") +
          (b.verschil ? "   Verschil: " + euro(b.verschil) : ""));
        for (const t of b.toelichting) r.push("  " + t);
        for (const t of b.berekening) r.push("  " + t);
        for (const t of b.ontbrekende_informatie) r.push("  Nog nodig: " + t);
        if (b.regels.length) r.push("  Regels: " + b.regels.join(", "));
        r.push("");
      }
    }
    if (a.notities && a.notities.length) {
      r.push(lijn, "AANTEKENINGEN", lijn, "");
      for (const n of a.notities) r.push(datumTijd(n.op) + " — " + n.tekst);
      r.push("");
    }
    r.push(lijn);
    r.push("Opgesteld op basis van het Beleidsboek Servicekosten van de Huurcommissie, versie 1 juli 2026.");
    r.push("Dit rapport is geen juridisch advies. De Huurcommissie kan gemotiveerd van haar beleid afwijken.");
    return r.join("\n");
  }

  function toonRapport(a) {
    const tekst = rapportTekst(a);
    const vak = el("textarea", { spellcheck: "false", style: "min-height:340px;margin-top:14px" });
    vak.value = tekst;
    const blad = el("div", { class: "blad" },
      el("p", { class: "oog" }, "Rapport"),
      el("h2", {}, "Dossier " + a.id),
      el("p", { class: "klein" }, "Klaar om te versturen of af te drukken. Je kunt de tekst hier nog aanpassen."),
      vak);
    const achter = el("div", { class: "blad-achter", onclick: (e) => { if (e.target === achter) achter.remove(); } }, blad);
    blad.append(el("div", { class: "knoppen rij" },
      el("button", { class: "primair", type: "button", onclick: async () => {
        try { await navigator.clipboard.writeText(vak.value); melding("Rapport gekopieerd.", "ok"); }
        catch { vak.select(); melding("Kopiëren lukte niet automatisch — de tekst is geselecteerd.", "letop"); }
      } }, "Kopieer rapport"),
      el("button", { type: "button", onclick: () => drukAf(a, vak.value) }, "Afdrukken of pdf"),
      el("button", { class: "link", type: "button", onclick: () => achter.remove() }, "Sluiten")));
    document.body.append(achter);
  }

  function drukAf(a, tekst) {
    const venster = window.open("", "_blank");
    if (!venster) return melding("Je browser blokkeerde het afdrukvenster.", "letop");
    const doc = venster.document;
    doc.title = "Rapport " + a.id;
    const stijl = doc.createElement("style");
    stijl.textContent = "body{font:12px/1.6 ui-monospace,Menlo,Consolas,monospace;margin:34px;white-space:pre-wrap;color:#111}";
    doc.head.append(stijl);
    doc.body.textContent = tekst;
    venster.focus();
    setTimeout(() => venster.print(), 300);
  }

  /* ───────────────────────────────────────────────────────── brieven */

  const eu = (w) => "EUR " + Number(w).toFixed(2).replace(".", ",");
  const nlDat = (d) => d.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });

  function bezwaarbrief() {
    const nu = new Date(), over3w = new Date(Date.now() + 21 * 864e5);
    const rood = uitkomst.beoordelingen.filter((b) => b.status === "ROOD" && (b.verschil || 0) > 0);
    const oranje = uitkomst.beoordelingen.filter((b) => b.status === "ORANJE");
    const h = dossier.huurder;
    const r = [h.naam || "[Uw naam]", h.adres || "[Uw adres]", "", "Aan: " + (h.verhuurder || "[naam verhuurder]"),
      "[adres verhuurder]", "", "Datum: " + nlDat(nu),
      "Betreft: bezwaar tegen de afrekening servicekosten " + uitkomst.jaar, "", "Geachte heer/mevrouw,", "",
      "Op [datum] ontving ik van u de afrekening servicekosten over " + uitkomst.jaar + ". Ik ben het niet " +
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
      r.push("Het totaal van de door mij betwiste correcties bedraagt " + eu(uitkomst.financieel.potentiele_correctie) + ".", "");
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

  function opvraagbrief(jaar) {
    const nu = new Date(), over3w = new Date(Date.now() + 21 * 864e5);
    const h = dossier.huurder;
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

  function toonBrief(tekst) {
    $("#briefblok").hidden = false;
    $("#brief").value = tekst;
    $("#brief").scrollIntoView({ behavior: "smooth", block: "center" });
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
    $("#doe-brief").addEventListener("click", () => toonBrief(bezwaarbrief()));
    $("#doe-aanpassen").addEventListener("click", () => { vraagIndex = 0; naarScherm("vragen"); });
    $("#opvraagbrief").addEventListener("click", () => toonBrief(opvraagbrief(dossier.periode.jaar || uitkomst.jaar)));
    $("#kopieer").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText($("#brief").value); melding("De brief staat op je klembord.", "ok"); }
      catch { $("#brief").select(); melding("Kopiëren lukte niet automatisch — de tekst is geselecteerd.", "letop"); }
    });
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
