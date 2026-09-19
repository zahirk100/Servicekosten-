# 00 - Leeswijzer, methodiek en bronverantwoording

## Waar dit op gebaseerd is

Eén bron: **Beleidsboek Servicekosten van de Huurcommissie, versie 1 juli 2026** (86 pagina's,
inclusief bijlagen 1 t/m 4). Dat beleidsboek is van toepassing op verzoekschriften die op of na
1 juli 2026 bij de Huurcommissie worden ingediend; op eerdere verzoeken blijft de versie van
1 januari 2026 van toepassing (p. 3).

Paginaverwijzingen in deze repo verwijzen naar de PDF-pagina, die gelijk is aan het afgedrukte
paginanummer van het beleidsboek.

## De drie labels

Elke uitspraak in deze repo draagt één van deze labels. Dat onderscheid is niet cosmetisch: label
A mag een softwarebeslissing dragen, label B moet toetsbaar zijn voor een jurist, en label C mag
nooit stilzwijgend worden ingevuld.

| Label | Betekenis | Gevolg voor de software |
| --- | --- | --- |
| **A** | Expliciete regel uit het beleidsboek, herleidbaar tot een passage | Mag deterministisch worden geïmplementeerd |
| **B** | Interpretatie die redelijkerwijs uit de regel volgt | Mag worden geïmplementeerd, maar moet zichtbaar zijn in de uitleg en herzienbaar zijn |
| **C** | Niet vast te stellen op basis van het beleidsboek | Nooit invullen; levert ORANJE op met een concrete informatievraag |

Waar informatie ontbreekt staat letterlijk: *"Niet vast te stellen op basis van het beleidsboek."*

## Wat dit model expliciet níét doet

- Het verzint geen kansen of percentages waar het beleidsboek daar geen basis voor geeft.
- Het vult geen normbedragen aan uit andere bronnen. De Nibud-tabellen in het beleidsboek lopen
  tot en met **2025**; voor 2026 en later geeft het beleidsboek geen verbruiken, tarieven of
  graaddagen. Een beoordeling over boekjaar 2026 stopt op dat punt met een expliciete melding.
- Het rekent geen bedragen uit als de benodigde invoer ontbreekt. In plaats daarvan benoemt het
  welk document of welk antwoord het tekort is.

## Aannames die géén beleidsboekregel zijn

Deze staan apart omdat ze wel in de code zitten en dus zichtbaar moeten blijven:

1. **Drempel "in belangrijke mate afwijken"** (`DREMPEL_BELANGRIJKE_AFWIJKING`, standaard 10%).
   Het beleidsboek gebruikt deze maatstaf op p. 12 maar kwantificeert hem niet. Label C. De code
   gebruikt hem alleen als signaal en laat de post altijd door een menselijke beoordelaar gaan.
2. **Pro rata toerekening van een jaarlijkse gebruiksvergoeding roerende zaken bij een kortere
   huurperiode.** Het beleidsboek noemt de gebruiksvergoeding jaarlijks (p. 31) en regelt de
   kortere periode alleen voor nutsvoorzieningen (par. 3.1.3/3.2.3/3.3.3). De evenredige
   toerekening is label B.
3. **Toepassing van het prijsplafond 2023 op een periode korter dan twaalf maanden.** Het
   beleidsboek beschrijft de staffel op jaarverbruik (p. 14, p. 18). Bij een kortere periode past
   dit model de staffel toe op de berekende periodehoeveelheid. Label B.
4. **Rangorde bij samenloop van forfaits.** Als een post zowel een forfaitaire verdeling (bv. 1/3
   arbeidskosten glazenwassen) als een verdeelsleutel over woonruimten kent, past dit model eerst
   het forfait toe en daarna de verdeelsleutel. Het beleidsboek schrijft geen volgorde voor.
   Label B; de uitkomst is bij een lineaire verdeling gelijk, maar de uitleg verschilt.

## Verificatie van de rekenwijze

`tests/test_beleidsboek_voorbeelden.py` reproduceert zeventien rekenvoorbeelden die het
beleidsboek zelf geeft (p. 14, 15, 17, 19, 22, 27, 32, 35, 41, 43). Alle zeventien komen exact
uit. Dat is de enige objectieve maatstaf die beschikbaar is om te controleren of de
implementatie de methodiek van de Huurcommissie volgt.

```
python3 tests/test_beleidsboek_voorbeelden.py
```

## Grenzen van het beleidsboek als specificatie

Het beleidsboek is geen wet maar uitvoeringsbeleid: "De Huurcommissie zal dus handelen volgens
deze beleidslijnen en alleen gemotiveerd afwijken voor zover het voorliggende geschil dat
rechtvaardigt" (p. 3). Elke uitkomst van dit model is daarmee een *verwachting van de
beleidslijn*, geen voorspelling van de uitspraak. Op meerdere plaatsen behoudt de Huurcommissie
zich uitdrukkelijk de ruimte voor om af te wijken (p. 29 verdeelsleutel, p. 32 levensduur, p. 41
verdeling huismeesterkosten). Die passages zijn in het model altijd gemarkeerd als
"menselijke controle nodig".
