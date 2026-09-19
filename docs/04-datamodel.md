# 04 - Datamodel: welke informatie het systeem nodig heeft

Elk datapunt heeft een **bron**. Die bron bepaalt hoe het systeem eraan komt en hoe betrouwbaar het
is. Het onderscheid is niet administratief: gegevens uit groep 5 (opvragen bij de verhuurder) zijn
precies de gegevens die ORANJE-posten naar GROEN of ROOD brengen, en gegevens uit groep 7 zijn de
gegevens die dat nooit automatisch doen.

Legenda kolom **Verplicht**: V = altijd nodig, C = conditioneel (alleen bij bepaalde categorieën),
O = optioneel (verhoogt de zekerheid).

---

## 1. Automatisch uit het huurcontract

| Datapunt | Type | Verpl. | Gebruikt voor | Beslisregels |
| --- | --- | --- | --- | --- |
| `contract_gesloten_op` | datum | V | Sector- en bevoegdheidsbepaling Wet betaalbare huur | R-PRC-02 |
| `aanvangshuurprijs` | bedrag | V | Indeling sociaal / middenhuur / vrij | R-PRC-02 |
| `sector` | enum(sociaal, middenhuur, vrij) | C | Uitspraak vs. advies | R-PRC-02 |
| `servicekosten_overeengekomen` | bool per post | V | Juridische grondslag | R-ALG-01 |
| `overeengekomen_posten` | lijst | V | Classificatie en grondslag per post | R-ALG-01, R-SK-OPEN |
| `overeengekomen_maximum` | bedrag/percentage | O | Plafond dat de verhuurder bindt | R-ALG-03 |
| `verdeelsleutel_overeengekomen` | tekst/formule | O | Toerekening gemeenschappelijke kosten | R-VDS-03 |
| `voorschotbedrag_per_maand` | bedrag | V | Verrekening en voorschottoetsing | R-VS-02 |
| `zelfstandig_of_onzelfstandig` | enum | V | Normkeuze (alle Nibud-tabellen) | R-NUT-02, R-BEW-01 |
| `oppervlakte_m2` | getal | C | Gasnorm onzelfstandig (25 m3/m2); verdeelsleutel gas | R-NUT-02, R-VDS-01 |
| `schilderwerk_op_verzoek_huurder` | bool | C | Doorberekenbaarheid schilderwerk | R-KH-10 |
| `gebruiksrecht_gemeenschappelijke_ruimten` | bool | C | Wel/geen betalingsverplichting | R-VDS-04 |
| `energieprestatievergoeding` | bool | C | Opbrengsten zonnepanelen | R-ZON-01 |

## 2. Automatisch uit de servicekostenafrekening

| Datapunt | Type | Verpl. | Gebruikt voor | Beslisregels |
| --- | --- | --- | --- | --- |
| `boekjaar` | jaar | V | Normjaar, termijnen | alle |
| `afrekenperiode_van` / `_tot` | datum | V | Periodemethoden, gebroken boekjaar | R-PER-01..04 |
| `datum_afrekening_verstrekt` | datum | V | Afrekentermijn, administratiekosten | R-PRC-03, R-ADM-02 |
| `kostenposten[]` | lijst | V | Alles | alle |
| `kostenpost.omschrijving` | tekst | V | Classificatie in de taxonomie | Boom 0 |
| `kostenpost.bedrag` | bedrag | V | Vergelijking verhuurder vs. model | alle |
| `kostenpost.verdeelsleutel` | tekst | O | Toetsing van de sleutel | R-VDS-01..03 |
| `voorschot_in_rekening_gebracht` | bedrag | V | Saldo bij- of terugbetalen | financieel model |
| `meterstand_begin` / `meterstand_eind` | getal | C | Route in Boom 1 | R-NUT-01, R-NUT-02 |
| `verbruik_opgevoerd` | getal | C | Vergelijking met de Nibud-norm | R-NUT-02 |
| `aantal_woonruimten_complex` | geheel | C | Vrijwel elke verdeelsleutel | R-VDS-01..03 |

Een afrekening moet op grond van art. 7:259 lid 2 BW **naar soort uitgesplitst** zijn én **de wijze
van berekening** vermelden (p. 65). Ontbreekt die uitsplitsing, dan is dat op zichzelf al een
bevinding: zonder specificatie kan het aandeel van de huurder niet worden bepaald, wat via
R-BEW-02 naar het forfait leidt.

## 3. Uit facturen en specificaties

