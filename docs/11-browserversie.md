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
   de classificatie meteen een categorie voor op basis van de omschrijving. Wat is ingelezen, gaat
   daarna langs de huurder ter controle: de parser is de zwakste schakel in de keten, en alleen de
   huurder ziet op de afrekening wat er werkelijk staat. Omschrijving, soort kosten en bedrag zijn
   per post aan te passen, een post is te verwijderen en er is er een toe te voegen.
   Optioneel kunnen tot zes foto's mee (zie *Foto's* hieronder).
3. **Vijf vragen** — boekjaar, woningtype, bewoners en complexgrootte, wat de verhuurder heeft
   aangeleverd, en het betaalde voorschot.
4. **Voorlopige beoordeling** — het bedrag waar de huurder mogelijk recht op heeft, de posten per status,
   en de keuze: indienen of zelf een bezwaarbrief maken.

Na indienen volgt een bevestiging met dossiernummer en de mededeling dat er contact wordt opgenomen met
een rapport. Het dossier verschijnt op het dashboard, waar de huurder de status en de aantekeningen van
de beoordelaar terugziet.

**Beheer.** Een overzicht van binnengekomen aanvragen met kengetallen (nieuw, in behandeling, totale
claim, gemiddelde per dossier), zoeken op naam, adres, dossiernummer of jaar, filters per status, en
per dossier een werkblad.

## Het werkblad van de beoordelaar

Een dossier is pas afgehandeld als er een uitkomst ligt, en daar zijn stappen voor nodig die niet in
één scherm passen. Het dossier doorloopt er zes; elke stap is in de applicatie zelf uit te voeren en
wordt met een tijdstempel vastgelegd, zodat niemand hoeft te raden hoe ver het staat. Het eerste
afgevinkte punt zet de status van *Nieuw* op *In behandeling*.

| Stap | Wat er gebeurt |
| --- | --- |
| **1. Ontvankelijkheid** | De huurdersstroom vraagt niet naar de procedure, dus `dossier.procedure` komt leeg binnen en de toets is onvolledig. Hier vult de beoordelaar datum huurovereenkomst, sector, of de afrekening is ontvangen, of er schriftelijk bezwaar is gemaakt, of de afrekening is opgevraagd, en de verzoekdatum. Opslaan laat de kern opnieuw toetsen. |
| **2. Posten** | Elke post die nog niet te beoordelen is, staat op een lijst met het bedrag dat ermee gemoeid is en wat eraan ontbreekt. Aanvullen opent hetzelfde formulier dat de huurder ziet, nu gevuld met wat de verhuurder heeft aangeleverd. |
| **3. Stukken** | De ontbrekende gegevens worden automatisch een lijst op te vragen stukken, op bedrag gesorteerd. Per stuk: nog niet gevraagd, opgevraagd of ontvangen, met de datum. Er hoort een opvraagbrief bij op grond van artikel 7:259 lid 4 BW. |
| **4. Herbeoordelen** | `Kern.beoordeelDossier` rekent opnieuw over de aangevulde invoer. Alle totalen, statussen en bevindingen worden overschreven; wijzigt de correctie, dan komt dat als aantekening in het verloop — ook de huurder ziet die. |
| **5. Rapport** | Het rapport met alle bevindingen, plus de bezwaarbrief en de brief om een ontbrekende afrekening op te vragen. |
| **6. Afronden** | Uitkomst (verhuurder heeft gecorrigeerd, voorgelegd aan de Huurcommissie, geen grond, huurder ziet ervan af, anders), het daadwerkelijk gecorrigeerde bedrag, een toelichting. Dat bepaalt de eindstatus en verschijnt bij de huurder op zijn eigen pagina. |

Herbeoordelen vraagt om de oorspronkelijke invoer, niet alleen om de bevindingen. Die gaat daarom als
`invoer` mee het dossier in. Een dossier van vóór die verandering heeft dat veld niet; het werkblad
zegt dat dan met zoveel woorden en laat stap 1, 2 en 4 vallen — rapport, stukken en afronden werken
gewoon.

