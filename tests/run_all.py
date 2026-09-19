#!/usr/bin/env python3
"""Draait alle tests: python3 tests/run_all.py"""

import sys
import unittest
from pathlib import Path

WORTEL = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WORTEL))

if __name__ == "__main__":
    suite = unittest.defaultTestLoader.discover(str(WORTEL / "tests"), pattern="test_*.py")
    resultaat = unittest.TextTestRunner(verbosity=2).run(suite)
    raise SystemExit(0 if resultaat.wasSuccessful() else 1)
