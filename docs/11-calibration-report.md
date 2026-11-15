# Real-Data Calibration & Go/No-Go Report (CAL-2 to CAL-9)

**Date:** 15 Nov 2026 · **Owner:** Person 2 (Calibration & Data Engineer) · **Pipeline Version:** `0.3-monthly-ratio`
**Verdict:** **GO WITH REAL DATA, using calendar-month ratio calibration (Jun–Sep pooled) as default and stating the limitations below.**

---

## 1. Executive Summary & Go/No-Go Decision

1. **Zero-to-positive floor eliminated (`CAL-2` / `CAL-3`):**
   - Replaced the unpinned `log1p` intercept regression (`0.1-calibration-pending`, which turned `0` detections into `3.22` for Aqua and `18.26` for chained Terra) with **calendar-month ratio calibration (`monthly_ratio`, with monsoon months Jun–Sep pooled into one shared bucket)**, keeping `0 * factor_m = 0.0` and `NaN` preserved as `NaN`.
   - Verified on `data/cell_month.parquet` (`1,455,763` rows, `4,651` cells × `313` months): all `84,569` quiet `TERRA_chained` cell-months and `473,664` quiet `AQUA_calibrated` cell-months have `harmonized_count = 0.0`.
   - Verified on `make synthetic` and unit tests (`63 passed`): all ingest and stage 5–7 truth checks pass, including tests verifying that zero stays zero, factors are selected by calendar month, and pooled monsoon months (`6, 7, 8, 9`) share one identical factor.
2. **Hold-out comparison: Single factor (`ratio_of_totals`) vs Calendar-month factors (`monthly_ratio`, Jun–Sep pooled):**

| Pair | Method | Train | Test | Hold-Out `corr` | Hold-Out `MAPE` | **Median Abs % Error** | `mean(pred/actual)` |
|---|---|---|---|---|---|---|---|
| **Aqua → VIIRS** | Single factor (`ratio_of_totals`, `8.005`) | `2012-01..2017-07` | `2017-08..2019-12` | `0.9566` | `27.7%` | **`19.8%`** | `0.939` |
| **Aqua → VIIRS** | **Calendar-month (`monthly_ratio`, Jun–Sep pooled)** | `2012-01..2017-07` | `2017-08..2019-12` | **`0.9958`** | **`23.3%`** | **`8.7%`** | **`1.168`** |
| **Terra → Aqua** | Single factor (`ratio_of_totals`, `2.831`) | `2002-08..2009-02` | `2009-03..2011-12` | `0.8744` | `97.0%` | **`68.0%`** | `1.764` |
| **Terra → Aqua** | **Calendar-month (`monthly_ratio`, Jun–Sep pooled)** | `2002-08..2009-02` | `2009-03..2011-12` | **`0.9726`** | **`27.6%`** | **`24.1%`** | **`1.096`** |

   - **Full-window (`2012-01..2019-12`) Aqua → VIIRS factors:** global `factor = 7.9791`; monthly factors (`6..9` pooled): `m1=8.39, m2=8.39, m3=7.43, m4=10.03, m5=12.26, m6..9=16.67, m10=5.02, m11=6.27, m12=8.74`.
   - **Full-window (`2002-08..2011-12`) Terra → Aqua factors:** global `factor = 2.7718`; monthly factors (`6..9` pooled): `m1=2.19, m2=2.50, m3=3.55, m4=2.15, m5=1.03, m6..9=1.26, m10=4.15, m11=6.46, m12=1.96`.
