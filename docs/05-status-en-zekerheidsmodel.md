# 05 - Risico- en zekerheidsmodel: GROEN, ORANJE, ROOD

## De vier statussen

Het beleidsboek kent één situatie die buiten het driekleurenschema valt: posten waarover de
Huurcommissie niet bevoegd is (belastingen, heffingen, zorgkosten - p. 44-45, p. 51). Die krijgen
een vierde status, omdat ze noch goed noch fout zijn maar simpelweg niet beoordeeld worden.

| Status | Betekenis | Financieel gevolg |
| --- | --- | --- |
| **GROEN** | De beschikbare informatie ondersteunt sterk dat de kosten correct zijn | Telt mee als toegestaan bedrag; correctie 0,00 |
| **ROOD** | De beschikbare informatie ondersteunt sterk dat de kosten mogelijk ten onrechte of te hoog in rekening zijn gebracht | Telt mee als correctie |
| **ORANJE** | Er is onvoldoende informatie om betrouwbaar te beoordelen | Telt **niet** mee in de harde correctie; alleen in de bandbreedte |
| **BUITEN BEVOEGDHEID** | De Huurcommissie mag hier geen oordeel over geven | Valt volledig buiten de berekening |

## Wanneer welke status

```
BUITEN BEVOEGDHEID  als categorie IN {belastingen/heffingen, zorgservicekosten}

ROOD   als bedrag_model < bedrag_verhuurder
       EN alle informatie die de regel nodig heeft, aanwezig is

GROEN  als bedrag_model >= bedrag_verhuurder
       EN alle informatie die de regel nodig heeft, aanwezig is

ORANJE als er ten minste één benoemd informatietekort is
       (ongeacht of er al een voorlopig bedrag te berekenen valt)
```

Een ORANJE-post kan wél een **voorlopig** bedrag hebben. Dat bedrag wordt in de rapportage expliciet
als "voorlopig" gemarkeerd en telt niet mee in het eindbedrag - alleen in de bovengrens van de
bandbreedte. In de code is dat de vlag `Beoordeling.voorlopig`.

## ORANJE is altijd een opdracht, nooit een conclusie

Bij ORANJE moet het systeem drie dingen opleveren:

1. **Wat ontbreekt** - concreet benoemd, niet "onvoldoende onderbouwd" maar bijvoorbeeld
   "aankoopfactuur van de wasmachines, of een opgave van soort en aantal".
2. **Bij wie het op te halen is** - huurder, verhuurder, externe bron of juridische beoordelaar
   (zie de groepen 4 t/m 7 in `04-datamodel.md`).
3. **Wat de uitkomst wordt** - welke kant de post op gaat als het antwoord ja of nee is.

Voorbeeld van een volledige ORANJE-melding:

> **Gebruiksvergoeding zonnepanelen - ORANJE, EUR 420,00 betwist**
> Ontbreekt: vaststelling of de panelen roerend of onroerend zijn (par. 4.3.3, p. 33).
> Op te halen bij: verhuurder (montagewijze) of via foto's van het dak; bij geschil kan de
> Huurcommissie onderzoek ter plaatse gelasten (par. 6.8, p. 64).
> Uitkomst: zijn de panelen **in het dak geïntegreerd**, dan zijn ze onroerend en is de
> gebruiksvergoeding niet toegestaan -> ROOD, correctie EUR 420,00. Zijn ze **op het dak
> gemonteerd**, dan zijn ze roerend en bedraagt de vergoeding 6,67% van (aanschafwaarde +
> EUR 2.000,00) -> nadere toetsing aan dat bedrag.

## Geen schijnprecisie

Het model geeft **geen kanspercentages**. Het beleidsboek biedt daar geen basis voor: het bevat
normen en methoden, geen uitkomstkansen. Wat het model wél geeft:

- een **harde correctie** (som van de ROOD-posten waarvan alle informatie aanwezig is);
- een **bandbreedte** (ondergrens = harde correctie; bovengrens = harde correctie plus het volledige
  bedrag van alle ORANJE-posten);
- per ORANJE-post de **concrete informatievraag** die de bandbreedte verkleint.

Een uitspraak als "70% kans dat u gelijk krijgt" is niet afleidbaar uit het beleidsboek en wordt
dus niet gedaan.

## Sterkte van de zaak

In plaats van een kans rapporteert het model vier **objectieve** indicatoren, allemaal direct
herleidbaar tot het beleidsboek:

| Indicator | Berekening | Waarom dit ertoe doet |
| --- | --- | --- |
| **Ontvankelijkheid** | Alle checks uit Boom 8 | Zonder ontvankelijkheid is de rest irrelevant |
| **Dekkingsgraad** | (bedrag GROEN + ROOD) / totaal beoordeelbaar | Hoeveel van de afrekening daadwerkelijk beoordeeld kon worden |
| **Bewijspositie verhuurder** | Aandeel posten met facturen én specificatieformulier | Ontbrekend bewijs werkt structureel in het voordeel van de huurder (par. 6.4.2) |
| **Aandeel harde regels** | Aandeel correctie uit regels met vaste normen (maxima, percentages, verboden posten) | Een correctie op grond van "EUR 5,00 per maand maximum" is sterker dan een op grond van een redelijkheidstoets |

Een zaak die volledig op harde normen rust - leegstandsderving, opstalverzekering, overschrijding
van een maximumtarief of -percentage - is naar de aard steviger dan een zaak die staat of valt met
de vraag of een tuin "openbaar" is. Dat verschil moet zichtbaar zijn in het rapport, zonder er een
getal met twee decimalen op te plakken.

## Drempels die de zaak kunnen blokkeren

| Drempel | Waarde | Bron |
| --- | --- | --- |
| Minimum betwiste kosten jaarafrekening | EUR 36,00 | par. 6.3.4, p. 59 |
| Minimum betwiste kosten voorschot | EUR 3,00 per maand | p. 24, p. 62 |
| Uiterste verzoekdatum | 2,5 jaar na afloop kalenderjaar | Tabel 10, p. 56 |
| Bezwaar- of opvraagplicht | schriftelijk + 3 weken | par. 6.3.1/6.3.2, p. 56-57 |

Het systeem moet deze **vóór** de inhoudelijke analyse tonen. Een huurder met EUR 30,00 aan betwiste
kosten heeft niets aan een inhoudelijk rapport.

## Risico voor de huurder: de correctie kan negatief zijn

De Huurcommissie kan ook tot een **hoger** bedrag komen dan de verhuurder heeft afgerekend, als dat
redelijk is - bijvoorbeeld bij een rekenfout of een andere redelijke verdeelsleutel (par. 2.3.3,
p. 10). Het model kapt negatieve verschillen daarom niet af. Komt het totaal negatief uit, dan is
dat een expliciete waarschuwing in het rapport: een procedure kan de huurder in deze situatie geld
kosten in plaats van opleveren.
