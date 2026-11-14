#!/usr/bin/env python3
"""
Harmonize FIRMS MODIS + VIIRS hotspots into one monthly series (v2).

Design (see the team design document):
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

Usage:
  python harmonize.py --modis "data/modis*.csv" --viirs "data/viirs*.csv" \
                      --res 0.25 --out out/

Outputs (in --out):
  unified.csv           every detection in one schema
  cell_month.csv        per cell x month: counts per series, harmonized value, source
  calibration.json      both fits + hold-out check
  calendar.csv          year x month harmonized counts for the whole AOI
  calendar_anomaly.csv  same, divided by the median of that calendar month
"""
import argparse, glob, json, os
import numpy as np
import pandas as pd

START = {"Terra": "2000-11-01", "Aqua": "2002-07-04", "SNPP": "2012-01-20",
         "NOAA-20": "2018-04-01", "NOAA-21": "2023-03-01"}
END = {"SNPP": "2026-11-02"}
SERIES = {"Terra": ["Terra"], "Aqua": ["Aqua"],
          "VIIRS": ["SNPP", "NOAA-20", "NOAA-21"]}
SAT_MAP = {"T": "Terra", "TERRA": "Terra", "A": "Aqua", "AQUA": "Aqua",
           "N": "SNPP", "NPP": "SNPP", "SNPP": "SNPP", "N20": "NOAA-20",
           "NOAA-20": "NOAA-20", "1": "NOAA-20", "N21": "NOAA-21", "NOAA-21": "NOAA-21",
           "2": "NOAA-21"}   # numeric codes appear in some older VIIRS files (unverified)


# ---------------------------------------------------------------- loading
MODIS_PLATFORMS = {"Terra", "Aqua"}


def load(path):
    """Read one FIRMS file. The sensor is decided from the SATELLITE name, not from
    column names: real VIIRS archive/NRT files use MODIS-style names (brightness,
    bright_t31), and the `instrument` column says SNPP (not VIIRS) for S-NPP."""
    df = pd.read_csv(path, dtype={"acq_time": str, "satellite": str, "confidence": str})
    platform = df["satellite"].str.strip().str.upper().map(SAT_MAP)
    sensor = pd.Series(np.where(platform.isin(MODIS_PLATFORMS), "MODIS",
                       np.where(platform.notna(), "VIIRS", "UNKNOWN")), index=df.index)
    conf_num = pd.to_numeric(df["confidence"], errors="coerce")             # MODIS: 0-100
    conf_txt = df["confidence"].str.strip().str.lower().str[0].map(          # VIIRS: l/n/h or words
        {"l": "low", "n": "nominal", "h": "high"})
    conf_from_num = pd.Series(np.select([conf_num < 30, conf_num < 80], ["low", "nominal"], "high"),
                              index=df.index).where(conf_num.notna())
    conf_class = conf_from_num.where(sensor == "MODIS", conf_txt)
    t4 = df["brightness"] if "brightness" in df.columns else df.get("bright_ti4")
    t = df["acq_time"].astype(str).str.replace(":", "").str.zfill(4)
    out = pd.DataFrame({
        "sensor": sensor, "platform": platform,
        "lat": df["latitude"], "lon": df["longitude"],
        "date": pd.to_datetime(df["acq_date"]),
        "time_utc": t.str[:2] + ":" + t.str[2:],
        "t_fire_K": t4, "frp": df["frp"], "conf_class": conf_class,
        "daynight": df["daynight"], "pixel_km2": df["scan"] * df["track"],
        # archive files only; NRT files have no `type` (so NRT keeps static/offshore sources)
        "type": df["type"].astype(int) if "type" in df.columns else 0,
        "is_nrt": df["version"].astype(str).str.upper().str.contains("NRT"),
    })
    for name, bad in [("unrecognised satellite code", platform.isna()),
                      ("unrecognised confidence value", conf_class.isna())]:
        if bad.sum():
            print(f"WARNING {path}: {int(bad.sum())} rows with {name}: "
                  f"{sorted(df['satellite' if 'satellite' in name else 'confidence'][bad].unique())[:8]} (rows excluded)")
    return out


