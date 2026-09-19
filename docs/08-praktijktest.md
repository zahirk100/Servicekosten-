# 08 - Praktijktest: vijf casussen door hetzelfde model

Alle bedragen in dit document zijn **gegenereerd** door `engine/` uit de dossiers in
`tests/cases/`. Ze zijn niet met de hand uitgerekend. Reproduceren:

```
python3 tools/genereer_praktijktest.py
python3 -m engine tests/cases/casus-1-eenvoudige-correcte-afrekening.json
```

De rekenwijze zelf is gevalideerd tegen de zeventien rekenvoorbeelden uit het beleidsboek
(`python3 tests/test_beleidsboek_voorbeelden.py`).

Iedere casus doorloopt dezelfde beslisregels uit `07-beslisregels.md`. In de kolom *Regels* van
elke tabel staat welke regels zijn toegepast; in de toelichting staat per post de volledige
berekening met paginaverwijzing.


---

## Casus 1 - Eenvoudige correcte afrekening

Dossier: `tests/cases/casus-1-eenvoudige-correcte-afrekening.json`

Wat deze casus test: dat het model een correcte afrekening ook als correct herkent. Een auditmodel dat overal iets vindt, is waardeloos. Alle vier de posten zijn onderbouwd met facturen, de huismeester blijft binnen het maximale uurtarief van 2024 (EUR 40,00), de administratiekosten blijven onder 5% van de grondslag en de schoonmaakkosten zijn gelijk verdeeld over de 40 woonruimten.

**Boekjaar 2024**

**Ontvankelijkheid en bevoegdheid**

- OK - Boekjaar 2024: verzoek kan worden ingediend tot en met 30-06-2027 (Tabel 10, p. 56).

| Post | Status | Verhuurder | Model | Verschil | Regels |
| --- | --- | ---: | ---: | ---: | --- |
| Elektriciteit eigen meter | GROEN | EUR 602.15 | EUR 602.15 | EUR 0.00 | R-NUT-01 |
| Schoonmaak gemeenschappelijke ruimten | GROEN | EUR 180.00 | EUR 180.00 | EUR 0.00 | R-KH-02, R-VDS-03 |
| Huismeester | GROEN | EUR 149.33 | EUR 149.33 | EUR 0.00 | R-HUI-01 |
| Administratiekosten | GROEN | EUR 16.47 | EUR 16.47 | EUR 0.00 | R-ADM-01 |

**Toelichting per post**

*Elektriciteit eigen meter* (NUT-ELK-METER) - GROEN
  - berekening: Normverbruik elektriciteit: 2700 kWh (Tabel 4 (p. 18), 2 bewoner(s)).
  - berekening: Verbruikskosten 2700 kWh x EUR 0.29 = EUR 783.00 (Tabel 5, p. 18).
  - berekening: Vastrecht EUR 412.44 x 12/12 = EUR 412.44; belastingteruggave EUR 631.39 x 12/12 = EUR 631.39.
  - berekening: Referentie Nibud-norm voor dit jaar: EUR 564.05 (ter vergelijking).
  - Meterstanden bekend en niet betwist; de werkelijk gemaakte kosten volgens factuur zijn uitgangspunt (p. 11).
  - automatisering: automatisch; menselijke controle nodig: nee

*Schoonmaak gemeenschappelijke ruimten* (SK-04-SCHOONMAAK) - GROEN
  - berekening: Verdeeld over 40 woonruimten die gebruik (kunnen) maken van de zaak of dienst: EUR 7200.00 / 40 = EUR 180.00 (p. 29).
  - automatisering: automatisch; menselijke controle nodig: nee

*Huismeester* (SK-06) - GROEN
  - berekening: Toets aan maximaal uurtarief: 800 uur x EUR 40.0 = EUR 32000.00; gefactureerd EUR 32000.00 -> getoetst EUR 32000.00 (Tabel 9, p. 40).
  - berekening: 70% ten laste van de huurders = EUR 22400.00; 30% blijft voor rekening van de verhuurder (p. 41).
  - berekening: Per woonruimte: EUR 22400.00 / 150 = EUR 149.33.
  - De Huurcommissie kan van de 70/30-verdeling afwijken als de feitelijke werkzaamheden een andere verdeling rechtvaardigen (p. 41); dat is een inhoudelijke weging.
  - automatisering: semi-automatisch; menselijke controle nodig: ja

*Administratiekosten* (SK-11) - GROEN
  - berekening: Overige kostenposten: 5% van EUR 329.33 = EUR 16.47 (p. 43).
  - Administratiekosten hangen zo nauw samen met de servicekosten dat zij niet uitdrukkelijk overeengekomen hoeven te zijn (par. 4.3.11, p. 43).
  - automatisering: automatisch; menselijke controle nodig: nee

**Financieel beeld**

- Servicekosten volgens verhuurder (binnen bevoegdheid): EUR 947.95
- Waarvan beoordeeld: EUR 947.95
- Waarschijnlijk toegestaan volgens beoordelingsmodel: EUR 947.95
- **Potentiele correctie: EUR 0.00**

