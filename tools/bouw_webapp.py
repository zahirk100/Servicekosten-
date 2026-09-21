#!/usr/bin/env python3
"""Bouwt de drie pagina's van de applicatie.

    web/index.html     alles: landingspagina, aanvraag (#aanvraag) en beheer (#beheer)
    web/aanvraag.html  doorverwijzing naar index.html#aanvraag
    web/beheer.html    doorverwijzing naar index.html#beheer
    web/app.js         normen, regels, parser en interface in één bestand

De drie ingangen zitten in één document en worden door de hash gescheiden. Dat
moet, omdat een Artifact in een sandbox-iframe draait waar een sprong naar een
ander document niet doorheen komt. web/stijl.css wordt ongewijzigd uitgeleverd.

Bron blijft data/*.json, web/*.js, web/pagina.html en web/landing.html — pas die
aan en draai dit opnieuw.
"""

from __future__ import annotations

import json
from pathlib import Path

WORTEL = Path(__file__).resolve().parent.parent
WEB = WORTEL / "web"

# Eigen adressen voor wie ze rechtstreeks opvraagt of bookmarkt. Het zijn
# doorverwijzingen: de applicatie zelf is één document, want een Artifact draait
# in een sandbox-iframe waar een sprong naar een ander document niet doorheen komt.
INGANGEN = [
    ("aanvraag.html", "#aanvraag", "Aanvraag indienen"),
    ("beheer.html", "#beheer", "Beheeromgeving"),
]

DOORVERWIJZING = """<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="refresh" content="0; url=index.html{hash}">
<title>Servicekosten — {titel}</title>
</head>
<body>
<p>Een moment — <a href="index.html{hash}">{titel}</a>.</p>
<script>location.replace("index.html{hash}");</script>
</body>
</html>
"""


def lees(pad: Path) -> str:
    return pad.read_text(encoding="utf-8")


def bouw_data() -> dict:
    normen = json.loads(lees(WORTEL / "data" / "normen.json"))
    beslisregels = json.loads(lees(WORTEL / "data" / "beslisregels.json"))
    return {
        "normen": normen,
        "categorieen": json.loads(lees(WORTEL / "data" / "categorieen.json")),
        "classificatie": json.loads(lees(WORTEL / "data" / "classificatie.json")),
        "uitleg": json.loads(lees(WORTEL / "data" / "uitleg.json")),
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


def bouw_app_js(data: dict) -> str:
    """Alle uitvoerbare code in één bestand, gedeeld door beide pagina's."""
    delen = [
        "/* Gegenereerd door tools/bouw_webapp.py — bewerk web/*.js, niet dit bestand. */",
        "window.SERVICEKOSTEN_DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";",
    ]
    for naam in ("kern.js", "parser.js", "fotos.js", "opslag.js", "ui.js"):
        delen.append("/* ── " + naam + " ── */")
        delen.append(lees(WEB / naam))
    return "\n".join(delen) + "\n"


def main() -> int:
    data = bouw_data()
    app = bouw_app_js(data)
    (WEB / "app.js").write_text(app, encoding="utf-8")
    print(f"{WEB / 'app.js'}: {len(app) / 1024:.0f} KB")

    schil = lees(WEB / "pagina.html")
    if "/*__LANDING__*/" not in schil:
        raise SystemExit("Plaatshouder /*__LANDING__*/ ontbreekt in web/pagina.html")
    pagina = schil.replace("/*__LANDING__*/", lees(WEB / "landing.html"))
    (WEB / "index.html").write_text(pagina, encoding="utf-8")
    print(f"{WEB / 'index.html'}: {len(pagina) / 1024:.1f} KB")

    for bestand, hash_, titel in INGANGEN:
        inhoud = DOORVERWIJZING.format(hash=hash_, titel=titel)
        (WEB / bestand).write_text(inhoud, encoding="utf-8")
        print(f"{WEB / bestand}: doorverwijzing naar index.html{hash_}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
