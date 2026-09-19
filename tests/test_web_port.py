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

    def test_gebouwde_pagina_is_actueel(self):
        """web/index.html moet de huidige bronbestanden bevatten."""
        pagina = (WORTEL / "web" / "index.html").read_text("utf-8")
        for bestand in ("kern.js", "parser.js", "ui.js"):
            bron = (WORTEL / "web" / bestand).read_text("utf-8").replace("</script>", "<\\/script>")
            with self.subTest(bestand=bestand):
                self.assertIn(bron.strip()[:400], pagina,
                              f"web/{bestand} is gewijzigd; draai tools/bouw_webapp.py opnieuw")
        for plaatshouder in ("/*__STIJL__*/", "/*__DATA__*/", "/*__KERN__*/"):
            self.assertNotIn(plaatshouder, pagina)


if __name__ == "__main__":
    unittest.main(verbosity=2)
