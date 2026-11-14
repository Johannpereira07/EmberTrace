"""ING-11: NRT static-source mask.

Archive files tag each detection with `type` (0 vegetation fire, 1 volcano, 2 other static land
source such as industry, 3 offshore). NRT files have no `type`, so the type 0 filter can't run on
them. Static sources stay in the same place, so the archive tells us where they are: every square
of `cell_deg` with at least `min_hits` archive detections of type 1/2/3, kept per sensor (MODIS,
VIIRS), optionally grown by `dilate` squares in each direction. NRT detections inside the mask
are dropped. Settings in pipeline/config.yaml (provisional); validation in docs/10.
"""
import numpy as np
import pandas as pd

_LAT_SHIFT, _LON_SHIFT, _LON_SPAN = 100_000, 100_000, 1_000_000


def _keys(lat, lon, cell_deg):
    """One int64 key per (lat, lon) square of `cell_deg`."""
    i = np.floor(np.asarray(lat, dtype=float) / cell_deg + 1e-9).astype(np.int64) + _LAT_SHIFT
    j = np.floor(np.asarray(lon, dtype=float) / cell_deg + 1e-9).astype(np.int64) + _LON_SHIFT
    return i * _LON_SPAN + j


def build_static_mask(u, cell_deg, min_hits, dilate=0, before=None):
    """{sensor: sorted int64 array of masked square keys} from ARCHIVE rows with type 1/2/3.
    `before` (a Timestamp) keeps only archive rows before that date, for validation."""
    src = u[(~u["is_nrt"]) & (u["type"] != 0) & u["sensor"].isin(["MODIS", "VIIRS"])]
    if before is not None:
        src = src[src["date"] < before]
    mask = {}
    for sensor, rows in src.groupby("sensor"):
        keys, hits = np.unique(_keys(rows["lat"], rows["lon"], cell_deg), return_counts=True)
        keys = keys[hits >= min_hits]
        if dilate:
            i, j = keys // _LON_SPAN, keys % _LON_SPAN
            grown = [(i + di) * _LON_SPAN + (j + dj)
                     for di in range(-dilate, dilate + 1) for dj in range(-dilate, dilate + 1)]
            keys = np.unique(np.concatenate(grown))
        mask[sensor] = keys
    return mask


def in_static_mask(u, mask, cell_deg):
    """Boolean Series: is each row inside its sensor's static-source mask?"""
    hit = pd.Series(False, index=u.index)
    for sensor, keys in mask.items():
        rows = u["sensor"] == sensor
        if rows.any():
            hit[rows] = np.isin(_keys(u.loc[rows, "lat"], u.loc[rows, "lon"], cell_deg), keys)
    return hit


def mask_summary(mask):
    return {sensor: int(len(keys)) for sensor, keys in mask.items()}
