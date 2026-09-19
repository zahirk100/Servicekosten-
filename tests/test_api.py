"""Tests voor de HTTP-API."""

import json
import sys
import unittest
from pathlib import Path

WORTEL = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WORTEL))


def _client():
    try:
        from fastapi.testclient import TestClient
    except Exception as exc:  # fastapi of httpx ontbreekt
        raise unittest.SkipTest(f"API-afhankelijkheden ontbreken: {exc}")
    from app.main import app
    return TestClient(app)


class Api(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = _client()

    def test_gezondheid(self):
        antwoord = self.client.get("/api/gezondheid")
        self.assertEqual(antwoord.status_code, 200)
        self.assertEqual(antwoord.json()["beleidsboek"], "1 juli 2026")

    def test_meta_sluit_aan_op_de_engine(self):
        from engine.regels import HANDLERS
        data = self.client.get("/api/meta").json()
        self.assertEqual(set(data["categorieen"]), set(HANDLERS))
        self.assertEqual(data["beschikbare_jaren"], ["2023", "2024", "2025"])
        self.assertGreaterEqual(data["aantal_regels"], 76)

    def test_upload_voorbeeld(self):
        pad = WORTEL / "voorbeelden" / "voorbeeld-afrekening-2024.pdf"
        if not pad.exists():
            self.skipTest("voorbeeld-PDF ontbreekt")
        antwoord = self.client.post(
            "/api/upload",
            files={"bestand": (pad.name, pad.read_bytes(), "application/pdf")},
        )
        self.assertEqual(antwoord.status_code, 200)
        concept = antwoord.json()["concept"]
        self.assertEqual(len(concept["posten"]), 12)
        self.assertEqual(concept["jaar"], 2024)

    def test_upload_weigert_onbekend_bestandstype(self):
        antwoord = self.client.post(
            "/api/upload", files={"bestand": ("x.docx", b"abc", "application/octet-stream")})
        self.assertEqual(antwoord.status_code, 422)
        self.assertIn("niet ondersteund", antwoord.json()["detail"])

    def test_beoordeel_casus_vier(self):
        dossier = json.loads(
            (WORTEL / "tests" / "cases" / "casus-4-meerdere-foutieve-posten.json").read_text("utf-8"))
        antwoord = self.client.post("/api/beoordeel", json=dossier)
        self.assertEqual(antwoord.status_code, 200)
        data = antwoord.json()
        self.assertEqual(data["financieel"]["potentiele_correctie"], "746.70")
        self.assertEqual(data["financieel"]["buiten_bevoegdheid"], "130.00")
        self.assertEqual(data["tellingen"]["BUITEN_BEVOEGDHEID"], 1)

    def test_beoordeel_weigert_onzin(self):
        antwoord = self.client.post("/api/beoordeel", json={"periode": {}})
        self.assertEqual(antwoord.status_code, 422)

    def test_jaar_zonder_normen_geeft_uitlegbare_fout(self):
        """Het beleidsboek kent geen Nibud-gegevens voor 2026: geen schatting, wel uitleg."""
        dossier = {
            "woonruimte": {"zelfstandig": True, "woningtype": "flatwoning_appartement"},
            "periode": {"jaar": 2026},
            "kostenposten": [{
                "id": "P1", "categorie": "NUT-GAS-METER", "omschrijving": "Gas",
                "bedrag_verhuurder": "900.00", "overeengekomen": True, "bewijs": ["facturen"],
                "parameters": {},
            }],
        }
        antwoord = self.client.post("/api/beoordeel", json=dossier)
        self.assertEqual(antwoord.status_code, 200)
        bevinding = antwoord.json()["beoordelingen"][0]
        self.assertEqual(bevinding["status"], "ORANJE")
        self.assertTrue(any("2026" in v for v in bevinding["ontbrekende_informatie"]))

    def test_bezwaarbrief(self):
        dossier = json.loads(
            (WORTEL / "tests" / "cases" / "casus-2-eenvoudige-foutieve-afrekening.json").read_text("utf-8"))
        antwoord = self.client.post("/api/brief", json={"soort": "bezwaar", "dossier": dossier})
        self.assertEqual(antwoord.status_code, 200)
        self.assertIn("Posten waartegen ik bezwaar maak", antwoord.text)
        self.assertIn("Huismeester", antwoord.text)

    def test_opvraagbrief(self):
        antwoord = self.client.post("/api/brief", json={"soort": "opvraag", "jaar": 2024})
        self.assertEqual(antwoord.status_code, 200)
        self.assertIn("artikel 7:259 lid 2 BW", antwoord.text)

    def test_interface_wordt_geserveerd(self):
        antwoord = self.client.get("/")
        self.assertEqual(antwoord.status_code, 200)
        self.assertIn("Servicekosten-audit", antwoord.text)


if __name__ == "__main__":
    unittest.main(verbosity=2)
