"""Satellite dates, series and code lookups shared by the ingest stages.

START/END and SERIES are narrowed in place by restrict_to_loaded_data(), so every
stage must use these dict objects (not copies).
TODO(ING-2): move the dates into pipeline/config.yaml.
"""

START = {"Terra": "2000-11-01", "Aqua": "2002-07-04", "SNPP": "2012-01-20",
         "NOAA-20": "2018-04-01", "NOAA-21": "2023-03-01"}
END = {"SNPP": "2026-11-02"}
SERIES = {"Terra": ["Terra"], "Aqua": ["Aqua"],
          "VIIRS": ["SNPP", "NOAA-20", "NOAA-21"]}
SAT_MAP = {"T": "Terra", "TERRA": "Terra", "A": "Aqua", "AQUA": "Aqua",
           "N": "SNPP", "NPP": "SNPP", "SNPP": "SNPP", "N20": "NOAA-20",
           "NOAA-20": "NOAA-20", "1": "NOAA-20", "N21": "NOAA-21", "NOAA-21": "NOAA-21",
           "2": "NOAA-21"}   # numeric codes appear in some older VIIRS files (unverified)
MODIS_PLATFORMS = {"Terra", "Aqua"}