Uitkomst: alles GROEN, correctie EUR 0,00. Let op de referentieregel bij elektriciteit: het model berekent ook het Nibud-normbedrag (EUR 564,05) ter vergelijking, maar past dat niet toe - de meterstanden zijn bekend en niet betwist, dus zijn de werkelijke kosten uitgangspunt (p. 11).

---

## Casus 2 - Eenvoudige foutieve afrekening

Dossier: `tests/cases/casus-2-eenvoudige-foutieve-afrekening.json`

Wat deze casus test: drie posten die elk een **harde norm** overschrijden. De huismeester wordt gefactureerd tegen EUR 42,50 per uur (EUR 34.000 / 800 uur) terwijl het maximum voor 2024 EUR 40,00 is. De administratiekosten bedragen EUR 120,00 op een grondslag van EUR 800,00, oftewel 15% in plaats van maximaal 5%. De wasapparatuur komt op EUR 66,66 per woonruimte, boven het maximum van EUR 5,00 per maand.

**Boekjaar 2024**

**Ontvankelijkheid en bevoegdheid**

- OK - Boekjaar 2024: verzoek kan worden ingediend tot en met 30-06-2027 (Tabel 10, p. 56).

| Post | Status | Verhuurder | Model | Verschil | Regels |
| --- | --- | ---: | ---: | ---: | --- |
| Huismeester (uurtarief boven het maximum) | ROOD | EUR 226.67 | EUR 149.33 | EUR 77.34 | R-HUI-01 |
| Administratiekosten | ROOD | EUR 120.00 | EUR 40.00 | EUR 80.00 | R-ADM-01 |
| Gemeenschappelijke wasmachines en wasdrogers | ROOD | EUR 66.66 | EUR 60.00 | EUR 6.66 | R-ROE-04 |
| Schoonmaak gemeenschappelijke ruimten | GROEN | EUR 150.00 | EUR 150.00 | EUR 0.00 | R-KH-02, R-VDS-03 |

**Toelichting per post**

*Huismeester (uurtarief boven het maximum)* (SK-06) - ROOD
  - berekening: Toets aan maximaal uurtarief: 800 uur x EUR 40.0 = EUR 32000.00; gefactureerd EUR 34000.00 -> getoetst EUR 32000.00 (Tabel 9, p. 40).
  - berekening: 70% ten laste van de huurders = EUR 22400.00; 30% blijft voor rekening van de verhuurder (p. 41).
  - berekening: Per woonruimte: EUR 22400.00 / 150 = EUR 149.33.
  - De Huurcommissie kan van de 70/30-verdeling afwijken als de feitelijke werkzaamheden een andere verdeling rechtvaardigen (p. 41); dat is een inhoudelijke weging.
  - automatisering: semi-automatisch; menselijke controle nodig: ja

*Administratiekosten* (SK-11) - ROOD
  - berekening: Overige kostenposten: 5% van EUR 800.00 = EUR 40.00 (p. 43).
  - Administratiekosten hangen zo nauw samen met de servicekosten dat zij niet uitdrukkelijk overeengekomen hoeven te zijn (par. 4.3.11, p. 43).
  - automatisering: automatisch; menselijke controle nodig: nee

*Gemeenschappelijke wasmachines en wasdrogers* (SK-03) - ROOD
  - berekening: Gebruiksvergoeding 10.00% van EUR 50000.00 = EUR 5000.00 (levensduur 10 jaar, par. 4.3.3, p. 31).
  - berekening: Verdeeld over 75 woonruimten = EUR 66.67 per woonruimte.
  - berekening: Maximum EUR 5.0 per woonruimte per maand x 12 maanden = EUR 60.00; dit maximum geldt (par. 4.3.3, p. 34).
  - automatisering: automatisch; menselijke controle nodig: ja

*Schoonmaak gemeenschappelijke ruimten* (SK-04-SCHOONMAAK) - GROEN
  - berekening: Verdeeld over 150 woonruimten die gebruik (kunnen) maken van de zaak of dienst: EUR 22500.00 / 150 = EUR 150.00 (p. 29).
  - automatisering: automatisch; menselijke controle nodig: nee

**Financieel beeld**

- Servicekosten volgens verhuurder (binnen bevoegdheid): EUR 563.33
- Waarvan beoordeeld: EUR 563.33
- Waarschijnlijk toegestaan volgens beoordelingsmodel: EUR 399.33
- **Potentiele correctie: EUR 164.00**

Uitkomst: drie keer ROOD op grond van vaste normen, één keer GROEN. Dit is het type zaak dat volledig automatisch kan: geen enkele bevinding berust op een open norm.

---

## Casus 3 - Ontbrekende bewijsstukken

Dossier: `tests/cases/casus-3-ontbrekende-bewijsstukken.json`

