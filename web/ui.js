/* Interface van de servicekosten-check.

   Ontwerpregel: de huurder krijgt eerst het antwoord in gewone taal. De
   juridische onderbouwing — regel-ID, paragraaf, berekening — staat er wel,
   maar weggeklapt achter "Waarom?". */

(function () {
  "use strict";

  const D = window.SERVICEKOSTEN_DATA;
  Kern.init({ normen: D.normen });
  Parser.init({ classificatie: D.classificatie });

  const UITLEG = D.uitleg.regels;
  const STATUSTEKST = D.uitleg.statussen;
  const VLAG = { ROOD: "!", ORANJE: "?", GROEN: "✓", BUITEN_BEVOEGDHEID: "–" };
  const VOLGORDE = ["ROOD", "ORANJE", "GROEN", "BUITEN_BEVOEGDHEID"];
  const REGELINFO = {};
  for (const r of D.beslisregels.regels) REGELINFO[r.id] = r;

  let dossier = leegDossier();
  let uitkomst = null;
  let isVoorbeeld = false;
  let vraagIndex = 0;

  /* ------------------------------------------------------------ hulpjes */
  const $ = (s) => document.querySelector(s);
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "html") n.innerHTML = v;
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
  function melding(tekst, soort) {
    const n = el("div", { class: "melding " + (soort || "info") }, tekst);
    $("#meldingen").append(n);
    if (soort !== "fout") setTimeout(() => n.remove(), 9000);
    return n;
  }
  const wisMeldingen = () => { $("#meldingen").textContent = ""; };

  function leegDossier() {
    return {
      woonruimte: { zelfstandig: true, aantal_woonruimten_op_aansluiting: 1, gebruikt_gemeenschappelijke_ruimten: true },
      periode: { jaar: null, maand_van: 1, maand_tot_en_met: 12 },
      procedure: {}, voorschot_in_rekening_gebracht: null, overeengekomen_maximum: null,
      kostenposten: [],
    };
  }

  function toonScherm(naam) {
    for (const s of ["home", "invoer", "vragen", "uitkomst"]) $("#scherm-" + s).hidden = s !== naam;
    $("#opnieuw").hidden = naam === "home";
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  /* ------------------------------------------------------------ inlezen */

  function neemConceptOver(concept) {
    dossier = leegDossier();
    dossier.periode.jaar = concept.jaar;
    dossier.periode.maand_van = concept.maand_van;
    dossier.periode.maand_tot_en_met = concept.maand_tot_en_met;
    dossier.voorschot_in_rekening_gebracht = concept.voorschot;
    if (concept.aantal_woonruimten) dossier.woonruimte.aantal_woonruimten_complex = concept.aantal_woonruimten;
    dossier.kostenposten = concept.posten.map((p, i) => ({
      id: "P" + (i + 1), categorie: p.categorie, omschrijving: p.omschrijving,
      bedrag_verhuurder: p.bedrag, overeengekomen: true, bewijs: [],
      levering_gemotiveerd_betwist: false, parameters: {},
      _alt: p.alternatieve_bedragen, _vraag: p.vraag,
    }));
    for (const post of dossier.kostenposten) {
      if (post.categorie && /^NUT-.*-METER$/.test(post.categorie)) {
        if (concept.meterstanden.beginstand) post.parameters.beginstand = concept.meterstanden.beginstand;
        if (concept.meterstanden.eindstand) post.parameters.eindstand = concept.meterstanden.eindstand;
      }
    }
    const zonder = dossier.kostenposten.filter((p) => !p.categorie).length;
    if (zonder) {
      melding(zonder + " van de " + dossier.kostenposten.length + " posten herkende ik niet. Die laat ik " +
        "buiten de berekening; je kunt ze later zelf indelen bij 'Antwoorden aanpassen'.", "letop");
      dossier.kostenposten = dossier.kostenposten.filter((p) => p.categorie);
    }
    return dossier.kostenposten.length;
  }

  function leesTekst(tekst, naam) {
    const concept = Parser.parseAfrekening(tekst, { bestandsnaam: naam });
    const aantal = neemConceptOver(concept);
    if (!aantal) {
      melding("Ik herkende geen kostenposten in dit bestand. Controleer of dit de servicekostenafrekening " +
        "is, of voer de posten zelf in.", "fout");
      return false;
    }
    melding(aantal + " kostenposten ingelezen.", "ok");
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
          throw new Error("Uit deze PDF komt geen tekst — waarschijnlijk is het een scan of een foto. " +
            "Kies 'Tekst plakken' of 'Zelf invoeren'.");
        }
      } else if (["csv", "tsv"].includes(ext)) {
        tekst = Parser.csvNaarTekst(await file.text());
      } else if (["txt", "md", ""].includes(ext)) {
        tekst = await file.text();
      } else {
        throw new Error("Bestanden van het type ." + ext + " kan ik niet lezen. Gebruik een PDF, CSV of " +
          "tekstbestand, of plak de tekst.");
      }
      bezig.remove();
      if (leesTekst(tekst, naam)) startVragen();
    } catch (fout) {
      bezig.remove();
      melding(fout.message, "fout");
    }
  }

  async function pdfNaarTekst(buffer) {
    if (!window.pdfjsLib) {
      throw new Error("De pdf-lezer kon niet worden geladen. Kies 'Tekst plakken' — dat werkt altijd.");
    }
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

  /* ------------------------------------------------------------- vragen */

  const VRAGEN = [
    {
      kop: "Over welk jaar gaat deze afrekening?",
      hulp: "Het boekjaar bepaalt welke normbedragen en welke termijnen gelden.",
      render() {
        return el("div", {},
          el("label", { for: "q-jaar" }, "Boekjaar"),
          el("input", { type: "number", id: "q-jaar", inputmode: "numeric", min: "2000", max: "2100",
            value: dossier.periode.jaar || "" }),
          el("div", { class: "hulp" }, "Er zijn normbedragen beschikbaar voor " + D.jaren.join(", ") + "."));
      },
      lees() { dossier.periode.jaar = Number($("#q-jaar").value) || null; },
      geldig() { return dossier.periode.jaar ? null : "Vul het boekjaar in."; },
    },
    {
      kop: "Wat voor woonruimte huur je?",
      hulp: "Dit bepaalt met welk normverbruik wordt gerekend als er iets aan de meterstanden mankeert.",
      render() {
        const w = dossier.woonruimte;
        const bak = el("div", {});
        const keuzes = el("div", { class: "keuzes" });
        const opties = D.woningtypen.map((t) => ({ waarde: t.waarde, label: t.label, zelfstandig: true }));
        opties.push({ waarde: "kamer", label: "Een kamer (gedeelde keuken of douche)", zelfstandig: false });
        for (const o of opties) {
          const actief = o.zelfstandig ? (w.zelfstandig && w.woningtype === o.waarde) : !w.zelfstandig;
          keuzes.append(el("button", { class: "keuze", type: "button", "aria-pressed": String(actief),
            onclick: () => {
              w.zelfstandig = o.zelfstandig;
              w.woningtype = o.zelfstandig ? o.waarde : null;
              toonVraag();
            } }, el("span", {}, el("span", { class: "k-titel" }, o.label))));
        }
        bak.append(keuzes);
        if (!w.zelfstandig) {
          bak.append(el("div", { style: "margin-top:18px" },
            el("label", { for: "q-m2" }, "Hoe groot is je kamer ongeveer? (m²)"),
            el("input", { type: "number", id: "q-m2", inputmode: "decimal", value: w.oppervlakte_m2 || "" }),
            el("div", { class: "hulp" }, "Voor een kamer rekent de Huurcommissie met 25 m³ gas per m². Weet je het niet precies? Een ruwe schatting is prima.")));
        }
        return bak;
      },
      lees() {
        if (!dossier.woonruimte.zelfstandig && $("#q-m2")) {
          dossier.woonruimte.oppervlakte_m2 = Number($("#q-m2").value) || null;
        }
      },
      geldig() {
        const w = dossier.woonruimte;
        if (w.zelfstandig && !w.woningtype) return "Kies wat voor woning je huurt.";
        return null;
      },
    },
    {
      kop: "Hoe zit het gebouw in elkaar?",
      hulp: "Gedeelde kosten worden over de woningen verdeeld, dus het aantal woningen telt mee.",
      render() {
        const w = dossier.woonruimte;
        return el("div", {},
          el("label", { for: "q-bewoners" }, "Met hoeveel mensen woon je er?"),
          el("input", { type: "number", id: "q-bewoners", inputmode: "numeric", min: "1", max: "10",
            value: w.aantal_bewoners || "" }),
          el("div", { class: "hulp" }, "Bepaalt het normverbruik voor water en elektriciteit."),
          el("div", { style: "margin-top:18px" },
            el("label", { for: "q-complex" }, "Hoeveel woningen zitten er in het complex?"),
            el("input", { type: "number", id: "q-complex", inputmode: "numeric", min: "1",
              value: w.aantal_woonruimten_complex || "" }),
            el("div", { class: "hulp" }, "Weet je het niet? Laat leeg — dan meld ik het als openstaande vraag in plaats van te gokken.")));
      },
      lees() {
        dossier.woonruimte.aantal_bewoners = Number($("#q-bewoners").value) || null;
        dossier.woonruimte.aantal_woonruimten_complex = Number($("#q-complex").value) || null;
      },
      geldig() { return dossier.woonruimte.aantal_bewoners ? null : "Vul in met hoeveel mensen je er woont."; },
    },
    {
      kop: "Heeft je verhuurder facturen laten zien?",
      hulp: "Dit is het belangrijkste punt van de hele check. Wie zijn kosten niet onderbouwt, mag ze vaak niet rekenen.",
      render() {
        const nu = dossier._onderbouwing;
        const keuzes = el("div", { class: "keuzes" });
        const opties = [
          { w: "volledig", t: "Ja, facturen én een gespecificeerd overzicht", s: "Alles keurig uitgesplitst per post." },
          { w: "deels", t: "Alleen een totaalbedrag per post", s: "Wel een overzicht, maar geen onderliggende facturen." },
          { w: "geen", t: "Nee, ik heb niets gezien", s: "Alleen de afrekening zelf, zonder bewijsstukken." },
          { w: "onbekend", t: "Weet ik niet", s: "Dan zet ik dit als openstaande vraag neer." },
        ];
        for (const o of opties) {
          keuzes.append(el("button", { class: "keuze", type: "button", "aria-pressed": String(nu === o.w),
            onclick: () => { dossier._onderbouwing = o.w; toonVraag(); } },
            el("span", {}, el("span", { class: "k-titel" }, o.t), el("span", { class: "k-sub" }, o.s))));
        }
        return keuzes;
      },
      lees() {
        const keuze = dossier._onderbouwing;
        const bewijs = keuze === "volledig" ? ["facturen", "specificatieformulier"]
                     : keuze === "deels" ? ["specificatieformulier"] : [];
        for (const post of dossier.kostenposten) {
          if (!post._bewijsHandmatig) post.bewijs = bewijs.slice();
        }
      },
      geldig() { return dossier._onderbouwing ? null : "Kies een van de vier antwoorden."; },
    },
    {
      kop: "Wat heb je aan voorschot betaald?",
      hulp: "Optioneel. Hiermee laat ik zien of je geld terugkrijgt of moet bijbetalen.",
      render() {
        return el("div", {},
          el("label", { for: "q-voorschot" }, "Totaal betaald voorschot over dit jaar (€)"),
          el("input", { type: "number", id: "q-voorschot", inputmode: "decimal", step: "0.01",
            value: dossier.voorschot_in_rekening_gebracht || "" }),
          el("div", { class: "hulp" }, "Meestal je maandbedrag × 12. Weet je het niet? Laat het leeg."));
      },
      lees() { dossier.voorschot_in_rekening_gebracht = Number($("#q-voorschot").value) || null; },
      geldig() { return null; },
    },
  ];

  function startVragen() {
    vraagIndex = 0;
    toonVraag();
    toonScherm("vragen");
  }

  function toonVraag() {
    const v = VRAGEN[vraagIndex];
    const voortgang = $("#voortgang");
    voortgang.textContent = "";
    VRAGEN.forEach((_, i) => voortgang.append(el("span", { class: i <= vraagIndex ? "klaar" : "" })));
    $("#vraagteller").textContent = "Vraag " + (vraagIndex + 1) + " van " + VRAGEN.length;
    $("#vraagkop").textContent = v.kop;
    $("#vraaghulp").textContent = v.hulp;
    $("#vraaginhoud").textContent = "";
    $("#vraaginhoud").append(v.render());
    $("#vraag-volgende").textContent = vraagIndex === VRAGEN.length - 1 ? "Bekijk de uitkomst" : "Volgende";
    $("#vraag-vorige").hidden = vraagIndex === 0;
  }

  function volgendeVraag() {
    wisMeldingen();
    const v = VRAGEN[vraagIndex];
    v.lees();
    const fout = v.geldig();
    if (fout) return melding(fout, "fout");
    if (vraagIndex < VRAGEN.length - 1) { vraagIndex++; toonVraag(); window.scrollTo({ top: 0 }); }
    else bereken();
  }

  /* ----------------------------------------------------------- uitkomst */

  function bereken() {
    wisMeldingen();
    try {
      uitkomst = Kern.beoordeelDossier(dossier);
    } catch (fout) {
      return melding("Er ging iets mis bij het berekenen: " + fout.message, "fout");
    }
    rendUitkomst();
    toonScherm("uitkomst");
  }

  function besteRegel(b) {
    let beste = null;
    for (const id of b.regels) {
      const u = UITLEG[id];
      if (!u) continue;
      if (!beste || u.prioriteit > UITLEG[beste].prioriteit) beste = id;
    }
    return beste;
  }

  function rendUitkomst() {
    $("#voorbeeldstrook").hidden = !isVoorbeeld;
    const f = uitkomst.financieel;
    const rood = uitkomst.tellingen.ROOD, oranje = uitkomst.tellingen.ORANJE;

    // Kop: het antwoord op de vraag waarmee de huurder binnenkwam.
    let aanhef, bedrag, zin;
    if (f.potentiele_correctie > 0) {
      aanhef = "Je kunt mogelijk terugvragen";
      bedrag = euro(f.potentiele_correctie);
      zin = "Op " + rood + " " + (rood === 1 ? "post" : "posten") + " rekent je verhuurder meer dan volgens de regels mag.";
      if (oranje) zin += " Er zijn nog " + oranje + " " + (oranje === 1 ? "post" : "posten") +
        " waar informatie voor ontbreekt; samen " + euro(f.onbeoordeeld_bedrag) + ". Blijken die ook onterecht, dan loopt het op tot " + euro(f.bandbreedte_max) + ".";
    } else if (oranje) {
      aanhef = "Nog niet te zeggen";
      bedrag = euro(f.onbeoordeeld_bedrag);
      zin = "Ik vond geen harde fout, maar voor " + oranje + " " + (oranje === 1 ? "post" : "posten") +
        " ontbreekt informatie. Hieronder staat per post wat er nodig is.";
    } else {
      aanhef = "Je afrekening lijkt te kloppen";
      bedrag = euro(0);
      zin = "Alle beoordeelde posten passen binnen wat de Huurcommissie toestaat.";
    }

    const bak = $("#uitslag");
    bak.textContent = "";
    bak.append(el("div", { class: "aanhef" }, aanhef), el("div", { class: "bedrag" }, bedrag),
      el("p", { class: "zin" }, zin));

    // Samenvattingsrijen: elke status met een teken, een woord én een bedrag.
    const som = {}, aantal = {};
    for (const b of uitkomst.beoordelingen) {
      som[b.status] = (som[b.status] || 0) + b.bedrag_verhuurder;
      aantal[b.status] = (aantal[b.status] || 0) + 1;
    }
    const lijst = el("ul", { class: "samenvatting" });
    for (const status of VOLGORDE) {
      if (!aantal[status]) continue;
      lijst.append(el("li", {}, el("button", { type: "button", onclick: () => {
        const doel = document.getElementById("groep-" + status);
        if (doel) doel.scrollIntoView({ behavior: "smooth", block: "start" });
      } },
        el("span", { class: "vlag vlag-" + status, "aria-hidden": "true" }, VLAG[status]),
        el("span", { class: "tekst" },
          el("b", {}, STATUSTEKST[status].kop),
          el("span", {}, aantal[status] + " " + (aantal[status] === 1 ? "post" : "posten"))),
        el("span", { class: "geld" }, euro(som[status])),
        el("span", { class: "pijl", "aria-hidden": "true" }, "›"))));
    }
    if (f.voorschot_betaald !== undefined) {
      const saldo = f.saldo_volgens_model;
      lijst.append(el("li", {}, el("button", { type: "button", style: "cursor:default" },
        el("span", { class: "vlag vlag-BUITEN_BEVOEGDHEID", "aria-hidden": "true" }, "€"),
        el("span", { class: "tekst" }, el("b", {}, saldo >= 0 ? "Je krijgt mogelijk terug" : "Je moet mogelijk bijbetalen"),
          el("span", {}, "voorschot " + euro(f.voorschot_betaald) + " · verhuurder rekent af op " + euro(f.saldo_volgens_verhuurder))),
        el("span", { class: "geld" }, euro(Math.abs(saldo))))));
    }
    bak.append(lijst);

    rendWaarschuwingen();
    rendGroepen();

    const advies = uitkomst.blokkerend.length
      ? "Let op: zoals het er nu voorstaat neemt de Huurcommissie je verzoek niet in behandeling — zie de melding hierboven. Herstel dat eerst; de bezwaarbrief hieronder is daarvoor meestal de eerste stap."
      : f.potentiele_correctie > 0
        ? "Stuur je verhuurder eerst schriftelijk bezwaar. Dat is verplicht voordat je naar de Huurcommissie kunt, en het moet per kostenpost gemotiveerd zijn. De knop hieronder maakt die brief voor je."
        : oranje
          ? "Vraag de ontbrekende stukken op bij je verhuurder. Je hebt daar recht op: artikel 7:259 lid 4 BW geeft je inzage in de boeken en bescheiden achter de afrekening. De brief hieronder vraagt er gericht om."
          : "Er is geen aanleiding voor bezwaar gevonden. Twijfel je toch over een post, klap dan 'Waarom?' open om te zien hoe er is gerekend.";
    $("#advies").textContent = advies;
    $("#briefblok").hidden = true;
  }

  function rendWaarschuwingen() {
    const bak = $("#waarschuwingen");
    bak.textContent = "";
    if (uitkomst.blokkerend.length) {
      bak.append(el("div", { class: "melding fout" },
        el("b", {}, "Je verzoek is in deze vorm niet-ontvankelijk. "),
        uitkomst.blokkerend.map((r) => r.replace(/^ROOD - /, "")).join(" ")));
    }
    const jaarmelding = uitkomst.ontvankelijkheid.find((r) => r.startsWith("ORANJE") && r.includes("uiterste verzoekdatum"));
    if (jaarmelding) bak.append(el("div", { class: "melding letop" }, jaarmelding.replace(/^ORANJE - /, "")));
    const ok = uitkomst.ontvankelijkheid.find((r) => r.startsWith("OK"));
    if (ok && !uitkomst.blokkerend.length) {
      bak.append(el("div", { class: "melding ok" }, ok.replace(/^OK - /, "")));
    }
  }

  function rendGroepen() {
    const bak = $("#groepen");
    bak.textContent = "";
    for (const status of VOLGORDE) {
      const posten = uitkomst.beoordelingen
        .filter((b) => b.status === status)
        .sort((a, b) => (b.verschil || 0) - (a.verschil || 0));
      if (!posten.length) continue;
      bak.append(el("div", { class: "groepkop", id: "groep-" + status },
        el("h2", {}, STATUSTEKST[status].kop),
        el("span", { class: "telling" }, posten.length + " " + (posten.length === 1 ? "post" : "posten"))));
      bak.append(el("p", { class: "klein", style: "margin-top:-6px" }, STATUSTEKST[status].uitleg));
      for (const b of posten) bak.append(postKaart(b));
    }
  }

  function postKaart(b) {
    const regelId = besteRegel(b);
    const uitleg = regelId ? UITLEG[regelId] : null;
    const kaart = el("div", { class: "post " + b.status });

    let geld = "", geldklasse = "post-geld";
    if (b.status === "ROOD" && b.verschil > 0) { geld = euro(b.verschil) + " te veel"; geldklasse += " min"; }
    else if (b.status === "ORANJE") geld = euro(b.bedrag_verhuurder) + " onduidelijk";
    else if (b.status === "GROEN") geld = euro(b.bedrag_verhuurder);
    else geld = euro(b.bedrag_verhuurder);

    const hoofd = el("div", { class: "post-hoofd" },
      el("div", { class: "post-titel" }, el("h3", {}, b.omschrijving), el("span", { class: geldklasse }, geld)));

    if (uitleg) {
      hoofd.append(el("div", { class: "post-kop2" }, uitleg.kop));
      hoofd.append(el("div", { class: "post-uitleg" }, uitleg.uitleg));
    }

    if (b.status !== "BUITEN_BEVOEGDHEID" && b.bedrag_model !== null) {
      hoofd.append(el("div", { class: "post-cijfers" },
        el("span", {}, "Verhuurder rekent ", el("b", {}, euro(b.bedrag_verhuurder))),
        el("span", {}, (b.voorlopig ? "Voorlopig toegestaan " : "Toegestaan "), el("b", {}, euro(b.bedrag_model)))));
    }

    if (b.status === "ORANJE" && b.ontbrekende_informatie.length) {
      const vraagtekst = vereenvoudig(b.ontbrekende_informatie[0]);
      hoofd.append(el("div", { class: "post-uitleg", style: "margin-top:10px" },
        el("b", {}, "Wat er nog nodig is: "), vraagtekst));
      if (heeftVelden(b)) {
        hoofd.append(el("div", { class: "post-actie" },
          el("button", { class: "primair", type: "button", onclick: () => openBlad(b) }, "Beantwoord deze vraag")));
      }
    }
    kaart.append(hoofd);

    // De juridische onderbouwing blijft beschikbaar, maar staat de huurder niet in de weg.
    const inhoud = el("div", { class: "inhoud" });
    const dl = el("dl", { style: "margin:0" });
    if (b.berekening.length) { dl.append(el("dt", {}, "Zo is het gerekend")); for (const r of b.berekening) dl.append(el("dd", { class: "reken" }, r)); }
    if (b.toelichting.length) { dl.append(el("dt", {}, "Uit het beleidsboek")); for (const r of b.toelichting) dl.append(el("dd", {}, r)); }
    if (b.ontbrekende_informatie.length) { dl.append(el("dt", {}, "Wat ontbreekt")); for (const r of b.ontbrekende_informatie) dl.append(el("dd", {}, r)); }
    inhoud.append(dl);
    if (b.regels.length) {
      inhoud.append(el("div", { class: "regelcodes" }, b.regels.map((id) =>
        el("code", { title: REGELINFO[id] ? REGELINFO[id].onderwerp + " — " + REGELINFO[id].bron : id }, id))));
    }
    kaart.append(el("details", { class: "juridisch" }, el("summary", {}, "Waarom? Toon de regel en de berekening"), inhoud));
    return kaart;
  }

  // De engine schrijft voor juristen; hier staat de huurder. Haal de
  // paragraafverwijzing uit de lopende zin en houd de vraag zelf over.
  function vereenvoudig(tekst) {
    return tekst.replace(/\s*\((?:par\.|Beleidsboek|voetnoot|art\.)[^)]*\)\s*/gi, " ")
                .replace(/\s*\(p\.\s*\d+[^)]*\)\s*/gi, " ")
                .replace(/\s{2,}/g, " ").trim();
  }

  const heeftVelden = (b) => {
    const def = D.categorieen.categorieen[b.categorie];
    return !!(def && def.velden.length);
  };

  /* --------------------------------------------------------------- blad */

  let veldTeller = 0;
  function veld(def, waarde, opslaan) {
    const id = "bv" + (++veldTeller);
    if (def.type === "ja_nee") {
      return el("div", { style: "margin-top:16px" },
        el("label", { for: id, style: "display:flex;gap:10px;align-items:flex-start;font-weight:500;color:var(--ink)" },
          el("input", { type: "checkbox", id, checked: waarde === true, style: "width:22px;height:22px;margin-top:2px;flex:none",
            onchange: (e) => opslaan(e.target.checked) }), def.label),
        def.hulp ? el("div", { class: "hulp" }, def.hulp) : null);
    }
    let invoer;
    if (def.type === "ja_nee_onbekend") {
      invoer = el("select", { id, onchange: (e) => opslaan(e.target.value === "" ? null : e.target.value === "ja") },
        el("option", { value: "", selected: waarde === null || waarde === undefined }, "Weet ik niet"),
        el("option", { value: "ja", selected: waarde === true }, "Ja"),
        el("option", { value: "nee", selected: waarde === false }, "Nee"));
    } else if (def.type === "keuze") {
      invoer = el("select", { id, onchange: (e) => opslaan(e.target.value || null) },
        el("option", { value: "" }, "— kies —"),
        def.opties.map((o) => {
          const w = typeof o === "string" ? o : o.waarde;
          const t = typeof o === "string" ? o : o.label;
          return el("option", { value: w, selected: String(waarde) === String(w) }, t);
        }));
    } else if (def.type === "meerkeuze") {
      const gekozen = new Set(Array.isArray(waarde) ? waarde : []);
      return el("div", { style: "margin-top:16px" }, el("label", {}, def.label),
        el("div", {}, def.opties.map((o) => el("label", { style: "display:flex;gap:10px;align-items:flex-start;font-weight:400;color:var(--ink);margin-bottom:8px" },
          el("input", { type: "checkbox", checked: gekozen.has(o), style: "width:22px;height:22px;margin-top:2px;flex:none",
            onchange: (e) => { if (e.target.checked) gekozen.add(o); else gekozen.delete(o); opslaan([...gekozen]); } }), o))));
    } else {
      const type = def.type === "datum" ? "date" : ["getal", "geheel", "bedrag"].includes(def.type) ? "number" : "text";
      invoer = el("input", { type, id, inputmode: type === "number" ? "decimal" : null,
        step: def.type === "bedrag" ? "0.01" : def.type === "geheel" ? "1" : "any",
        value: waarde === null || waarde === undefined ? "" : waarde,
        onchange: (e) => {
          const r = e.target.value;
          if (r === "") return opslaan(null);
          opslaan(def.type === "geheel" ? parseInt(r, 10) : Number(r));
        } });
    }
    return el("div", { style: "margin-top:16px" }, el("label", { for: id }, def.label), invoer,
      def.hulp ? el("div", { class: "hulp" }, def.hulp) : null);
  }

  function openBlad(b) {
    const post = dossier.kostenposten.find((p) => p.id === b.kostenpost_id);
    if (!post) return;
    const def = D.categorieen.categorieen[post.categorie];
    const blad = el("div", { class: "blad" },
      el("h2", {}, post.omschrijving),
      el("p", { class: "klein" }, "Beantwoord wat je weet. Wat je openlaat, blijft een openstaande vraag — ik vul niets in wat ik niet weet."));

    for (const d of def.velden) {
      blad.append(veld(d, post.parameters[d.naam] !== undefined ? post.parameters[d.naam] : d.standaard,
        (v) => { post.parameters[d.naam] = v; }));
    }
    blad.append(el("div", { style: "margin-top:18px" },
      el("label", {}, "Wat heeft je verhuurder voor deze post laten zien?"),
      el("div", {}, D.categorieen.bewijsopties.slice(0, 4).map((o) =>
        el("label", { style: "display:flex;gap:10px;align-items:center;font-weight:400;color:var(--ink);margin-bottom:8px" },
          el("input", { type: "checkbox", checked: post.bewijs.includes(o.waarde), style: "width:22px;height:22px;flex:none",
            onchange: (e) => {
              const set = new Set(post.bewijs);
              if (e.target.checked) set.add(o.waarde); else set.delete(o.waarde);
              post.bewijs = [...set];
              post._bewijsHandmatig = true;
            } }), o.label)))));

    const achter = el("div", { class: "blad-achter", onclick: (e) => { if (e.target === achter) achter.remove(); } }, blad);
    blad.append(el("div", { class: "knoppen" },
      el("button", { class: "primair groot", type: "button", onclick: () => { achter.remove(); bereken(); } }, "Opslaan en opnieuw berekenen"),
      el("button", { class: "tekst", type: "button", onclick: () => achter.remove() }, "Annuleren")));
    document.body.append(achter);
    blad.scrollTop = 0;
  }

  /* ------------------------------------------------------------- brieven */

  const eu = (w) => "EUR " + Number(w).toFixed(2).replace(".", ",");
  const nl = (d) => d.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });

  function bezwaarbrief() {
    const nu = new Date(), over3w = new Date(Date.now() + 21 * 864e5);
    const rood = uitkomst.beoordelingen.filter((b) => b.status === "ROOD" && (b.verschil || 0) > 0);
    const oranje = uitkomst.beoordelingen.filter((b) => b.status === "ORANJE");
    const r = ["[Uw naam]", "[Uw adres]", "[Postcode en woonplaats]", "", "Aan: [naam verhuurder]",
      "[adres verhuurder]", "", "Datum: " + nl(nu),
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
        r.push("   Volgens het beleidsboek kom ik uit op " + eu(b.bedrag_model) + ". Ik verzoek u dit te " +
          "corrigeren met " + eu(b.verschil) + ".", "");
      });
      r.push("Het totaal van de door mij betwiste correcties bedraagt " + eu(uitkomst.financieel.potentiele_correctie) + ".", "");
    }
    if (oranje.length) {
      r.push((rood.length ? "2" : "1") + ". Posten waarvoor ik aanvullende informatie nodig heb", "",
        "Op grond van artikel 7:259 lid 4 BW heb ik recht op inzage in de boeken en andere bescheiden die " +
        "aan de afrekening ten grondslag liggen. Voor de volgende posten verzoek ik u die stukken te verstrekken:", "");
      for (const b of oranje) {
        r.push("- " + b.omschrijving + " (" + eu(b.bedrag_verhuurder) + "):");
        for (const t of b.ontbrekende_informatie) r.push("  " + t);
      }
      r.push("");
    }
    r.push("Ik verzoek u binnen drie weken, dus uiterlijk " + nl(over3w) + ", op dit bezwaar te reageren en " +
      "de afrekening zo nodig aan te passen. Ontvang ik binnen die termijn geen reactie, of neemt uw reactie " +
      "mijn bezwaren niet weg, dan leg ik het geschil voor aan de Huurcommissie.", "", "Met vriendelijke groet,",
      "", "[Uw naam]", "", "---",
      "Concept, gemaakt op basis van het Beleidsboek Servicekosten (versie 1 juli 2026). Controleer de " +
      "gegevens tussen [ ] en de inhoud voordat u verstuurt. Dit is geen juridisch advies.");
    return r.join("\n");
  }

  function opvraagbrief(jaar) {
    const nu = new Date(), over3w = new Date(Date.now() + 21 * 864e5);
    return ["[Uw naam]", "[Uw adres]", "[Postcode en woonplaats]", "", "Aan: [naam verhuurder]",
      "[adres verhuurder]", "", "Datum: " + nl(nu), "Betreft: verzoek om de afrekening servicekosten " + jaar,
      "", "Geachte heer/mevrouw,", "",
      "Op grond van artikel 7:259 lid 2 BW bent u verplicht mij uiterlijk zes maanden na afloop van het " +
      "kalenderjaar een naar soort uitgesplitst overzicht te verstrekken van de in dat jaar in rekening " +
      "gebrachte kosten voor nutsvoorzieningen en servicekosten, met vermelding van de wijze van berekening. " +
      "Voor het jaar " + jaar + " was die termijn uiterlijk 30 juni " + (jaar + 1) + ".", "",
      "Ik heb deze afrekening niet ontvangen. Hierbij verzoek ik u die alsnog te verstrekken, uiterlijk " +
      "binnen drie weken, dus vóór " + nl(over3w) + ".", "",
      "Ontvang ik de afrekening niet binnen die termijn, dan leg ik de vaststelling van mijn " +
      "betalingsverplichting voor aan de Huurcommissie (artikel 7:260 BW).", "", "Met vriendelijke groet,",
      "", "[Uw naam]", "", "---",
      "Concept op basis van het Beleidsboek Servicekosten (versie 1 juli 2026), paragraaf 6.3.2. Dit is geen " +
      "juridisch advies."].join("\n");
  }

  function toonBrief(tekst) {
    $("#briefblok").hidden = false;
    $("#brief").value = tekst;
    $("#brief").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /* --------------------------------------------------------------- start */

  function voorbeeld() {
    wisMeldingen();
    isVoorbeeld = true;
    leesTekst(D.voorbeeld, "voorbeeld");
    wisMeldingen();
    dossier.woonruimte.woningtype = "flatwoning_appartement";
    dossier.woonruimte.aantal_bewoners = 2;
    dossier.woonruimte.aantal_woonruimten_complex = 48;
    dossier._onderbouwing = "volledig";
    for (const post of dossier.kostenposten) post.bewijs = ["facturen", "specificatieformulier"];
    dossier.procedure = { contract_gesloten_op: "2022-03-01", sector: "sociaal",
      afrekening_ontvangen: true, bezwaar_gemaakt: true };
    bereken();
  }

  function init() {
    $("#begin").addEventListener("click", () => { wisMeldingen(); isVoorbeeld = false; toonScherm("invoer"); });
    $("#toon-voorbeeld").addEventListener("click", voorbeeld);
    $("#voorbeeld-stop").addEventListener("click", () => { wisMeldingen(); isVoorbeeld = false; dossier = leegDossier(); toonScherm("invoer"); });
    $("#invoer-terug").addEventListener("click", () => toonScherm("home"));
    $("#opnieuw").addEventListener("click", () => { wisMeldingen(); isVoorbeeld = false; dossier = leegDossier(); uitkomst = null; toonScherm("home"); });
    $("#begin-opnieuw").addEventListener("click", () => { wisMeldingen(); isVoorbeeld = false; dossier = leegDossier(); uitkomst = null; toonScherm("invoer"); });

    $("#kies-bestand").addEventListener("click", () => $("#bestand").click());
    $("#bestand").addEventListener("change", (e) => e.target.files[0] && leesBestand(e.target.files[0]));
    $("#kies-plakken").addEventListener("click", () => { $("#plakblok").hidden = false; $("#plakvak").focus(); });
    $("#plak-lezen").addEventListener("click", () => {
      wisMeldingen();
      const tekst = $("#plakvak").value;
      if (tekst.trim().length < 20) return melding("Plak eerst de tekst van je afrekening.", "fout");
      if (leesTekst(tekst, "geplakte tekst")) startVragen();
    });
    $("#kies-handmatig").addEventListener("click", () => {
      wisMeldingen();
      dossier = leegDossier();
      dossier.periode.jaar = Number(D.jaren[D.jaren.length - 1]);
      dossier.kostenposten = [];
      startVragen();
      melding("Je kunt de posten straks bij de uitkomst toevoegen via 'Antwoorden aanpassen'. Handiger is " +
        "meestal: ga terug en plak de tekst van je afrekening.", "info");
    });

    $("#vraag-volgende").addEventListener("click", volgendeVraag);
    $("#vraag-vorige").addEventListener("click", () => { wisMeldingen(); if (vraagIndex > 0) { vraagIndex--; toonVraag(); } });
    $("#pas-aan").addEventListener("click", () => { vraagIndex = 0; toonVraag(); toonScherm("vragen"); });
    $("#maak-brief").addEventListener("click", () => toonBrief(bezwaarbrief()));
    $("#opvraagbrief").addEventListener("click", () => toonBrief(opvraagbrief(dossier.periode.jaar || uitkomst.jaar)));
    $("#kopieer").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText($("#brief").value); melding("De brief staat op je klembord.", "ok"); }
      catch { $("#brief").select(); melding("Kopiëren lukte niet automatisch — de tekst is geselecteerd, gebruik Ctrl/Cmd+C.", "letop"); }
    });
    $("#thema").addEventListener("click", () => {
      const nu = document.documentElement.getAttribute("data-theme");
      const donker = nu === "dark" || (nu !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.setAttribute("data-theme", donker ? "light" : "dark");
    });

    toonScherm("home");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
