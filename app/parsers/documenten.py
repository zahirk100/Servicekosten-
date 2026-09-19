"""Een geüpload document omzetten naar platte tekst."""

from __future__ import annotations

import csv
import io
from pathlib import Path

TOEGESTANE_EXTENSIES = {".pdf", ".txt", ".csv", ".tsv", ".md"}
MAX_BYTES = 20 * 1024 * 1024


class DocumentFout(ValueError):
    """Het document kan niet worden gelezen; de melding is bedoeld voor de gebruiker."""


def lees_document(inhoud: bytes, bestandsnaam: str) -> tuple[str, dict]:
    """Geeft (tekst, metadata). Werpt DocumentFout met een uitlegbare melding."""
    if len(inhoud) > MAX_BYTES:
        raise DocumentFout(
            f"Het bestand is groter dan {MAX_BYTES // (1024 * 1024)} MB. "
            "Upload alleen de afrekening zelf, niet het hele dossier."
        )
    extensie = Path(bestandsnaam).suffix.lower()
    if extensie not in TOEGESTANE_EXTENSIES:
        raise DocumentFout(
            f"Bestandstype {extensie or '(onbekend)'} wordt niet ondersteund. "
            f"Ondersteund: {', '.join(sorted(TOEGESTANE_EXTENSIES))}. "
            "Een foto of scan kunt u eerst omzetten naar doorzoekbare PDF."
        )
    if extensie == ".pdf":
        return _lees_pdf(inhoud, bestandsnaam)
    if extensie in {".csv", ".tsv"}:
        return _lees_csv(inhoud, bestandsnaam, extensie)
    return _lees_tekst(inhoud, bestandsnaam)


def _decodeer(inhoud: bytes) -> str:
    for codering in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            return inhoud.decode(codering)
        except UnicodeDecodeError:
            continue
    raise DocumentFout("De tekstcodering van het bestand kon niet worden bepaald.")


def _lees_tekst(inhoud: bytes, bestandsnaam: str) -> tuple[str, dict]:
    tekst = _decodeer(inhoud)
    return tekst, {"bestandsnaam": bestandsnaam, "soort": "tekst", "paginas": 1}


def _lees_csv(inhoud: bytes, bestandsnaam: str, extensie: str) -> tuple[str, dict]:
    rauw = _decodeer(inhoud)
    scheiding = "\t" if extensie == ".tsv" else None
    if scheiding is None:
        try:
            scheiding = csv.Sniffer().sniff(rauw[:4096], delimiters=",;\t|").delimiter
        except csv.Error:
            scheiding = ";" if rauw.count(";") > rauw.count(",") else ","
    regels = ["   ".join(cel.strip() for cel in rij if cel is not None)
              for rij in csv.reader(io.StringIO(rauw), delimiter=scheiding)]
    return "\n".join(regels), {
        "bestandsnaam": bestandsnaam, "soort": "csv", "scheidingsteken": scheiding,
        "regels": len(regels),
    }


def _lees_pdf(inhoud: bytes, bestandsnaam: str) -> tuple[str, dict]:
    try:
        from pypdf import PdfReader
    except ImportError as exc:  # pragma: no cover
        raise DocumentFout("PDF-ondersteuning ontbreekt; installeer pypdf.") from exc
    try:
        lezer = PdfReader(io.BytesIO(inhoud))
    except Exception as exc:
        raise DocumentFout(f"De PDF kon niet worden geopend: {exc}") from exc
    if getattr(lezer, "is_encrypted", False):
        try:
            lezer.decrypt("")
        except Exception as exc:
            raise DocumentFout("De PDF is met een wachtwoord beveiligd.") from exc
    paginas = [(p.extract_text() or "") for p in lezer.pages]
    tekst = "\n".join(paginas)
    if len(tekst.strip()) < 40:
        raise DocumentFout(
            "Uit deze PDF komt geen tekst. Waarschijnlijk is het een scan of foto. "
            "Maak er eerst een doorzoekbare PDF van (OCR), of voer de posten handmatig in."
        )
    return tekst, {"bestandsnaam": bestandsnaam, "soort": "pdf", "paginas": len(paginas)}
