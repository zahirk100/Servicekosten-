"""Tests voor het inlezen en classificeren van een afrekening."""

import sys
import unittest
from decimal import Decimal
from pathlib import Path

WORTEL = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WORTEL))

from app.parsers import DocumentFout, lees_document, parse_afrekening  # noqa: E402
from app.parsers.bedragen import naar_decimal, vind_bedragen, vind_jaar, vind_periode  # noqa: E402
from app.parsers.classificatie import classificeer, is_negeerregel  # noqa: E402

VOORBEELDEN = WORTEL / "voorbeelden"


class Bedragen(unittest.TestCase):
    def test_nederlandse_notatie(self):
        gevallen = {
            "€ 1.234,56": "1234.56", "1234,56": "1234.56", "€ 85,-": "85",
            "1.200": "1200", "0,29": "0.29", "-/- 120,00": "-120.00",
            "2.437,31": "2437.31", "EUR 7.200,00": "7200.00",
        }
        for tekst, verwacht in gevallen.items():
            with self.subTest(tekst=tekst):
                self.assertEqual(naar_decimal(tekst), Decimal(verwacht))

    def test_jaartallen_zijn_geen_bedrag(self):
        self.assertEqual(vind_bedragen("Afrekening servicekosten 2024"), [])

    def test_huisnummer_met_toevoeging_is_geen_bedrag(self):
        self.assertEqual(vind_bedragen("Kastanjelaan 42-3"), [])

    def test_getal_in_woord_is_geen_bedrag(self):
        """'24-uursservice' mag de omschrijving niet afkappen."""
        self.assertEqual(
            vind_bedragen("Onderhoudscontract cv met 24-uursservice EUR 110,00"),
            [Decimal("110.00")],
        )

    def test_postcode_is_geen_bedrag(self):
        self.assertEqual(vind_bedragen("Postbus 118, 1000 AB Amsterdam"), [Decimal("118")])

    def test_alle_bedragen_in_leesvolgorde(self):
        self.assertEqual(
            vind_bedragen("Schoonmaak   € 7.200,00    € 180,00"),
            [Decimal("7200.00"), Decimal("180.00")],
        )

    def test_periode_uit_tekst(self):
        self.assertEqual(vind_periode("van 1 januari 2024 tot en met 31 mei 2024"), (1, 5))
        self.assertEqual(vind_periode("01-03-2025 t/m 31-08-2025"), (3, 8))

    def test_jaar_uit_tekst(self):
        self.assertEqual(vind_jaar("AFREKENING SERVICEKOSTEN 2024"), 2024)


class Classificatie(unittest.TestCase):
    def test_eenduidige_posten(self):
        gevallen = {
            "Huismeester": "SK-06",
            "Opstalverzekering": "SK-09-OPSTAL",
            "Glasbewassing buitenzijde": "SK-04-GLAS",
            "Rioolheffing": "NSK-02",
            "Leegstandsderving": "NSK-01",
            "Administratiekosten": "SK-11",
            "Onderhoudscontract cv met 24-uursservice": "SK-12",
        }
        for omschrijving, verwacht in gevallen.items():
            with self.subTest(omschrijving=omschrijving):
                self.assertEqual(classificeer(omschrijving)["categorie"], verwacht)

    def test_onderwerp_wint_van_plaatsbepaling(self):
        """'Schoonmaak gemeenschappelijke ruimten' is schoonmaak, geen verzamelpost."""
        self.assertEqual(
            classificeer("Schoonmaak gemeenschappelijke ruimten")["categorie"],
            "SK-04-SCHOONMAAK",
        )

    def test_algemene_ruimten_bij_nutsvoorziening(self):
        self.assertEqual(classificeer("Elektriciteit algemene ruimten")["categorie"], "SK-02")

    def test_onbekende_post_wordt_niet_geraden(self):
        uitkomst = classificeer("Diverse posten volgens opgave")
        self.assertIsNone(uitkomst["categorie"])
        self.assertIn("niet limitatief", uitkomst["vraag"])

    def test_negeerregels(self):
        for regel in ("Totaal servicekosten", "Betaald voorschot", "Terug te ontvangen", "Postbus"):
            with self.subTest(regel=regel):
                self.assertTrue(is_negeerregel(regel))
        self.assertFalse(is_negeerregel("Huismeester"))


class Documenten(unittest.TestCase):
    def test_onbekende_extensie_geeft_uitlegbare_fout(self):
        with self.assertRaises(DocumentFout) as vangst:
            lees_document(b"x", "afrekening.docx")
        self.assertIn("niet ondersteund", str(vangst.exception))

    def test_lege_pdf_meldt_scan(self):
        with self.assertRaises(DocumentFout):
            lees_document(b"%PDF-1.4 niets", "leeg.pdf")


class Afrekening(unittest.TestCase):
    def _parse(self, naam):
        pad = VOORBEELDEN / naam
        if not pad.exists():
            self.skipTest(f"{naam} ontbreekt; draai tools/maak_voorbeeld_afrekening.py")
        tekst, metadata = lees_document(pad.read_bytes(), naam)
        return parse_afrekening(tekst, metadata)

    def test_pdf_levert_twaalf_geclassificeerde_posten(self):
        dossier = self._parse("voorbeeld-afrekening-2024.pdf")
        self.assertEqual(len(dossier.posten), 12)
        self.assertEqual([p for p in dossier.posten if p.categorie is None], [])

    def test_csv_geeft_dezelfde_posten_als_pdf(self):
        pdf = self._parse("voorbeeld-afrekening-2024.pdf")
        csv = self._parse("voorbeeld-afrekening-2024.csv")
        self.assertEqual(
            [(p.categorie, p.bedrag) for p in pdf.posten],
            [(p.categorie, p.bedrag) for p in csv.posten],
        )

    def test_metagegevens(self):
        dossier = self._parse("voorbeeld-afrekening-2024.pdf")
        self.assertEqual(dossier.jaar, 2024)
        self.assertEqual(dossier.voorschot, Decimal("1800.00"))
        self.assertEqual(dossier.aantal_woonruimten, 48)
        self.assertEqual(dossier.meterstanden["beginstand"], Decimal("14320"))

    def test_totaal_en_voorschotregels_worden_niet_als_post_geteld(self):
        dossier = self._parse("voorbeeld-afrekening-2024.pdf")
        omschrijvingen = " ".join(p.omschrijving.lower() for p in dossier.posten)
        for woord in ("totaal", "voorschot", "terug te ontvangen", "postbus"):
            self.assertNotIn(woord, omschrijvingen)

    def test_laatste_bedrag_is_het_aandeel_van_de_huurder(self):
        dossier = self._parse("voorbeeld-afrekening-2024.pdf")
        huismeester = next(p for p in dossier.posten if p.categorie == "SK-06")
        self.assertEqual(huismeester.bedrag, Decimal("226.67"))
        self.assertIn(Decimal("34000.00"), huismeester.alternatieve_bedragen)


if __name__ == "__main__":
    unittest.main(verbosity=2)
