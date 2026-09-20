/* Inleeslaag - JavaScript-port van app/parsers/.
   Leest een afrekening (tekst, CSV of PDF) en stelt kostenposten voor. Stelt
   voor, stelt niets vast: elke waarde draagt herkomst en alternatieven. */

(function (global) {
  "use strict";

  let CLASSIFICATIE = null;

  const MAANDEN = { januari: 1, februari: 2, maart: 3, april: 4, mei: 5, juni: 6,
    juli: 7, augustus: 8, september: 9, oktober: 10, november: 11, december: 12 };
  const MAANDNAMEN = Object.keys(MAANDEN).join("|");

  // Zelfde patroon als app/parsers/bedragen.py: sluit getallen uit die aan een
  // woord vastzitten (24-uursservice), in een huisnummer staan (42-3) of voor
  // een postcode (1000 AB).
  const BEDRAG = new RegExp(
    "(?:^|[^\\w,.\\-])" +
    "((?:-\\/-\\s*|-)?(?:€\\s*|EUR\\s+)?" +
    "(?:\\d{1,3}(?:\\.\\d{3})+(?:,\\d{1,2}|,-)?|\\d+,\\d{1,2}|\\d+,-|\\d+))" +
    "(?!\\w|-\\w|\\s*[A-Z]{2}\\b)", "g");

  function naarGetal(tekst) {
    let schoon = String(tekst).trim().replace(/€/g, "").replace(/EUR/g, "")
      .replace(/\s/g, "").replace(/ /g, "");
    const negatief = schoon.startsWith("-");
    schoon = schoon.replace(/^-+\/?-*/, "");
    if (schoon.endsWith(",-")) schoon = schoon.slice(0, -2);
    if (schoon.includes(",")) {
      schoon = schoon.replace(/\./g, "").replace(",", ".");
    } else if (schoon.includes(".")) {
      const staart = schoon.split(".").pop();
      if (staart.length === 3) schoon = schoon.replace(/\./g, "");
    }
    if (!schoon) return null;
    const waarde = Number(schoon);
    if (!isFinite(waarde)) return null;
    return negatief ? -waarde : waarde;
  }

  /* Een getal is pas geldvormig als het een valutateken draagt, decimalen achter
     een komma heeft, of met punten in duizendtallen is geschreven. Een kaal getal
     is op een factuur vaker een huisnummer, een KvK-nummer of een aantal. */
  const GELDVORM = /€|EUR|,\d{1,2}(?!\d)|,-|\d{1,3}(?:\.\d{3})+/;
  const lijktOpGeld = (tekst) => GELDVORM.test(tekst);

  function bedragTreffers(regel) {
    const treffers = [];
    BEDRAG.lastIndex = 0;
    let m;
    while ((m = BEDRAG.exec(regel)) !== null) {
      const rauw = m[1];
      const kaal = rauw.replace(/[^\d]/g, "");
      if (/^(19|20)\d{2}$/.test(rauw.trim())) continue;   // los jaartal
      if (!kaal) continue;
      const waarde = naarGetal(rauw);
      if (waarde === null) continue;
      treffers.push({ start: m.index + m[0].length - rauw.length, waarde, rauw });
    }
    return treffers;
  }

  const vindBedragen = (regel) => bedragTreffers(regel).map((t) => t.waarde);

  function vindJaar(tekst) {
    const patronen = [
      /(?:afrekening|overzicht|boekjaar|servicekosten|kalenderjaar)[^\d]{0,30}((?:19|20)\d{2})/i,
      /((?:19|20)\d{2})\s*(?:afrekening|servicekosten)/i,
      /\b(?:over|periode)\b[^\d]{0,20}((?:19|20)\d{2})/i,
    ];
    for (const p of patronen) {
      const m = tekst.match(p);
      if (m) return Number(m[1]);
    }
    const jaren = [...tekst.matchAll(/\b(20[0-3]\d)\b/g)].map((m) => Number(m[1]));
    if (!jaren.length) return null;
    const telling = {};
    for (const j of jaren) telling[j] = (telling[j] || 0) + 1;
    return Number(Object.entries(telling).sort((a, b) => b[1] - a[1])[0][0]);
  }

  function vindPeriode(tekst) {
    const p = new RegExp(
      `(\\d{1,2})\\s+(${MAANDNAMEN})\\s+((?:19|20)\\d{2})` +
      `\\s*(?:tot en met|t\\/m|tot|-|tm)\\s*` +
      `(\\d{1,2})\\s+(${MAANDNAMEN})\\s+((?:19|20)\\d{2})`, "i");
    const m = tekst.match(p);
    if (m) return [MAANDEN[m[2].toLowerCase()], MAANDEN[m[5].toLowerCase()]];
    const n = tekst.match(/(\d{1,2})[-/](\d{1,2})[-/]((?:19|20)\d{2})\s*(?:tot en met|t\/m|tot|-|tm)\s*(\d{1,2})[-/](\d{1,2})[-/]((?:19|20)\d{2})/);
    if (n) return [Number(n[2]), Number(n[5])];
    return null;
  }

  const normaliseer = (tekst) => String(tekst).toLowerCase()
    .normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

  function isNegeerregel(omschrijving) {
    const schoon = normaliseer(omschrijving);
    if (!schoon) return true;
    return CLASSIFICATIE.negeerregels.some((woord) => {
      const g = normaliseer(woord);
      return schoon.startsWith(g) || schoon === g;
    });
  }

  function classificeer(omschrijving) {
    const schoon = normaliseer(omschrijving);
    let beste = null;
    for (const [categorie, blok] of Object.entries(CLASSIFICATIE.categorieen)) {
      for (const trefwoord of blok.trefwoorden) {
        const g = normaliseer(trefwoord);
        if (!g) continue;
        const positie = schoon.indexOf(g);
        if (positie < 0) continue;
        // Het vroegste trefwoord is het onderwerp; bij gelijke positie wint het
        // langste (specifiekste). Zo is "Schoonmaak gemeenschappelijke ruimten"
        // schoonmaak en geen verzamelpost.
        const kandidaat = [positie, -g.length, categorie, trefwoord];
        if (!beste || kandidaat[0] < beste[0] || (kandidaat[0] === beste[0] && kandidaat[1] < beste[1])) {
          beste = kandidaat;
        }
      }
    }
    if (!beste) {
      return { categorie: null, trefwoord: null, zekerheid: "onbekend",
        vraag: "Deze post is niet automatisch te classificeren. Kies zelf de categorie; de opsomming in het Besluit servicekosten is niet limitatief (p. 29, p. 75)." };
    }
    const [, , categorie, trefwoord] = beste;
    return { categorie, trefwoord,
      zekerheid: normaliseer(trefwoord).length >= 8 ? "hoog" : "laag",
      vraag: CLASSIFICATIE.categorieen[categorie].vraag || null };
  }

  function omschrijvingVan(regel, positie) {
    let kop = positie == null ? regel : regel.slice(0, positie);
    kop = kop.replace(/^[\s\-*•|]+/, "").replace(/[.:\s_]{2,}/g, " ")
             .replace(/\b(?:EUR|€)\s*$/, "");
    return kop.replace(/^[\s.:|\-]+|[\s.:|\-]+$/g, "");
  }

  const isVoorschotregel = (regel) => {
    const s = normaliseer(regel);
    return ["voorschot", "reeds betaald", "betaalde voorschotten", "vooruitbetaald"].some((w) => s.includes(w));
  };

  function parseAfrekening(tekst, metadata) {
    const dossier = { jaar: null, maand_van: 1, maand_tot_en_met: 12, voorschot: null,
      posten: [], meterstanden: {}, aantal_woonruimten: null, waarschuwingen: [],
      herkomst: Object.assign({}, metadata || {}) };

    dossier.jaar = vindJaar(tekst);
    if (dossier.jaar === null) {
      dossier.waarschuwingen.push("Het boekjaar is niet uit het document af te leiden. Vul het zelf in: het bepaalt welke normbedragen en welke termijnen gelden.");
    }
    const periode = vindPeriode(tekst);
    if (periode) { dossier.maand_van = periode[0]; dossier.maand_tot_en_met = periode[1]; }

    const regels = tekst.split(/\r?\n/);
    regels.forEach((regel, i) => {
      if (!regel.trim()) return;
      const treffers = bedragTreffers(regel);
      if (!treffers.length) return;
      const bedragen = treffers.map((t) => t.waarde);
      const omschrijving = omschrijvingVan(regel, treffers[0].start);

      if (isVoorschotregel(regel)) {
        if (dossier.voorschot === null) {
          dossier.voorschot = bedragen.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), bedragen[0]);
        }
        return;
      }
      // Een briefhoofd met "Parklaan 3" of "KvK 30123456" is geen kostenpost.
      if (!treffers.some((t) => lijktOpGeld(t.rauw))) return;
      if (omschrijving.length < 3 || isNegeerregel(omschrijving)) return;

      const kort = omschrijving.length > 90 ? omschrijving.slice(0, 90).trim() + "…" : omschrijving;
      const c = classificeer(kort);
      dossier.posten.push({
        regelnummer: i + 1, brontekst: regel.trim(), omschrijving: kort,
        bedrag: bedragen[bedragen.length - 1], alternatieve_bedragen: bedragen.slice(0, -1),
        categorie: c.categorie, trefwoord: c.trefwoord, zekerheid: c.zekerheid, vraag: c.vraag,
      });
    });

    for (const [naam, patroon] of [["beginstand", /beginstand[^\d]{0,20}([\d.,]+)/i],
                                   ["eindstand", /eindstand[^\d]{0,20}([\d.,]+)/i]]) {
      const m = tekst.match(patroon);
      if (m) {
        const waarde = naarGetal(m[1]);
        if (waarde !== null) dossier.meterstanden[naam] = waarde;
      }
    }
    const w = tekst.match(/(\d{1,4})\s*(?:woonruimten|woningen|appartementen|verhuureenheden|kamers)/i);
    if (w) dossier.aantal_woonruimten = Number(w[1]);

    if (!dossier.posten.length) {
      dossier.waarschuwingen.push("Er zijn geen kostenposten herkend. Controleer of dit de servicekostenafrekening is; u kunt de posten ook handmatig invoeren.");
    }
    const onbekend = dossier.posten.filter((p) => !p.categorie);
    if (onbekend.length) {
      dossier.waarschuwingen.push(`${onbekend.length} van de ${dossier.posten.length} posten kon niet automatisch worden geclassificeerd. Kies daarvoor zelf een categorie.`);
    }
    const onzeker = dossier.posten.filter((p) => p.zekerheid === "laag");
    if (onzeker.length) {
      dossier.waarschuwingen.push(`${onzeker.length} post(en) zijn op een kort, algemeen trefwoord herkend. Controleer die classificatie extra goed.`);
    }
    const meerdere = dossier.posten.filter((p) => p.alternatieve_bedragen.length);
    if (meerdere.length) {
      dossier.waarschuwingen.push(`Op ${meerdere.length} regel(s) stonden meerdere bedragen. Het model koos steeds het laatste bedrag als uw aandeel; controleer dit per post.`);
    }
    return dossier;
  }

  function csvNaarTekst(rauw) {
    const scheiding = (rauw.match(/;/g) || []).length > (rauw.match(/,/g) || []).length ? ";"
                    : (rauw.match(/\t/g) || []).length > 0 ? "\t" : ",";
    return rauw.split(/\r?\n/).map((rij) => {
      const cellen = [];
      let huidig = "", inAanhaling = false;
      for (const teken of rij) {
        if (teken === '"') inAanhaling = !inAanhaling;
        else if (teken === scheiding && !inAanhaling) { cellen.push(huidig); huidig = ""; }
        else huidig += teken;
      }
      cellen.push(huidig);
      return cellen.map((c) => c.trim()).join("   ");
    }).join("\n");
  }

  global.Parser = {
    init: (data) => { CLASSIFICATIE = data.classificatie; },
    parseAfrekening, classificeer, naarGetal, vindBedragen, vindJaar, vindPeriode,
    isNegeerregel, csvNaarTekst,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = global.Parser;
})(typeof globalThis !== "undefined" ? globalThis : this);
