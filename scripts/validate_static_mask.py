#!/usr/bin/env python3
"""
Validate the NRT static-source mask (ING-11) on archive data, where the true `type` is known.

The mask is built from archive rows BEFORE --test-from only. It is then applied to archive rows
from --test-from on, ignoring their `type` (as if they were NRT), and the result is compared with
the true type 0 (vegetation fire) counts. Rows are first filtered on confidence (nominal/high),
like the pipeline. Prints one row per setting.

  over_before    overcount with no mask: (all types - true) / true      (what NRT has today)
  over_after     net overcount with the mask: (kept - true) / true
  static_kept    type 1/2/3 detections the mask misses, as % of true
  veg_dropped    true vegetation fires the mask wrongly drops, as % of true
  cell_err       sum over 0.25° cell-months of |kept - true| / sum of true (offsetting errors count)

Usage:
  python scripts/validate_static_mask.py [out/unified.csv] [--test-from 2026-05-01] [--test-to YYYY-MM-DD]
Pick settings on one window and report the error on another, so the reported error is not tuned to it.
"""
import argparse, itertools, os, sys

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pipeline.ingest.static_mask import build_static_mask, in_static_mask  # noqa: E402

GRID = {"cell_deg": [0.005, 0.01, 0.02], "min_hits": [1, 2, 3, 5], "dilate": [0, 1]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("unified", nargs="?", default="out/unified.csv")
    ap.add_argument("--test-from", default="2026-05-01")
    ap.add_argument("--test-to", help="last test day (default: end of the archive)")
    a = ap.parse_args()
    test_from = pd.Timestamp(a.test_from)

    u = pd.read_csv(a.unified, usecols=["sensor", "lat", "lon", "date", "conf_class", "type", "is_nrt"],
                    parse_dates=["date"])
    arch = u[~u["is_nrt"]]
    test = arch[(arch["date"] >= test_from) & arch["conf_class"].isin(["nominal", "high"])].copy()
    if a.test_to:
        test = test[test["date"] <= pd.Timestamp(a.test_to)]
    test["cell"] = (test["lat"] // 0.25).astype(int).astype(str) + "_" + (test["lon"] // 0.25).astype(int).astype(str)
    test["month"] = test["date"].dt.to_period("M")
    print(f"mask built from archive before {test_from.date()}; tested on archive {test_from.date()} to "
          f"{test['date'].max().date()} ({len(test):,} nominal/high detections)\n")
    print("| sensor | cell_deg | min_hits | dilate | masked squares | over_before | over_after | static_kept | veg_dropped | cell_err |")
    print("|---|---|---|---|---|---|---|---|---|---|")
    for cell_deg, min_hits, dilate in itertools.product(*GRID.values()):
        mask = build_static_mask(u, cell_deg, min_hits, dilate, before=test_from)
        hit = in_static_mask(test, mask, cell_deg)
        for sensor in ("MODIS", "VIIRS"):
            s = test["sensor"] == sensor
            veg = s & (test["type"] == 0)
            true, allc = veg.sum(), s.sum()
            kept = s & ~hit
            static_kept = (kept & (test["type"] != 0)).sum()
            veg_dropped = (veg & hit).sum()
            per_true = test[veg].groupby(["cell", "month"]).size()
            per_kept = test[kept].groupby(["cell", "month"]).size()
            cell_err = per_true.sub(per_kept, fill_value=0).abs().sum() / true
            pct = lambda x: f"{100 * x / true:.1f}%"
            print(f"| {sensor} | {cell_deg} | {min_hits} | {dilate} | {len(mask.get(sensor, [])):,} | "
                  f"{pct(allc - true)} | {pct(kept.sum() - true)} | {pct(static_kept)} | {pct(veg_dropped)} | "
                  f"{100 * cell_err:.1f}% |")


if __name__ == "__main__":
    main()