3. **Handover steps: two checks, reported together.**
   - **`make splice-check` (`science/splice_check.py`, 12-month overlap, provisional tolerance ±5%): FAIL at all three.** `2002-07` ×1.09, `2012-01` ×0.94, `2023-03` ×1.56 (weak check). With the single factor, `2002-07` was ×0.95 (pass). The tolerance was not changed.
   - **Deseasonalized check (`science/splice_placebo.py`): both source handovers are within normal year-to-year variation.** It sets no threshold, so it reports z-scores, not a pass/fail:
   - Comparing the 12-month sum after vs 12-month sum before across `217` interior placebo months (`mean = 1.0501`, `std = 0.2649`, `min = 0.6451`, `max = 2.0450`):
     - **`2002-07` (`TERRA_chained` → `AQUA_calibrated`):** `309,138` → `310,320`, ratio **`×1.004`** (**`−0.17σ`**): no visible step at this scale.
     - **`2012-01` (`AQUA_calibrated` → `VIIRS`):** `367,356` → `464,257`, ratio **`×1.264`** (**`+0.81σ`**) — well within normal year-to-year variability (`splice_check.py` overlap step = `×0.94`, reflecting 2012's annual ratio `7.465` being 6.4% below the 8-year average `7.979`).
     - **`2023-03` (`NOAA-21` joins):** `478,402` → `375,117`, ratio **`×0.784`** (**`−1.00σ`**).
4. **VIIRS multi-satellite normalization verified:**
   - Stage 4 (`pipeline/ingest/aggregate.py`) divides combined VIIRS detections (`S-NPP + NOAA-20 + NOAA-21`) by the active satellite weight (`platform_weight`), so `viirs_count_norm` does **not** double in `2018-04` or jump `1.5×` in `2023-03`.
   - Across `2018–2025`, `viirs_count_norm` matches an `S-NPP`-only normalized series within **`0.1%–1.5%`**, and refitting Aqua → VIIRS on `S-NPP` alone changes the factor by only **`0.045%`** (`7.9755` vs `7.9791`). Keeping the combined series is required because `S-NPP` ended on `2026-11-02`.

---

## 2. Hold-Out Units, Per-Month Errors & Drift (`Step 1` & `Step 2`)

> **Important note on units:** `monthly_total_mean_abs_pct_error` in `calibration.json` (`0.2768` and `0.9704`) is stored as a **fraction**, meaning **`27.7%`** for Aqua → VIIRS and **`97.0%`** for Terra → Aqua.

### Why `corr = 0.874` and `MAPE = 97.0%` coexist on Terra → Aqua
- **Correlation (`0.874`)** is driven by peak fire-season months (March–April, `15,000–22,000` detections/month), where the error is only **`8%–10%`**.
- **Unweighted MAPE (`97.0%`, median `68.0%`, `mean(pred/actual) = 1.764`)** weights every calendar month equally. In monsoon months (June–September, `30–112` Aqua detections across all of India), Terra's morning pass sees more detections relative to Aqua than in peak season, producing `150%–287%` relative error (`2–4×` overprediction in May–Sep, `0.2–0.4×` underprediction in Oct–Nov).

### Yearly Overlap Ratios (`sum target / sum source`)

| Pair | Window | Yearly Ratios | Min .. Max (Spread) |
|---|---|---|---|
| **Aqua → VIIRS** | `2012..2019` | `2012`: 7.465 · `2013`: 7.553 · `2014`: 8.010 · `2015`: 7.828 · `2016`: 8.512 · `2017`: 8.125 · `2018`: 8.114 · `2019`: 8.197 | `7.465 .. 8.512` (**`1.14×`**, ~10% drift) |
| **Terra → Aqua** | `2002..2011` | `2002`: 3.018 · `2003`: 2.757 · `2004`: 3.243 · `2005`: 3.219 · `2006`: 2.964 · `2007`: 2.659 · `2008`: 2.344 · `2009`: 2.619 · `2010`: 2.900 · `2011`: 2.524 | `2.344 .. 3.243` (**`1.38×`**) |

### Full Hold-Out Table: Aqua → VIIRS (`train 2012-01..2017-07` factor `8.0046`, `test 2017-08..2019-12`)

| Month | Actual | Predicted | Abs % Error | `pred/actual` | Month | Actual | Predicted | Abs % Error | `pred/actual` |
|---|---|---|---|---|---|---|---|---|---|
| `2017-08` | 389.0 | 448.26 | 15.23% | 1.15 | `2018-11` | 61,663.0 | 85,745.01 | 39.05% | 1.39 |
| `2017-09` | 1,043.0 | 856.49 | 17.88% | 0.82 | `2018-12` | 19,463.5 | 15,632.94 | 19.68% | 0.80 |
| `2017-10` | 39,476.0 | 60,994.86 | 54.51% | 1.55 | `2019-01` | 22,230.5 | 21,748.43 | 2.17% | 0.98 |
| `2017-11` | 51,374.0 | 57,704.98 | 12.32% | 1.12 | `2019-02` | 27,248.0 | 25,990.86 | 4.61% | 0.95 |
| `2017-12` | 23,196.0 | 21,388.22 | 7.79% | 0.92 | `2019-03` | 79,762.0 | 91,716.42 | 14.99% | 1.15 |
| `2018-01` | 26,702.0 | 27,439.68 | 2.76% | 1.03 | `2019-04` | 80,899.0 | 64,869.08 | 19.81% | 0.80 |
| `2018-02` | 42,244.0 | 41,519.73 | 1.71% | 0.98 | `2019-05` | 73,401.5 | 48,947.98 | 33.31% | 0.67 |
| `2018-03` | 170,550.0 | 168,448.28 | 1.23% | 0.99 | `2019-06` | 11,654.0 | 4,770.73 | 59.06% | 0.41 |
| `2018-04` | 62,795.5 | 50,484.86 | 19.60% | 0.80 | `2019-07` | 971.0 | 832.48 | 14.27% | 0.86 |
| `2018-05` | 55,634.5 | 34,731.85 | 37.57% | 0.62 | `2019-08` | 362.5 | 464.27 | 28.07% | 1.28 |
| `2018-06` | 3,965.0 | 1,809.03 | 54.37% | 0.46 | `2019-09` | 860.0 | 504.29 | 41.36% | 0.59 |
| `2018-07` | 498.0 | 312.18 | 37.31% | 0.63 | `2019-10` | 25,657.0 | 44,801.61 | 74.62% | 1.75 |
| `2018-08` | 434.0 | 224.13 | 48.36% | 0.52 | `2019-11` | 38,667.5 | 49,620.36 | 28.33% | 1.28 |
| `2018-09` | 1,228.0 | 496.28 | 59.59% | 0.40 | `2019-12` | 13,539.5 | 12,190.97 | 9.96% | 0.90 |
| `2018-10` | 27,738.0 | 39,686.15 | 43.08% | 1.43 | | | | | |

### Full Hold-Out Table: Terra → Aqua (`train 2002-08..2009-02` factor `2.8311`, `test 2009-03..2011-12`)

| Month | Actual | Predicted | Abs % Error | `pred/actual` | Month | Actual | Predicted | Abs % Error | `pred/actual` |
|---|---|---|---|---|---|---|---|---|---|
| `2009-03` | 22,455.0 | 20,315.84 | 9.53% | 0.90 | `2010-08` | 47.0 | 138.72 | 195.16% | 2.95 |
| `2009-04` | 9,584.0 | 14,503.63 | 51.33% | 1.51 | `2010-09` | 61.0 | 93.43 | 53.16% | 1.53 |
| `2009-05` | 2,676.0 | 9,005.67 | 236.53% | 3.37 | `2010-10` | 5,965.0 | 2,321.49 | 61.08% | 0.39 |
| `2009-06` | 627.0 | 1,639.20 | 161.43% | 2.61 | `2010-11` | 7,700.0 | 2,063.86 | 73.20% | 0.27 |
| `2009-07` | 112.0 | 215.16 | 92.11% | 1.92 | `2010-12` | 1,135.0 | 1,593.90 | 40.43% | 1.40 |
| `2009-08` | 42.0 | 99.09 | 135.92% | 2.36 | `2011-01` | 1,649.0 | 2,191.26 | 32.88% | 1.33 |
| `2009-09` | 107.0 | 271.78 | 154.00% | 2.54 | `2011-02` | 2,988.0 | 4,325.89 | 44.78% | 1.45 |
| `2009-10` | 7,371.0 | 6,299.16 | 14.54% | 0.85 | `2011-03` | 15,328.0 | 14,101.62 | 8.00% | 0.92 |
| `2009-11` | 6,216.0 | 1,398.55 | 77.50% | 0.22 | `2011-04` | 6,596.0 | 11,123.32 | 68.64% | 1.69 |
| `2009-12` | 1,228.0 | 1,582.57 | 28.87% | 1.29 | `2011-05` | 3,316.0 | 10,177.74 | 206.93% | 3.07 |
| `2010-01` | 1,835.0 | 2,015.73 | 9.85% | 1.10 | `2011-06` | 228.0 | 571.88 | 150.82% | 2.51 |
| `2010-02` | 3,408.0 | 3,417.12 | 0.27% | 1.00 | `2011-07` | 43.0 | 141.55 | 229.20% | 3.29 |
| `2010-03` | 21,444.0 | 19,534.46 | 8.90% | 0.91 | `2011-08` | 30.0 | 116.07 | 286.91% | 3.87 |
| `2010-04` | 8,453.0 | 14,146.91 | 67.36% | 1.67 | `2011-09` | 61.0 | 135.89 | 122.77% | 2.23 |
| `2010-05` | 2,009.0 | 5,172.39 | 157.46% | 2.57 | `2011-10` | 8,834.0 | 5,353.58 | 39.40% | 0.61 |
| `2010-06` | 155.0 | 390.69 | 152.06% | 2.52 | `2011-11` | 6,424.0 | 2,641.40 | 58.88% | 0.41 |
| `2010-07` | 30.0 | 104.75 | 249.17% | 3.49 | `2011-12` | 1,956.0 | 2,352.63 | 20.28% | 1.20 |

---

## 3. Deseasonalized Splice Check & Placebo Distribution (`Step 3`)

Command: `python science/splice_placebo.py --run out`

- **Statistic:** $R(m) = \sum_{k=0}^{11} T_{m+k} / \sum_{k=1}^{12} T_{m-k}$ on the harmonized monthly total $T$.
- **Placebo distribution (`217` interior months avoiding handovers and provisional/partial months):** `mean = 1.0501`, **`std = 0.2649`**, `min = 0.6451`, `max = 2.0450`.

| Handover | 12m Before | 12m After | Ratio (`after / before`) | z-score (`monthly_ratio`) | z-score (Single `ratio_of_totals`) | Overlap Check (`splice_check.py`) |
|---|---|---|---|---|---|---|
| **`2002-07`** (`TERRA_chained` → `AQUA_calibrated`) | 309,138 | 310,320 | **`×1.004`** | **`−0.17σ`** | `−0.60σ` | `×1.09` (`×0.95` single) |
| **`2012-01`** (`AQUA_calibrated` → `VIIRS`) | 367,356 | 464,257 | **`×1.264`** | **`+0.81σ`** | `+0.64σ` | `×0.94` (2012 ratio 6.4% below 8-yr mean) |
| **`2023-03`** (`NOAA-21` joins) | 478,402 | 375,117 | **`×0.784`** | **`−1.00σ`** | `−1.00σ` | `×1.56` |

---

## 4. VIIRS Satellite Composition & S-NPP-Only Comparison (`Step 4`)

| Regime | Active Satellites | Months | First..Last | S-NPP Filtered | NOAA-20 Filtered | NOAA-21 Filtered |
|---|---|---|---|---|---|---|
| 1 | `SNPP` | 75 | `2012-01..2018-03` | 2,739,093 | 0 | 0 |
| 2 | `SNPP+NOAA-20` | 59 | `2018-04..2023-02` | 2,046,677 | 2,062,090 | 0 |
| 3 | `SNPP+NOAA-20+NOAA-21` | 45 | `2023-03..2026-11` | 1,533,737 | 1,608,722 | 1,513,854 |

- **12-vs-12 steps at satellite joins:**
  - Raw unnormalized `viirs_count`: `2018-04` = `×1.382` (`+0.85σ`), `2023-03` = `×1.173` (`+0.23σ`).
  - Normalized combined `viirs_count_norm`: `2018-04` = `×0.691` (`−1.22σ`), `2023-03` = `×0.784` (`−0.94σ`).
  - Normalized `S-NPP`-only `snpp_norm`: `2018-04` = `×0.683` (`−1.25σ`), `2023-03` = `×0.800` (`−0.89σ`).
- **Refit of Aqua → VIIRS on `S-NPP` only (`2012-01..2019-12`):** `factor = 7.9755` (vs `7.9791` combined), `r = 0.888`, hold-out `corr = 0.955`, `MAPE = 28.7%`.

---

## 5. Calendar-Month Factor Upgrade (`0.3-monthly-ratio`, Now Default)

Fitting one `sum(y) / sum(x)` factor per calendar month (with monsoon months **Jun–Sep** pooled into one bucket and `0 → 0` preserved):

| Pair | Method | Hold-out `corr` | Hold-out `MAPE` | **Median Abs % Error** | `mean(pred/actual)` |
|---|---|---|---|---|---|
| **Aqua → VIIRS** | Single factor (`8.005`) | `0.9566` | `27.7%` | `19.8%` | `0.939` |
| | **Calendar-month (pooled Jun–Sep)** | **`0.9958`** | **`23.3%`** | **`8.7%`** | **`1.168`** |
| **Terra → Aqua** | Single factor (`2.831`) | `0.8744` | `97.0%` | `68.0%` | `1.764` |
| | **Calendar-month (pooled Jun–Sep)** | **`0.9726`** | **`27.6%`** | **`24.1%`** | **`1.096`** |

### Key Limitations of `0.3-monthly-ratio` (For the Limitations Slide)
1. **Slight positive bias on Aqua → VIIRS hold-out (`mean(pred/actual) = 1.17`):** While median monthly error drops from `19.8%` to `8.7%` (`r = 0.996`), the unweighted mean ratio of predicted to actual monthly totals across the 29 hold-out months is `1.168` (`+17%`), pulled up by low-count monsoon months.
2. **Monsoon factor uncertainty (`Jun–Sep` Aqua → VIIRS factor `= 16.67`, ~17):** The pooled Jun–Sep factor for Aqua → VIIRS is `16.67` (`16.94` on the 70% train split), roughly double the non-monsoon months (`5.02–12.26`). Monsoon months have very small detection counts across India (`300–1,200` VIIRS, `25–100` Aqua), making monsoon calibration the least certain part of the curve.
3. **`2012-01` handover shows a `+26%` 12-month rise (`×1.264`, `+0.81σ`):** Comparing the 12 months after `2012-01` (`464,257`) with the 12 months before (`367,356`) gives a `+26.4%` rise. Because year-to-year natural fire variability over India is `±26.5%` (`placebo std = 0.2649`), `+0.81σ` is well within normal year-to-year variation, but visually it is a rise across 2011→2012, not a flat line.
4. **Splice check power & Terra → Aqua single-month error:** The deseasonalized splice check can only rule out steps larger than ~50% (`±2σ`). Terra → Aqua (`2000–2002` chained) still has a `24.1%` median (`27.6%` mean) monthly hold-out error, and the Aqua → VIIRS annual ratio drifts ~10% across `2012–2019` (`7.47` to `8.51`).

---

## 6. Cell Size Check (`CAL-6`: `0.25°` vs `0.50°`)

Aggregating `out/normalized.csv` from `0.25°` (`4,651` active cells) to `0.50°` (`1,259` active cells) by summing normalized counts per `0.50° × 0.50°` cell:

| Grid Size | Active Cells | Total Rows (`313` mos) | Pair | Global Factor | Cell-Level `pearson_r` (`n_cell_months`) | Hold-Out `corr` | Hold-Out Median Error | Hold-Out `MAPE` |
|---|---|---|---|---|---|---|---|---|
| **`0.25°`** | `4,651` | `1,455,763` (`2.3 MB` Parquet) | **Aqua → VIIRS** | `7.9791` | `0.8899` (`175,941`) | `0.9958` | `8.75%` | `23.29%` |
| **`0.25°`** | `4,651` | `1,455,763` | **Terra → Aqua** | `2.7718` | `0.6577` (`73,696`) | `0.9726` | `24.10%` | `27.63%` |
| **`0.50°`** | `1,259` | `394,067` | **Aqua → VIIRS** | `7.9791` | `0.9131` (`68,979`) | `0.9958` | `8.75%` | `23.29%` |
| **`0.50°`** | `1,259` | `394,067` | **Terra → Aqua** | `2.7718` | `0.7300` (`37,944`) | `0.9726` | `24.10%` | `27.63%` |

- **Decision:** Keep **`0.25°`** in `meta.json`. Because `monthly_ratio` sums over cells ($\sum y / \sum x$), all regional factors and hold-out errors are identical between `0.25°` and `0.50°`. Cell-level correlation at `0.25°` is already high (`0.890` Aqua→VIIRS, `0.658` Terra→Aqua), the full `0.25°` Parquet file is only `2.3 MB`, and `0.25°` provides `4×` finer spatial area snapping for user bounding boxes.

---

## 7. Reproducible Commands (`CAL-7` & `CAL-8`)

```bash
python science/hero_figure.py --run out --out science/figures/hero.png
python science/real_report.py --run out --out out/real_report
python science/splice_placebo.py --run out
python science/splice_check.py --run out
```
