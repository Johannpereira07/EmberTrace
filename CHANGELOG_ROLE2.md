# Changelog: Person 2 (Calibration & Data Engineer)

EmberTrace, NASA Space Apps 2026, Challenge 15 (MODIS/VIIRS hotspot harmonization).
Branch: `p0/planning-folder-add`. Nothing has been pushed to `main`.
Format follows [Keep a Changelog](https://keepachangelog.com/).

## [0.3-monthly-ratio] - 2026-11-15

### Added
- **Calendar-month ratio calibration (`method: "monthly_ratio"`, Jun–Sep pooled) as default (`aa4b2da`):**
  - `pipeline/model/calibrate.py`: added `fit_monthly_ratio` (pooling monsoon months `6, 7, 8, 9` into one shared bucket `sum(y)/sum(x)`) and updated `apply_ratio` / `apply_log_line` to accept a `months` series/array and scale each cell-month by its calendar month's factor.
  - `calibration.json` now includes `"method": "monthly_ratio"`, `"monthly_factors"` (`"1"`..`"12"`), and `"pooled_months": [6, 7, 8, 9]`, while retaining `"factor"`, `"ratio_y_to_x"`, and `"window"` for backward compatibility.
  - `pipeline/tests/model/test_calibrate.py`: added `test_monthly_ratio_zero_stays_zero`, `test_monthly_ratio_picks_factor_by_calendar_month`, and `test_monthly_ratio_pooled_monsoon_shares_factor` (`63 passed` across `pipeline/tests`).
- **Hero figure (`CAL-7`):** `science/hero_figure.py` → `science/figures/hero.png` (`1600×680 px`, comparing unnormalized MODIS/VIIRS raw counts vs harmonized VIIRS-equivalent series on shared axes).
- **One-command real-data runbook (`CAL-8`):** `science/real_report.py` → `out/real_report/report.md`, `overlap_*.png`, and CSV tables (`holdout_*.csv`, `yearly_ratios_*.csv`, `deseasonalized_splice.csv`, `viirs_satellite_composition.csv`).
- **Cell size check (`CAL-6`):** Verified `0.25°` (`4,651` cells, `2.3 MB` Parquet, cell-level `r = 0.890` Aqua→VIIRS, `0.658` Terra→Aqua) vs `0.50°` (`1,259` cells, cell-level `r = 0.913` / `0.730`, identical regional factors and hold-out errors). Confirmed `0.25°`.
- **Explainer & slide copy (`CAL-10`):** `docs/explainer.md` and full calibration report `docs/11-calibration-report.md`.

### Changed
- Re-exported `data/cell_month.parquet`, `data/meta.json` (`pipeline_version: "0.3-monthly-ratio"`), and `data/calibration.json` from the full India run.
- Hold-out comparison (`single factor` vs `monthly_ratio` with Jun–Sep pooled):

  | Pair | Method | Train | Test | Hold-Out `corr` | Hold-Out `MAPE` | **Median Abs % Error** | `mean(pred/actual)` |
  |---|---|---|---|---|---|---|---|
  | **Aqua → VIIRS** | Single factor (`8.005`) | `2012-01..2017-07` | `2017-08..2019-12` | `0.9566` | `27.7%` | `19.8%` | `0.939` |
  | **Aqua → VIIRS** | **Calendar-month (`monthly_ratio`)** | `2012-01..2017-07` | `2017-08..2019-12` | **`0.9958`** | **`23.3%`** | **`8.7%`** | **`1.168`** |
  | **Terra → Aqua** | Single factor (`2.831`) | `2002-08..2009-02` | `2009-03..2011-12` | `0.8744` | `97.0%` | `68.0%` | `1.764` |
  | **Terra → Aqua** | **Calendar-month (`monthly_ratio`)** | `2002-08..2009-02` | `2009-03..2011-12` | **`0.9726`** | **`27.6%`** | **`24.1%`** | **`1.096`** |

- Updated deseasonalized splice check (`science/splice_placebo.py`, placebo `217` months: `mean = 1.0501`, `std = 0.2649`):
  - `2002-07`: `309,138` → `310,320` (`×1.004`, **`-0.17σ`**)
  - `2012-01`: `367,356` → `464,257` (`×1.264`, **`+0.81σ`**)
  - `2023-03`: `478,402` → `375,117` (`×0.784`, **`-1.00σ`**)

### Updated Limitations (for the Limitations slide)
- Prediction is slightly high on average for Aqua→VIIRS (`mean(pred/actual) = 1.17`).
- The pooled Jun–Sep factor for Aqua→VIIRS is `16.67` (~17), roughly double the other months (`5.0–12.3`); monsoon calibration is least certain because fire counts are tiny.
- `2012-01` shows a `+26%` rise (`×1.264`, `+0.81σ`) in the 12 months after the handover; within normal year-to-year variation (`±26.5%`), but a rise rather than a flat line.

---

## [0.2-ratio-of-totals] - 2026-11-15

### Added
- `science/placebo_lib.py` and `science/splice_placebo.py`: deseasonalized splice check. For each handover it computes the 12-month sum after divided by the 12-month sum before, and compares it with the same statistic at 217 non-handover (placebo) months. Results are reported as a z-score. `science/splice_check.py` is kept as is. (`8dc3dac`)
- `test_zero_floor_is_caught`, restored: proves the splice check flags a series with a positive floor.
- `test_zero_floor_is_eliminated` and `test_deseasonalized_placebo_ratio` in `pipeline/tests/model/test_splice_check.py`.
- `pipeline/tests/model/test_calibrate.py`: 11 tests covering zero stays zero, NaN stays NaN, Series preservation, refusal of tiny samples (under 30 cell-months), recovery of a planted ratio, hold-out MAPE excluding zero actuals, and zero versus NaN staying distinct.
- `scripts/profile_raw.py`: profiles the raw FIRMS archive (row counts, date ranges, columns, confidence letters, `type` values).
- `calibration.json`: new field `method` (`ratio_of_totals`).

### Changed
- **Calibration method is now ratio-of-totals (Option C).** One multiplicative factor per satellite pair, no intercept, no log transform. A raw 0 stays 0 and NaN stays NaN. (`3b085f0`)
  - `pipeline/model/calibrate.py`: added `fit_ratio_totals` and `apply_ratio`. `fit_log_line` takes a `method` parameter and `apply_log_line` dispatches on `cal["method"]`.
  - `holdout_check` now reports MAPE at monthly-total level, with zero-actual months excluded.
  - `slope` and `intercept` are `null` in `calibration.json`. Nothing outside `pipeline/model/` reads them.
- `pipeline/model/calendar.py`: a zero median is now `not_defined` (blank/NaN), never `inf`. Closes the known issue in `AGENTS.md`.
- `science/splice_check.py`: `as_viirs_equiv` and `check_source_handover` accept an `apply_fn` parameter.
- `pipeline/model/harmonize.py`: accepts `apply_fn`.
- `planning/` folder added to the repo (PRD, API spec, team plan, methodology docs, NASA-FIRMS emails, `verified_constants.md`). (`159a4a9`, `33d6450`)

### Fixed
- **Zero-to-positive bug.** The old log1p fit had a positive intercept, so a raw 0 became about 3.22 (Aqua) or 18.26 (Terra). This created a fake floor and caused the splice failures (2002-07 ×0.38, 2012-01 ×0.77).
- **Hold-out error units.** `monthly_total_mean_abs_pct_error` in `calibration.json` is a **fraction**, not a percent. Aqua→VIIRS is 27.7% (0.2768) and Terra→Aqua is 97.0% (0.9704). Earlier summaries that read 0.28% and 0.97% were wrong.

### Verified
- Real FIRMS archive is in `data/raw/` and is gitignored (`.gitignore` line 9; `git status` clean).

  | Folder | Product | Rows | Date range |
  |---|---|---|---|
  | `DL_FIRE_M-C61_845077` | MODIS Terra+Aqua | 1,917,344 | 2000-11-01 to 2026-08-31 |
  | `DL_FIRE_SV-C2_845080` | VIIRS S-NPP | 8,726,813 | 2012-01-20 to 2026-07-31 |
  | `DL_FIRE_J1V-C2_845078` | VIIRS NOAA-20 | 5,109,832 | 2018-04-01 to 2026-07-31 |
  | `DL_FIRE_J2V-C2_845079` | VIIRS NOAA-21 | 2,135,511 | 2023-03-01 to 2026-07-31 |

- `type` column exists in all VIIRS files (about 88% vegetation fire, 10-12% static source, 0.2% offshore). Confidence letters l/n/h are present. MODIS `satellite` column separates Terra (594,430) from Aqua (1,322,914).
- Pipeline runs end to end on real data: 18,035,986 detections loaded, `data_through` 2026-11-13, `provisional_from` 2026-08.
- `make test`: 60 passed.
- `calibration.json` readers outside `pipeline/model/` (`pipeline/export.py`, `scripts/build_story_data.py`) do not break on `null` slope/intercept.
- VIIRS series: ingest divides the combined VIIRS count by the number of active satellites. The normalized series matches S-NPP-only within 1.5% (2018-2025). The Aqua→VIIRS factor changes by 0.045% when refit on S-NPP only (7.9791 vs 7.9755). Decision: keep the combined series, since S-NPP stopped on 2026-11-02.

## Calibration results (real data, full India)

| Pair | Factor | Fit window | Hold-out monthly-total corr | MAPE | Median abs % error | mean(pred/actual) |
|---|---|---|---|---|---|---|
| Aqua → VIIRS | 8.00 | 2012-01..2019-12 | 0.957 | 27.7% | 19.8% | 0.94 |
| Terra → Aqua | 2.83 | 2002-08..2011-12 | 0.874 | 97.0% | 68.0% | 1.76 |

Yearly overlap ratio: Aqua→VIIRS ranges 7.47 to 8.51 (about +10% drift 2012 to 2019). Terra→Aqua ranges 2.34 to 3.24.

### Deseasonalized splice check (placebo: 217 months, mean 1.053, std 0.270)

| Handover | Step (after / before) | z-score |
|---|---|---|
| 2002-07 (Terra → Aqua) | ×0.890 | -0.60σ |
| 2012-01 (Aqua → VIIRS) | ×1.226 | +0.64σ |
| 2023-03 (NOAA-21 joins) | ×0.784 | -1.00σ |

## Known limitations (for the Limitations slide)
- The splice check only detects large steps. Natural year-to-year variability is about ±27%, so a pass means "no step larger than roughly 50%". The overlap fit is the real evidence for calibration.
- Terra→Aqua is not reliable month by month. Errors are seasonal: the prediction is too high in May-Sep (2-4×) and too low in Oct-Nov (0.2-0.4×). Use 2000-2011 values for yearly and seasonal patterns only. The overpass-time explanation (10:30 vs 13:30) is a hypothesis, not tested.
- Aqua→VIIRS ratio drifts about 10% over 2012-2019. Treat the factor as ±10%.
- The older `make splice-check` still fails 2012-01 (×0.94 vs 0.95-1.05) and 2023-03 (×1.56). Both are within placebo noise or expected sensor-count changes. Tolerances in `config.yaml` were not changed.
- NOAA-21 detected about 23.5% fewer fires than S-NPP in 2023 (spin-up), which pulls the 3-satellite average down by about 2% that year.

## Open items
- [x] Hero figure `science/figures/hero.png` (CAL-7)
- [x] One-command real-data report and runbook (`science/real_report.py`, CAL-8)
- [ ] Rename hold-out fields in `calibration.json` to make the fraction units explicit (e.g. `..._fraction`)
- [x] Optional: per-calendar-month calibration factors (`monthly_ratio`, Jun–Sep pooled), adopted after median error dropped `19.8% -> 8.7%` (Aqua→VIIRS) and `68.0% -> 24.1%` (Terra→Aqua)
- [x] Explainer text for Person 4 (`docs/explainer.md`, CAL-10) and two slides for Person 5 (`docs/explainer.md` §2)
- [x] Re-run 12-vs-12 audit for 2018-04 and confirm one consistent number (`×0.691` on `viirs_count_norm` vs `×0.683` on `snpp_norm`, confirmed in `out/real_report/viirs_satellite_composition.csv`)

## Notes for teammates
- **Person 1 (ingest):** no change needed. `v : I audited viirs_count_norm (S-NPP + NOAA-20 + NOAA-21 divided by platform_weight) against an S-NPP-only normalized series (snpp_norm)

Your platform_weight normalization in aggregate.py works: viirs_count_norm agrees with snpp_norm within 0.1%–1.5% from 2018–2025, and the Aqua→VIIRS factor changes by only 0.045% (7.9791 vs 7.9755).
Recommendation: keep the PRD's combined normalized VIIRS series (viirs_count_norm), do not switch to S-NPP-only. S-NPP stopped producing FIRMS data on 2026-11-02, so an S-NPP-only series would go NaN from Nov 2026 onward, whereas the combined normalized series continues seamlessly with NOAA-20 + NOAA-21.
One caveat for Limitations: In 2023, NOAA-21 detected 23.5% fewer fires than S-NPP (N21/SNPP = 0.765 during spin-up), which pulls the 3-satellite average down by ~2% in 2023 (12m step ×0.784 vs ×0.800 on S-NPP 
alone)iirs_count_norm` is consistent with S-NPP-only. Keep the combined VIIRS series.
- **Person 3 (export/API):** `pipeline/export.py` line 25, `DEFAULT_VERSION = "0.1-calibration-pending"`, should be updated now that the calibration fix is in. `calibration.json` now includes `"method": "ratio_of_totals"` with `slope` and `intercept` as `null`. A zero median now returns blank, not `inf`.

## Notes
- Go/no-go on real versus synthetic data for the demo is decided Sunday 12:00 and is separate from the calibration fix.
- Two audit runs gave different 12-vs-12 values at 2018-04 for the normalized VIIRS series (×0.859 in the raw log vs ×0.691 in the report table). 2023-03 matched (×0.784). Both are within about ±1.3σ of the placebo spread, but the exact figure should be re-checked before it appears on a slide.