"""Draait de validatie van de JavaScript-port mee in de Python-testsuite.

De port in web/kern.js moet identiek rekenen aan engine/. tests/test_web_kern.mjs
controleert dat tegen de zeventien rekenvoorbeelden uit het beleidsboek en tegen
de uitvoer van de Python-kern op alle casussen.
"""

import json
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

WORTEL = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WORTEL))


class WebPort(unittest.TestCase):
    def test_referentie_is_actueel(self):
        """De vastgelegde Python-uitvoer moet overeenkomen met de huidige kern."""
        from engine.dossier_io import laad_dossier
        from engine.motor import beoordeel_dossier
        from engine.serialisatie import uitkomst_naar_dict

        referentie = json.loads((WORTEL / "tests" / "referentie-python.json").read_text("utf-8"))
        for pad in sorted((WORTEL / "tests" / "cases").rglob("*.json")):
            naam = str(pad.relative_to(WORTEL / "tests" / "cases"))
            with self.subTest(dossier=naam):
                self.assertIn(naam, referentie, "referentie-python.json is niet bijgewerkt")
                dossier = laad_dossier(pad)
                u = uitkomst_naar_dict(beoordeel_dossier(dossier), dossier)
                self.assertEqual(u["financieel"], referentie[naam]["financieel"])
                self.assertEqual(u["tellingen"], referentie[naam]["tellingen"])

    def test_javascript_port_rekent_identiek(self):
        node = shutil.which("node")
        if not node:
            self.skipTest("node is niet beschikbaar")
        uitkomst = subprocess.run(
            [node, str(WORTEL / "tests" / "test_web_kern.mjs")],
            capture_output=True, text=True, cwd=WORTEL)
        self.assertEqual(uitkomst.returncode, 0, uitkomst.stdout + uitkomst.stderr)
        self.assertIn("identiek aan de Python-kern", uitkomst.stdout)

    def test_gebouwde_bestanden_zijn_actueel(self):
        """web/app.js moet de huidige bronbestanden bevatten."""
        app = (WORTEL / "web" / "app.js").read_text("utf-8")
        for bestand in ("kern.js", "parser.js", "fotos.js", "opslag.js", "ui.js"):
            bron = (WORTEL / "web" / bestand).read_text("utf-8")
            with self.subTest(bestand=bestand):
                self.assertIn(bron.strip()[:400], app,
                              f"web/{bestand} is gewijzigd; draai tools/bouw_webapp.py opnieuw")
        self.assertIn('"normen"', app[:400] + app[:200000])

        landing = (WORTEL / "web" / "landing.html").read_text("utf-8")
        self.assertEqual((WORTEL / "web" / "index.html").read_text("utf-8"), landing,
                         "web/landing.html is gewijzigd; draai tools/bouw_webapp.py opnieuw")

    def test_elke_pagina_is_een_volwaardig_document(self):
        """Zonder doctype en viewport legt mobiel Safari een pagina op 980 px uit.

        De Artifact-omgeving voegt zelf een viewport toe; een gewone webserver
        niet. Deze pagina's worden op allebei uitgeleverd, dus staat het hier.
        """
        for bestand in ("index.html", "aanvraag.html", "beheer.html"):
            with self.subTest(pagina=bestand):
                kop = (WORTEL / "web" / bestand).read_text("utf-8")[:1400].lower()
                self.assertTrue(kop.startswith("<!doctype html>"),
                                "zonder doctype rendert de browser in quirks mode")
                self.assertIn('<html lang="nl">', kop)
                self.assertIn('<meta charset="utf-8">', kop)
                self.assertIn('name="viewport"', kop)
                self.assertIn("width=device-width", kop)
                self.assertNotIn("/*__", kop, "onvervangen plaatshouder")

    def test_de_twee_rollen_staan_op_eigen_paginas(self):
        aanvraag = (WORTEL / "web" / "aanvraag.html").read_text("utf-8")
        beheer = (WORTEL / "web" / "beheer.html").read_text("utf-8")
        self.assertIn('window.SERVICEKOSTEN_ROL = "huurder"', aanvraag)
        self.assertIn('window.SERVICEKOSTEN_ROL = "beheer"', beheer)
        # De rolwissel in de kopbalk hoort weg te zijn.
        self.assertNotIn('id="rol-beheer"', aanvraag)


if __name__ == "__main__":
    unittest.main(verbosity=2)
