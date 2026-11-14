#!/usr/bin/env python3
"""
CAL-4: export the files the app serves (handoff H2) from a pipeline run.

  <run>/cell_month.csv + normalized.meta.json + calibration.json
    -> data/cell_month.parquet   per cell x month: harmonized_count, source, raw counts (contracts/cell_month.schema.md)
       data/meta.json            dataset facts for GET /api/meta (contracts/meta.schema.json, API spec 4)
       data/calibration.json     the conversion fits (reference)

The values come from stages 5-7. Re-run `make pipeline && make export` after any calibration change:
the format stays the same, only the numbers change. `pipeline_version` labels the state of the numbers.
Everything the API would reject is checked here first, and the export fails loudly instead.

Usage: python pipeline/export.py [--run out] [--out data] [--pipeline-version 0.1-calibration-pending]
"""
import argparse, json, shutil, sys
from pathlib import Path

import numpy as np
import pandas as pd

COLUMNS = ["month", "cell_lat", "cell_lon", "harmonized_count", "source",
           "terra_count", "aqua_count", "viirs_count"]
SOURCES = {"VIIRS", "AQUA_calibrated", "TERRA_chained"}
DEFAULT_VERSION = "0.1-calibration-pending"   # stages 5-7 known issue (AGENTS.md); change after the fix


def build(run, pipeline_version):
    run = Path(run)
    cm = pd.read_csv(run / "cell_month.csv", dtype={"month": str, "source": str})
    side = json.load(open(run / "normalized.meta.json"))
    res = float(side["cell_size_deg"])

    out = cm[COLUMNS].copy()
    out["source"] = out["source"].where(~out["source"].isin(["none", ""]) & out["source"].notna(), None)
    for c in ("terra_count", "aqua_count", "viirs_count"):
        out[c] = out[c].astype("int64")
    out = out.sort_values(["month", "cell_lat", "cell_lon"]).reset_index(drop=True)

    months = pd.PeriodIndex(out["month"], freq="M")
    meta = {
        "data_kind": side["data_kind"],
        "pipeline_version": pipeline_version,
        "cell_size_deg": res,
        "coverage": {"first_month": str(months.min()), "last_month": str(months.max())},
        "data_through": side["data_through"],
        "provisional_from": side["provisional_from"],
        "grid_extent": {"min_lat": round(out["cell_lat"].min() - res / 2, 6),
                        "max_lat": round(out["cell_lat"].max() + res / 2, 6),
                        "min_lon": round(out["cell_lon"].min() - res / 2, 6),
                        "max_lon": round(out["cell_lon"].max() + res / 2, 6)},
    }
    check(out, meta)
    return out, meta


def check(df, meta):
    """The same things the API's loader rejects (api/dataset.py), so a bad export never reaches it."""
    problems = []
    res = meta["cell_size_deg"]
    if meta["data_kind"] not in ("real", "synthetic"):
        problems.append(f"data_kind {meta['data_kind']!r}")
    months = pd.period_range(meta["coverage"]["first_month"], meta["coverage"]["last_month"], freq="M")
    cells = df[["cell_lat", "cell_lon"]].drop_duplicates()
    if df.duplicated(["month", "cell_lat", "cell_lon"]).any():
        problems.append("duplicate (month, cell) rows")
    if len(df) != len(months) * len(cells) or set(df["month"]) != {str(m) for m in months}:
        problems.append(f"not a full month x cell grid: {len(df)} rows, {len(months)} months x {len(cells)} cells")
    for col in ("cell_lat", "cell_lon"):
        k = (df[col] - res / 2) / res
        if (~np.isclose(k, np.round(k), atol=1e-6)).any():
            problems.append(f"{col} off the {res} deg grid")
    unknown = set(df["source"].dropna()) - SOURCES
    if unknown:
        problems.append(f"unknown source labels {sorted(unknown)}")
    if (df["source"].isna() != df["harmonized_count"].isna()).any():
        problems.append("source is null exactly when harmonized_count is NaN: violated")
    per_month = df.groupby("month")["source"].nunique(dropna=False)
    if (per_month > 1).any():
        problems.append(f"months with more than one source: {list(per_month[per_month > 1].index[:5])}")
    if (df[["terra_count", "aqua_count", "viirs_count"]] < 0).any().any():
        problems.append("negative raw counts")
    if (df["harmonized_count"] < 0).any():
        problems.append("negative harmonized_count")
    if meta["provisional_from"] and not (meta["coverage"]["first_month"] <= meta["provisional_from"] <= meta["coverage"]["last_month"]):
        problems.append("provisional_from outside coverage")
    if meta["data_through"][:7] != meta["coverage"]["last_month"]:
        problems.append(f"data_through {meta['data_through']} is not in the last month {meta['coverage']['last_month']}")
    if problems:
        raise ValueError("export refused: " + "; ".join(problems))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default="out", help="pipeline output folder (pipeline/run.py --out)")
    ap.add_argument("--out", default="data")
    ap.add_argument("--pipeline-version", default=DEFAULT_VERSION)
    a = ap.parse_args()
    df, meta = build(a.run, a.pipeline_version)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    df.to_parquet(out / "cell_month.parquet", index=False)
    (out / "meta.json").write_text(json.dumps(meta, indent=2) + "\n")
    shutil.copy(Path(a.run) / "calibration.json", out / "calibration.json")
    if meta["data_kind"] == "synthetic":
        print("*** SYNTHETIC demonstration data. Not real fire history. ***")
    size = (out / "cell_month.parquet").stat().st_size / 1e6
    print(f"wrote {out}/cell_month.parquet ({len(df):,} rows, {df[['cell_lat', 'cell_lon']].drop_duplicates().shape[0]:,} "
          f"cells, {meta['coverage']['first_month']} to {meta['coverage']['last_month']}, {size:.1f} MB), "
          f"{out}/meta.json ({meta['data_kind']}, {meta['pipeline_version']}), {out}/calibration.json")


if __name__ == "__main__":
    main()
