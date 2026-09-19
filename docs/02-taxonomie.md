# 02 - Taxonomie van servicekostencategorieën

Iedere kostenpost op een afrekening wordt eerst in precies één categorie geplaatst. Die
classificatie bepaalt welke beslisboom, welk bewijsregime en welke normen gelden. Een post die niet
te classificeren is, wordt nooit automatisch afgewezen: hij wordt ORANJE (zie R-SK-OPEN).

## A. Kosten nutsvoorzieningen met een individuele meter (hoofdstuk 3)

| Code | Categorie | Kern van de regel | Bron |
| --- | --- | --- | --- |
| `NUT-GAS-METER` | Gas met eigen meter | Meterstanden zijn uitgangspunt; anders Nibud-norm; graaddagenmethode bij kortere periode | par. 3.1, p. 13-16 |
| `NUT-ELK-METER` | Elektriciteit met eigen meter | Idem; seizoenspatronen bij kortere periode; belastingteruggave in mindering | par. 3.2, p. 17-20 |
| `NUT-WATER-METER` | Water met eigen meter | Idem; evenredig deel bij kortere periode | par. 3.3, p. 21-23 |
| `VS-NUT` | Voorschotbedrag nutsvoorzieningen | Aparte procedure (art. 7:261 BW); alleen voor nutsvoorzieningen met eigen meter | par. 3.4, p. 23-24 |

## B. (Overige) servicekosten - nutsvoorzieningen zónder eigen meter (par. 4.2)

| Code | Categorie | Verdeelsleutel | Bron |
| --- | --- | --- | --- |
| `NUT-GAS-ZM` | Gas zonder eigen meter | 35% vast gelijk over woonruimten, 65% variabel naar oppervlakte | p. 26 |
| `NUT-ELK-ZM` | Elektriciteit zonder eigen meter | Gelijk over het aantal woonruimten | p. 27 |
| `NUT-WATER-ZM` | Water zonder eigen meter | Gelijk over het aantal woonruimten | p. 27 |

## C. (Overige) zaken en diensten - Besluit servicekosten, posten 1 t/m 11 (par. 4.3)

| Code | Besluit-post | Categorie | Bijzondere norm | Bron |
| --- | --- | --- | --- | --- |
| `SK-01` | 1 | Warmtevoorzieningen gemeenschappelijke gedeelten | - | p. 30 |
| `SK-02` | 2 | Nutsvoorzieningen gemeenschappelijke gedeelten | - | p. 30 |
| `SK-03` | 3 | Roerende zaken (gebruiksvergoeding) | 20/10/6,67% afschrijving; herwaardering 60% | p. 30-35 |
| `SK-04-GLAS` | 4 (Bbkh q) | Glazen wassen | 1/3 arbeidskosten als niet gespecificeerd | p. 36 |
| `SK-04-SCHOONMAAK` | 4 (Bbkh p) | Schoonmaak gemeenschappelijke ruimten | mutatiekosten uitgesloten | p. 36 |
| `SK-04-TUIN` | 4 (Bbkh l) | Tuinonderhoud | exclusief gebruiksrecht; kijktuin uitgesloten | p. 37 |
| `SK-04-GLADHEID` | 4 (Bbkh l) | Gladheidsbestrijding | exclusief (gezamenlijk) gebruiksrecht | p. 37 |
| `SK-04-ONTSTOPPING` | 4 (Bbkh n) | Ontstoppen leidingen en riolering | contract: 50/50 | p. 37 |
| `SK-04-SCHOORSTEEN` | 4 (Bbkh m) | Schoorsteen- en kanaalreiniging | bereikbaarheid | p. 38 |
| `SK-04-LAMPEN` | 4 (Bbkh g) | Lampen vervangen | armaturen/installatie uitgesloten | p. 38 |
| `SK-04-ONGEDIERTE` | 4 (Bbkh r) | Ongediertebestrijding | tenzij bouwkundige oorzaak | p. 38 |
| `SK-04-INSTALLATIE` | 4 (Bbkh i) | Onderhoud installaties binnen de woonruimte | onroerende installaties uitgesloten | p. 38-39 |
| `SK-04-SCHILDERWERK` | 4 (Bbkh a, b) | Schilderwerkzaamheden | alleen bij uitdrukkelijke afspraak; 5 of 10 jaar | p. 39 |
| `SK-05` | 5 | Huisvuil | vuilniszakken, transport, container | p. 39-40 |
| `SK-06` | 6 | Huismeester | max uurtarief; 70/30 | p. 40-41 |
| `SK-06B` | 6 | Externe beveiliging | 70/30; geen max uurtarief | p. 41 |
| `SK-07` | 7 | Signaallevering | abonnement, auteursrechten, liftalarm | p. 42 |
| `SK-08` | 8 | Elektronische apparatuur | alleen roerend | p. 42 |
| `SK-09-OPSTAL` | 9 | Opstal- en aanverwante verzekeringen | **niet doorberekenbaar** | p. 42-43 |
| `SK-09-GLAS` | 9 | Glasverzekering | 15% van opstal als niet gespecificeerd | p. 43 |
| `SK-09-INBOEDEL` | 9 | Inboedelverzekering roerende zaken | doorberekenbaar | p. 43 |
| `SK-10` | 10 | Gemeenschappelijke ruimten | verzamelpost; uitsplitsen | p. 43 |
| `SK-11` | 11 | Administratiekosten | 2%/1%/5%; min EUR 7,50; max EUR 75,00 | p. 43 |

