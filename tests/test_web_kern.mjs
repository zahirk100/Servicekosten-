/* Valideert de JavaScript-port (web/kern.js) op twee manieren:
   1. de zeventien rekenvoorbeelden uit het beleidsboek, net als de Python-kern;
   2. een vergelijking met de uitvoer van die Python-kern op alle casussen.
   Draaien: node tests/test_web_kern.mjs */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const WORTEL = join(dirname(fileURLToPath(import.meta.url)), "..");
const lees = (p) => JSON.parse(readFileSync(join(WORTEL, p), "utf-8"));
const Kern = createRequire(import.meta.url)(join(WORTEL, "web/kern.js"));
Kern.init({ normen: lees("data/normen.json") });

let geslaagd = 0;
const gefaald = [];
function test(naam, werkelijk, verwacht) {
  const ok = JSON.stringify(werkelijk) === JSON.stringify(verwacht);
  if (ok) geslaagd++;
  else gefaald.push(`${naam}\n    verwacht: ${JSON.stringify(verwacht)}\n    gekregen: ${JSON.stringify(werkelijk)}`);
}

const leeg = () => ({ berekening: [], toelichting: [], regels: [], ontbrekende_informatie: [] });
const dos = (woonruimte, jaar, van = 1, tot = 12, rest = {}) =>
  ({ woonruimte: { zelfstandig: true, aantal_woonruimten_op_aansluiting: 1, ...woonruimte },
     periode: { jaar, maand_van: van, maand_tot_en_met: tot }, kostenposten: [], procedure: {}, ...rest });

/* ---- 1. Rekenvoorbeelden uit het beleidsboek ---- */

test("gas appartement jan-mei 2024 (p. 14)",
  Kern.nibudGas(dos({ woningtype: "flatwoning_appartement" }, 2024, 1, 5), leeg()), 671.12);
test("gas kamer 16 m2, pand van 4 (p. 15)",
  Kern.nibudGas(dos({ zelfstandig: false, oppervlakte_m2: 16, aantal_woonruimten_op_aansluiting: 4 }, 2024), leeg()), 583.19);
test("graaddagenmethode januari 2024 (p. 17)",
  Math.round(2000 * Kern.graaddagenfactor(dos({}, 2024, 1, 1))), 395);
test("elektriciteit 2 bewoners 2024 (p. 19)",
  Kern.nibudElektriciteit(dos({ aantal_bewoners: 2 }, 2024), leeg()), 564.05);
test("elektriciteit kamer, 15 op aansluiting, jan-apr 2025 (p. 19)",
  Kern.nibudElektriciteit(dos({ zelfstandig: false, aantal_woonruimten_op_aansluiting: 15 }, 2025, 1, 4), leeg()), 92.85);
test("water 2 bewoners 2025 (p. 22)",
  Kern.nibudWater(dos({ aantal_bewoners: 2 }, 2025), leeg()), 253.15);
test("water onzelfstandig, pand van 4, 2025 (p. 22)",
  Kern.nibudWater(dos({ zelfstandig: false, aantal_bewoners: 1, aantal_woonruimten_op_aansluiting: 4 }, 2025), leeg()), 141.61);

const eenPost = (post, woonruimte, jaar, van = 1, tot = 12) => {
  const d = dos(woonruimte, jaar, van, tot);
  d.kostenposten = [post];
  return Kern.beoordeelDossier(d).beoordelingen[0].bedrag_model;
};

test("verdeelsleutel gas complex van 5 (p. 27)",
  eenPost({ id: "gas", categorie: "NUT-GAS-ZM", omschrijving: "Gas", bedrag_verhuurder: 600,
            overeengekomen: true, bewijs: ["facturen", "specificatieformulier"],
            parameters: { totale_kosten_complex: 3500 } },
          { oppervlakte_m2: 60, aantal_woonruimten_complex: 5, totale_oppervlakte_complex_m2: 400 }, 2024),
  586.25);
test("huismeester 800 uur, 150 woningen (p. 41)",
  eenPost({ id: "hm", categorie: "SK-06", omschrijving: "Huismeester", bedrag_verhuurder: 226.67,
            overeengekomen: true, bewijs: ["facturen", "urenverantwoording"],
            parameters: { uren: 800, totale_kosten: 34000, aantal_woonruimten: 150 } },
          { aantal_woonruimten_complex: 150 }, 2024),
  149.33);

const gordijnen = (jaarInGebruik) => eenPost(
  { id: "g", categorie: "SK-03", omschrijving: "Gordijnen", bedrag_verhuurder: 60, overeengekomen: true,
    bewijs: ["facturen", "specificatieformulier"],
    parameters: { roerend: true, aanschafwaarde: 300, levensduur_jaren: 5, jaar_in_gebruik: jaarInGebruik } },
  {}, 2024);
