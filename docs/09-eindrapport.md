# 09 - Eindrapport

## 1. Wat volledig geautomatiseerd kan worden

Van de 76 beslisregels zijn er **39 volledig automatiseerbaar**. Ze delen één kenmerk: het
beleidsboek geeft een getal, een percentage of een verbod, en de invoer is een feit dat uit een
document te halen is.

| Blok | Waarom automatisch | Regels |
| --- | --- | --- |
| **Alle rekenwerk met normbedragen** | Nibud-tabellen 1-8 en 11 zijn volledig gespecificeerd | R-NUT-02, R-BEW-01, R-BEW-02 |
| **Periodemethoden** | Graaddagen, seizoenspercentages en evenredige deling zijn rekenkundig gesloten | R-PER-01 t/m R-PER-04 |
| **Verdeelsleutels nutsvoorzieningen** | 35/65 voor gas, gelijk voor elektra en water | R-VDS-01, R-VDS-02 |
| **Afschrijving roerende zaken** | 20/10/6,67%, herwaardering 60%, nul na twee perioden | R-ROE-03, R-ROE-04, R-ROE-05, R-ROE-06 |
| **Maximumtarieven en -percentages** | Uurtarief huismeester, EUR 5,00 wasapparatuur, 2%/1%/5% administratie met EUR 7,50-EUR 75,00 | R-HUI-01 (rekendeel), R-ADM-01 |
| **Forfaitaire verdelingen** | 1/3 glazenwassen, 50% ontstoppingscontract, 15% glasverzekering, 20% 24-uursservice | R-KH-01, R-KH-05, R-VZ-02, R-SK-12 |
| **Verboden posten** | Leegstandsderving, opstalverzekering, rookmelders, mutatiekosten, onroerende zaken | R-NSK-01, R-VZ-01, R-ROE-07, R-KH-02, R-ROE-01 (bij vastgestelde kwalificatie) |
| **Alle termijnen en drempels** | Datumrekenen: Tabel 10, drie weken, zes weken, EUR 36,00, EUR 3,00 | R-PRC-03 t/m R-PRC-08 |

Voorwaarde: het dossier moet gestructureerd zijn. Het uitlezen van een PDF-afrekening naar deze
velden is een apart probleem, dat dit model niet oplost.

## 2. Wat semi-automatisch kan

**33 regels.** Het rekenwerk is deterministisch, maar minstens één voorwaarde is een oordeel. Het
systeem rekent door, toont het resultaat als voorlopig en benoemt wie de openstaande vraag moet
beantwoorden.

- **Classificatie van kostenposten.** "Servicekosten algemeen EUR 340" is niet te herleiden tot een
  categorie. Voorstel doen kan; vaststellen niet.
- **Bereikbaarheid en gebruiksrecht.** Ruiten, kanalen, leidingen, tuin, buitenruimte: het
  beleidsboek koppelt hier steeds de doorberekenbaarheid aan een feitelijke situatie.
- **Roerend of onroerend.** Rekenen kan pas na kwalificatie. Bij zonnepanelen is de vuistregel
  scherp (geïntegreerd = onroerend, gemonteerd = roerend, p. 33) maar de toepassing vergt inspectie.
- **Afwijken van standaardverdelingen.** 70/30 bij de huismeester en de gelijke verdeelsleutel mogen
  worden verlaten als de feiten dat rechtvaardigen (p. 29, p. 41).
- **Bewijswaardering.** Of een document "de factuur zelf" is en niet een grootboekkaart (p. 59), of
  het specificatieformulier volledig is ingevuld (art. 18 lid 4 Uhw).

## 3. Wat structureel menselijke of juridische beoordeling vereist

**4 regels zijn onherleidbaar handmatig**, en daarnaast staan er in `04-datamodel.md` twaalf
oordelen die per definitie niet automatiseerbaar zijn.

| Onderwerp | Waarom | Bron |
| --- | --- | --- |
| Karakter van de groenvoorziening (openbaar / kijktuin) | Feitelijk oordeel ter plaatse | R-KH-03, p. 37 |
| Schilderwerk: uitdrukkelijk overeengekomen? | Contractuitleg | R-KH-10, p. 39 |
| WKO: splitsing vaste kosten en vereenzelviging | Boekhoudkundig en rechtspersonenrechtelijk | R-WKO-01, p. 49-50 |
| Onbekende kostenposten | Beide Besluiten zijn niet limitatief | R-SK-OPEN, p. 29, 75, 82 |
| "In belangrijke mate" afwijkend verbruik | Maatstaf niet gekwantificeerd | p. 12 |
| "Gemotiveerd en overtuigend" betwist | Bewijswaardering | p. 15 |
| Kwaliteit van geleverde diensten | Achteraf niet toetsbaar zonder overtuigend (tegen)bewijs | p. 25-26 |
| "In aanzienlijke mate" afwijkend voorschot | Maatstaf niet gekwantificeerd | p. 23-24 |