Wat deze casus test: het bewijsregime van par. 6.4.2 (p. 60-61), dat vier verschillende uitkomsten kent. De gasfactuur ontbreekt (forfait), specificatieformulier én facturen ontbreken voor de schoonmaak (EUR 12,00 per jaar), er is geen enkel gegeven over de roerende zaken (standaardbedrag EUR 12,00) en de huurder betwist de signaallevering gemotiveerd zonder dat de verhuurder facturen overlegt (EUR 0,00).

**Boekjaar 2024**

**Ontvankelijkheid en bevoegdheid**

- OK - Boekjaar 2024: verzoek kan worden ingediend tot en met 30-06-2027 (Tabel 10, p. 56).

| Post | Status | Verhuurder | Model | Verschil | Regels |
| --- | --- | ---: | ---: | ---: | --- |
| Gas eigen meter (geen facturen aangeleverd) | ROOD | EUR 780.00 | EUR 327.50 | EUR 452.50 | R-BEW-01 |
| Schoonmaak (geen specificatieformulier, geen facturen) | ROOD | EUR 240.00 | EUR 12.00 | EUR 228.00 | R-KH-02, R-BEW-02 |
| Tuinonderhoud (karakter groenvoorziening onbekend) | ORANJE | EUR 95.00 | EUR 95.00 (voorlopig) | EUR 0.00 (voorlopig) | R-KH-03, R-VDS-03 |
| Meubilering en stoffering (geen aankoopfacturen, geen samenstelling) | ROOD | EUR 300.00 | EUR 12.00 | EUR 288.00 | R-ROE-02 |
| Signaallevering (levering gemotiveerd betwist, geen facturen) | ROOD | EUR 132.00 | EUR 0.00 | EUR 132.00 | R-SK-07, R-BEW-03 |

**Toelichting per post**

*Gas eigen meter (geen facturen aangeleverd)* (NUT-GAS-METER) - ROOD
  - berekening: Normverbruik gas: 450 m3 (18 m2 x 25 m3 (p. 14)).
  - berekening: Verbruikskosten 450 m3 x EUR 1.31 = EUR 589.50 (Tabel 2, p. 14).
  - berekening: Vastrecht EUR 236.76 / 6 woonruimte(n) x 12/12 = EUR 39.46.
  - berekening: Forfait par. 6.4.2 (Tabel 11, p. 60): 250 m3 x Nibud-tarief x 12/12 = EUR 327.50.
  - Let op: het beleidsboek verwijst voor het forfait naar bijlage VIII van de Uitvoeringsregeling huurprijzen woonruimte. Die bedragen staan NIET in het beleidsboek; hier is gerekend met het wettelijk vastgestelde verbruik uit Tabel 11 en het Nibud-tarief (voetnoot 16/18, p. 60-61). Verificatie tegen bijlage VIII is vereist.
  - De verhuurder heeft de kosten niet met facturen onderbouwd; het bedrag wordt bepaald op het niveau van het wettelijk vastgestelde verbruik en tarief (par. 6.4.2 onder 1, p. 60).
  - automatisering: semi-automatisch; menselijke controle nodig: ja

*Schoonmaak (geen specificatieformulier, geen facturen)* (SK-04-SCHOONMAAK) - ROOD
  - Ontbrekende onderbouwing (specificatieformulier (bijlage VII Uitvoeringsregeling huurprijzen woonruimte) en facturen of andere betaalbewijzen) terwijl de levering niet gemotiveerd wordt betwist: de Huurcommissie houdt voor deze kostenpost doorgaans EUR 12,00 per jaar aan (par. 6.4.2, p. 60-61).
  - automatisering: automatisch; menselijke controle nodig: ja

*Tuinonderhoud (karakter groenvoorziening onbekend)* (SK-04-TUIN) - ORANJE
  - berekening: Verdeeld over 6 woonruimten die gebruik (kunnen) maken van de zaak of dienst: EUR 570.00 / 6 = EUR 95.00 (p. 29).
  - ONTBREEKT: Heeft de huurder het exclusieve gebruiksrecht van de groenvoorziening? Bij een openbaar karakter of een kijktuin blijven de kosten voor rekening van de verhuurder (p. 37).
  - automatisering: handmatig; menselijke controle nodig: ja

*Meubilering en stoffering (geen aankoopfacturen, geen samenstelling)* (SK-03) - ROOD
  - Geen aankoopfacturen en geen inzicht in de samenstelling van de roerende zaken: het wettelijk vastgestelde standaardbedrag van EUR 12.0 per jaar wordt aangehouden (par. 4.3.3, p. 31; par. 6.4.2, p. 61).
  - automatisering: semi-automatisch; menselijke controle nodig: ja

*Signaallevering (levering gemotiveerd betwist, geen facturen)* (SK-07) - ROOD
  - De levering van de zaak of dienst wordt gemotiveerd betwist en de verhuurder heeft geen facturen of andere betaalbewijzen overgelegd: de kosten worden op EUR 0,00 gesteld (par. 6.4.2 categorie 2, p. 61; art. 18 lid 4 Uhw).
  - automatisering: semi-automatisch; menselijke controle nodig: ja

**Financieel beeld**

