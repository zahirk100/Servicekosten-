/* Servicekosten-audit — interface.
   Kernregel: het model raadt niets. Wat de parser voorstelt is een voorstel dat
   de gebruiker bevestigt; wat het beleidsboek niet regelt wordt een vraag, geen
   schatting. */

const STATUS = {
  GROEN:  { glyph: "✓", label: "Lijkt correct",          kleur: "var(--st-groen)" },
  ORANJE: { glyph: "?", label: "Onvoldoende informatie", kleur: "var(--st-oranje)" },
  ROOD:   { glyph: "!", label: "Mogelijk onterecht",     kleur: "var(--st-rood)" },
  BUITEN_BEVOEGDHEID: { glyph: "–", label: "Buiten bevoegdheid", kleur: "var(--st-buiten)" },
};

const MAANDEN = ["januari","februari","maart","april","mei","juni","juli","augustus",
                 "september","oktober","november","december"];

let META = null;
let dossier = leegDossier();
let uitkomst = null;
let briefTekst = "";

/* ---------------------------------------------------------------- helpers */

const $ = (sel) => document.querySelector(sel);
const el = (tag, attrs = {}, ...kinderen) => {
  const knoop = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") knoop.className = v;
    else if (k === "html") knoop.innerHTML = v;
    else if (k.startsWith("on")) knoop.addEventListener(k.slice(2), v);
    else knoop.setAttribute(k, v === true ? "" : v);
  }
  for (const kind of kinderen.flat()) {
    if (kind === null || kind === undefined || kind === false) continue;
    knoop.append(kind.nodeType ? kind : document.createTextNode(String(kind)));
  }
  return knoop;
};

const euro = (waarde) => {
  const getal = Number(waarde);
  if (!isFinite(getal)) return "—";
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(getal);
};

function melding(tekst, soort = "info") {
  const bak = $("#meldingen");
  const knoop = el("div", { class: `melding ${soort}` }, tekst);
  bak.append(knoop);
  if (soort === "ok" || soort === "info") setTimeout(() => knoop.remove(), 7000);
}
const wisMeldingen = () => { $("#meldingen").textContent = ""; };

function leegDossier() {
  return {
    referentie: "",
    woonruimte: { zelfstandig: true, aantal_woonruimten_op_aansluiting: 1, gebruikt_gemeenschappelijke_ruimten: true },
    periode: { jaar: null, maand_van: 1, maand_tot_en_met: 12 },
    procedure: {},
    voorschot_in_rekening_gebracht: null,
    overeengekomen_maximum: null,
    kostenposten: [],
  };
}

/* ------------------------------------------------------------ veldbouwers */

function veld(definitie, waarde, opslaan) {
  const id = `v-${definitie.naam}-${Math.random().toString(36).slice(2, 7)}`;
  let invoer;

  if (definitie.type === "ja_nee") {
    invoer = el("input", { type: "checkbox", id, checked: waarde === true,
      onchange: (e) => opslaan(e.target.checked) });
    return el("div", {},
      el("div", { class: "checkrij" },
        el("label", { for: id }, invoer, definitie.label)),
      definitie.hulp ? el("div", { class: "veld-hulp" }, definitie.hulp) : null);
  }

  if (definitie.type === "ja_nee_onbekend") {
    invoer = el("select", { id, onchange: (e) => {
      const v = e.target.value;
      opslaan(v === "" ? null : v === "ja");
    } },
      el("option", { value: "", selected: waarde === null || waarde === undefined }, "Onbekend / weet ik niet"),
      el("option", { value: "ja", selected: waarde === true }, "Ja"),
      el("option", { value: "nee", selected: waarde === false }, "Nee"));
  } else if (definitie.type === "keuze") {
    invoer = el("select", { id, onchange: (e) => opslaan(e.target.value || null) },
      el("option", { value: "" }, "— kies —"),
      definitie.opties.map((o) => {
        const waarde2 = typeof o === "string" ? o : o.waarde;
        const tekst = typeof o === "string" ? o : o.label;
        return el("option", { value: waarde2, selected: String(waarde) === String(waarde2) }, tekst);
      }));
  } else if (definitie.type === "meerkeuze") {
    const gekozen = new Set(Array.isArray(waarde) ? waarde : []);
    return el("div", {},
      el("label", {}, definitie.label),
      el("div", { class: "checkrij", style: "flex-direction:column;gap:4px" },
        definitie.opties.map((o) => el("label", {},
          el("input", { type: "checkbox", checked: gekozen.has(o), onchange: (e) => {
            if (e.target.checked) gekozen.add(o); else gekozen.delete(o);
            opslaan([...gekozen]);
          } }), o))),
      definitie.hulp ? el("div", { class: "veld-hulp" }, definitie.hulp) : null);
  } else {
    const type = definitie.type === "datum" ? "date"
               : (definitie.type === "getal" || definitie.type === "geheel" || definitie.type === "bedrag")
                 ? "number" : "text";
    invoer = el("input", {
      type, id,
      step: definitie.type === "bedrag" ? "0.01" : (definitie.type === "geheel" ? "1" : "any"),
      value: waarde ?? "",
      inputmode: type === "number" ? "decimal" : null,
      onchange: (e) => {
        const rauw = e.target.value;
        if (rauw === "") return opslaan(null);
        opslaan(definitie.type === "geheel" ? parseInt(rauw, 10) : rauw);
      },
    });
  }
  return el("div", {},
    el("label", { for: id }, definitie.label),
    invoer,
    definitie.hulp ? el("div", { class: "veld-hulp" }, definitie.hulp) : null);
}

