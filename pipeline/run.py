#!/usr/bin/env python3
"""
Harmonize FIRMS MODIS + VIIRS hotspots into one monthly series.
Runs ingest (stages 1-4, Person 1) then model (stages 5-7, Person 2).

Design (see docs/02 and docs/03):
  * Series are kept per satellite group: Terra, Aqua, VIIRS (all VIIRS sats combined).
  * Aqua -> VIIRS conversion is fitted on years when both fly in similar
    afternoon orbits and before orbit drift (default window 2012-01..2019-12;
    CHECK the drift dates and adjust with --a2v-window).
  * Terra -> Aqua conversion is fitted on the years both MODIS satellites fly
    (default 2002-08..2011-12) and is only used to fill Nov 2000 - Jun 2002,
    when Terra is the only satellite. Chain: Terra -> Aqua -> VIIRS-equivalent.
  * Final value per cell-month: VIIRS if available, else calibrated Aqua,
    else chained Terra.

Works with NRT text files and archive CSVs.

Usage (from the repo root):
  python pipeline/run.py --modis "data/raw/DL_FIRE_M-C61_*/fire_*.csv" \
                         --viirs "data/raw/DL_FIRE_*V-C2_*/fire_*.csv" --res 0.25 --out out/

Outputs (in --out):
  unified.csv           every detection in one schema
  normalized.csv        stage-4 table, the ingest -> model handoff (contracts/normalized.schema.md)
  normalized.meta.json  data_through, provisional_from, cell size, outage-day counts (same handoff)
  outages.csv           outage days per satellite (rule in docs/08), removed from the observed days
  (NRT rows at known static sources are dropped before counting: ING-11, docs/10)
  cell_month.csv        per cell x month: counts per series, harmonized value, source
  calibration.json      both fits + hold-out check
  calendar.csv          year x month harmonized counts for the whole AOI
  calendar_anomaly.csv  same, divided by the median of that calendar month
"""
import argparse, glob, json, os, sys

import pandas as pd

if __package__ in (None, ""):   # allow `python pipeline/run.py` as well as `python -m pipeline.run`
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline.ingest import (aggregate, build_static_mask, coverage_info, daily_counts, find_outages,
                             in_static_mask, load_many, mask_summary, outage_days_by_month,
                             read_firms_table, restrict_to_loaded_data)
from pipeline.ingest.satellites import (CELL_SIZE_DEG, NRT_MASK, OUTAGE_MIN_NEIGHBOUR_MEDIAN, OUTAGE_TABLE,
                                        OUTAGE_WINDOW_DAYS)
