#!/usr/bin/env python3
"""Bouwt web/index.html: één bestand met de normen, de regels, de parser en de interface.

De pagina draait volledig in de browser; er is geen server en geen buildstap voor
de gebruiker. Bron blijft data/*.json en web/*.js — pas die aan en draai dit opnieuw.
"""

from __future__ import annotations

import json
from pathlib import Path

WORTEL = Path(__file__).resolve().parent.parent
WEB = WORTEL / "web"


def lees(pad: Path) -> str:
    return pad.read_text(encoding="utf-8")


def main() -> int:
    normen = json.loads(lees(WORTEL / "data" / "normen.json"))
    categorieen = json.loads(lees(WORTEL / "data" / "categorieen.json"))
    classificatie = json.loads(lees(WORTEL / "data" / "classificatie.json"))
    beslisregels = json.loads(lees(WORTEL / "data" / "beslisregels.json"))

    data = {
        "normen": normen,
        "categorieen": categorieen,
        "classificatie": classificatie,
        # Alleen wat de interface toont: onderwerp en bron per regel-ID.
        "beslisregels": {"regels": [{"id": r["id"], "onderwerp": r["onderwerp"], "bron": r["bron"]}
                                    for r in beslisregels["regels"]]},
        "woningtypen": [{"waarde": k, "label": k.replace("_", " ").capitalize()}
                        for k in normen["gas"]["verbruiksnorm_zelfstandig_m3"] if not k.startswith("_")],
        "jaren": sorted(j for j in normen["gas"]["verbruiksnorm_zelfstandig_m3"]["flatwoning_appartement"]
                        if j.isdigit()),
        "termijnen": normen["termijnen"]["uiterste_datums_per_boekjaar"],
        "voorbeeld": lees(WORTEL / "voorbeelden" / "voorbeeld-afrekening-2024.txt"),
    }

    pagina = lees(WEB / "pagina.html")
    vervangingen = {
        "/*__STIJL__*/": lees(WEB / "stijl.css"),
        "/*__DATA__*/": json.dumps(data, ensure_ascii=False, separators=(",", ":")),
        "/*__KERN__*/": lees(WEB / "kern.js"),
        "/*__PARSER__*/": lees(WEB / "parser.js"),
        "/*__UI__*/": lees(WEB / "ui.js"),
    }
    for sleutel, inhoud in vervangingen.items():
        if sleutel not in pagina:
            raise SystemExit(f"Plaatshouder {sleutel} ontbreekt in web/pagina.html")
        # </script> in een string zou het script vroegtijdig sluiten.
        pagina = pagina.replace(sleutel, inhoud.replace("</script>", "<\\/script>"), 1)

    doel = WEB / "index.html"
    doel.write_text(pagina, encoding="utf-8")
    print(f"{doel} geschreven: {len(pagina) / 1024:.0f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