/* --------------------------------------------------------------- stap 1 */

async function uploadBestand(file) {
  wisMeldingen();
  const formulier = new FormData();
  formulier.append("bestand", file);
  try {
    const antwoord = await fetch("/api/upload", { method: "POST", body: formulier });
    const data = await antwoord.json();
    if (!antwoord.ok) throw new Error(data.detail || "Het bestand kon niet worden gelezen.");
    vulUitConcept(data.concept, file.name);
  } catch (fout) {
    melding(fout.message, "fout");
  }
}

function vulUitConcept(concept, bestandsnaam) {
  dossier = leegDossier();
  dossier.referentie = bestandsnaam || "";
  dossier.periode.jaar = concept.jaar;
  dossier.periode.maand_van = concept.maand_van;
  dossier.periode.maand_tot_en_met = concept.maand_tot_en_met;
  dossier.voorschot_in_rekening_gebracht = concept.voorschot;
  if (concept.aantal_woonruimten) {
    dossier.woonruimte.aantal_woonruimten_complex = concept.aantal_woonruimten;
  }
  dossier.kostenposten = concept.posten.map((post, i) => ({
    id: `P${i + 1}`,
    categorie: post.categorie,
    omschrijving: post.omschrijving,
    bedrag_verhuurder: post.bedrag,
    overeengekomen: null,
    bewijs: [],
    levering_gemotiveerd_betwist: false,
    parameters: {},
    _alternatieven: post.alternatieve_bedragen,
    _zekerheid: post.zekerheid,
    _vraag: post.vraag,
    _brontekst: post.brontekst,
  }));
  const meterstanden = concept.meterstanden || {};
  for (const post of dossier.kostenposten) {
    if (post.categorie && post.categorie.startsWith("NUT-") && post.categorie.endsWith("-METER")) {
      if (meterstanden.beginstand) post.parameters.beginstand = meterstanden.beginstand;
      if (meterstanden.eindstand) post.parameters.eindstand = meterstanden.eindstand;
    }
  }
  for (const waarschuwing of concept.waarschuwingen || []) melding(waarschuwing, "let-op");
  melding(`${concept.posten.length} kostenposten ingelezen. Controleer ze hieronder voordat u beoordeelt.`, "ok");
  rendControle();
  toonStap("controle");
}

/* --------------------------------------------------------------- stap 2 */

function rendControle() {
  rendWoning();
  rendProcedure();
  rendPosten();
}

