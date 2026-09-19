# 11 - De applicatie in de browser

`web/index.html` is de volledige applicatie in één bestand: twee rollen, een rekenkern, een parser en een
opslaglaag. Geen server, geen installatie.

Bouwen na een wijziging in `data/` of `web/*.js`:

```
python3 tools/bouw_webapp.py
```

## Twee rollen, één pagina

**Huurder.** Een dashboard met de eigen dossiers, en daarvandaan een controle in vier stappen:

1. **Gegevens** — naam, e-mail, adres, verhuurder. Nodig om contact op te nemen; blijft lokaal tot de
   huurder zelf indient.
2. **Afrekening** — bestand uploaden, tekst plakken of posten zelf invoeren. Bij handmatige invoer stelt
   de classificatie meteen een categorie voor op basis van de omschrijving.
3. **Vijf vragen** — boekjaar, woningtype, bewoners en complexgrootte, wat de verhuurder heeft
   aangeleverd, en het betaalde voorschot.
4. **Voorlopige beoordeling** — het bedrag waar de huurder mogelijk recht op heeft, de posten per status,
   en de keuze: indienen of zelf een bezwaarbrief maken.

Na indienen volgt een bevestiging met dossiernummer en de mededeling dat er contact wordt opgenomen met
een rapport. Het dossier verschijnt op het dashboard, waar de huurder de status en de aantekeningen van
de beoordelaar terugziet.

**Beheer.** Een overzicht van binnengekomen aanvragen met kengetallen (nieuw, in behandeling, totale
claim, gemiddelde per dossier), filters per status en een detailpagina. Daar staan de contactgegevens,
de bedragen, de bevindingen, en de verwerking: status wijzigen, een aantekening toevoegen (die de
huurder meteen ziet), en een rapport opstellen dat gekopieerd of afgedrukt kan worden.

## Opslag

| Modus | Wanneer | Wat het betekent |
| --- | --- | --- |
| **Gedeeld** | De pagina draait als Artifact met de `db`-capability | Een huurder dient in, de beheerder ziet het live binnenkomen |
| **Lokaal** | Overal elders, bijvoorbeeld op een eigen webserver | Werkt volledig, maar dossiers blijven op dat ene apparaat |

`web/opslag.js` kiest zelf. De pagina start altijd lokaal en schakelt over zodra `claude.use("db")`
antwoordt; niets wacht op een capability die misschien nooit komt. De beheeromgeving zegt er expliciet
bij in welke modus zij draait, zodat niemand denkt aanvragen te missen die er nooit waren.

Wat er wordt opgeslagen bij indienen: de contactgegevens, het boekjaar, de bedragen, de woninggegevens
en alle bevindingen inclusief berekening en regel-ID's. Niet: het geüploade bestand zelf.

## Waarom een tweede rekenkern

De Python-kern (`engine/`) heeft een server nodig. Voor een huurder die één keer zijn afrekening wil
controleren is dat een drempel die niets toevoegt. Maar twee implementaties van dezelfde regels kunnen
uit elkaar lopen, dus dat risico is afgedekt met een test in plaats van weggeredeneerd.

`tests/test_web_kern.mjs` doet twee dingen:

1. **De zeventien rekenvoorbeelden uit het beleidsboek** (p. 14, 15, 17, 19, 22, 27, 32, 35, 41, 43) gaan
   door de JavaScript-kern, met dezelfde verwachte uitkomsten als in `tests/test_beleidsboek_voorbeelden.py`.
2. **De volledige uitvoer van beide kernen wordt vergeleken.** `tests/referentie-python.json` bevat wat
   `engine/` oplevert voor alle zeven dossiers in `tests/cases/`: per post het bedrag, de status, de vlag
   `voorlopig`, het verschil en de toegepaste regel-ID's, plus de totalen, de statustellingen en de
   sterkte-indicatoren.

Samen 45 vergelijkingen. `tests/test_web_port.py` draait die mee in `python3 tests/run_all.py` en bewaakt
bovendien dat de referentie actueel is en dat `web/index.html` opnieuw is gebouwd na een wijziging.

## Gewone taal voorop

`data/uitleg.json` vertaalt elke beslisregel die in de applicatie kan verschijnen naar één zin die een
huurder begrijpt, plus een korte toelichting. Die staat bovenaan de bevinding; de berekening, het citaat
uit het beleidsboek en de regel-ID's staan eronder achter "Waarom?".

Bij meerdere toegepaste regels wint de regel met de hoogste `prioriteit` — een verbod ("leegstand mag
niet") is voor de huurder relevanter dan een verdeelsleutel die daarnaast ook is toegepast.

## Ontwerp

Monochrome interface: inkt op papier, haarlijnen, tabellarische cijfers. De enige verzadigde kleur op de
pagina is de status van een post, zodat bevindingen eruit springen zonder dat er iets omheen hoeft te
schreeuwen. Fraunces voor bedragen en nummers, Public Sans voor de interface, IBM Plex Mono voor
berekeningen.

**Statuskleuren dragen nooit alleen betekenis.** Groen en rood liggen voor deuteranopie op een CVD-ΔE van
4,1 — voor kleurenblinde lezers niet aan de kleur te onderscheiden. Elke status heeft daarom ook een
teken (`!` `?` `✓` `–`) en een woord, en de bevindingenlijst is de volledige tabelweergave van dezelfde
gegevens.

Donkere modus volgt de systeemvoorkeur en is met de themaknop te overrulen. Gecontroleerd op 360, 390,
430, 768 en 1280 px: geen horizontale scroll. Tikdoelen minimaal 48 px; op smalle schermen krijgt de
rolwissel een eigen rij.

## Grenzen

- **Geen OCR.** Een gescande pdf zonder tekstlaag levert een melding op met de suggestie de tekst te
  plakken of de posten zelf in te voeren.
- **Eén boekjaar per dossier**, conform art. 7:260 lid 2 BW.
- **Geen e-mail.** De applicatie legt het dossier vast; het daadwerkelijke contact met de huurder gebeurt
  buiten de applicatie om.
- **Het geüploade bestand wordt niet bewaard**, alleen de eruit afgeleide posten en bevindingen.
