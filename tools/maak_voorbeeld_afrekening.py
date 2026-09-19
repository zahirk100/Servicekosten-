#!/usr/bin/env python3
"""Genereert voorbeeldafrekeningen (PDF en CSV) om de parser mee te testen.

Dit zijn fictieve documenten. Ze bootsen na hoe een verhuurder een afrekening
opmaakt: kolommen met complextotaal en aandeel, leiderpuntjes, een voorschotregel
en een saldoregel.
"""

from __future__ import annotations

import csv
from pathlib import Path

WORTEL = Path(__file__).resolve().parent.parent
DOEL = WORTEL / "voorbeelden"

REGELS = [
    ("Schoonmaak gemeenschappelijke ruimten", "10.080,00", "210,00"),
    ("Glasbewassing buitenzijde", "4.320,00", "90,00"),
    ("Huismeester", "34.000,00", "226,67"),
    ("Tuinonderhoud binnentuin", "5.760,00", "120,00"),
    ("Opstalverzekering", "4.224,00", "88,00"),
    ("Glasverzekering (onderdeel opstalpolis)", "2.304,00", "48,00"),
    ("Gemeenschappelijke wasmachines en wasdrogers", "4.032,00", "84,00"),
    ("Onderhoudscontract cv met 24-uursservice", "5.280,00", "110,00"),
    ("Leegstandsderving servicekosten", "5.760,00", "120,00"),
    ("Rioolheffing", "6.240,00", "130,00"),
    ("Elektriciteit algemene ruimten", "3.120,00", "65,00"),
    ("Administratiekosten", "4.560,00", "95,00"),
]

KOP = [
    "Woonstichting De Meidoorn",
    "Postbus 118, 1000 AB Amsterdam",
    "",
    "AFREKENING SERVICEKOSTEN 2024",
    "",
    "Huurder:        J. van Dijk",
    "Adres:          Kastanjelaan 42-3, 1000 AB Amsterdam",
    "Complex:        Kastanjehof, 48 woonruimten",
    "Periode:        1 januari 2024 tot en met 31 december 2024",
    "Factuurnummer:  SK-2024-0442",
    "Datum:          14 mei 2025",
    "",
]

VOET_TOTAAL = "1.386,67"
VOET_VOORSCHOT = "1.800,00"
VOET_SALDO = "413,33"


def tekstregels() -> list[str]:
    regels = list(KOP)
    regels.append(f"{'Omschrijving':<48}{'Totaal complex':>16}{'Uw aandeel':>14}")
    regels.append("-" * 78)
    for omschrijving, totaal, aandeel in REGELS:
        regels.append(f"{omschrijving:.<48}{'EUR ' + totaal:>16}{'EUR ' + aandeel:>14}")
    regels.append("-" * 78)
    regels.append(f"{'Totaal servicekosten':<48}{'':>16}{'EUR ' + VOET_TOTAAL:>14}")
    regels.append(f"{'Betaald voorschot 2024 (12 x EUR 150,00)':<48}{'':>16}{'EUR ' + VOET_VOORSCHOT:>14}")
    regels.append(f"{'Terug te ontvangen':<48}{'':>16}{'EUR ' + VOET_SALDO:>14}")
    regels.append("")
    regels.append("Meterstanden warmte: beginstand 14.320  eindstand 17.110")
    regels.append("")
    regels.append("Bezwaar tegen deze afrekening kunt u binnen zes weken schriftelijk indienen.")
    return regels


def schrijf_txt() -> Path:
    pad = DOEL / "voorbeeld-afrekening-2024.txt"
    pad.write_text("\n".join(tekstregels()) + "\n", encoding="utf-8")
    return pad


def schrijf_csv() -> Path:
    pad = DOEL / "voorbeeld-afrekening-2024.csv"
    with pad.open("w", encoding="utf-8", newline="") as fh:
        schrijver = csv.writer(fh, delimiter=";")
        schrijver.writerow(["Afrekening servicekosten 2024 - Kastanjelaan 42-3"])
        schrijver.writerow(["Omschrijving", "Totaal complex", "Uw aandeel"])
        for rij in REGELS:
            schrijver.writerow(rij)
        schrijver.writerow(["Totaal servicekosten", "", VOET_TOTAAL])
        schrijver.writerow(["Betaald voorschot", "", VOET_VOORSCHOT])
    return pad


def schrijf_pdf() -> Path | None:
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
    except ImportError:
        return None
    pad = DOEL / "voorbeeld-afrekening-2024.pdf"
    doek = canvas.Canvas(str(pad), pagesize=A4)
    breedte, hoogte = A4
    y = hoogte - 60
    for regel in tekstregels():
        if regel.startswith("AFREKENING"):
            doek.setFont("Helvetica-Bold", 13)
        elif set(regel.strip()) == {"-"}:
            doek.setFont("Courier", 9)
        else:
            doek.setFont("Courier", 9)
        doek.drawString(50, y, regel)
        y -= 14
        if y < 60:
            doek.showPage()
            y = hoogte - 60
    doek.save()
    return pad


if __name__ == "__main__":
    DOEL.mkdir(exist_ok=True)
    for pad in (schrijf_txt(), schrijf_csv(), schrijf_pdf()):
        print("geschreven:", pad if pad else "(PDF overgeslagen: reportlab ontbreekt)")
