#!/usr/bin/env python3
"""Genereert docs/07-beslisregels.md uit data/beslisregels.json.

data/beslisregels.json is de enige bron; het markdownbestand is afgeleid.
Aanpassen doe je dus in de JSON, daarna dit script draaien.
"""

from __future__ import annotations

import json
from pathlib import Path

WORTEL = Path(__file__).resolve().parent.parent
BRON = WORTEL / "data" / "beslisregels.json"
DOEL = WORTEL / "docs" / "07-beslisregels.md"

KOP = """# 07 - Beslisregeltabel

Gegenereerd uit `data/beslisregels.json` met `tools/genereer_regeltabel.py`. Pas de JSON aan, niet
dit bestand.

De kolom **Berekening** is bewust deterministisch geformuleerd, zodat een ontwikkelaar haar direct
kan vertalen naar code. Waar dat niet kan omdat het beleidsboek een open norm gebruikt, staat dat
in **Uitzonderingen** en is **Menselijke controle** op `ja` gezet.

Alle {aantal} regels, gesorteerd op ID-groep.

"""

VOET = """
## Samenvatting automatiseerbaarheid

| Niveau | Aantal regels | Betekenis |
| --- | ---: | --- |
| automatisch | {auto} | Deterministisch af te leiden uit de invoer; geen menselijk oordeel nodig |
| semi-automatisch | {semi} | Het rekenwerk is deterministisch, maar minstens één voorwaarde berust op een oordeel |
| handmatig | {hand} | De kern van de regel is een juridisch of feitelijk oordeel |

| Menselijke controle | Aantal regels |
| --- | ---: |
| nodig | {controle_ja} |
| niet nodig | {controle_nee} |
"""


def cel(waarde) -> str:
    if isinstance(waarde, list):
        waarde = ", ".join(waarde) if waarde else "-"
    tekst = str(waarde).strip() or "-"
    return tekst.replace("|", "\\|").replace("\n", " ")


def main() -> int:
    regels = json.loads(BRON.read_text(encoding="utf-8"))["regels"]
    uit = [KOP.format(aantal=len(regels))]
    uit.append(
        "| Rule ID | Categorie | Onderwerp | Input | Voorwaarde | Berekening | Output | "
        "Benodigd bewijs | Uitzonderingen | Automatiseerbaarheid | Menselijke controle | "
        "Bron in beleidsboek |"
    )
    uit.append("| " + " | ".join(["---"] * 12) + " |")
    for r in regels:
        uit.append(
            "| `{id}` | {categorie} | {onderwerp} | {input} | {voorwaarde} | {berekening} | "
            "{output} | {bewijs} | {uitzonderingen} | {automatiseerbaarheid} | {controle} | "
            "{bron} |".format(
                id=r["id"],
                categorie=cel(r["categorie"]),
                onderwerp=cel(r["onderwerp"]),
                input=cel(r["input"]),
                voorwaarde=cel(r["voorwaarde"]),
                berekening=cel(r["berekening"]),
                output=cel(r["output"]),
                bewijs=cel(r["bewijs"]),
                uitzonderingen=cel(r["uitzonderingen"]),
                automatiseerbaarheid=cel(r["automatiseerbaarheid"]),
                controle="ja" if r["menselijke_controle"] else "nee",
                bron=cel(r["bron"]),
            )
        )
    niveaus = {n: sum(1 for r in regels if r["automatiseerbaarheid"] == n)
               for n in ("automatisch", "semi-automatisch", "handmatig")}
    uit.append(
        VOET.format(
            auto=niveaus["automatisch"],
            semi=niveaus["semi-automatisch"],
            hand=niveaus["handmatig"],
            controle_ja=sum(1 for r in regels if r["menselijke_controle"]),
            controle_nee=sum(1 for r in regels if not r["menselijke_controle"]),
        )
    )
    DOEL.write_text("\n".join(uit), encoding="utf-8")
    print(f"{DOEL} geschreven: {len(regels)} regels")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
