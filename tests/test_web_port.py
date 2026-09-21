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
        """web/app.js en web/index.html moeten de huidige bronnen bevatten."""
        app = (WORTEL / "web" / "app.js").read_text("utf-8")
        for bestand in ("kern.js", "parser.js", "fotos.js", "opslag.js", "ui.js"):
            bron = (WORTEL / "web" / bestand).read_text("utf-8")
            with self.subTest(bestand=bestand):
                self.assertIn(bron.strip()[:400], app,
                              f"web/{bestand} is gewijzigd; draai tools/bouw_webapp.py opnieuw")
        self.assertIn('"normen"', app[:200000])

        index = (WORTEL / "web" / "index.html").read_text("utf-8")
        for bron, naam in ((WORTEL / "web" / "landing.html", "landing.html"),
                           (WORTEL / "web" / "pagina.html", "pagina.html")):
            stuk = bron.read_text("utf-8").split("\n")[3].strip()
            with self.subTest(bestand=naam):
                self.assertIn(stuk, index,
                              f"web/{naam} is gewijzigd; draai tools/bouw_webapp.py opnieuw")
        self.assertNotIn("/*__", index, "onvervangen plaatshouder")

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

    def test_de_drie_ingangen_zijn_bereikbaar(self):
        """Een Artifact draait in een sandbox-iframe waar een sprong naar een
        ander document niet doorheen komt. De ingangen moeten daarom in hetzelfde
        document liggen, bereikbaar via de hash."""
        index = (WORTEL / "web" / "index.html").read_text("utf-8")
        for scherm in ("s-landing", "s-dash", "s-beheer"):
            self.assertIn(f'id="{scherm}"', index, f"{scherm} ontbreekt in het document")
        self.assertIn('href="#aanvraag"', index)
        self.assertIn('href="#beheer"', index)
        # Geen enkele link mag naar een ander document springen.
        self.assertNotIn('href="aanvraag.html"', index)
        self.assertNotIn('href="beheer.html"', index)

        # De eigen adressen blijven bestaan als doorverwijzing.
        for bestand, hash_ in (("aanvraag.html", "#aanvraag"), ("beheer.html", "#beheer")):
            inhoud = (WORTEL / "web" / bestand).read_text("utf-8")
            with self.subTest(ingang=bestand):
                self.assertIn(f'location.replace("index.html{hash_}")', inhoud)
                self.assertIn(f'url=index.html{hash_}', inhoud)


if __name__ == "__main__":
    unittest.main(verbosity=2)