- Servicekosten volgens verhuurder (binnen bevoegdheid): EUR 1547.00
- Waarvan beoordeeld: EUR 1452.00
- Waarschijnlijk toegestaan volgens beoordelingsmodel: EUR 351.50
- **Potentiele correctie: EUR 1100.50**
- Nog niet te beoordelen (ORANJE): EUR 95.00 over 1 post(en); zie de ONTBREEKT-regels hierboven.
- Bandbreedte potentiele correctie: EUR 1100.50 tot EUR 1195.50 (ondergrens = alle ORANJE-posten blijken toegestaan; bovengrens = alle ORANJE-posten blijken volledig onterecht).

Uitkomst: hier zit de grootste hefboom van het hele beleidsboek. Niet omdat de kosten aantoonbaar onjuist zijn, maar omdat de verhuurder zijn onderbouwingsplicht niet nakomt. Het verschil tussen de derde en de vijfde post is instructief: dezelfde ontbrekende facturen leiden tot een forfait óf tot nul, afhankelijk van één antwoord van de huurder - betwist hij de levering gemotiveerd of niet (R-BEW-02 vs. R-BEW-03). Het tuinonderhoud blijft ORANJE: het karakter van de groenvoorziening is niet vastgesteld.

---

## Casus 4 - Meerdere verschillende foutieve kostenposten

Dossier: `tests/cases/casus-4-meerdere-foutieve-posten.json`

Wat deze casus test: zes verschillende soorten fouten naast elkaar, plus het onderscheid tussen ROOD en BUITEN BEVOEGDHEID. Leegstandsderving is verboden (p. 44), mutatieschoonmaak mag niet (p. 36), de opstalverzekering blijft voor de verhuurder (p. 42-43), de glasverzekering wordt forfaitair op 15% gezet (p. 43), glazenwassen op 1/3 arbeidskosten (p. 36), de cv-installatie is onroerend (p. 31), rookmelders zijn wettelijk verplicht (p. 33) en het onderhoudscontract op 20% 24-uursservice (p. 44).

**Boekjaar 2025**

**Ontvankelijkheid en bevoegdheid**

- OK - Boekjaar 2025: verzoek kan worden ingediend tot en met 30-06-2028 (Tabel 10, p. 56).

| Post | Status | Verhuurder | Model | Verschil | Regels |
| --- | --- | ---: | ---: | ---: | --- |
| Leegstandsderving servicekosten | ROOD | EUR 85.00 | EUR 0.00 | EUR 85.00 | R-NSK-01 |
| Mutatieschoonmaak bij verhuizing | ROOD | EUR 140.00 | EUR 0.00 | EUR 140.00 | R-KH-02 |
| Opstalverzekering | ROOD | EUR 92.00 | EUR 0.00 | EUR 92.00 | R-VZ-01 |
| Glasverzekering (onderdeel van de opstalverzekering, niet gespecificeerd) | ROOD | EUR 48.00 | EUR 7.20 | EUR 40.80 | R-VZ-02 |
| Glazenwassen (totale kosten niet gespecificeerd) | ROOD | EUR 72.00 | EUR 24.00 | EUR 48.00 | R-KH-01, R-VDS-03 |
| Gebruiksvergoeding cv-installatie en radiatoren | ROOD | EUR 180.00 | EUR 0.00 | EUR 180.00 | R-ROE-01 |
| Rookmelders | ROOD | EUR 15.00 | EUR 0.00 | EUR 15.00 | R-ROE-07 |
| Onderhoudscontract cv met 24-uursservice | ROOD | EUR 110.00 | EUR 22.00 | EUR 88.00 | R-SK-12 |
| Gemeentelijke heffingen (rioolheffing) | BUITEN BEVOEGDHEID | EUR 130.00 | n.v.t. | - | R-NSK-02 |
| Administratiekosten | ROOD | EUR 95.00 | EUR 37.10 | EUR 57.90 | R-ADM-01 |

**Toelichting per post**

*Leegstandsderving servicekosten* (NSK-01) - ROOD
  - Het is niet toegestaan gederfde servicekosten als gevolg van leegstand aan de zittende huurders door te berekenen (p. 44). (par. 4.3.14, p. 44)
  - automatisering: automatisch; menselijke controle nodig: nee

*Mutatieschoonmaak bij verhuizing* (SK-04-SCHOONMAAK) - ROOD
  - Mutatiekosten (begin- en eindschoonmaak bij verhuizing) mogen niet bij de huurder in rekening worden gebracht (p. 36).
  - automatisering: semi-automatisch; menselijke controle nodig: ja

*Opstalverzekering* (SK-09-OPSTAL) - ROOD
  - Verzekeringen die direct verband houden met de onroerende zaak blijven voor rekening van de verhuurder (p. 42-43). (par. 4.3.9, p. 42-43)
  - automatisering: automatisch; menselijke controle nodig: nee

*Glasverzekering (onderdeel van de opstalverzekering, niet gespecificeerd)* (SK-09-GLAS) - ROOD
  - berekening: Kosten niet gespecificeerd: forfaitair aandeel 15.00% van EUR 48.00 = EUR 7.20 (par. 4.3.9, p. 43).
  - automatisering: automatisch; menselijke controle nodig: nee

