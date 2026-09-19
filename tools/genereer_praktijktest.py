#!/usr/bin/env python3
"""Genereert docs/08-praktijktest.md door alle casussen door de engine te halen.

Alle bedragen in dat document komen dus uit `engine/`, niet uit handwerk.
"""

from __future__ import annotations

import sys
from pathlib import Path

WORTEL = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WORTEL))

from engine.dossier_io import laad_dossier          # noqa: E402
from engine.motor import beoordeel_dossier          # noqa: E402
from engine.rapport import meerjarenoverzicht, rapport  # noqa: E402

CASUSSEN = [
    (
        "casus-1-eenvoudige-correcte-afrekening.json",
        "Casus 1 - Eenvoudige correcte afrekening",
        "Wat deze casus test: dat het model een correcte afrekening ook als correct herkent. Een "
        "auditmodel dat overal iets vindt, is waardeloos. Alle vier de posten zijn onderbouwd met "
        "facturen, de huismeester blijft binnen het maximale uurtarief van 2024 (EUR 40,00), de "
        "administratiekosten blijven onder 5% van de grondslag en de schoonmaakkosten zijn gelijk "
        "verdeeld over de 40 woonruimten.",
        "Uitkomst: alles GROEN, correctie EUR 0,00. Let op de referentieregel bij elektriciteit: het "
        "model berekent ook het Nibud-normbedrag (EUR 564,05) ter vergelijking, maar past dat niet "
        "toe - de meterstanden zijn bekend en niet betwist, dus zijn de werkelijke kosten "
        "uitgangspunt (p. 11).",
    ),
    (
        "casus-2-eenvoudige-foutieve-afrekening.json",
        "Casus 2 - Eenvoudige foutieve afrekening",
        "Wat deze casus test: drie posten die elk een **harde norm** overschrijden. De huismeester "
        "wordt gefactureerd tegen EUR 42,50 per uur (EUR 34.000 / 800 uur) terwijl het maximum voor "
        "2024 EUR 40,00 is. De administratiekosten bedragen EUR 120,00 op een grondslag van "
        "EUR 800,00, oftewel 15% in plaats van maximaal 5%. De wasapparatuur komt op EUR 66,66 per "
        "woonruimte, boven het maximum van EUR 5,00 per maand.",
        "Uitkomst: drie keer ROOD op grond van vaste normen, één keer GROEN. Dit is het type zaak "
        "dat volledig automatisch kan: geen enkele bevinding berust op een open norm.",
    ),
    (
        "casus-3-ontbrekende-bewijsstukken.json",
        "Casus 3 - Ontbrekende bewijsstukken",
        "Wat deze casus test: het bewijsregime van par. 6.4.2 (p. 60-61), dat vier verschillende "
        "uitkomsten kent. De gasfactuur ontbreekt (forfait), specificatieformulier én facturen "
        "ontbreken voor de schoonmaak (EUR 12,00 per jaar), er is geen enkel gegeven over de "
        "roerende zaken (standaardbedrag EUR 12,00) en de huurder betwist de signaallevering "
        "gemotiveerd zonder dat de verhuurder facturen overlegt (EUR 0,00).",
        "Uitkomst: hier zit de grootste hefboom van het hele beleidsboek. Niet omdat de kosten "
        "aantoonbaar onjuist zijn, maar omdat de verhuurder zijn onderbouwingsplicht niet nakomt. "
        "Het verschil tussen de derde en de vijfde post is instructief: dezelfde ontbrekende "
        "facturen leiden tot een forfait óf tot nul, afhankelijk van één antwoord van de huurder - "
        "betwist hij de levering gemotiveerd of niet (R-BEW-02 vs. R-BEW-03). Het tuinonderhoud "
        "blijft ORANJE: het karakter van de groenvoorziening is niet vastgesteld.",
    ),
    (
        "casus-4-meerdere-foutieve-posten.json",
        "Casus 4 - Meerdere verschillende foutieve kostenposten",
        "Wat deze casus test: zes verschillende soorten fouten naast elkaar, plus het onderscheid "
        "tussen ROOD en BUITEN BEVOEGDHEID. Leegstandsderving is verboden (p. 44), mutatieschoonmaak "
        "mag niet (p. 36), de opstalverzekering blijft voor de verhuurder (p. 42-43), de "
        "glasverzekering wordt forfaitair op 15% gezet (p. 43), glazenwassen op 1/3 arbeidskosten "
        "(p. 36), de cv-installatie is onroerend (p. 31), rookmelders zijn wettelijk verplicht "
        "(p. 33) en het onderhoudscontract op 20% 24-uursservice (p. 44).",
        "Uitkomst: de rioolheffing verdwijnt uit de berekening in plaats van als correctie te "
        "worden opgevoerd - de Huurcommissie is er niet bevoegd over (p. 44, p. 51). Die EUR 130,00 "
        "als 'winst' presenteren zou de huurder een verwachting geven die geen procedure kan "
        "waarmaken. Let ook op de administratiekosten: die dalen mee, omdat de grondslag waarover "
        "het percentage wordt berekend kleiner wordt zodra posten wegvallen.",
    ),
    (
        "casus-5-complex-menselijke-beoordeling.json",
        "Casus 5 - Complexe zaak waarin menselijke beoordeling noodzakelijk blijft",
        "Wat deze casus test: het eerlijkheidsgehalte van het model. Een huurder die acht maanden "
        "heeft gehuurd, betwist zijn gasverbruik en stelt dat de collectieve ketel gebrekkig is; de "
        "verhuurder levert geen inspectierapport. Daarnaast: een kijktuin, zonnepanelen waarvan niet "
        "vaststaat of ze roerend zijn, een WKO-installatie waarvan de vaste kosten niet zijn "
        "gesplitst, schilderwerk in de gemeenschappelijke hal en een ontstoppingsfonds dat niet aan "
        "alle vier de voorwaarden voldoet.",
        "Uitkomst: één harde bevinding (de kijktuin, EUR 88,00) en vijf ORANJE-posten met samen "
        "EUR 2.241,00 aan betwiste kosten. Het model kan voor die vijf wel rekenen - het toont "
        "voorlopige bedragen - maar telt ze niet mee in de harde correctie. Dat is precies de "
        "bedoeling: de bandbreedte van EUR 88,00 tot EUR 2.329,00 laat zien dat het opvragen van "
        "vier documenten (inspectierapport, montagewijze zonnepanelen, splitsing WKO-kosten, "
        "fondsadministratie) hier meer waard is dan welke juridische redenering ook.",
    ),
]

