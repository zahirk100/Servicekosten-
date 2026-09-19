# 11 - De browserversie

`web/index.html` is de volledige applicatie in één bestand. Openen en gebruiken; geen server, geen
installatie, geen internetverbinding. De afrekening wordt in het tabblad verwerkt en nergens
heen gestuurd.

Bouwen na een wijziging in `data/` of `web/*.js`:

```
python3 tools/bouw_webapp.py
```

## Waarom een tweede implementatie

De Python-kern (`engine/`) heeft een server nodig. Voor een huurder die één keer zijn afrekening wil
controleren is dat een drempel die niets toevoegt. De browserversie haalt die drempel weg, tegen één
prijs: er zijn nu twee implementaties van dezelfde regels, en die kunnen uit elkaar gaan lopen.

Dat risico is niet weggeredeneerd maar afgedekt met een test.

## Hoe de port is gevalideerd

`tests/test_web_kern.mjs` doet twee dingen:

1. **De zeventien rekenvoorbeelden uit het beleidsboek** (p. 14, 15, 17, 19, 22, 27, 32, 35, 41, 43)
   gaan door de JavaScript-kern, met dezelfde verwachte uitkomsten als in
   `tests/test_beleidsboek_voorbeelden.py`.
2. **De volledige uitvoer van beide kernen wordt vergeleken.** `tests/referentie-python.json` bevat
   wat `engine/` oplevert voor alle zeven dossiers in `tests/cases/`: per post het bedrag, de status,
   de vlag `voorlopig`, het verschil en de toegepaste regel-ID's, plus de financiële totalen, de
   statustellingen en de sterkte-indicatoren. De JavaScript-kern moet daar exact mee overeenkomen.

Samen 45 vergelijkingen. `tests/test_web_port.py` draait die test mee in `python3 tests/run_all.py`
en controleert bovendien dat `tests/referentie-python.json` nog actueel is en dat `web/index.html`
opnieuw is gebouwd na een wijziging in de bronbestanden — anders zou een verouderd gebouwd bestand
ongemerkt kunnen meeliften.

Wijkt een uitkomst af, dan faalt de test en is de port fout. Zo kan er geen stille divergentie
ontstaan tussen wat de server berekent en wat de browser laat zien.

## Verschillen met de serverversie

| | Browser (`web/`) | Server (`app/`) |
| --- | --- | --- |
| Installatie | geen | Python + FastAPI + pypdf |
| PDF lezen | pdf.js in de browser | pypdf op de server |
| Tekst plakken | ja | nee |
| Gegevens | blijven in het tabblad | gaan naar de eigen server |
| Rekenkern | `web/kern.js` | `engine/` |

Beide gebruiken dezelfde `data/*.json` als bron voor normen, regels, categorieën en trefwoorden.

## De pagina opent in een werkende staat

Bij het laden wordt een fictieve voorbeeldafrekening ingelezen, beoordeeld en getoond, met een
duidelijke balk erboven dat het om een voorbeeld gaat. Een leeg scherm met een uploadknop laat niet
zien wat de applicatie doet; deze wel. Met één klik gaat de gebruiker naar zijn eigen afrekening.

## Toegankelijkheid van de statuskleuren

Groen en rood liggen voor deuteranopie op een CVD-ΔE van 4,1 — voor kleurenblinde lezers niet aan de
kleur te onderscheiden. Kleur draagt daarom nooit alleen betekenis:

- elke status heeft een glyph (`✓` `?` `!` `–`) en een woord;
- de verdeelbalk geeft elk segment een eigen arceringspatroon en een direct bedragslabel;
- de balk heeft een tekstuele beschrijving voor schermlezers;
- de bevindingenlijst is de volledige tabelweergave van dezelfde gegevens.

Donkere modus volgt de systeemvoorkeur en is met de themaknop te overrulen. De pagina werkt vanaf
390 px zonder horizontale scroll.

## Grenzen

- **Geen OCR.** Een gescande PDF zonder tekstlaag levert een melding op met de suggestie de tekst te
  plakken of handmatig in te voeren.
- **Eén boekjaar tegelijk**, net als de serverversie.
- **Geen opslag.** Verversen betekent opnieuw beginnen; dat is een bewuste keuze bij een dossier met
  adres-, contract- en betaalgegevens.
