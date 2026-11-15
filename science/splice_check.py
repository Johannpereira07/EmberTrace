#!/usr/bin/env python3
"""
CAL-5: the "no jump" check at the handovers (the PRD's success test, made automatic).

Source handovers (config.yaml -> splice_check.source_handovers: 2002-07 Terra chain -> Aqua,
2012-01 Aqua -> VIIRS). After the handover BOTH sources still exist, so in the `window_months`
after it the pipeline's own conversions are applied to both and compared:

    step(2002-07) = sum a2v(Aqua)  / sum a2v(t2a(Terra))     Jul 2002 .. Jun 2003
    step(2012-01) = sum VIIRS      / sum a2v(Aqua)           Jan 2012 .. Dec 2012

If the conversions are right, both describe the same fires and the step is ~1; anything else is the
jump the calendar shows at that date. Same months on both sides, so seasons don't matter.
PASS if |step - 1| <= tolerance.

Satellite handovers (splice_check.satellite_handovers: 2023-03 NOAA-21 joins): no series without
the new satellite exists, so the month-to-month change is compared with the same calendar change in
other years (PASS within [min, max]). A WEAK check: month-to-month changes vary a lot between years.

Synthetic data (--truth): also harmonized / planted truth, window before vs after each handover.

Provisional and partial months are left out. Exit code 1 if any check fails. Rule and numbers
are PROVISIONAL (config.yaml).

Usage:
  python science/splice_check.py [--run out]
  python science/splice_check.py --run out/synthetic --truth out/synthetic/raw/truth.csv
  ... [--bbox MIN_LAT MAX_LAT MIN_LON MAX_LON]
"""
import argparse, json, sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pipeline.ingest.satellites import CONFIG  # noqa: E402
from pipeline.model.calibrate import apply_log_line  # noqa: E402

SPLICE = CONFIG["splice_check"]
PAIRS = {  # handover -> (old source, new source), each as a function of the cell_month frame
    "2002-07": ("TERRA_chained", "AQUA_calibrated"),
    "2012-01": ("AQUA_calibrated", "VIIRS"),
}


def load(run):
    run = Path(run)
    cm = pd.read_csv(run / "cell_month.csv", dtype={"month": str})
    meta = json.load(open(run / "normalized.meta.json"))
    cal = json.load(open(run / "calibration.json"))
    cm["_m"] = pd.PeriodIndex(cm["month"], freq="M")
    return cm, meta, cal


def clip(cm, bbox):
    if not bbox:
        return cm
    la0, la1, lo0, lo1 = bbox
    out = cm[cm["cell_lat"].between(la0, la1) & cm["cell_lon"].between(lo0, lo1)]
    if out.empty:
        raise ValueError(f"no cells inside bbox {bbox}")
    return out


def excluded_months(meta):
    """Provisional months and the partial last month are not comparable."""
    out = {pd.Period(meta["data_through"][:7], "M")}
    if meta.get("provisional_from"):
        out |= set(pd.period_range(meta["provisional_from"], meta["data_through"][:7], freq="M"))
    return out


def as_viirs_equiv(cm, source, cal, apply_fn=None):
    """Each source's value in VIIRS-equivalent, using the pipeline's own conversions."""
    if apply_fn is None:
        apply_fn = apply_log_line
    a2v, t2a = cal.get("aqua_to_viirs"), cal.get("terra_to_aqua")
    if source == "VIIRS":
        return cm["viirs_count_norm"]
    if source == "AQUA_calibrated":
        return apply_fn(cm["aqua_count_norm"], a2v) if a2v else None
    if source == "TERRA_chained":
        return apply_fn(apply_fn(cm["terra_count_norm"], t2a), a2v) if (a2v and t2a) else None
    raise ValueError(source)


def check_source_handover(cm, cal, h, skip, window, tol, apply_fn=None):
    h = pd.Period(h, "M")
    old, new = PAIRS[str(h)]
    months = [m for m in pd.period_range(h, h + window - 1, freq="M") if m not in skip]
    w = cm[cm["_m"].isin(months)]
    a, b = as_viirs_equiv(w, old, cal, apply_fn), as_viirs_equiv(w, new, cal, apply_fn)
    if a is None or b is None or w.empty:
        return {"handover": str(h), "result": "SKIP", "why": "conversion missing or no months"}
    both = a.notna() & b.notna()
    if not both.any() or a[both].sum() <= 0:
        return {"handover": str(h), "result": "SKIP", "why": "no overlap"}
    step = b[both].sum() / a[both].sum()
    return {"handover": str(h), "old": old, "new": new, "months": f"{months[0]} to {months[-1]}",
            "old_sum": a[both].sum(), "new_sum": b[both].sum(), "step": step,
            "result": "PASS" if abs(step - 1) <= tol else "FAIL"}


