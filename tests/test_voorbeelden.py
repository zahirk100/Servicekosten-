"""De drie voorbeeldafrekeningen moeten blijven opleveren wat ze beloven.

Deze test loopt dezelfde weg als de applicatie: de tekst door de parser, de
antwoorden op de vijf vragen erbij, en dan de kern. De JavaScript-kant rekent
aantoonbaar identiek (tests/test_web_kern.mjs), dus wat hier uitkomt is wat een
gebruiker in de browser ziet.
"""

from __future__ import annotations

import sys
import unittest
from decimal import Decimal
from pathlib import Path

WORTEL = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WORTEL))

from app.parsers.afrekening import parse_afrekening          # noqa: E402
from engine.dossier_io import uit_dict                        # noqa: E402
from engine.motor import beoordeel_dossier                    # noqa: E402
from engine.serialisatie import uitkomst_naar_dict            # noqa: E402

# De vier bewijskeuzes uit de vragenlijst, vertaald naar bewijsstukken per post.
BEWIJS = {
    "volledig": ["facturen", "specificatieformulier"],
    "deels": ["specificatieformulier"],
    "geen": [],
}


def dossier_uit(bestand: str, *, woningtype: str, bewoners: int,
                complex_: int | None, onderbouwing: str, voorschot: str) -> dict:
    """Bouwt het dossier zoals de applicatie dat doet na het invullen."""
    concept = parse_afrekening((WORTEL / "voorbeelden" / bestand).read_text("utf-8"))
    return {
        "referentie": bestand,
        "woonruimte": {
            "zelfstandig": True, "woningtype": woningtype, "aantal_bewoners": bewoners,
            "aantal_woonruimten_op_aansluiting": 1, "aantal_woonruimten_complex": complex_,
            "gebruikt_gemeenschappelijke_ruimten": True,
        },
        "periode": {"jaar": concept.jaar, "maand_van": concept.maand_van,
                    "maand_tot_en_met": concept.maand_tot_en_met},
        "procedure": {},
        "voorschot_in_rekening_gebracht": voorschot,
        "kostenposten": [
            {"id": f"P{i + 1}", "categorie": p.categorie, "omschrijving": p.omschrijving,
             "bedrag_verhuurder": str(p.bedrag), "overeengekomen": True,
             "bewijs": list(BEWIJS[onderbouwing]), "levering_gemotiveerd_betwist": False,
             "parameters": {}}
            for i, p in enumerate(concept.posten) if p.categorie
        ],
    }


class Voorbeelden(unittest.TestCase):
    def controleer(self, rauw: dict, *, posten: int, correctie: str,
                   tellingen: dict, bandbreedte_max: str | None = None):
        dossier = uit_dict(rauw)
        uitkomst = beoordeel_dossier(dossier)
        samenvatting = uitkomst_naar_dict(uitkomst, dossier)
        self.assertEqual(len(rauw["kostenposten"]), posten, "parser herkende niet alle posten")
        financieel = samenvatting["financieel"]
        self.assertEqual(Decimal(str(financieel["potentiele_correctie"])), Decimal(correctie))
        for status, aantal in tellingen.items():
            self.assertEqual(samenvatting["tellingen"][status], aantal, f"aantal {status}")
        if bandbreedte_max is not None:
            self.assertEqual(Decimal(str(financieel["bandbreedte_max"])), Decimal(bandbreedte_max))
        return uitkomst, financieel

    def test_voorbeeld_1_klopt(self):
        """Volledig onderbouwd en binnen de normen: geen correctie."""
        rauw = dossier_uit("voorbeeld-1-klopt-2024.txt", woningtype="flatwoning_appartement",
                           bewoners=2, complex_=32, onderbouwing="volledig", voorschot="552.00")
        _, financieel = self.controleer(rauw, posten=8, correctie="0.00",
                                        tellingen={"GROEN": 8, "ORANJE": 0, "ROOD": 0})
        self.assertEqual(Decimal(str(financieel["totaal_model"])), Decimal("534.00"))

    def test_voorbeeld_2_posten_die_niet_mogen(self):
        """Leegstandsderving, opstalverzekering en een niet-gespecificeerd
        onderhoudscontract: harde correctie, plus glasbewassing als open vraag."""
        rauw = dossier_uit("voorbeeld-2-te-veel-gerekend-2024.txt", woningtype="flatwoning_appartement",
                           bewoners=1, complex_=60, onderbouwing="volledig", voorschot="960.00")
        u, _ = self.controleer(rauw, posten=7, correctie="296.00", bandbreedte_max="386.00",
                               tellingen={"ROOD": 3, "ORANJE": 1, "GROEN": 2, "BUITEN_BEVOEGDHEID": 1})
        per_post = {b.omschrijving: b for b in u.beoordelingen}
        self.assertEqual(per_post["Leegstandsderving servicekosten"].bedrag_model, Decimal("0.00"))
        self.assertEqual(per_post["Opstalverzekering"].bedrag_model, Decimal("0.00"))
        # 20% van EUR 110,00 volgens par. 4.3.12, p. 44.
        self.assertEqual(per_post["Onderhoudscontract cv met 24-uursservice"].bedrag_model, Decimal("22.00"))
        # Rioolheffing is een heffing: geen servicekost, Huurcommissie niet bevoegd.
        self.assertEqual(per_post["Rioolheffing"].status.value, "BUITEN_BEVOEGDHEID")

    def test_voorbeeld_3_geen_onderbouwing(self):
        """Zonder facturen en specificatie valt elke post terug op EUR 12,00 per
        jaar (par. 6.4.2, p. 60-61)."""
        rauw = dossier_uit("voorbeeld-3-geen-onderbouwing-2024.txt", woningtype="flatwoning_appartement",
                           bewoners=3, complex_=None, onderbouwing="geen", voorschot="600.00")
        u, _ = self.controleer(rauw, posten=6, correctie="492.00",
                               tellingen={"ROOD": 6, "ORANJE": 0, "GROEN": 0})
        for b in u.beoordelingen:
            self.assertEqual(b.bedrag_model, Decimal("12.00"), b.omschrijving)
            self.assertIn("R-BEW-02", b.regels)


if __name__ == "__main__":
    unittest.main(verbosity=2)
