#!/usr/bin/env python3
"""CAL-7: Hero figure (1600px wide) comparing raw sensor counts vs the harmonized series.

Left panel: raw counts per month (MODIS Terra+Aqua vs VIIRS), with 12-month rolling sums
  showing the 2012 sensor jump and 2018/2023 satellite jumps.
Right panel: the harmonized VIIRS-equivalent series on the same axes, with 12-month rolling sum.
Marks 2002-07 and 2012-01 handovers with thin vertical lines, and labels the data kind.

Usage: python science/hero_figure.py [--run out] [--out science/figures/hero.png]
"""
import argparse, json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np
import pandas as pd


def build_hero(run_dir: Path, out_path: Path) -> None:
    cm = pd.read_csv(run_dir / "cell_month.csv", dtype={"month": str})
    meta = json.loads((run_dir / "normalized.meta.json").read_text())

    # Exclude partial last month so the 12-month rolling sum isn't dragged down by a 13-day month
    last_partial = meta["data_through"][:7]
    cm = cm[cm["month"] < last_partial].copy()

    m = cm.groupby("month").agg(
        terra_raw=("terra_count", "sum"),
        aqua_raw=("aqua_count", "sum"),
        viirs_raw=("viirs_count", "sum"),
        harmonized=("harmonized_count", "sum"),
        viirs_obs=("viirs_count_norm", lambda s: s.notna().any()),
    ).sort_index()
    m["modis_raw"] = m["terra_raw"] + m["aqua_raw"]
    m.loc[~m["viirs_obs"], "viirs_raw"] = np.nan
    # Naive stitched raw count (what you get if you switch MODIS -> VIIRS in 2012-01 without harmonization)
    m["naive_raw"] = np.where(m.index >= "2012-01", m["viirs_raw"], m["modis_raw"])

    dates = pd.to_datetime(m.index + "-01")
    modis_12m = m["modis_raw"].rolling(12, min_periods=12).sum() / 1e3
    viirs_12m = m["viirs_raw"].rolling(12, min_periods=12).sum() / 1e3
    naive_12m = pd.Series(m["naive_raw"], index=m.index).rolling(12, min_periods=12).sum() / 1e3
    harm_12m = m["harmonized"].rolling(12, min_periods=12).sum() / 1e3

    modis_1m = m["modis_raw"] / 1e3
    viirs_1m = m["viirs_raw"] / 1e3
    harm_1m = m["harmonized"] / 1e3

    # 1600 x 680 px at 100 dpi -> 16 x 6.8 inches
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6.8), dpi=100, sharey=True)
    fig.patch.set_facecolor("#FFFFFF")

    # Colorblind-safe Okabe-Ito / Viridis-inspired palette
    C_MODIS = "#0072B2"   # blue
    C_VIIRS = "#D55E00"   # vermilion / orange
    C_NAIVE = "#7F7F7F"   # grey dashed for stitched raw jump
    C_HARM  = "#009E73"   # bluish green
    C_LINE  = "#333333"

    ymax = max(float(viirs_12m.max()), float(harm_12m.max())) * 1.12

    # --- Left panel: Raw counts (MODIS & VIIRS separate lines) ---
    ax1.plot(dates, modis_1m, color=C_MODIS, alpha=0.18, lw=0.9, label="MODIS monthly raw (Terra + Aqua)")
    ax1.plot(dates, viirs_1m, color=C_VIIRS, alpha=0.18, lw=0.9, label="VIIRS monthly raw (S-NPP + N20 + N21)")
    ax1.plot(dates, naive_12m, color=C_NAIVE, ls=":", lw=1.6, label="Naive stitched 12-mo sum (2012 jump)")
    ax1.plot(dates, modis_12m, color=C_MODIS, lw=2.5, label="MODIS 12-month rolling sum")
    ax1.plot(dates, viirs_12m, color=C_VIIRS, lw=2.5, label="VIIRS 12-month rolling sum")
    ax1.set_title("Before: Raw Sensor Detections (Unnormalized)", fontsize=13, fontweight="bold", pad=10)
    ax1.set_ylabel("Fire detections (thousands, 12-mo sum & monthly)", fontsize=11)

    # Annotate the 2012 jump and 2018/2023 satellite additions on left panel
    ax1.annotate("2012-01: VIIRS starts\n(~8× Aqua sensitivity)",
                 xy=(pd.Timestamp("2012-01-01"), 460), xytext=(pd.Timestamp("2004-06-01"), 780),
                 arrowprops=dict(arrowstyle="->", color=C_LINE, lw=1.0),
                 fontsize=9.5, bbox=dict(boxstyle="round,pad=0.3", fc="#FFF8EB", ec=C_VIIRS, alpha=0.9))
    ax1.annotate("2018-04: NOAA-20 joins\n2023-03: NOAA-21 joins\n(raw counts double/triple)",
                 xy=(pd.Timestamp("2021-06-01"), 1160), xytext=(pd.Timestamp("2012-06-01"), 1180),
                 arrowprops=dict(arrowstyle="->", color=C_LINE, lw=1.0),
                 fontsize=9.5, bbox=dict(boxstyle="round,pad=0.3", fc="#FFF8EB", ec=C_VIIRS, alpha=0.9))

    # --- Right panel: Harmonized series (same axes) ---
    ax2.plot(dates, harm_1m, color=C_HARM, alpha=0.22, lw=0.9, label="Harmonized monthly total (VIIRS-eq.)")
    ax2.plot(dates, harm_12m, color=C_HARM, lw=2.6, label="Harmonized 12-month rolling sum (VIIRS-eq.)")
    ax2.set_title("After: Harmonized VIIRS-Equivalent Series (Monthly Ratio, Jun–Sep Pooled)", fontsize=13, fontweight="bold", pad=10)

    ax2.annotate("2002-07 handover: −0.17σ\n2012-01 handover: +0.81σ\n(within natural variability, zero floor = 0)",
                 xy=(pd.Timestamp("2012-01-01"), 464), xytext=(pd.Timestamp("2003-06-01"), 1120),
                 arrowprops=dict(arrowstyle="->", color=C_LINE, lw=1.0),
                 fontsize=9.5, bbox=dict(boxstyle="round,pad=0.3", fc="#EEFAF4", ec=C_HARM, alpha=0.9))

    # Common formatting & vertical handover markers on both panels
    for ax in (ax1, ax2):
        for h_date, h_lbl, y_frac in [("2002-07-01", "2002-07 (Aqua)", 0.42),
                                      ("2012-01-01", "2012-01 (VIIRS)", 0.58)]:
            ts = pd.Timestamp(h_date)
            ax.axvline(ts, color=C_LINE, ls="--", lw=1.0, alpha=0.75)
            ax.text(ts + pd.Timedelta(days=90), ymax * y_frac, h_lbl,
                    fontsize=8.5, color=C_LINE, rotation=0, va="top",
                    bbox=dict(boxstyle="round,pad=0.18", fc="#FFFFFF", ec="none", alpha=0.8))
        ax.set_ylim(0, ymax)
        ax.set_xlim(pd.Timestamp("2000-06-01"), pd.Timestamp("2026-11-01"))
        ax.xaxis.set_major_locator(mdates.YearLocator(4))
        ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
        ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"{int(x):,}k"))
        ax.grid(True, ls=":", alpha=0.45, color="#AAAAAA")
        ax.legend(loc="upper left", fontsize=9, framealpha=0.92)
        ax.set_xlabel("Year (UTC months)", fontsize=11)

    kind_str = f"DATA: {meta.get('data_kind', 'real').upper()} (NASA FIRMS Archive + NRT through {meta.get('data_through')}, full India 0.25° grid)"
    fig.suptitle(f"India fire detections 2000-2026, NASA FIRMS  [{kind_str}]",
                 fontsize=15, fontweight="bold", y=0.97)
    fig.tight_layout(rect=[0, 0.02, 1, 0.93])
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=100)
    plt.close(fig)
    print(f"wrote {out_path} ({out_path.stat().st_size / 1024:.1f} KB, 1600x680 px)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default="out")
    ap.add_argument("--out", default="science/figures/hero.png")
    a = ap.parse_args()
    build_hero(Path(a.run), Path(a.out))


if __name__ == "__main__":
    main()
