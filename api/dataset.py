"""Load and check the precomputed pipeline output. The only place that knows file and column names.

The API serves `cell_month` + `meta.json` written by the pipeline (Person 2, handoff H2). Until H2
lands it reads the stand-in in contracts/samples/ (see its README). When H2 renames columns, edit
COLUMNS below and nothing else.

The table is pivoted once at startup into month x cell arrays, so a request only masks cells and sums.
Problems that would make an answer wrong (missing months, NaN in only some cells of a month, a source
that disagrees with the value) stop the server from starting rather than being papered over.
"""
import json
import logging
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

log = logging.getLogger("embertrace.api")

# Column names in cell_month (stand-in = H1 columns + harmonized_count + source).
COLUMNS = {"month": "month", "lat": "cell_lat", "lon": "cell_lon",
           "value": "harmonized_count", "source": "source"}
# Raw (filtered, un-normalized) detections of the series behind each source, for the low-count flag.
# Raw counts are 0 even when a satellite was not flying: never use them to decide unavailable vs zero.
RAW_COUNT_BY_SOURCE = {"VIIRS": "viirs_count", "AQUA_calibrated": "aqua_count",
                       "TERRA_chained": "terra_count"}
NO_SOURCE = {"none", ""}   # what the pipeline writes when no series was observing
DATA_KINDS = {"synthetic", "real"}
META_KEYS = ["data_kind", "pipeline_version", "cell_size_deg", "coverage", "data_through",
             "provisional_from", "grid_extent"]


class DatasetError(ValueError):
    """The pipeline output breaks the contract; the API must not serve it."""


@dataclass(frozen=True)
class Dataset:
    meta: dict                       # meta.json as loaded (served by GET /api/meta)
    cell_size: float
    months: pd.PeriodIndex           # every month in meta.coverage, in order
    data_through: date
    provisional_from: pd.Period
    cell_lat: np.ndarray             # (n_cells,) cell centres
    cell_lon: np.ndarray
    value: np.ndarray                # (n_months, n_cells) harmonized value, NaN = unavailable
    source: np.ndarray               # (n_months,) source label, or None when unavailable
    raw_count: np.ndarray            # (n_months, n_cells) raw detections of that month's source series

    @property
    def data_kind(self) -> str:
        return self.meta["data_kind"]