De vier gevallen waarin de Huurcommissie onderzoek ter plaatse kan gelasten (betwist verbruik,
roerende zaken, tuinonderhoud, verdeelsleutel - p. 63-64) vormen samen de scherpste afbakening:
dat is precies de lijst geschilpunten die per definitie niet uit documenten te beslissen is.

## 4. Minimale documenten voor een eerste screening

Met deze vier kan een zinvolle eerste beoordeling worden gedaan:

1. **De servicekostenafrekening** over het betreffende boekjaar (naar soort uitgesplitst, met de
   wijze van berekening - art. 7:259 lid 2 BW).
2. **De huurovereenkomst** inclusief algemene voorwaarden, voor de grondslag, de sector en het
   voorschotbedrag.
3. **De betalingsgegevens van het voorschot** over dat jaar.
4. **Antwoord op vijf vragen aan de huurder:** zelfstandig of onzelfstandig, aantal bewoners,
   woningtype, huurperiode binnen het boekjaar, en welke posten worden betwist.

Daarmee zijn al te bepalen: ontvankelijkheid en termijnen, de drempel van EUR 36,00, alle verboden
posten, alle maximumtarieven en -percentages, en de Nibud-vergelijking voor nutsvoorzieningen.
In casus 2 en 4 leidt dit alleen al tot correcties van respectievelijk EUR 164,00 en EUR 746,70.

## 5. Documenten voor een definitieve beoordeling

Daar komt bij, per post die nog ORANJE is:

- **facturen of betaalbewijzen** per kostenpost (een grootboekkaart volstaat niet, p. 59);
- **het ingevulde specificatieformulier** (bijlage VII Uitvoeringsregeling, p. 60);
- **meterstanden** begin en eind, plus de verbruiksberekening (p. 63);
- **aankoopfacturen** van roerende zaken, of een opgave van soort en aantal (p. 31);
- **functieomschrijving, urenverantwoording en facturen** van de huismeester (p. 41);
- **inspectierapport** met ketelrendement bij betwiste stookkosten (p. 15);
- **polis- en premiespecificatie** bij verzekeringen (p. 43);
- **splitsing van de vaste kosten** bij een WKO-installatie (p. 49);
- bij een VvE-verhuurder: **jaarrekening, ALV-verslag, VvE-afrekening en de afrekening aan de
  huurder** (p. 59).

Juridische grondslag om deze op te vragen: art. 7:259 lid 4 BW geeft de huurder desverzocht recht
op inzage in de onderliggende boeken en bescheiden (p. 65).

## 6. Regels met het grootste correctiepotentieel

Op volgorde van verwachte financiële impact, afgeleid uit de structuur van het beleidsboek en
zichtbaar in de casussen:

| # | Regel | Waarom groot | Bron |
| --- | --- | --- | --- |
| 1 | **R-BEW-01/02/03** - ontbrekende onderbouwing | Zet een post van honderden euro's terug naar EUR 12,00 of EUR 0,00. In casus 3 goed voor EUR 1.100,50 op EUR 1.547,00. Werkt bovendien op álle posten tegelijk | par. 6.4.2, p. 60-61 |
| 2 | **R-PRC-08** - aanlevertermijn verhuurder | Te laat aangeleverde informatie telt niet mee, waardoor regel 1 van toepassing wordt. Dit is een termijn, geen inhoudelijk debat | par. 6.4.1, p. 59 |
| 3 | **R-ROE-01** - onroerende zaken | Gebruiksvergoedingen voor cv-installaties, inbouwapparatuur en geïntegreerde zonnepanelen zijn structureel onterecht en komen in de praktijk jaar na jaar terug | par. 4.3.3, p. 31 |
| 4 | **R-VZ-01** - opstalverzekering | Volledig verboden post die in veel afrekeningen staat; herhaalt zich elk jaar | par. 4.3.9, p. 42-43 |
| 5 | **R-HUI-01** - maximaal uurtarief huismeester | Combinatie van een hard tarief en de 70/30-verdeling; bij grote complexen loopt dit snel op | par. 4.3.6, p. 40-41 |
| 6 | **R-ADM-01** - administratiekosten | Percentage én absoluut maximum van EUR 75,00; bovendien daalt de grondslag mee met elke andere correctie | par. 4.3.11, p. 43 |
| 7 | **R-NUT-02/03** - Nibud-normverbruik | Bij ontbrekende of betwiste meterstanden gaat het om de grootste post op de afrekening | par. 3.1-3.3 |
| 8 | **R-NSK-01** - leegstandsderving | Volledig verboden, eenvoudig aan te tonen | par. 4.3.14, p. 44 |

