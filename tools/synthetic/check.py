#!/usr/bin/env python3
"""
Compare a pipeline run on synthetic data with the planted truth (tools/synthetic/generate.py).

  1. Ingest (stages 1-4, Person 1): sum of {s}_count_norm / sum of (sensitivity x true F) per series,
     over full observed months. Should be ~1: filtering, outage days, satellite counts and the NRT
     static mask all work.
  2. Planted ratios (input to calibration): VIIRS / Aqua over 2012-2019 should be ~4,
     Aqua / Terra over 2002-08..2011-12 ~1.25.
  3. End product (stages 5-7, Person 2): harmonized monthly totals / true totals per source period,
     and month-to-month changes at the handovers compared with the truth.
  4. Features: bad season, sparse cell with zero-median months, partial month, data_kind.

The 3% tolerance in (1) and (2) is a check tolerance for Poisson noise, not a product threshold.

Usage: python tools/synthetic/check.py out/synthetic [--truth out/synthetic/raw]
"""
import argparse, json, sys
from pathlib import Path

import numpy as np
import pandas as pd

TOL = 0.03


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("run")
    ap.add_argument("--truth")
    a = ap.parse_args()
    run = Path(a.run)
    tdir = Path(a.truth) if a.truth else run / "raw"
    truth = pd.read_csv(tdir / "truth.csv")
    info = json.load(open(tdir / "truth.json"))
    meta = json.load(open(run / "normalized.meta.json"))
    n = pd.read_csv(run / "normalized.csv")
    cm = pd.read_csv(run / "cell_month.csv")
    sens = info["sensitivity"]
    df = n.merge(truth, on=["month", "cell_lat", "cell_lon"], how="left")
    partial = info["data_through"][:7]
    full = df[df["month"] != partial]
    fails = []

    print(f"# Synthetic check: {run} (data_kind: {meta.get('data_kind')})\n")
    print("## 1. Ingest: normalized count / planted (should be ~1)\n")
    print("| series | months | ratio |")
    print("|---|---|---|")
    for s, share in (("terra", sens["Terra"]), ("aqua", sens["Aqua"]), ("viirs", 1.0)):
        obs = full[full[f"{s}_count_norm"].notna()]
        ratio = obs[f"{s}_count_norm"].sum() / (share * obs["true_viirs_equiv"].sum())
        ok = abs(ratio - 1) <= TOL
        fails += [] if ok else [f"ingest {s} ratio {ratio:.3f}"]
        print(f"| {s} | {obs['month'].min()} to {obs['month'].max()} | {ratio:.3f} {'PASS' if ok else 'FAIL'} |")
    nrt = full[full["month"] >= meta["provisional_from"]]
    r = nrt["viirs_count_norm"].sum() / nrt["true_viirs_equiv"].sum()
    ok = abs(r - 1) <= TOL
    fails += [] if ok else [f"NRT viirs ratio {r:.3f}"]
    print(f"| viirs, NRT months only (static mask) | {meta['provisional_from']} to {nrt['month'].max()} | {r:.3f} {'PASS' if ok else 'FAIL'} |")
    p = df[df["month"] == partial]
    days = int(info["data_through"][8:10]); dim = pd.Period(partial, "M").days_in_month
    print(f"| viirs, partial month {partial} | {days} of {dim} days | {p['viirs_count_norm'].sum() / p['true_viirs_equiv'].sum():.3f} (roughly {days}/{dim} = {days / dim:.3f}: partial, not comparable) |")

    print("\n## 2. Planted ratios (calibration input)\n")
    for label, x, y, lo, hi, want in (("VIIRS / Aqua", "aqua", "viirs", "2012-01", "2019-12", info["planted_ratios"]["viirs_per_aqua"]),
                                      ("Aqua / Terra", "terra", "aqua", "2002-08", "2011-12", info["planted_ratios"]["aqua_per_terra"])):
        w = full[(full["month"] >= lo) & (full["month"] <= hi)].dropna(subset=[f"{x}_count_norm", f"{y}_count_norm"])
        ratio = w[f"{y}_count_norm"].sum() / w[f"{x}_count_norm"].sum()
        ok = abs(ratio / want - 1) <= TOL
        fails += [] if ok else [f"{label} ratio {ratio:.3f}"]
        print(f"- {label}, {lo} to {hi}: {ratio:.3f} (planted {want:g}) {'PASS' if ok else 'FAIL'}")

    print("\n## 3. End product: harmonized vs truth (stages 5-7)\n")
    h = cm.merge(truth, on=["month", "cell_lat", "cell_lon"], how="left")
    h = h[h["month"] != partial]
    print("| source | harmonized / true | cells with 0 detections: mean harmonized value (truth ~0) |")
    print("|---|---|---|")
    for src, col in (("TERRA_chained", "terra_count_norm"), ("AQUA_calibrated", "aqua_count_norm"), ("VIIRS", "viirs_count_norm")):
        g = h[h["source"] == src]
        z = g[g[col] == 0]
        print(f"| {src} | {g['harmonized_count'].sum() / g['true_viirs_equiv'].sum():.3f} | "
              f"{z['harmonized_count'].mean():.2f} ({len(z):,} cell-months) |")
    tot = h.groupby("month")[["harmonized_count", "true_viirs_equiv"]].sum()
    print("\n| handover | harmonized change | true change |")
    print("|---|---|---|")
    for m0, m1 in (("2002-06", "2002-07"), ("2011-12", "2012-01"), ("2023-02", "2023-03")):
        if m0 in tot.index and m1 in tot.index:
            print(f"| {m0} → {m1} | ×{tot.loc[m1, 'harmonized_count'] / tot.loc[m0, 'harmonized_count']:.2f} | "
                  f"×{tot.loc[m1, 'true_viirs_equiv'] / tot.loc[m0, 'true_viirs_equiv']:.2f} |")

    print("\n## 4. Features\n")
    c = h[h["region"] == "central"].groupby("month")["harmonized_count"].sum()
    mam = lambda y: c[[f"{y}-0{m}" for m in (3, 4, 5)]].sum()
    others = np.median([mam(y) for y in range(2013, 2026) if y != 2016])
    print(f"- Bad season, central Mar-May 2016 vs median of 2013-2025: ×{mam(2016) / others:.2f} (planted ×{info['bad_season']['factor']}, before year-to-year noise)")
    sp = cm[(cm["cell_lat"] == 12.125) & (cm["cell_lon"] == 76.125)].copy()
    if len(sp):
        sp["m"] = sp["month"].str[5:7]
        med = sp.groupby("m")["viirs_count_norm"].median()
        print(f"- Sparse cell 12.0-12.25 N, 76.0-76.25 E: calendar months with zero median VIIRS count: {', '.join(med[med == 0].index)}")
    print(f"- Partial month: data_through {meta['data_through']}, provisional_from {meta['provisional_from']}")
    print(f"- data_kind in normalized.meta.json: {meta.get('data_kind')}")
    if meta.get("data_kind") != "synthetic":
        fails.append("data_kind is not 'synthetic'")

    print("\n" + ("ALL INGEST CHECKS PASS" if not fails else "FAILED: " + "; ".join(fails)))
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
