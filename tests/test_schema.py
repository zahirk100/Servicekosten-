"""Controleert dat alle dossiers uit tests/cases voldoen aan schema/dossier.schema.json."""

import json
import unittest
from pathlib import Path

WORTEL = Path(__file__).resolve().parent.parent


class Schema(unittest.TestCase):
    def test_alle_casussen_zijn_valide(self):
        try:
            import jsonschema
        except ImportError:
            self.skipTest("jsonschema niet geïnstalleerd (pip install jsonschema)")
        schema = json.loads((WORTEL / "schema" / "dossier.schema.json").read_text(encoding="utf-8"))
        paden = sorted((WORTEL / "tests" / "cases").rglob("*.json"))
        self.assertTrue(paden, "geen casusbestanden gevonden")
        for pad in paden:
            with self.subTest(dossier=pad.name):
                jsonschema.validate(json.loads(pad.read_text(encoding="utf-8")), schema)

    def test_normen_en_beslisregels_zijn_geldige_json(self):
        for naam in ("normen.json", "beslisregels.json"):
            json.loads((WORTEL / "data" / naam).read_text(encoding="utf-8"))

    def test_elke_regel_in_de_code_staat_in_de_regeltabel(self):
        import re
        tabel = {r["id"] for r in json.loads(
            (WORTEL / "data" / "beslisregels.json").read_text(encoding="utf-8"))["regels"]}
        bron = "".join((WORTEL / "engine" / naam).read_text(encoding="utf-8")
                       for naam in ("regels.py", "motor.py"))
        gebruikt = set(re.findall(r'"(R-[A-Z]+-\d+|R-SK-OPEN)"', bron))
        self.assertEqual(gebruikt - tabel, set(), "regel-ID's in de code ontbreken in data/beslisregels.json")


if __name__ == "__main__":
    unittest.main(verbosity=2)