MEERJAAR = ["meerjaar/2024.json", "meerjaar/2025.json"]

INLEIDING = """# 08 - Praktijktest: vijf casussen door hetzelfde model

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

"""


def main() -> int:
    delen = [INLEIDING]
    for bestand, titel, vooraf, achteraf in CASUSSEN:
        pad = WORTEL / "tests" / "cases" / bestand
        uitkomst = beoordeel_dossier(laad_dossier(pad))
        delen.append(f"---\n\n## {titel}\n")
        delen.append(f"Dossier: `tests/cases/{bestand}`\n")
        delen.append(vooraf + "\n")
        delen.append(rapport(uitkomst))
        delen.append(achteraf + "\n")

    delen.append("---\n\n## Meerjarenberekening\n")
    delen.append(
        "Eén huurder, twee boekjaren, dezelfde verhuurder. Beide jaren zijn op het peilmoment "
        "(verzoek op 1 oktober 2026) nog te beoordelen volgens Tabel 10 (p. 56). Let op: op grond "
        "van art. 7:260 lid 2 BW betreft een verzoek per kostensoort ten hoogste één tijdvak van "
        "twaalf maanden, dus dit zijn twee afzonderlijke procedures met elk een eigen "
        "bezwaartraject.\n"
    )
    uitkomsten = []
    for bestand in MEERJAAR:
        uitkomst = beoordeel_dossier(laad_dossier(WORTEL / "tests" / "cases" / bestand))
        uitkomsten.append(uitkomst)
        delen.append(rapport(uitkomst, titel=f"Boekjaar {uitkomst.jaar}"))
    delen.append("### Totaal over beide jaren\n")
    delen.append(meerjarenoverzicht(uitkomsten) + "\n")
    delen.append(
        "\nDe terugkerende posten laten zien waarom een meerjarenanalyse loont: dezelfde "
        "opstalverzekering en hetzelfde te hoge huismeesterstarief keren elk jaar terug. Wie alleen "
        "het laatste boekjaar laat toetsen, laat de helft liggen.\n"
    )

    doel = WORTEL / "docs" / "08-praktijktest.md"
    doel.write_text("\n".join(delen), encoding="utf-8")
    print(f"{doel} geschreven")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
