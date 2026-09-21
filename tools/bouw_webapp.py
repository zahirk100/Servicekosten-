#!/usr/bin/env python3
"""Bouwt de drie pagina's van de applicatie.

    web/index.html     landingspagina met informatie
    web/aanvraag.html  de huurder meldt een aanvraag aan
    web/beheer.html    de beoordelaar behandelt de dossiers
    web/app.js         normen, regels, parser en interface in één bestand

Aanvraag en beheer delen dezelfde schil (web/pagina.html) en dezelfde code; ze
verschillen alleen in de rol die ze bij het laden meegeven. web/stijl.css wordt
ongewijzigd uitgeleverd en door alle drie de pagina's gebruikt.

Bron blijft data/*.json, web/*.js, web/pagina.html en web/landing.html — pas die
aan en draai dit opnieuw.
"""

from __future__ import annotations

import json
from pathlib import Path

WORTEL = Path(__file__).resolve().parent.parent
WEB = WORTEL / "web"

PAGINAS = [
    ("aanvraag.html", "huurder", "Servicekosten — aanvraag indienen"),
    ("beheer.html", "beheer", "Servicekosten — beheer"),
]


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
    for plaatshouder in ("/*__ROL__*/", "/*__TITEL__*/"):
        if plaatshouder not in schil:
            raise SystemExit(f"Plaatshouder {plaatshouder} ontbreekt in web/pagina.html")
    for bestand, rol, titel in PAGINAS:
        pagina = schil.replace("/*__ROL__*/", rol).replace("/*__TITEL__*/", titel)
        (WEB / bestand).write_text(pagina, encoding="utf-8")
        print(f"{WEB / bestand}: {len(pagina) / 1024:.1f} KB")

    landing = lees(WEB / "landing.html")
    (WEB / "index.html").write_text(landing, encoding="utf-8")
    print(f"{WEB / 'index.html'}: {len(landing) / 1024:.1f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
