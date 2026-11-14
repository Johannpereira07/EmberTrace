#!/usr/bin/env python3
"""
ING-7: synthetic FIRMS files with a PLANTED answer, for testing the pipeline without the real archive.

The files look like the real downloads (folder and file names, columns, satellite codes, archive vs
NRT layout, acq_time formats), so `pipeline/run.py` loads them unchanged. Every folder gets a
SYNTHETIC.txt marker, and run.py then labels its output `data_kind: synthetic`.

Planted answer
  Each cell-month has a true fire activity F (expected VIIRS detections per satellite). Each
  satellite sees a fixed share of it: VIIRS 1.0, Aqua 0.25, Terra 0.20 (SENSITIVITY). So a correct
  pipeline gives viirs_count_norm ~ F, aqua_count_norm ~ 0.25 F, terra_count_norm ~ 0.20 F
  (Aqua -> VIIRS ratio 4, Terra -> Aqua ratio 1.25), and a harmonized series with no step at the
  handovers. Truth is written to truth.csv / truth.json.

Features (docs/03, ING-7), extent 5-40 N, 60-100 E
  * bad fire season   region "central", Mar-May 2016, x2.5
  * sparse area       region "sparse", one cell 12.0-12.25 N, 76.0-76.25 E (API spec's sparse example);
                      fires only in Mar-Apr, so the other calendar months have a zero median
                      (Aug 2019 has a small fire: value > 0 with a zero median)
  * partial month     data through 2026-11-13; VIIRS NRT from 2026-08, MODIS NRT from 2026-09
  * handovers         satellites fly on their config.yaml dates (Terra 2000-11, Aqua 2002-07, S-NPP 2012-01 ...)
  * outages           days listed in docs/08 get no detections for that satellite
  * static sources    10 fixed points: type 2 in archive files, untagged in NRT (tests the NRT mask)
  * false alarms      extra low-confidence detections (the confidence filter must drop them)

Usage:
  python tools/synthetic/generate.py [--out out/synthetic/raw] [--seed 7] [--start 2000-11-01] [--end 2026-11-13]
"""
import argparse, json, os, sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from pipeline.ingest.outages import read_firms_table          # noqa: E402
from pipeline.ingest.satellites import END, OUTAGE_TABLE, START  # noqa: E402

RES = 0.25
SENSITIVITY = {"Terra": 0.20, "Aqua": 0.25, "SNPP": 1.0, "NOAA-20": 1.0, "NOAA-21": 1.0}
# layout of the real download (docs/07): product folder, satellites, file codes, archive end
PRODUCTS = {
    "M-C61": {"sats": {"Terra": "Terra", "Aqua": "Aqua"}, "instrument": "MODIS", "archive_end": "2026-08-31"},
    "SV-C2": {"sats": {"SNPP": "SNPP"}, "instrument": "SNPP", "archive_end": "2026-07-31"},
    "J1V-C2": {"sats": {"NOAA-20": "N20"}, "instrument": "VIIRS", "archive_end": "2026-07-31"},
    "J2V-C2": {"sats": {"NOAA-21": "N21"}, "instrument": "VIIRS", "archive_end": "2026-07-31"},
}
SEASON_SPRING = [0.6, 1.0, 2.2, 2.8, 1.8, 0.5, 0.1, 0.08, 0.1, 0.6, 1.0, 0.7]   # Mar-May peak, monsoon low
SEASON_CROP = [0.3, 0.4, 0.8, 1.6, 1.4, 0.3, 0.05, 0.05, 0.2, 2.5, 3.0, 0.6]     # + Oct-Nov crop burning
SEASON_SPARSE = [0, 0, 5.0, 4.0, 0, 0, 0, 0, 0, 0, 0, 0]   # fires only in Mar-Apr
# region: (lat_min, lat_max, lon_min, lon_max) or n random cells, base F per cell-month, season
REGIONS = {
    "central": {"box": (20.75, 22.25, 78.25, 79.75), "base": 6.0, "season": SEASON_SPRING},
    "crop": {"box": (30.0, 31.0, 75.0, 76.0), "base": 8.0, "season": SEASON_CROP},
    "sparse": {"box": (12.0, 12.25, 76.0, 76.25), "base": 0.5, "season": SEASON_SPARSE},
    "scattered": {"random_cells": 80, "base": 1.5, "season": SEASON_SPRING},
}
BAD_SEASON = {"region": "central", "months": ["2016-03", "2016-04", "2016-05"], "factor": 2.5}
SPARSE_EXTRA = {"month": "2019-08", "F": 1.0}
EXTENT = (5.0, 40.0, 60.0, 100.0)
STATIC_POINTS = [(21.31, 78.62), (21.87, 79.41), (20.93, 79.08), (22.11, 78.37), (30.42, 75.33),
                 (30.71, 75.88), (23.68, 86.09), (22.79, 86.21), (26.45, 80.33), (19.07, 72.88)]
STATIC_PER_DAY = {"MODIS": 0.1, "VIIRS": 0.3}   # expected detections per point per satellite per day
FALSE_ALARM_SHARE = 0.05


