"""Stage 1: load FIRMS files (NRT or archive) into one schema."""
import glob

import numpy as np
import pandas as pd

from .satellites import MODIS_PLATFORMS, SAT_MAP


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
