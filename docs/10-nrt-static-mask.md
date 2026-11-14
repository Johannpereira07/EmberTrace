# NRT static-source mask (ING-11)

**Date:** 14 Nov 2026 · **By:** Person 1 · **Code:** `pipeline/ingest/static_mask.py` · **Settings:** `pipeline/config.yaml` → `nrt_static_mask` (provisional)

## The problem

Archive files tag every detection with `type`: 0 vegetation fire, 1 volcano, 2 other static land source (industry, gas flares), 3 offshore. We keep only type 0. **NRT files (Aug to Nov 2026 in our data) have no `type`**, so their factories and flares were counted as fires.

Earlier docs gave the overcount as "5% (MODIS), 12–14% (VIIRS)". **That's a yearly average, and it badly understates the problem in the months that matter.** In the monsoon there are few vegetation fires, so static sources make up most detections:

| VIIRS, archive 2025 (true `type` known) | Jul | Aug | Sep | Oct | Nov |
|---|---|---|---|---|---|
| Share of type 1/2/3 among nominal/high detections | 44% | **70%** | 69% | 43% | 20% |

So without a fix, the NRT months Aug to Oct 2026 (the "current" months users compare with history) would be **2 to 4× too high**.

## The fix

1. **Build the mask** from archive rows with type 1/2/3: every square of `cell_deg` with at least `min_hits` such detections, separately for MODIS and VIIRS. Optionally grow it by `dilate` squares.
2. **Apply it to NRT rows only**: drop NRT detections inside the mask, before counting. Archive rows are never masked; they use the real `type`.
3. **Log it**: `pipeline/run.py` prints the rows dropped per sensor and month and writes them to `normalized.meta.json` → `nrt_static_mask`.

## Validation (`scripts/validate_static_mask.py`)

Done on **archive** data, where the true answer is known: build the mask from archive rows before a date, apply it to archive rows after that date **ignoring their `type`** (as if they were NRT), and compare with the true type 0 counts. Confidence filter (nominal/high) as in the pipeline.

To avoid tuning the reported error, **settings were chosen on one window and the error is reported on another**:

- **Tuning:** mask from data before 2026-01-01, tested on Jan to Apr 2026, grid `cell_deg` {0.005, 0.01, 0.02} × `min_hits` {1, 2, 3, 5} × `dilate` {0, 1}. Best mean per-cell error: **0.005° (≈ 500 m), min_hits 5, dilate 0** (MODIS 1.3%, VIIRS 1.6%). Growing the mask (`dilate` 1) was always worse: it drops real fires near static sources.
- **Reporting:** mask from data before 2026-05-01, tested on May to Aug 2026, chosen setting only:

| Month | Sensor | True vegetation fires | Without mask | With mask | Error with mask |
|---|---|---|---|---|---|
| 2026-05 | VIIRS | 167,425 | +11.2% | 165,632 | −1.1% |
| 2026-06 | VIIRS | 32,458 | +35.9% | 31,634 | −2.5% |
| 2026-07 | VIIRS | 3,909 | **+64.0%** | 3,747 | −4.1% |
| 2026-05 | MODIS | 7,050 | +7.7% | 7,140 | +1.3% |
| 2026-06 | MODIS | 1,092 | +31.2% | 1,115 | +2.1% |
| 2026-07 | MODIS | 169 | +43.8% | 171 | +1.2% |
| 2026-08 | MODIS | 150 | +54.7% | 151 | +0.7% |

Over the whole May to Aug window: static detections the mask misses are 1.9% (MODIS) / 0.2% (VIIRS) of true; real fires it wrongly drops are 0.5% / 1.5%; per 0.25° cell-month error (offsetting errors count) is 2.3% / 1.5%.

**Remaining error to report as a limitation:** after masking, NRT months are within about **±4%** of the true vegetation count (VIIRS slightly low, MODIS slightly high), worst in the monsoon.

## Effect on the full India run

| Month (NRT) | VIIRS before → after | Aqua before → after |
|---|---|---|
| 2026-08 | 6,759 → 2,718 (−60%) | 73 → 73 (MODIS NRT starts 2026-09) |
| 2026-09 | 19,385 → 5,108 (−74%) | 270 → 127 (−53%) |
| 2026-10 | 58,804 → 31,131 (−47%) | 1,964 → 1,670 (−15%) |
| 2026-11 (partial) | 35,796 → 28,235 (−21%) | 5,811 → 5,706 (−2%) |

These match the 2025 static shares above. Only NRT months change, counts only go down, and archive months, raw detections and calibration are byte-identical. Mask size: 1,626 MODIS and 3,695 VIIRS squares; 54,881 nominal/high NRT rows dropped (MODIS 1,329, VIIRS 53,552).

## Limits

- Settings are **provisional**: chosen on one 4-month window, checked on another. New static sources that appeared after the archive ends can't be in the mask.
- A real vegetation fire inside a masked square is dropped (≈ 1.5% for VIIRS).
- Rerun `scripts/validate_static_mask.py` after any new data download.
