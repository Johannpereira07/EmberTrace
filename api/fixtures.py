"""`make fixtures`: write contracts/fixtures/*.json (H3 mocks) from the live API on the loaded dataset.

The responses are whatever the configured data gives: nothing is edited or invented here. Run it again
whenever the data or the API changes; `make contract-test` fails if the files are stale.
"""
import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient

FIXTURE_DIR = Path(__file__).resolve().parent.parent / "contracts" / "fixtures"

# name -> (path, request body). Normal = API spec example area; sparse = one cell; error = spec A.3.
FIXTURES = {
    "normal": ("/api/calendar", {"aoi": {"type": "bbox", "min_lat": 20.8, "max_lat": 21.6,
                                         "min_lon": 78.5, "max_lon": 79.5}}),
    "sparse": ("/api/calendar", {"aoi": {"type": "bbox", "min_lat": 20.8, "max_lat": 20.9,
                                         "min_lon": 78.55, "max_lon": 78.7}}),
    "error": ("/api/calendar", {"aoi": {"type": "bbox", "min_lat": 25, "max_lat": 20,
                                        "min_lon": 78.5, "max_lon": 79.5}}),
}


def render(client: TestClient) -> dict[str, str]:
    """Fixture file name -> JSON text, as served by the API right now."""
    files = {"meta.json": client.get("/api/meta").json()}
    for name, (path, body) in FIXTURES.items():
        files[f"{name}.json"] = client.post(path, json=body).json()   # body only, as the frontend sees it
    return {k: json.dumps(v, indent=2) + "\n" for k, v in files.items()}


def main() -> int:
    from .main import app
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    with TestClient(app) as client:
        for name, text in render(client).items():
            (FIXTURE_DIR / name).write_text(text)
            print("wrote", FIXTURE_DIR / name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