def load_many(pattern):
    files = sorted(glob.glob(pattern))
    return pd.concat([load(f) for f in files], ignore_index=True) if files else pd.DataFrame()


# ---------------------------------------------------------- normalisation
def restrict_to_loaded_data(u):
    """Only count a satellite as observing between the first and last month it has
    data in the files we loaded (and inside its real mission dates). Without this,
    a missing satellite file (e.g. no S-NPP) would read as 'observed, zero fires'.
    Caveat: in a tiny area a satellite's first/last months with no fires look 'unobserved'."""
    present = set(u["platform"].dropna())
    for series in SERIES:
        SERIES[series] = [p for p in SERIES[series] if p in present]
    for p in present:
        d = u.loc[u["platform"] == p, "date"]
        first, last = d.min().to_period("M").start_time, d.max().to_period("M").end_time
        START[p] = str(max(pd.Timestamp(START[p]), first))
        END[p] = str(min(pd.Timestamp(END.get(p, "2100-01-01")), last))
        print(f"  {p}: observing {START[p][:10]} to {END[p][:10]} (from loaded data)")
        have = set(d.dt.to_period("M"))
        gaps = [str(m) for m in pd.period_range(first, last, freq="M") if m not in have]
        if gaps:   # a missing file would be counted as 'zero fires'
            print(f"  WARNING {p}: no detections in {len(gaps)} month(s) inside its range, "
                  f"e.g. {gaps[:6]}. Missing file, or a real outage / no fires?")


def platform_weight(series, month):
    """Number of satellites of this series observing during the month (fractional)."""
    ms, me = month.start_time, month.end_time
    w = 0.0
    for p in SERIES[series]:
        s = max(ms, pd.Timestamp(START[p]))
        e = min(me, pd.Timestamp(END[p])) if p in END else me
        if e > s:
            w += (e - s) / (me - ms)
    return w


def aggregate(u, res):
    """Detections per (series, month, grid cell), divided by satellites observing."""
    u = u[u["conf_class"].isin(["nominal", "high"]) & (u["type"] == 0)].copy()
    u["series"] = np.where(u["sensor"] == "MODIS", u["platform"],
                           np.where(u["sensor"] == "VIIRS", "VIIRS", None))
    unassigned = ~u["series"].isin(list(SERIES))
    if unassigned.any():
        raise ValueError(f"{int(unassigned.sum())} detections have no series (sensor/platform "
                         f"{u.loc[unassigned, ['sensor', 'platform']].drop_duplicates().values.tolist()[:5]})")
    u["cell_lat"] = (np.floor(u["lat"] / res) * res + res / 2).round(4)
    u["cell_lon"] = (np.floor(u["lon"] / res) * res + res / 2).round(4)
    u["month"] = u["date"].dt.to_period("M")
    g = (u.groupby(["series", "month", "cell_lat", "cell_lon"])
           .agg(count=("frp", "size"), frp_sum=("frp", "sum")).reset_index())
    months = pd.period_range(g["month"].min(), g["month"].max(), freq="M")
    cells = g[["cell_lat", "cell_lon"]].drop_duplicates().reset_index(drop=True)
    cells["i"] = range(len(cells))
    full = pd.MultiIndex.from_product([months, cells["i"]], names=["month", "i"])
    out = None
    for s in SERIES:
        gs = g[g["series"] == s].merge(cells, on=["cell_lat", "cell_lon"])
        gs = gs.set_index(["month", "i"])[["count", "frp_sum"]].reindex(full, fill_value=0)
        w = pd.Series({m: platform_weight(s, m) for m in months})
        wv = gs.index.get_level_values("month").map(w).values
        with np.errstate(divide="ignore", invalid="ignore"):
            gs["count_norm"] = np.where(wv > 0, gs["count"] / wv, np.nan)  # NaN = no satellite
            gs["frp_norm"] = np.where(wv > 0, gs["frp_sum"] / wv, np.nan)
        gs.columns = [f"{s.lower()}_{c}" for c in gs.columns]
        out = gs if out is None else out.join(gs)
    return out.reset_index().merge(cells, on="i").drop(columns="i")