function rendWoning() {
  const w = dossier.woonruimte;
  const p = dossier.periode;
  const zetW = (naam) => (waarde) => { w[naam] = waarde; };
  const bak = $("#woningvelden");
  bak.textContent = "";
  bak.append(
    veld({ naam: "jaar", label: "Boekjaar", type: "geheel",
           hulp: `Normbedragen beschikbaar voor ${META.beschikbare_jaren.join(", ")}.` },
         p.jaar, (v) => { p.jaar = v; }),
    veld({ naam: "maand_van", label: "Eerste maand van uw huurperiode", type: "keuze",
           opties: MAANDEN.map((m, i) => ({ waarde: i + 1, label: m })) },
         p.maand_van, (v) => { p.maand_van = parseInt(v, 10) || 1; }),
    veld({ naam: "maand_tot", label: "Laatste maand van uw huurperiode", type: "keuze",
           opties: MAANDEN.map((m, i) => ({ waarde: i + 1, label: m })),
           hulp: "Korter dan twaalf maanden? Dan rekent het model met graaddagen (gas), seizoenspatronen (elektriciteit) of evenredig (water)." },
         p.maand_tot_en_met, (v) => { p.maand_tot_en_met = parseInt(v, 10) || 12; }),
    veld({ naam: "zelfstandig", label: "Soort woonruimte", type: "keuze",
           opties: [{ waarde: "ja", label: "Zelfstandig (eigen voordeur, keuken en toilet)" },
                    { waarde: "nee", label: "Onzelfstandig (kamer)" }] },
         w.zelfstandig ? "ja" : "nee", (v) => { w.zelfstandig = v === "ja"; rendWoning(); }),
    w.zelfstandig
      ? veld({ naam: "woningtype", label: "Type woning", type: "keuze", opties: META.woningtypen,
               hulp: "Bepaalt de Nibud-gasnorm (Tabel 1, p. 13)." },
             w.woningtype, zetW("woningtype"))
      : veld({ naam: "oppervlakte_m2", label: "Oppervlakte van uw kamer (m²)", type: "getal",
               hulp: "Norm onzelfstandig: 25 m³ gas per m² (p. 14)." },
             w.oppervlakte_m2, zetW("oppervlakte_m2")),
    veld({ naam: "aantal_bewoners", label: "Aantal bewoners", type: "geheel",
           hulp: "Bepaalt de normen voor elektriciteit en water (tot en met vijf bewoners)." },
         w.aantal_bewoners, zetW("aantal_bewoners")),
    w.zelfstandig
      ? veld({ naam: "oppervlakte_m2", label: "Oppervlakte woning (m²)", type: "getal",
               hulp: "Nodig voor de verdeelsleutel gas zonder eigen meter." },
             w.oppervlakte_m2, zetW("oppervlakte_m2"))
      : null,
    veld({ naam: "aantal_woonruimten_op_aansluiting", label: "Woonruimten op dezelfde aansluiting", type: "geheel",
           hulp: "Vastrecht en belastingteruggave worden hierover gelijk verdeeld." },
         w.aantal_woonruimten_op_aansluiting, zetW("aantal_woonruimten_op_aansluiting")),
    veld({ naam: "aantal_woonruimten_complex", label: "Woonruimten in het complex", type: "geheel",
           hulp: "Noemer van de verdeelsleutels (p. 26-27, p. 29)." },
         w.aantal_woonruimten_complex, zetW("aantal_woonruimten_complex")),
    veld({ naam: "totale_oppervlakte_complex_m2", label: "Totale oppervlakte complex (m²)", type: "getal" },
         w.totale_oppervlakte_complex_m2, zetW("totale_oppervlakte_complex_m2")),
    veld({ naam: "voorschot", label: "Betaald voorschot over dit jaar", type: "bedrag" },
         dossier.voorschot_in_rekening_gebracht, (v) => { dossier.voorschot_in_rekening_gebracht = v; }),
    veld({ naam: "overeengekomen_maximum", label: "Overeengekomen vast bedrag servicekosten", type: "bedrag",
           hulp: "Als dit is afgesproken, is de verhuurder eraan gebonden (voetnoot 4, p. 11)." },
         dossier.overeengekomen_maximum, (v) => { dossier.overeengekomen_maximum = v; }),
    veld({ naam: "gebruikt_gemeenschappelijke_ruimten",
           label: "Ik maak gebruik van de gemeenschappelijke ruimten (of kan dat)", type: "ja_nee",
           hulp: "Zo niet, dan hoeft u daar niet voor te betalen (p. 29)." },
         w.gebruikt_gemeenschappelijke_ruimten, zetW("gebruikt_gemeenschappelijke_ruimten")),
  );
}

function rendProcedure() {
  const pr = dossier.procedure;
  const zet = (naam) => (waarde) => { pr[naam] = waarde; };
  const bak = $("#procedurevelden");
  bak.textContent = "";
  const termijn = META.termijnen[String(dossier.periode.jaar)];
  bak.append(
    veld({ naam: "servicekosten_overeengekomen",
           label: "Staat in uw huurcontract dat u servicekosten betaalt?", type: "ja_nee_onbekend",
           hulp: "Dit mag ook stilzwijgend zijn overeengekomen (p. 9). Uw antwoord geldt als standaard voor alle posten; per post kunt u ervan afwijken." },
         dossier._overeengekomen_standaard, (v) => {
           dossier._overeengekomen_standaard = v;
           for (const post of dossier.kostenposten) {
             if (!post._overeengekomen_handmatig) post.overeengekomen = v;
           }
           rendPosten();
         }),
    veld({ naam: "contract_gesloten_op", label: "Datum huurovereenkomst", type: "datum",
           hulp: "Vóór of vanaf 1 juli 2024 bepaalt of de Huurcommissie uitspraak doet of alleen adviseert." },
         pr.contract_gesloten_op, zet("contract_gesloten_op")),
    veld({ naam: "sector", label: "Sector", type: "keuze",
           opties: [{ waarde: "sociaal", label: "Sociale sector" },
                    { waarde: "middenhuur", label: "Middenhuur" },
                    { waarde: "vrij", label: "Vrije sector" }] },
         pr.sector, zet("sector")),
    veld({ naam: "afrekening_ontvangen", label: "Heeft u een afrekening ontvangen?", type: "ja_nee_onbekend" },
         pr.afrekening_ontvangen, zet("afrekening_ontvangen")),
    veld({ naam: "afrekening_ontvangen_op", label: "Datum ontvangst afrekening", type: "datum" },
         pr.afrekening_ontvangen_op, zet("afrekening_ontvangen_op")),
    veld({ naam: "bezwaar_gemaakt", label: "Heeft u schriftelijk bezwaar gemaakt?", type: "ja_nee_onbekend",
           hulp: "Verplicht vóór een verzoek bij de Huurcommissie (par. 6.3.1, p. 56)." },
         pr.bezwaar_gemaakt, zet("bezwaar_gemaakt")),
    veld({ naam: "afrekening_opgevraagd", label: "Heeft u de afrekening schriftelijk opgevraagd?", type: "ja_nee_onbekend",
           hulp: "Verplicht als u géén afrekening kreeg (par. 6.3.2, p. 57)." },
         pr.afrekening_opgevraagd, zet("afrekening_opgevraagd")),
    veld({ naam: "verzoekdatum", label: "Beoogde datum van uw verzoek", type: "datum",
           hulp: termijn ? `Uiterste verzoekdatum voor ${dossier.periode.jaar}: ${termijn.uiterste_verzoekdatum}.`
                         : "Uiterlijk tweeëneenhalf jaar na afloop van het kalenderjaar." },
         pr.verzoekdatum, zet("verzoekdatum")),
    veld({ naam: "huurder_woont_nog_op_adres", label: "Woont u nog op dit adres?", type: "ja_nee_onbekend",
           hulp: "Alleen van belang voor toetsing van het voorschotbedrag." },
         pr.huurder_woont_nog_op_adres, zet("huurder_woont_nog_op_adres")),
  );
}

