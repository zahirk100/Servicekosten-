# 10 - De applicatie

De analyse uit `docs/01` t/m `docs/09` beschrijft wát er moet gebeuren. Dit document beschrijft de
applicatie die het doet.

```
python3 -m pip install -r requirements.txt
python3 -m app                      # http://127.0.0.1:8000
```

## Twee manieren om erin te komen

**Bestand inlezen.** De gebruiker sleept een PDF, CSV of tekstbestand in de dropzone. De parser
haalt er kostenposten, bedragen, boekjaar, huurperiode, voorschot, meterstanden en het aantal
woonruimten uit, en koppelt elke post aan een categorie uit de taxonomie.

**Handmatig invoeren.** Wie geen digitaal bestand heeft, voegt de posten zelf toe. Vanaf stap 2
zijn beide routes identiek — de parser levert niets anders dan een ingevuld formulier.

Een scan zonder tekstlaag levert een expliciete melding op ("waarschijnlijk een scan of foto"),
geen half gevulde lijst. OCR zit niet in deze applicatie.

## De parser stelt voor, de gebruiker bevestigt

Dit is het belangrijkste ontwerpprincipe van de invoerlaag. Elke afgeleide waarde is een
**voorstel** met zichtbare herkomst, geen vaststelling:

- **Bedragen.** Op een afrekeningsregel staan vaak meerdere kolommen (complextotaal, tarief,
  uw aandeel). De parser kiest het laatste bedrag als het aandeel van de huurder en toont de
  andere bedragen als aanklikbare alternatieven. De interface waarschuwt op hoeveel regels dit
  speelde.
- **Categorieën.** De classificatie werkt met trefwoorden uit `data/classificatie.json`. Wint het
  vroegste trefwoord in de omschrijving, bij gelijke positie het langste — zo is "Schoonmaak
  gemeenschappelijke ruimten" schoonmaak en geen verzamelpost. Een post met alleen een kort,
  algemeen trefwoord krijgt zekerheid `laag` en wordt als zodanig gemeld.
- **Niet-herkende posten.** Die blijven leeg. Het Besluit servicekosten en het Besluit kleine
  herstellingen zijn allebei uitdrukkelijk **niet limitatief** (p. 75, p. 82), dus een onbekende
  post mag nooit automatisch worden afgewezen. De applicatie weigert te beoordelen zolang er posten
  zonder categorie zijn.
- **Ruis.** Totaal-, voorschot-, saldo-, adres- en kopregels worden eruit gefilterd via de
  negeerregels in `data/classificatie.json`.

## Vervolgvragen per categorie

`data/categorieen.json` bepaalt welke velden bij welke categorie horen. Dat is niet cosmetisch: het
zijn precies de gegevens die de bijbehorende beslisregel nodig heeft. Bij een huismeester vraagt de
applicatie om uren en totale kosten (voor de toets aan het maximumtarief van Tabel 9); bij roerende
zaken om aanschafwaarde en gebruiksjaar (voor de afschrijvingsstaffel van p. 31-32); bij een
WKO-installatie of de vaste kosten gesplitst zijn (p. 49).

Ontbreekt een antwoord, dan rekent het model niet door maar stelt het de vraag — dat is het
ORANJE-mechanisme uit `05-status-en-zekerheidsmodel.md`, doorgetrokken naar de interface.

De vraag "is deze post overeengekomen?" wordt één keer centraal gesteld en geldt dan als standaard
voor alle posten; per post kan de gebruiker ervan afwijken. Het beleidsboek staat toe dat dit
stilzwijgend is overeengekomen (p. 9), dus een globaal antwoord is hier verdedigbaar.

## Het resultaat

- **Vier stat-tiles**: volgens verhuurder, volgens model, potentiële correctie, nog onbeoordeeld
  (plus het voorschotsaldo als dat bekend is).
- **Eén verdeelbalk** die laat zien welk deel van de afrekening rood, oranje, groen of buiten de
  bevoegdheid valt.
