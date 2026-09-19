"""Referentie-implementatie van het beoordelingsmodel servicekosten.

De regels en normbedragen komen uitsluitend uit het Beleidsboek Servicekosten
van de Huurcommissie, versie 1 juli 2026. Elke regel draagt een RULE-ID dat
terugverwijst naar docs/07-beslisregels.md en naar een paginanummer in het
beleidsboek.
"""

from .model import Dossier, Kostenpost, Beoordeling, Status
from .motor import beoordeel_dossier

__all__ = ["Dossier", "Kostenpost", "Beoordeling", "Status", "beoordeel_dossier"]
