# 03 - Beslisbomen per categorie

De generieke boom uit de opdracht (doorberekenbaar? -> kosten aangetoond? -> methode? ->
verdeelsleutel? -> beperkingen?) klopt als raamwerk, maar het beleidsboek dwingt op drie punten een
andere volgorde af:

1. **De juridische grondslag komt vóór alles.** Is niet overeengekomen dat de kosten voor rekening
   van de huurder komen, dan is er geen betalingsverplichting, hoe goed de facturen ook zijn (p. 9).
2. **De bewijsvraag splitst zich in tweeën.** Ontbrekend bewijs leidt niet altijd tot nul: het leidt
   tot een **forfait**, tenzij de huurder de levering **gemotiveerd betwist** - dán pas nul
   (par. 6.4.2, p. 60-61). De vraag "betwist de huurder de levering?" moet dus vóór de
   berekeningsstap worden gesteld.
3. **Bevoegdheid komt vóór doorberekenbaarheid.** Bij belastingen, heffingen en zorgkosten mag de
   Huurcommissie helemaal niets zeggen (p. 44-45, p. 51). Die posten verlaten de berekening in plaats
   van op nul te worden gezet.

## Boom 0 - Toegangspoort (geldt voor elke post)

```
KOSTENPOST ONTVANGEN
|
+- Valt de post binnen de bevoegdheid van de Huurcommissie?
|    (belastingen/heffingen p. 44; zorgservicekosten p. 45)
|    NEE -> BUITEN BEVOEGDHEID; buiten de berekening houden. EINDE.
|
+- Is de post door de huurder in het verzoek genoemd? (par. 6.1, p. 51)
|    NEE -> wordt ongewijzigd overgenomen; geen correctie mogelijk. EINDE.
|
+- Is overeengekomen dat deze kosten voor rekening van de huurder komen? (p. 9)
|    NEE      -> ROOD, bedrag 0,00. EINDE.
|    ONBEKEND -> ORANJE: vraag de huurovereenkomst op.
|    (uitzondering: administratiekosten, p. 43)
|
+- Is dit een nutsvoorziening met een individuele meter? (p. 8)
     JA  -> Boom 1
     NEE -> is het een nutsvoorziening zonder eigen meter? JA -> Boom 2 / NEE -> Boom 3 e.v.
```

## Boom 1 - Nutsvoorziening met individuele meter (gas, elektriciteit, water)

```
+- Heeft de verhuurder facturen/betaalbewijzen overgelegd? (p. 9, p. 59)
|    NEE + huurder betwist levering gemotiveerd -> bedrag = 0,00 (ROOD). EINDE. [R-BEW-03]
|    NEE + geen betwisting -> bedrag = wettelijk verbruik x tarief (Tabel 11, p. 60). EINDE. [R-BEW-01]
|    JA  -> verder
|
+- Zijn begin- en eindstand bekend? (p. 12)
|    NEE -> normbedrag = Nibud(jaar, woningtype/bewoners/oppervlakte, periode)
|           wijkt het opgevoerde verbruik "in belangrijke mate" af zonder goede verklaring?
|              JA of onbekend -> bedrag = normbedrag [R-NUT-02]
|              NEE            -> bedrag = factuurbedrag
|           (de maatstaf zelf is niet gekwantificeerd -> altijd menselijke toets)
|    JA  -> verder
|
+- Betwist de huurder de meterstanden gemotiveerd en overtuigend? (p. 15)
|    JA -> gaat het om gas en stelt de huurder dat de collectieve installatie gebrekkig is?
|            JA -> inspectierapport ontbreekt OF rendement < 80% -> bedrag = normbedrag [R-NUT-04]
|                  rendement >= 80% en plausibele verklaring     -> bedrag = factuurbedrag
|            NEE -> bedrag = normbedrag [R-NUT-03]
|    NEE -> bedrag = factuurbedrag [R-NUT-01]
|
+- Is de factuur collectief voor meerdere woonruimten? (voetnoot 3, p. 11)
|    JA -> toets de verdeelsleutel (ORANJE tot getoetst) [R-NUT-05]
|
+- Is de huur- of factuurperiode korter dan twaalf maanden? (p. 16, 20, 23)
|    gas          -> graaddagenmethode [R-PER-01]
|    elektriciteit-> seizoenspatronen  [R-PER-02]
|    water        -> evenredig deel    [R-PER-03]
|    vastrecht en belastingteruggave   -> altijd evenredig naar maanden
|
+- Is een vast bedrag/percentage overeengekomen? (voetnoot 4, p. 11)
     JA -> bedrag = MIN(bedrag, overeengekomen maximum) [R-ALG-03]
```

