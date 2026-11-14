"""Loader: accepts the stand-in, refuses output that would make an answer wrong (API-2)."""
import json

import numpy as np
import pytest

from api.dataset import DatasetError, load_dataset

from .conftest import SAMPLE_CSV, SAMPLE_META, TOY_META, toy_frame, write_toy


def test_loads_standin_sample(sample_ds):
    assert sample_ds.value.shape == (312, 16)
    assert str(sample_ds.months[0]) == "2000-12" and str(sample_ds.months[-1]) == "2026-11"
    assert set(sample_ds.source) == {"TERRA_chained", "AQUA_calibrated", "VIIRS"}


def test_unavailable_months_stay_nan(toy_ds):
    i = list(map(str, toy_ds.months)).index("2005-05")
    assert np.isnan(toy_ds.value[i]).all() and toy_ds.source[i] is None


def test_parquet_and_csv_load_the_same(tmp_path, toy_ds):
    pq = tmp_path / "cell_month.parquet"
    toy_frame().to_parquet(pq)
    ds = load_dataset(pq, tmp_path / "meta.json")
    np.testing.assert_array_equal(ds.value, toy_ds.value)


@pytest.mark.parametrize("break_it, message", [
    (lambda df: df.drop(columns="viirs_count"), "missing columns"),
    (lambda df: df[df["month"] != "2006-01"], "have no rows"),
    (lambda df: df.drop(index=5), "full month x cell grid"),
    (lambda df: df.assign(harmonized_count=df["harmonized_count"].where(df.index != 100)), "only some cells"),
    (lambda df: df.assign(source=df["source"].where(df.index != 100, "VIIRS")), "more than one source"),
    (lambda df: df.assign(source=df["source"].where(df.index > 1, "VIIRS")), "disagrees"),
    (lambda df: df.assign(source=df["source"].replace("VIIRS", "MODIS")), "unknown source"),
    (lambda df: df.assign(cell_lat=df["cell_lat"] + 0.01), "off the 0.25 deg grid"),
])
def test_refuses_broken_tables(tmp_path, break_it, message):
    with pytest.raises(DatasetError, match=message):
        load_dataset(*write_toy(tmp_path, df=break_it(toy_frame())))


def test_refuses_bad_meta(tmp_path):
    meta = {k: v for k, v in TOY_META.items() if k != "provisional_from"}
    with pytest.raises(DatasetError, match="provisional_from"):
        load_dataset(*write_toy(tmp_path, meta=meta))
    with pytest.raises(DatasetError, match="data_kind"):
        load_dataset(*write_toy(tmp_path, meta={**TOY_META, "data_kind": "demo"}))


def test_missing_files_fail_loudly(tmp_path):
    with pytest.raises(DatasetError, match="not found"):
        load_dataset(tmp_path / "nope.parquet", SAMPLE_META)
    with pytest.raises(DatasetError, match="not found"):
        load_dataset(SAMPLE_CSV, tmp_path / "nope.json")


def test_meta_matches_sample_file(sample_ds):
    assert sample_ds.meta == json.loads(SAMPLE_META.read_text())