function categorieOpties() {
  const groepen = {};
  for (const [code, def] of Object.entries(META.categorieen)) {
    (groepen[def.groep] ||= []).push([code, def.label]);
  }
  return groepen;
}

function rendPosten() {
  const bak = $("#posten");
  bak.textContent = "";
  if (!dossier.kostenposten.length) {
    bak.append(el("p", { class: "klein" }, "Nog geen posten. Voeg ze hieronder toe."));
  }
  dossier.kostenposten.forEach((post, index) => bak.append(postKaart(post, index)));
  $("#postenuitleg").textContent =
    `${dossier.kostenposten.length} post(en). Controleer per post de categorie en het bedrag; klap open voor de vervolgvragen die bij die categorie horen.`;
}

function postKaart(post, index) {
  const groepen = categorieOpties();
  const keuze = el("select", { onchange: (e) => { post.categorie = e.target.value || null; rendPosten(); } },
    el("option", { value: "" }, "— niet geclassificeerd —"),
    Object.entries(groepen).map(([groep, items]) =>
      el("optgroup", { label: groep },
        items.map(([code, label]) =>
          el("option", { value: code, selected: post.categorie === code }, `${label} (${code})`)))));

  const kop = el("div", { class: "post-kop" },
    el("div", {},
      el("label", {}, "Omschrijving op de afrekening"),
      el("input", { type: "text", value: post.omschrijving,
        onchange: (e) => { post.omschrijving = e.target.value; } })),
    el("div", {}, el("label", {}, "Categorie"), keuze),
    el("div", { class: "bedrag" },
      el("label", {}, "Uw aandeel"),
      el("input", { type: "number", step: "0.01", value: post.bedrag_verhuurder,
        onchange: (e) => { post.bedrag_verhuurder = e.target.value; } })),
    el("button", { class: "stil verwijder", title: "Post verwijderen",
      onclick: () => { dossier.kostenposten.splice(index, 1); rendPosten(); } }, "✕"));

  const def = post.categorie ? META.categorieen[post.categorie] : null;
  const body = el("div", { class: "post-body" });

  if (post._alternatieven && post._alternatieven.length) {
    body.append(el("div", { class: "veld-hulp" }, "Op deze regel stonden meer bedragen. Ander bedrag kiezen:"),
      el("div", { class: "alt-bedragen" },
        [post.bedrag_verhuurder, ...post._alternatieven].map((bedrag) =>
          el("button", { type: "button", onclick: () => { post.bedrag_verhuurder = bedrag; rendPosten(); } },
            euro(bedrag)))));
  }
  if (post._vraag && post.categorie) body.append(el("div", { class: "vraag" }, post._vraag));
  if (!post.categorie) {
    body.append(el("div", { class: "vraag" },
      "Niet automatisch geclassificeerd. Kies zelf een categorie — het Besluit servicekosten is niet limitatief (p. 29, p. 75)."));
  }

  const rooster = el("div", { class: "rooster" });
  for (const d of META.algemene_velden) {
    rooster.append(veld(d, post[d.naam], (v) => {
      post[d.naam] = v;
      if (d.naam === "overeengekomen") post._overeengekomen_handmatig = true;
    }));
  }
  if (def) {
    for (const d of def.velden) {
      rooster.append(veld(d, post.parameters[d.naam] ?? d.standaard, (v) => { post.parameters[d.naam] = v; }));
    }
  }
  body.append(rooster);

  body.append(el("div", { style: "margin-top:12px" },
    el("label", {}, "Welke bewijsstukken heeft de verhuurder aangeleverd?"),
    el("div", { class: "checkrij" },
      META.bewijsopties.map((optie) => el("label", {},
        el("input", { type: "checkbox", checked: post.bewijs.includes(optie.waarde),
          onchange: (e) => {
            const set = new Set(post.bewijs);
            e.target.checked ? set.add(optie.waarde) : set.delete(optie.waarde);
            post.bewijs = [...set];
          } }), optie.label))),
    el("div", { class: "veld-hulp" },
      "Een grootboekkaart of overzicht van facturen is uitdrukkelijk niet voldoende (p. 59).")));

  const open = el("details", { class: "uitklap", style: "margin:0;border:0;box-shadow:none" },
    el("summary", { style: "padding:8px 12px;font-size:.84rem;color:var(--ink-2)" },
      def ? `Vervolgvragen — ${def.label} · ${def.bron}` : "Vervolgvragen"),
    el("div", { style: "padding:0" }, body));

  return el("div", { class: "post" }, kop, open);
}

