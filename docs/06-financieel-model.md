# 06 - Financieel model

## Per boekjaar

```
Servicekosten volgens verhuurder (binnen bevoegdheid)   EUR X
  - af: posten buiten de bevoegdheid van de Huurcommissie (belastingen, zorgkosten)
  = beoordeelbaar bedrag

Waarvan beoordeeld (GROEN + ROOD)                        EUR Xb
Waarschijnlijk toegestaan volgens beoordelingsmodel      EUR Y
Potentiële correctie                                     EUR Z = Xb - Y

Nog niet te beoordelen (ORANJE)                          EUR O
Bandbreedte potentiële correctie                         EUR Z  tot  EUR Z + O
```

Twee regels waar dit model zich strikt aan houdt:

1. **Alleen rekenen met wat er is.** Een post waarvoor de benodigde invoer ontbreekt, krijgt geen
   bedrag in de harde correctie. Hij verschijnt in de bandbreedte, met de informatievraag erbij.
2. **Buiten de bevoegdheid = buiten de som.** Belastingen, heffingen en zorgservicekosten worden
   apart getoond en tellen nergens in mee (par. 6.1, p. 51). Ze als correctie opvoeren zou een
   verwachting wekken die geen enkele procedure bij de Huurcommissie kan waarmaken.

## Verrekening met het voorschot

De afrekening bepaalt of er wordt bij- of terugbetaald. Het verschil tussen het betaalde voorschot
en de vastgestelde betalingsverplichting is wat de huurder feitelijk tegoed heeft of nog moet
betalen:

```
saldo_volgens_verhuurder = voorschot_betaald - kosten_volgens_verhuurder
saldo_volgens_model      = voorschot_betaald - kosten_volgens_model
effect_voor_huurder      = saldo_volgens_model - saldo_volgens_verhuurder   (= de correctie Z)
```

De correctie is dus hetzelfde bedrag, of de huurder nu een naheffing krijgt of geld terugkrijgt -
alleen de richting van de betaling verschilt.

`kosten_volgens_verhuurder` en `kosten_volgens_model` laten allebei de posten buiten de bevoegdheid
weg. Voor de correctie klopt dat - die posten vallen aan beide kanten van de streep weg. Voor het
**saldo** niet: die posten blijven wel verschuldigd. Een saldo van EUR 573 bij EUR 130 aan
heffingen betekent feitelijk EUR 443 in de hand. De applicatie noemt dat bedrag daarom bij het
saldo, zowel op het scherm als in het rapport; zonder die vermelding leest het als een volledige
eindafrekening.

## Over meerdere jaren

Welke jaren nog beoordeeld kunnen worden, volgt uit Tabel 10 (p. 56): tot tweeëneenhalf jaar na
afloop van het kalenderjaar.

| Peilmoment van het verzoek | Nog te beoordelen boekjaren |
| --- | --- |
| tot en met 30 juni 2026 | 2023, 2024, 2025 |
| 1 juli 2026 t/m 30 juni 2027 | 2024, 2025, 2026 |
| 1 juli 2027 t/m 30 juni 2028 | 2025, 2026, 2027* |
| 1 juli 2028 t/m 30 juni 2029 | 2026, 2027*, 2028* |

\* Voor boekjaren na 2026 noemt Tabel 10 geen uiterste data en bevat dit beleidsboek geen
Nibud-normen, -tarieven of graaddagen. *Niet vast te stellen op basis van het beleidsboek.*

Belangrijke beperking uit art. 7:260 lid 2 BW (p. 66): een verzoek betreft **per kostensoort niet
meer dan één tijdvak van ten hoogste twaalf maanden**. Meerdere jaren betekent dus meerdere
verzoeken, elk met een eigen bezwaar- of opvraagtraject en een eigen ontvankelijkheidstoets. Het
totaal over de jaren is daarmee een **optelsom van afzonderlijke procedures**, geen enkele zaak.

```
Boekjaar 2024   betaald/afgerekend EUR 1.850   volgens model EUR 1.300   verschil EUR 550
Boekjaar 2025   betaald/afgerekend EUR 2.100   volgens model EUR 1.250   verschil EUR 850
--------------------------------------------------------------------------------------
TOTAAL POTENTIEEL VERSCHIL                                               EUR 1.400
```

Zie `docs/08-praktijktest.md` voor een doorgerekend meerjarendossier.

## Bandbreedte in plaats van een gok

Ontbreekt informatie, dan geeft het model geen puntschatting maar een onderbouwde bandbreedte:

| Scenario | Aanname | Uitkomst |
| --- | --- | --- |
| Ondergrens | Alle ORANJE-posten blijken toegestaan zoals afgerekend | Z |
| Bovengrens | Alle ORANJE-posten blijken volledig onterecht | Z + O |

Bij elke ORANJE-post staat welke informatie nodig is en welke kant de post op gaat bij ja of nee.
De bandbreedte is daarmee geen onzekerheidsmarge maar een **werklijst met een prijskaartje**: hij
laat zien hoeveel het waard is om een specifiek document op te vragen.

## Afronding

- Alle bedragen worden afgerond op **hele centen**, zoals het beleidsboek in al zijn voorbeelden doet.
- Gasverbruik wordt afgerond op **hele m3** bij de graaddagenmethode (voorbeelden p. 14 en p. 17).
- Bij een collectieve aansluiting rondt het beleidsboek het **aandeel per woonruimte** eerst af op
  centen en neemt daarvan het maanddeel (voorbeeld p. 19). Het model volgt die volgorde; het scheelt
  centen, maar het maakt de uitkomst reproduceerbaar tegen de gepubliceerde voorbeelden.
- Een nieuw vastgesteld **voorschotbedrag** wordt afgerond op **hele euro's** (p. 24).