*Glazenwassen (totale kosten niet gespecificeerd)* (SK-04-GLAS) - ROOD
  - berekening: Kosten niet gespecificeerd: forfaitair aandeel 33.33% van EUR 4320.00 = EUR 1440.00 (par. 4.3.4, p. 36).
  - berekening: Verdeeld over 60 woonruimten die gebruik (kunnen) maken van de zaak of dienst: EUR 1440.00 / 60 = EUR 24.00 (p. 29).
  - automatisering: automatisch; menselijke controle nodig: nee

*Gebruiksvergoeding cv-installatie en radiatoren* (SK-03) - ROOD
  - Onroerende zaak: hiervoor kan geen gebruiksvergoeding in de servicekosten worden opgenomen; de kosten worden geacht deel uit te maken van de kale huurprijs (par. 4.3.3, p. 31).
  - automatisering: semi-automatisch; menselijke controle nodig: ja

*Rookmelders* (SK-03) - ROOD
  - Rookmelders zijn sinds 1 juli 2022 verplicht op grond van het Bouwbesluit; de kosten komen voor rekening van de verhuurder en er mag geen gebruiksvergoeding worden gevraagd (par. 4.3.3, p. 33).
  - automatisering: semi-automatisch; menselijke controle nodig: ja

*Onderhoudscontract cv met 24-uursservice* (SK-12) - ROOD
  - berekening: Kosten niet gespecificeerd: forfaitair aandeel 20.00% van EUR 110.00 = EUR 22.00 (par. 4.3.12, p. 44).
  - automatisering: automatisch; menselijke controle nodig: nee

*Gemeentelijke heffingen (rioolheffing)* (NSK-02) - BUITEN BEVOEGDHEID
  - Belastingen en heffingen maken geen onderdeel uit van de servicekosten; de Huurcommissie is niet bevoegd hierover uitspraak te doen (p. 44, p. 51). (par. 4.3.15, p. 44)
  - automatisering: automatisch; menselijke controle nodig: nee

*Administratiekosten* (SK-11) - ROOD
  - berekening: Overige kostenposten: 5% van EUR 742.00 = EUR 37.10 (p. 43).
  - Administratiekosten hangen zo nauw samen met de servicekosten dat zij niet uitdrukkelijk overeengekomen hoeven te zijn (par. 4.3.11, p. 43).
  - automatisering: automatisch; menselijke controle nodig: nee

**Financieel beeld**

- Servicekosten volgens verhuurder (binnen bevoegdheid): EUR 837.00
- Waarvan beoordeeld: EUR 837.00
- Waarschijnlijk toegestaan volgens beoordelingsmodel: EUR 90.30
- **Potentiele correctie: EUR 746.70**

Uitkomst: de rioolheffing verdwijnt uit de berekening in plaats van als correctie te worden opgevoerd - de Huurcommissie is er niet bevoegd over (p. 44, p. 51). Die EUR 130,00 als 'winst' presenteren zou de huurder een verwachting geven die geen procedure kan waarmaken. Let ook op de administratiekosten: die dalen mee, omdat de grondslag waarover het percentage wordt berekend kleiner wordt zodra posten wegvallen.

---

## Casus 5 - Complexe zaak waarin menselijke beoordeling noodzakelijk blijft

Dossier: `tests/cases/casus-5-complex-menselijke-beoordeling.json`

Wat deze casus test: het eerlijkheidsgehalte van het model. Een huurder die acht maanden heeft gehuurd, betwist zijn gasverbruik en stelt dat de collectieve ketel gebrekkig is; de verhuurder levert geen inspectierapport. Daarnaast: een kijktuin, zonnepanelen waarvan niet vaststaat of ze roerend zijn, een WKO-installatie waarvan de vaste kosten niet zijn gesplitst, schilderwerk in de gemeenschappelijke hal en een ontstoppingsfonds dat niet aan alle vier de voorwaarden voldoet.

**Boekjaar 2025**

**Ontvankelijkheid en bevoegdheid**

- OK - Boekjaar 2025: verzoek kan worden ingediend tot en met 30-06-2028 (Tabel 10, p. 56).

| Post | Status | Verhuurder | Model | Verschil | Regels |
| --- | --- | ---: | ---: | ---: | --- |
| Gas eigen meter (meterstanden gemotiveerd betwist, collectieve ketel) | ORANJE | EUR 1180.00 | EUR 1036.88 (voorlopig) | EUR 143.12 (voorlopig) | R-PER-01, R-NUT-03, R-NUT-04 |
| Tuinonderhoud (kijktuin, huurder kan de tuin niet betreden) | ROOD | EUR 88.00 | EUR 0.00 | EUR 88.00 | R-KH-03 |
| Zonnepanelen (roerend of onroerend nog niet vastgesteld) | ORANJE | EUR 420.00 | EUR 289.03 (voorlopig) | EUR 130.97 (voorlopig) | R-ROE-01, R-ROE-05 |
| Warmtelevering WKO-installatie (vaste kosten niet gesplitst) | ORANJE | EUR 540.00 | EUR 360.00 (voorlopig) | EUR 180.00 (voorlopig) | R-WKO-01 |
| Schilderwerk gemeenschappelijke hal | ORANJE | EUR 65.00 | EUR 43.33 (voorlopig) | EUR 21.67 (voorlopig) | R-KH-10, R-VDS-03 |
| Ontstoppingsfonds | ORANJE | EUR 36.00 | EUR 24.00 (voorlopig) | EUR 12.00 (voorlopig) | R-SK-13 |

