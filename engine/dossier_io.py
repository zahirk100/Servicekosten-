"""Inlezen van een dossier uit JSON (zie schema/dossier.schema.json)."""

from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path

from .model import Dossier, Kostenpost, Periode, Procedure, Woonruimte


def laad_dossier(pad: str | Path) -> Dossier:
    with Path(pad).open(encoding="utf-8") as fh:
        rauw = json.load(fh)
    return uit_dict(rauw)


def uit_dict(rauw: dict) -> Dossier:
    woonruimte = Woonruimte(**rauw.get("woonruimte", {}))
    periode = Periode(**rauw["periode"])
    procedure = Procedure(**rauw.get("procedure", {}))
    posten = [
        Kostenpost(
            id=p["id"],
            categorie=p["categorie"],
            omschrijving=p["omschrijving"],
            bedrag_verhuurder=Decimal(str(p["bedrag_verhuurder"])),
            overeengekomen=p.get("overeengekomen"),
            bewijs=set(p.get("bewijs", [])),
            levering_gemotiveerd_betwist=p.get("levering_gemotiveerd_betwist", False),
            parameters=p.get("parameters", {}),
        )
        for p in rauw.get("kostenposten", [])
    ]
    voorschot = rauw.get("voorschot_in_rekening_gebracht")
    maximum = rauw.get("overeengekomen_maximum")
    return Dossier(
        woonruimte=woonruimte,
        periode=periode,
        kostenposten=posten,
        voorschot_in_rekening_gebracht=Decimal(str(voorschot)) if voorschot is not None else None,
        procedure=procedure,
        overeengekomen_maximum=Decimal(str(maximum)) if maximum is not None else None,
        referentie=rauw.get("referentie", ""),
    )
