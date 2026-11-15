"""Satellite dates, series and code lookups shared by the ingest stages.

Dates, series membership and thresholds come from pipeline/config.yaml (ING-2).
START/END and SERIES are narrowed in place by restrict_to_loaded_data(), so every
stage must use these dict objects (not copies).
"""
from pathlib import Path

import pandas as pd
import yaml

CONFIG_PATH = Path(__file__).resolve().parents[1] / "config.yaml"
SERIES_NAMES = ("Terra", "Aqua", "VIIRS")


def load_config(path=CONFIG_PATH):
    """Read and check config.yaml. Fails loudly on anything missing or malformed."""
    cfg = yaml.safe_load(open(path))
    sats = cfg.get("satellites") or {}
    for name, s in sats.items():
        if s.get("series") not in SERIES_NAMES:
            raise ValueError(f"{path}: satellite {name} has series {s.get('series')!r}, expected one of {SERIES_NAMES}")
        if "start" not in s:
            raise ValueError(f"{path}: satellite {name} has no start date")
        for key in ("start", "end"):
            if key in s:
                pd.Timestamp(str(s[key]))   # raises on a bad date
        if "end" in s and pd.Timestamp(str(s["end"])) <= pd.Timestamp(str(s["start"])):
            raise ValueError(f"{path}: satellite {name} ends before it starts")
    missing = [x for x in SERIES_NAMES if not any(s["series"] == x for s in sats.values())]
    if missing:
        raise ValueError(f"{path}: no satellite configured for series {missing}")
    conf = cfg.get("modis_confidence") or {}
    if not (0 <= conf.get("low_below", -1) < conf.get("high_from", -1) <= 100):
        raise ValueError(f"{path}: modis_confidence needs 0 <= low_below < high_from <= 100, got {conf}")
    if not cfg.get("cell_size_deg", 0) > 0:
        raise ValueError(f"{path}: cell_size_deg must be > 0")
    out = cfg.get("outages") or {}
    if not (out.get("firms_table") and out.get("min_neighbour_median", -1) >= 0 and out.get("window_days", 0) >= 5):
        raise ValueError(f"{path}: outages needs firms_table, min_neighbour_median >= 0 and window_days >= 5, got {out}")
    m = cfg.get("nrt_static_mask") or {}
    if not (m.get("cell_deg", 0) > 0 and m.get("min_hits", 0) >= 1 and m.get("dilate", -1) >= 0):
        raise ValueError(f"{path}: nrt_static_mask needs cell_deg > 0, min_hits >= 1 and dilate >= 0, got {m}")
    return cfg


CONFIG = load_config()

START = {name: str(s["start"]) for name, s in CONFIG["satellites"].items()}
END = {name: str(s["end"]) for name, s in CONFIG["satellites"].items() if "end" in s}
SERIES = {series: [name for name, s in CONFIG["satellites"].items() if s["series"] == series]
          for series in SERIES_NAMES}
MODIS_CONF_LOW_BELOW = CONFIG["modis_confidence"]["low_below"]
MODIS_CONF_HIGH_FROM = CONFIG["modis_confidence"]["high_from"]
CELL_SIZE_DEG = CONFIG["cell_size_deg"]
REPO_ROOT = CONFIG_PATH.parents[1]
OUTAGE_TABLE = REPO_ROOT / CONFIG["outages"]["firms_table"]
OUTAGE_MIN_NEIGHBOUR_MEDIAN = CONFIG["outages"]["min_neighbour_median"]
OUTAGE_WINDOW_DAYS = CONFIG["outages"]["window_days"]
NRT_MASK = CONFIG["nrt_static_mask"]   # cell_deg, min_hits, dilate
POOLED_MONTHS = tuple(CONFIG["calibration"]["pooled_months"])
if not all(isinstance(m, int) and 1 <= m <= 12 for m in POOLED_MONTHS) or len(set(POOLED_MONTHS)) != len(POOLED_MONTHS):
    raise ValueError(f"{CONFIG_PATH}: calibration.pooled_months must be distinct months 1-12, got {POOLED_MONTHS}")

# FIRMS `satellite` codes -> platform names. A lookup, not a tunable, so it stays in code.
SAT_MAP = {"T": "Terra", "TERRA": "Terra", "A": "Aqua", "AQUA": "Aqua",
           "N": "SNPP", "NPP": "SNPP", "SNPP": "SNPP", "N20": "NOAA-20",
           "NOAA-20": "NOAA-20", "1": "NOAA-20", "N21": "NOAA-21", "NOAA-21": "NOAA-21",
           "2": "NOAA-21"}   # numeric codes appear in some older VIIRS files (unverified)
MODIS_PLATFORMS = {name for name, s in CONFIG["satellites"].items() if s["series"] in ("Terra", "Aqua")}

unknown = set(SAT_MAP.values()) - set(START)
if unknown:
    raise ValueError(f"{CONFIG_PATH}: SAT_MAP names satellites with no config entry: {sorted(unknown)}")