**Toelichting per post**

*Gas eigen meter (meterstanden gemotiveerd betwist, collectieve ketel)* (NUT-GAS-METER) - ORANJE
  - berekening: Normverbruik gas 990 m3 (Tabel 1 (p. 13), tussenwoning); graaddagenmethode 1-8/2025: factor 0.610285 -> 604 m3 (par. 3.1.3, p. 16).
  - berekening: Verbruikskosten 604 m3 x EUR 1.36 = EUR 821.44 (Tabel 2, p. 14).
  - berekening: Vastrecht EUR 323.16 / 1 woonruimte(n) x 8/12 = EUR 215.44.
  - De verhuurder heeft geen inspectierapport verstrekt; de Huurcommissie gaat dan in het algemeen uit van de Nibud-verbruiksnorm (par. 3.1.2, p. 15).
  - ONTBREEKT: Menselijke weging: is de betwisting 'gemotiveerd en overtuigend' en is er een plausibele verklaring voor het verbruik? (p. 15)
  - automatisering: semi-automatisch; menselijke controle nodig: ja

*Tuinonderhoud (kijktuin, huurder kan de tuin niet betreden)* (SK-04-TUIN) - ROOD
  - Niet doorberekenbaar: Heeft de huurder het exclusieve gebruiksrecht van de groenvoorziening? Bij een openbaar karakter of een kijktuin blijven de kosten voor rekening van de verhuurder (p. 37).
  - automatisering: semi-automatisch; menselijke controle nodig: ja

*Zonnepanelen (roerend of onroerend nog niet vastgesteld)* (SK-03) - ORANJE
  - berekening: Grondslag zonnepanelen: aanschafwaarde + opslag EUR 2000.0 = EUR 6500.00 (par. 4.3.3, p. 32).
  - berekening: Gebruiksvergoeding 6.67% van EUR 6500.00 = EUR 433.55 (levensduur 15 jaar, par. 4.3.3, p. 31).
  - ONTBREEKT: Roerend of onroerend? Kan de zaak worden weggenomen zonder beschadiging van betekenis? (par. 4.3.3, p. 31). Vereist menselijke/feitelijke beoordeling.
  - automatisering: automatisch; menselijke controle nodig: ja

*Warmtelevering WKO-installatie (vaste kosten niet gesplitst)* (SK-14-WKO) - ORANJE
  - ONTBREEKT: Zijn de vaste kosten gesplitst in kapitaals- en onderhoudslasten van de WKO-installatie (niet doorberekenbaar, want te dekken uit de kale huurprijs) en de overige vaste kosten (wel doorberekenbaar)? Zonder die splitsing is het doorberekenbare deel niet vast te stellen (par. 5.4, p. 49).
  - automatisering: handmatig; menselijke controle nodig: ja

*Schilderwerk gemeenschappelijke hal* (SK-04-SCHILDERWERK) - ORANJE
  - berekening: Verdeeld over 24 woonruimten die gebruik (kunnen) maken van de zaak of dienst: EUR 1560.00 / 24 = EUR 65.00 (p. 29).
  - ONTBREEKT: Is het schilderwerk uitdrukkelijk overeengekomen (of bij aanvang op verzoek van de huurder uitgevoerd)? Zo niet, dan wordt het geacht te zijn verricht om de woonruimte verhuurbaar te maken en zijn de kosten niet doorberekenbaar (p. 39).
  - automatisering: handmatig; menselijke controle nodig: ja

*Ontstoppingsfonds* (SK-13) - ORANJE
  - ONTBREEKT: Fondsvoorwaarden nog niet aangetoond: verhuurder geeft inzage in de hoogte van het fonds en de betalingen daaruit; de omvang van het fonds is maximaal drie keer de jaaropbrengst; de inleg wordt alleen gebruikt voor de betreffende levering of dienst (par. 4.3.13, p. 44).
  - automatisering: semi-automatisch; menselijke controle nodig: ja

**Financieel beeld**

- Servicekosten volgens verhuurder (binnen bevoegdheid): EUR 2329.00
- Waarvan beoordeeld: EUR 88.00
- Waarschijnlijk toegestaan volgens beoordelingsmodel: EUR 0.00
- **Potentiele correctie: EUR 88.00**
- Nog niet te beoordelen (ORANJE): EUR 2241.00 over 5 post(en); zie de ONTBREEKT-regels hierboven.
- Bandbreedte potentiele correctie: EUR 88.00 tot EUR 2329.00 (ondergrens = alle ORANJE-posten blijken toegestaan; bovengrens = alle ORANJE-posten blijken volledig onterecht).

