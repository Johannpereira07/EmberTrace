#!/usr/bin/env python3
"""CAL-8: Real-data calibration & splice runbook report.

Writes to out/real_report/:
  - report.md                   complete markdown report with all tables
  - overlap_aqua_to_viirs.png   monthly actual vs predicted overlap plot (2012-2019)
  - overlap_terra_to_aqua.png   monthly actual vs predicted overlap plot (2002-2011)
  - yearly_ratios.csv           overlap ratio per calendar year for both pairs
  - holdout_aqua_to_viirs.csv   test-month actual, predicted, abs_pct_err, pred_over_actual
  - holdout_terra_to_aqua.csv   test-month actual, predicted, abs_pct_err, pred_over_actual
  - splice_placebo.csv          deseasonalized 12m-after / 12m-before handover steps & z-scores
  - viirs_composition.csv       active VIIRS satellites per month & counts by regime

Usage: python science/real_report.py [--run out] [--out out/real_report]
"""
import argparse, json, sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "science"))
from pipeline.ingest.satellites import CONFIG, END, POOLED_MONTHS, START  # noqa: E402
from pipeline.model.calibrate import apply_log_line, fit_log_line  # noqa: E402
from placebo_lib import placebo_ratios, window_ratio  # noqa: E402
from splice_check import excluded_months  # noqa: E402

SPLICE = CONFIG["splice_check"]
PAIRS = [
    ("aqua_to_viirs", "aqua_count_norm", "viirs_count_norm", ("2012-01", "2019-12"), "Aqua → VIIRS"),
    ("terra_to_aqua", "terra_count_norm", "aqua_count_norm", ("2002-08", "2011-12"), "Terra → Aqua"),
]


def plot_overlap(tot_all: pd.DataFrame, split_month: pd.Period, title: str, factor: float, out_png: Path) -> None:
    dates = pd.to_datetime(tot_all.index.astype(str) + "-01")
    fig, ax = plt.subplots(figsize=(11, 4.5), dpi=110)
    ax.plot(dates, tot_all["actual"] / 1e3, color="#0072B2", lw=2.0, label="Actual target monthly total")
    ax.plot(dates, tot_all["pred_single"] / 1e3, color="#888888", lw=1.4, ls=":", label=f"Single factor (×{factor:.2f})")
    ax.plot(dates, tot_all["pred_monthly"] / 1e3, color="#D55E00", lw=1.8, ls="--", label="Monthly factors (Jun-Sep pooled)")
    split_ts = pd.Timestamp(str(split_month) + "-01")
    ax.axvline(split_ts, color="#333333", ls=":", lw=1.2, label=f"70/30 Hold-out split ({split_month})")
    ax.set_title(f"{title} Overlap Fit & Hold-Out ({tot_all.index[0]} to {tot_all.index[-1]})", fontsize=12, fontweight="bold")
    ax.set_ylabel("Detections (thousands / month)")
    ax.xaxis.set_major_locator(mdates.YearLocator(1))
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
    ax.grid(True, ls=":", alpha=0.45)
    ax.legend(loc="upper left", fontsize=8.5)
    fig.tight_layout()
    fig.savefig(out_png, dpi=110)
    plt.close(fig)