| Datapunt | Type | Verpl. | Gebruikt voor | Beslisregels |
| --- | --- | --- | --- | --- |
| `factuur_aanwezig_per_post` | bool | V | Bewijsregime | R-BEW-01..03 |
| `specificatieformulier_aanwezig` | bool | V | Bewijsregime overige servicekosten | R-BEW-02 |
| `leverancier_factuurbedrag` | bedrag | C | Werkelijke kosten | R-ALG-02 |
| `leverancier_factuurperiode` | periode | C | Periodemethoden | R-PER-01..03 |
| `totale_kosten_complex` | bedrag | C | Verdeelsleutels | R-VDS-01, R-VDS-02 |
| `aanschafwaarde_roerende_zaak` | bedrag | C | Gebruiksvergoeding | R-ROE-02 |
| `aanschafjaar_roerende_zaak` | jaar | C | Afschrijvingsperiode, herwaardering | R-ROE-03 |
| `huismeester_uren` | getal | C | Toets maximaal uurtarief | R-HUI-01 |
| `huismeester_totale_kosten` | bedrag | C | Idem | R-HUI-01 |
| `opstalverzekering_premie` | bedrag | C | 15%-forfait glasverzekering | R-VZ-02 |
| `onderhoudscontract_totaal` | bedrag | C | 20%-forfait 24-uursservice | R-SK-12 |
| `ketelrendement` | percentage | C | Ondergrens 80% | R-NUT-04 |
| `vve_jaarrekening` + `vve_alv_verslag` | document | C | Vervangt losse facturen | R-BEW-00 |

Uitdrukkelijk **niet** voldoende als onderbouwing: een grootboekkaart of een overzicht van facturen
(p. 59). Het systeem moet dat type document dus herkennen en als ontoereikend markeren.

## 4. Vragen aan de huurder

Deze antwoorden veranderen de uitkomst wezenlijk en kunnen nergens anders vandaan komen.

| Vraag | Type | Verpl. | Gevolg | Beslisregels |
| --- | --- | --- | --- | --- |
| Betwist u dat de dienst/zaak is geleverd, en waarom? | bool + tekst | V | Forfait wordt EUR 0,00 | R-BEW-03 |
| Welke posten betwist u? | selectie | V | Bepaalt de omvang van het geschil | R-PRC-01 |
| Aantal bewoners | geheel | C | Norm elektriciteit en water | R-NUT-02 |
| Woningtype (flat/tussen/hoek/2-onder-1-kap/vrijstaand) | enum | C | Gasnorm | R-NUT-02 |
| Huurperiode binnen het boekjaar | periode | V | Periodemethoden | R-PER-01..03 |
| Heeft u schriftelijk bezwaar gemaakt? Wanneer? | bool + datum | V | Ontvankelijkheid | R-PRC-04 |
| Heeft u de afrekening opgevraagd? Wanneer? | bool + datum | V | Ontvankelijkheid | R-PRC-05 |
| Woont u nog op dit adres? | bool | C | Ontvankelijkheid voorschotprocedure | R-VS-02 |
| Maakt u gebruik van de gemeenschappelijke ruimten? | bool | C | Wel/geen betalingsverplichting | R-VDS-04 |
| Kunt u de tuin betreden? Is die openbaar? | bool | C | Tuinonderhoud | R-KH-03 |
| Zijn de ruiten voor u bereikbaar? | bool | C | Glazenwassen | R-KH-01 |
| Functioneert de collectieve verwarming naar behoren? | bool + toelichting | C | Route naar Nibud-norm | R-NUT-04 |
| Zijn de zonnepanelen op of in het dak gemonteerd? | enum | C | Roerend/onroerend | R-ROE-01 |
| Heeft u een energiecontract met de verhuurder of met een derde? | enum | C | WKO-route | R-WKO-01 |
| Wat betaalde u aan voorschot? | bedrag | V | Saldo | financieel model |

## 5. Opvragen bij de verhuurder

Dit is de **werklijst** die een ORANJE-post kan opheffen. Grondslag: art. 7:259 lid 4 BW geeft de
huurder recht op inzage in de onderliggende boeken en bescheiden (p. 65); par. 6.4.2 somt op wat de
Huurcommissie zelf opvraagt.

