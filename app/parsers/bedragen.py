"""Nederlandse bedragen en datums uit vrije tekst halen."""

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation

# Vangt "€ 1.234,56", "1234,56", "€ 85,-", "1.200", "0,29" en negatieve varianten.
# De staart-lookahead sluit getallen uit die aan een woord vastzitten ("24-uursservice")
# of die deel zijn van een huisnummer met toevoeging ("42-3").
BEDRAG = re.compile(
    r"""(?<![\w,.\-])            # niet midden in 42-3 of 2024-2025
        (?P<teken>-/-\s*|-)?
        (?:€\s*|EUR\s+)?
        (?P<getal>\d{1,3}(?:\.\d{3})+(?:,\d{1,2}|,-)?
                 |\d+,\d{1,2}
                 |\d+,-
                 |\d+)
        (?!\w|-\w|\s*[A-Z]{2}\b)""",
    re.VERBOSE,
)

JAARTAL = re.compile(r"^(?:19|20)\d{2}$")

# Een getal is pas geldvormig als het een valutateken draagt, decimalen achter
# een komma heeft, of met punten in duizendtallen is geschreven. Een kaal getal
# is op een factuur vaker een huisnummer, een KvK-nummer of een aantal.
GELDVORM = re.compile(r"€|EUR|,\d{1,2}(?!\d)|,-|\d{1,3}(?:\.\d{3})+")


def lijkt_op_geld(tekst: str) -> bool:
    return bool(GELDVORM.search(tekst))

MAANDEN = {
    "januari": 1, "februari": 2, "maart": 3, "april": 4, "mei": 5, "juni": 6,
    "juli": 7, "augustus": 8, "september": 9, "oktober": 10, "november": 11, "december": 12,
}


def naar_decimal(tekst: str) -> Decimal | None:
    """Zet een Nederlands genoteerd getal om naar Decimal.

    '1.234,56' -> 1234.56   '85,-' -> 85   '1.200' -> 1200   '0,29' -> 0.29
    """
    schoon = (tekst.strip().replace("€", "").replace("EUR", "")
              .replace(" ", "").replace(" ", ""))
    negatief = schoon.startswith("-")
    schoon = schoon.lstrip("-/").lstrip("-")
    if schoon.endswith(",-"):
        schoon = schoon[:-2]
    if "," in schoon:
        schoon = schoon.replace(".", "").replace(",", ".")
    elif schoon.count(".") >= 1:
        staart = schoon.rsplit(".", 1)[1]
        # Drie cijfers achter de laatste punt: duizendtalscheiding, geen decimalen.
        schoon = schoon.replace(".", "") if len(staart) == 3 else schoon
    if not schoon:
        return None
    try:
        waarde = Decimal(schoon)
    except InvalidOperation:
        return None
    return -waarde if negatief else waarde


def bedrag_treffers(regel: str) -> list[tuple[re.Match, Decimal]]:
    """Alle bedragen op een regel met hun positie, in leesvolgorde."""
    treffers = []
    for match in BEDRAG.finditer(regel):
        if JAARTAL.match(match.group("getal")):
            continue  # losse jaartallen zijn geen bedrag
        waarde = naar_decimal(match.group(0))
        if waarde is not None:
            treffers.append((match, waarde))
    return treffers


def vind_bedragen(regel: str) -> list[Decimal]:
    return [waarde for _, waarde in bedrag_treffers(regel)]


def vind_jaar(tekst: str) -> int | None:
    """Het boekjaar waarover wordt afgerekend."""
    patronen = [
        r"(?:afrekening|overzicht|boekjaar|servicekosten|kalenderjaar)\D{0,30}((?:19|20)\d{2})",
        r"((?:19|20)\d{2})\s*(?:afrekening|servicekosten)",
        r"\b(?:over|periode)\b\D{0,20}((?:19|20)\d{2})",
    ]
    for patroon in patronen:
        match = re.search(patroon, tekst, re.IGNORECASE)
        if match:
            return int(match.group(1))
    jaren = [int(j) for j in re.findall(r"\b(20[0-3]\d)\b", tekst)]
    return max(set(jaren), key=jaren.count) if jaren else None


def vind_periode(tekst: str) -> tuple[int, int] | None:
    """Maandbereik uit 'van 1 januari 2024 tot en met 31 mei 2024'."""
    patroon = re.compile(
        r"(\d{1,2})\s+(" + "|".join(MAANDEN) + r")\s+((?:19|20)\d{2})"
        r"\s*(?:tot en met|t/m|tot|-|tm)\s*"
        r"(\d{1,2})\s+(" + "|".join(MAANDEN) + r")\s+((?:19|20)\d{2})",
        re.IGNORECASE,
    )
    match = patroon.search(tekst)
    if match:
        return MAANDEN[match.group(2).lower()], MAANDEN[match.group(5).lower()]
    numeriek = re.search(
        r"(\d{1,2})[-/](\d{1,2})[-/]((?:19|20)\d{2})\s*(?:tot en met|t/m|tot|-|tm)\s*"
        r"(\d{1,2})[-/](\d{1,2})[-/]((?:19|20)\d{2})",
        tekst,
    )
    if numeriek:
        return int(numeriek.group(2)), int(numeriek.group(5))
    return None
