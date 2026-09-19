"""Validatie: het model moet de rekenvoorbeelden van het beleidsboek reproduceren.

Als een van deze tests faalt, wijkt de implementatie af van de gepubliceerde
rekenwijze van de Huurcommissie. Elke test noemt de pagina van het voorbeeld.
"""

import sys
import unittest
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from engine.model import Beoordeling, Dossier, Kostenpost, Periode, Status, Woonruimte, eur
from engine.motor import beoordeel_dossier
from engine.regels import (
    _nibud_elektriciteit,
    _nibud_gas,
    _nibud_water,
    graaddagenfactor,
)


def leeg_resultaat() -> Beoordeling:
    return Beoordeling(
        kostenpost_id="t", categorie="t", omschrijving="t",
        status=Status.ORANJE, bedrag_verhuurder=eur(0),
    )


def dossier(woonruimte: Woonruimte, jaar: int, van: int = 1, tot: int = 12, **kw) -> Dossier:
    return Dossier(woonruimte=woonruimte, periode=Periode(jaar, van, tot), **kw)


class Gas(unittest.TestCase):
    def test_appartement_januari_tot_en_met_mei_2024(self):
        """Beleidsboek p. 14: EUR 671,12."""
        dos = dossier(Woonruimte(zelfstandig=True, woningtype="flatwoning_appartement"), 2024, 1, 5)
        self.assertEqual(_nibud_gas(dos, leeg_resultaat()), Decimal("671.12"))

    def test_kamer_16m2_in_pand_van_vier_kamers_2024(self):
        """Beleidsboek p. 15: EUR 583,19."""
        dos = dossier(
            Woonruimte(zelfstandig=False, oppervlakte_m2=16, aantal_woonruimten_op_aansluiting=4),
            2024,
        )
        self.assertEqual(_nibud_gas(dos, leeg_resultaat()), Decimal("583.19"))

    def test_graaddagenmethode_januari_2024(self):
        """Beleidsboek p. 17: 2.000 m3 over het jaar -> 395 m3 in januari."""
        dos = dossier(Woonruimte(), 2024, 1, 1)
        verbruik = (Decimal("2000") * graaddagenfactor(dos)).quantize(Decimal("1"))
        self.assertEqual(verbruik, Decimal("395"))


class Elektriciteit(unittest.TestCase):
    def test_tweepersoonshuishouden_zelfstandig_2024(self):
        """Beleidsboek p. 19: EUR 564,05."""
        dos = dossier(Woonruimte(zelfstandig=True, aantal_bewoners=2), 2024)
        self.assertEqual(_nibud_elektriciteit(dos, leeg_resultaat()), Decimal("564.05"))

    def test_kamer_in_complex_van_vijftien_januari_tot_en_met_april_2025(self):
        """Beleidsboek p. 19: EUR 92,85."""
        dos = dossier(Woonruimte(zelfstandig=False, aantal_woonruimten_op_aansluiting=15), 2025, 1, 4)
        self.assertEqual(_nibud_elektriciteit(dos, leeg_resultaat()), Decimal("92.85"))


class Water(unittest.TestCase):
    def test_zelfstandig_twee_bewoners_2025(self):
        """Beleidsboek p. 22: EUR 253,15."""
        dos = dossier(Woonruimte(zelfstandig=True, aantal_bewoners=2), 2025)
        self.assertEqual(_nibud_water(dos, leeg_resultaat()), Decimal("253.15"))

    def test_onzelfstandig_een_bewoner_pand_met_vier_kamers_2025(self):
        """Beleidsboek p. 22: EUR 141,61."""
        dos = dossier(
            Woonruimte(zelfstandig=False, aantal_bewoners=1, aantal_woonruimten_op_aansluiting=4),
            2025,
        )
        self.assertEqual(_nibud_water(dos, leeg_resultaat()), Decimal("141.61"))


class Verdeelsleutels(unittest.TestCase):
    def test_gas_zonder_eigen_meter_complex_van_vijf(self):
        """Beleidsboek p. 27: EUR 586,25."""
        dos = dossier(
            Woonruimte(
                zelfstandig=True, oppervlakte_m2=60, aantal_woonruimten_complex=5,
                totale_oppervlakte_complex_m2=400,
            ),
            2024,
            kostenposten=[
                Kostenpost(
                    id="gas", categorie="NUT-GAS-ZM", omschrijving="Gas zonder eigen meter",
                    bedrag_verhuurder=Decimal("600"), overeengekomen=True,
                    bewijs={"facturen", "specificatieformulier"},
                    parameters={"totale_kosten_complex": "3500"},
                )
            ],
        )
        uitkomst = beoordeel_dossier(dos)
        self.assertEqual(uitkomst.beoordelingen[0].bedrag_model, Decimal("586.25"))


class Huismeester(unittest.TestCase):
    def test_achthonderd_uur_honderdvijftig_woningen_2024(self):
        """Beleidsboek p. 41: EUR 149,33."""
        dos = dossier(
            Woonruimte(aantal_woonruimten_complex=150), 2024,
            kostenposten=[
                Kostenpost(
                    id="hm", categorie="SK-06", omschrijving="Huismeester",
                    bedrag_verhuurder=Decimal("226.67"), overeengekomen=True,
                    bewijs={"facturen", "urenverantwoording"},
                    parameters={"uren": 800, "totale_kosten": "34000", "aantal_woonruimten": 150},
                )
            ],
        )
        self.assertEqual(beoordeel_dossier(dos).beoordelingen[0].bedrag_model, Decimal("149.33"))