def cells_and_truth(rng, months):
    """Cell centres per region and the true F (cells x months)."""
    cells, labels = [], []
    for name, r in REGIONS.items():
        if "box" in r:
            la0, la1, lo0, lo1 = r["box"]
            for la in np.arange(la0, la1 - 1e-9, RES):
                for lo in np.arange(lo0, lo1 - 1e-9, RES):
                    cells.append((round(la + RES / 2, 4), round(lo + RES / 2, 4))); labels.append(name)
        else:
            n = r["random_cells"]
            la = np.floor(rng.uniform(EXTENT[0], EXTENT[1], n) / RES) * RES + RES / 2
            lo = np.floor(rng.uniform(EXTENT[2], EXTENT[3], n) / RES) * RES + RES / 2
            for a, b in zip(la, lo):
                if (round(a, 4), round(b, 4)) not in cells:
                    cells.append((round(a, 4), round(b, 4))); labels.append(name)
    labels = np.array(labels)
    years = sorted({m.year for m in months})
    F = np.zeros((len(cells), len(months)))
    for name, r in REGIONS.items():
        idx = np.where(labels == name)[0]
        base = rng.lognormal(np.log(r["base"]), 0.5, len(idx))
        year_factor = dict(zip(years, rng.lognormal(0, 0.25, len(years))))
        for j, m in enumerate(months):
            F[idx, j] = base * r["season"][m.month - 1] * year_factor[m.year]
    bad = np.isin([str(m) for m in months], BAD_SEASON["months"])
    F[np.ix_(labels == BAD_SEASON["region"], bad)] *= BAD_SEASON["factor"]
    extra = [str(m) for m in months].index(SPARSE_EXTRA["month"]) if SPARSE_EXTRA["month"] in map(str, months) else None
    if extra is not None:
        F[labels == "sparse", extra] = SPARSE_EXTRA["F"]
    return cells, labels, F


def observing_days(platform, start, end, listed):
    """Days the satellite observes inside [start, end], minus docs/08 outage days, with the share of each day."""
    s = max(pd.Timestamp(START[platform]), start)
    e = min(pd.Timestamp(END[platform]), end + pd.Timedelta(days=1)) if platform in END else end + pd.Timedelta(days=1)
    days = pd.date_range(s.normalize(), e - pd.Timedelta(seconds=1), freq="D")
    days = days[[(platform, d) not in listed for d in days]]
    frac = np.ones(len(days))
    if len(days) and platform in END and pd.Timestamp(END[platform]) < end + pd.Timedelta(days=1):
        frac[-1] = (pd.Timestamp(END[platform]) - days[-1]) / pd.Timedelta(days=1)   # e.g. S-NPP until 13:00
    return days, frac


def detections(rng, platform, sensor, days, frac, cells, F, months):
    """Rows (lat, lon, date, type, conf_low) for one satellite: fires + false alarms + static sources."""
    month_idx = {m: j for j, m in enumerate(months)}
    dj = np.array([month_idx[d.to_period("M")] for d in days])
    dim = np.array([d.days_in_month for d in days])
    lam = F[:, dj] / dim * SENSITIVITY[platform] * frac                      # cells x days
    n = rng.poisson(lam)
    ci, di = np.nonzero(n)
    reps = n[ci, di]
    ci, di = np.repeat(ci, reps), np.repeat(di, reps)
    cl = np.array(cells)
    out = [pd.DataFrame({"lat": cl[ci, 0] + rng.uniform(-RES / 2, RES / 2, len(ci)),
                         "lon": cl[ci, 1] + rng.uniform(-RES / 2, RES / 2, len(ci)),
                         "date": days[di], "type": 0, "conf_low": False})]
    k = rng.poisson(FALSE_ALARM_SHARE * len(ci))                              # low-confidence false alarms
    pick = rng.integers(0, len(ci), k) if len(ci) else np.array([], int)
    out.append(pd.DataFrame({"lat": cl[ci[pick], 0] + rng.uniform(-RES / 2, RES / 2, k),
                             "lon": cl[ci[pick], 1] + rng.uniform(-RES / 2, RES / 2, k),
                             "date": days[di[pick]], "type": 0, "conf_low": True}))
    ns = rng.poisson(STATIC_PER_DAY[sensor] * np.outer(np.ones(len(STATIC_POINTS)), frac))  # points x days
    pi, si = np.nonzero(ns)
    pi, si = np.repeat(pi, ns[pi, si]), np.repeat(si, ns[pi, si])
    pts = np.array(STATIC_POINTS)
    out.append(pd.DataFrame({"lat": pts[pi, 0] + rng.uniform(-0.001, 0.001, len(pi)),
                             "lon": pts[pi, 1] + rng.uniform(-0.001, 0.001, len(pi)),
                             "date": days[si], "type": 2, "conf_low": False}))
    return pd.concat(out, ignore_index=True)


