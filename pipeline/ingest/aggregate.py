"""Stages 2-4: filter, grid + count, normalize by satellites observing.

One function per stage (ING-5): filter_detections, grid_counts, normalize; aggregate() runs all three.
Normalization counts observed days: mission days minus outage days (ING-6, pipeline/ingest/outages.py).
"""
import numpy as np
import pandas as pd

from .satellites import END, SERIES, START


def restrict_to_loaded_data(u):
    """Only count a satellite as observing between the first and last month it has
    data in the files we loaded (and inside its real mission dates). Without this,
    a missing satellite file (e.g. no S-NPP) would read as 'observed, zero fires'.
    Caveat: in a tiny area a satellite's first/last months with no fires look 'unobserved'.
    The pipeline runs on the full files, where every satellite's first detection is its mission
    start (checked 14 Nov); if the data starts later than that, we warn."""
    present = set(u["platform"].dropna())
    for series in SERIES:
        SERIES[series] = [p for p in SERIES[series] if p in present]
    for p in present:
        d = u.loc[u["platform"] == p, "date"]
        first, last = d.min().to_period("M").start_time, d.max().to_period("M").end_time
        if first.to_period("M") > pd.Timestamp(START[p]).to_period("M"):
            print(f"  WARNING {p}: loaded data starts {d.min().date()}, after its mission start {START[p][:10]}. "
                  f"Spatial subset or missing file? Months before {first.to_period('M')} are treated as unobserved.")
        START[p] = str(max(pd.Timestamp(START[p]), first))
        END[p] = str(min(pd.Timestamp(END.get(p, "2100-01-01")), last))
        print(f"  {p}: observing {START[p][:10]} to {END[p][:10]} (from loaded data)")
        have = set(d.dt.to_period("M"))
        gaps = [str(m) for m in pd.period_range(first, last, freq="M") if m not in have]
        if gaps:   # a missing file would be counted as 'zero fires'
            print(f"  WARNING {p}: no detections in {len(gaps)} month(s) inside its range, "
                  f"e.g. {gaps[:6]}. Missing file, or a real outage / no fires?")


def platform_weight(series, month, outage_days=None):
    """Number of satellites of this series observing during the month (fractional).
    `outage_days` ({platform: {month: n}}, from outages.outage_days_by_month) removes whole outage days."""
    ms, me = month.start_time, month.end_time
    w = 0.0
    for p in SERIES[series]:
        s = max(ms, pd.Timestamp(START[p]))
        e = min(me, pd.Timestamp(END[p])) if p in END else me
        if e > s:
            observed = (e - s) - pd.Timedelta(days=(outage_days or {}).get(p, {}).get(month, 0))
            if observed < -pd.Timedelta(seconds=1):   # month_end is 23:59:59.999999999, so allow rounding
                raise ValueError(f"{p} {month}: more outage days than observing days")
            observed = max(observed, pd.Timedelta(0))
            w += observed / (me - ms)
    return w


FILTER_RULES = ("unrecognised confidence", "low confidence", "not vegetation fire (type != 0)", "NRT static source")


def filter_detections(u, exclude=None):
    """Stage 2: keep nominal/high confidence vegetation fires (type 0; NRT rows default to 0).
    `exclude` (boolean Series on u, e.g. NRT rows inside the static-source mask) also drops rows.
    Returns (kept rows, {sensor: {"in": n, <rule>: dropped, "kept": n}}); every rule's drops are printed."""
    rules = [~u["conf_class"].notna(),
             u["conf_class"] == "low",
             u["type"] != 0,
             exclude if exclude is not None else pd.Series(False, index=u.index)]
    report, left = {}, pd.Series(True, index=u.index)
    dropped = []
    for rule in rules:
        hit = left & rule.fillna(False).astype(bool)
        dropped.append(hit)
        left &= ~hit
    for sensor in sorted(u["sensor"].dropna().unique()):
        s = u["sensor"] == sensor
        report[sensor] = {"in": int(s.sum()),
                          **{name: int((d & s).sum()) for name, d in zip(FILTER_RULES, dropped)},
                          "kept": int((left & s).sum())}
        r = report[sensor]
        print(f"  filter {sensor}: {r['in']:,} rows; dropped "
              + ", ".join(f"{name} {r[name]:,}" for name in FILTER_RULES) + f"; kept {r['kept']:,}")
    return u[left].copy(), report


def grid_counts(u, res):
    """Stage 3: detections and FRP per (series, month, grid cell). Every cell that has a detection
    gets a row for EVERY month in the range: months without fires are filled with 0 (never dropped).
    Returns ({series: DataFrame indexed (month, i) with count, frp_sum}, cells with index i, months)."""
    u = u.copy()
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
    counts = {}
    for s in SERIES:
        gs = g[g["series"] == s].merge(cells, on=["cell_lat", "cell_lon"])
        counts[s] = gs.set_index(["month", "i"])[["count", "frp_sum"]].reindex(full, fill_value=0)
    return counts, cells, months


def normalize(counts, cells, months, outage_days=None):
    """Stage 4: divide by the satellites observing each month (minus outage days): NaN when none was."""
    out = None
    for s, gs in counts.items():
        gs = gs.copy()
        w = pd.Series({m: platform_weight(s, m, outage_days) for m in months})
        wv = gs.index.get_level_values("month").map(w).values
        with np.errstate(divide="ignore", invalid="ignore"):
            gs["count_norm"] = np.where(wv > 0, gs["count"] / wv, np.nan)  # NaN = no satellite
            gs["frp_norm"] = np.where(wv > 0, gs["frp_sum"] / wv, np.nan)
        gs.columns = [f"{s.lower()}_{c}" for c in gs.columns]
        out = gs if out is None else out.join(gs)
    return out.reset_index().merge(cells, on="i").drop(columns="i")


def aggregate(u, res, outage_days=None, exclude=None, report=None):
    """Stages 2-4 in one call: filter, grid + count, normalize. `report` (a dict) receives the filter counts."""
    kept, rep = filter_detections(u, exclude)
    if report is not None:
        report.update(rep)
    return normalize(*grid_counts(kept, res), outage_days)