class RoerendeZaken(unittest.TestCase):
    def _gordijnen(self, jaar_in_gebruik: int):
        dos = dossier(
            Woonruimte(), 2024,
            kostenposten=[
                Kostenpost(
                    id="g", categorie="SK-03", omschrijving="Gordijnen",
                    bedrag_verhuurder=Decimal("60"), overeengekomen=True,
                    bewijs={"facturen", "specificatieformulier"},
                    parameters={
                        "roerend": True, "aanschafwaarde": "300",
                        "levensduur_jaren": 5, "jaar_in_gebruik": jaar_in_gebruik,
                    },
                )
            ],
        )
        return beoordeel_dossier(dos).beoordelingen[0].bedrag_model

    def test_gordijnen_eerste_periode(self):
        """Beleidsboek p. 32: 20% van EUR 300 = EUR 60,00."""
        self.assertEqual(self._gordijnen(3), Decimal("60.00"))

    def test_gordijnen_na_herwaardering(self):
        """Beleidsboek p. 32: 20% van 60% van EUR 300 = EUR 36,00."""
        self.assertEqual(self._gordijnen(7), Decimal("36.00"))

    def test_gordijnen_versleten(self):
        """Beleidsboek p. 32: na twee perioden geen vergoeding meer."""
        self.assertEqual(self._gordijnen(11), Decimal("0.00"))

    def _wasapparatuur(self, jaar_in_gebruik: int):
        dos = dossier(
            Woonruimte(), 2024,
            kostenposten=[
                Kostenpost(
                    id="w", categorie="SK-03", omschrijving="Industriele wasmachines en wasdrogers",
                    bedrag_verhuurder=Decimal("66.66"), overeengekomen=True,
                    bewijs={"facturen", "specificatieformulier"},
                    parameters={
                        "roerend": True, "soort": "wasapparatuur", "aanschafwaarde": "50000",
                        "jaar_in_gebruik": jaar_in_gebruik, "aantal_woonruimten": 75,
                    },
                )
            ],
        )
        return beoordeel_dossier(dos).beoordelingen[0].bedrag_model

    def test_wasapparatuur_eerste_periode_begrensd_op_maximum(self):
        """Beleidsboek p. 35: EUR 66,66 per woonruimte, begrensd op EUR 60,00 per jaar."""
        self.assertEqual(self._wasapparatuur(3), Decimal("60.00"))

    def test_wasapparatuur_tweede_periode(self):
        """Beleidsboek p. 35: 6% van EUR 50.000 / 75 = EUR 40,00."""
        self.assertEqual(self._wasapparatuur(12), Decimal("40.00"))

    def test_zonnepanelen_opslag_van_tweeduizend_euro(self):
        """Beleidsboek p. 32: 6,67% over aanschafwaarde + EUR 2.000."""
        dos = dossier(
            Woonruimte(), 2025,
            kostenposten=[
                Kostenpost(
                    id="zp", categorie="SK-03", omschrijving="Zonnepanelen",
                    bedrag_verhuurder=Decimal("500"), overeengekomen=True,
                    bewijs={"facturen", "specificatieformulier"},
                    parameters={
                        "roerend": True, "soort": "zonnepanelen", "aanschafwaarde": "6000",
                        "jaar_in_gebruik": 2,
                    },
                )
            ],
        )
        verwacht = eur(Decimal("8000") * Decimal("0.0667"))
        self.assertEqual(beoordeel_dossier(dos).beoordelingen[0].bedrag_model, verwacht)


class Administratiekosten(unittest.TestCase):
    def test_maximumpercentages_en_bovengrens(self):
        """Beleidsboek p. 43: 2% warmtelevering, 5% overig, maximaal EUR 75,00."""
        dos = dossier(
            Woonruimte(), 2024,
            kostenposten=[
                Kostenpost(
                    id="adm", categorie="SK-11", omschrijving="Administratiekosten",
                    bedrag_verhuurder=Decimal("120"),
                    parameters={
                        "afrekening_verstrekt": True,
                        "grondslag_warmtelevering": "1000",
                        "grondslag_overige_posten": "1000",
                    },
                )
            ],
        )
        # 2% van 1000 = 20 + 5% van 1000 = 50 -> 70, onder het maximum van 75.
        self.assertEqual(beoordeel_dossier(dos).beoordelingen[0].bedrag_model, Decimal("70.00"))

    def test_bovengrens_vijfenzeventig_euro(self):
        dos = dossier(
            Woonruimte(), 2024,
            kostenposten=[
                Kostenpost(
                    id="adm", categorie="SK-11", omschrijving="Administratiekosten",
                    bedrag_verhuurder=Decimal("500"),
                    parameters={"afrekening_verstrekt": True, "grondslag_overige_posten": "10000"},
                )
            ],
        )
        self.assertEqual(beoordeel_dossier(dos).beoordelingen[0].bedrag_model, Decimal("75.00"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