| Document | Voor welke posten | Beslisregels |
| --- | --- | --- |
| Facturen / betaalbewijzen per kostenpost | alle | R-BEW-00..03 |
| Ingevuld specificatieformulier (bijlage VII Uitvoeringsregeling) | alle overige servicekosten | R-BEW-02 |
| Meterstanden begin en eind + verbruiksberekening | nutsvoorzieningen met meter | R-NUT-01..02 |
| Inspectierapport met ketelrendement | betwiste stookkosten | R-NUT-04 |
| Aankoopfacturen roerende zaken, of een opgave van soort en aantal | roerende zaken | R-ROE-02 |
| Functieomschrijving huismeester | huismeester | R-HUI-01 |
| Urenverantwoording / kosten eigen beheer | huismeester | R-HUI-01 |
| Facturen dienstverleningsbedrijf | huismeester, beveiliging | R-HUI-01, R-HUI-02 |
| Certificering beveiligingsdienst | externe beveiliging | R-HUI-02 |
| Polis en premiespecificatie opstal-/glasverzekering | verzekeringen | R-VZ-02 |
| Specificatie onderhoudscontract (aandeel 24-uursservice) | onderhoudscontract | R-SK-12 |
| Fondsadministratie: omvang en betalingen | fondsen | R-SK-13 |
| Splitsing vaste kosten WKO (kapitaal/onderhoud vs. overig) | WKO | R-WKO-01 |
| VvE-jaarrekening, ALV-verslag, VvE-afrekening | VvE-verhuurders | R-BEW-00 |
| Recente afrekening, niet ouder dan drie jaar | voorschotprocedure | R-VS-02 |

## 6. Externe en openbare gegevens

| Gegeven | Bron | Status |
| --- | --- | --- |
| Nibud-verbruiken en -tarieven gas/elektra/water | Beleidsboek Tabellen 1, 2, 4, 5, 7, 8 | **Aanwezig t/m 2025** |
| Graaddagen De Bilt | Beleidsboek Tabel 3 | **Aanwezig t/m 2025** |
| Seizoenspatronen elektriciteit | Beleidsboek Tabel 6 | Aanwezig, jaaronafhankelijk |
| Maximaal uurtarief huismeester | Beleidsboek Tabel 9 | Aanwezig t/m 2026 |
| Wettelijk vastgestelde verbruiken | Beleidsboek Tabel 11 | Aanwezig |
| **Tarieven bijlage VIII Uitvoeringsregeling huurprijzen woonruimte** | externe regeling | *Niet vast te stellen op basis van het beleidsboek* |
| **Liberalisatiegrens / socialehuurgrens / vrijesectorgrens** | Beleidsboek Waarderingsstelsel, bijlagen 4 en 5 | *Niet vast te stellen op basis van het beleidsboek* |
| **Consumentenprijsindex werknemersgezinnen** | CBS, via art. 19 lid 3 Uhw | *Niet vast te stellen op basis van het beleidsboek* |
| **Maximumbedragen Warmtewet** | Warmtewet | *Niet vast te stellen op basis van het beleidsboek* |
| Nibud-gegevens 2026 en later | Nibud, jaarlijks in juli | *Nog niet in deze versie van het beleidsboek* |
| Eigendomsoverdracht en datum | Kadaster / mededeling verhuurder | Extern |

## 7. Alleen door menselijke beoordeling vast te stellen

Deze gegevens zijn geen invoervelden maar oordelen. Het systeem mag ze vragen, nooit invullen.

| Oordeel | Waarom niet automatiseerbaar | Beslisregels |
| --- | --- | --- |
| Is de post "stilzwijgend overeengekomen"? | Contractuitleg | R-ALG-01 |
| Is de betwisting "gemotiveerd en overtuigend"? | Waardering van bewijs | R-NUT-03 |
| Wijkt het verbruik "in belangrijke mate" af? | Maatstaf niet gekwantificeerd (label C) | R-NUT-02 |
| Is er een "goede verklaring" voor het verbruik? | Feitelijke weging (bv. strenge winter, p. 12) | R-NUT-02 |
| Is de zaak roerend of onroerend? | Verkeersopvatting, bestanddeelvorming | R-ROE-01 |
| Heeft de groenvoorziening een openbaar karakter? | Feitelijke situatie ter plaatse | R-KH-03 |
| Is de verdeelsleutel redelijk? | Redelijkheidstoets | R-VDS-03 |
| Rechtvaardigen de werkzaamheden afwijking van 70/30? | Inhoudelijke weging | R-HUI-01 |
| Is de kwaliteit van schoonmaak/tuinonderhoud/huismeester toereikend? | Achteraf niet toetsbaar zonder overtuigend (tegen)bewijs (p. 25-26) | R-ALG-02 |
| Is het ongedierte gevolg van een bouwkundige situatie? | Bouwkundig oordeel | R-KH-08 |
| Kan de verhuurder worden vereenzelvigd met de energieleverancier? | Rechtspersonenrechtelijk oordeel | R-WKO-01 |
| Is de levensduur van de zaak afwijkend? | Uitdrukkelijke afwijkingsruimte (p. 32) | R-ROE-03 |

## Machineleesbare vorm

`schema/dossier.schema.json` bevat het JSON Schema van een dossier; `tests/cases/*.json` zijn
werkende voorbeelden. `engine/model.py` is de Python-weergave van hetzelfde model.
