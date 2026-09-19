"""Beoordelingen omzetten naar JSON-vriendelijke structuren voor de API."""

from __future__ import annotations

from decimal import Decimal

from .model import Beoordeling, Dossier, JaarUitkomst, Status, eur


def _bedrag(waarde: Decimal | None) -> str | None:
    return str(eur(waarde)) if waarde is not None else None


def beoordeling_naar_dict(b: Beoordeling) -> dict:
    return {
        "kostenpost_id": b.kostenpost_id,
        "categorie": b.categorie,
        "omschrijving": b.omschrijving,
        "status": b.status.value,
        "voorlopig": b.voorlopig,
        "bedrag_verhuurder": _bedrag(b.bedrag_verhuurder),
        "bedrag_model": _bedrag(b.bedrag_model),
        "verschil": _bedrag(b.verschil),
        "regels": b.regels,
        "berekening": b.berekening,
        "toelichting": b.toelichting,
        "ontbrekende_informatie": b.ontbrekende_informatie,
        "automatisering": b.automatisering.value,
        "menselijke_controle_nodig": b.menselijke_controle_nodig,
    }


def uitkomst_naar_dict(uitkomst: JaarUitkomst, dossier: Dossier | None = None) -> dict:
    beoordelingen = [beoordeling_naar_dict(b) for b in uitkomst.beoordelingen]
    tellingen = {status.value: 0 for status in Status}
    for b in uitkomst.beoordelingen:
        tellingen[b.status.value] += 1

    ondergrens = uitkomst.potentiele_correctie
    bovengrens = eur(ondergrens + uitkomst.onbeoordeeld_bedrag)

    resultaat = {
        "jaar": uitkomst.jaar,
        "ontvankelijkheid": uitkomst.ontvankelijkheid,
        "blokkerend": [r for r in uitkomst.ontvankelijkheid if r.startswith("ROOD")],
        "beoordelingen": beoordelingen,
        "tellingen": tellingen,
        "financieel": {
            "totaal_verhuurder": _bedrag(uitkomst.totaal_verhuurder),
            "totaal_beoordeeld_verhuurder": _bedrag(uitkomst.totaal_verhuurder_vastgestelde_posten),
            "totaal_model": _bedrag(uitkomst.totaal_model_vastgesteld),
            "potentiele_correctie": _bedrag(uitkomst.potentiele_correctie),
            "onbeoordeeld_bedrag": _bedrag(uitkomst.onbeoordeeld_bedrag),
            "bandbreedte_min": _bedrag(ondergrens),
            "bandbreedte_max": _bedrag(bovengrens),
            "buiten_bevoegdheid": _bedrag(eur(sum(
                (b.bedrag_verhuurder for b in uitkomst.beoordelingen
                 if b.status is Status.BUITEN_BEVOEGDHEID),
                Decimal(0)))),
        },
        "openstaande_vragen": _openstaande_vragen(uitkomst),
        "sterkte": _sterkte(uitkomst),
    }
    if dossier is not None and dossier.voorschot_in_rekening_gebracht is not None:
        voorschot = dossier.voorschot_in_rekening_gebracht
        resultaat["financieel"]["voorschot_betaald"] = _bedrag(voorschot)
        resultaat["financieel"]["saldo_volgens_verhuurder"] = _bedrag(
            voorschot - uitkomst.totaal_verhuurder)
        resultaat["financieel"]["saldo_volgens_model"] = _bedrag(
            voorschot - uitkomst.totaal_model_vastgesteld - uitkomst.onbeoordeeld_bedrag)
    return resultaat


def _openstaande_vragen(uitkomst: JaarUitkomst) -> list[dict]:
    """Elke ORANJE-post levert een concrete, geprijsde informatievraag op."""
    vragen = []
    for b in uitkomst.beoordelingen:
        for tekst in b.ontbrekende_informatie:
            vragen.append({
                "post": b.omschrijving,
                "categorie": b.categorie,
                "vraag": tekst,
                "belang": _bedrag(b.bedrag_verhuurder),
            })
    vragen.sort(key=lambda v: Decimal(v["belang"] or 0), reverse=True)
    return vragen


def _sterkte(uitkomst: JaarUitkomst) -> dict:
    """Objectieve indicatoren in plaats van een verzonnen kanspercentage."""
    beoordeelbaar = uitkomst.beoordeelbare_posten
    totaal = uitkomst.totaal_verhuurder
    beoordeeld = uitkomst.totaal_verhuurder_vastgestelde_posten
    dekking = (beoordeeld / totaal * 100) if totaal else Decimal(0)

    harde_regels = {"R-NSK-01", "R-VZ-01", "R-ROE-07", "R-ADM-01", "R-ADM-02",
                    "R-HUI-01", "R-ROE-04", "R-KH-02", "R-ROE-01", "R-SK-12", "R-VZ-02"}
    hard = sum((b.verschil or Decimal(0)) for b in beoordeelbaar
               if not b.voorlopig and (b.verschil or Decimal(0)) > 0
               and harde_regels.intersection(b.regels))
    correctie = uitkomst.potentiele_correctie
    aandeel_hard = (hard / correctie * 100) if correctie > 0 else Decimal(0)

    met_bewijs = sum(1 for b in beoordeelbaar if "R-BEW-01" not in b.regels
                     and "R-BEW-02" not in b.regels and "R-BEW-03" not in b.regels)
    return {
        "dekkingsgraad_procent": str(eur(dekking)),
        "aandeel_harde_regels_procent": str(eur(aandeel_hard)),
        "posten_met_volledige_onderbouwing": met_bewijs,
        "posten_totaal": len(beoordeelbaar),
        "toelichting": (
            "Dit zijn objectieve indicatoren, geen kanspercentage. Het beleidsboek bevat normen "
            "en methoden, geen uitkomstkansen; een slaagkans is daar niet uit af te leiden."
        ),
    }
