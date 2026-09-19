"""CLI: python3 -m engine <dossier.json> [<dossier.json> ...]"""

from __future__ import annotations

import sys
from pathlib import Path

from .dossier_io import laad_dossier
from .motor import beoordeel_dossier
from .rapport import meerjarenoverzicht, rapport


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__)
        return 1
    uitkomsten = []
    for pad in argv:
        dossier = laad_dossier(pad)
        uitkomst = beoordeel_dossier(dossier)
        uitkomsten.append(uitkomst)
        print(rapport(uitkomst, titel=dossier.referentie or Path(pad).stem))
    if len(uitkomsten) > 1:
        print("### Meerjarenoverzicht")
        print()
        print(meerjarenoverzicht(uitkomsten))
        print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