- **Bevindingen per post**, gesorteerd op ernst, met per post de berekening stap voor stap, de
  toelichting met paginaverwijzing, wat er ontbreekt, en de toegepaste regel-ID's.
- **Een werklijst** van wat er nog moet worden opgevraagd, gesorteerd op financieel belang.
- **Vier sterkte-indicatoren** — geen kanspercentage; het beleidsboek biedt daar geen basis voor.
- **Een conceptbrief**: een bezwaarbrief (par. 6.3.1) of een opvraagbrief (par. 6.3.2). Zonder een
  van die twee is een verzoek bij de Huurcommissie niet-ontvankelijk, hoe sterk de zaak inhoudelijk
  ook is.

### Toegankelijkheid van de statuskleuren

Groen en rood liggen voor deuteranopie op een CVD-ΔE van 4,1 — kleurenblinde lezers kunnen ze niet
uit elkaar houden. Kleur draagt hier dus nooit alleen betekenis. Elke status heeft daarnaast:

- een **glyph** (`✓` `?` `!` `–`) en een **woord** ("Lijkt correct", "Onvoldoende informatie",
  "Mogelijk onterecht", "Buiten bevoegdheid");
- in de verdeelbalk een eigen **arceringspatroon** en een direct bedragslabel;
- een tekstuele beschrijving van de hele balk voor schermlezers;
- een volledige tabelweergave in de bevindingenlijst.

Donkere modus volgt de systeemvoorkeur en is met de themaknop te overrulen. De interface werkt vanaf
390 px zonder horizontale scroll.

## API

| Methode | Pad | Doel |
| --- | --- | --- |
| `GET` | `/api/meta` | Categorieën, velddefinities, woningtypen, beschikbare jaren, termijnen, regelindex |
| `POST` | `/api/upload` | Document inlezen → conceptdossier |
| `POST` | `/api/beoordeel` | Dossier → beoordeling (JSON) |
| `POST` | `/api/brief` | Dossier → conceptbezwaarbrief of opvraagbrief (platte tekst) |
| `GET` | `/api/voorbeelden` | Beschikbare voorbeeldafrekeningen |
| `GET` | `/api/gezondheid` | Status en beleidsboekversie |

De API is stateless en slaat niets op: een dossier gaat heen, een beoordeling komt terug. Dat is
bewust — een servicekostendossier bevat adres-, contract- en betaalgegevens.

## Architectuur

```
app/
  main.py              FastAPI: API + statische interface
  parsers/
    documenten.py      PDF/CSV/tekst -> platte tekst
    bedragen.py        Nederlandse bedragen, jaren en perioden uit vrije tekst
    classificatie.py   omschrijving -> categorie (trefwoorden, positie vóór lengte)
    afrekening.py      tekst -> conceptdossier met herkomst per waarde
  static/              index.html, app.js, styles.css (geen buildstap, geen frameworks)
engine/
  serialisatie.py      beoordeling -> JSON voor de API
  brief.py             bezwaarbrief en opvraagbrief
```

De rekenkern is niet aangeraakt: `app/` roept dezelfde `beoordeel_dossier()` aan als de CLI. De
zeventien rekenvoorbeelden uit het beleidsboek blijven daarmee de gezamenlijke validatie van beide.

## Wat er nog niet is

- **OCR** voor gescande afrekeningen.
- **Meerdere boekjaren in één sessie.** De rekenkern kan het (`python3 -m engine jaar1.json
  jaar2.json`), de interface toont nu één jaar tegelijk.
- **Opslag.** Elke sessie begint leeg; er is geen account en geen database.
- **Toetsing van het voorschotbedrag** (art. 7:261 BW) als aparte procedure. De regels staan in de
  analyse (R-VS-01, R-VS-02) maar hebben nog geen eigen schermflow, onder meer omdat het
  CPI-percentage uit art. 19 lid 3 Uhw niet in het beleidsboek staat.
