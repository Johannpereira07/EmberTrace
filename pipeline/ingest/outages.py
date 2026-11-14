"""ING-6: outage days per satellite, so an outage never reads as "observed, zero fires".

Rule (docs/08, AGENTS.md): a satellite-day is an OUTAGE only if the data has zero detections
for that satellite that day AND (the FIRMS missing-data table lists it OR the neighbouring days'
median count is at least `min_neighbour_median`). Any day with at least one detection is observed,
even if FIRMS lists it. Daily counts use ALL rows (any confidence, any type): a low-confidence
detection still shows the satellite was observing.

The rule needs region-wide daily counts, so compute it on the full files (the pipeline does),
not on a small spatial subset where quiet days look empty.
"""
import re

import pandas as pd

# names in the FIRMS table -> our platform names
TABLE_NAMES = {"Suomi NPP": "SNPP", "NOAA-20": "NOAA-20", "NOAA-21": "NOAA-21", "Terra": "Terra", "Aqua": "Aqua"}
COLUMNS = ["platform", "date", "reason", "neighbour_median"]


def read_firms_table(path):
    """Standard-data rows (section 2) of docs/08 as a set of (platform, day). Ranges may be newest first."""
    listed, section = set(), None
    for line in open(path):
        if line.startswith("## 2."):
            section = "standard"
        elif line.startswith("## "):
            section = None
        m = re.match(r"\| (\d{4}-\d\d-\d\d)(?: to (\d{4}-\d\d-\d\d))? \| (.+?) \(", line)
        if section and m:
            a, b, name = m.groups()
            if name not in TABLE_NAMES:
                raise ValueError(f"{path}: unknown satellite {name!r} in the missing-data table")
            lo, hi = sorted([a, b or a])
            listed |= {(TABLE_NAMES[name], d) for d in pd.date_range(lo, hi)}
    if not listed:
        raise ValueError(f"{path}: no standard-data rows found in the missing-data table")
    return listed


def daily_counts(u):
    """Detections per platform per day over all rows, zero-filled between its first and last day."""
    out = {}
    for p, d in u.dropna(subset=["platform"]).groupby("platform")["date"]:
        s = d.dt.normalize().value_counts().sort_index()
        out[p] = s.reindex(pd.date_range(s.index.min(), s.index.max()), fill_value=0)
    return out


def find_outages(counts, listed, min_neighbour_median, window_days):
    """Outage days as a DataFrame (platform, date, reason, neighbour_median), reason = listed | unlisted_zero."""
    rows = []
    for p, s in counts.items():
        med = s.rolling(window_days, center=True, min_periods=5).median()
        for day in s.index[s.values == 0]:
            if (p, day) in listed:
                rows.append((p, day, "listed", med[day]))
            elif med[day] >= min_neighbour_median:
                rows.append((p, day, "unlisted_zero", med[day]))
    return pd.DataFrame(rows, columns=COLUMNS)


def outage_days_by_month(outages):
    """{platform: {Period(month): number of outage days}} for platform_weight()."""
    out = {}
    for (p, m), n in outages.groupby([outages["platform"], outages["date"].dt.to_period("M")]).size().items():
        out.setdefault(p, {})[m] = int(n)
    return out
