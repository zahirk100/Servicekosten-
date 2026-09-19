"""Een omschrijving op een afrekening koppelen aan een categorie uit de taxonomie."""

from __future__ import annotations

import json
import re
import unicodedata
from functools import lru_cache
from pathlib import Path

DATA = Path(__file__).resolve().parents[2] / "data" / "classificatie.json"


@lru_cache(maxsize=1)
def _config() -> dict:
    with DATA.open(encoding="utf-8") as fh:
        return json.load(fh)


def normaliseer(tekst: str) -> str:
    """Kleine letters, zonder accenten, met enkele spaties."""
    ontleed = unicodedata.normalize("NFKD", tekst.lower())
    zonder_accent = "".join(teken for teken in ontleed if not unicodedata.combining(teken))
    return re.sub(r"\s+", " ", zonder_accent).strip()


def is_negeerregel(omschrijving: str) -> bool:
    """Totaal-, voorschot- en saldoregels zijn geen kostenpost."""
    schoon = normaliseer(omschrijving)
    if not schoon:
        return True
    for woord in _config()["negeerregels"]:
        genormaliseerd = normaliseer(woord)
        # Alleen als de regel ermee begint of er (vrijwel) volledig uit bestaat.
        if schoon.startswith(genormaliseerd) or schoon == genormaliseerd:
            return True
    return False


def classificeer(omschrijving: str) -> dict:
    """Geeft de best passende categorie met het trefwoord dat de match gaf.

    Retourneert altijd een dict; `categorie` is None als niets past. Het model
    raadt nooit: een niet-herkende post wordt in de applicatie ORANJE en vraagt
    de gebruiker om classificatie (R-SK-OPEN, p. 29).
    """
    schoon = normaliseer(omschrijving)
    beste: tuple[int, int, str, str] | None = None
    for categorie, blok in _config()["categorieen"].items():
        for trefwoord in blok["trefwoorden"]:
            genormaliseerd = normaliseer(trefwoord)
            if not genormaliseerd:
                continue
            positie = schoon.find(genormaliseerd)
            if positie < 0:
                continue
            # Eerst het trefwoord dat het vroegst in de omschrijving staat: dat is
            # het onderwerp. "Schoonmaak gemeenschappelijke ruimten" is schoonmaak,
            # geen post 'gemeenschappelijke ruimten'. Bij gelijke positie wint het
            # langste (specifiekste) trefwoord.
            kandidaat = (positie, -len(genormaliseerd), categorie, trefwoord)
            if beste is None or kandidaat < beste:
                beste = kandidaat
    if beste is None:
        return {
            "categorie": None, "trefwoord": None, "zekerheid": "onbekend",
            "vraag": "Deze post is niet automatisch te classificeren. Kies zelf de categorie; "
                     "de opsomming in het Besluit servicekosten is niet limitatief (p. 29, p. 75).",
        }
    _, _, categorie, trefwoord = beste
    blok = _config()["categorieen"][categorie]
    # Een lang, specifiek trefwoord is betrouwbaarder dan een kort algemeen woord.
    zekerheid = "hoog" if len(normaliseer(trefwoord)) >= 8 else "laag"
    return {
        "categorie": categorie, "trefwoord": trefwoord, "zekerheid": zekerheid,
        "vraag": blok.get("vraag"),
    }


def categorieen() -> list[str]:
    return sorted(_config()["categorieen"])
