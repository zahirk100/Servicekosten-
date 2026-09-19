/* Rekenkern servicekosten - JavaScript-port van engine/regels.py + engine/motor.py.
   Bron: Beleidsboek Servicekosten van de Huurcommissie, versie 1 juli 2026.

   Deze port wordt gevalideerd tegen dezelfde zeventien rekenvoorbeelden uit het
   beleidsboek als de Python-kern, plus een vergelijking van de vijf casussen met
   de uitvoer van die kern (tests/test_web_kern.mjs). Wijkt een uitkomst af, dan
   is de port fout - niet het beleidsboek. */

(function (global) {
  "use strict";

  let NORMEN = null;
  let CATEGORIEEN = null;

  /* ------------------------------------------------------------- rekenen */

  // Afronden op hele centen, ROUND_HALF_UP en weg van nul, zoals Decimal in de
  // Python-kern. De toFixed(4) haalt eerst de binaire ruis uit het getal.
  function eur(waarde) {
    const n = Number(waarde);
    if (!isFinite(n)) return 0;
    const teken = n < 0 ? -1 : 1;
    return teken * Math.round(Number((Math.abs(n) * 100).toFixed(4))) / 100;
  }
  const getal = (x) => (x === null || x === undefined || x === "" ? null : Number(x));

  function normOntbreekt(bericht) {
    const fout = new Error(bericht);
    fout.normOntbreekt = true;
    return fout;
  }

  function jaarBlok(tabel, jaar, wat) {
    const sleutel = String(jaar);
    if (!(sleutel in tabel)) {
      const beschikbaar = Object.keys(tabel).filter((k) => /^\d+$/.test(k)).sort();
      throw normOntbreekt(
        `Het beleidsboek (versie 1 juli 2026) bevat geen ${wat} voor ${jaar}. ` +
        `Beschikbaar: ${beschikbaar.join(", ")}.`);
    }
    return tabel[sleutel];
  }

  const gasTarief = (jaar) => jaarBlok(NORMEN.gas.tarief, jaar, "gastarief");
  const elekTarief = (jaar) => jaarBlok(NORMEN.elektriciteit.tarief, jaar, "elektriciteitstarief");
  const waterTarief = (jaar) => jaarBlok(NORMEN.water.tarief, jaar, "watertarief");
  const graaddagen = (jaar) => jaarBlok(NORMEN.graaddagen, jaar, "graaddagen");

  function gasNorm(woningtype, jaar) {
    const tabel = NORMEN.gas.verbruiksnorm_zelfstandig_m3;
    if (!(woningtype in tabel)) {
      throw normOntbreekt(`Onbekend woningtype ${woningtype}.`);
    }
    return jaarBlok(tabel[woningtype], jaar, `gasverbruiksnorm voor ${woningtype}`);
  }
  function elekNorm(bewoners, jaar) {
    if (bewoners > 5) {
      throw normOntbreekt(
        `Tabel 4 (p. 18) bevat alleen normen tot en met vijf bewoners; voor ${bewoners} ` +
        "bewoners geeft het beleidsboek geen norm.");
    }
    const tabel = NORMEN.elektriciteit.verbruiksnorm_zelfstandig_kwh;
    return jaarBlok(tabel[String(bewoners)], jaar, `elektriciteitsnorm voor ${bewoners} bewoners`);
  }
  function waterNorm(bewoners, jaar) {
    const tabel = NORMEN.water.verbruiksnorm_m3;
    if (!(String(bewoners) in tabel)) {
      throw normOntbreekt(
        `Tabel 7 (p. 21) bevat alleen normen tot en met vijf bewoners; voor ${bewoners} ` +
        "bewoners geeft het beleidsboek geen norm.");
    }
    return jaarBlok(tabel[String(bewoners)], jaar, `waternorm voor ${bewoners} bewoners`);
  }
  function huismeesterTarief(jaar) {
    return jaarBlok(NORMEN.huismeester.maximaal_uurtarief_incl_btw, jaar,
                    "maximaal uurtarief huismeester");
  }

  const maanden = (periode) => {
    const lijst = [];
    for (let m = periode.maand_van; m <= periode.maand_tot_en_met; m++) lijst.push(m);
    return lijst;
  };
  const volledigJaar = (p) => p.maand_van === 1 && p.maand_tot_en_met === 12;
  const maandfactor = (d) => maanden(d.periode).length / 12;

  function graaddagenfactor(dossier) {
    const tabel = graaddagen(dossier.periode.jaar);
    const deel = maanden(dossier.periode).reduce((som, m) => som + tabel[String(m)], 0);
    return deel / tabel.totaal;
  }
  function seizoensfactor(dossier) {
    const tabel = NORMEN.elektriciteit.seizoenspatroon_percentage_per_maand;
    return maanden(dossier.periode).reduce((som, m) => som + tabel[String(m)], 0);
  }

  // Prijsplafond 2023: eerste schijf laag tarief, de rest hoog (p. 14, p. 18).
  function gestaffeldTarief(hoeveelheid, tarief, sleutel, plafondsleutel) {
    const laag = tarief[sleutel];
    const hoog = tarief[sleutel + "_boven_plafond"];
    const plafond = tarief[plafondsleutel];
    if (hoog == null || plafond == null || hoeveelheid <= plafond) return hoeveelheid * laag;
    return plafond * laag + (hoeveelheid - plafond) * hoog;
  }

  const breuk = (waarde) => {
    const tekst = String(waarde);
    if (tekst.includes("/")) {
      const [teller, noemer] = tekst.split("/");
      return Number(teller) / Number(noemer);
    }
    return Number(tekst);
  };

  /* ----------------------------------------------------- beoordelingsobject */

  function nieuweBeoordeling(post) {
    return {
      kostenpost_id: post.id, categorie: post.categorie, omschrijving: post.omschrijving,
      status: "ORANJE", voorlopig: false,
      bedrag_verhuurder: eur(post.bedrag_verhuurder), bedrag_model: null,
      regels: [], berekening: [], toelichting: [], ontbrekende_informatie: [],
      automatisering: "semi-automatisch", menselijke_controle_nodig: true,
    };
  }

  function rondStatus(b) {
    if (b.status === "BUITEN_BEVOEGDHEID") return b;
    if (b.ontbrekende_informatie.length || b.bedrag_model === null) {
      b.status = "ORANJE";
      b.voorlopig = b.bedrag_model !== null;
      return b;
    }
    b.status = eur(b.bedrag_verhuurder - b.bedrag_model) > 0 ? "ROOD" : "GROEN";
    return b;
  }

  const verschilVan = (b) => (b.bedrag_model === null ? null : eur(b.bedrag_verhuurder - b.bedrag_model));

  function controleerGrondslag(post, b) {
    if (post.overeengekomen === false) {
      b.regels.push("R-ALG-01");
      b.bedrag_model = 0;
      b.status = "ROOD";
      b.toelichting.push(
        "Niet overeengekomen dat deze kosten voor rekening van de huurder komen; zonder " +
        "overeenstemming is er geen juridische basis voor een betalingsverplichting " +
        "(Beleidsboek p. 9; Nota van toelichting Besluit servicekosten, p. 75).");
      return false;
    }
    if (post.overeengekomen === null || post.overeengekomen === undefined) {
      b.regels.push("R-ALG-01");
      b.ontbrekende_informatie.push(
        "Huurovereenkomst/algemene voorwaarden: is deze post (al dan niet stilzwijgend) " +
        "overeengekomen? (Beleidsboek p. 9)");
    }
    return true;
  }

  /* ------------------------------------------ nutsvoorzieningen met meter */

  function nibudGas(dossier, b) {
    const w = dossier.woonruimte, p = dossier.periode;
    const tarief = gasTarief(p.jaar);
    let jaarverbruik, bron;
    if (w.zelfstandig) {
      if (!w.woningtype) throw normOntbreekt("Woningtype ontbreekt; zonder woningtype geeft Tabel 1 (p. 13) geen norm.");
      jaarverbruik = gasNorm(w.woningtype, p.jaar);
      bron = `Tabel 1 (p. 13), ${w.woningtype}`;
    } else {
      if (w.oppervlakte_m2 == null) throw normOntbreekt("Oppervlakte ontbreekt; de norm voor onzelfstandige woonruimte is 25 m3 per m2 (p. 14).");
      jaarverbruik = Number(w.oppervlakte_m2) * NORMEN.gas.verbruiksnorm_onzelfstandig_m3_per_m2.waarde;
      bron = `${w.oppervlakte_m2} m2 x 25 m3 (p. 14)`;
    }
    let verbruik;
    if (volledigJaar(p)) {
      verbruik = jaarverbruik;
      b.berekening.push(`Normverbruik gas: ${verbruik} m3 (${bron}).`);
    } else {
      const factor = graaddagenfactor(dossier);
      b.regels.push("R-PER-01");
      verbruik = Math.round(jaarverbruik * factor);
      b.berekening.push(
        `Normverbruik gas ${jaarverbruik} m3 (${bron}); graaddagenmethode ` +
        `${p.maand_van}-${p.maand_tot_en_met}/${p.jaar}: factor ${factor.toFixed(6)} -> ${verbruik} m3 (par. 3.1.3, p. 16).`);
    }
    const verbruikskosten = gestaffeldTarief(verbruik, tarief, "tarief_per_m3", "plafond_m3");
    const vastrecht = tarief.vastrecht_per_jaar / (w.aantal_woonruimten_op_aansluiting || 1);
    const vastrechtDeel = vastrecht * maandfactor(dossier);
    b.berekening.push(`Verbruikskosten ${verbruik} m3 x EUR ${tarief.tarief_per_m3} = EUR ${eur(verbruikskosten).toFixed(2)} (Tabel 2, p. 14).`);
    b.berekening.push(`Vastrecht EUR ${tarief.vastrecht_per_jaar} / ${w.aantal_woonruimten_op_aansluiting || 1} woonruimte(n) x ${maanden(p).length}/12 = EUR ${eur(vastrechtDeel).toFixed(2)}.`);
    return eur(verbruikskosten + vastrechtDeel);
  }

  function nibudElektriciteit(dossier, b) {
    const w = dossier.woonruimte, p = dossier.periode;
    const tarief = elekTarief(p.jaar);
    let jaarverbruik, bron;
    if (w.zelfstandig) {
      if (!w.aantal_bewoners) throw normOntbreekt("Aantal bewoners ontbreekt; Tabel 4 (p. 18) is daarvan afhankelijk.");
      jaarverbruik = elekNorm(w.aantal_bewoners, p.jaar);
      bron = `Tabel 4 (p. 18), ${w.aantal_bewoners} bewoner(s)`;
    } else {
      jaarverbruik = NORMEN.elektriciteit.verbruiksnorm_onzelfstandig_kwh.waarde;
      bron = "onzelfstandige woonruimte, 1.000 kWh (p. 18)";
    }
    let verbruik;
    if (volledigJaar(p)) {
      verbruik = jaarverbruik;
      b.berekening.push(`Normverbruik elektriciteit: ${verbruik} kWh (${bron}).`);
    } else {
      const factor = seizoensfactor(dossier);
      b.regels.push("R-PER-02");
      verbruik = jaarverbruik * factor;
      b.berekening.push(`Normverbruik ${jaarverbruik} kWh (${bron}); seizoenspatroon ${p.maand_van}-${p.maand_tot_en_met} = ${Math.round(factor * 100)}% -> ${verbruik} kWh (Tabel 6, p. 20).`);
    }
    const verbruikskosten = gestaffeldTarief(verbruik, tarief, "tarief_per_kwh", "plafond_kwh");
    const n = w.aantal_woonruimten_op_aansluiting || 1;
    // Het beleidsboek rondt het aandeel per woonruimte eerst af op centen en
    // neemt daarvan het maanddeel (voorbeeld p. 19).
    const vastrechtDeel = eur(tarief.vastrecht_per_jaar / n) * maandfactor(dossier);
    const teruggaveDeel = eur(tarief.belastingteruggave_per_jaar / n) * maandfactor(dossier);
    b.berekening.push(`Verbruikskosten ${verbruik} kWh x EUR ${tarief.tarief_per_kwh} = EUR ${eur(verbruikskosten).toFixed(2)} (Tabel 5, p. 18).`);
    b.berekening.push(`Vastrecht EUR ${eur(tarief.vastrecht_per_jaar / n).toFixed(2)} x ${maanden(p).length}/12 = EUR ${eur(vastrechtDeel).toFixed(2)}; belastingteruggave EUR ${eur(tarief.belastingteruggave_per_jaar / n).toFixed(2)} x ${maanden(p).length}/12 = EUR ${eur(teruggaveDeel).toFixed(2)}.`);
    return eur(verbruikskosten + eur(vastrechtDeel) - eur(teruggaveDeel));
  }

  function nibudWater(dossier, b) {
    const w = dossier.woonruimte, p = dossier.periode;
    const tarief = waterTarief(p.jaar);
    const bewoners = w.aantal_bewoners || 1;
    const jaarverbruik = waterNorm(bewoners, p.jaar);
    const verbruik = jaarverbruik * maandfactor(dossier);
    if (!volledigJaar(p)) b.regels.push("R-PER-03");
    b.berekening.push(`Normverbruik water ${jaarverbruik} m3 (Tabel 7, p. 21, ${bewoners} bewoner(s))` +
      (volledigJaar(p) ? "" : ` x ${maanden(p).length}/12 = ${verbruik} m3 (evenredig, par. 3.3.3, p. 23)`) + ".");
    const verbruikskosten = verbruik * tarief.tarief_per_m3;
    const vastrechtDeel = eur(tarief.vastrecht_per_jaar / (w.aantal_woonruimten_op_aansluiting || 1)) * maandfactor(dossier);
    b.berekening.push(`Verbruikskosten ${verbruik} m3 x EUR ${tarief.tarief_per_m3} = EUR ${eur(verbruikskosten).toFixed(2)}; vastrecht EUR ${eur(vastrechtDeel).toFixed(2)} (Tabel 8, p. 22).`);
    return eur(verbruikskosten + eur(vastrechtDeel));
  }

  const NIBUD = { "NUT-GAS-METER": nibudGas, "NUT-ELK-METER": nibudElektriciteit, "NUT-WATER-METER": nibudWater };
  const FORFAIT_SOORT = { "NUT-GAS-METER": "gas_m3", "NUT-ELK-METER": "elektriciteit_kwh", "NUT-WATER-METER": "water_m3" };

  function forfaitNuts(dossier, categorie, b) {
    const cfg = NORMEN.forfaits_bij_ontbrekende_onderbouwing;
    const sleutel = dossier.woonruimte.zelfstandig ? "zelfstandig" : "onzelfstandig";
    const hoeveelheid = cfg.wettelijk_vastgesteld_verbruik[FORFAIT_SOORT[categorie]][sleutel];
    const jaar = dossier.periode.jaar;
    let bedrag, eenheid;
    if (categorie === "NUT-GAS-METER") {
      bedrag = gestaffeldTarief(hoeveelheid, gasTarief(jaar), "tarief_per_m3", "plafond_m3"); eenheid = "m3";
    } else if (categorie === "NUT-ELK-METER") {
      bedrag = gestaffeldTarief(hoeveelheid, elekTarief(jaar), "tarief_per_kwh", "plafond_kwh"); eenheid = "kWh";
    } else {
      bedrag = hoeveelheid * waterTarief(jaar).tarief_per_m3; eenheid = "m3";
    }
    bedrag = bedrag * maandfactor(dossier);
    b.berekening.push(`Forfait par. 6.4.2 (Tabel 11, p. 60): ${hoeveelheid} ${eenheid} x Nibud-tarief x ${maanden(dossier.periode).length}/12 = EUR ${eur(bedrag).toFixed(2)}.`);
    b.toelichting.push(
      "Let op: het beleidsboek verwijst voor het forfait naar bijlage VIII van de " +
      "Uitvoeringsregeling huurprijzen woonruimte. Die bedragen staan NIET in het beleidsboek; " +
      "hier is gerekend met het wettelijk vastgestelde verbruik uit Tabel 11 en het Nibud-tarief " +
      "(voetnoot 16/18, p. 60-61). Verificatie tegen bijlage VIII is vereist.");
    return eur(bedrag);
  }

  function nutsvoorzieningMetMeter(post, dossier) {
    const b = nieuweBeoordeling(post);
    if (!controleerGrondslag(post, b)) return b;
    const par = post.parameters || {};
    let normbedrag = null;
    try {
      normbedrag = NIBUD[post.categorie](dossier, b);
    } catch (fout) {
      if (!fout.normOntbreekt) throw fout;
      b.ontbrekende_informatie.push(fout.message);
    }

    if (!(post.bewijs || []).includes("facturen")) {
      if (post.levering_gemotiveerd_betwist) {
        b.regels.push("R-BEW-03");
        b.bedrag_model = 0;
        b.toelichting.push("Levering gemotiveerd betwist en geen facturen of andere betaalbewijzen: de kosten worden op EUR 0,00 gesteld (par. 6.4.2 onder 1, p. 60).");
        return rondStatus(b);
      }
      b.regels.push("R-BEW-01");
      b.bedrag_model = forfaitNuts(dossier, post.categorie, b);
      b.toelichting.push("De verhuurder heeft de kosten niet met facturen onderbouwd; het bedrag wordt bepaald op het niveau van het wettelijk vastgestelde verbruik en tarief (par. 6.4.2 onder 1, p. 60).");
      return rondStatus(b);
    }

    const standenBekend = par.beginstand != null && par.eindstand != null;
    if (!standenBekend && !par.meterstanden_aanwezig) {
      b.regels.push("R-NUT-02");
      if (normbedrag === null) {
        b.toelichting.push("Meterstanden ontbreken, maar de Nibud-norm kon niet worden bepaald.");
        return rondStatus(b);
      }
      b.toelichting.push("Begin- of eindstand ontbreekt; het opgevoerde verbruik wordt getoetst aan de landelijke verbruiksnormen en tarieven van het Nibud (p. 12-13).");
      b.bedrag_model = normbedrag;
      if (par.verbruik_verhuurder != null) {
        b.toelichting.push(
          `Opgevoerd verbruik ${par.verbruik_verhuurder} tegenover normverbruik; bij een afwijking ` +
          "in belangrijke mate zonder goede verklaring stelt de Huurcommissie het verbruik vast " +
          "conform de Nibud-norm (p. 12). De maatstaf 'in belangrijke mate' is in het beleidsboek " +
          "niet gekwantificeerd: menselijke toets vereist.");
      }
      return rondStatus(b);
    }

    if (par.meterstanden_betwist) {
      b.regels.push("R-NUT-03");
      if (normbedrag === null) return rondStatus(b);
      if (post.categorie === "NUT-GAS-METER" && par.huurder_stelt_installatie_gebrekkig) {
        b.regels.push("R-NUT-04");
        const ondergrens = NORMEN.gas.rendement_ondergrens_stookinstallatie.waarde;
        b.bedrag_model = normbedrag;
        if (par.inspectierapport_aanwezig !== true) {
          b.toelichting.push("De verhuurder heeft geen inspectierapport verstrekt; de Huurcommissie gaat dan in het algemeen uit van de Nibud-verbruiksnorm (par. 3.1.2, p. 15).");
        } else if (par.rendement_ketel != null && Number(par.rendement_ketel) < ondergrens) {
          b.toelichting.push(`Het ketelrendement (${par.rendement_ketel}) ligt onder de door de Huurcommissie gehanteerde ondergrens van ${ondergrens} (par. 3.1.2, p. 15); uitgangspunt is de Nibud-verbruiksnorm.`);
        } else {
          b.toelichting.push("Meterstanden gemotiveerd betwist: de Huurcommissie bepaalt de betalingsverplichting aan de hand van de Nibud-normen en -tarieven, tenzij een verklaring voor het hoge verbruik plausibel is (par. 3.1.2, p. 15).");
        }
      } else {
        b.bedrag_model = normbedrag;
        b.toelichting.push("Meterstanden gemotiveerd betwist: toetsing aan de landelijke verbruiksnormen en tarieven van het Nibud (par. 3.1.2/3.2.2/3.3.2, p. 15, 19, 23).");
      }
      b.ontbrekende_informatie.push("Menselijke weging: is de betwisting 'gemotiveerd en overtuigend' en is er een plausibele verklaring voor het verbruik? (p. 15)");
      return rondStatus(b);
    }

    b.regels.push("R-NUT-01");
    b.bedrag_model = eur(post.bedrag_verhuurder);
    b.automatisering = "automatisch";
    b.menselijke_controle_nodig = false;
    b.toelichting.push("Meterstanden bekend en niet betwist; de werkelijk gemaakte kosten volgens factuur zijn uitgangspunt (p. 11).");
    if (normbedrag !== null) b.berekening.push(`Referentie Nibud-norm voor dit jaar: EUR ${normbedrag.toFixed(2)} (ter vergelijking).`);
    if (par.collectieve_factuur) {
      b.regels.push("R-NUT-05");
      b.ontbrekende_informatie.push("Collectieve factuur voor meerdere woonruimten: de toegepaste verdeelsleutel moet worden getoetst (voetnoot 3, p. 11; par. 4.2.1, p. 26).");
      b.menselijke_controle_nodig = true;
      b.automatisering = "semi-automatisch";
    }
    return rondStatus(b);
  }

  /* --------------------------------------- nutsvoorzieningen zonder meter */

  function nutsvoorzieningZonderMeter(post, dossier) {
    const b = nieuweBeoordeling(post);
    if (!controleerGrondslag(post, b)) return b;
    const par = post.parameters || {};
    const w = dossier.woonruimte, p = dossier.periode;
    const bewijs = post.bewijs || [];

    if (!bewijs.includes("facturen") || !bewijs.includes("specificatieformulier")) {
      if (post.levering_gemotiveerd_betwist && !bewijs.includes("facturen")) {
        b.regels.push("R-BEW-03");
        b.bedrag_model = 0;
        b.toelichting.push("Geen facturen en levering gemotiveerd betwist: kosten op EUR 0,00 (par. 6.4.2 categorie 2, p. 61).");
        return rondStatus(b);
      }
      b.regels.push("R-BEW-02");
      const meterCategorie = { "NUT-GAS-ZM": "NUT-GAS-METER", "NUT-ELK-ZM": "NUT-ELK-METER", "NUT-WATER-ZM": "NUT-WATER-METER" }[post.categorie];
      b.bedrag_model = forfaitNuts(dossier, meterCategorie, b);
      b.toelichting.push("Specificatieformulier en/of facturen ontbreken, of het aandeel van de huurder is niet bepaalbaar: het bedrag wordt bepaald op het niveau van het wettelijk vastgestelde verbruik en tarief (par. 6.4.2 categorie 2, p. 61).");
      return rondStatus(b);
    }

    const totaal = getal(par.totale_kosten_complex);
    if (totaal === null) {
      b.ontbrekende_informatie.push("Totale kosten van het complex ontbreken; verdeelsleutel niet toepasbaar.");
      return rondStatus(b);
    }
    const aantal = w.aantal_woonruimten_complex;
    if (!aantal) {
      b.ontbrekende_informatie.push("Aantal woonruimten in het complex ontbreekt (par. 4.2.1, p. 26).");
      return rondStatus(b);
    }

    let aandeel, periodefactor, methode;
    if (post.categorie === "NUT-GAS-ZM") {
      b.regels.push("R-VDS-01");
      const cfg = NORMEN.gas.verdeelsleutel_zonder_eigen_meter;
      if (w.oppervlakte_m2 == null || !w.totale_oppervlakte_complex_m2) {
        b.ontbrekende_informatie.push("Vloeroppervlakte van de woonruimte en/of van het complex ontbreekt; de variabele gaskosten (65%) worden naar vloeroppervlakte verdeeld (p. 26).");
        return rondStatus(b);
      }
      const vast = totaal * cfg.aandeel_vaste_kosten / aantal;
      const variabel = totaal * cfg.aandeel_variabele_kosten * Number(w.oppervlakte_m2) / Number(w.totale_oppervlakte_complex_m2);
      aandeel = eur(vast) + eur(variabel);
      b.berekening.push(`Vaste kosten 35% van EUR ${eur(totaal).toFixed(2)} = EUR ${eur(totaal * 0.35).toFixed(2)}, gelijk over ${aantal} woonruimten = EUR ${eur(vast).toFixed(2)} (par. 4.2.1, p. 26).`);
      b.berekening.push(`Variabele kosten 65% van EUR ${eur(totaal).toFixed(2)} = EUR ${eur(totaal * 0.65).toFixed(2)}, naar oppervlakte ${w.oppervlakte_m2}/${w.totale_oppervlakte_complex_m2} = EUR ${eur(variabel).toFixed(2)}.`);
      periodefactor = volledigJaar(p) ? 1 : graaddagenfactor(dossier);
      if (periodefactor !== 1) b.regels.push("R-PER-01");
      methode = "graaddagenmethode (par. 4.2.2, p. 28)";
    } else {
      b.regels.push("R-VDS-02");
      aandeel = eur(totaal / aantal);
      b.berekening.push(`Gelijke verdeling over ${aantal} woonruimten: EUR ${eur(totaal).toFixed(2)} / ${aantal} = EUR ${aandeel.toFixed(2)} (par. 4.2.1, p. 27).`);
      if (post.categorie === "NUT-ELK-ZM") {
        periodefactor = volledigJaar(p) ? 1 : seizoensfactor(dossier);
        if (periodefactor !== 1) b.regels.push("R-PER-02");
        methode = "seizoenspatronen (par. 4.2.2, p. 28)";
      } else {
        periodefactor = maandfactor(dossier);
        if (periodefactor !== 1) b.regels.push("R-PER-03");
        methode = "evenredig deel van het jaar (par. 4.2.2, p. 28)";
      }
    }
    if (periodefactor !== 1) b.berekening.push(`Periodefactor ${periodefactor.toFixed(6)} volgens ${methode}.`);
    b.bedrag_model = eur(aandeel * periodefactor);
    b.automatisering = "automatisch";
    b.menselijke_controle_nodig = false;
    return rondStatus(b);
  }

  /* -------------------------------------------------------- roerende zaken */

  function roerendeZaken(post, dossier) {
    const b = nieuweBeoordeling(post);
    if (!controleerGrondslag(post, b)) return b;
    const par = post.parameters || {};
    const cfg = NORMEN.roerende_zaken;
    const soort = par.soort || "standaard";

    if (par.roerend === false) {
      b.regels.push("R-ROE-01");
      b.bedrag_model = 0;
      b.toelichting.push("Onroerende zaak: hiervoor kan geen gebruiksvergoeding in de servicekosten worden opgenomen; de kosten worden geacht deel uit te maken van de kale huurprijs (par. 4.3.3, p. 31).");
      return rondStatus(b);
    }
    if (par.roerend === null || par.roerend === undefined) {
      b.regels.push("R-ROE-01");
      b.ontbrekende_informatie.push("Roerend of onroerend? Kan de zaak worden weggenomen zonder beschadiging van betekenis? (par. 4.3.3, p. 31). Vereist menselijke/feitelijke beoordeling.");
      b.menselijke_controle_nodig = true;
    }

    if (soort === "rookmelder") {
      b.regels.push("R-ROE-07");
      b.bedrag_model = 0;
      b.ontbrekende_informatie.length = 0;
      b.toelichting.push("Rookmelders zijn sinds 1 juli 2022 verplicht op grond van het Bouwbesluit; de kosten komen voor rekening van de verhuurder en er mag geen gebruiksvergoeding worden gevraagd (par. 4.3.3, p. 33).");
      return rondStatus(b);
    }

    let waarde = getal(par.aanschafwaarde);
    let waardebron = "aankoopfactuur";
    if (waarde === null) { waarde = getal(par.geschatte_waarde); waardebron = "schatting"; }
    if (waarde === null) {
      b.regels.push("R-ROE-02");
      const standaard = cfg.wettelijk_standaardbedrag_per_jaar_zonder_gegevens;
      b.bedrag_model = eur(standaard * maandfactor(dossier));
      b.toelichting.push(`Geen aankoopfacturen en geen inzicht in de samenstelling van de roerende zaken: het wettelijk vastgestelde standaardbedrag van EUR ${standaard} per jaar wordt aangehouden (par. 4.3.3, p. 31; par. 6.4.2, p. 61).`);
      return rondStatus(b);
    }

    let levensduur, percentage;
    if (soort === "zonnepanelen") {
      const z = cfg.zonnepanelen;
      levensduur = z.levensduur_jaren; percentage = z.afschrijvingspercentage;
      waarde = waarde + z.opslag_op_aanschafwaarde_eur;
      b.regels.push("R-ROE-05");
      b.berekening.push(`Grondslag zonnepanelen: aanschafwaarde + opslag EUR ${z.opslag_op_aanschafwaarde_eur} = EUR ${eur(waarde).toFixed(2)} (par. 4.3.3, p. 32).`);
    } else if (soort === "brandbeveiliging") {
      const z = cfg.brandbeveiligingsmiddelen;
      levensduur = 10; percentage = z.afschrijvingspercentage;
      waarde = waarde * z.aandeel_waarde_huurder;
      b.regels.push("R-ROE-06");
      b.berekening.push(`Brandbeveiligingsmiddelen: 50% van de waarde telt mee = EUR ${eur(waarde).toFixed(2)} (par. 4.3.3, p. 33).`);
    } else if (soort === "camera") {
      const z = cfg.beveiligingscameras;
      levensduur = 5; percentage = z.afschrijvingspercentage;
      waarde = waarde * z.aandeel_waarde_huurder;
      b.regels.push("R-ROE-06");
      b.berekening.push(`Beveiligingscamera's: 70% van de waarde telt mee = EUR ${eur(waarde).toFixed(2)} (par. 4.3.3, p. 34).`);
    } else if (soort === "wasapparatuur") {
      const z = cfg.industriele_wasmachines_en_wasdrogers;
      levensduur = z.levensduur_jaren; percentage = z.afschrijvingspercentage_eerste_periode;
      b.regels.push("R-ROE-04");
    } else {
      levensduur = Number(par.levensduur_jaren || cfg.standaard_levensduur_jaren);
      const sleutel = String(levensduur);
      if (!(sleutel in cfg.afschrijving_per_levensduur)) {
        b.ontbrekende_informatie.push(`Het beleidsboek noemt afschrijvingspercentages bij een levensduur van 5, 10 of 15 jaar (p. 31); voor ${levensduur} jaar is geen percentage gegeven.`);
        return rondStatus(b);
      }
      percentage = cfg.afschrijving_per_levensduur[sleutel];
      b.regels.push("R-ROE-03");
    }

    const jaarInGebruik = getal(par.jaar_in_gebruik);
    if (jaarInGebruik === null) {
      b.ontbrekende_informatie.push("Aanschafjaar/gebruiksjaar van de zaak ontbreekt; zonder dat is niet vast te stellen of de eerste of de tweede afschrijvingsperiode geldt (p. 32).");
      return rondStatus(b);
    }

    let jaarbedrag;
    if (jaarInGebruik > 2 * levensduur) {
      if (par.vertegenwoordigt_nog_waarde === true) {
        b.ontbrekende_informatie.push("De zaak is na twee afschrijvingsperioden nog van waarde; een nieuwe waardebepaling is nodig (p. 32). Handmatige beoordeling.");
        b.menselijke_controle_nodig = true;
        return rondStatus(b);
      }
      b.bedrag_model = 0;
      b.toelichting.push("Na twee afschrijvingsperioden vertegenwoordigt de zaak geen waarde meer; de betalingsverplichting kan op EUR 0,00 worden gesteld (par. 4.3.3, p. 32).");
      return rondStatus(b);
    }
    if (jaarInGebruik > levensduur) {
      if (soort === "wasapparatuur") {
        const z = cfg.industriele_wasmachines_en_wasdrogers;
        jaarbedrag = waarde * z.afschrijvingspercentage_tweede_periode_over_oorspronkelijke_waarde;
        b.berekening.push(`Tweede periode van tien jaar: 6% van de oorspronkelijke waarde EUR ${eur(waarde).toFixed(2)} = EUR ${eur(jaarbedrag).toFixed(2)} (par. 4.3.3, p. 34).`);
      } else {
        const nieuweWaarde = waarde * cfg.herwaardering_na_afschrijvingsperiode;
        jaarbedrag = nieuweWaarde * percentage;
        b.berekening.push(`Herwaardering 60% van EUR ${eur(waarde).toFixed(2)} = EUR ${eur(nieuweWaarde).toFixed(2)}; ${(percentage * 100).toFixed(2)}% per jaar = EUR ${eur(jaarbedrag).toFixed(2)} (par. 4.3.3, p. 32).`);
      }
    } else {
      jaarbedrag = waarde * percentage;
      b.berekening.push(`Gebruiksvergoeding ${(percentage * 100).toFixed(2)}% van EUR ${eur(waarde).toFixed(2)} = EUR ${eur(jaarbedrag).toFixed(2)} (levensduur ${levensduur} jaar, par. 4.3.3, p. 31).`);
    }

    const aantal = Number(par.aantal_woonruimten || 1);
    if (aantal > 1) {
      jaarbedrag = jaarbedrag / aantal;
      b.berekening.push(`Verdeeld over ${aantal} woonruimten = EUR ${eur(jaarbedrag).toFixed(2)} per woonruimte.`);
    }
    let bedrag = jaarbedrag * maandfactor(dossier);
    if (soort === "wasapparatuur") {
      const z = cfg.industriele_wasmachines_en_wasdrogers;
      const maximum = z.maximum_per_woonruimte_per_maand_eur * maanden(dossier.periode).length;
      if (bedrag > maximum) {
        b.berekening.push(`Maximum EUR ${z.maximum_per_woonruimte_per_maand_eur} per woonruimte per maand x ${maanden(dossier.periode).length} maanden = EUR ${eur(maximum).toFixed(2)}; dit maximum geldt (par. 4.3.3, p. 34).`);
        bedrag = maximum;
      }
    }
    b.bedrag_model = eur(bedrag);
    if (waardebron !== "aankoopfactuur") {
      b.toelichting.push("Waarde geschat op basis van inzicht in de samenstelling van de roerende zaken (verkoopwaarde aan het begin van het boekjaar, p. 31); geen aankoopfacturen aanwezig.");
      b.menselijke_controle_nodig = true;
    } else {
      b.automatisering = "automatisch";
      b.menselijke_controle_nodig = b.menselijke_controle_nodig || b.ontbrekende_informatie.length > 0;
    }
    return rondStatus(b);
  }

  /* ------------------------------------------------------------ huismeester */

  function huismeester(post, dossier) {
    const b = nieuweBeoordeling(post);
    if (!controleerGrondslag(post, b)) return b;
    const par = post.parameters || {};
    const cfg = NORMEN.huismeester;
    const bewijs = post.bewijs || [];
    b.regels.push("R-HUI-01");

    if (!bewijs.includes("facturen") && !bewijs.includes("urenverantwoording")) {
      b.regels.push("R-BEW-02");
      b.ontbrekende_informatie.push("Opvragen bij verhuurder: functieomschrijving, facturen dienstverleningsbedrijf en urenverantwoording/kosten eigen beheer (par. 4.3.6, p. 41).");
      return rondStatus(b);
    }
    const uren = getal(par.uren);
    const totaleKosten = getal(par.totale_kosten);
    const aantal = par.aantal_woonruimten || dossier.woonruimte.aantal_woonruimten_complex;
    if (uren === null || totaleKosten === null || !aantal) {
      b.ontbrekende_informatie.push("Voor de toets aan het maximale uurtarief zijn het aantal gewerkte uren, de totale kosten en het aantal woonruimten nodig (par. 4.3.6, p. 40-41).");
      return rondStatus(b);
    }
    let maxtarief;
    try { maxtarief = huismeesterTarief(dossier.periode.jaar); }
    catch (fout) { b.ontbrekende_informatie.push(fout.message); return rondStatus(b); }

    const getoetst = Math.min(totaleKosten, uren * maxtarief);
    b.berekening.push(`Toets aan maximaal uurtarief: ${uren} uur x EUR ${maxtarief} = EUR ${eur(uren * maxtarief).toFixed(2)}; gefactureerd EUR ${eur(totaleKosten).toFixed(2)} -> getoetst EUR ${eur(getoetst).toFixed(2)} (Tabel 9, p. 40).`);
    const aandeel = Number(par.aandeel_huurders || cfg.aandeel_huurders);
    const tenLaste = getoetst * aandeel;
    b.berekening.push(`${(aandeel * 100).toFixed(0)}% ten laste van de huurders = EUR ${eur(tenLaste).toFixed(2)}; ${((1 - aandeel) * 100).toFixed(0)}% blijft voor rekening van de verhuurder (p. 41).`);
    const perWoonruimte = tenLaste / aantal;
    b.berekening.push(`Per woonruimte: EUR ${eur(tenLaste).toFixed(2)} / ${aantal} = EUR ${eur(perWoonruimte).toFixed(2)}.`);
    b.bedrag_model = eur(perWoonruimte * maandfactor(dossier));
    b.toelichting.push("De Huurcommissie kan van de 70/30-verdeling afwijken als de feitelijke werkzaamheden een andere verdeling rechtvaardigen (p. 41); dat is een inhoudelijke weging.");
    b.menselijke_controle_nodig = true;
    return rondStatus(b);
  }

  function externeBeveiliging(post, dossier) {
    const b = nieuweBeoordeling(post);
    if (!controleerGrondslag(post, b)) return b;
    const cfg = NORMEN.externe_beveiliging;
    const par = post.parameters || {};
    b.regels.push("R-HUI-02");
    if (!(post.bewijs || []).includes("facturen")) {
      b.ontbrekende_informatie.push("Facturen van de beveiligingsdienst ontbreken (p. 41).");
      return rondStatus(b);
    }
    if (par.gecertificeerd !== true) {
      b.ontbrekende_informatie.push("De beveiligingsdienst is niet (aantoonbaar) gecertificeerd; de Huurcommissie vraagt dan de onderliggende stukken op (p. 41).");
    }
    const totaleKosten = getal(par.totale_kosten);
    const aantal = par.aantal_woonruimten || dossier.woonruimte.aantal_woonruimten_complex;
    if (totaleKosten === null || !aantal) {
      b.ontbrekende_informatie.push("Totale kosten en/of aantal woonruimten ontbreken.");
      return rondStatus(b);
    }
    const bedrag = totaleKosten * cfg.aandeel_huurders / aantal * maandfactor(dossier);
    b.berekening.push(`70% van EUR ${eur(totaleKosten).toFixed(2)} = EUR ${eur(totaleKosten * cfg.aandeel_huurders).toFixed(2)}, verdeeld over ${aantal} woonruimten = EUR ${eur(bedrag).toFixed(2)} (p. 41).`);
    b.bedrag_model = eur(bedrag);
    b.menselijke_controle_nodig = true;
    return rondStatus(b);
  }

  /* ------------------------------------------------------ administratiekosten */

  function administratiekosten(post, dossier) {
    const b = nieuweBeoordeling(post);
    const par = post.parameters || {};
    const cfg = NORMEN.administratiekosten;
    b.regels.push("R-ADM-01");
    b.toelichting.push("Administratiekosten hangen zo nauw samen met de servicekosten dat zij niet uitdrukkelijk overeengekomen hoeven te zijn (par. 4.3.11, p. 43).");

    if (par.afrekening_verstrekt === false) {
      b.regels.push("R-ADM-02");
      b.bedrag_model = 0;
      b.toelichting.push("Administratiekosten kunnen alleen in rekening worden gebracht als een afrekening aan de huurder is verstrekt (p. 43). Een te late afrekening mag wel.");
      return rondStatus(b);
    }
    const warmte = getal(par.grondslag_warmtelevering);
    const overig = getal(par.grondslag_overige_posten);
    if (warmte === null && overig === null) {
      b.ontbrekende_informatie.push("Grondslag ontbreekt: over welke kostenposten (warmtelevering vs. overige) worden de administratiekosten berekend? (p. 43)");
      return rondStatus(b);
    }
    let maximum = 0;
    if (warmte !== null) {
      const pct = par.meting_uitbesteed ? cfg.max_percentage_warmtelevering_uitbesteed : cfg.max_percentage_warmtelevering;
      maximum += warmte * pct;
      b.berekening.push(`Warmtelevering: ${(pct * 100).toFixed(0)}% van EUR ${eur(warmte).toFixed(2)} = EUR ${eur(warmte * pct).toFixed(2)} (${par.meting_uitbesteed ? "meting/verdeling uitbesteed" : "in eigen beheer"}, p. 43).`);
    }
    if (overig !== null) {
      const pct = cfg.max_percentage_overige_posten;
      maximum += overig * pct;
      b.berekening.push(`Overige kostenposten: ${(pct * 100).toFixed(0)}% van EUR ${eur(overig).toFixed(2)} = EUR ${eur(overig * pct).toFixed(2)} (p. 43).`);
    }
    const ondergrens = cfg.minimum_per_afrekening_per_woonruimte_eur;
    const bovengrens = cfg.maximum_per_afrekening_per_woonruimte_eur;
    let toegestaan = Math.min(eur(post.bedrag_verhuurder), maximum);
    if (toegestaan > bovengrens) {
      toegestaan = bovengrens;
      b.berekening.push(`Begrensd op het maximum van EUR ${bovengrens} per afrekening per woonruimte (p. 43).`);
    }
    if (eur(post.bedrag_verhuurder) <= ondergrens && toegestaan < ondergrens) {
      toegestaan = Math.min(eur(post.bedrag_verhuurder), ondergrens);
      b.berekening.push(`Minimumbedrag EUR ${ondergrens} per afrekening per woonruimte toegepast (p. 43).`);
    }
    b.bedrag_model = eur(toegestaan);
    b.automatisering = "automatisch";
    b.menselijke_controle_nodig = false;
    return rondStatus(b);
  }

  /* ----------------------------------------- generieke overige servicekosten */

  const CONFIG = {
    "SK-01": { regel: "R-SK-01", bron: "par. 4.3.1, p. 30" },
    "SK-02": { regel: "R-SK-02", bron: "par. 4.3.2, p. 30" },
    "SK-04-GLAS": {
      regel: "R-KH-01", bron: "par. 4.3.4, p. 36",
      voorwaarde: ["ruiten_bereikbaar", "Zijn de ruiten voor de huurder bereikbaar? Zo nee, dan zijn de kosten niet doorberekenbaar (p. 36)."],
      forfait: ["glazenwassen_zonder_specificatie", "aandeel_arbeidskosten_huurder", "kosten_gespecificeerd"],
      forfait_altijd: true,
    },
    "SK-04-SCHOONMAAK": {
      regel: "R-KH-02", bron: "par. 4.3.4, p. 36",
      uitsluiting: ["betreft_mutatiekosten", "Mutatiekosten (begin- en eindschoonmaak bij verhuizing) mogen niet bij de huurder in rekening worden gebracht (p. 36)."],
    },
    "SK-04-TUIN": {
      regel: "R-KH-03", bron: "par. 4.3.4, p. 37", handmatig: true,
      voorwaarde: ["exclusief_gebruiksrecht", "Heeft de huurder het exclusieve gebruiksrecht van de groenvoorziening? Bij een openbaar karakter of een kijktuin blijven de kosten voor rekening van de verhuurder (p. 37)."],
    },
    "SK-04-GLADHEID": {
      regel: "R-KH-04", bron: "par. 4.3.4, p. 37",
      voorwaarde: ["exclusief_gebruiksrecht", "Heeft de huurder het exclusieve (gezamenlijke) gebruiksrecht van de buitenruimte? (p. 37)"],
    },
    "SK-04-ONTSTOPPING": {
      regel: "R-KH-05", bron: "par. 4.3.4, p. 37",
      voorwaarde: ["leidingen_bereikbaar_en_individueel", "Bevinden de leidingen zich in of aan de woonruimte en zijn ze voor de huurder bereikbaar? Leidingen voor meerdere zelfstandige woonruimten en werkzaamheden door een technisch gebrek blijven voor rekening van de verhuurder (p. 37)."],
      forfait: ["ontstoppingscontract", "aandeel_huurder", "kosten_gespecificeerd"],
      forfait_altijd_bij: "onderhoudscontract",
    },
    "SK-04-SCHOORSTEEN": {
      regel: "R-KH-06", bron: "par. 4.3.4, p. 38",
      voorwaarde: ["kanaal_bereikbaar", "Is de schoorsteen of het kanaal voor de huurder bereikbaar? (p. 38)"],
    },
    "SK-04-LAMPEN": {
      regel: "R-KH-07", bron: "par. 4.3.4, p. 38",
      uitsluiting: ["betreft_armaturen_of_installatie", "Vervangen van armaturen, vernieuwen of repareren van de installatie en vandalismeschade blijven voor rekening van de verhuurder (p. 38)."],
    },
    "SK-04-ONGEDIERTE": {
      regel: "R-KH-08", bron: "par. 4.3.4, p. 38",
      uitsluiting: ["gevolg_bouwkundige_situatie", "Als het ongedierte het gevolg is van een bouwkundige situatie komen de kosten voor rekening van de verhuurder; de huurder moet dit aannemelijk maken (p. 38)."],
    },
    "SK-04-INSTALLATIE": {
      regel: "R-KH-09", bron: "par. 4.3.4, p. 38-39",
      voorwaarde: ["eenvoudig_onderhoud_binnen_woonruimte", "Gaat het om onderhoudstechnisch eenvoudige werkzaamheden zonder specialistische kennis en zonder noemenswaardige kosten aan een installatie binnen de woonruimte? Periodiek onderhoud aan aard- en nagelvaste (onroerende) installaties, klein onderhoud daaraan en keuringskosten zijn niet doorberekenbaar (p. 39)."],
    },
    "SK-04-SCHILDERWERK": {
      regel: "R-KH-10", bron: "par. 4.3.4, p. 39", handmatig: true,
      voorwaarde: ["uitdrukkelijk_overeengekomen_of_op_verzoek_huurder", "Is het schilderwerk uitdrukkelijk overeengekomen (of bij aanvang op verzoek van de huurder uitgevoerd)? Zo niet, dan wordt het geacht te zijn verricht om de woonruimte verhuurbaar te maken en zijn de kosten niet doorberekenbaar (p. 39)."],
    },
    "SK-05": { regel: "R-SK-05", bron: "par. 4.3.5, p. 39-40" },
    "SK-07": { regel: "R-SK-07", bron: "par. 4.3.7, p. 42" },
    "SK-08": { regel: "R-SK-08", bron: "par. 4.3.8, p. 42" },
    "SK-09-GLAS": {
      regel: "R-VZ-02", bron: "par. 4.3.9, p. 43",
      forfait: ["glasverzekering_binnen_opstalverzekering", "aandeel_glasverzekering", "kosten_gespecificeerd"],
      forfait_altijd_bij: "onderdeel_van_opstalverzekering",
    },
    "SK-09-OPSTAL": {
      regel: "R-VZ-01", bron: "par. 4.3.9, p. 42-43", nooit_doorberekenbaar: true,
      reden: "Verzekeringen die direct verband houden met de onroerende zaak blijven voor rekening van de verhuurder (p. 42-43).",
    },
    "SK-09-INBOEDEL": { regel: "R-VZ-03", bron: "par. 4.3.9, p. 43" },
    "SK-10": { regel: "R-SK-10", bron: "par. 4.3.10, p. 43" },
    "SK-12": {
      regel: "R-SK-12", bron: "par. 4.3.12, p. 44",
      forfait: ["onderhoudscontract_24uursservice", "aandeel_24uursservice", "kosten_gespecificeerd"],
      forfait_altijd: true,
    },
    "SK-13": { regel: "R-SK-13", bron: "par. 4.3.13, p. 44", fonds: true },
    "SK-14-WKO": {
      regel: "R-WKO-01", bron: "par. 5.4, p. 49-50", handmatig: true,
      voorwaarde: ["vaste_kosten_gesplitst", "Zijn de vaste kosten gesplitst in kapitaals- en onderhoudslasten van de WKO-installatie (niet doorberekenbaar, want te dekken uit de kale huurprijs) en de overige vaste kosten (wel doorberekenbaar)? Zonder die splitsing is het doorberekenbare deel niet vast te stellen (par. 5.4, p. 49)."],
    },
    "NSK-01": {
      regel: "R-NSK-01", bron: "par. 4.3.14, p. 44", nooit_doorberekenbaar: true,
      reden: "Het is niet toegestaan gederfde servicekosten als gevolg van leegstand aan de zittende huurders door te berekenen (p. 44).",
    },
    "NSK-02": {
      regel: "R-NSK-02", bron: "par. 4.3.15, p. 44", buiten_bevoegdheid: true,
      reden: "Belastingen en heffingen maken geen onderdeel uit van de servicekosten; de Huurcommissie is niet bevoegd hierover uitspraak te doen (p. 44, p. 51).",
    },
    "NSK-03": {
      regel: "R-NSK-03", bron: "par. 4.3.16, p. 45", buiten_bevoegdheid: true,
      reden: "De Huurcommissie doet alleen uitspraak over woonservicekosten, niet over zorgservicekosten (p. 45).",
    },
  };

  function overigeServicekost(post, dossier) {
    const b = nieuweBeoordeling(post);
    const cfg = CONFIG[post.categorie];
    const par = post.parameters || {};
    b.regels.push(cfg.regel);

    if (cfg.buiten_bevoegdheid) {
      b.status = "BUITEN_BEVOEGDHEID";
      b.toelichting.push(`${cfg.reden} (${cfg.bron})`);
      b.automatisering = "automatisch";
      b.menselijke_controle_nodig = false;
      return b;
    }
    if (cfg.nooit_doorberekenbaar) {
      b.bedrag_model = 0;
      b.toelichting.push(`${cfg.reden} (${cfg.bron})`);
      b.automatisering = "automatisch";
      b.menselijke_controle_nodig = false;
      return rondStatus(b);
    }
    if (!controleerGrondslag(post, b)) return b;

    if (dossier.woonruimte.gebruikt_gemeenschappelijke_ruimten === false && par.betreft_gemeenschappelijke_voorziening) {
      b.regels.push("R-VDS-04");
      b.bedrag_model = 0;
      b.toelichting.push("De huurder maakt geen gebruik van de gemeenschappelijke ruimten of voorzieningen en hoeft dat ook niet; dan hoeft hij daarvoor niet te betalen (p. 29).");
      return rondStatus(b);
    }
    if (cfg.uitsluiting && par[cfg.uitsluiting[0]] === true) {
      b.bedrag_model = 0;
      b.toelichting.push(cfg.uitsluiting[1]);
      return rondStatus(b);
    }
    if (cfg.voorwaarde) {
      const waarde = par[cfg.voorwaarde[0]];
      if (waarde === false) {
        b.bedrag_model = 0;
        b.toelichting.push("Niet doorberekenbaar: " + cfg.voorwaarde[1]);
        return rondStatus(b);
      }
      if (waarde === null || waarde === undefined) {
        b.ontbrekende_informatie.push(cfg.voorwaarde[1]);
        b.menselijke_controle_nodig = true;
      }
    }
    if (cfg.fonds) {
      const voldaan = par.voldaan_aan_voorwaarden || [];
      const ontbreekt = NORMEN.fondsen.voorwaarden.filter((v) => !voldaan.includes(v));
      if (ontbreekt.length) {
        b.ontbrekende_informatie.push("Fondsvoorwaarden nog niet aangetoond: " + ontbreekt.join("; ") + " (par. 4.3.13, p. 44).");
        b.menselijke_controle_nodig = true;
      }
    }

    const bewijs = post.bewijs || [];
    const heeftFacturen = bewijs.includes("facturen");
    const heeftFormulier = bewijs.includes("specificatieformulier");
    if (!heeftFacturen && post.levering_gemotiveerd_betwist) {
      b.regels.push("R-BEW-03");
      b.bedrag_model = 0;
      b.ontbrekende_informatie.length = 0;
      b.toelichting.push("De levering van de zaak of dienst wordt gemotiveerd betwist en de verhuurder heeft geen facturen of andere betaalbewijzen overgelegd: de kosten worden op EUR 0,00 gesteld (par. 6.4.2 categorie 2, p. 61; art. 18 lid 4 Uhw).");
      return rondStatus(b);
    }
    if (!heeftFacturen || !heeftFormulier) {
      b.regels.push("R-BEW-02");
      b.bedrag_model = eur(NORMEN.forfaits_bij_ontbrekende_onderbouwing.vast_bedrag_overige_kostenposten_per_jaar_eur * maandfactor(dossier));
      const ontbrekend = [];
      if (!heeftFormulier) ontbrekend.push("specificatieformulier (bijlage VII Uitvoeringsregeling huurprijzen woonruimte)");
      if (!heeftFacturen) ontbrekend.push("facturen of andere betaalbewijzen");
      b.toelichting.push("Ontbrekende onderbouwing (" + ontbrekend.join(" en ") + ") terwijl de levering niet gemotiveerd wordt betwist: de Huurcommissie houdt voor deze kostenpost doorgaans EUR 12,00 per jaar aan (par. 6.4.2, p. 60-61).");
      b.automatisering = "automatisch";
      b.menselijke_controle_nodig = true;
      return rondStatus(b);
    }

    let basisbedrag = par.werkelijke_kosten != null ? Number(par.werkelijke_kosten) : eur(post.bedrag_verhuurder);
    if (cfg.forfait) {
      const [sleutel, veldnaam, voorwaardeVeld] = cfg.forfait;
      const gespecificeerd = par[voorwaardeVeld];
      const vanToepassing = cfg.forfait_altijd || (cfg.forfait_altijd_bij ? par[cfg.forfait_altijd_bij] === true : false);
      if (vanToepassing && gespecificeerd !== true) {
        const aandeel = breuk(NORMEN.forfaitaire_verdelingen[sleutel][veldnaam]);
        b.berekening.push(`Kosten niet gespecificeerd: forfaitair aandeel ${(aandeel * 100).toFixed(2)}% van EUR ${eur(basisbedrag).toFixed(2)} = EUR ${eur(basisbedrag * aandeel).toFixed(2)} (${cfg.bron}).`);
        basisbedrag = basisbedrag * aandeel;
      }
    }
    const aantal = par.aantal_woonruimten;
    const isComplextotaal = par.bedrag_is_complextotaal !== false;
    if (aantal && Number(aantal) > 1 && isComplextotaal) {
      b.regels.push("R-VDS-03");
      b.berekening.push(`Verdeeld over ${aantal} woonruimten die gebruik (kunnen) maken van de zaak of dienst: EUR ${eur(basisbedrag).toFixed(2)} / ${aantal} = EUR ${eur(basisbedrag / Number(aantal)).toFixed(2)} (p. 29).`);
      basisbedrag = basisbedrag / Number(aantal);
    }
    b.bedrag_model = eur(basisbedrag * maandfactor(dossier));
    if (cfg.handmatig) {
      b.automatisering = "handmatig";
      b.menselijke_controle_nodig = true;
    } else if (b.ontbrekende_informatie.length) {
      b.automatisering = "semi-automatisch";
    } else {
      b.automatisering = "automatisch";
      b.menselijke_controle_nodig = false;
    }
    return rondStatus(b);
  }

  const HANDLERS = {};
  for (const c of ["NUT-GAS-METER", "NUT-ELK-METER", "NUT-WATER-METER"]) HANDLERS[c] = nutsvoorzieningMetMeter;
  for (const c of ["NUT-GAS-ZM", "NUT-ELK-ZM", "NUT-WATER-ZM"]) HANDLERS[c] = nutsvoorzieningZonderMeter;
  HANDLERS["SK-03"] = roerendeZaken;
  HANDLERS["SK-06"] = huismeester;
  HANDLERS["SK-06B"] = externeBeveiliging;
  HANDLERS["SK-11"] = administratiekosten;
  for (const c of Object.keys(CONFIG)) HANDLERS[c] = overigeServicekost;

  global.KernHandlers = HANDLERS;
  global.Kern = { eur, HANDLERS, CONFIG, init, beoordeelDossier, maandfactor, graaddagenfactor, seizoensfactor,
                  nibudGas, nibudElektriciteit, nibudWater, normen: () => NORMEN };

  function init(data) {
    NORMEN = data.normen;
    CATEGORIEEN = data.categorieen || null;
  }

  /* ---------------------------------------------- ontvankelijkheid + motor */

  function controleerOntvankelijkheid(dossier) {
    const bevindingen = [];
    const proc = dossier.procedure || {};
    const jaar = dossier.periode.jaar;
    const t = NORMEN.termijnen;
    const gesloten = proc.contract_gesloten_op ? new Date(proc.contract_gesloten_op) : null;

    if (!gesloten) {
      bevindingen.push("ORANJE - Datum huurovereenkomst onbekend; die bepaalt of de Huurcommissie uitspraak kan doen of alleen kan adviseren (par. 6.2.1, p. 51-52).");
    } else if (gesloten < new Date("2024-07-01")) {
      if (proc.sector === "vrij") {
        bevindingen.push("LET OP - Huurovereenkomst gesloten voor 1 juli 2024 en woning in de vrije sector: de Huurcommissie kan alleen een advies uitbrengen, en alleen als beide partijen daar schriftelijk mee instemmen (par. 6.2.1, p. 52). Bij minder dan 143 punten op de peildatum 1 juli 2024 kan de huurprijs sinds 1 juli 2025 wel worden getoetst, waarna de servicekostenprocedure alsnog openstaat (par. 6.2.2, p. 53-55).");
      } else if (!proc.sector) {
        bevindingen.push("ORANJE - Sector (sociaal/vrij) onbekend voor een contract van voor 1 juli 2024; bepalend voor uitspraak versus advies (par. 6.2.1, p. 51-52).");
      }
    }

    const tabel = t.uiterste_datums_per_boekjaar;
    if (String(jaar) in tabel) {
      const uiterste = new Date(tabel[String(jaar)].uiterste_verzoekdatum);
      const verzoek = proc.verzoekdatum ? new Date(proc.verzoekdatum) : new Date();
      const label = proc.verzoekdatum ? "verzoekdatum" : "beoogde verzoekdatum";
      const nl = (d) => d.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
      if (verzoek > uiterste) {
        bevindingen.push(`ROOD - Boekjaar ${jaar}: de wettelijke indieningstermijn liep tot en met ${nl(uiterste)}; de ${label} (${nl(verzoek)}) ligt daarna. Het verzoek is niet-ontvankelijk (par. 6.3.3, Tabel 10, p. 56).`);
      } else {
        bevindingen.push(`OK - Boekjaar ${jaar}: verzoek kan worden ingediend tot en met ${nl(uiterste)} (Tabel 10, p. 56).`);
      }
    } else {
      bevindingen.push(`ORANJE - Het beleidsboek noemt geen uiterste verzoekdatum voor boekjaar ${jaar} (Tabel 10 loopt van 2023 tot en met 2026, p. 56). Zelf afleiden: uiterlijk tweeeneenhalf jaar na afloop van het kalenderjaar.`);
    }

    if (proc.afrekening_ontvangen === true && proc.bezwaar_gemaakt !== true) {
      bevindingen.push("ROOD - De afrekening is verstrekt maar er is geen schriftelijk bezwaar bij de verhuurder gemaakt. Zonder die schriftelijke kennisgeving verklaart de Huurcommissie het verzoek niet-ontvankelijk (par. 6.3.1, p. 56). Uitzondering: het einde van de indieningstermijn is zo nabij dat bezwaar plus drie weken reactietijd niet meer haalbaar is (par. 6.3.3, p. 57).");
    }
    if (proc.afrekening_ontvangen === false && proc.afrekening_opgevraagd !== true) {
      bevindingen.push("ROOD - Er is geen afrekening ontvangen en de huurder heeft deze niet schriftelijk opgevraagd. De opvraagplicht met een termijn van drie weken geldt eerst (par. 6.3.2, p. 57), met dezelfde uitzondering bij een naderende indieningstermijn.");
    }

    const drempel = NORMEN.drempelbedragen.minimum_betwiste_kosten_jaarafrekening_eur.waarde;
    const betwist = eur((dossier.kostenposten || []).reduce((s, p) => s + eur(p.bedrag_verhuurder), 0));
    if (betwist < drempel) {
      bevindingen.push(`ROOD - Het totaalbedrag van de betwiste kosten (EUR ${betwist.toFixed(2)}) ligt onder het minimum van EUR ${drempel.toFixed(2)}; de Huurcommissie neemt het verzoek dan niet in behandeling (par. 6.3.4, p. 59).`);
    }
    if (maanden(dossier.periode).length > 12) {
      bevindingen.push("ROOD - Het verzoek mag per kostensoort betrekking hebben op niet meer dan een tijdvak van ten hoogste twaalf maanden (art. 7:260 lid 2 BW, bijlage 1, p. 66).");
    }
    return bevindingen;
  }

  function beoordeelKostenpost(post, dossier) {
    const handler = HANDLERS[post.categorie];
    if (!handler) {
      const b = nieuweBeoordeling(post);
      b.ontbrekende_informatie.push(`Onbekende categorie ${post.categorie}. Classificeer de post eerst volgens de taxonomie.`);
      b.automatisering = "handmatig";
      return b;
    }
    return handler(post, dossier);
  }

  function beoordeelDossier(dossier) {
    const beoordelingen = (dossier.kostenposten || []).map((p) => beoordeelKostenpost(p, dossier));
    const ontvankelijkheid = controleerOntvankelijkheid(dossier);

    // Voetnoot 4, p. 11: een overeengekomen vast bedrag bindt de verhuurder.
    const maximum = dossier.overeengekomen_maximum != null ? eur(dossier.overeengekomen_maximum) : null;
    const definitief = () => beoordelingen.filter(
      (b) => b.status !== "BUITEN_BEVOEGDHEID" && b.bedrag_model !== null && !b.voorlopig);
    if (maximum !== null) {
      const totaal = eur(definitief().reduce((s, b) => s + b.bedrag_model, 0));
      if (totaal > maximum) {
        const verschil = eur(totaal - maximum);
        beoordelingen.push({
          kostenpost_id: "CORR-MAX", categorie: "CORRECTIE",
          omschrijving: "Overeengekomen vast bedrag/percentage servicekosten",
          status: "ROOD", voorlopig: false, bedrag_verhuurder: 0, bedrag_model: eur(-verschil),
          regels: ["R-ALG-03"], berekening: [],
          toelichting: [`Partijen zijn een vast bedrag/percentage van EUR ${maximum.toFixed(2)} overeengekomen. De verhuurder is daaraan gebonden, ook als de werkelijke kosten hoger uitvallen (voetnoot 4, p. 11). Het meerdere (EUR ${verschil.toFixed(2)}) vervalt.`],
          ontbrekende_informatie: [], automatisering: "automatisch", menselijke_controle_nodig: false,
        });
      }
    }

    for (const b of beoordelingen) b.verschil = verschilVan(b);
    return samenvatten(beoordelingen, ontvankelijkheid, dossier);
  }

  function samenvatten(beoordelingen, ontvankelijkheid, dossier) {
    const beoordeelbaar = beoordelingen.filter((b) => b.status !== "BUITEN_BEVOEGDHEID");
    const definitief = beoordeelbaar.filter((b) => b.bedrag_model !== null && !b.voorlopig);
    const onbeoordeeld = beoordeelbaar.filter((b) => b.bedrag_model === null || b.voorlopig);

    const totaalVerhuurder = eur(beoordeelbaar.reduce((s, b) => s + b.bedrag_verhuurder, 0));
    const totaalModel = eur(definitief.reduce((s, b) => s + b.bedrag_model, 0));
    const totaalBeoordeeld = eur(definitief.reduce((s, b) => s + b.bedrag_verhuurder, 0));
    const correctie = eur(totaalBeoordeeld - totaalModel);
    const onbeoordeeldBedrag = eur(onbeoordeeld.reduce((s, b) => s + b.bedrag_verhuurder, 0));

    const tellingen = { GROEN: 0, ORANJE: 0, ROOD: 0, BUITEN_BEVOEGDHEID: 0 };
    for (const b of beoordelingen) tellingen[b.status]++;

    const vragen = [];
    for (const b of beoordelingen) {
      for (const tekst of b.ontbrekende_informatie) {
        vragen.push({ post: b.omschrijving, categorie: b.categorie, vraag: tekst, belang: b.bedrag_verhuurder });
      }
    }
    vragen.sort((a, z) => z.belang - a.belang);

    const hardeRegels = new Set(["R-NSK-01", "R-VZ-01", "R-ROE-07", "R-ADM-01", "R-ADM-02",
      "R-HUI-01", "R-ROE-04", "R-KH-02", "R-ROE-01", "R-SK-12", "R-VZ-02"]);
    const hard = definitief.filter((b) => b.verschil > 0 && b.regels.some((r) => hardeRegels.has(r)))
      .reduce((s, b) => s + b.verschil, 0);

    const financieel = {
      totaal_verhuurder: totaalVerhuurder,
      totaal_beoordeeld_verhuurder: totaalBeoordeeld,
      totaal_model: totaalModel,
      potentiele_correctie: correctie,
      onbeoordeeld_bedrag: onbeoordeeldBedrag,
      bandbreedte_min: correctie,
      bandbreedte_max: eur(correctie + onbeoordeeldBedrag),
      buiten_bevoegdheid: eur(beoordelingen.filter((b) => b.status === "BUITEN_BEVOEGDHEID")
        .reduce((s, b) => s + b.bedrag_verhuurder, 0)),
    };
    if (dossier.voorschot_in_rekening_gebracht != null && dossier.voorschot_in_rekening_gebracht !== "") {
      const voorschot = eur(dossier.voorschot_in_rekening_gebracht);
      financieel.voorschot_betaald = voorschot;
      financieel.saldo_volgens_verhuurder = eur(voorschot - totaalVerhuurder);
      financieel.saldo_volgens_model = eur(voorschot - totaalModel - onbeoordeeldBedrag);
    }

    return {
      jaar: dossier.periode.jaar,
      ontvankelijkheid,
      blokkerend: ontvankelijkheid.filter((r) => r.startsWith("ROOD")),
      beoordelingen, tellingen, financieel,
      openstaande_vragen: vragen,
      sterkte: {
        dekkingsgraad_procent: totaalVerhuurder ? eur(totaalBeoordeeld / totaalVerhuurder * 100) : 0,
        aandeel_harde_regels_procent: correctie > 0 ? eur(hard / correctie * 100) : 0,
        posten_met_volledige_onderbouwing: beoordeelbaar.filter(
          (b) => !b.regels.some((r) => r === "R-BEW-01" || r === "R-BEW-02" || r === "R-BEW-03")).length,
        posten_totaal: beoordeelbaar.length,
        toelichting: "Dit zijn objectieve indicatoren, geen kanspercentage. Het beleidsboek bevat normen en methoden, geen uitkomstkansen; een slaagkans is daar niet uit af te leiden.",
      },
    };
  }

  if (typeof module !== "undefined" && module.exports) module.exports = global.Kern;
})(typeof globalThis !== "undefined" ? globalThis : this);