## D. Aanvullingen van de Huurcommissie op het Besluit

| Code | Categorie | Bijzondere norm | Bron |
| --- | --- | --- | --- |
| `SK-12` | Onderhoudscontract met 24-uursservice | 20% als niet gespecificeerd | p. 44 |
| `SK-13` | Fondsen | vier voorwaarden; omvang max 3x jaaropbrengst | p. 44 |
| `SK-14-WKO` | Warmtelevering via WKO-installatie | kapitaals- en onderhoudslasten uitgesloten | p. 49-50 |

`SK-14-WKO` is geen aparte post in het Besluit servicekosten; hoofdstuk 5.4 behandelt deze situatie
als afzonderlijke kwestie. In de taxonomie krijgt zij een eigen code omdat de beslisboom wezenlijk
anders loopt dan bij `SK-01`.

## E. Geen servicekosten / buiten de bevoegdheid

| Code | Categorie | Status | Bron |
| --- | --- | --- | --- |
| `NSK-01` | Leegstandsderving | **ROOD** - niet toegestaan door te berekenen | p. 44 |
| `NSK-02` | Belastingen en heffingen | **BUITEN BEVOEGDHEID** - geen servicekosten | p. 44, p. 51 |
| `NSK-03` | Zorgservicekosten | **BUITEN BEVOEGDHEID** - alleen woonservicekosten | p. 45 |

Het verschil tussen ROOD en BUITEN BEVOEGDHEID is financieel wezenlijk: leegstandsderving telt mee
als correctie ten gunste van de huurder, belastingen en zorgkosten worden **buiten de berekening
gelaten** omdat de Huurcommissie er niets over mag zeggen (par. 6.1, p. 51). Ze als correctie
opvoeren zou de huurder een verwachting geven die geen enkele procedure kan waarmaken.

## F. Restcategorie

| Code | Categorie | Status |
| --- | --- | --- |
| *(onbekend)* | Niet te classificeren post | **ORANJE** - vraag om specificatie |

Omdat zowel het Besluit servicekosten als het Besluit kleine herstellingen uitdrukkelijk **niet
limitatief** zijn (p. 75, p. 82) en de Huurcommissie ruimte houdt de opsomming aan te vullen
(p. 29), mag een onbekende post nooit automatisch op EUR 0,00 worden gezet.