/* --------------------------------------------------------------- stap 3 */

function schoonDossier() {
  const kopie = JSON.parse(JSON.stringify(dossier));
  for (const post of kopie.kostenposten) {
    for (const sleutel of Object.keys(post)) if (sleutel.startsWith("_")) delete post[sleutel];
    for (const [k, v] of Object.entries(post.parameters)) {
      if (v === null || v === "" || v === undefined) delete post.parameters[k];
    }
  }
  for (const [k, v] of Object.entries(kopie.woonruimte)) {
    if (v === null || v === "" || v === undefined) delete kopie.woonruimte[k];
  }
  for (const [k, v] of Object.entries(kopie.procedure)) {
    if (v === null || v === "" || v === undefined) delete kopie.procedure[k];
  }
  if (!kopie.voorschot_in_rekening_gebracht) kopie.voorschot_in_rekening_gebracht = null;
  if (!kopie.overeengekomen_maximum) kopie.overeengekomen_maximum = null;
  return kopie;
}

async function beoordeel() {
  wisMeldingen();
  if (!dossier.periode.jaar) return melding("Vul eerst het boekjaar in.", "fout");
  const ongeclassificeerd = dossier.kostenposten.filter((p) => !p.categorie);
  if (ongeclassificeerd.length) {
    return melding(`${ongeclassificeerd.length} post(en) hebben nog geen categorie. Kies die eerst — het model wijst een onbekende post nooit zelf af.`, "fout");
  }
  try {
    const antwoord = await fetch("/api/beoordeel", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(schoonDossier()),
    });
    const data = await antwoord.json();
    if (!antwoord.ok) throw new Error(data.detail || "De beoordeling is mislukt.");
    uitkomst = data;
    rendResultaat();
    toonStap("resultaat");
  } catch (fout) {
    melding(fout.message, "fout");
  }
}

function statusBadge(status) {
  const s = STATUS[status];
  return el("span", { class: `status status-${status}` },
    el("span", { class: "glyph", "aria-hidden": "true" }, s.glyph), s.label);
}

function rendResultaat() {
  rendOntvankelijkheid();
  rendTegels();
  rendBalk();
  rendBevindingen();
  rendVragen();
  rendSterkte();
  briefTekst = "";
  $("#brief").classList.add("verborgen");
  $("#knop-kopieer").classList.add("verborgen");
  $("#knop-download").classList.add("verborgen");
}

function rendOntvankelijkheid() {
  const bak = $("#ontvankelijkheid");
  bak.textContent = "";
  for (const regel of uitkomst.ontvankelijkheid) {
    const soort = regel.startsWith("ROOD") ? "fout"
                : regel.startsWith("OK") ? "ok"
                : regel.startsWith("LET OP") ? "let-op" : "let-op";
    bak.append(el("div", { class: `melding ${soort}` }, regel));
  }
  if (uitkomst.blokkerend.length) {
    bak.prepend(el("div", { class: "melding fout" },
      el("b", {}, "Let op: dit verzoek is in deze vorm niet-ontvankelijk. "),
      "De inhoudelijke beoordeling hieronder blijft nuttig, maar zonder dat u dit eerst herstelt komt de Huurcommissie er niet aan toe."));
  }
}

