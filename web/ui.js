/* Interface van de browserversie. Roept Kern en Parser rechtstreeks aan; er is
   geen server. Opent op het resultaat van een voorbeeldafrekening, zodat
   meteen zichtbaar is wat de applicatie doet. */

(function () {
  "use strict";

  const STATUS = {
    GROEN:  { glyph: "✓", label: "Lijkt correct",          kleur: "var(--st-groen)" },
    ORANJE: { glyph: "?", label: "Onvoldoende informatie", kleur: "var(--st-oranje)" },
    ROOD:   { glyph: "!", label: "Mogelijk onterecht",     kleur: "var(--st-rood)" },
    BUITEN_BEVOEGDHEID: { glyph: "–", label: "Buiten bevoegdheid", kleur: "var(--st-buiten)" },
  };
  const MAANDEN = ["januari","februari","maart","april","mei","juni","juli","augustus",
                   "september","oktober","november","december"];

  const DATA = window.SERVICEKOSTEN_DATA;
  Kern.init({ normen: DATA.normen });
  Parser.init({ classificatie: DATA.classificatie });

  const REGELINDEX = {};
  for (const r of DATA.beslisregels.regels) REGELINDEX[r.id] = r;

  let dossier = leegDossier();
  let uitkomst = null;
  let isVoorbeeld = false;

  /* ---------------------------------------------------------- hulpjes */
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
  function melding(tekst, soort) {
    const n = el("div", { class: "melding " + (soort || "info") }, tekst);
    $("#meldingen").append(n);
    if (soort === "ok" || soort === "info") setTimeout(() => n.remove(), 8000);
  }
  const wisMeldingen = () => { $("#meldingen").textContent = ""; };

  function leegDossier() {
    return {
      woonruimte: { zelfstandig: true, aantal_woonruimten_op_aansluiting: 1, gebruikt_gemeenschappelijke_ruimten: true },
      periode: { jaar: null, maand_van: 1, maand_tot_en_met: 12 },
      procedure: {}, voorschot_in_rekening_gebracht: null, overeengekomen_maximum: null,
      kostenposten: [], _overeengekomen_standaard: null,
    };
  }

  /* -------------------------------------------------------- veldbouwer */
  let veldTeller = 0;
  function veld(def, waarde, opslaan) {
    const id = "v" + (++veldTeller);
    if (def.type === "ja_nee") {
      return el("div", {},
        el("div", { class: "checkrij" },
          el("label", { for: id },
            el("input", { type: "checkbox", id, checked: waarde === true,
              onchange: (e) => opslaan(e.target.checked) }), def.label)),
        def.hulp ? el("div", { class: "hulp" }, def.hulp) : null);
    }
    let invoer;
    if (def.type === "ja_nee_onbekend") {
      invoer = el("select", { id, onchange: (e) => opslaan(e.target.value === "" ? null : e.target.value === "ja") },
        el("option", { value: "", selected: waarde === null || waarde === undefined }, "Onbekend / weet ik niet"),
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
      return el("div", {}, el("label", {}, def.label),
        el("div", { class: "checkrij", style: "flex-direction:column;gap:5px" },
          def.opties.map((o) => el("label", {},
            el("input", { type: "checkbox", checked: gekozen.has(o), onchange: (e) => {
              if (e.target.checked) gekozen.add(o); else gekozen.delete(o);
              opslaan([...gekozen]);
            } }), o))),
        def.hulp ? el("div", { class: "hulp" }, def.hulp) : null);
    } else {
      const type = def.type === "datum" ? "date"
        : ["getal", "geheel", "bedrag"].includes(def.type) ? "number" : "text";
      invoer = el("input", { type, id,
        step: def.type === "bedrag" ? "0.01" : def.type === "geheel" ? "1" : "any",
        value: waarde === null || waarde === undefined ? "" : waarde,
        onchange: (e) => {
          const r = e.target.value;
          if (r === "") return opslaan(null);
          opslaan(def.type === "geheel" ? parseInt(r, 10) : Number(r));
        } });
    }
    return el("div", {}, el("label", { for: id }, def.label), invoer,
      def.hulp ? el("div", { class: "hulp" }, def.hulp) : null);
  }

  /* ------------------------------------------------------------ inlezen */

  function vulUitConcept(concept, naam, voorbeeld) {
    dossier = leegDossier();
    isVoorbeeld = !!voorbeeld;
    dossier.periode.jaar = concept.jaar;
    dossier.periode.maand_van = concept.maand_van;
    dossier.periode.maand_tot_en_met = concept.maand_tot_en_met;
    dossier.voorschot_in_rekening_gebracht = concept.voorschot;
    if (concept.aantal_woonruimten) dossier.woonruimte.aantal_woonruimten_complex = concept.aantal_woonruimten;
    dossier.kostenposten = concept.posten.map((p, i) => ({
      id: "P" + (i + 1), categorie: p.categorie, omschrijving: p.omschrijving,
      bedrag_verhuurder: p.bedrag, overeengekomen: null, bewijs: [],
      levering_gemotiveerd_betwist: false, parameters: {},
      _alt: p.alternatieve_bedragen, _vraag: p.vraag, _zekerheid: p.zekerheid,
    }));
    for (const post of dossier.kostenposten) {
      if (post.categorie && /^NUT-.*-METER$/.test(post.categorie)) {
        if (concept.meterstanden.beginstand) post.parameters.beginstand = concept.meterstanden.beginstand;
        if (concept.meterstanden.eindstand) post.parameters.eindstand = concept.meterstanden.eindstand;
      }
    }
    if (!voorbeeld) {
      for (const w of concept.waarschuwingen) melding(w, "letop");
      melding(concept.posten.length + " kostenposten ingelezen uit " + naam + ". Controleer ze voordat u beoordeelt.", "ok");
    }
  }

  function leesTekst(tekst, naam, voorbeeld) {
    const concept = Parser.parseAfrekening(tekst, { bestandsnaam: naam });
    vulUitConcept(concept, naam, voorbeeld);
    rendControle();
    toonStap(voorbeeld ? "resultaat" : "controle");
  }

  async function leesBestand(file) {
    wisMeldingen();
    const naam = file.name || "bestand";
    const ext = (naam.split(".").pop() || "").toLowerCase();
    try {
      if (ext === "pdf") {
        const tekst = await pdfNaarTekst(await file.arrayBuffer());
        if (tekst.trim().length < 40) {
          throw new Error("Uit deze PDF komt geen tekst. Waarschijnlijk is het een scan of foto. " +
            "Plak de tekst hieronder, of voer de posten handmatig in.");
        }
        leesTekst(tekst, naam, false);
      } else if (["csv", "tsv"].includes(ext)) {
        leesTekst(Parser.csvNaarTekst(await file.text()), naam, false);
      } else if (["txt", "md", ""].includes(ext)) {
        leesTekst(await file.text(), naam, false);
      } else {
        throw new Error("Bestandstype ." + ext + " wordt niet ondersteund. Gebruik PDF, CSV of een tekstbestand, " +
          "of plak de tekst van uw afrekening.");
      }
    } catch (fout) {
      melding(fout.message, "fout");
      toonStap("start");
    }
  }

  async function pdfNaarTekst(buffer) {
    if (!window.pdfjsLib) {
      throw new Error("De PDF-lezer kon niet worden geladen. Plak de tekst van uw afrekening hieronder, " +
        "of voer de posten handmatig in.");
    }
    const doc = await window.pdfjsLib.getDocument({ data: buffer }).promise;
    const paginas = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const pagina = await doc.getPage(i);
      const inhoud = await pagina.getTextContent();
      // Tekstfragmenten met dezelfde y-positie horen bij dezelfde regel.
      const regels = new Map();
      for (const item of inhoud.items) {
        if (!item.str) continue;
        const y = Math.round(item.transform[5]);
        if (!regels.has(y)) regels.set(y, []);
        regels.get(y).push({ x: item.transform[4], tekst: item.str });
      }
      const geordend = [...regels.entries()].sort((a, b) => b[0] - a[0])
        .map(([, delen]) => delen.sort((a, b) => a.x - b.x).map((d) => d.tekst).join(" "));
      paginas.push(geordend.join("\n"));
    }
    return paginas.join("\n");
  }

  /* ----------------------------------------------------------- stap 2 */

  function rendControle() { rendWoning(); rendProcedure(); rendPosten(); }

  function rendWoning() {
    const w = dossier.woonruimte, p = dossier.periode;
    const zet = (naam) => (v) => { w[naam] = v; };
    const bak = $("#woningvelden");
    bak.textContent = "";
    bak.append(
      veld({ label: "Boekjaar", type: "geheel", hulp: "Normbedragen beschikbaar voor " + DATA.jaren.join(", ") + "." },
        p.jaar, (v) => { p.jaar = v; rendProcedure(); }),
      veld({ label: "Eerste maand van uw huurperiode", type: "keuze",
        opties: MAANDEN.map((m, i) => ({ waarde: i + 1, label: m })) },
        p.maand_van, (v) => { p.maand_van = parseInt(v, 10) || 1; }),
      veld({ label: "Laatste maand van uw huurperiode", type: "keuze",
        opties: MAANDEN.map((m, i) => ({ waarde: i + 1, label: m })),
        hulp: "Korter dan twaalf maanden? Dan rekent het model met graaddagen (gas), seizoenspatronen (elektriciteit) of evenredig (water)." },
        p.maand_tot_en_met, (v) => { p.maand_tot_en_met = parseInt(v, 10) || 12; }),
      veld({ label: "Soort woonruimte", type: "keuze",
        opties: [{ waarde: "ja", label: "Zelfstandig (eigen voordeur, keuken en toilet)" },
                 { waarde: "nee", label: "Onzelfstandig (kamer)" }] },
        w.zelfstandig ? "ja" : "nee", (v) => { w.zelfstandig = v === "ja"; rendWoning(); }),
      w.zelfstandig
        ? veld({ label: "Type woning", type: "keuze", opties: DATA.woningtypen,
            hulp: "Bepaalt de Nibud-gasnorm (Tabel 1, p. 13)." }, w.woningtype, zet("woningtype"))
        : veld({ label: "Oppervlakte van uw kamer (m²)", type: "getal",
            hulp: "Norm onzelfstandig: 25 m³ gas per m² (p. 14)." }, w.oppervlakte_m2, zet("oppervlakte_m2")),
      veld({ label: "Aantal bewoners", type: "geheel",
        hulp: "Bepaalt de normen voor elektriciteit en water (tot en met vijf bewoners)." },
        w.aantal_bewoners, zet("aantal_bewoners")),
      w.zelfstandig ? veld({ label: "Oppervlakte woning (m²)", type: "getal",
        hulp: "Nodig voor de verdeelsleutel gas zonder eigen meter." }, w.oppervlakte_m2, zet("oppervlakte_m2")) : null,
      veld({ label: "Woonruimten op dezelfde aansluiting", type: "geheel",
        hulp: "Vastrecht en belastingteruggave worden hierover gelijk verdeeld." },
        w.aantal_woonruimten_op_aansluiting, zet("aantal_woonruimten_op_aansluiting")),
      veld({ label: "Woonruimten in het complex", type: "geheel",
        hulp: "Noemer van de verdeelsleutels (p. 26-27, p. 29)." },
        w.aantal_woonruimten_complex, zet("aantal_woonruimten_complex")),
      veld({ label: "Totale oppervlakte complex (m²)", type: "getal" },
        w.totale_oppervlakte_complex_m2, zet("totale_oppervlakte_complex_m2")),
      veld({ label: "Betaald voorschot over dit jaar", type: "bedrag" },
        dossier.voorschot_in_rekening_gebracht, (v) => { dossier.voorschot_in_rekening_gebracht = v; }),
      veld({ label: "Overeengekomen vast bedrag servicekosten", type: "bedrag",
        hulp: "Is dit afgesproken, dan is de verhuurder eraan gebonden (voetnoot 4, p. 11)." },
        dossier.overeengekomen_maximum, (v) => { dossier.overeengekomen_maximum = v; }),
      veld({ label: "Ik maak gebruik van de gemeenschappelijke ruimten (of kan dat)", type: "ja_nee",
        hulp: "Zo niet, dan hoeft u daar niet voor te betalen (p. 29)." },
        w.gebruikt_gemeenschappelijke_ruimten, zet("gebruikt_gemeenschappelijke_ruimten")));
  }

  function rendProcedure() {
    const pr = dossier.procedure;
    const zet = (n) => (v) => { pr[n] = v; };
    const bak = $("#procedurevelden");
    bak.textContent = "";
    const termijn = DATA.termijnen[String(dossier.periode.jaar)];
    bak.append(
      veld({ label: "Staat in uw huurcontract dat u servicekosten betaalt?", type: "ja_nee_onbekend",
        hulp: "Dit mag ook stilzwijgend zijn overeengekomen (p. 9). Geldt als standaard voor alle posten; per post kunt u afwijken." },
        dossier._overeengekomen_standaard, (v) => {
          dossier._overeengekomen_standaard = v;
          for (const post of dossier.kostenposten) if (!post._handmatig) post.overeengekomen = v;
          rendPosten();
        }),
      veld({ label: "Datum huurovereenkomst", type: "datum",
        hulp: "Vóór of vanaf 1 juli 2024 bepaalt of de Huurcommissie uitspraak doet of alleen adviseert." },
        pr.contract_gesloten_op, zet("contract_gesloten_op")),
      veld({ label: "Sector", type: "keuze", opties: [
        { waarde: "sociaal", label: "Sociale sector" }, { waarde: "middenhuur", label: "Middenhuur" },
        { waarde: "vrij", label: "Vrije sector" }] }, pr.sector, zet("sector")),
      veld({ label: "Heeft u een afrekening ontvangen?", type: "ja_nee_onbekend" },
        pr.afrekening_ontvangen, zet("afrekening_ontvangen")),
      veld({ label: "Heeft u schriftelijk bezwaar gemaakt?", type: "ja_nee_onbekend",
        hulp: "Verplicht vóór een verzoek bij de Huurcommissie (par. 6.3.1, p. 56)." },
        pr.bezwaar_gemaakt, zet("bezwaar_gemaakt")),
      veld({ label: "Heeft u de afrekening schriftelijk opgevraagd?", type: "ja_nee_onbekend",
        hulp: "Verplicht als u géén afrekening kreeg (par. 6.3.2, p. 57)." },
        pr.afrekening_opgevraagd, zet("afrekening_opgevraagd")),
      veld({ label: "Beoogde datum van uw verzoek", type: "datum",
        hulp: termijn ? "Uiterste verzoekdatum voor " + dossier.periode.jaar + ": " + termijn.uiterste_verzoekdatum + "."
                      : "Uiterlijk tweeëneenhalf jaar na afloop van het kalenderjaar." },
        pr.verzoekdatum, zet("verzoekdatum")));
  }

  function categorieGroepen() {
    const groepen = {};
    for (const [code, def] of Object.entries(DATA.categorieen.categorieen)) {
      (groepen[def.groep] = groepen[def.groep] || []).push([code, def.label]);
    }
    return groepen;
  }

  function rendPosten() {
    const bak = $("#posten");
    bak.textContent = "";
    if (!dossier.kostenposten.length) bak.append(el("p", { class: "klein" }, "Nog geen posten. Voeg ze hieronder toe."));
    dossier.kostenposten.forEach((post, i) => bak.append(postKaart(post, i)));
    $("#postenaantal").textContent = dossier.kostenposten.length + " post(en)";
  }

  function postKaart(post, index) {
    const groepen = categorieGroepen();
    const keuze = el("select", { onchange: (e) => { post.categorie = e.target.value || null; rendPosten(); } },
      el("option", { value: "" }, "— niet geclassificeerd —"),
      Object.entries(groepen).map(([groep, items]) => el("optgroup", { label: groep },
        items.map(([code, label]) => el("option", { value: code, selected: post.categorie === code }, label + " (" + code + ")")))));

    const kop = el("div", { class: "post-kop" },
      el("div", {}, el("label", {}, "Omschrijving op de afrekening"),
        el("input", { type: "text", value: post.omschrijving, onchange: (e) => { post.omschrijving = e.target.value; } })),
      el("div", {}, el("label", {}, "Categorie"), keuze),
      el("div", {}, el("label", {}, "Uw aandeel"),
        el("input", { type: "number", step: "0.01", value: post.bedrag_verhuurder,
          onchange: (e) => { post.bedrag_verhuurder = Number(e.target.value); } })),
      el("button", { class: "stil", title: "Post verwijderen", "aria-label": "Post verwijderen",
        onclick: () => { dossier.kostenposten.splice(index, 1); rendPosten(); } }, "✕"));

    const def = post.categorie ? DATA.categorieen.categorieen[post.categorie] : null;
    const body = el("div", { class: "post-body" });

    if (post._alt && post._alt.length) {
      body.append(el("div", { class: "hulp" }, "Op deze regel stonden meer bedragen. Kies welk bedrag uw aandeel is:"),
        el("div", { class: "alt" }, [post.bedrag_verhuurder, ...post._alt].map((b) =>
          el("button", { type: "button", "aria-pressed": String(Number(b) === Number(post.bedrag_verhuurder)),
            onclick: () => { post.bedrag_verhuurder = Number(b); rendPosten(); } }, euro(b)))));
    }
    if (!post.categorie) {
      body.append(el("div", { class: "vraag" },
        "Niet automatisch geclassificeerd. Kies zelf een categorie — het Besluit servicekosten is niet limitatief (p. 29, p. 75)."));
    } else if (post._vraag) {
      body.append(el("div", { class: "vraag" }, post._vraag));
    }

    const rooster = el("div", { class: "rooster" });
    for (const d of DATA.categorieen.algemene_velden) {
      rooster.append(veld(d, post[d.naam], (v) => {
        post[d.naam] = v;
        if (d.naam === "overeengekomen") post._handmatig = true;
      }));
    }
    if (def) for (const d of def.velden) {
      rooster.append(veld(d, post.parameters[d.naam] !== undefined ? post.parameters[d.naam] : d.standaard,
        (v) => { post.parameters[d.naam] = v; }));
    }
    body.append(rooster);

    body.append(el("div", { style: "margin-top:14px" },
      el("label", {}, "Welke bewijsstukken heeft de verhuurder aangeleverd?"),
      el("div", { class: "checkrij" }, DATA.categorieen.bewijsopties.map((o) => el("label", {},
        el("input", { type: "checkbox", checked: post.bewijs.includes(o.waarde), onchange: (e) => {
          const set = new Set(post.bewijs);
          if (e.target.checked) set.add(o.waarde); else set.delete(o.waarde);
          post.bewijs = [...set];
        } }), o.label))),
      el("div", { class: "hulp" }, "Een grootboekkaart of overzicht van facturen is uitdrukkelijk niet voldoende (p. 59).")));

    return el("div", { class: "post" }, kop,
      el("details", {}, el("summary", {}, def ? "Vervolgvragen — " + def.label + " · " + def.bron : "Vervolgvragen"), body));
  }

  /* ----------------------------------------------------------- stap 3 */

  function beoordeel() {
    wisMeldingen();
    if (!dossier.periode.jaar) return melding("Vul eerst het boekjaar in.", "fout");
    const zonder = dossier.kostenposten.filter((p) => !p.categorie);
    if (zonder.length) {
      return melding(zonder.length + " post(en) hebben nog geen categorie. Kies die eerst — het model wijst een onbekende post nooit zelf af.", "fout");
    }
    try {
      uitkomst = Kern.beoordeelDossier(dossier);
    } catch (fout) {
      return melding("De beoordeling is mislukt: " + fout.message, "fout");
    }
    rendResultaat();
    toonStap("resultaat");
  }

  const badge = (status) => el("span", { class: "status status-" + status },
    el("span", { "aria-hidden": "true" }, STATUS[status].glyph), STATUS[status].label);

  function rendResultaat() {
    $("#voorbeeldbalk").hidden = !isVoorbeeld;
    rendVerdict();
    rendOntvankelijkheid();
    rendBevindingen();
    rendVragen();
    rendSterkte();
    $("#brief").hidden = true;
    $("#briefacties").hidden = true;
  }

  function rendVerdict() {
    const f = uitkomst.financieel;
    const bak = $("#verdict");
    bak.textContent = "";
    const band = f.bandbreedte_min !== f.bandbreedte_max;
    const rood = uitkomst.tellingen.ROOD, oranje = uitkomst.tellingen.ORANJE;

    let onder;
    if (f.potentiele_correctie > 0 && band) {
      onder = `Op ${rood} post(en) wijkt de afrekening af van het beleidsboek. Daarnaast is voor ` +
        `${euro(f.onbeoordeeld_bedrag)} nog niet te beoordelen: als die posten óók onterecht blijken, ` +
        `loopt het verschil op tot ${euro(f.bandbreedte_max)}.`;
    } else if (f.potentiele_correctie > 0) {
      onder = `Op ${rood} van de ${uitkomst.sterkte.posten_totaal} beoordeelde posten wijkt de afrekening af van het beleidsboek. Alle posten konden worden beoordeeld.`;
    } else if (oranje) {
      onder = `Geen harde afwijking gevonden, maar voor ${euro(f.onbeoordeeld_bedrag)} ontbreekt informatie. ` +
        "Onderaan staat wat u daarvoor moet opvragen.";
    } else {
      onder = "Alle beoordeelde posten passen binnen wat het beleidsboek toestaat.";
    }

    bak.append(
      el("div", { class: "label" }, "Potentiële correctie, boekjaar " + uitkomst.jaar),
      el("div", { class: "hero" }, euro(f.potentiele_correctie)),
      el("div", { class: "onder" }, onder));

    // Verdeelbalk: waar staat de afrekening?
    const som = {};
    for (const b of uitkomst.beoordelingen) som[b.status] = (som[b.status] || 0) + b.bedrag_verhuurder;
    const totaal = Object.values(som).reduce((a, b) => a + b, 0);
    if (totaal > 0) {
      const volgorde = ["ROOD", "ORANJE", "GROEN", "BUITEN_BEVOEGDHEID"].filter((s) => som[s] > 0);
      const balk = el("div", { class: "balk", role: "img",
        "aria-label": "Verdeling van de afrekening naar status. " +
          volgorde.map((s) => `${STATUS[s].label}: ${euro(som[s])}`).join("; ") + "." });
      for (const s of volgorde) {
        const aandeel = som[s] / totaal;
        const seg = el("div", { class: "seg", style: `flex:${aandeel} 1 0;background:${STATUS[s].kleur}`,
          title: `${STATUS[s].label}: ${euro(som[s])}` },
          aandeel > 0.13 ? el("span", {}, STATUS[s].glyph + " " + euro(som[s])) : null);
        // Tweede kanaal naast kleur: rood en groen zijn voor deuteranopie niet
        // aan de kleur te onderscheiden (CVD dE 4,1).
        seg.prepend(el("span", { "aria-hidden": "true",
          style: `position:absolute;inset:0;opacity:.9;background-image:url("data:image/svg+xml;utf8,${encodeURIComponent(patroon(s))}")` }));
        balk.append(seg);
      }
      bak.append(balk);
      bak.append(el("div", { class: "legenda" }, volgorde.map((s) => el("span", { class: "item" },
        el("span", { class: "chip", style: "background:" + STATUS[s].kleur, "aria-hidden": "true" }),
        el("span", { "aria-hidden": "true" }, STATUS[s].glyph),
        STATUS[s].label + ": ", el("b", {}, euro(som[s]))))));
    }

    const cijfers = el("div", { class: "cijfers" });
    const cijfer = (k, v, t, tekst) => el("div", { class: "cijfer" },
      el("div", { class: "k" }, k), el("div", { class: "v" + (tekst ? " tekst" : "") }, v),
      t ? el("div", { class: "t" }, t) : null);
    cijfers.append(
      cijfer("Volgens verhuurder", euro(f.totaal_verhuurder),
        f.buiten_bevoegdheid > 0 ? "plus " + euro(f.buiten_bevoegdheid) + " buiten de bevoegdheid" : "binnen de bevoegdheid"),
      cijfer("Volgens beoordelingsmodel", euro(f.totaal_model), "over " + euro(f.totaal_beoordeeld_verhuurder) + " aan beoordeelde posten"),
      cijfer("Nog onbeoordeeld", euro(f.onbeoordeeld_bedrag),
        oranje ? oranje + " post(en) wachten op informatie" : "geen openstaande vragen"));
    if (f.voorschot_betaald !== undefined) {
      cijfers.append(cijfer("Voorschot betaald", euro(f.voorschot_betaald),
        "verhuurder rekent af op " + euro(f.saldo_volgens_verhuurder)));
    }
    bak.append(cijfers);
  }

  function patroon(status) {
    const lijn = { GROEN: "rgba(255,255,255,.42)", ORANJE: "rgba(0,0,0,.28)",
      ROOD: "rgba(255,255,255,.46)", BUITEN_BEVOEGDHEID: "rgba(255,255,255,.30)" }[status];
    const vorm = {
      GROEN: `<path d="M0 8 L8 0" stroke="${lijn}" stroke-width="3"/>`,
      ORANJE: `<path d="M0 0 L8 8" stroke="${lijn}" stroke-width="3"/>`,
      ROOD: `<circle cx="4" cy="4" r="1.7" fill="${lijn}"/>`,
      BUITEN_BEVOEGDHEID: `<path d="M0 8 L8 0" stroke="${lijn}" stroke-width="1"/>`,
    }[status];
    return `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8">${vorm}</svg>`;
  }

  function rendOntvankelijkheid() {
    const bak = $("#ontvankelijkheid");
    bak.textContent = "";
    if (uitkomst.blokkerend.length) {
      bak.append(el("div", { class: "melding fout" },
        el("b", {}, "Let op: dit verzoek is in deze vorm niet-ontvankelijk. "),
        "De inhoudelijke beoordeling hieronder blijft nuttig, maar zonder dat u dit eerst herstelt komt de Huurcommissie er niet aan toe."));
    }
    for (const regel of uitkomst.ontvankelijkheid) {
      bak.append(el("div", { class: "melding " + (regel.startsWith("ROOD") ? "fout" : regel.startsWith("OK") ? "ok" : "letop") }, regel));
    }
  }

  function rendBevindingen() {
    const bak = $("#bevindingen");
    bak.textContent = "";
    const rang = { ROOD: 0, ORANJE: 1, GROEN: 2, BUITEN_BEVOEGDHEID: 3 };
    [...uitkomst.beoordelingen].sort((a, b) => (rang[a.status] - rang[b.status]) || ((b.verschil || 0) - (a.verschil || 0)))
      .forEach((b) => {
        const kaart = el("div", { class: "bev " + b.status });
        kaart.append(el("div", { class: "bev-kop" }, el("h3", {}, b.omschrijving), badge(b.status),
          el("div", { class: "bedragen" },
            el("div", {}, "Verhuurder", el("b", {}, euro(b.bedrag_verhuurder))),
            b.status !== "BUITEN_BEVOEGDHEID" ? el("div", {}, b.voorlopig ? "Model (voorlopig)" : "Model",
              el("b", {}, b.bedrag_model === null ? "n.v.t." : euro(b.bedrag_model))) : null,
            b.verschil !== null && b.status !== "BUITEN_BEVOEGDHEID"
              ? el("div", {}, "Verschil", el("b", {}, euro(b.verschil))) : null)));
        const dl = el("dl");
        if (b.berekening.length) { dl.append(el("dt", {}, "Berekening")); for (const r of b.berekening) dl.append(el("dd", { class: "reken" }, r)); }
        if (b.toelichting.length) { dl.append(el("dt", {}, "Toelichting")); for (const r of b.toelichting) dl.append(el("dd", {}, r)); }
        if (b.ontbrekende_informatie.length) { dl.append(el("dt", {}, "Wat ontbreekt")); for (const r of b.ontbrekende_informatie) dl.append(el("dd", {}, r)); }
        kaart.append(dl);
        if (b.regels.length) {
          kaart.append(el("div", { class: "regels" },
            b.regels.map((id) => el("code", { title: REGELINDEX[id] ? REGELINDEX[id].onderwerp + " — " + REGELINDEX[id].bron : id }, id)),
            el("code", { title: "Automatiseringsniveau van deze regel" }, b.automatisering)));
        }
        bak.append(kaart);
      });
  }

  function rendVragen() {
    const kaart = $("#vragen-kaart");
    if (!uitkomst.openstaande_vragen.length) { kaart.hidden = true; return; }
    kaart.hidden = false;
    const tabel = $("#vragen");
    tabel.textContent = "";
    tabel.append(el("thead", {}, el("tr", {}, el("th", {}, "Post"), el("th", {}, "Wat er nodig is"), el("th", { class: "num" }, "Belang"))));
    tabel.append(el("tbody", {}, uitkomst.openstaande_vragen.map((v) =>
      el("tr", {}, el("td", {}, v.post), el("td", {}, v.vraag), el("td", { class: "num" }, euro(v.belang))))));
  }

  function rendSterkte() {
    const s = uitkomst.sterkte;
    const bak = $("#sterkte");
    bak.textContent = "";
    const blok = (k, v, t, tekst) => el("div", { class: "cijfer" },
      el("div", { class: "k" }, k), el("div", { class: "v" + (tekst ? " tekst" : "") }, v), el("div", { class: "t" }, t));
    const blok0 = uitkomst.blokkerend.length;
    bak.append(
      blok("Ontvankelijkheid", blok0 ? blok0 + " beletsel" : "Geen beletsel",
        blok0 ? "herstel dit eerst" : "op basis van de ingevulde gegevens", true),
      blok("Dekkingsgraad", Math.round(s.dekkingsgraad_procent) + "%", "deel van de afrekening dat beoordeeld kon worden"),
      blok("Aandeel harde regels", Math.round(s.aandeel_harde_regels_procent) + "%", "correctie op grond van vaste normen, niet open normen"),
      blok("Onderbouwde posten", s.posten_met_volledige_onderbouwing + " / " + s.posten_totaal, "posten waarvoor de verhuurder bewijs leverde"));
    $("#sterkte-uitleg").textContent = s.toelichting;
  }

  /* ------------------------------------------------------------ brieven */

  function euroTekst(w) { return "EUR " + Number(w).toFixed(2).replace(".", ","); }

  function bezwaarbrief() {
    const vandaag = new Date();
    const over3w = new Date(vandaag.getTime() + 21 * 864e5);
    const nl = (d) => d.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
    const rood = uitkomst.beoordelingen.filter((b) => b.status === "ROOD" && (b.verschil || 0) > 0);
    const oranje = uitkomst.beoordelingen.filter((b) => b.status === "ORANJE");
    const r = ["[Uw naam]", "[Uw adres]", "[Postcode en woonplaats]", "", "Aan: [naam verhuurder]",
      "[adres verhuurder]", "", "Datum: " + nl(vandaag),
      "Betreft: bezwaar tegen de afrekening servicekosten " + uitkomst.jaar, "", "Geachte heer/mevrouw,", "",
      "Op [datum] ontving ik van u de afrekening servicekosten over " + uitkomst.jaar + ". Ik ben het niet eens met een " +
      "aantal posten. Hieronder licht ik per kostenpost toe waarom, zoals artikel 7:260 BW en het Beleidsboek " +
      "Servicekosten van de Huurcommissie van mij verlangen.", ""];
    if (rood.length) {
      r.push("1. Posten waartegen ik bezwaar maak", "");
      rood.forEach((b, i) => {
        r.push(`${i + 1}. ${b.omschrijving} - in rekening gebracht: ${euroTekst(b.bedrag_verhuurder)}`);
        for (const t of b.toelichting) r.push("   " + t);
        for (const t of b.berekening) r.push("   " + t);
        r.push(`   Volgens het beleidsboek kom ik uit op ${euroTekst(b.bedrag_model)}. Ik verzoek u dit te corrigeren met ${euroTekst(b.verschil)}.`, "");
      });
      r.push("Het totaal van de door mij betwiste correcties bedraagt " + euroTekst(uitkomst.financieel.potentiele_correctie) + ".", "");
    }
    if (oranje.length) {
      r.push((rood.length ? "2" : "1") + ". Posten waarvoor ik aanvullende informatie nodig heb", "",
        "Op grond van artikel 7:259 lid 4 BW heb ik recht op inzage in de boeken en andere bescheiden die aan de " +
        "afrekening ten grondslag liggen. Voor de volgende posten verzoek ik u die stukken te verstrekken:", "");
      for (const b of oranje) {
        r.push(`- ${b.omschrijving} (${euroTekst(b.bedrag_verhuurder)}):`);
        for (const t of b.ontbrekende_informatie) r.push("  " + t);
      }
      r.push("");
    }
    r.push("Ik verzoek u binnen drie weken, dus uiterlijk " + nl(over3w) + ", op dit bezwaar te reageren en de " +
      "afrekening zo nodig aan te passen. Ontvang ik binnen die termijn geen reactie, of neemt uw reactie mijn " +
      "bezwaren niet weg, dan leg ik het geschil voor aan de Huurcommissie.", "", "Met vriendelijke groet,", "",
      "[Uw naam]", "", "---",
      "Concept, gegenereerd op basis van het Beleidsboek Servicekosten (versie 1 juli 2026). Controleer de gegevens " +
      "tussen [ ] en de inhoudelijke juistheid voordat u verstuurt. Dit is geen juridisch advies.");
    return r.join("\n");
  }

  function opvraagbrief(jaar) {
    const vandaag = new Date();
    const over3w = new Date(vandaag.getTime() + 21 * 864e5);
    const nl = (d) => d.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
    return ["[Uw naam]", "[Uw adres]", "[Postcode en woonplaats]", "", "Aan: [naam verhuurder]", "[adres verhuurder]", "",
      "Datum: " + nl(vandaag), "Betreft: verzoek om de afrekening servicekosten " + jaar, "", "Geachte heer/mevrouw,", "",
      "Op grond van artikel 7:259 lid 2 BW bent u verplicht mij uiterlijk zes maanden na afloop van het kalenderjaar " +
      "een naar soort uitgesplitst overzicht te verstrekken van de in dat jaar in rekening gebrachte kosten voor " +
      "nutsvoorzieningen en servicekosten, met vermelding van de wijze van berekening. Voor het jaar " + jaar +
      " was die termijn uiterlijk 30 juni " + (jaar + 1) + ".", "",
      "Ik heb deze afrekening niet ontvangen. Hierbij verzoek ik u die alsnog te verstrekken, uiterlijk binnen drie " +
      "weken, dus vóór " + nl(over3w) + ".", "",
      "Ontvang ik de afrekening niet binnen die termijn, dan leg ik de vaststelling van mijn betalingsverplichting " +
      "voor aan de Huurcommissie (artikel 7:260 BW).", "", "Met vriendelijke groet,", "", "[Uw naam]", "", "---",
      "Concept op basis van het Beleidsboek Servicekosten (versie 1 juli 2026), paragraaf 6.3.2. Dit is geen juridisch advies."].join("\n");
  }

  function toonBrief(tekst) {
    const vak = $("#brief");
    vak.value = tekst;
    vak.hidden = false;
    $("#briefacties").hidden = false;
    vak.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  /* ---------------------------------------------------------- navigatie */

  function toonStap(naam) {
    for (const s of ["start", "controle", "resultaat"]) $("#stap-" + s).hidden = s !== naam;
    const volgorde = ["start", "controle", "resultaat"];
    const i = volgorde.indexOf(naam);
    document.querySelectorAll("#stappen li").forEach((li, n) => {
      li.removeAttribute("aria-current");
      if (n === i) li.setAttribute("aria-current", "step");
      li.classList.toggle("klaar", n < i);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function voegPostToe() {
    dossier.kostenposten.push({ id: "P" + (dossier.kostenposten.length + 1), categorie: null,
      omschrijving: "", bedrag_verhuurder: 0, overeengekomen: dossier._overeengekomen_standaard,
      bewijs: [], levering_gemotiveerd_betwist: false, parameters: {} });
  }

  function vinkBewijs(soort) {
    for (const post of dossier.kostenposten) if (!post.bewijs.includes(soort)) post.bewijs.push(soort);
    rendPosten();
    const label = DATA.categorieen.bewijsopties.find((o) => o.waarde === soort).label;
    melding('"' + label + '" aangevinkt bij alle posten. Haal het weg bij posten waar dit bewijs ontbreekt — juist daar zit vaak de grootste correctie.', "ok");
  }

  /* --------------------------------------------------------------- start */

  function start() {
    $("#kies").addEventListener("click", () => $("#bestand").click());
    $("#bestand").addEventListener("change", (e) => e.target.files[0] && leesBestand(e.target.files[0]));

    const zone = $("#dropzone");
    ["dragenter", "dragover"].forEach((g) => zone.addEventListener(g, (e) => { e.preventDefault(); zone.classList.add("hover"); }));
    ["dragleave", "drop"].forEach((g) => zone.addEventListener(g, () => zone.classList.remove("hover")));
    zone.addEventListener("drop", (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) leesBestand(e.dataTransfer.files[0]); });

    $("#plak-lezen").addEventListener("click", () => {
      const tekst = $("#plakvak").value;
      if (tekst.trim().length < 20) return melding("Plak eerst de tekst van uw afrekening.", "fout");
      wisMeldingen();
      leesTekst(tekst, "geplakte tekst", false);
    });
    $("#handmatig").addEventListener("click", () => {
      dossier = leegDossier();
      isVoorbeeld = false;
      dossier.periode.jaar = Number(DATA.jaren[DATA.jaren.length - 1]);
      voegPostToe();
      rendControle();
      toonStap("controle");
    });
    $("#voorbeeld-laden").addEventListener("click", () => { wisMeldingen(); leesTekst(DATA.voorbeeld, "voorbeeldafrekening", true); rendResultaatVoorbeeld(); });
    $("#voorbeeld-eigen").addEventListener("click", () => { wisMeldingen(); dossier = leegDossier(); isVoorbeeld = false; toonStap("start"); });

    $("#post-toevoegen").addEventListener("click", () => { voegPostToe(); rendPosten(); });
    $("#snel-overeengekomen").addEventListener("click", () => {
      for (const p of dossier.kostenposten) p.overeengekomen = true;
      dossier._overeengekomen_standaard = true;
      rendProcedure(); rendPosten();
      melding("Alle posten staan nu op 'overeengekomen'. Wijk per post af waar dat niet klopt.", "ok");
    });
    $("#snel-facturen").addEventListener("click", () => vinkBewijs("facturen"));
    $("#snel-specificatie").addEventListener("click", () => vinkBewijs("specificatieformulier"));
    $("#beoordeel").addEventListener("click", beoordeel);
    $("#terug-start").addEventListener("click", () => toonStap("start"));
    $("#terug-controle").addEventListener("click", () => toonStap("controle"));
    $("#opnieuw").addEventListener("click", () => { dossier = leegDossier(); uitkomst = null; isVoorbeeld = false; wisMeldingen(); toonStap("start"); });
    $("#bezwaarbrief").addEventListener("click", () => toonBrief(bezwaarbrief()));
    $("#opvraagbrief").addEventListener("click", () => toonBrief(opvraagbrief(dossier.periode.jaar || uitkomst.jaar)));
    $("#kopieer").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText($("#brief").value); melding("Brief gekopieerd naar het klembord.", "ok"); }
      catch { $("#brief").select(); melding("Kopiëren lukte niet automatisch; de tekst is geselecteerd, gebruik Ctrl/Cmd+C.", "letop"); }
    });
    $("#thema").addEventListener("click", () => {
      const nu = document.documentElement.getAttribute("data-theme");
      const donker = nu === "dark" || (nu !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.setAttribute("data-theme", donker ? "light" : "dark");
    });

    // Open in een werkende staat: de voorbeeldafrekening, meteen beoordeeld.
    leesTekst(DATA.voorbeeld, "voorbeeldafrekening", true);
    rendResultaatVoorbeeld();
  }

  function rendResultaatVoorbeeld() {
    // De voorbeeldhuurder heeft alles overeengekomen en de verhuurder leverde
    // facturen; zo laat het voorbeeld echte bevindingen zien in plaats van
    // twaalf keer "onvoldoende informatie".
    dossier._overeengekomen_standaard = true;
    for (const post of dossier.kostenposten) {
      post.overeengekomen = true;
      post.bewijs = ["facturen", "specificatieformulier"];
    }
    dossier.woonruimte.woningtype = "flatwoning_appartement";
    dossier.woonruimte.aantal_bewoners = 2;
    dossier.woonruimte.oppervlakte_m2 = 70;
    dossier.procedure = { contract_gesloten_op: "2022-03-01", sector: "sociaal",
      afrekening_ontvangen: true, bezwaar_gemaakt: true };
    uitkomst = Kern.beoordeelDossier(dossier);
    rendControle();
    rendResultaat();
    toonStap("resultaat");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