Uitkomst: één harde bevinding (de kijktuin, EUR 88,00) en vijf ORANJE-posten met samen EUR 2.241,00 aan betwiste kosten. Het model kan voor die vijf wel rekenen - het toont voorlopige bedragen - maar telt ze niet mee in de harde correctie. Dat is precies de bedoeling: de bandbreedte van EUR 88,00 tot EUR 2.329,00 laat zien dat het opvragen van vier documenten (inspectierapport, montagewijze zonnepanelen, splitsing WKO-kosten, fondsadministratie) hier meer waard is dan welke juridische redenering ook.

---

## Meerjarenberekening

Eén huurder, twee boekjaren, dezelfde verhuurder. Beide jaren zijn op het peilmoment (verzoek op 1 oktober 2026) nog te beoordelen volgens Tabel 10 (p. 56). Let op: op grond van art. 7:260 lid 2 BW betreft een verzoek per kostensoort ten hoogste één tijdvak van twaalf maanden, dus dit zijn twee afzonderlijke procedures met elk een eigen bezwaartraject.

### Boekjaar 2024

**Boekjaar 2024**

**Ontvankelijkheid en bevoegdheid**

- OK - Boekjaar 2024: verzoek kan worden ingediend tot en met 30-06-2027 (Tabel 10, p. 56).

| Post | Status | Verhuurder | Model | Verschil | Regels |
| --- | --- | ---: | ---: | ---: | --- |
| Huismeester | ROOD | EUR 226.67 | EUR 149.33 | EUR 77.34 | R-HUI-01 |
| Schoonmaak gemeenschappelijke ruimten | GROEN | EUR 210.00 | EUR 210.00 | EUR 0.00 | R-KH-02, R-VDS-03 |
| Opstalverzekering | ROOD | EUR 88.00 | EUR 0.00 | EUR 88.00 | R-VZ-01 |
| Gemeenschappelijke wasapparatuur | ROOD | EUR 84.00 | EUR 60.00 | EUR 24.00 | R-ROE-04 |
| Administratiekosten | ROOD | EUR 95.00 | EUR 25.97 | EUR 69.03 | R-ADM-01 |

**Toelichting per post**

*Huismeester* (SK-06) - ROOD
  - berekening: Toets aan maximaal uurtarief: 800 uur x EUR 40.0 = EUR 32000.00; gefactureerd EUR 34000.00 -> getoetst EUR 32000.00 (Tabel 9, p. 40).
  - berekening: 70% ten laste van de huurders = EUR 22400.00; 30% blijft voor rekening van de verhuurder (p. 41).
  - berekening: Per woonruimte: EUR 22400.00 / 150 = EUR 149.33.
  - De Huurcommissie kan van de 70/30-verdeling afwijken als de feitelijke werkzaamheden een andere verdeling rechtvaardigen (p. 41); dat is een inhoudelijke weging.
  - automatisering: semi-automatisch; menselijke controle nodig: ja

*Schoonmaak gemeenschappelijke ruimten* (SK-04-SCHOONMAAK) - GROEN
  - berekening: Verdeeld over 48 woonruimten die gebruik (kunnen) maken van de zaak of dienst: EUR 10080.00 / 48 = EUR 210.00 (p. 29).
  - automatisering: automatisch; menselijke controle nodig: nee

*Opstalverzekering* (SK-09-OPSTAL) - ROOD
  - Verzekeringen die direct verband houden met de onroerende zaak blijven voor rekening van de verhuurder (p. 42-43). (par. 4.3.9, p. 42-43)
  - automatisering: automatisch; menselijke controle nodig: nee

*Gemeenschappelijke wasapparatuur* (SK-03) - ROOD
  - berekening: Gebruiksvergoeding 10.00% van EUR 48000.00 = EUR 4800.00 (levensduur 10 jaar, par. 4.3.3, p. 31).
  - berekening: Verdeeld over 48 woonruimten = EUR 100.00 per woonruimte.
  - berekening: Maximum EUR 5.0 per woonruimte per maand x 12 maanden = EUR 60.00; dit maximum geldt (par. 4.3.3, p. 34).
  - automatisering: automatisch; menselijke controle nodig: ja

*Administratiekosten* (SK-11) - ROOD
  - berekening: Overige kostenposten: 5% van EUR 519.33 = EUR 25.97 (p. 43).
  - Administratiekosten hangen zo nauw samen met de servicekosten dat zij niet uitdrukkelijk overeengekomen hoeven te zijn (par. 4.3.11, p. 43).
  - automatisering: automatisch; menselijke controle nodig: nee

**Financieel beeld**

- Servicekosten volgens verhuurder (binnen bevoegdheid): EUR 703.67
- Waarvan beoordeeld: EUR 703.67
- Waarschijnlijk toegestaan volgens beoordelingsmodel: EUR 445.30
- **Potentiele correctie: EUR 258.37**

