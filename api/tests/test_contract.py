"""`make contract-test` (API-8): mock files = live API = types.ts."""
import json
import re

import pytest
from fastapi.testclient import TestClient
from pydantic import BaseModel

from api import models
from api.fixtures import FIXTURE_DIR, FIXTURES, render
from api.main import create_app

from .conftest import ROOT, settings

TYPES_TS = ROOT / "contracts" / "api" / "types.ts"
# pydantic model -> TypeScript interface of the same shape
TS_NAME = {models.Month: "MonthRow", models.Warning: "ApiWarning"}
SHAPES = [models.CalendarRequest, models.Bbox, models.Coverage, models.GridExtent, models.Baseline,
          models.CalendarMeta, models.Month, models.MonthRange, models.Warning, models.CalendarResponse,
          models.MetaResponse, models.HealthResponse, models.ErrorBody, models.ErrorResponse]


def ts_interfaces() -> dict[str, set[str]]:
    text = TYPES_TS.read_text()
    out = {}
    for name, body in re.findall(r"export interface (\w+) \{(.*?)\n\}", text, re.S):
        out[name] = set(re.findall(r"^\s+(\w+)\??:", body, re.M))
    return out


@pytest.mark.parametrize("model", SHAPES, ids=lambda m: m.__name__)
def test_types_ts_matches_models(model: type[BaseModel]):
    fields = {f.alias or name for name, f in model.model_fields.items()}
    assert ts_interfaces()[TS_NAME.get(model, model.__name__)] == fields


def test_fixture_files_match_live_api(sample_ds, tmp_path):
    with TestClient(create_app(settings(tmp_path), dataset=sample_ds)) as client:
        live = render(client)
    for name, text in live.items():
        path = FIXTURE_DIR / name
        assert path.exists(), f"{path} missing: run `make fixtures`"
        assert json.loads(path.read_text()) == json.loads(text), f"{name} is stale: run `make fixtures`"


@pytest.mark.parametrize("name", list(FIXTURES))
def test_fixtures_validate_against_models(name):
    body = json.loads((FIXTURE_DIR / f"{name}.json").read_text())
    model = models.ErrorResponse if "error" in body else models.CalendarResponse
    model.model_validate(body)