def viirs_sat_composition(cm: pd.DataFrame, meta: dict) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Compute active VIIRS satellites per month from config dates restricted to data_through."""
    v_sats = [p for p, cfg in CONFIG["satellites"].items() if cfg["series"] == "VIIRS"]
    data_end = pd.Timestamp(meta["data_through"])
    months = sorted(cm[cm["_m"] >= pd.Period("2012-01", "M")]["_m"].unique())
    v_tot = cm[cm["_m"] >= pd.Period("2012-01", "M")].groupby("_m")[["viirs_count", "viirs_count_norm"]].sum()
    rows = []
    for m in months:
        ms, me = m.start_time, min(m.end_time, data_end)
        active = []
        for p in v_sats:
            s = pd.Timestamp(START[p])
            e = min(pd.Timestamp(END.get(p, "2100-01-01")), data_end)
            if min(me, e) >= max(ms, s):
                active.append(p)
        rows.append({
            "month": str(m),
            "active_count": len(active),
            "active_satellites": "+".join(active),
            "viirs_raw_count": int(v_tot.loc[m, "viirs_count"]),
            "viirs_norm_count": round(float(v_tot.loc[m, "viirs_count_norm"]), 1),
        })
    df_m = pd.DataFrame(rows)
    df_reg = df_m.groupby("active_satellites", sort=False).agg(
        active_count=("active_count", "first"),
        first_month=("month", "min"),
        last_month=("month", "max"),
        n_months=("month", "count"),
        viirs_raw_sum=("viirs_raw_count", "sum"),
        viirs_norm_sum=("viirs_norm_count", lambda s: round(float(s.sum()), 1)),
    ).reset_index()
    return df_m, df_reg


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default="out")
    ap.add_argument("--out", default="out/real_report")
    a = ap.parse_args()
    run_dir = Path(a.run)
    out_dir = Path(a.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    cm = pd.read_csv(run_dir / "cell_month.csv", dtype={"month": str})
    meta = json.loads((run_dir / "normalized.meta.json").read_text())
    cm["_m"] = pd.PeriodIndex(cm["month"], freq="M")

    md = [f"# Real-Data Calibration & Splice Runbook (`{a.run}`)",
          f"- **Data kind:** `{meta.get('data_kind')}` · **Data through:** `{meta.get('data_through')}` · **Provisional from:** `{meta.get('provisional_from')}`\n"]

    yr_rows = []
    comp_rows = []
    for name, x, y, win, label in PAIRS:
        both = cm.dropna(subset=[x, y]).copy()
        both = both[(both["_m"] >= pd.Period(win[0], "M")) & (both["_m"] <= pd.Period(win[1], "M"))]
        months = sorted(both["_m"].unique())
        k = int(len(months) * 0.7)
        cm_m = cm.assign(month=cm["_m"])
        cal_full_s = fit_log_line(cm_m, x, y, win, method="ratio_of_totals")
        cal_full_m = fit_log_line(cm_m, x, y, win, method="monthly_ratio", pooled_months=POOLED_MONTHS)
        cal_tr_s = fit_log_line(cm_m, x, y, (str(months[0]), str(months[k - 1])), method="ratio_of_totals")
        cal_tr_m = fit_log_line(cm_m, x, y, (str(months[0]), str(months[k - 1])), method="monthly_ratio", pooled_months=POOLED_MONTHS)

        both["pred_single"] = apply_log_line(both[x], cal_full_s, months=both["_m"])
        both["pred_monthly"] = apply_log_line(both[x], cal_full_m, months=both["_m"])
        tot_all = both.groupby("_m")[[y, "pred_single", "pred_monthly"]].sum().rename(columns={y: "actual"})
        plot_overlap(tot_all, months[k], label, cal_full_s["factor"], out_dir / f"overlap_{name}.png")

        # Yearly ratio table
        by_yr = both.assign(year=both["_m"].dt.year).groupby("year")[[x, y]].sum()
        by_yr["ratio"] = by_yr[y] / by_yr[x]
        for yr_val, r in by_yr.iterrows():
            yr_rows.append({"pair": name, "year": int(yr_val), "source_sum": round(float(r[x]), 1),
                            "target_sum": round(float(r[y]), 1), "ratio_target_over_source": round(float(r["ratio"]), 4)})

        # Hold-out table (both single and monthly factors)
        test = both[both["_m"].isin(months[k:])].copy()
        test["pred_single"] = apply_log_line(test[x], cal_tr_s, months=test["_m"])
        test["pred_monthly"] = apply_log_line(test[x], cal_tr_m, months=test["_m"])
        tot = test.groupby("_m")[[y, "pred_single", "pred_monthly"]].sum().rename(columns={y: "actual"})
        tot["err_pct_single"] = (tot["pred_single"] - tot["actual"]).abs() / tot["actual"] * 100.0
        tot["ratio_single"] = tot["pred_single"] / tot["actual"]
        tot["err_pct_monthly"] = (tot["pred_monthly"] - tot["actual"]).abs() / tot["actual"] * 100.0
        tot["ratio_monthly"] = tot["pred_monthly"] / tot["actual"]
        tot.index = tot.index.astype(str)
        tot.round(3).to_csv(out_dir / f"holdout_{name}.csv")

        for m_label, p_col, e_col, r_col in [
            ("Single factor (`ratio_of_totals`)", "pred_single", "err_pct_single", "ratio_single"),
            ("Calendar-month (`monthly_ratio`, Jun-Sep pooled)", "pred_monthly", "err_pct_monthly", "ratio_monthly"),
        ]:
            comp_rows.append({
                "pair": label,
                "method": m_label,
                "train_window": f"{months[0]}..{months[k-1]}",
                "test_window": f"{months[k]}..{months[-1]}",
                "corr": float(tot["actual"].corr(tot[p_col])),
                "mape_pct": float(tot[e_col].mean()),
                "median_err_pct": float(tot[e_col].median()),
                "mean_pred_over_actual": float(tot[r_col].mean()),
            })

        mf_str = ", ".join(f"m{m}={cal_full_m['monthly_factors'][str(m)]:.2f}" for m in [1, 2, 3, 4, 5, 6, 10, 11, 12])
        md.append(f"## {label} (`{win[0]}..{win[1]}`)")
        md.append(f"- **Full-window global factor:** `{cal_full_s['factor']:.4f}` · **Train (`{months[0]}..{months[k-1]}`) global factor:** `{cal_tr_s['factor']:.4f}`")
        md.append(f"- **Full-window monthly factors (`m6` = Jun–Sep pooled):** {mf_str}\n")
        md.append("### Yearly Overlap Ratios (`sum target / sum source`)")
        md.append("| Year | Source Sum | Target Sum | Ratio |")
        md.append("|---|---|---|---|")
        for yr_val, r in by_yr.iterrows():
            md.append(f"| {yr_val} | {r[x]:,.1f} | {r[y]:,.1f} | {r['ratio']:.3f} |")
        md.append("")

    md.insert(2, "## Hold-Out Comparison: Single Factor vs Calendar-Month Factors (Jun–Sep Pooled)\n")
    md.insert(3, "| Pair | Method | Train | Test | Hold-Out `corr` | Hold-Out `MAPE` | **Median Abs % Error** | `mean(pred/actual)` |")
    md.insert(4, "|---|---|---|---|---|---|---|---|")
    for idx, cr in enumerate(comp_rows):
        md.insert(5 + idx, f"| **{cr['pair']}** | {cr['method']} | `{cr['train_window']}` | `{cr['test_window']}` | `{cr['corr']:.4f}` | `{cr['mape_pct']:.1f}%` | **`{cr['median_err_pct']:.1f}%`** | `{cr['mean_pred_over_actual']:.3f}` |")
    md.insert(5 + len(comp_rows), "")

    pd.DataFrame(yr_rows).to_csv(out_dir / "yearly_ratios.csv", index=False)

    # Deseasonalized splice + placebo
    skip = excluded_months(meta)
    win_m = SPLICE["window_months"]
    handovers = SPLICE["source_handovers"] + SPLICE["satellite_handovers"]
    avoid = {pd.Period(h, "M") for h in handovers} | skip
    tot_h = cm.groupby("_m")["harmonized_count"].sum(min_count=1)
    pl = placebo_ratios(tot_h, avoid, win_m)
    mu, sd = float(pl.mean()), float(pl.std(ddof=1))

    md.append("## Deseasonalized Splice Check (12m After / 12m Before)")
    md.append(f"- **Placebo distribution ({len(pl)} interior months):** mean = `{mu:.4f}`, std = `{sd:.4f}`, min = `{pl.min():.4f}`, max = `{pl.max():.4f}`\n")
    md.append("| Handover | 12m Before | 12m After | Ratio (After/Before) | z-score vs Placebo |")
    md.append("|---|---|---|---|---|")
    sp_rows = []
    for h in handovers:
        m = pd.Period(h, "M")
        r = window_ratio(tot_h, m, win_m)
        b_s = float(tot_h[[m - k for k in range(win_m, 0, -1)]].sum())
        a_s = float(tot_h[[m + k for k in range(win_m)]].sum())
        z = (r - mu) / sd
        sp_rows.append({"handover": h, "sum_12m_before": round(b_s, 1), "sum_12m_after": round(a_s, 1),
                        "ratio_after_over_before": round(float(r), 4), "z_score": round(float(z), 3),
                        "placebo_mean": round(mu, 4), "placebo_std": round(sd, 4)})
        md.append(f"| `{h}` | {b_s:,.0f} | {a_s:,.0f} | ×{r:.3f} | {z:+.2f}σ |")
    md.append("")
    pd.DataFrame(sp_rows).to_csv(out_dir / "splice_placebo.csv", index=False)

    # VIIRS satellite composition
    df_vm, df_vreg = viirs_sat_composition(cm, meta)
    df_vm.to_csv(out_dir / "viirs_composition.csv", index=False)
    md.append("## Active VIIRS Satellite Composition by Regime")
    md.append("| Active Satellites | Sat Count | First Month | Last Month | Months | Raw VIIRS Sum | Normalized VIIRS Sum |")
    md.append("|---|---|---|---|---|---|---|")
    for _, r in df_vreg.iterrows():
        md.append(f"| `{r['active_satellites']}` | {r['active_count']} | `{r['first_month']}` | `{r['last_month']}` | {r['n_months']} | {r['viirs_raw_sum']:,} | {r['viirs_norm_sum']:,.1f} |")
    md.append("")

    (out_dir / "report.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print(f"wrote {out_dir}/report.md, overlap plots, and CSV tables")


if __name__ == "__main__":
    main()