def firms_columns(rng, rows, sensor, code, instrument, nrt):
    """Turn rows into FIRMS file columns (MODIS-style names for both sensors, as in the real files)."""
    n = len(rows)
    modis = sensor == "MODIS"
    hhmm = rng.integers(0, 24, n) * 100 + rng.integers(0, 60, n)
    if modis:
        conf = np.where(rows["conf_low"], rng.integers(0, 30, n), rng.integers(30, 101, n)).astype(str)
        year = rows["date"].dt.year
        version = np.where(nrt, "6.1NRT", np.where(year >= 2023, "61.03", "6.03"))
    else:
        conf = np.where(rows["conf_low"], "l", rng.choice(["n", "h"], n, p=[0.85, 0.15]))
        version = np.where(nrt, "2.0NRT", "2")
    df = pd.DataFrame({
        "latitude": rows["lat"].round(4 if modis else 5), "longitude": rows["lon"].round(4 if modis else 5),
        "brightness": rng.normal(320 if modis else 335, 10, n).round(1),
        "scan": rng.uniform(1.0, 3.0, n).round(1) if modis else rng.uniform(0.39, 0.8, n).round(2),
        "track": rng.uniform(1.0, 1.8, n).round(1) if modis else rng.uniform(0.36, 0.75, n).round(2),
        "acq_date": rows["date"].dt.strftime("%Y-%m-%d"),
        "acq_time": [f"{t // 100:02d}:{t % 100:02d}" for t in hhmm] if nrt else hhmm.astype(str),
        "satellite": code, "instrument": instrument, "confidence": conf, "version": version,
        "bright_t31": rng.normal(295, 6, n).round(1), "frp": rng.lognormal(1.5, 1.0, n).round(1),
        "daynight": rng.choice(["D", "N"], n, p=[0.7, 0.3]),
    })
    if not nrt:
        df["type"] = rows["type"].values
    return df.sort_values(["acq_date", "acq_time"]).reset_index(drop=True)


def generate(out, seed=7, start="2000-11-01", end="2026-11-13"):
    out = Path(out)
    rng = np.random.default_rng(seed)
    start, end = pd.Timestamp(start), pd.Timestamp(end)
    months = list(pd.period_range(start, end, freq="M"))
    cells, labels, F = cells_and_truth(rng, months)
    listed = read_firms_table(OUTAGE_TABLE)
    counts, skipped = {}, {}
    for product, spec in PRODUCTS.items():
        folder = out / f"DL_FIRE_{product}_synthetic"
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "SYNTHETIC.txt").write_text("SYNTHETIC demonstration data made by tools/synthetic/generate.py. "
                                              "Not real fire history.\n")
        sensor = "MODIS" if spec["instrument"] == "MODIS" else "VIIRS"
        parts = {False: [], True: []}
        for platform, code in spec["sats"].items():
            days, frac = observing_days(platform, start, end, listed)
            skipped[platform] = int(sum((platform, d) in listed for d in pd.date_range(START[platform], end)))
            rows = detections(rng, platform, sensor, days, frac, cells, F, months)
            nrt = rows["date"] > pd.Timestamp(spec["archive_end"])
            for is_nrt in (False, True):
                sel = rows[nrt == is_nrt]
                if len(sel):
                    parts[is_nrt].append(firms_columns(rng, sel, sensor, code, spec["instrument"], is_nrt))
        for is_nrt, kind in ((False, "archive"), (True, "nrt")):
            if parts[is_nrt]:
                df = pd.concat(parts[is_nrt], ignore_index=True).sort_values(["acq_date", "acq_time"])
                df.to_csv(folder / f"fire_{kind}_{product}_synthetic.csv", index=False)
                counts[f"{product} {kind}"] = len(df)
    truth = pd.DataFrame({"month": np.repeat([str(m) for m in months], len(cells)),
                          "cell_lat": np.tile([c[0] for c in cells], len(months)),
                          "cell_lon": np.tile([c[1] for c in cells], len(months)),
                          "region": np.tile(labels, len(months)),
                          "true_viirs_equiv": F.T.ravel().round(6)})
    truth.to_csv(out / "truth.csv", index=False)
    info = {"data_kind": "synthetic", "seed": seed, "start": str(start.date()), "data_through": str(end.date()),
            "sensitivity": SENSITIVITY, "planted_ratios": {"viirs_per_aqua": 1 / SENSITIVITY["Aqua"],
                                                           "aqua_per_terra": SENSITIVITY["Aqua"] / SENSITIVITY["Terra"]},
            "regions": {k: {kk: v for kk, v in r.items() if kk != "season"} | {"season": r["season"]} for k, r in REGIONS.items()},
            "cells": int(len(cells)), "bad_season": BAD_SEASON, "sparse_extra": SPARSE_EXTRA,
            "static_points": STATIC_POINTS, "static_per_day": STATIC_PER_DAY,
            "false_alarm_share": FALSE_ALARM_SHARE, "outage_days_skipped": skipped, "rows": counts}
    (out / "truth.json").write_text(json.dumps(info, indent=2))
    return info


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out/synthetic/raw")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--start", default="2000-11-01")
    ap.add_argument("--end", default="2026-11-13", help="data_through: the last day with data")
    a = ap.parse_args()
    info = generate(a.out, a.seed, a.start, a.end)
    print(f"wrote SYNTHETIC files to {a.out}: {info['cells']} cells, rows {info['rows']}")


if __name__ == "__main__":
    main()