function rendTegels() {
  const f = uitkomst.financieel;
  const bak = $("#tegels");
  bak.textContent = "";
  const tegel = (kop, getal, voet, nadruk) =>
    el("div", { class: `tegel${nadruk ? " nadruk" : ""}` },
      el("div", { class: "kop" }, kop),
      el("div", { class: "getal" }, getal),
      voet ? el("div", { class: "voet" }, voet) : null);

  const bandbreedte = f.bandbreedte_min !== f.bandbreedte_max;
  bak.append(
    tegel("Volgens verhuurder", euro(f.totaal_verhuurder),
          `Boekjaar ${uitkomst.jaar}${Number(f.buiten_bevoegdheid) > 0 ? ` · plus ${euro(f.buiten_bevoegdheid)} buiten de bevoegdheid` : ""}`),
    tegel("Volgens beoordelingsmodel", euro(f.totaal_model),
          `Over ${euro(f.totaal_beoordeeld_verhuurder)} aan beoordeelde posten`),
    tegel("Potentiële correctie", euro(f.potentiele_correctie),
          bandbreedte ? `Bandbreedte tot ${euro(f.bandbreedte_max)}` : "Alle posten beoordeeld", true),
    tegel("Nog onbeoordeeld", euro(f.onbeoordeeld_bedrag),
          uitkomst.tellingen.ORANJE ? `${uitkomst.tellingen.ORANJE} post(en) wachten op informatie` : "Geen openstaande vragen"),
  );
  if (f.voorschot_betaald) {
    bak.append(tegel("Voorschot betaald", euro(f.voorschot_betaald),
      `Verhuurder rekent af op ${euro(f.saldo_volgens_verhuurder)}; volgens het model ${euro(f.saldo_volgens_model)}`));
  }
}

function rendBalk() {
  const balk = $("#balk");
  const legenda = $("#legenda");
  balk.textContent = "";
  legenda.textContent = "";

  const som = {};
  for (const b of uitkomst.beoordelingen) {
    som[b.status] = (som[b.status] || 0) + Number(b.bedrag_verhuurder || 0);
  }
  const totaal = Object.values(som).reduce((a, b) => a + b, 0);
  if (!totaal) return;

  const volgorde = ["ROOD", "ORANJE", "GROEN", "BUITEN_BEVOEGDHEID"];
  const stukken = volgorde.filter((s) => som[s] > 0);
  const beschrijving = stukken
    .map((s) => `${STATUS[s].label}: ${euro(som[s])} (${Math.round(som[s] / totaal * 100)}%)`)
    .join("; ");

  for (const status of stukken) {
    const aandeel = som[status] / totaal;
    const breed = aandeel > 0.13;
    const seg = el("div", {
      class: "seg", style: `flex: ${aandeel} 1 0; background: ${STATUS[status].kleur};`,
      title: `${STATUS[status].label}: ${euro(som[status])}`,
    }, breed ? el("span", {}, `${STATUS[status].glyph} ${euro(som[status])}`) : null);
    // Tweede kanaal naast kleur: arcering, voor kleurenblindheid en print.
    const patroon = el("span", {
      "aria-hidden": "true",
      style: `position:absolute;inset:0;background-image:url("data:image/svg+xml;utf8,${
        encodeURIComponent(patroonSvg(status))}");opacity:.9`,
    });
    seg.prepend(patroon);
    balk.append(seg);
  }
  $("#balk-uitleg").textContent = `Verdeling van de afrekening naar status. ${beschrijving}.`;
  $("#verdeling-uitleg").textContent =
    `Van ${euro(totaal)} aan in rekening gebrachte posten is ${euro(som.ROOD || 0)} mogelijk onterecht en ` +
    `${euro(som.ORANJE || 0)} nog niet te beoordelen. Elke status draagt ook een teken en een woord: ` +
    `rood en groen zijn voor kleurenblinde lezers niet aan de kleur te onderscheiden.`;

  for (const status of stukken) {
    legenda.append(el("span", { class: "item" },
      el("span", { class: "chip", style: `background:${STATUS[status].kleur}`, "aria-hidden": "true" }),
      el("span", { "aria-hidden": "true" }, STATUS[status].glyph),
      `${STATUS[status].label}: `, el("b", {}, euro(som[status]))));
  }
}

function patroonSvg(status) {
  const lijn = { GROEN: "rgba(255,255,255,.40)", ORANJE: "rgba(0,0,0,.26)",
                 ROOD: "rgba(255,255,255,.45)", BUITEN_BEVOEGDHEID: "rgba(255,255,255,.28)" }[status];
  const vorm = {
    GROEN: `<path d="M0 8 L8 0" stroke="${lijn}" stroke-width="3"/>`,
    ORANJE: `<path d="M0 0 L8 8" stroke="${lijn}" stroke-width="3"/>`,
    ROOD: `<circle cx="4" cy="4" r="1.7" fill="${lijn}"/>`,
    BUITEN_BEVOEGDHEID: `<path d="M0 8 L8 0" stroke="${lijn}" stroke-width="1"/>`,
  }[status];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8">${vorm}</svg>`;
}