### Het rapport

Het rapport wordt als DOM opgebouwd en voor het afdrukken naar een nieuw venster gekopieerd; er wordt
nergens tekst in HTML geplakt. Het bevat de dossiergegevens, een samenvatting met de bedragen en het
saldo tegenover het voorschot, de ontvankelijkheidstoets, alle bevindingen per status met de uitleg in
gewone taal, de berekening en de regel-ID's, de nog op te vragen stukken, een conclusie en de
vervolgstappen met hun termijnen. Is het dossier afgerond, dan staat de uitkomst erin in plaats van de
vervolgstappen. Dezelfde opmaak geldt voor het voorbeeld in de applicatie en voor de afdruk; daarnaast
is er een tekstversie om in een e-mail te plakken.

### Brieven

Drie concepten, alle drie met de wettelijke grondslag erin: bezwaar tegen de afrekening (art. 7:260
BW), inzage in de onderliggende stukken (art. 7:259 lid 4 BW), en het opvragen van een afrekening die
nooit is verstrekt (art. 7:259 lid 2 BW). De huurder krijgt dezelfde brieven aangeboden aan het eind
van de controle; ze worden uit één bron opgebouwd, zodat de twee kanten niet uit elkaar kunnen lopen.

## Opslag

| Modus | Wanneer | Wat het betekent |
| --- | --- | --- |
| **Gedeeld** | De pagina draait als Artifact met de `db`-capability | Een huurder dient in, de beheerder ziet het live binnenkomen |
| **Lokaal** | Overal elders, bijvoorbeeld op een eigen webserver | Werkt volledig, maar dossiers blijven op dat ene apparaat |

`web/opslag.js` kiest zelf. De pagina start altijd lokaal en schakelt over zodra `claude.use("db")`
antwoordt; niets wacht op een capability die misschien nooit komt. De beheeromgeving zegt er expliciet
bij in welke modus zij draait, zodat niemand denkt aanvragen te missen die er nooit waren.

Wat er wordt opgeslagen bij indienen: de contactgegevens, het boekjaar, de bedragen, de woninggegevens
en alle bevindingen inclusief berekening en regel-ID's, plus de eventuele foto's. Niet: het geüploade
bestand zelf.

### Concept

Een halfingevulde controle overleeft het sluiten van het tabblad. `Opslag.bewaarConcept` legt na elke
stap de stand vast in `localStorage` (`servicekosten.concept.v1`); het dashboard biedt hem daarna aan
met "Verder waar je was". Na een week vervalt het concept, en bij indienen of bij het starten van een
nieuwe controle wordt hij gewist. Lukt het bewaren niet omdat de foto's te groot zijn, dan wordt het
concept zonder foto's bewaard — de rest van het werk verliezen is erger dan een foto opnieuw maken.

## Foto's

Een huurder met een papieren afrekening heeft vaak alleen een telefoon. `web/fotos.js` verkleint elke
gekozen foto in de browser tot de lange zijde hoogstens 1600 px is en het resultaat onder 170 kB blijft
— ruim onder de documentlimiet van 256 KiB — door eerst de resolutie en pas daarna de kwaliteit op te
offeren: de leesbaarheid van een afrekening zit vooral in de resolutie. Er gaat nooit een onbewerkte
foto het apparaat af.

Maximaal zes foto's per dossier. Ze gaan niet in het hoofddocument maar in een subcollectie
`aanvragen/<id>/bijlagen/` (lokaal: onder `_bijlagen`), zodat een foto nooit ten koste gaat van de
bevindingen. In de beheeromgeving staan ze bij het dossier, aanklikbaar op volle grootte.

