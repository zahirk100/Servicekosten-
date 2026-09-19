# Servicekosten-auditmodel

Een beoordelingsmodel waarmee de servicekostenafrekening van een huurder automatisch of
semi-automatisch kan worden gecontroleerd tegen het **Beleidsboek Servicekosten van de
Huurcommissie, versie 1 juli 2026**.

De repo bestaat uit twee delen: de **analyse** die het beleidsboek vertaalt naar 76 beslisregels
met paginaverwijzing, en de **applicatie** die die regels uitvoert — een huurder uploadt zijn
afrekening of voert de posten zelf in, en krijgt per kostenpost terug wat is toegestaan, wat niet,
en wat er nog ontbreekt.

## Snel beginnen

```bash
# De webapplicatie
python3 -m pip install -r requirements.txt
python3 -m app                       # http://127.0.0.1:8000

# Alleen de rekenkern: een dossier beoordelen
python3 -m engine tests/cases/casus-2-eenvoudige-foutieve-afrekening.json

# Meerdere boekjaren achter elkaar, met totaaloverzicht
python3 -m engine tests/cases/meerjaar/2024.json tests/cases/meerjaar/2025.json

# Alle tests (inclusief de 17 rekenvoorbeelden uit het beleidsboek)
python3 tests/run_all.py
```

De rekenkern (`engine/`) draait op de standaardbibliotheek. De webapplicatie heeft FastAPI en
pypdf nodig; zie `requirements.txt`.

## De applicatie

1. **Inlezen.** Sleep een PDF, CSV of tekstbestand in de dropzone, of voer de posten handmatig in.
   De parser haalt kostenposten, bedragen, boekjaar, huurperiode, voorschot en meterstanden eruit
   en koppelt elke post aan een categorie uit de taxonomie.
2. **Controleren.** De parser stelt voor, u bevestigt. Meerdere bedragen op een regel worden als
   alternatieven getoond; niet-herkende posten blijven leeg (het Besluit servicekosten is niet
   limitatief). Per categorie verschijnen precies de vervolgvragen die de bijbehorende beslisregel
   nodig heeft.
3. **Beoordeling.** Per post: status, de berekening stap voor stap, de paginaverwijzing, en wat er
   nog ontbreekt. Plus een werklijst van op te vragen documenten, gesorteerd op financieel belang,
   en een conceptbezwaarbrief — zonder schriftelijk bezwaar is een verzoek bij de Huurcommissie
   niet-ontvankelijk.

Zie [`docs/10-applicatie.md`](docs/10-applicatie.md) voor de architectuur en de API.

## Wat het model per kostenpost oplevert

```
Huismeester - ROOD
  De verhuurder heeft voor deze post EUR 226,67 gerekend.
  Toets aan het maximale uurtarief: 800 uur x EUR 40,00 = EUR 32.000,00;
    gefactureerd EUR 34.000,00 -> getoetst op EUR 32.000,00 (Tabel 9, p. 40).
  70% ten laste van de huurders = EUR 22.400,00 (p. 41).
  Per woonruimte: EUR 22.400,00 / 150 = EUR 149,33.
  Potentieel verschil: EUR 77,34.
  Kanttekening: de Huurcommissie kan van 70/30 afwijken als de feitelijke
    werkzaamheden dat rechtvaardigen (p. 41).
```

## Documentatie

| Document | Inhoud |
| --- | --- |
| [`docs/00-leeswijzer-en-methodiek.md`](docs/00-leeswijzer-en-methodiek.md) | Bronverantwoording, de labels A/B/C, en de aannames die géén beleidsboekregel zijn |
| [`docs/01-hoofdstukanalyse.md`](docs/01-hoofdstukanalyse.md) | Elke regel uit hoofdstuk 2 t/m 6 en de bijlagen, met voorwaarden, bewijs, berekening en paginaverwijzing |
| [`docs/02-taxonomie.md`](docs/02-taxonomie.md) | Alle servicekostencategorieën met een code |
| [`docs/03-beslisbomen.md`](docs/03-beslisbomen.md) | Acht beslisbomen, in de volgorde die het beleidsboek afdwingt |
| [`docs/04-datamodel.md`](docs/04-datamodel.md) | Welk datapunt uit welke bron komt, en welke beslisregels ervan afhangen |
| [`docs/05-status-en-zekerheidsmodel.md`](docs/05-status-en-zekerheidsmodel.md) | GROEN / ORANJE / ROOD / BUITEN BEVOEGDHEID |
| [`docs/06-financieel-model.md`](docs/06-financieel-model.md) | Berekening per jaar en over meerdere jaren, met bandbreedte |
| [`docs/07-beslisregels.md`](docs/07-beslisregels.md) | De volledige beslisregeltabel (gegenereerd) |
| [`docs/08-praktijktest.md`](docs/08-praktijktest.md) | Vijf casussen plus een meerjarendossier, doorgerekend door de engine (gegenereerd) |
| [`docs/09-eindrapport.md`](docs/09-eindrapport.md) | Wat automatiseerbaar is, wat niet, en welke bronnen blokkerend zijn |
| [`docs/10-applicatie.md`](docs/10-applicatie.md) | De applicatie: inleeslaag, formulier, resultaat, API, architectuur |