def check_satellite_handover(cm, h, skip):
    tot = cm.groupby("_m")["harmonized_count"].sum(min_count=1)
    h = pd.Period(h, "M")
    prev = h - 1
    change = lambda a, b: (tot[b] / tot[a]) if (a in tot.index and b in tot.index and tot[a] > 0) else None
    if h in skip or prev in skip or change(prev, h) is None:
        return {"handover": str(h), "result": "SKIP", "why": "months missing or not comparable"}
    normal = [c for y in sorted({m.year for m in tot.index})
              for b in [pd.Period(f"{y}-{h.month:02d}", "M")] if b != h and b not in skip and (b - 1) not in skip
              for c in [change(b - 1, b)] if c is not None]
    if len(normal) < 2:
        return {"handover": str(h), "result": "SKIP", "why": "not enough comparable years"}
    at = change(prev, h)
    return {"handover": str(h), "change": at, "lo": min(normal), "hi": max(normal), "years": len(normal),
            "result": "PASS" if min(normal) <= at <= max(normal) else "FAIL"}


def check_truth(cm, truth, h, skip, window, tol):
    h = pd.Period(h, "M")
    t = cm.merge(truth, on=["month", "cell_lat", "cell_lon"], how="left")
    side = lambda ms: t[t["_m"].isin([m for m in ms if m not in skip])]
    before, after = side(pd.period_range(h - window, h - 1, freq="M")), side(pd.period_range(h, h + window - 1, freq="M"))
    if before.empty or after.empty:
        return {"handover": str(h), "result": "SKIP", "why": "no months on one side"}
    lvl = lambda d: d["harmonized_count"].sum() / d["true_viirs_equiv"].sum()
    step = lvl(after) / lvl(before)
    return {"handover": str(h), "before": lvl(before), "after": lvl(after), "step": step,
            "result": "PASS" if abs(step - 1) <= tol else "FAIL"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default="out", help="pipeline output folder (cell_month.csv, calibration.json, ...)")
    ap.add_argument("--truth", help="synthetic truth.csv: also check against the planted answer")
    ap.add_argument("--bbox", nargs=4, type=float, metavar=("MIN_LAT", "MAX_LAT", "MIN_LON", "MAX_LON"))
    a = ap.parse_args()
    cm, meta, cal = load(a.run)
    cm = clip(cm, a.bbox)
    skip = excluded_months(meta)
    win, tol = SPLICE["window_months"], SPLICE["tolerance"]
    print(f"# Splice check: {a.run} (data_kind {meta.get('data_kind')}, {'bbox ' + str(a.bbox) if a.bbox else 'whole area'})\n")
    results = []

    print(f"## Source handovers: new / old source in the {win} months after (both converted), PASS within 1 ± {tol:.0%}\n")
    print("| handover | old → new | months | old (VIIRS-eq.) | new (VIIRS-eq.) | step | result |")
    print("|---|---|---|---|---|---|---|")
    for h in SPLICE["source_handovers"]:
        r = check_source_handover(cm, cal, h, skip, win, tol)
        results.append(r)
        if r["result"] == "SKIP":
            print(f"| {r['handover']} | | | | | | SKIP ({r['why']}) |")
        else:
            print(f"| {r['handover']} | {r['old']} → {r['new']} | {r['months']} | {r['old_sum']:,.0f} | "
                  f"{r['new_sum']:,.0f} | ×{r['step']:.2f} | **{r['result']}** |")

    print("\n## Satellite handovers (weak check): month-to-month change vs the same change in other years\n")
    print("| handover | change | other years | result |")
    print("|---|---|---|---|")
    for h in SPLICE["satellite_handovers"]:
        r = check_satellite_handover(cm, h, skip)
        results.append(r)
        print(f"| {r['handover']} | " + ("| | SKIP (" + r["why"] + ") |" if r["result"] == "SKIP" else
              f"×{r['change']:.2f} | ×{r['lo']:.2f} to ×{r['hi']:.2f} ({r['years']} years) | **{r['result']}** |"))

    if a.truth:
        truth = pd.read_csv(a.truth)
        ttol = SPLICE["truth_tolerance"]
        print(f"\n## Against the planted truth: harmonized / true, {win} months before vs after, PASS within 1 ± {ttol:.0%}\n")
        print("| handover | before | after | step | result |")
        print("|---|---|---|---|---|")
        for h in SPLICE["source_handovers"] + SPLICE["satellite_handovers"]:
            r = check_truth(cm, truth, h, skip, win, ttol)
            results.append(r)
            print(f"| {r['handover']} | " + ("| | | SKIP (" + r["why"] + ") |" if r["result"] == "SKIP" else
                  f"{r['before']:.3f} | {r['after']:.3f} | ×{r['step']:.2f} | **{r['result']}** |"))

    failed = sorted({r["handover"] for r in results if r["result"] == "FAIL"})
    print("\n" + ("ALL HANDOVERS PASS" if not failed else f"FAIL at {', '.join(failed)}"))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