**Geen OCR.** De foto wordt niet gelezen maar doorgegeven: de beoordelaar kijkt ernaar. Het content
security policy van een Artifact staat geen fetch naar een CDN toe, dus een OCR-bibliotheek kan haar
wasm en taalgegevens niet laden; de `assets`-capability is bovendien alleen voor schrijvers, dus een
huurder kan er sowieso niets mee. Een foto is daarmee een aanvulling op de ingevoerde posten, geen
vervanging: zonder posten valt er niets te rekenen, en de applicatie zegt dat ook.

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

### Op een telefoon

- **De pagina is een volwaardig document.** `<!doctype html>`, `<html lang="nl">`, `<meta charset>` en
  vooral `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
  Zonder die laatste regel legt mobiel Safari de pagina op 980 px uit en schaalt hem weg: geen enkele
  mediaquery voor een telefoon komt dan aan bod, de vaste actiebalk blijft `static`, en de lezer moet
  links-rechts schuiven om een regel uit te lezen. De Artifact-omgeving voegt zelf een viewport toe en
  verborg het probleem daar; op een gewone webserver (Vercel) niet. `viewport-fit=cover` is bovendien
  de voorwaarde waaronder `env(safe-area-inset-*)` iets teruggeeft.
  `tests/test_web_port.py::test_pagina_is_een_volwaardig_document` bewaakt het.
- **Vaste actiebalk.** Tot 720 px staat de hoofdactie van elke stap onderaan vast, binnen duimbereik,
  met `env(safe-area-inset-bottom)` voor de thuisbalk van de telefoon. Het scherm houdt daar ruimte
  voor vrij, zodat de balk nooit iets afdekt. Daarboven staat hij gewoon in de tekststroom.
- **De terugknop van de telefoon werkt.** Elk scherm krijgt een eigen stap in de geschiedenis; `popstate`
  zet het bijbehorende scherm terug uit wat er nog in het geheugen staat. De terugknoppen in de
  applicatie doen hetzelfde als die van de telefoon, zodat de huurder nooit per ongeluk de applicatie
  uit loopt.
- **Aangesprongen blokken blijven zichtbaar** onder de plakkende kopbalk (`scroll-margin-top`, ruimer
  op smalle schermen waar die balk twee rijen heeft).
- **Lijsten stapelen.** Onder 560 px staan status en bedrag van een dossier op één regel en krijgen de
  naam en de kenmerken de volle breedte; in de controlestap staan soort en bedrag naast elkaar.
- **De rolwissel verdwijnt tijdens de controle.** Huurder/beheer kiezen heeft alleen zin op het
  dashboard en in de beheeromgeving; tijdens de vier stappen kostte die knop een tweede kopregel en
  daarmee ruim vijftig pixels van een scherm dat er maar 664 heeft.
- Invoervelden dragen `inputmode` en `enterkeyhint`, zodat het toetsenbord meteen goed staat.

Gecontroleerd met echte apparaatemulatie (iPhone 13, iPhone 14 Pro Max, Pixel 7), die de viewport-tag
respecteert waar een vast ingestelde vensterbreedte dat niet doet: op alle zeventien schermen van beide
rollen is `scrollWidth` gelijk aan de vensterbreedte en steekt geen enkel element buiten de rand.

## Grenzen

- **Geen OCR.** Een gescande pdf zonder tekstlaag levert een melding op met de suggestie de tekst te
  plakken, de posten zelf in te voeren, of er een foto bij te doen voor de beoordelaar.
- **Eén boekjaar per dossier**, conform art. 7:260 lid 2 BW.
- **Geen e-mail.** De applicatie legt het dossier vast; het daadwerkelijke contact met de huurder gebeurt
  buiten de applicatie om.
- **Het geüploade bestand wordt niet bewaard**, alleen de eruit afgeleide posten en bevindingen — en
  de foto's die de huurder zelf toevoegt.
- **Het concept staat alleen op dat ene apparaat** en is niet versleuteld: het is een gemak, geen
  archief.