## Structuur

```
data/normen.json           Alle normbedragen, tarieven, percentages en termijnen uit het beleidsboek
data/beslisregels.json     De 76 beslisregels, machineleesbaar (bron voor docs/07)
data/categorieen.json      Labels en vervolgvragen per categorie (stuurt het formulier aan)
data/classificatie.json    Trefwoorden om een omschrijving aan een categorie te koppelen
schema/dossier.schema.json JSON Schema van de invoer
engine/                    Rekenkern (Python, standaardbibliotheek)
  normen.py                Toegang tot de normen; werpt NormOntbreekt als het beleidsboek zwijgt
  model.py                 Datamodel: dossier, kostenpost, beoordeling
  regels.py                De beslisregels zelf
  motor.py                 Ontvankelijkheid en orkestratie
  rapport.py               Markdownrapportage
  serialisatie.py          Beoordeling -> JSON voor de API
  brief.py                 Bezwaarbrief en opvraagbrief
app/                       Webapplicatie
  main.py                  FastAPI: API en statische interface
  parsers/                 PDF/CSV/tekst -> conceptdossier
  static/                  index.html, app.js, styles.css (geen buildstap, geen frameworks)
tests/                     50 tests: rekenvoorbeelden, schema, parser, API
tests/cases/               Zeven voorbeelddossiers
voorbeelden/               Fictieve afrekeningen om de parser mee te proberen
tools/                     Generatoren voor docs/07, docs/08, data/categorieen.json en de voorbeelden
```

## Drie ontwerpkeuzes die het gedrag bepalen

**1. Het model verzint nooit een bedrag.** Ontbreekt de invoer die een regel nodig heeft, dan geeft
de regel geen uitkomst maar een concrete informatievraag. `engine/normen.py` werpt daarvoor
`NormOntbreekt` in plaats van een benadering terug te geven. Dat geldt ook voor jaren die het
beleidsboek niet dekt: de Nibud-tabellen lopen tot en met 2025.

**2. ORANJE telt niet mee in de correctie.** Een post waarvoor informatie ontbreekt krijgt hooguit
een **voorlopig** bedrag, dat zichtbaar als zodanig wordt gemarkeerd en buiten het eindbedrag valt.
De rapportage geeft in plaats daarvan een bandbreedte: harde correctie als ondergrens, harde
correctie plus alle ORANJE-posten als bovengrens.

**3. Buiten de bevoegdheid is niet hetzelfde als onterecht.** Belastingen, heffingen en
zorgservicekosten verlaten de berekening volledig (p. 44-45, p. 51). Ze als correctie opvoeren zou
de huurder een verwachting geven die geen procedure bij de Huurcommissie kan waarmaken.

## Validatie

`tests/test_beleidsboek_voorbeelden.py` rekent zeventien voorbeelden uit het beleidsboek na
(p. 14, 15, 17, 19, 22, 27, 32, 35, 41, 43). Alle zeventien komen exact uit. Dat is de enige
objectieve maatstaf om te controleren of de implementatie de rekenwijze van de Huurcommissie volgt;
wijkt een uitkomst af, dan is de implementatie fout, niet het beleidsboek.

Daarnaast controleren `tests/test_parser.py` en `tests/test_api.py` de inleeslaag (Nederlandse
bedragnotatie, classificatie, ruisfilters, PDF en CSV die dezelfde posten opleveren) en de
endpoints. Samen 50 tests via `python3 tests/run_all.py`.

## Status en beperkingen

Wat er nog niet is:

- **OCR.** Een gescande afrekening zonder tekstlaag wordt geweigerd met een uitleg, niet half
  ingelezen.
- **Versiebeheer van het beleidsboek.** De versie van 1 juli 2026 geldt alleen voor verzoeken die op
  of na die datum zijn ingediend (p. 3). Een productiesysteem moet meerdere versies naast elkaar
  kunnen draaien.
- **Meerdere boekjaren in één sessie.** De rekenkern kan het; de interface toont één jaar tegelijk.
- **Opslag.** De applicatie is stateless en bewaart geen dossiers.
- **Vier externe bronnen die blokkerend zijn**: bijlage VII en VIII van de Uitvoeringsregeling
  huurprijzen woonruimte, de grensbedragen uit het beleidsboek Waarderingsstelsel, en de CBS-index
  voor de voorschottoetsing. Zie `docs/09-eindrapport.md`, paragraaf 8.

Dit model geeft geen juridisch advies. Het beleidsboek is uitvoeringsbeleid: de Huurcommissie
handelt ernaar maar kan gemotiveerd afwijken (p. 3). Elke uitkomst is een verwachting van de
beleidslijn, geen voorspelling van de uitspraak.
