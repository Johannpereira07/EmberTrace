#!/usr/bin/env python3
"""
Check the FIRMS missing-data table (docs/08-missing-data-table.md) against the raw
archive files and derive the outage days the pipeline uses (ING-6).

The rule lives in pipeline/ingest/outages.py (shared with the pipeline): a satellite-day is
an OUTAGE only if our data has zero detections for that satellite that day AND (FIRMS lists
the day OR the neighbouring days' median count is at least the cut-off). Any day with at
least one detection is observed. Cut-off and window default to pipeline/config.yaml.

Usage:
  python scripts/check_outages.py "data/raw/**/*archive*.csv" [--csv outages.csv]
         [--min-neighbour-median N] [--window DAYS]
The --csv file can be passed to `pipeline/run.py --outages` (e.g. when running on a subset).
"""
import argparse, glob, os, sys

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pipeline.ingest.outages import find_outages, read_firms_table          # noqa: E402
from pipeline.ingest.satellites import (OUTAGE_MIN_NEIGHBOUR_MEDIAN, OUTAGE_TABLE,  # noqa: E402
                                        OUTAGE_WINDOW_DAYS, SAT_MAP)


def daily_counts(pattern):
    """Detections per platform per day (all rows), zero-filled between first and last day. Reads in chunks."""
    files = sorted(glob.glob(pattern, recursive=True))
    if not files:
        sys.exit(f"no files match {pattern}")
    parts = []
    for f in files:
        for ch in pd.read_csv(f, usecols=["acq_date", "satellite"], dtype=str, chunksize=2_000_000):
            ch["platform"] = ch["satellite"].str.strip().str.upper().map(SAT_MAP)
            if ch["platform"].isna().any():
                sys.exit(f"{f}: unknown satellite codes {sorted(ch.loc[ch['platform'].isna(), 'satellite'].unique())}")
            parts.append(ch.groupby(["platform", "acq_date"]).size())
    d = pd.concat(parts).groupby(level=[0, 1]).sum()
    out = {}
    for p in d.index.get_level_values(0).unique():
        s = d.loc[p]
        s.index = pd.to_datetime(s.index)
        out[p] = s.reindex(pd.date_range(s.index.min(), s.index.max()), fill_value=0)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pattern")
    ap.add_argument("--table", default=str(OUTAGE_TABLE))
    ap.add_argument("--csv", help="write the derived outage days (platform,date,reason,neighbour_median)")
    ap.add_argument("--min-neighbour-median", type=float, default=OUTAGE_MIN_NEIGHBOUR_MEDIAN,
                    help="provisional placeholder (default: config.yaml)")
    ap.add_argument("--window", type=int, default=OUTAGE_WINDOW_DAYS,
                    help="days in the centred neighbour window (default: config.yaml)")
    a = ap.parse_args()

    listed = read_firms_table(a.table)
    counts = daily_counts(a.pattern)
    outages = find_outages(counts, listed, a.min_neighbour_median, a.window)
    observed_listed = []
    for p, s in counts.items():
        med = s.rolling(a.window, center=True, min_periods=5).median()
        observed_listed += [(p, day.date(), int(n), int(med[day])) for day, n in s.items() if n > 0 and (p, day) in listed]
    outside = sorted((p, d.date()) for p, d in listed
                     if p not in counts or not (counts[p].index[0] <= d <= counts[p].index[-1]))

    print(f"# Outage check ({a.table} vs {a.pattern})\n")
    print(f"Rule: zero detections AND (listed OR neighbour median >= {a.min_neighbour_median:g}, "
          f"{a.window}-day window). Cut-off is provisional.\n")
    print(f"## Listed days that have detections in our data (treated as observed): {len(observed_listed)}\n")
    for p, day, n, m in observed_listed:
        print(f"- {p} {day}: {n:,} detections (neighbour median ~{m:,})")
    print(f"\n## Derived outage days: {len(outages)}\n")
    for reason in ("listed", "unlisted_zero"):
        sel = outages[outages["reason"] == reason]
        print(f"### {reason}: {len(sel)}\n")
        for r in sel.itertuples():
            print(f"- {r.platform} {r.date.date()} (neighbour median ~{int(r.neighbour_median):,})")
        print()

    # With two or more satellites flying, a day with no data from any of them while the
    # neighbouring days clearly have data (same cut-off as the outage rule, on the combined
    # count) points to a broken download rather than an outage. Warn loudly. Quiet seasons
    # (e.g. monsoon days with only Terra + Aqua) can be empty naturally and are not flagged.
    all_days = pd.date_range(min(s.index[0] for s in counts.values()), max(s.index[-1] for s in counts.values()))
    total = sum(s.reindex(all_days, fill_value=0) for s in counts.values())
    total_med = total.rolling(a.window, center=True, min_periods=5).median()
    suspect = []
    for day in all_days:
        flying = [p for p, s in counts.items() if s.index[0] <= day <= s.index[-1]]
        if len(flying) >= 2 and total[day] == 0 and total_med[day] >= a.min_neighbour_median:
            suspect.append((day.date(), flying, int(total_med[day])))
    print(f"## Days with no data from any of 2+ flying satellites, neighbours clearly non-zero "
          f"(check the download): {len(suspect)}\n")
    for day, flying, m in suspect:
        print(f"- {day}: {', '.join(flying)} (combined neighbour median ~{m:,})")
        print(f"WARNING {day}: no detections from any flying satellite ({', '.join(flying)}). "
              "Check the download before treating this as an outage.", file=sys.stderr)
    print()
    if outside:
        print(f"## Listed days outside our data range (ignored): {len(outside)}\n")
        print(", ".join(f"{p} {d}" for p, d in outside[:20]) + (" ..." if len(outside) > 20 else ""))
    if a.csv:
        outages.to_csv(a.csv, index=False)
        print(f"\nwrote {a.csv}", file=sys.stderr)


if __name__ == "__main__":
    main()
