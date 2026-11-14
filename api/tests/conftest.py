"""Shared test inputs.

`sample`: the stand-in pipeline output in contracts/samples/ (read-only).
`toy`: a tiny SYNTHETIC cell_month written to tmp_path, for states the sample lacks
(unavailable months, an outage inside coverage). Test input only, not demonstration data.
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from api.dataset import load_dataset
from api.main import create_app
from api.settings import Settings

ROOT = Path(__file__).resolve().parents[2]
SAMPLES = ROOT / "contracts" / "samples"
SAMPLE_CSV = SAMPLES / "cell_month.central-india.csv"
SAMPLE_META = SAMPLES / "meta.central-india.json"
SAMPLE_BBOX = {"type": "bbox", "min_lat": 20.8, "max_lat": 21.6, "min_lon": 78.5, "max_lon": 79.5}

TOY_CELLS = [(10.125, 70.125), (10.375, 70.125)]
TOY_META = {
    "data_kind": "synthetic", "pipeline_version": "test-toy", "cell_size_deg": 0.25,
    "coverage": {"first_month": "2000-09", "last_month": "2013-02"},
    "data_through": "2013-02-10", "provisional_from": "2012-12",
    "grid_extent": {"min_lat": 10.0, "max_lat": 10.5, "min_lon": 70.0, "max_lon": 70.25},
}
TOY_OUTAGE = "2005-05"
TOY_BBOX = {"type": "bbox", "min_lat": 10.0, "max_lat": 10.5, "min_lon": 70.0, "max_lon": 70.25}


def toy_source(m: pd.Period):
    if m < pd.Period("2000-11", "M") or str(m) == TOY_OUTAGE:
        return None
    if m <= pd.Period("2002-06", "M"):
        return "TERRA_chained"
    if m <= pd.Period("2011-12", "M"):
        return "AQUA_calibrated"
    return "VIIRS"


def toy_frame() -> pd.DataFrame:
    """Cell A: value = month index % 5 (some zero months with a positive median);
    cell B: always 0. July is 0 everywhere, so its median is 0 (not_defined)."""
    rows = []
    months = pd.period_range(TOY_META["coverage"]["first_month"], TOY_META["coverage"]["last_month"], freq="M")
    for i, m in enumerate(months):
        src = toy_source(m)
        for j, (lat, lon) in enumerate(TOY_CELLS):
            v = float(i % 5) if (j == 0 and m.month != 7) else 0.0
            raw = int(v * 3)
            rows.append({"month": str(m), "cell_lat": lat, "cell_lon": lon,
                         "harmonized_count": np.nan if src is None else v,
                         "source": src or "none",
                         "terra_count": raw, "aqua_count": raw, "viirs_count": raw})
    return pd.DataFrame(rows)


def write_toy(tmp_path: Path, df: pd.DataFrame | None = None, meta: dict | None = None):
    csv, meta_path = tmp_path / "cell_month.csv", tmp_path / "meta.json"
    (toy_frame() if df is None else df).to_csv(csv, index=False)
    meta_path.write_text(json.dumps(meta or TOY_META))
    return csv, meta_path


def settings(tmp_path: Path, low_count=10, min_years=5) -> Settings:
    return Settings(data_dir=tmp_path, cell_month_file="unused", meta_file="unused",
                    static_dir=tmp_path / "no-static", low_count_threshold=low_count,
                    min_baseline_years=min_years)


def client_for(ds, tmp_path, **kw) -> TestClient:
    return TestClient(create_app(settings(tmp_path, **kw), dataset=ds))


@pytest.fixture(scope="session")
def sample_ds():
    return load_dataset(SAMPLE_CSV, SAMPLE_META)


@pytest.fixture
def sample(sample_ds, tmp_path):
    with client_for(sample_ds, tmp_path) as c:
        yield c


@pytest.fixture
def toy_ds(tmp_path):
    return load_dataset(*write_toy(tmp_path))


@pytest.fixture
def toy(toy_ds, tmp_path):
    with client_for(toy_ds, tmp_path) as c:
        yield c
