# Servicekosten-auditmodel

Een beoordelingsmodel waarmee de servicekostenafrekening van een huurder automatisch of
semi-automatisch kan worden gecontroleerd tegen het **Beleidsboek Servicekosten van de
Huurcommissie, versie 1 juli 2026**.

Deze repo bevat geen samenvatting van dat beleidsboek. Hij bevat de vertaling ervan naar een
specificatie die een ontwikkelaar kan bouwen: een taxonomie, beslisbomen, een datamodel, 76
beslisregels met paginaverwijzing, en een werkende referentie-implementatie die de rekenvoorbeelden
uit het beleidsboek exact reproduceert.

## Snel beginnen

```bash
# Alle tests (inclusief de 17 rekenvoorbeelden uit het beleidsboek)
python3 tests/run_all.py

# Een dossier beoordelen
python3 -m engine tests/cases/casus-2-eenvoudige-foutieve-afrekening.json

# Meerdere boekjaren achter elkaar, met totaaloverzicht
python3 -m engine tests/cases/meerjaar/2024.json tests/cases/meerjaar/2025.json
```

Geen externe afhankelijkheden nodig; `jsonschema` is optioneel (alleen voor de schemavalidatietest).

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

## Structuur

```
data/normen.json           Alle normbedragen, tarieven, percentages en termijnen uit het beleidsboek
data/beslisregels.json     De 76 beslisregels, machineleesbaar (bron voor docs/07)
schema/dossier.schema.json JSON Schema van de invoer
engine/                    Referentie-implementatie (Python, geen dependencies)
  normen.py                Toegang tot de normen; werpt NormOntbreekt als het beleidsboek zwijgt
  model.py                 Datamodel: dossier, kostenpost, beoordeling
  regels.py                De beslisregels zelf
  motor.py                 Ontvankelijkheid en orkestratie
  rapport.py               Markdownrapportage
tests/                     17 validaties tegen de rekenvoorbeelden + schemacontroles
tests/cases/               Zeven voorbeelddossiers
tools/                     Generatoren voor docs/07 en docs/08
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

## Status en beperkingen

Dit is een **prototype van het beoordelingsmodel**, niet van de hele applicatie. Wat er nog niet is:

- **Documentverwerking.** Het inlezen van een PDF-afrekening naar het datamodel is een apart
  probleem. De invoer is nu handmatig gestructureerde JSON.
- **Versiebeheer van het beleidsboek.** De versie van 1 juli 2026 geldt alleen voor verzoeken die op
  of na die datum zijn ingediend (p. 3). Een productiesysteem moet meerdere versies naast elkaar
  kunnen draaien.
- **Vier externe bronnen die blokkerend zijn**: bijlage VII en VIII van de Uitvoeringsregeling
  huurprijzen woonruimte, de grensbedragen uit het beleidsboek Waarderingsstelsel, en de CBS-index
  voor de voorschottoetsing. Zie `docs/09-eindrapport.md`, paragraaf 8.

Dit model geeft geen juridisch advies. Het beleidsboek is uitvoeringsbeleid: de Huurcommissie
handelt ernaar maar kan gemotiveerd afwijken (p. 3). Elke uitkomst is een verwachting van de
beleidslijn, geen voorspelling van de uitspraak.
