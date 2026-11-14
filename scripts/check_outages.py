#!/usr/bin/env python3
"""
Check the FIRMS missing-data table (docs/08-missing-data-table.md) against the raw
archive files and derive the outage days the pipeline should use (ING-6).

Rule: a satellite-day is an OUTAGE only if our data has zero detections for that
satellite that day AND (FIRMS lists the day OR the neighbouring days' median count
is at least --min-neighbour-median). Any day with at least one detection is observed.

Usage:
  python scripts/check_outages.py "data/raw/**/*archive*.csv" [--csv outages.csv]
         [--min-neighbour-median 20] [--window 31]
--min-neighbour-median is a placeholder (provisional), not a validated threshold.
"""
import argparse, glob, re, sys
import pandas as pd

TABLE = "docs/08-missing-data-table.md"
NAME = {"Suomi NPP": "SNPP", "NOAA-20": "N20", "NOAA-21": "N21", "Terra": "Terra", "Aqua": "Aqua"}


def read_table(path):
    """Standard-data rows of section 2 as {(satellite, date)}. Ranges may be written newest first."""
    listed, section = set(), None
    for line in open(path):
        if line.startswith("## 2."):
            section = "standard"
        elif line.startswith("## "):
            section = None
        m = re.match(r"\| (\d{4}-\d\d-\d\d)(?: to (\d{4}-\d\d-\d\d))? \| (.+?) \(", line)
        if section and m:
            a, b, sat = m.groups()
            lo, hi = sorted([a, b or a])
            listed |= {(NAME[sat], d) for d in pd.date_range(lo, hi)}
    return listed


def daily_counts(pattern):
    """Detections per satellite per day; days inside each satellite's data range filled with 0."""
    files = sorted(glob.glob(pattern, recursive=True))
    if not files:
        sys.exit(f"no files match {pattern}")
    parts = []
    for f in files:
        for ch in pd.read_csv(f, usecols=["acq_date", "satellite"], dtype=str, chunksize=2_000_000):
            parts.append(ch.groupby(["satellite", "acq_date"]).size())
    d = pd.concat(parts).groupby(level=[0, 1]).sum()
    out = {}
    for sat in d.index.get_level_values(0).unique():
        s = d.loc[sat]
        s.index = pd.to_datetime(s.index)
        out[sat] = s.reindex(pd.date_range(s.index.min(), s.index.max()), fill_value=0)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pattern")
    ap.add_argument("--table", default=TABLE)
    ap.add_argument("--csv", help="write the derived outage days (satellite,date,reason)")
    ap.add_argument("--min-neighbour-median", type=float, default=20, help="provisional placeholder")
    ap.add_argument("--window", type=int, default=31, help="days in the centred neighbour window")
    a = ap.parse_args()

    listed = read_table(a.table)
    counts = daily_counts(a.pattern)
    rows, observed_listed = [], []
    for sat, s in counts.items():
        med = s.rolling(a.window, center=True, min_periods=5).median()
        for day, n in s.items():
            is_listed = (sat, day) in listed
            if n > 0:
                if is_listed:
                    observed_listed.append((sat, day.date(), int(n), int(med[day])))
            elif is_listed:
                rows.append((sat, day.date(), "listed", int(med[day])))
            elif med[day] >= a.min_neighbour_median:
                rows.append((sat, day.date(), "unlisted_zero", int(med[day])))
    outside = sorted((s, d.date()) for s, d in listed
                     if s not in counts or not (counts[s].index[0] <= d <= counts[s].index[-1]))

    print(f"# Outage check ({a.table} vs {a.pattern})\n")
    print(f"Rule: zero detections AND (listed OR neighbour median >= {a.min_neighbour_median:g}, "
          f"{a.window}-day window). Cut-off is provisional.\n")
    print(f"## Listed days that have detections in our data (treated as observed): {len(observed_listed)}\n")
    for sat, day, n, m in observed_listed:
        print(f"- {sat} {day}: {n:,} detections (neighbour median ~{m:,})")
    print(f"\n## Derived outage days: {len(rows)}\n")
    for reason in ("listed", "unlisted_zero"):
        sel = [r for r in rows if r[2] == reason]
        print(f"### {reason}: {len(sel)}\n")
        for sat, day, _, m in sel:
            print(f"- {sat} {day} (neighbour median ~{m:,})")
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
        flying = [sat for sat, s in counts.items() if s.index[0] <= day <= s.index[-1]]
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
        print(", ".join(f"{s} {d}" for s, d in outside[:20]) + (" ..." if len(outside) > 20 else ""))
    if a.csv:
        pd.DataFrame(rows, columns=["satellite", "date", "reason", "neighbour_median"]).to_csv(a.csv, index=False)
        print(f"\nwrote {a.csv}", file=sys.stderr)


if __name__ == "__main__":
    main()
