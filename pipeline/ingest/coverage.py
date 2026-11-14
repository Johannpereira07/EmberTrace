"""ING-8: dataset-level dates for the H1 sidecar (`normalized.meta.json`).

data_through      last day with VIIRS data. VIIRS is the source of every month from 2012 on,
                  including the latest one whose completeness this decides (API spec 5.3).
provisional_from  first month with VIIRS near-real-time (NRT) data (AGENTS.md, data facts).

Both come from ALL loaded rows, before filtering: a low-confidence detection still shows the
satellite was observing that day. Per-series values are kept for transparency.
Caveat: they are read from detections, so on a small area with few fires the last VIIRS day can
be earlier than the files' real end. The real pipeline loads all of India, where this doesn't happen.
"""
import pandas as pd

SOURCE_SERIES = "VIIRS"


def coverage_info(u, res):
    if u.empty:
        raise ValueError("no detections loaded: cannot compute data_through / provisional_from")
    series = u["platform"].where(u["sensor"] == "MODIS", "VIIRS").where(u["sensor"].isin(["MODIS", "VIIRS"]))
    by_series = {}
    for s in ("Terra", "Aqua", "VIIRS"):
        rows = u[series == s]
        if rows.empty:
            by_series[s] = None
            continue
        nrt, archive = rows[rows["is_nrt"]], rows[~rows["is_nrt"]]
        first_nrt = nrt["date"].min().to_period("M") if len(nrt) else None
        if first_nrt is not None and len(archive) and archive["date"].max().to_period("M") >= first_nrt:
            print(f"WARNING {s}: archive data runs to {archive['date'].max().date()}, into or past the first "
                  f"NRT month {first_nrt}. Archive and NRT overlap: check for duplicates before trusting counts.")
        by_series[s] = {
            "first_day": str(rows["date"].min().date()),
            "last_day": str(rows["date"].max().date()),
            "archive_last_day": str(archive["date"].max().date()) if len(archive) else None,
            "first_nrt_month": str(first_nrt) if first_nrt is not None else None,
        }
    src = by_series[SOURCE_SERIES]
    if src is None:
        raise ValueError(f"no {SOURCE_SERIES} detections loaded: cannot compute data_through / provisional_from")
    if src["first_nrt_month"] is None:
        print(f"WARNING: no {SOURCE_SERIES} NRT rows loaded, so provisional_from is null (no provisional months).")
    return {
        "data_through": src["last_day"],
        "provisional_from": src["first_nrt_month"],
        "source_series": SOURCE_SERIES,
        "cell_size_deg": res,
        "by_series": by_series,
    }