test("gordijnen eerste periode (p. 32)", gordijnen(3), 60);
test("gordijnen na herwaardering (p. 32)", gordijnen(7), 36);
test("gordijnen versleten (p. 32)", gordijnen(11), 0);

const was = (jaarInGebruik) => eenPost(
  { id: "w", categorie: "SK-03", omschrijving: "Wasapparatuur", bedrag_verhuurder: 66.66, overeengekomen: true,
    bewijs: ["facturen", "specificatieformulier"],
    parameters: { roerend: true, soort: "wasapparatuur", aanschafwaarde: 50000, jaar_in_gebruik: jaarInGebruik, aantal_woonruimten: 75 } },
  {}, 2024);
test("wasapparatuur begrensd op maximum (p. 35)", was(3), 60);
test("wasapparatuur tweede periode (p. 35)", was(12), 40);
test("zonnepanelen met opslag EUR 2.000 (p. 32)",
  eenPost({ id: "zp", categorie: "SK-03", omschrijving: "Zonnepanelen", bedrag_verhuurder: 500, overeengekomen: true,
            bewijs: ["facturen", "specificatieformulier"],
            parameters: { roerend: true, soort: "zonnepanelen", aanschafwaarde: 6000, jaar_in_gebruik: 2 } }, {}, 2025),
  Kern.eur(8000 * 0.0667));

const adm = (params, bedrag) => eenPost(
  { id: "adm", categorie: "SK-11", omschrijving: "Administratiekosten", bedrag_verhuurder: bedrag,
    bewijs: ["specificatieformulier"], parameters: params }, {}, 2024);
test("administratiekosten 2% + 5% (p. 43)",
  adm({ afrekening_verstrekt: true, grondslag_warmtelevering: 1000, grondslag_overige_posten: 1000 }, 120), 70);
test("administratiekosten maximum EUR 75 (p. 43)",
  adm({ afrekening_verstrekt: true, grondslag_overige_posten: 10000 }, 500), 75);

/* ---- 2. Vergelijking met de Python-kern op alle casussen ---- */

const referentie = lees("tests/referentie-python.json");
const cases = {
  "casus-1-eenvoudige-correcte-afrekening.json": lees("tests/cases/casus-1-eenvoudige-correcte-afrekening.json"),
  "casus-2-eenvoudige-foutieve-afrekening.json": lees("tests/cases/casus-2-eenvoudige-foutieve-afrekening.json"),
  "casus-3-ontbrekende-bewijsstukken.json": lees("tests/cases/casus-3-ontbrekende-bewijsstukken.json"),
  "casus-4-meerdere-foutieve-posten.json": lees("tests/cases/casus-4-meerdere-foutieve-posten.json"),
  "casus-5-complex-menselijke-beoordeling.json": lees("tests/cases/casus-5-complex-menselijke-beoordeling.json"),
  "meerjaar/2024.json": lees("tests/cases/meerjaar/2024.json"),
  "meerjaar/2025.json": lees("tests/cases/meerjaar/2025.json"),
};

for (const [naam, dossier] of Object.entries(cases)) {
  const verwacht = referentie[naam];
  const u = Kern.beoordeelDossier(dossier);
  const fin = Object.fromEntries(Object.entries(u.financieel).map(([k, v]) => [k, v.toFixed(2)]));
  test(`${naam} — financieel`, fin, verwacht.financieel);
  test(`${naam} — tellingen`, u.tellingen, verwacht.tellingen);
  test(`${naam} — per post`,
    u.beoordelingen.map((b) => ({
      id: b.kostenpost_id, status: b.status, voorlopig: b.voorlopig,
      bedrag_model: b.bedrag_model === null ? null : b.bedrag_model.toFixed(2),
      verschil: b.verschil === null ? null : b.verschil.toFixed(2),
      regels: [...b.regels].sort(),
    })),
    verwacht.beoordelingen);
  test(`${naam} — sterkte`,
    Object.fromEntries(Object.entries(u.sterkte).filter(([k]) => k !== "toelichting")
      .map(([k, v]) => [k, typeof v === "number" && k.endsWith("procent") ? v.toFixed(2) : v])),
    verwacht.sterkte);
}

console.log(`\n${geslaagd} geslaagd, ${gefaald.length} gefaald`);
if (gefaald.length) {
  for (const f of gefaald) console.log("  FAIL " + f);
  process.exit(1);
}
console.log("De JavaScript-port rekent identiek aan de Python-kern.");