def _read_table(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise DatasetError(f"cell_month file not found: {path}")
    if path.suffix == ".parquet":
        df = pd.read_parquet(path)
    elif path.suffix == ".csv":
        df = pd.read_csv(path, dtype={COLUMNS["month"]: str, COLUMNS["source"]: str},
                         keep_default_na=False, na_values=[""])
    else:
        raise DatasetError(f"unsupported cell_month format {path.suffix!r} (want .parquet or .csv)")
    needed = list(COLUMNS.values()) + list(RAW_COUNT_BY_SOURCE.values())
    missing = [c for c in needed if c not in df.columns]
    if missing:
        raise DatasetError(f"{path.name} is missing columns {missing}")
    return df


def _read_meta(path: Path) -> dict:
    if not path.exists():
        raise DatasetError(f"meta file not found: {path}")
    meta = json.loads(path.read_text())
    missing = [k for k in META_KEYS if k not in meta]
    if missing:
        raise DatasetError(f"{path.name} is missing keys {missing}")
    if meta["data_kind"] not in DATA_KINDS:
        raise DatasetError(f"meta data_kind must be one of {sorted(DATA_KINDS)}, got {meta['data_kind']!r}")
    if not meta["cell_size_deg"] > 0:
        raise DatasetError(f"meta cell_size_deg must be > 0, got {meta['cell_size_deg']!r}")
    return meta


def _month(text, what) -> pd.Period:
    try:
        return pd.Period(str(text), freq="M")
    except Exception as e:
        raise DatasetError(f"{what}: not a YYYY-MM month: {text!r}") from e


def load_dataset(cell_month_path: Path, meta_path: Path) -> Dataset:
    meta = _read_meta(meta_path)
    df = _read_table(cell_month_path)
    c = COLUMNS
    res = float(meta["cell_size_deg"])

    first = _month(meta["coverage"]["first_month"], "meta coverage.first_month")
    last = _month(meta["coverage"]["last_month"], "meta coverage.last_month")
    if first > last:
        raise DatasetError(f"meta coverage is reversed: {first} > {last}")
    provisional_from = _month(meta["provisional_from"], "meta provisional_from")
    data_through = date.fromisoformat(meta["data_through"])

    df["_month"] = pd.PeriodIndex(df[c["month"]].astype(str), freq="M")
    table_months = set(df["_month"].unique())
    months = pd.period_range(first, last, freq="M")
    absent = [str(m) for m in months if m not in table_months]
    if absent:
        raise DatasetError(f"{len(absent)} month(s) in meta coverage have no rows, e.g. {absent[:6]}")
    outside = sorted(str(m) for m in table_months if not first <= m <= last)
    if outside:
        log.warning("cell_month has %d month(s) outside meta coverage (not served), e.g. %s",
                    len(outside), outside[:6])
        df = df[df["_month"].between(first, last)]

    # Cell centres must sit on the grid: centre = k * res + res / 2.
    for col in (c["lat"], c["lon"]):
        k = (df[col] - res / 2) / res
        off = ~np.isclose(k, np.round(k), atol=1e-6)
        if off.any():
            raise DatasetError(f"{int(off.sum())} rows have {col} off the {res} deg grid, "
                               f"e.g. {df.loc[off, col].iloc[0]}")

    if df.duplicated(["_month", c["lat"], c["lon"]]).any():
        raise DatasetError("cell_month has duplicate (month, cell) rows")
    cells = df[[c["lat"], c["lon"]]].drop_duplicates().sort_values([c["lat"], c["lon"]])
    cells = cells.reset_index(drop=True)
    if len(df) != len(cells) * len(months):
        raise DatasetError(f"cell_month is not a full month x cell grid: {len(df)} rows, "
                           f"expected {len(cells)} cells x {len(months)} months")
    cell_idx = pd.MultiIndex.from_frame(cells)

    def grid(col):
        return (df.pivot(index="_month", columns=[c["lat"], c["lon"]], values=col)
                  .reindex(index=months, columns=cell_idx).to_numpy(dtype=float))

    value = grid(c["value"])
    src = df[c["source"]].fillna("").astype(str).str.strip()
    df["_source"] = src.where(~src.isin(NO_SOURCE), "")   # "" = no source

    unknown = set(df["_source"]) - set(RAW_COUNT_BY_SOURCE) - {""}
    if unknown:
        raise DatasetError(f"unknown source label(s) {sorted(unknown)}")
    # NaN depends on the month only (API spec 5.6, O3): a month is unavailable for every cell or none.
    n_nan = np.isnan(value).sum(axis=1)
    mixed = months[(n_nan > 0) & (n_nan < value.shape[1])]
    if len(mixed):
        raise DatasetError(f"{len(mixed)} month(s) are NaN in only some cells, e.g. {[str(m) for m in mixed[:6]]}")
    per_month = df.groupby("_month")["_source"].agg(lambda s: sorted(set(s)))
    source = np.empty(len(months), dtype=object)
    for i, m in enumerate(months):
        labels = per_month[m]
        if len(labels) != 1:
            raise DatasetError(f"month {m} has more than one source: {labels}")
        label = labels[0] or None
        if (label is None) != bool(n_nan[i]):
            raise DatasetError(f"month {m}: source {label!r} disagrees with the value being "
                               f"{'NaN' if n_nan[i] else 'present'}")
        source[i] = label

    raw = np.zeros_like(value)
    for label, col in RAW_COUNT_BY_SOURCE.items():
        rows = source == label
        if rows.any():
            raw[rows] = grid(col)[rows]

    log.info("loaded %s: %d cells x %d months (%s to %s), data_kind=%s",
             cell_month_path.name, len(cells), len(months), first, last, meta["data_kind"])
    return Dataset(meta=meta, cell_size=res, months=months, data_through=data_through,
                   provisional_from=provisional_from,
                   cell_lat=cells[c["lat"]].to_numpy(float), cell_lon=cells[c["lon"]].to_numpy(float),
                   value=value, source=source, raw_count=raw)