De eerste twee zijn procedureel, niet inhoudelijk. Dat is het belangrijkste inzicht uit deze
analyse: de sterkste positie van de huurder ontstaat niet door te bewijzen dat een bedrag te hoog
is, maar doordat de verhuurder zijn onderbouwingsplicht binnen de termijn niet nakomt.

## 7. Wat onvoldoende deterministisch is voor automatisering

| Onderdeel | Probleem |
| --- | --- |
| "In belangrijke mate" afwijkend verbruik (p. 12) | Geen drempelwaarde. Elke keuze is een aanname van de bouwer, niet van de Huurcommissie |
| "In aanzienlijke mate" afwijkend voorschot (p. 23-24) | Idem |
| "Gemotiveerd en overtuigend" betwisten (p. 15) | Bewijswaardering |
| "Goede verklaring" voor hoog verbruik (p. 12) | Open categorie; alleen "een strenge winter" wordt genoemd |
| "Noemenswaardige kosten" (Bbkh, p. 83) | Geen bedrag; het Besluit noemt alleen voorbeelden |
| Levensduur van roerende zaken (p. 31-32) | Uitdrukkelijke afwijkingsruimte voor de Huurcommissie |
| Afwijken van 70/30 bij de huismeester (p. 41) | "Als de feitelijke werkzaamheden dat rechtvaardigen" |
| Redelijkheid van een verdeelsleutel (p. 29) | Open norm |
| Nummering van de vier bewijssituaties (p. 60-61) | De brontekst is intern inconsistent; zie R-BEW-02 |
| Roerend/onroerend (p. 31-33) | Verkeersopvatting en bestanddeelvorming |
| Vereenzelviging bij WKO (p. 50) | "Uitzonderlijke situatie", geen criteria gegeven |

Het beleidsboek zegt dit zelf ook: de Huurcommissie handelt volgens deze beleidslijnen en wijkt
"alleen gemotiveerd af voor zover het voorliggende geschil dat rechtvaardigt" (p. 3). Een model dat
100% zekerheid claimt, claimt meer dan de bron zelf.

## 8. Aanvullende bronnen die nodig zijn vóór productie

Dit is de blokkerende lijst. Zonder deze gegevens is het model onvolledig, en dat is geen detail:
punt 1 en 2 raken de kern van het bewijsregime en de bevoegdheid.

| # | Bron | Waarvoor | Status |
| --- | --- | --- | --- |
| 1 | **Bijlage VIII Uitvoeringsregeling huurprijzen woonruimte** | De forfaitaire tarieven bij ontbrekende onderbouwing. Het beleidsboek noemt alleen de verbruiken (Tabel 11), niet de bedragen | **Blokkerend** |
| 2 | **Beleidsboek Waarderingsstelsel zelfstandige woonruimte, bijlagen 4 en 5** | Liberalisatiegrens, socialehuurgrens, vrijesectorgrens per jaar - bepalend voor de bevoegdheid | **Blokkerend** |
| 3 | **Bijlage VII Uitvoeringsregeling** (specificatieformulier) | Om te kunnen beoordelen of het formulier volledig is ingevuld | Blokkerend voor R-BEW-02 |
| 4 | **CBS consumentenprijsindex werknemersgezinnen** | Indexering bij de voorschottoetsing (art. 19 lid 3 Uhw) | Blokkerend voor R-VS-02 |
| 5 | **Nibud-gegevens 2026 en later** | Het beleidsboek loopt tot en met 2025; Nibud stelt jaarlijks in juli vast | Blokkerend zodra boekjaar 2026 beoordeeld wordt |
| 6 | **Graaddagen De Bilt 2026 en later** | Graaddagenmethode voor gas | Idem |
| 7 | **Warmtewet** | Maximumbedragen bij levering door een derde (WKO) | Nodig voor volledige WKO-beoordeling |
| 8 | **Besluit kleine herstellingen, volledige tekst** | Onderdelen c, d, e, f, h, j, k, o, s, t, u, v hebben geen uitvoeringsbeleid in dit beleidsboek | Aanwezig in bijlage 4, maar zonder Huurcommissiebeleid |
| 9 | **Jurisprudentie en uitspraken van de Huurcommissie** | Invulling van de open normen uit paragraaf 7 | Sterk aanbevolen |
| 10 | **Beleidsboek Waarderingsstelsel onzelfstandige woonruimte, par. 1.4** | Definitie zelfstandig/onzelfstandig, waarop vrijwel elke norm steunt | Aanbevolen |
| 11 | **Eerdere versies van dit beleidsboek** (1 januari 2026, 1 juli 2025 en ouder) | Verzoeken van vóór 1 juli 2026 vallen onder de oude versie (p. 3); een dossier over boekjaar 2023 of 2024 kan dus een ander normenkader hebben | **Blokkerend voor oudere boekjaren** |

