"""Orkestratie: ontvankelijkheid, per-post-beoordeling en jaartotalen."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from .model import (
    Automatisering,
    Beoordeling,
    Dossier,
    JaarUitkomst,
    Status,
    eur,
)
from .normen import d, normen
from .regels import HANDLERS


def _iso(waarde: str | None) -> date | None:
    return date.fromisoformat(waarde) if waarde else None


def controleer_ontvankelijkheid(dossier: Dossier) -> list[str]:
    """Hoofdstuk 6: bevoegdheid, termijnen en drempels.

    Geeft een lijst met bevindingen terug; een lege lijst betekent: geen
    beletsel gevonden op basis van de aangeleverde gegevens.
    """
    bevindingen: list[str] = []
    proc = dossier.procedure
    jaar = dossier.periode.jaar
    t = normen()["termijnen"]

    # Bevoegdheid onder de Wet betaalbare huur (par. 6.2, p. 51-53).
    gesloten = _iso(proc.contract_gesloten_op)
    if gesloten is None:
        bevindingen.append(
            "ORANJE - Datum huurovereenkomst onbekend; die bepaalt of de Huurcommissie "
            "uitspraak kan doen of alleen kan adviseren (par. 6.2.1, p. 51-52)."
        )
    elif gesloten < date(2024, 7, 1):
        if proc.sector == "vrij":
            bevindingen.append(
                "LET OP - Huurovereenkomst gesloten voor 1 juli 2024 en woning in de vrije "
                "sector: de Huurcommissie kan alleen een advies uitbrengen, en alleen als beide "
                "partijen daar schriftelijk mee instemmen (par. 6.2.1, p. 52). Bij minder dan "
                "143 punten op de peildatum 1 juli 2024 kan de huurprijs sinds 1 juli 2025 wel "
                "worden getoetst, waarna de servicekostenprocedure alsnog openstaat (par. 6.2.2, p. 53-55)."
            )
        elif proc.sector is None:
            bevindingen.append(
                "ORANJE - Sector (sociaal/vrij) onbekend voor een contract van voor 1 juli 2024; "
                "bepalend voor uitspraak versus advies (par. 6.2.1, p. 51-52)."
            )

    # Uiterste verzoekdatum (Tabel 10, p. 56).
    tabel = t["uiterste_datums_per_boekjaar"]
    if str(jaar) in tabel:
        uiterste = date.fromisoformat(tabel[str(jaar)]["uiterste_verzoekdatum"])
        verzoek = _iso(proc.verzoekdatum) or date.today()
        label = "beoogde verzoekdatum" if proc.verzoekdatum is None else "verzoekdatum"
        if verzoek > uiterste:
            bevindingen.append(
                f"ROOD - Boekjaar {jaar}: de wettelijke indieningstermijn liep tot en met "
                f"{uiterste.strftime('%d-%m-%Y')}; de {label} ({verzoek.strftime('%d-%m-%Y')}) ligt "
                "daarna. Het verzoek is niet-ontvankelijk (par. 6.3.3, Tabel 10, p. 56)."
            )
        else:
            bevindingen.append(
                f"OK - Boekjaar {jaar}: verzoek kan worden ingediend tot en met "
                f"{uiterste.strftime('%d-%m-%Y')} (Tabel 10, p. 56)."
            )
    else:
        bevindingen.append(
            f"ORANJE - Het beleidsboek noemt geen uiterste verzoekdatum voor boekjaar {jaar} "
            "(Tabel 10 loopt van 2023 tot en met 2026, p. 56). Zelf afleiden: uiterlijk "
            "tweeeneenhalf jaar na afloop van het kalenderjaar."
        )

    # Bezwaarplicht / opvraagplicht (par. 6.3.1 en 6.3.2, p. 56-57).
    if proc.afrekening_ontvangen is True and proc.bezwaar_gemaakt is not True:
        bevindingen.append(
            "ROOD - De afrekening is verstrekt maar er is geen schriftelijk bezwaar bij de "
            "verhuurder gemaakt. Zonder die schriftelijke kennisgeving verklaart de "
            "Huurcommissie het verzoek niet-ontvankelijk (par. 6.3.1, p. 56). Uitzondering: het "
            "einde van de indieningstermijn is zo nabij dat bezwaar plus drie weken reactietijd "
            "niet meer haalbaar is (par. 6.3.3, p. 57)."
        )
    if proc.afrekening_ontvangen is False and proc.afrekening_opgevraagd is not True:
        bevindingen.append(
            "ROOD - Er is geen afrekening ontvangen en de huurder heeft deze niet schriftelijk "
            "opgevraagd. De opvraagplicht met een termijn van drie weken geldt eerst "
            "(par. 6.3.2, p. 57), met dezelfde uitzondering bij een naderende indieningstermijn."
        )

    # Minimumbedrag betwiste kosten (par. 6.3.4, p. 59).
    drempel = d(normen()["drempelbedragen"]["minimum_betwiste_kosten_jaarafrekening_eur"]["waarde"])
    betwist = eur(sum((p.bedrag_verhuurder for p in dossier.kostenposten), Decimal(0)))
    if betwist < drempel:
        bevindingen.append(
            f"ROOD - Het totaalbedrag van de betwiste kosten (EUR {betwist}) ligt onder het "
            f"minimum van EUR {drempel}; de Huurcommissie neemt het verzoek dan niet in "
            "behandeling (par. 6.3.4, p. 59)."
        )

    # Art. 7:260 lid 2 BW: per kostensoort ten hoogste een tijdvak van 12 maanden.
    if dossier.periode.aantal_maanden > 12:
        bevindingen.append(
            "ROOD - Het verzoek mag per kostensoort betrekking hebben op niet meer dan een "
            "tijdvak van ten hoogste twaalf maanden (art. 7:260 lid 2 BW, bijlage 1, p. 66)."
        )
    return bevindingen


def beoordeel_kostenpost(post, dossier: Dossier) -> Beoordeling:
    handler = HANDLERS.get(post.categorie)
    if handler is None:
        return Beoordeling(
            kostenpost_id=post.id,
            categorie=post.categorie,
            omschrijving=post.omschrijving,
            status=Status.ORANJE,
            bedrag_verhuurder=post.bedrag_verhuurder,
            ontbrekende_informatie=[
                f"Onbekende categorie {post.categorie!r}. Classificeer de post eerst volgens "
                "de taxonomie in docs/02-taxonomie.md."
            ],
            automatisering=Automatisering.HANDMATIG,
            menselijke_controle_nodig=True,
        )
    return handler(post, dossier)


def beoordeel_dossier(dossier: Dossier) -> JaarUitkomst:
    beoordelingen = [beoordeel_kostenpost(p, dossier) for p in dossier.kostenposten]
    uitkomst = JaarUitkomst(
        jaar=dossier.periode.jaar,
        beoordelingen=beoordelingen,
        ontvankelijkheid=controleer_ontvankelijkheid(dossier),
    )
    _pas_overeengekomen_maximum_toe(dossier, uitkomst)
    return uitkomst


def _pas_overeengekomen_maximum_toe(dossier: Dossier, uitkomst: JaarUitkomst) -> None:
    """Voetnoot 4, p. 11: een overeengekomen vast bedrag/percentage bindt de verhuurder.

    Valt het model hoger uit dan het overeengekomen maximum, dan telt het maximum.
    Overstijgt het overeengekomen bedrag de werkelijke kosten, dan kan de
    Huurcommissie de betalingsverplichting op verzoek van de huurder verlagen.
    """
    maximum = dossier.overeengekomen_maximum
    if maximum is None:
        return
    totaal = uitkomst.totaal_model_vastgesteld
    if totaal > maximum:
        verschil = eur(totaal - maximum)
        uitkomst.beoordelingen.append(
            Beoordeling(
                kostenpost_id="CORR-MAX",
                categorie="CORRECTIE",
                omschrijving="Overeengekomen vast bedrag/percentage servicekosten",
                status=Status.ROOD,
                bedrag_verhuurder=eur(0),
                bedrag_model=eur(-verschil),
                regels=["R-ALG-03"],
                toelichting=[
                    f"Partijen zijn een vast bedrag/percentage van EUR {maximum} overeengekomen. "
                    "De verhuurder is daaraan gebonden, ook als de werkelijke kosten hoger "
                    f"uitvallen (voetnoot 4, p. 11). Het meerdere (EUR {verschil}) vervalt."
                ],
                automatisering=Automatisering.AUTOMATISCH,
                menselijke_controle_nodig=False,
            )
        )