function rendBevindingen() {
  const bak = $("#bevindingen");
  bak.textContent = "";
  const rang = { ROOD: 0, ORANJE: 1, GROEN: 2, BUITEN_BEVOEGDHEID: 3 };
  const gesorteerd = [...uitkomst.beoordelingen].sort((a, b) => {
    const verschil = rang[a.status] - rang[b.status];
    return verschil !== 0 ? verschil : Number(b.verschil || 0) - Number(a.verschil || 0);
  });

  for (const b of gesorteerd) {
    const kaart = el("div", { class: `bev ${b.status}` });
    kaart.append(el("div", { class: "bev-kop" },
      el("h3", {}, b.omschrijving),
      statusBadge(b.status),
      el("div", { class: "bev-bedragen" },
        el("div", {}, "Verhuurder", el("b", {}, euro(b.bedrag_verhuurder))),
        b.status !== "BUITEN_BEVOEGDHEID"
          ? el("div", {}, b.voorlopig ? "Model (voorlopig)" : "Model",
              el("b", {}, b.bedrag_model === null ? "n.v.t." : euro(b.bedrag_model)))
          : null,
        b.verschil !== null && b.status !== "BUITEN_BEVOEGDHEID"
          ? el("div", {}, "Verschil", el("b", {}, euro(b.verschil)))
          : null)));

    const lijst = el("dl");
    if (b.berekening.length) {
      lijst.append(el("dt", {}, "Berekening"));
      for (const regel of b.berekening) lijst.append(el("dd", { class: "reken" }, regel));
    }
    if (b.toelichting.length) {
      lijst.append(el("dt", {}, "Toelichting"));
      for (const regel of b.toelichting) lijst.append(el("dd", {}, regel));
    }
    if (b.ontbrekende_informatie.length) {
      lijst.append(el("dt", {}, "Wat ontbreekt"));
      for (const regel of b.ontbrekende_informatie) lijst.append(el("dd", {}, regel));
    }
    kaart.append(lijst);

    if (b.regels.length) {
      kaart.append(el("div", { class: "regels" },
        b.regels.map((id) => {
          const info = META.regels[id];
          return el("code", { title: info ? `${info.onderwerp} — ${info.bron}` : id }, id);
        }),
        el("code", { title: "Automatiseringsniveau van deze regel" }, b.automatisering)));
    }
    bak.append(kaart);
  }
}

function rendVragen() {
  const tabel = $("#vragen");
  tabel.textContent = "";
  if (!uitkomst.openstaande_vragen.length) {
    $("#vragen-kaart").classList.add("verborgen");
    return;
  }
  $("#vragen-kaart").classList.remove("verborgen");
  tabel.append(el("thead", {}, el("tr", {},
    el("th", {}, "Post"), el("th", {}, "Wat er nodig is"), el("th", { class: "num" }, "Belang"))));
  tabel.append(el("tbody", {},
    uitkomst.openstaande_vragen.map((v) => el("tr", {},
      el("td", {}, v.post), el("td", {}, v.vraag), el("td", { class: "num" }, euro(v.belang))))));
}

function rendSterkte() {
  const s = uitkomst.sterkte;
  const bak = $("#sterkte");
  bak.textContent = "";
  // Tekstwaarden krijgen een kleinere trap dan getallen, anders breken ze af.
  const blok = (kop, waarde, voet, tekst = false) => el("div", { class: "tegel" },
    el("div", { class: "kop" }, kop),
    el("div", { class: `getal${tekst ? " tekst" : ""}` }, waarde),
    el("div", { class: "voet" }, voet));
  const blokkerend = uitkomst.blokkerend.length;
  bak.append(
    blok("Ontvankelijkheid", blokkerend ? `${blokkerend} beletsel` : "Geen beletsel",
         blokkerend ? "Herstel dit eerst" : "Op basis van de ingevulde gegevens", true),
    blok("Dekkingsgraad", `${Math.round(Number(s.dekkingsgraad_procent))}%`,
         "Deel van de afrekening dat beoordeeld kon worden"),
    blok("Aandeel harde regels", `${Math.round(Number(s.aandeel_harde_regels_procent))}%`,
         "Correctie op grond van vaste normen in plaats van open normen"),
    blok("Onderbouwde posten", `${s.posten_met_volledige_onderbouwing} / ${s.posten_totaal}`,
         "Posten waarvoor de verhuurder bewijs leverde"),
  );
  $("#sterkte-uitleg").textContent = s.toelichting;
}

/* ------------------------------------------------------------------ brief */

async function haalBrief(soort) {
  try {
    const antwoord = await fetch("/api/brief", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soort, dossier: schoonDossier() }),
    });
    const tekst = await antwoord.text();
    if (!antwoord.ok) throw new Error(tekst);
    briefTekst = tekst;
    const vak = $("#brief");
    vak.value = tekst;
    vak.classList.remove("verborgen");
    $("#knop-kopieer").classList.remove("verborgen");
    $("#knop-download").classList.remove("verborgen");
    vak.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (fout) {
    melding("De brief kon niet worden opgesteld: " + fout.message, "fout");
  }
}

function downloadTekst(naam, inhoud, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([inhoud], { type: `${type};charset=utf-8` }));
  const link = el("a", { href: url, download: naam });
  document.body.append(link); link.click(); link.remove();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------- navigatie */