Punt 11 verdient nadruk. Het beleidsboek regelt zijn eigen overgangsrecht: de versie van 1 juli 2026
geldt alleen voor verzoeken die op of na die datum worden ingediend. Een productiesysteem moet
daarom **versies naast elkaar** kunnen draaien en de juiste kiezen op basis van de indieningsdatum.
De huidige repo implementeert één versie; dat is voor een prototype voldoende, voor productie niet.

## 9. Wat het systeem aan de huurder moet kunnen uitleggen

De eis uit de opdracht was dat het systeem niet alleen "lijkt onjuist" zegt. Het model levert per
post een volledige redenering op. Letterlijk uit casus 2:

> **Huismeester - ROOD**
> De verhuurder heeft voor deze kostenpost EUR 226,67 gerekend.
> Toets aan het maximale uurtarief: 800 uur x EUR 40,00 = EUR 32.000,00; gefactureerd
> EUR 34.000,00, dus getoetst op EUR 32.000,00 (Tabel 9, p. 40).
> 70% ten laste van de huurders = EUR 22.400,00; 30% blijft voor rekening van de verhuurder (p. 41).
> Per woonruimte: EUR 22.400,00 / 150 = EUR 149,33.
> **Het potentiële verschil bedraagt daarom EUR 77,34.**
> Kanttekening: de Huurcommissie kan van de 70/30-verdeling afwijken als de feitelijke
> werkzaamheden dat rechtvaardigen (p. 41).

Elke bevinding bestaat uit: bedrag van de verhuurder, toegepaste regel met paginaverwijzing, de
berekening stap voor stap, het verschil, en - waar het beleidsboek ruimte laat - de kanttekening.
Dat laatste is geen slag om de arm maar informatie: het vertelt de huurder welk deel van zijn zaak
stevig staat en welk deel afhangt van een weging.

## 10. Belangrijkste aanbevelingen

1. **Bouw het bewijsregime als eerste af.** De grootste correcties komen uit par. 6.4.2 en 6.4.1,
   niet uit inhoudelijke normtoetsing. Een systeem dat alleen checkt "welk bewijs ontbreekt en welke
   termijn is verstreken" levert al het meeste op.
2. **Maak versiebeheer van het beleidsboek onderdeel van het datamodel**, niet van de code. De
   Nibud-tabellen veranderen jaarlijks in juli en het beleidsboek halfjaarlijks; `data/normen.json`
   moet daarom per indieningsdatum een versie kunnen kiezen.
3. **Zet de drie blokkerende bronnen** (bijlage VII en VIII Uitvoeringsregeling, grensbedragen
   waarderingsstelsel) vóór elke verdere uitbouw op de agenda.
4. **Laat ORANJE nooit vervagen tot een schatting.** De waarde van dit model zit in het onderscheid
   tussen wat vaststaat en wat nog moet worden opgehaald. Een gemiddelde over beide is minder waard
   dan beide apart.
5. **Toon het risico van een hogere vaststelling.** Art. 2.3.3 (p. 10) laat toe dat de Huurcommissie
   hoger uitkomt dan de verhuurder. Een huurder moet dat weten vóór hij een procedure start.
