#!/usr/bin/env python3
"""Second splice check: 12 months after / 12 months before, on the harmonized monthly total,
with a placebo distribution from every month whose 24-month window has no handover and no
provisional or partial month. Reports z-scores; sets no threshold. splice_check.py is unchanged.

Usage: python science/splice_placebo.py [--run out] [--bbox MIN_LAT MAX_LAT MIN_LON MAX_LON]
"""
import argparse, json, sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pipeline.ingest.satellites import CONFIG  # noqa: E402
from placebo_lib import placebo_ratios, window_ratio  # noqa: E402
from splice_check import clip, excluded_months  # noqa: E402

SPLICE = CONFIG["splice_check"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default="out", help="pipeline output folder")
    ap.add_argument("--bbox", nargs=4, type=float, metavar=("MIN_LAT", "MAX_LAT", "MIN_LON", "MAX_LON"))
    a = ap.parse_args()
    run = Path(a.run)
    cm = pd.read_csv(run / "cell_month.csv", dtype={"month": str})
    meta = json.load(open(run / "normalized.meta.json"))
    cm["_m"] = pd.PeriodIndex(cm["month"], freq="M")
    cm = clip(cm, a.bbox)
    skip = excluded_months(meta)
    win = SPLICE["window_months"]
    handovers = SPLICE["source_handovers"] + SPLICE["satellite_handovers"]
    avoid = {pd.Period(h, "M") for h in handovers} | skip

    tot = cm.groupby("_m")["harmonized_count"].sum(min_count=1)
    pl = placebo_ratios(tot, avoid, win)
    mu, sd = float(pl.mean()), float(pl.std(ddof=1))

    print(f"# Deseasonalized splice check (12m after / 12m before): {a.run} "
          f"({'bbox ' + str(a.bbox) if a.bbox else 'whole area'})\n")
    print(f"Placebo distribution ({len(pl)} interior months): mean = {mu:.4f}, std = {sd:.4f}, "
          f"min = {pl.min():.4f}, max = {pl.max():.4f}\n")
    print("| handover | 12m before | 12m after | ratio (after/before) | z-score vs placebo |")
    print("|---|---|---|---|---|")
    for h in handovers:
        m = pd.Period(h, "M")
        r = window_ratio(tot, m, win)
        if r is None:
            print(f"| {h} | | | | SKIP |")
            continue
        b_sum = tot[[m - k for k in range(win, 0, -1)]].sum()
        a_sum = tot[[m + k for k in range(win)]].sum()
        z = (r - mu) / sd if sd > 0 else float("nan")
        print(f"| {h} | {b_sum:,.0f} | {a_sum:,.0f} | ×{r:.3f} | {z:+.2f}σ |")


if __name__ == "__main__":
    main()