function toonStap(naam) {
  for (const stap of ["start", "controle", "resultaat"]) {
    $(`#stap-${stap}`).classList.toggle("verborgen", stap !== naam);
  }
  const volgorde = ["start", "controle", "resultaat"];
  const huidig = volgorde.indexOf(naam);
  document.querySelectorAll("#stappen li").forEach((li, i) => {
    li.toggleAttribute("aria-current", i === huidig);
    if (i === huidig) li.setAttribute("aria-current", "step");
    li.classList.toggle("klaar", i < huidig);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ------------------------------------------------------------------ init */

async function init() {
  META = await (await fetch("/api/meta")).json();

  const bestand = $("#bestand");
  $("#knop-kies").addEventListener("click", () => bestand.click());
  bestand.addEventListener("change", () => bestand.files[0] && uploadBestand(bestand.files[0]));

  const zone = $("#dropzone");
  for (const gebeurtenis of ["dragenter", "dragover"]) {
    zone.addEventListener(gebeurtenis, (e) => { e.preventDefault(); zone.classList.add("hover"); });
  }
  for (const gebeurtenis of ["dragleave", "drop"]) {
    zone.addEventListener(gebeurtenis, () => zone.classList.remove("hover"));
  }
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) uploadBestand(e.dataTransfer.files[0]);
  });

  $("#knop-handmatig").addEventListener("click", () => {
    dossier = leegDossier();
    dossier.periode.jaar = Number(META.beschikbare_jaren.at(-1));
    voegPostToe();
    rendControle();
    toonStap("controle");
  });
  $("#knop-post-toevoegen").addEventListener("click", () => { voegPostToe(); rendPosten(); });
  $("#snel-overeengekomen").addEventListener("click", () => {
    for (const post of dossier.kostenposten) post.overeengekomen = true;
    dossier._overeengekomen_standaard = true;
    rendProcedure(); rendPosten();
    melding("Alle posten staan nu op 'overeengekomen'. Wijk per post af waar dat niet klopt.", "ok");
  });
  $("#snel-facturen").addEventListener("click", () => vinkBewijsAan("facturen"));
  $("#snel-specificatie").addEventListener("click", () => vinkBewijsAan("specificatieformulier"));
  $("#knop-beoordeel").addEventListener("click", beoordeel);
  $("#knop-terug-start").addEventListener("click", () => toonStap("start"));
  $("#knop-terug-controle").addEventListener("click", () => toonStap("controle"));
  $("#knop-opnieuw").addEventListener("click", () => {
    dossier = leegDossier(); uitkomst = null; wisMeldingen(); toonStap("start");
  });
  $("#knop-bezwaarbrief").addEventListener("click", () => haalBrief("bezwaar"));
  $("#knop-opvraagbrief").addEventListener("click", () => haalBrief("opvraag"));
  $("#knop-kopieer").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(briefTekst); melding("Brief gekopieerd.", "ok"); }
    catch { melding("Kopiëren lukte niet; selecteer de tekst handmatig.", "let-op"); }
  });
  $("#knop-download").addEventListener("click", () =>
    downloadTekst(`brief-servicekosten-${dossier.periode.jaar || "concept"}.txt`, briefTekst));
  $("#knop-json").addEventListener("click", () =>
    downloadTekst(`beoordeling-${uitkomst.jaar}.json`, JSON.stringify(uitkomst, null, 2), "application/json"));

  $("#knop-thema").addEventListener("click", () => {
    const nu = document.documentElement.getAttribute("data-theme");
    const donker = nu === "dark" || (nu !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", donker ? "light" : "dark");
  });

  const voorbeelden = await (await fetch("/api/voorbeelden")).json();
  const bak = $("#voorbeeldknoppen");
  for (const v of voorbeelden) {
    bak.append(el("button", { type: "button", onclick: async () => {
      const blob = await (await fetch(`/api/voorbeelden/${v.bestandsnaam}`)).blob();
      uploadBestand(new File([blob], v.bestandsnaam));
    } }, v.bestandsnaam));
  }
}

function vinkBewijsAan(soort) {
  for (const post of dossier.kostenposten) {
    if (!post.bewijs.includes(soort)) post.bewijs.push(soort);
  }
  rendPosten();
  const label = META.bewijsopties.find((o) => o.waarde === soort).label;
  melding(`"${label}" aangevinkt bij alle posten. Haal het weg bij posten waar dit bewijs ontbreekt — juist daar zit vaak de grootste correctie.`, "ok");
}

function voegPostToe() {
  dossier.kostenposten.push({
    id: `P${dossier.kostenposten.length + 1}`,
    categorie: null, omschrijving: "", bedrag_verhuurder: "0.00",
    overeengekomen: null, bewijs: [], levering_gemotiveerd_betwist: false, parameters: {},
  });
}

init().catch((fout) => melding("De applicatie kon niet starten: " + fout.message, "fout"));
