"""python3 -m app  ->  start de webapplicatie op http://127.0.0.1:8000"""

from __future__ import annotations

import argparse


def main() -> int:
    parser = argparse.ArgumentParser(description="Start het servicekosten-auditmodel.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--reload", action="store_true", help="herstart bij codewijzigingen")
    argumenten = parser.parse_args()

    import uvicorn

    print(f"Servicekosten-auditmodel -> http://{argumenten.host}:{argumenten.port}")
    uvicorn.run("app.main:app", host=argumenten.host, port=argumenten.port, reload=argumenten.reload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