## Boom 2 - Nutsvoorziening zonder eigen meter

```
+- Zijn specificatieformulier EN facturen aanwezig? (par. 6.4.2, p. 60-61)
|    NEE + gemotiveerde betwisting van de levering -> 0,00 [R-BEW-03]
|    NEE + geen betwisting                          -> wettelijk verbruik x tarief [R-BEW-02]
|    JA -> verder
|
+- Bepaal het aandeel van de huurder in de totale kosten:
|    gas           -> 35% vast / n  +  65% variabel x opp/totale_opp   [R-VDS-01]
|    elektriciteit -> totaal / n                                       [R-VDS-02]
|    water         -> totaal / n                                       [R-VDS-02]
|
+- Periode korter dan twaalf maanden -> graaddagen / seizoenspatroon / evenredig [R-PER-01..03]
```

## Boom 3 - Roerende zaken (gebruiksvergoeding)

```
+- Is de zaak roerend? (weg te nemen zonder beschadiging van betekenis, p. 31)
|    NEE      -> 0,00 (kosten zitten in de kale huurprijs) [R-ROE-01]
|    ONBEKEND -> ORANJE: foto's/omschrijving; bij geschil onderzoek ter plaatse (p. 64)
|
+- Gaat het om een rookmelder? -> 0,00, geen gebruiksvergoeding toegestaan (p. 33) [R-ROE-07]
|
+- Bepaal de waarde: [R-ROE-02]
|    aankoopfactuur            -> factuurwaarde
|    inzicht in samenstelling  -> geschatte verkoopwaarde begin boekjaar
|    geen van beide            -> EUR 12,00 per jaar. EINDE.
|
+- Correcties op de waardegrondslag:
|    brandbeveiligingsmiddelen -> 50% van de waarde (p. 33)
|    beveiligingscamera's      -> 70% van de waarde (p. 34)
|    zonnepanelen              -> waarde + EUR 2.000 opslag (p. 32)
|
+- Bepaal de levensduur en het percentage: [R-ROE-03]
|    5 jaar -> 20%   |   10 jaar -> 10%   |   15 jaar (zonnepanelen) -> 6,67%
|    10 jaar geldt o.a. voor gevelkachels, kleine boilers, geisers, brandbeveiliging,
|    huishoudelijke/technische apparaten en laminaat voor één woonruimte (p. 31)
|
+- In welke periode zit de zaak? (p. 32)
|    jaar <= levensduur      -> jaarbedrag = waarde x percentage
|    jaar <= 2x levensduur   -> jaarbedrag = (waarde x 60%) x percentage
|                               (wasapparatuur: 6% van de oorspronkelijke waarde, p. 34)
|    daarna                  -> 0,00, tenzij een nieuwe waardebepaling waarde aantoont
|
+- Gedeeld gebruik -> delen door het aantal woonruimten
|
+- Maximum: wasapparatuur EUR 5,00 per woonruimte per maand (p. 34) [R-ROE-04]
```

## Boom 4 - Kleine herstellingen

```
+- Staat de werkzaamheid in de bijlage bij het Besluit kleine herstellingen? (p. 78-81)
|    NEE -> ORANJE: de opsomming is niet limitatief (p. 82); juridische toets nodig
|
+- Wordt zij krachtens de huurovereenkomst door de verhuurder uitgevoerd? (p. 36)
|    NEE -> geen servicekostenpost
|
+- Geldt de bereikbaarheidsmaatstaf? (onderdelen m, n, o, q, s, u; p. 82)
|    NIET BEREIKBAAR -> 0,00 (verhuurder)
|
+- Is de herstelling het gevolg van een gebrek dat de verhuurder niet tijdig opheft? (p. 82)
|    JA -> 0,00 (verhuurder)
|
+- Postspecifieke uitsluitingen:
|    schoonmaak      -> mutatiekosten 0,00 (p. 36)
|    tuinonderhoud   -> openbaar karakter of kijktuin 0,00 (p. 37)
|    ontstopping     -> gedeelde leidingen of technisch gebrek 0,00 (p. 37)
|    lampen          -> armaturen/installatie/vandalisme 0,00 (p. 38)
|    ongedierte      -> bouwkundige oorzaak 0,00 (bewijslast huurder, p. 38)
|    installaties    -> aard- en nagelvast = onroerend, incl. keuringskosten 0,00 (p. 39)
|    schilderwerk    -> niet uitdrukkelijk overeengekomen 0,00 (p. 39)
|
+- Forfaitaire splitsing bij ontbrekende specificatie:
|    glazenwassen        -> 1/3 arbeid doorberekenbaar, 2/3 bereikbaar maken niet (p. 36)
|    ontstoppingscontract-> 50% doorberekenbaar (p. 37)
|
+- Verdeelsleutel over de woonruimten die gebruik (kunnen) maken (p. 29) [R-VDS-03/04]
```

