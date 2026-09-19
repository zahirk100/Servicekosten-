"""Van platte tekst naar een conceptdossier dat de gebruiker nog controleert.

Uitgangspunt: de parser stelt voor, de gebruiker bevestigt. Elke afgeleide
waarde draagt daarom een herkomst en, waar van toepassing, de alternatieven die
de parser óók op die regel zag staan.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from decimal import Decimal

from .bedragen import bedrag_treffers, vind_jaar, vind_periode
from .bedragen import naar_decimal
from .classificatie import classificeer, is_negeerregel, normaliseer

# Een kostenregel is een omschrijving gevolgd door minstens één bedrag.
MIN_OMSCHRIJVING = 3
MAX_OMSCHRIJVING = 90


@dataclass
class ConceptPost:
    regelnummer: int
    brontekst: str
    omschrijving: str
    bedrag: Decimal
    alternatieve_bedragen: list[Decimal] = field(default_factory=list)
    categorie: str | None = None
    trefwoord: str | None = None
    zekerheid: str = "onbekend"
    vraag: str | None = None

    def naar_dict(self) -> dict:
        return {
            "regelnummer": self.regelnummer,
            "brontekst": self.brontekst,
            "omschrijving": self.omschrijving,
            "bedrag": str(self.bedrag),
            "alternatieve_bedragen": [str(b) for b in self.alternatieve_bedragen],
            "categorie": self.categorie,
            "trefwoord": self.trefwoord,
            "zekerheid": self.zekerheid,
            "vraag": self.vraag,
        }


@dataclass
class ConceptDossier:
    jaar: int | None = None
    maand_van: int = 1
    maand_tot_en_met: int = 12
    voorschot: Decimal | None = None
    posten: list[ConceptPost] = field(default_factory=list)
    meterstanden: dict = field(default_factory=dict)
    aantal_woonruimten: int | None = None
    waarschuwingen: list[str] = field(default_factory=list)
    herkomst: dict = field(default_factory=dict)

    def naar_dict(self) -> dict:
        return {
            "jaar": self.jaar,
            "maand_van": self.maand_van,
            "maand_tot_en_met": self.maand_tot_en_met,
            "voorschot": str(self.voorschot) if self.voorschot is not None else None,
            "posten": [p.naar_dict() for p in self.posten],
            "meterstanden": {k: str(v) for k, v in self.meterstanden.items()},
            "aantal_woonruimten": self.aantal_woonruimten,
            "waarschuwingen": self.waarschuwingen,
            "herkomst": self.herkomst,
        }


def _omschrijving_van(regel: str, eerste_bedrag_positie: int | None) -> str:
    """Alles vóór het eerste herkende bedrag is de omschrijving."""
    kop = regel[:eerste_bedrag_positie] if eerste_bedrag_positie is not None else regel
    kop = re.sub(r"^[\s\-\*\u2022\|]+", "", kop)
    kop = re.sub(r"[\.\:\s_]{2,}", " ", kop)      # leiderpuntjes uit PDF-tabellen
    kop = re.sub(r"\b(?:EUR|\u20ac)\s*$", "", kop)  # valutateken vlak voor het bedrag
    return kop.strip(" .:-|\t")


def _voorschotregel(regel: str) -> bool:
    schoon = normaliseer(regel)
    return any(
        woord in schoon
        for woord in ("voorschot", "reeds betaald", "betaalde voorschotten", "vooruitbetaald")
    )


def parse_afrekening(tekst: str, metadata: dict | None = None) -> ConceptDossier:
    dossier = ConceptDossier(herkomst=dict(metadata or {}))
    regels = [r for r in tekst.splitlines()]

    dossier.jaar = vind_jaar(tekst)
    if dossier.jaar is None:
        dossier.waarschuwingen.append(
            "Het boekjaar is niet uit het document af te leiden. Vul het zelf in: het bepaalt "
            "welke normbedragen en welke termijnen gelden."
        )
    else:
        dossier.herkomst["jaar"] = "afgeleid uit de documenttekst"

    periode = vind_periode(tekst)
    if periode:
        dossier.maand_van, dossier.maand_tot_en_met = periode
        dossier.herkomst["periode"] = "afgeleid uit de documenttekst"

    for nummer, regel in enumerate(regels, start=1):
        if not regel.strip():
            continue
        treffers = bedrag_treffers(regel)
        if not treffers:
            continue
        bedragen = [waarde for _, waarde in treffers]
        omschrijving = _omschrijving_van(regel, treffers[0][0].start())

        if _voorschotregel(regel):
            if dossier.voorschot is None:
                dossier.voorschot = max(bedragen, key=abs)
                dossier.herkomst["voorschot"] = f"regel {nummer}: {regel.strip()[:80]}"
            continue

        if len(omschrijving) < MIN_OMSCHRIJVING or is_negeerregel(omschrijving):
            continue
        if len(omschrijving) > MAX_OMSCHRIJVING:
            omschrijving = omschrijving[:MAX_OMSCHRIJVING].rstrip() + "…"

        # Laatste bedrag op de regel is doorgaans het aandeel van deze huurder;
        # de eerdere kolommen (complextotaal, tarief) blijven als alternatief staan.
        gekozen = bedragen[-1]
        classificatie = classificeer(omschrijving)
        dossier.posten.append(
            ConceptPost(
                regelnummer=nummer,
                brontekst=regel.strip(),
                omschrijving=omschrijving,
                bedrag=gekozen,
                alternatieve_bedragen=bedragen[:-1],
                categorie=classificatie["categorie"],
                trefwoord=classificatie["trefwoord"],
                zekerheid=classificatie["zekerheid"],
                vraag=classificatie["vraag"],
            )
        )

    dossier.meterstanden = _vind_meterstanden(tekst)
    dossier.aantal_woonruimten = _vind_aantal_woonruimten(tekst)

    if not dossier.posten:
        dossier.waarschuwingen.append(
            "Er zijn geen kostenposten herkend. Controleer of dit de servicekostenafrekening is; "
            "u kunt de posten ook handmatig invoeren."
        )
    onbekend = [p for p in dossier.posten if p.categorie is None]
    if onbekend:
        dossier.waarschuwingen.append(
            f"{len(onbekend)} van de {len(dossier.posten)} posten kon niet automatisch worden "
            "geclassificeerd. Kies daarvoor zelf een categorie."
        )
    onzeker = [p for p in dossier.posten if p.zekerheid == "laag"]
    if onzeker:
        dossier.waarschuwingen.append(
            f"{len(onzeker)} post(en) zijn op een kort, algemeen trefwoord herkend. Controleer "
            "die classificatie extra goed."
        )
    meerdere = [p for p in dossier.posten if p.alternatieve_bedragen]
    if meerdere:
        dossier.waarschuwingen.append(
            f"Op {len(meerdere)} regel(s) stonden meerdere bedragen. Het model koos steeds het "
            "laatste bedrag als uw aandeel; controleer dit per post."
        )
    return dossier


def _vind_meterstanden(tekst: str) -> dict:
    standen: dict[str, Decimal] = {}
    for naam, patroon in (
        ("beginstand", r"beginstand\D{0,20}([\d\.\,]+)"),
        ("eindstand", r"eindstand\D{0,20}([\d\.\,]+)"),
    ):
        match = re.search(patroon, tekst, re.IGNORECASE)
        if match:
            waarde = naar_decimal(match.group(1))
            if waarde is not None:
                standen[naam] = waarde
    return standen


def _vind_aantal_woonruimten(tekst: str) -> int | None:
    match = re.search(
        r"(\d{1,4})\s*(?:woonruimten|woningen|appartementen|verhuureenheden|kamers)",
        tekst, re.IGNORECASE,
    )
    return int(match.group(1)) if match else None
