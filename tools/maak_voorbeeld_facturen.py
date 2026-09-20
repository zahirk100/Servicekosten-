#!/usr/bin/env python3
"""Maakt pdf-versies van de drie voorbeeldafrekeningen.

Geen typemachine-uitdraai maar de opmaak van een echte factuur: een briefhoofd,
een adresblok, een tabel met uitgelijnde kolommen en een totalenblok. Elke cel is
een eigen tekstobject, net als in een pdf uit een boekhoudpakket, zodat dit ook
werkelijk test wat de tekstextractie van de applicatie ervan maakt.

De bedragen komen overeen met de .txt-versies; tests/test_voorbeelden.py bewaakt
dat de twee hetzelfde opleveren.

    python3 tools/maak_voorbeeld_facturen.py
"""

from __future__ import annotations

from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

WORTEL = Path(__file__).resolve().parent.parent
DOEL = WORTEL / "voorbeelden"

FACTUREN = [
    {
        "bestand": "voorbeeld-1-klopt-2024.pdf",
        "verhuurder": ["Woningstichting Groenehof", "Parklaan 3", "3500 CD Utrecht",
                       "KvK 30123456  ·  info@groenehof.nl"],
        "huurder": ["M. de Vries", "Wilgenhof 12-B", "3500 AB Utrecht"],
        "kenmerken": [("Factuurnummer", "SK-2024-1187"), ("Datum", "22 april 2025"),
                      ("Complex", "Wilgenhof, 32 woonruimten"),
                      ("Periode", "1 januari 2024 tot en met 31 december 2024")],
        "regels": [
            ("Schoonmaak gemeenschappelijke ruimten", "5.952,00", "186,00"),
            ("Warmte gemeenschappelijke ruimten", "3.072,00", "96,00"),
            ("Huisvuil en containerreiniging", "2.304,00", "72,00"),
            ("Elektriciteit algemene ruimten", "1.728,00", "54,00"),
            ("Kabeltelevisie centrale antenne", "1.536,00", "48,00"),
            ("Glasverzekering", "1.152,00", "36,00"),
            ("Lampen vervangen algemene ruimten", "768,00", "24,00"),
            ("Ongediertebestrijding", "576,00", "18,00"),
        ],
        "totaal": "534,00",
        "voorschot": ("Betaald voorschot 2024 (12 x EUR 46,00)", "552,00"),
        "saldo": ("Terug te ontvangen", "18,00"),
        "slot": ["Bijlagen: specificatieformulier en kopieen van alle onderliggende facturen.",
                 "Bezwaar tegen deze afrekening kunt u schriftelijk indienen."],
    },
    {
        "bestand": "voorbeeld-2-te-veel-gerekend-2024.pdf",
        "verhuurder": ["Vastgoedbeheer Meidoorn B.V.", "Handelsweg 44", "5600 AA Eindhoven",
                       "KvK 17654321  ·  beheer@meidoornvastgoed.nl"],
        "huurder": ["K. Bakker", "Meidoornflat 207", "5600 CD Eindhoven"],
        "kenmerken": [("Factuurnummer", "2024-SK-0207"), ("Datum", "3 juni 2025"),
                      ("Complex", "Meidoornflat, 60 woonruimten"),
                      ("Periode", "1 januari 2024 tot en met 31 december 2024")],
        "regels": [
            ("Schoonmaak gemeenschappelijke ruimten", "12.600,00", "210,00"),
            ("Elektriciteit algemene ruimten", "3.900,00", "65,00"),
            ("Glasbewassing buitenzijde", "5.400,00", "90,00"),
            ("Onderhoudscontract cv met 24-uursservice", "6.600,00", "110,00"),
            ("Opstalverzekering", "5.280,00", "88,00"),
            ("Leegstandsderving servicekosten", "7.200,00", "120,00"),
            ("Rioolheffing", "7.800,00", "130,00"),
        ],
        "totaal": "813,00",
        "voorschot": ("Betaald voorschot 2024 (12 x EUR 80,00)", "960,00"),
        "saldo": ("Terug te ontvangen", "147,00"),
        "slot": ["Bijlagen: specificatieformulier en kopieen van alle onderliggende facturen.",
                 "Bezwaar tegen deze afrekening kunt u schriftelijk indienen."],
    },
    {
        "bestand": "voorbeeld-3-geen-onderbouwing-2024.pdf",
        "verhuurder": ["Beheer & Verhuur Lijsterbes", "Stationsstraat 9", "9700 BB Groningen",
                       "KvK 02998877"],
        "huurder": ["S. El Amrani", "Lijsterbeshof 5-1", "9700 AD Groningen"],
        "kenmerken": [("Datum", "11 juli 2025"),
                      ("Periode", "1 januari 2024 tot en met 31 december 2024")],
        "regels": [
            ("Schoonmaak gemeenschappelijke ruimten", None, "240,00"),
            ("Elektriciteit algemene ruimten", None, "108,00"),
            ("Huisvuil en containerreiniging", None, "96,00"),
            ("Kabeltelevisie centrale antenne", None, "60,00"),
            ("Lampen vervangen algemene ruimten", None, "36,00"),
            ("Ongediertebestrijding", None, "24,00"),
        ],
        "totaal": "564,00",
        "voorschot": ("Betaald voorschot 2024 (12 x EUR 50,00)", "600,00"),
        "saldo": ("Terug te ontvangen", "36,00"),
        "slot": ["Een specificatie per kostenpost is op aanvraag beschikbaar."],
    },
]

