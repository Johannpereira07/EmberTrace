"""CAL-4: the export writes H2 files the API accepts, and refuses inconsistent data."""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "pipeline"))
import export  # noqa: E402

sys.path.insert(0, str(ROOT / "tools" / "synthetic"))
import generate  # noqa: E402


@pytest.fixture(scope="module")
def exported(tmp_path_factory):
    out = tmp_path_factory.mktemp("export")
    generate.generate(out / "raw")
    subprocess.run([sys.executable, str(ROOT / "pipeline" / "run.py"),
                    "--modis", str(out / "raw" / "DL_FIRE_M-C61_*" / "fire_*.csv"),
                    "--viirs", str(out / "raw" / "DL_FIRE_*V-C2_*" / "fire_*.csv"), "--out", str(out / "run")],
                   check=True, capture_output=True)
    subprocess.run([sys.executable, str(ROOT / "pipeline" / "export.py"), "--run", str(out / "run"),
                    "--out", str(out / "data")], check=True, capture_output=True)
    return out


def test_files_match_h2(exported):
    df = pd.read_parquet(exported / "data" / "cell_month.parquet")
    meta = json.load(open(exported / "data" / "meta.json"))
    assert list(df.columns) == export.COLUMNS
    schema = json.load(open(ROOT / "contracts" / "meta.schema.json"))
    assert set(meta) == set(schema["required"]) == set(schema["properties"])
    assert meta["data_kind"] == "synthetic" and meta["pipeline_version"] == export.DEFAULT_VERSION
    assert meta["data_through"] == "2026-11-13" and meta["provisional_from"] == "2026-08"
    months = pd.period_range(meta["coverage"]["first_month"], meta["coverage"]["last_month"], freq="M")
    cells = df[["cell_lat", "cell_lon"]].drop_duplicates()
    assert len(df) == len(months) * len(cells)                                    # full grid
    assert (df["source"].isna() == df["harmonized_count"].isna()).all()
    assert df.groupby("month")["source"].nunique(dropna=False).max() == 1
    g = meta["grid_extent"]
    assert g["min_lat"] == cells["cell_lat"].min() - 0.125 and g["max_lon"] == cells["cell_lon"].max() + 0.125
    assert (exported / "data" / "calibration.json").exists()


def _good():
    df = pd.DataFrame({"month": ["2020-01", "2020-01", "2020-02", "2020-02"], "cell_lat": [21.125, 21.375] * 2,
                       "cell_lon": [78.625] * 4, "harmonized_count": [1.0, 0.0, 2.0, 3.0],
                       "source": ["VIIRS"] * 4, "terra_count": 0, "aqua_count": 0, "viirs_count": [1, 0, 2, 3]})
    meta = {"data_kind": "real", "cell_size_deg": 0.25, "coverage": {"first_month": "2020-01", "last_month": "2020-02"},
            "data_through": "2020-02-10", "provisional_from": None, "pipeline_version": "x"}
    return df, meta


@pytest.mark.parametrize("break_it, message", [
    (lambda d: d.drop(index=3), "full month x cell grid"),
    (lambda d: d.assign(source=["VIIRS", None, "VIIRS", "VIIRS"]), "null exactly when"),
    (lambda d: d.assign(source=["VIIRS", "VIIRS", "AQUA_calibrated", "VIIRS"]), "more than one source"),
    (lambda d: d.assign(cell_lat=[21.1, 21.375, 21.1, 21.375]), "off the 0.25 deg grid"),
    (lambda d: d.assign(source="MODIS"), "unknown source"),
])
def test_export_refuses_bad_data(break_it, message):
    df, meta = _good()
    export.check(df, meta)                       # the good one passes
    with pytest.raises(ValueError, match=message):
        export.check(break_it(df.copy()), meta)


def test_nan_value_with_null_source_is_fine():
    df, meta = _good()
    df.loc[[0, 1], ["harmonized_count", "source"]] = [np.nan, None]
    export.check(df, meta)
