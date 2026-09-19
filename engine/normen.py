"""Toegang tot data/normen.json met expliciete fouten bij ontbrekende normen."""

from __future__ import annotations

import json
from decimal import Decimal
from functools import lru_cache
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data" / "normen.json"


class NormOntbreekt(LookupError):
    """Het beleidsboek bevat geen norm voor deze combinatie.

    Dit is geen bug maar een inhoudelijke uitkomst: de beoordeling kan voor dit
    onderdeel niet automatisch plaatsvinden en moet ORANJE worden.
    """


@lru_cache(maxsize=1)
def normen() -> dict:
    with DATA.open(encoding="utf-8") as fh:
        return json.load(fh)


def d(waarde) -> Decimal:
    """Naar Decimal, zonder binaire float-afrondingsruis."""
    return Decimal(str(waarde))


def _jaar(tabel: dict, jaar: int, wat: str) -> dict:
    sleutel = str(jaar)
    if sleutel not in tabel:
        beschikbaar = sorted(k for k in tabel if k.isdigit())
        raise NormOntbreekt(
            f"Het beleidsboek (versie 1 juli 2026) bevat geen {wat} voor {jaar}. "
            f"Beschikbaar: {', '.join(beschikbaar)}."
        )
    return tabel[sleutel]


def gas_verbruiksnorm_zelfstandig(woningtype: str, jaar: int) -> Decimal:
    tabel = normen()["gas"]["verbruiksnorm_zelfstandig_m3"]
    if woningtype not in tabel:
        geldig = [k for k in tabel if not k.startswith("_")]
        raise NormOntbreekt(f"Onbekend woningtype {woningtype!r}. Geldig: {geldig}.")
    return d(_jaar(tabel[woningtype], jaar, f"gasverbruiksnorm voor {woningtype}"))


def gas_tarief(jaar: int) -> dict:
    return _jaar(normen()["gas"]["tarief"], jaar, "gastarief")


def elektriciteit_verbruiksnorm_zelfstandig(bewoners: int, jaar: int) -> Decimal:
    tabel = normen()["elektriciteit"]["verbruiksnorm_zelfstandig_kwh"]
    sleutel = str(min(bewoners, 5))
    if sleutel not in tabel:
        raise NormOntbreekt(f"Geen elektriciteitsnorm voor {bewoners} bewoners.")
    if bewoners > 5:
        # Tabel 4 (p. 18) loopt tot en met vijf bewoners; daarboven geeft het
        # beleidsboek geen norm. Dat is een inhoudelijk hiaat, geen afronding.
        raise NormOntbreekt(
            "Tabel 4 (p. 18) bevat alleen normen tot en met vijf bewoners; "
            f"voor {bewoners} bewoners geeft het beleidsboek geen norm."
        )
    return d(_jaar(tabel[sleutel], jaar, f"elektriciteitsnorm voor {bewoners} bewoners"))


def elektriciteit_tarief(jaar: int) -> dict:
    return _jaar(normen()["elektriciteit"]["tarief"], jaar, "elektriciteitstarief")


def water_verbruiksnorm(bewoners: int, jaar: int) -> Decimal:
    tabel = normen()["water"]["verbruiksnorm_m3"]
    sleutel = str(bewoners)
    if sleutel not in tabel:
        raise NormOntbreekt(
            "Tabel 7 (p. 21) bevat alleen normen tot en met vijf bewoners; "
            f"voor {bewoners} bewoners geeft het beleidsboek geen norm."
        )
    return d(_jaar(tabel[sleutel], jaar, f"waternorm voor {bewoners} bewoners"))


def water_tarief(jaar: int) -> dict:
    return _jaar(normen()["water"]["tarief"], jaar, "watertarief")


def graaddagen(jaar: int) -> dict:
    return _jaar(normen()["graaddagen"], jaar, "graaddagen")


def seizoenspatroon() -> dict:
    return normen()["elektriciteit"]["seizoenspatroon_percentage_per_maand"]


def huismeester_uurtarief(jaar: int) -> Decimal:
    tabel = normen()["huismeester"]["maximaal_uurtarief_incl_btw"]
    return d(_jaar(tabel, jaar, "maximaal uurtarief huismeester"))