LINKS = 20 * mm
RECHTS = 190 * mm
KOL_COMPLEX = 143 * mm
KOL_AANDEEL = RECHTS


def lijn(doek, y, dik=0.4, kleur=0.75):
    doek.setStrokeGray(kleur)
    doek.setLineWidth(dik)
    doek.line(LINKS, y, RECHTS, y)


def teken(doek, f):
    _, hoogte = A4
    y = hoogte - 24 * mm

    # Briefhoofd
    doek.setFont("Helvetica-Bold", 14)
    doek.drawString(LINKS, y, f["verhuurder"][0])
    doek.setFont("Helvetica", 8.5)
    doek.setFillGray(0.35)
    for regel in f["verhuurder"][1:]:
        y -= 4.6 * mm
        doek.drawString(LINKS, y, regel)
    doek.setFillGray(0)

    y -= 14 * mm
    doek.setFont("Helvetica-Bold", 12)
    doek.drawString(LINKS, y, "AFREKENING SERVICEKOSTEN 2024")

    # Adresblok links, kenmerken rechts
    y -= 9 * mm
    top = y
    doek.setFont("Helvetica", 8)
    doek.setFillGray(0.4)
    doek.drawString(LINKS, y, "HUURDER")
    doek.setFillGray(0)
    doek.setFont("Helvetica", 9.5)
    for regel in f["huurder"]:
        y -= 4.8 * mm
        doek.drawString(LINKS, y, regel)

    yk = top
    for naam, waarde in f["kenmerken"]:
        doek.setFont("Helvetica", 8)
        doek.setFillGray(0.4)
        doek.drawString(110 * mm, yk, naam)
        doek.setFillGray(0)
        doek.setFont("Helvetica", 9.5)
        doek.drawRightString(RECHTS, yk, waarde)
        yk -= 5.2 * mm

    y = min(y, yk) - 10 * mm

    # Tabelkop
    doek.setFont("Helvetica", 8)
    doek.setFillGray(0.4)
    doek.drawString(LINKS, y, "OMSCHRIJVING")
    if any(r[1] for r in f["regels"]):
        doek.drawRightString(KOL_COMPLEX, y, "TOTAAL COMPLEX")
    doek.drawRightString(KOL_AANDEEL, y, "UW AANDEEL")
    doek.setFillGray(0)
    y -= 2.5 * mm
    lijn(doek, y, dik=0.8, kleur=0.2)

    # Regels
    for omschrijving, complextotaal, aandeel in f["regels"]:
        y -= 7 * mm
        doek.setFont("Helvetica", 9.5)
        doek.drawString(LINKS, y, omschrijving)
        if complextotaal:
            doek.drawRightString(KOL_COMPLEX, y, "EUR " + complextotaal)
        doek.drawRightString(KOL_AANDEEL, y, "EUR " + aandeel)
        y -= 2.2 * mm
        lijn(doek, y)

    # Totalen
    y -= 7.5 * mm
    doek.setFont("Helvetica-Bold", 10)
    doek.drawString(LINKS, y, "Totaal servicekosten")
    doek.drawRightString(KOL_AANDEEL, y, "EUR " + f["totaal"])
    y -= 6.5 * mm
    doek.setFont("Helvetica", 9.5)
    doek.drawString(LINKS, y, f["voorschot"][0])
    doek.drawRightString(KOL_AANDEEL, y, "EUR " + f["voorschot"][1])
    y -= 3 * mm
    lijn(doek, y, dik=0.8, kleur=0.2)
    y -= 6.5 * mm
    doek.setFont("Helvetica-Bold", 10)
    doek.drawString(LINKS, y, f["saldo"][0])
    doek.drawRightString(KOL_AANDEEL, y, "EUR " + f["saldo"][1])

    # Slot
    y -= 14 * mm
    doek.setFont("Helvetica", 8.5)
    doek.setFillGray(0.35)
    for regel in f["slot"]:
        doek.drawString(LINKS, y, regel)
        y -= 4.6 * mm
    doek.setFillGray(0)


def main() -> int:
    DOEL.mkdir(exist_ok=True)
    for f in FACTUREN:
        pad = DOEL / f["bestand"]
        doek = canvas.Canvas(str(pad), pagesize=A4)
        doek.setTitle("Afrekening servicekosten 2024")
        doek.setAuthor(f["verhuurder"][0])
        teken(doek, f)
        doek.save()
        print("geschreven:", pad)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
