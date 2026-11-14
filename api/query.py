"""POST /api/calendar logic (API spec §5): validate, snap to cells, sum per month, anomaly, flags, warnings.

Read-only over the precomputed Dataset: no recalibration per request (PRD 6.1).
"""
import math
import re
from typing import Any

import numpy as np
import pandas as pd

from .dataset import Dataset
from .errors import ApiError, invalid_aoi, invalid_dates
from .models import CalendarRequest

UNIT = "VIIRS-equivalent detections per satellite"
MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
BOUNDS = {"min_lat": 90, "max_lat": 90, "min_lon": 180, "max_lon": 180}
EPS = 1e-9   # float slack when snapping, so 20.75 / 0.25 stays exactly 83

MESSAGES = {
    "SYNTHETIC_DATA": "Demonstration data. Not real fire history.",
    "CHAINED_SEGMENT": "These months are converted in two stages (Terra to Aqua to VIIRS-equivalent) "
                       "and are the least certain part of the record.",
    "PROVISIONAL": "Near-real-time months may change when science-quality data replaces them.",
    "PARTIAL_MONTH": "This month is incomplete and is not comparable with full months.",
    "LOW_COUNT": "Very few detections in this area. The calendar is noisy and anomalies may be unstable.",
}


def _is_number(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def parse_aoi(aoi: dict[str, Any]) -> dict:
    kind = aoi.get("type")
    if kind == "polygon":
        raise invalid_aoi("Polygon areas are not supported yet. Send a bbox.", "aoi.type", kind)
    if kind != "bbox":
        raise invalid_aoi("aoi.type must be 'bbox'.", "aoi.type", kind)
    box = {}
    for k, limit in BOUNDS.items():
        v = aoi.get(k)
        if not _is_number(v):
            raise invalid_aoi(f"{k} must be a number.", f"aoi.{k}", v)
        if not -limit <= v <= limit:
            raise invalid_aoi(f"{k} must be between -{limit} and {limit}.", f"aoi.{k}", v)
        box[k] = float(v)
    for axis in ("lat", "lon"):
        lo, hi = box[f"min_{axis}"], box[f"max_{axis}"]
        if not lo < hi:
            raise invalid_aoi(f"min_{axis} must be less than max_{axis}.", f"aoi.min_{axis}",
                              {f"min_{axis}": aoi[f"min_{axis}"], f"max_{axis}": aoi[f"max_{axis}"]})
    return {"type": "bbox", **box}


def snap(box: dict, res: float) -> dict:
    """Snap outward to whole cells (spec 5.2): minimums down, maximums up, to multiples of res."""
    down = lambda x: round(math.floor(x / res + EPS) * res, 10)
    up = lambda x: round(math.ceil(x / res - EPS) * res, 10)
    return {"type": "bbox", "min_lat": down(box["min_lat"]), "max_lat": up(box["max_lat"]),
            "min_lon": down(box["min_lon"]), "max_lon": up(box["max_lon"])}


def parse_months(req: CalendarRequest, ds: Dataset) -> tuple[pd.Period, pd.Period]:
    cov = ds.meta["coverage"]
    first, last = ds.months[0], ds.months[-1]
    out = {}
    for field, default in (("start_month", first), ("end_month", last)):
        text = getattr(req, field)
        if text is None:
            out[field] = default
            continue
        if not MONTH_RE.match(text):
            raise invalid_dates(f"{field} must be in YYYY-MM format.", field, cov)
        m = pd.Period(text, freq="M")
        if m < first:
            raise invalid_dates(f"{field} {m} is before the first available month {first}.", field, cov)
        if m > last:
            raise invalid_dates(f"{field} {m} is after the latest available month {last}.", field, cov)
        out[field] = m
    if out["start_month"] > out["end_month"]:
        raise invalid_dates("start_month must not be after end_month.", "start_month", cov)
    return out["start_month"], out["end_month"]


def _runs(months: list[str], flags) -> list[dict]:
    """Contiguous runs of flagged months as [{"from", "to"}]."""
    runs, start = [], None
    for i, f in enumerate(flags):
        if f and start is None:
            start = i
        if start is not None and (not f or i == len(flags) - 1):
            end = i if f else i - 1
            runs.append({"from": months[start], "to": months[end]})
            start = None
    return runs


def build_calendar(req: CalendarRequest, ds: Dataset, low_count_threshold: float,
                   min_baseline_years: int) -> dict:
    requested = parse_aoi(req.aoi)
    start, end = parse_months(req, ds)
    analyzed = snap(requested, ds.cell_size)

    ge = ds.meta["grid_extent"]
    if not (analyzed["min_lat"] < ge["max_lat"] and analyzed["max_lat"] > ge["min_lat"] and
            analyzed["min_lon"] < ge["max_lon"] and analyzed["max_lon"] > ge["min_lon"]):
        raise ApiError(422, "OUT_OF_COVERAGE", "The area is entirely outside the data coverage.",
                       {"grid_extent": ge})
    # A cell is in the area when its centre is (centres never sit on a snapped edge).
    inside = ((ds.cell_lat > analyzed["min_lat"]) & (ds.cell_lat < analyzed["max_lat"]) &
              (ds.cell_lon > analyzed["min_lon"]) & (ds.cell_lon < analyzed["max_lon"]))
    if not inside.any():
        raise ApiError(422, "EMPTY_AREA", "The area contains no grid cells with data.",
                       {"aoi_analyzed": analyzed})

    # Full record for the area: the baseline never depends on the selected range (docs/03 §4, D1).
    available = np.array([s is not None for s in ds.source])
    total = np.where(available, np.nansum(ds.value[:, inside], axis=1), np.nan)
    raw = ds.raw_count[:, inside].sum(axis=1)
    month_end = np.array([m.end_time.date() for m in ds.months])
    partial = month_end > ds.data_through
    provisional = np.array([m >= ds.provisional_from for m in ds.months])
    cal_month = np.array([m.month for m in ds.months])

    medians, n_years = [], []
    for k in range(1, 13):
        base = total[(cal_month == k) & available & ~partial]
        n_years.append(len(base))
        medians.append(float(np.median(base)) if len(base) else None)

    months = []
    for i in np.flatnonzero((ds.months >= start) & (ds.months <= end)):
        k = cal_month[i] - 1
        value = None if not available[i] else float(total[i])
        state = "unavailable" if value is None else "zero" if value == 0 else "value"
        anomaly = None
        if value is None:
            anomaly_state = "unavailable"
        elif partial[i]:
            anomaly_state = "non_comparable_partial"
        elif n_years[k] < min_baseline_years:
            anomaly_state = "not_enough_history"
        elif not medians[k]:   # zero median: never a ratio or infinity (PRD 5.4)
            anomaly_state = "not_defined"
        else:
            anomaly_state, anomaly = "ok", value / medians[k]
        months.append({
            "month": str(ds.months[i]), "value": value, "state": state,
            "anomaly": anomaly, "anomaly_state": anomaly_state, "source": ds.source[i],
            "provisional": bool(provisional[i]), "partial": bool(partial[i]),
            "low_count": bool(available[i] and raw[i] < low_count_threshold),
        })

    names = [m["month"] for m in months]
    flag = lambda key, test: _runs(names, [test(m[key]) for m in months])
    snapped = analyzed != requested
    warnings = []
    if ds.data_kind == "synthetic":
        warnings.append(("SYNTHETIC_DATA", []))
    if snapped:
        warnings.append(("SNAPPED_AOI", []))
    for code, key, test in (("LOW_COUNT", "low_count", bool),
                            ("CHAINED_SEGMENT", "source", lambda s: s == "TERRA_chained"),
                            ("PROVISIONAL", "provisional", bool),
                            ("PARTIAL_MONTH", "partial", bool)):
        ranges = flag(key, test)
        if ranges:
            warnings.append((code, ranges))
    messages = dict(MESSAGES, SNAPPED_AOI=f"The analyzed area was rounded to {ds.cell_size:g} degree grid cells.")

    return {
        "meta": {
            "data_kind": ds.data_kind, "pipeline_version": ds.meta["pipeline_version"],
            "unit": ds.meta.get("unit", UNIT), "cell_size_deg": ds.cell_size,
            "coverage": {"first_month": str(ds.months[0]), "last_month": str(ds.months[-1])},
            "data_through": ds.data_through.isoformat(),
            "aoi_requested": requested, "aoi_analyzed": analyzed, "snapped": snapped,
            "n_cells": int(inside.sum()),
            "baseline": {"basis": "full_record", "n_years": min(n_years),
                         "median_by_calendar_month": medians},
        },
        "months": months,
        "warnings": [{"code": c, "message": messages[c], "ranges": r} for c, r in warnings],
    }
