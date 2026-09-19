"""HTTP-API en webinterface voor het servicekosten-auditmodel.

Starten:  python3 -m app          (of: uvicorn app.main:app --reload)
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles

from app.parsers import DocumentFout, lees_document, parse_afrekening
from engine.brief import bezwaarbrief, opvraagbrief
from engine.dossier_io import uit_dict
from engine.motor import beoordeel_dossier
from engine.serialisatie import uitkomst_naar_dict

WORTEL = Path(__file__).resolve().parent.parent
STATIC = Path(__file__).resolve().parent / "static"
VOORBEELDEN = WORTEL / "voorbeelden"

app = FastAPI(
    title="Servicekosten-auditmodel",
    description="Controleert een servicekostenafrekening tegen het Beleidsboek Servicekosten "
                "van de Huurcommissie, versie 1 juli 2026.",
    version="1.0.0",
)


def _data(naam: str) -> dict:
    with (WORTEL / "data" / naam).open(encoding="utf-8") as fh:
        return json.load(fh)


@app.get("/api/meta")
def meta() -> dict:
    """Alles wat de interface nodig heeft om het formulier op te bouwen."""
    categorieen = _data("categorieen.json")
    normen = _data("normen.json")
    regels = _data("beslisregels.json")["regels"]
    jaren = sorted(
        j for j in normen["gas"]["verbruiksnorm_zelfstandig_m3"]["flatwoning_appartement"]
        if j.isdigit()
    )
    return {
        "bron": normen["bron"],
        "categorieen": categorieen["categorieen"],
        "algemene_velden": categorieen["algemene_velden"],
        "bewijsopties": categorieen["bewijsopties"],
        "woningtypen": [
            {"waarde": k, "label": k.replace("_", " ").capitalize()}
            for k in normen["gas"]["verbruiksnorm_zelfstandig_m3"] if not k.startswith("_")
        ],
        "beschikbare_jaren": jaren,
        "termijnen": normen["termijnen"]["uiterste_datums_per_boekjaar"],
        "drempels": normen["drempelbedragen"],
        "aantal_regels": len(regels),
        "regels": {r["id"]: {"onderwerp": r["onderwerp"], "bron": r["bron"]} for r in regels},
    }


@app.post("/api/upload")
async def upload(bestand: UploadFile = File(...)) -> dict:
    """Leest een afrekening in en geeft een conceptdossier terug ter controle."""
    inhoud = await bestand.read()
    try:
        tekst, metadata = lees_document(inhoud, bestand.filename or "onbekend")
    except DocumentFout as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    concept = parse_afrekening(tekst, metadata)
    return {
        "concept": concept.naar_dict(),
        "tekstfragment": "\n".join(tekst.splitlines()[:80]),
    }


@app.post("/api/beoordeel")
def beoordeel(dossier: dict[str, Any]) -> dict:
    """Beoordeelt een (gecontroleerd) dossier tegen de beslisregels."""
    try:
        model = uit_dict(dossier)
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=f"Ongeldig dossier: {exc}") from exc
    try:
        uitkomst = beoordeel_dossier(model)
    except Exception as exc:  # normen die het beleidsboek niet kent, ongeldige invoer
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return uitkomst_naar_dict(uitkomst, model)


@app.post("/api/brief", response_class=PlainTextResponse)
def brief(verzoek: dict[str, Any]) -> str:
    """Genereert een conceptbezwaarbrief of een opvraagbrief."""
    soort = verzoek.get("soort", "bezwaar")
    dossier_rauw = verzoek.get("dossier")
    if soort == "opvraag":
        jaar = (dossier_rauw or {}).get("periode", {}).get("jaar") or verzoek.get("jaar")
        if not jaar:
            raise HTTPException(status_code=422, detail="Boekjaar ontbreekt.")
        return opvraagbrief(int(jaar))
    if not dossier_rauw:
        raise HTTPException(status_code=422, detail="Dossier ontbreekt.")
    try:
        model = uit_dict(dossier_rauw)
        uitkomst = beoordeel_dossier(model)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return bezwaarbrief(uitkomst, model)


@app.get("/api/voorbeelden")
def voorbeelden() -> list[dict]:
    if not VOORBEELDEN.exists():
        return []
    return [
        {"bestandsnaam": p.name, "grootte": p.stat().st_size}
        for p in sorted(VOORBEELDEN.iterdir()) if p.is_file()
    ]


@app.get("/api/voorbeelden/{bestandsnaam}")
def voorbeeld(bestandsnaam: str) -> FileResponse:
    pad = (VOORBEELDEN / bestandsnaam).resolve()
    if not pad.is_file() or VOORBEELDEN.resolve() not in pad.parents:
        raise HTTPException(status_code=404, detail="Voorbeeld niet gevonden.")
    return FileResponse(pad, filename=bestandsnaam)


@app.get("/api/gezondheid")
def gezondheid() -> dict:
    return {"status": "ok", "beleidsboek": _data("normen.json")["bron"]["versie"]}


@app.exception_handler(DocumentFout)
def documentfout(_request, exc: DocumentFout) -> JSONResponse:  # pragma: no cover
    return JSONResponse(status_code=422, content={"detail": str(exc)})


app.mount("/", StaticFiles(directory=STATIC, html=True), name="static")
