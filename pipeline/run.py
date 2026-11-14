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
  cell_month.csv        per cell x month: counts per series, harmonized value, source
  calibration.json      both fits + hold-out check
  calendar.csv          year x month harmonized counts for the whole AOI
  calendar_anomaly.csv  same, divided by the median of that calendar month
"""
import argparse, json, os, sys

import pandas as pd

if __package__ in (None, ""):   # allow `python pipeline/run.py` as well as `python -m pipeline.run`
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline.ingest import aggregate, load_many, restrict_to_loaded_data
from pipeline.model import calendar, fit_log_line, harmonize, holdout_check


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--modis", required=True)
    ap.add_argument("--viirs", required=True)
    ap.add_argument("--res", type=float, default=0.25)
    ap.add_argument("--out", default="out")
    ap.add_argument("--a2v-window", nargs=2, default=["2012-01", "2019-12"],
                    help="months used to fit Aqua->VIIRS (avoid drifted years)")
    ap.add_argument("--t2a-window", nargs=2, default=["2002-08", "2011-12"],
                    help="months used to fit Terra->Aqua")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    # ---- ingest: stages 1-4 (Person 1)
    u = pd.concat([load_many(a.modis), load_many(a.viirs)], ignore_index=True)
    print(f"loaded {len(u):,} detections")
    restrict_to_loaded_data(u)
    u.to_csv(f"{a.out}/unified.csv", index=False)
    cm = aggregate(u, a.res)
    cm.to_csv(f"{a.out}/normalized.csv", index=False)   # handoff H1

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