### Boekjaar 2025

**Boekjaar 2025**

**Ontvankelijkheid en bevoegdheid**

- OK - Boekjaar 2025: verzoek kan worden ingediend tot en met 30-06-2028 (Tabel 10, p. 56).

| Post | Status | Verhuurder | Model | Verschil | Regels |
| --- | --- | ---: | ---: | ---: | --- |
| Huismeester | ROOD | EUR 240.00 | EUR 149.24 | EUR 90.76 | R-HUI-01 |
| Schoonmaak gemeenschappelijke ruimten | GROEN | EUR 225.00 | EUR 225.00 | EUR 0.00 | R-KH-02, R-VDS-03 |
| Opstalverzekering | ROOD | EUR 94.00 | EUR 0.00 | EUR 94.00 | R-VZ-01 |
| Gemeenschappelijke wasapparatuur | ROOD | EUR 84.00 | EUR 60.00 | EUR 24.00 | R-ROE-04 |
| Leegstandsderving | ROOD | EUR 120.00 | EUR 0.00 | EUR 120.00 | R-NSK-01 |
| Administratiekosten | ROOD | EUR 110.00 | EUR 32.15 | EUR 77.85 | R-ADM-01 |

**Toelichting per post**

*Huismeester* (SK-06) - ROOD
  - berekening: Toets aan maximaal uurtarief: 780 uur x EUR 41.0 = EUR 31980.00; gefactureerd EUR 36000.00 -> getoetst EUR 31980.00 (Tabel 9, p. 40).
  - berekening: 70% ten laste van de huurders = EUR 22386.00; 30% blijft voor rekening van de verhuurder (p. 41).
  - berekening: Per woonruimte: EUR 22386.00 / 150 = EUR 149.24.
  - De Huurcommissie kan van de 70/30-verdeling afwijken als de feitelijke werkzaamheden een andere verdeling rechtvaardigen (p. 41); dat is een inhoudelijke weging.
  - automatisering: semi-automatisch; menselijke controle nodig: ja

*Schoonmaak gemeenschappelijke ruimten* (SK-04-SCHOONMAAK) - GROEN
  - berekening: Verdeeld over 48 woonruimten die gebruik (kunnen) maken van de zaak of dienst: EUR 10800.00 / 48 = EUR 225.00 (p. 29).
  - automatisering: automatisch; menselijke controle nodig: nee

*Opstalverzekering* (SK-09-OPSTAL) - ROOD
  - Verzekeringen die direct verband houden met de onroerende zaak blijven voor rekening van de verhuurder (p. 42-43). (par. 4.3.9, p. 42-43)
  - automatisering: automatisch; menselijke controle nodig: nee

*Gemeenschappelijke wasapparatuur* (SK-03) - ROOD
  - berekening: Gebruiksvergoeding 10.00% van EUR 48000.00 = EUR 4800.00 (levensduur 10 jaar, par. 4.3.3, p. 31).
  - berekening: Verdeeld over 48 woonruimten = EUR 100.00 per woonruimte.
  - berekening: Maximum EUR 5.0 per woonruimte per maand x 12 maanden = EUR 60.00; dit maximum geldt (par. 4.3.3, p. 34).
  - automatisering: automatisch; menselijke controle nodig: ja

*Leegstandsderving* (NSK-01) - ROOD
  - Het is niet toegestaan gederfde servicekosten als gevolg van leegstand aan de zittende huurders door te berekenen (p. 44). (par. 4.3.14, p. 44)
  - automatisering: automatisch; menselijke controle nodig: nee

*Administratiekosten* (SK-11) - ROOD
  - berekening: Overige kostenposten: 5% van EUR 643.00 = EUR 32.15 (p. 43).
  - Administratiekosten hangen zo nauw samen met de servicekosten dat zij niet uitdrukkelijk overeengekomen hoeven te zijn (par. 4.3.11, p. 43).
  - automatisering: automatisch; menselijke controle nodig: nee

**Financieel beeld**

- Servicekosten volgens verhuurder (binnen bevoegdheid): EUR 873.00
- Waarvan beoordeeld: EUR 873.00
- Waarschijnlijk toegestaan volgens beoordelingsmodel: EUR 466.39
- **Potentiele correctie: EUR 406.61**

### Totaal over beide jaren

| Boekjaar | Volgens verhuurder | Volgens model | Potentieel verschil | Nog onbeoordeeld |
| --- | ---: | ---: | ---: | ---: |
| 2024 | EUR 703.67 | EUR 445.30 | EUR 258.37 | EUR 0.00 |
| 2025 | EUR 873.00 | EUR 466.39 | EUR 406.61 | EUR 0.00 |
| **Totaal** | | | **EUR 664.98** | EUR 0.00 |


De terugkerende posten laten zien waarom een meerjarenanalyse loont: dezelfde opstalverzekering en hetzelfde te hoge huismeesterstarief keren elk jaar terug. Wie alleen het laatste boekjaar laat toetsen, laat de helft liggen.
