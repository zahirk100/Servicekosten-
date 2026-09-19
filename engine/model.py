"""Datamodel van een servicekostendossier en van een beoordeling."""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from typing import Any


def eur(waarde) -> Decimal:
    """Rond af op hele centen, zoals het beleidsboek in al zijn voorbeelden doet."""
    return Decimal(str(waarde)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class Status(str, Enum):
    GROEN = "GROEN"
    ORANJE = "ORANJE"
    ROOD = "ROOD"
    BUITEN_BEVOEGDHEID = "BUITEN_BEVOEGDHEID"


class Automatisering(str, Enum):
    AUTOMATISCH = "automatisch"
    SEMI_AUTOMATISCH = "semi-automatisch"
    HANDMATIG = "handmatig"


@dataclass
class Woonruimte:
    zelfstandig: bool = True
    # Alleen nodig voor de gasnorm bij zelfstandige woonruimte (Tabel 1, p. 13).
    woningtype: str | None = None
    oppervlakte_m2: Decimal | None = None
    aantal_bewoners: int | None = None
    # Aantal woonruimten dat op dezelfde aansluiting/factuur zit (p. 15, 19, 22).
    aantal_woonruimten_op_aansluiting: int = 1
    # Complexgegevens voor verdeelsleutels (par. 4.2.1, p. 26-27).
    aantal_woonruimten_complex: int | None = None
    totale_oppervlakte_complex_m2: Decimal | None = None
    # Maakt de huurder gebruik (of kan hij gebruikmaken) van de gemeenschappelijke
    # ruimten/voorzieningen? Zo nee: geen betalingsverplichting (p. 29).
    gebruikt_gemeenschappelijke_ruimten: bool = True

    def __post_init__(self):
        if self.oppervlakte_m2 is not None:
            self.oppervlakte_m2 = Decimal(str(self.oppervlakte_m2))
        if self.totale_oppervlakte_complex_m2 is not None:
            self.totale_oppervlakte_complex_m2 = Decimal(str(self.totale_oppervlakte_complex_m2))


@dataclass
class Periode:
    """De periode waarover deze huurder kosten toegerekend krijgt."""

    jaar: int
    maand_van: int = 1
    maand_tot_en_met: int = 12

    @property
    def maanden(self) -> list[int]:
        return list(range(self.maand_van, self.maand_tot_en_met + 1))

    @property
    def aantal_maanden(self) -> int:
        return len(self.maanden)

    @property
    def volledig_jaar(self) -> bool:
        return self.maand_van == 1 and self.maand_tot_en_met == 12


@dataclass
class Kostenpost:
    id: str
    categorie: str
    omschrijving: str
    bedrag_verhuurder: Decimal
    # Is de levering/verlening (al dan niet stilzwijgend) overeengekomen? (p. 9, p. 75)
    overeengekomen: bool | None = None
    # Aanwezige bewijsstukken, bv. {"facturen", "specificatieformulier", "meterstanden"}.
    bewijs: set[str] = field(default_factory=set)
    # Betwist de huurder gemotiveerd dat de zaak/dienst is geleverd? (par. 6.4.2, p. 60-61)
    levering_gemotiveerd_betwist: bool = False
    # Post-specifieke invoer; per categorie gedocumenteerd in docs/04-datamodel.md.
    parameters: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        self.bedrag_verhuurder = eur(self.bedrag_verhuurder)
        if isinstance(self.bewijs, (list, tuple)):
            self.bewijs = set(self.bewijs)


@dataclass
class Procedure:
    """Gegevens die de ontvankelijkheid en bevoegdheid bepalen (hoofdstuk 6)."""

    contract_gesloten_op: str | None = None          # ISO-datum
    sector: str | None = None                        # sociaal | middenhuur | vrij
    afrekening_ontvangen: bool | None = None
    afrekening_ontvangen_op: str | None = None
    bezwaar_gemaakt: bool | None = None
    afrekening_opgevraagd: bool | None = None
    verzoekdatum: str | None = None                  # ISO-datum, beoogd of feitelijk
    huurder_woont_nog_op_adres: bool | None = None


@dataclass
class Dossier:
    woonruimte: Woonruimte
    periode: Periode
    kostenposten: list[Kostenpost] = field(default_factory=list)
    voorschot_in_rekening_gebracht: Decimal | None = None
    procedure: Procedure = field(default_factory=Procedure)
    # Overeengekomen vast bedrag/percentage voor servicekosten (voetnoot 4, p. 11).
    overeengekomen_maximum: Decimal | None = None
    referentie: str = ""

    def __post_init__(self):
        if self.voorschot_in_rekening_gebracht is not None:
            self.voorschot_in_rekening_gebracht = eur(self.voorschot_in_rekening_gebracht)
        if self.overeengekomen_maximum is not None:
            self.overeengekomen_maximum = eur(self.overeengekomen_maximum)


@dataclass
class Beoordeling:
    kostenpost_id: str
    categorie: str
    omschrijving: str
    status: Status
    bedrag_verhuurder: Decimal
    bedrag_model: Decimal | None = None
    bandbreedte: tuple[Decimal, Decimal] | None = None
    regels: list[str] = field(default_factory=list)
    berekening: list[str] = field(default_factory=list)
    toelichting: list[str] = field(default_factory=list)
    ontbrekende_informatie: list[str] = field(default_factory=list)
    automatisering: Automatisering = Automatisering.SEMI_AUTOMATISCH
    menselijke_controle_nodig: bool = True
    # True bij ORANJE: er is wel een rekenkundige uitkomst, maar die berust op
    # informatie die nog ontbreekt. Telt niet mee in de harde correctie.
    voorlopig: bool = False

    @property
    def verschil(self) -> Decimal | None:
        """Potentiële correctie ten gunste van de huurder (positief = te veel betaald)."""
        if self.bedrag_model is None:
            return None
        return eur(self.bedrag_verhuurder - self.bedrag_model)


@dataclass
class JaarUitkomst:
    jaar: int
    beoordelingen: list[Beoordeling]
    ontvankelijkheid: list[str] = field(default_factory=list)

    @property
    def beoordeelbare_posten(self) -> list[Beoordeling]:
        return [b for b in self.beoordelingen if b.status is not Status.BUITEN_BEVOEGDHEID]

    @property
    def definitieve_posten(self) -> list[Beoordeling]:
        """Posten met een bedrag dat op volledige informatie berust."""
        return [b for b in self.beoordeelbare_posten if b.bedrag_model is not None and not b.voorlopig]

    @property
    def totaal_verhuurder(self) -> Decimal:
        return eur(sum((b.bedrag_verhuurder for b in self.beoordeelbare_posten), Decimal(0)))

    @property
    def totaal_model_vastgesteld(self) -> Decimal:
        """Som van de posten waarvoor het model een bedrag kon vaststellen."""
        return eur(sum((b.bedrag_model for b in self.definitieve_posten), Decimal(0)))

    @property
    def totaal_verhuurder_vastgestelde_posten(self) -> Decimal:
        return eur(sum((b.bedrag_verhuurder for b in self.definitieve_posten), Decimal(0)))

    @property
    def potentiele_correctie(self) -> Decimal:
        return eur(self.totaal_verhuurder_vastgestelde_posten - self.totaal_model_vastgesteld)

    @property
    def onbeoordeelde_posten(self) -> list[Beoordeling]:
        return [b for b in self.beoordeelbare_posten if b.bedrag_model is None or b.voorlopig]

    @property
    def onbeoordeeld_bedrag(self) -> Decimal:
        return eur(sum((b.bedrag_verhuurder for b in self.onbeoordeelde_posten), Decimal(0)))