# ------------------------------------------------------------ calibration
def fit_log_line(cm, x_col, y_col, window, min_rows=30, min_months=12):
    """log1p-log1p line predicting y from x over months inside `window`."""
    both = cm.dropna(subset=[x_col, y_col])
    both = both[(both["month"] >= pd.Period(window[0], "M")) &
                (both["month"] <= pd.Period(window[1], "M"))]
    both = both[(both[x_col] > 0) | (both[y_col] > 0)]   # ignore empty cells
    if len(both) < min_rows or both["month"].nunique() < min_months:
        return None
    x, y = np.log1p(both[x_col]), np.log1p(both[y_col])
    ok = np.isfinite(x) & np.isfinite(y)
    both, x, y = both[ok], x[ok], y[ok]
    if len(both) < min_rows or x.std() == 0:   # no spread in the input: a line is meaningless
        return None
    slope, intercept = np.polyfit(x, y, 1)
    pred = np.expm1(intercept + slope * x).clip(lower=0)
    # back-transforming a log fit under-estimates totals; rescale to match
    bias = float(both[y_col].sum() / max(pred.sum(), 1e-9))
    return {"slope": float(slope), "intercept": float(intercept), "bias_factor": bias,
            "pearson_r_log": float(np.corrcoef(x, y)[0, 1]),
            "ratio_y_to_x": float(both[y_col].sum() / max(both[x_col].sum(), 1e-9)),
            "n_cell_months": int(len(both)), "n_months": int(both["month"].nunique()),
            "window": list(window)}


def apply_log_line(values, cal):
    return (np.expm1(cal["intercept"] + cal["slope"] * np.log1p(values))
            .clip(lower=0) * cal["bias_factor"])


def holdout_check(cm, x_col, y_col, window, train_fraction=0.7):
    """Fit on the first part of the window, test on the rest (monthly AOI totals)."""
    months = sorted(cm.dropna(subset=[x_col, y_col])["month"].unique())
    months = [m for m in months if pd.Period(window[0], "M") <= m <= pd.Period(window[1], "M")]
    if len(months) < 24:
        return None
    split = int(len(months) * train_fraction)
    cal = fit_log_line(cm, x_col, y_col, (str(months[0]), str(months[split - 1])))
    if cal is None:
        return None
    test = cm[cm["month"].isin(months[split:])].dropna(subset=[x_col, y_col])
    tot = test.assign(pred=apply_log_line(test[x_col], cal)).groupby("month")[[y_col, "pred"]].sum()
    mape = float((abs(tot["pred"] - tot[y_col]) / tot[y_col].replace(0, np.nan)).mean())
    return {"train_months": split, "test_months": len(months) - split,
            "monthly_total_corr": float(tot.corr().iloc[0, 1]),
            "monthly_total_mean_abs_pct_error": mape}


def harmonize(cm, a2v, t2a):
    nan = pd.Series(np.nan, index=cm.index)
    viirs = cm["viirs_count_norm"]
    aqua_eq = apply_log_line(cm["aqua_count_norm"], a2v) if a2v else nan
    terra_eq = (apply_log_line(apply_log_line(cm["terra_count_norm"], t2a), a2v)
                if (a2v and t2a) else nan)
    cm["harmonized_count"] = viirs.fillna(aqua_eq).fillna(terra_eq)
    cm["source"] = np.select([viirs.notna(), aqua_eq.notna(), terra_eq.notna()],
                             ["VIIRS", "AQUA_calibrated", "TERRA_chained"], "none")
    return cm


# --------------------------------------------------------------- calendar
def calendar(cm):
    s = cm.groupby("month")["harmonized_count"].sum(min_count=1).dropna()
    cal = pd.DataFrame({"year": s.index.year, "m": s.index.month, "v": s.values})
    mat = cal.pivot(index="year", columns="m", values="v").round(1)
    return mat, (mat / mat.median(axis=0)).round(2)


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

    u = pd.concat([load_many(a.modis), load_many(a.viirs)], ignore_index=True)
    print(f"loaded {len(u):,} detections")
    restrict_to_loaded_data(u)
    u.to_csv(f"{a.out}/unified.csv", index=False)

    cm = aggregate(u, a.res)
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