from pipeline.model import calendar, fit_log_line, harmonize, holdout_check


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--modis", required=True)
    ap.add_argument("--viirs", required=True)
    ap.add_argument("--res", type=float, default=CELL_SIZE_DEG, help="cell size in degrees (default: config.yaml)")
    ap.add_argument("--out", default="out")
    ap.add_argument("--a2v-window", nargs=2, default=["2012-01", "2019-12"],
                    help="months used to fit Aqua->VIIRS (avoid drifted years)")
    ap.add_argument("--t2a-window", nargs=2, default=["2002-08", "2011-12"],
                    help="months used to fit Terra->Aqua")
    ap.add_argument("--outages", help="use this outages.csv instead of deriving outage days from the loaded "
                                      "data (needed when the input is a small spatial subset)")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    # Synthetic input (tools/synthetic/generate.py) carries a SYNTHETIC.txt marker next to its files
    files = sorted(glob.glob(a.modis)) + sorted(glob.glob(a.viirs))
    synthetic = {os.path.dirname(f) for f in files if os.path.exists(os.path.join(os.path.dirname(f), "SYNTHETIC.txt"))}
    if synthetic and len(synthetic) != len({os.path.dirname(f) for f in files}):
        sys.exit("ERROR: some input folders are SYNTHETIC and some are not. Don't mix synthetic and real data.")
    data_kind = "synthetic" if synthetic else "real"
    if synthetic:
        print("*** SYNTHETIC demonstration data (tools/synthetic). Not real fire history. ***")

    # ---- ingest: stages 1-4 (Person 1)
    u = pd.concat([load_many(a.modis), load_many(a.viirs)], ignore_index=True)
    print(f"loaded {len(u):,} detections")
    info = {"data_kind": data_kind, **coverage_info(u, a.res)}
    print(f"data_through {info['data_through']}, provisional_from {info['provisional_from']}")
    restrict_to_loaded_data(u)
    u.to_csv(f"{a.out}/unified.csv", index=False)
    if a.outages:
        outages = pd.read_csv(a.outages, parse_dates=["date"])
        print(f"outage days: {len(outages)} read from {a.outages}")
    else:
        outages = find_outages(daily_counts(u), read_firms_table(OUTAGE_TABLE),
                               OUTAGE_MIN_NEIGHBOUR_MEDIAN, OUTAGE_WINDOW_DAYS)
        print(f"outage days: {len(outages)} derived from the loaded data "
              f"({(outages['reason'] == 'unlisted_zero').sum()} not in the FIRMS table)")
    outages.to_csv(f"{a.out}/outages.csv", index=False)
    info["outage_days"] = {p: int(n) for p, n in outages["platform"].value_counts().sort_index().items()}
    # NRT static-source mask (ING-11): NRT files have no `type`, so drop NRT rows at known static sources
    mask = build_static_mask(u, NRT_MASK["cell_deg"], NRT_MASK["min_hits"], NRT_MASK["dilate"])
    nrt_static = u["is_nrt"] & in_static_mask(u, mask, NRT_MASK["cell_deg"])
    counted = nrt_static & u["conf_class"].isin(["nominal", "high"])
    by = u[counted].groupby(["sensor", u.loc[counted, "date"].dt.to_period("M")]).size()
    print(f"NRT static-source mask: {mask_summary(mask)} squares; dropped {int(nrt_static.sum()):,} NRT rows "
          f"({int(counted.sum()):,} nominal/high): " + ", ".join(f"{s} {m}: {n:,}" for (s, m), n in by.items()))
    info["nrt_static_mask"] = {**NRT_MASK, "squares": mask_summary(mask),
                               "nrt_rows_dropped": {s: int(n) for s, n in u[counted].groupby("sensor").size().items()}}
    filter_report = {}
    cm = aggregate(u, a.res, outage_days_by_month(outages), exclude=nrt_static, report=filter_report)
    info["filter"] = filter_report
    cm.to_csv(f"{a.out}/normalized.csv", index=False)   # handoff H1
    json.dump(info, open(f"{a.out}/normalized.meta.json", "w"), indent=2)

    # ---- model: stages 5-7 (Person 2)
    a2v = fit_log_line(cm, "aqua_count_norm", "viirs_count_norm", a.a2v_window)
    t2a = fit_log_line(cm, "terra_count_norm", "aqua_count_norm", a.t2a_window)
    report = {"aqua_to_viirs": a2v, "terra_to_aqua": t2a,
              "holdout_aqua_to_viirs": holdout_check(cm, "aqua_count_norm", "viirs_count_norm", a.a2v_window),
              "holdout_terra_to_aqua": holdout_check(cm, "terra_count_norm", "aqua_count_norm", a.t2a_window)}
    print(json.dumps(report, indent=2) if (a2v or t2a) else
          "calibration skipped (not enough overlap in this data)")
    cm = harmonize(cm, a2v, t2a)
    cm.to_csv(f"{a.out}/cell_month.csv", index=False)
    json.dump(report, open(f"{a.out}/calibration.json", "w"), indent=2)
    mat, anom = calendar(cm)
    mat.to_csv(f"{a.out}/calendar.csv"); anom.to_csv(f"{a.out}/calendar_anomaly.csv")
    print("wrote", a.out)


if __name__ == "__main__":
    main()