## Boom 5 - Huismeester en externe beveiliging

```
+- Zijn functieomschrijving, facturen en urenverantwoording aangeleverd? (p. 41)
|    NEE -> ORANJE: benoem welk van de drie ontbreekt
|
+- Huismeester: toets aan het maximale uurtarief (Tabel 9, p. 40)
|    getoetste kosten = MIN(gefactureerd, uren x max_uurtarief)
|    2023/2024: EUR 40,00   |   2025/2026: EUR 41,00
|  Externe beveiliging: geen max uurtarief; facturen + redelijkheidstoets (p. 41)
|    gecertificeerd -> factuur volstaat; anders onderliggende stukken opvragen
|
+- 70% ten laste van de huurders, 30% ten laste van de verhuurder (p. 41)
|    afwijken mag als de feitelijke werkzaamheden dat rechtvaardigen -> menselijke toets
|
+- Verdeel over het aantal woonruimten
```

## Boom 6 - Administratiekosten

```
+- Is een afrekening aan de huurder verstrekt? (p. 43)
|    NEE -> 0,00. EINDE. [R-ADM-02]
|    (te late afrekening telt wél als verstrekt)
|
+- Bepaal per grondslag het maximum: (p. 43)
|    warmtelevering                      -> 2%
|    warmtelevering, meting uitbesteed   -> 1%
|    overige kostenposten                -> 5%
|    percentages zijn inclusief btw
|
+- Begrens: minimum EUR 7,50 en maximum EUR 75,00 per afrekening per woonruimte
```

## Boom 7 - Fondsen

```
+- Zijn alle vier de voorwaarden aangetoond? (p. 44)
|    1. inzage in hoogte van het fonds en betalingen daaruit
|    2. redelijke vergoeding voor de levering of dienst
|    3. omvang maximaal 3x de jaaropbrengst
|    4. inleg alleen voor de betreffende levering of dienst
|    NEE -> ORANJE: benoem welke voorwaarde niet is aangetoond
|    JA  -> toets de bijdrage aan de werkelijke kosten
```

## Boom 8 - Ontvankelijkheid en bevoegdheid (hoofdstuk 6)

```
+- Contract vóór 1 juli 2024?
|    JA + sociale sector -> uitspraak mogelijk
|    JA + vrije sector   -> alleen advies, en alleen met schriftelijke instemming van beide partijen
|                           (tenzij de huurprijs eerst is verlaagd tot sociaal niveau, p. 53-55)
|    NEE (op of na 1 juli 2024) -> uitspraak mogelijk in alle sectoren
|
+- Ligt de verzoekdatum binnen de wettelijke indieningstermijn? (Tabel 10, p. 56)
|    NEE -> niet-ontvankelijk. EINDE.
|
+- Afrekening ontvangen?
|    JA  -> is schriftelijk bezwaar gemaakt en drie weken gewacht? (p. 56)
|    NEE -> is de afrekening schriftelijk opgevraagd en drie weken gewacht? (p. 57)
|    In beide gevallen NEE -> niet-ontvankelijk,
|       TENZIJ het einde van de indieningstermijn dat onmogelijk maakte (p. 57-58)
|
+- Bedraagt het totaal van de betwiste kosten minimaal EUR 36,00? (p. 59)
|    NEE -> niet in behandeling. EINDE.
|
+- Betreft het verzoek per kostensoort maximaal één tijdvak van twaalf maanden? (art. 7:260 lid 2 BW)
```
