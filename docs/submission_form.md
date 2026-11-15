# EmberTrace — NASA Space Apps 2026 Submission Package (Challenge 15)

> **For the Team — How to Use This File:**
> - **Part I (Sections 1–8 below)** contains the exact text for each of the 8 fields on the NASA Space Apps submission form (`spaceappschallenge.org`), written for non-technical judges and backed by our real-data run (`pipeline_version: 0.3-monthly-ratio`).
> - **Action Required:** Each teammate should fill in their assigned `[TBD]` / `[FILL IN]` items in the table below, then **Person 3** can paste **Sections 1–8** directly into the portal.
> - **Part II (at the bottom)** is our internal **Team Reference Appendix** (source-file verification table for every number + pre-submit repo checklist). **Do not paste Part II into the Space Apps form.**

## Team Action Items Before 21:00 IST Submit

| Teammate | Role | What You Need to Fill In / Do | Where in This File |
|---|---|---|---|
| **Person 1** | Ingest & Pipeline Lead | 1. Confirm which AI coding tools you used on `pipeline/ingest/`, `scripts/`, and `tools/synthetic/`.<br>2. Update `README.md` status table so Stages 5–7 say `✅ Complete (0.3-monthly-ratio)` instead of `⚠️ In progress`. | **Section 8** (`[FILL IN]` items) & **Part II.C** |
| **Person 2** | Calibration & Data Engineer | ✅ Done: All real-data calibration, hold-out, splice-check, outage, static-mask, and grid-resolution numbers verified and written below; `hero.png` and overlap plots generated. | **Sections 1–8** & **Part II.B** |
| **Person 3** | Backend & Deployment Lead | 1. Paste the deployed **Google Cloud Run URL** (`asia-south1`).<br>2. Confirm `https://github.com/Johannpereira07/EmberTrace` is set to **Public** and add a root `LICENSE` file (e.g., MIT).<br>3. Update `DEFAULT_VERSION = "0.3-monthly-ratio"` in `pipeline/export.py`.<br>4. Confirm AI tools used on `api/` and deployment, then paste **Sections 1–8** into the Space Apps portal. | **Section 4**, **Section 7**, **Section 8**, & **Part II.C** |
| **Person 4** | Frontend App & Map Lead | 1. Paste the public URL to the **30-second demo video** (with English subtitles, tested in an incognito window).<br>2. Confirm AI tools used on `web/` and video/subtitles. | **Section 3** & **Section 8** |
| **Person 5** | Charts, Story Globe & Slides | 1. Paste the public URL to the **7-slide presentation deck** (tested in an incognito window).<br>2. Confirm AI tools used on `web/src/features/charts/`, `web/src/story/`, and slide deck. | **Section 3** & **Section 8** |

---

<!-- ===================================================================== -->
<!-- PART I: COPY-PASTE SECTIONS 1 TO 8 INTO THE NASA SPACE APPS PORTAL    -->
<!-- ===================================================================== -->

# 1. Project Name

**EmberTrace** — *One continuous 26-year fire activity calendar across satellite generations.*

---

# 2. High-Level Project Summary

*(Word count: 144 words — within the 100–150 word limit)*

Satellites have tracked active fires for over 25 years, but the record is split across two sensor families that cannot be compared directly. NASA’s older MODIS sensors (Terra and Aqua, ~1 km pixels) provide history back to November 2000, while newer VIIRS sensors (Suomi-NPP, NOAA-20, and NOAA-21, 375 m pixels) detect roughly eight times as many hotspots for the same fire activity. Joining raw counts creates artificial jumps whenever sensors or satellite counts change.

EmberTrace converts 18.0 million real NASA FIRMS detections across India (November 2000 to November 2026) into one continuous, VIIRS-equivalent monthly series on a 0.25-degree grid. Through an interactive web application, emergency responders, land managers, and scientists can select any area, inspect a 27-year burning activity calendar and a historical anomaly calendar, review data-quality and provenance flags, and download charts and CSV tables to distinguish real wildfire anomalies from satellite transitions.

---

# 3. Link to Project Demo

- **30-Second Demo Video (with English subtitles):** `[TBD: Person 4 — paste public URL to 30-second demo video (YouTube/Vimeo/Drive, no login required)]`
- **Presentation Slide Deck (max 7 slides):** `[TBD: Person 5 — paste public URL to 7-slide presentation deck (no login required)]`

---

# 4. Link to Final Project

- **Live Web Application (Google Cloud Run):** `[TBD: Person 3 — paste deployed Cloud Run public URL]`
- **Public Source Code Repository:** `https://github.com/Johannpereira07/EmberTrace` `[FILL IN: Person 3 — confirm repository visibility is set to Public before submitting]`

---

# 5. Detailed Project Description

## Problem Statement and Objectives

When a wildfire season begins or agricultural burning peaks, emergency responders, forest and land managers, and researchers ask three questions: *Is fire activity unusual here this month? Which months of the year are historically most active? How much should I trust this historical record?*

Answering those questions requires a multi-decade baseline. NASA’s Fire Information for Resource Management System (FIRMS) provides active-fire hotspot detections back to November 2000, but the record is divided across two instrument generations and five satellites:
- **MODIS** aboard *Terra* (from November 2000) and *Aqua* (from July 2002), which observe with roughly 1 km pixels.
- **VIIRS** aboard *Suomi-NPP* (January 2012 to November 2, 2026), *NOAA-20* (from April 2018), and *NOAA-21* (from March 2023), which observe with 375 m pixels.

Naively combining raw MODIS and VIIRS hotspot counts produces severe artificial jumps for three reasons:
1. **Sensor resolution and sensitivity:** Because a 375 m VIIRS pixel has a much smaller footprint than a 1 km MODIS pixel, VIIRS detects many small fires that MODIS misses—roughly eight times as many detections over India as MODIS Aqua during the same month.
2. **Changing number of satellites in orbit:** Only one satellite (Terra) flew from November 2000 to June 2002; two MODIS satellites flew together through 2011; then VIIRS grew from one satellite in 2012 to two in April 2018 and three in March 2023, before Suomi-NPP ended FIRMS production on November 2, 2026. Adding satellites multiplies raw counts even when fire activity on the ground is unchanged.
3. **Different metadata and near-real-time gaps:** MODIS reports detection confidence as numbers from 0 to 100, whereas VIIRS reports categories (`low`, `nominal`, `high`). Furthermore, standard archive files classify detections by thermal source (vegetation fire versus volcanoes, industrial stacks, gas flares, and offshore platforms), whereas Near-Real-Time (NRT) files for the most recent months omit the source-type classification entirely. During India’s monsoon months (July to September), when vegetation fires are rare, industrial heat sources make up 44% to 70% of raw VIIRS detections, inflating unmasked recent months by two to four times.

Our objective is to build an end-to-end harmonization pipeline and interactive web application that places the entire 2000–2026 record onto one consistent scale—**VIIRS-equivalent detections per observing satellite**—while communicating provenance, uncertainty, and data quality transparently.

## Our Solution and What We Hope to Achieve

EmberTrace consists of an offline Python data-processing pipeline, a precomputed 0.25-degree grid dataset over India, a FastAPI backend, and a React web application.

**Real Data Disclosure:** The production dataset and web application run on **real NASA FIRMS archive and Near-Real-Time data** covering all of India from November 1, 2000 through November 13, 2026 (18,035,986 raw detections across 4,651 active 0.25-degree grid cells and 313 calendar months). We also include a separate synthetic dataset generator with a known mathematical truth for automated pipeline verification; whenever synthetic data is loaded in development or fallback mode, the interface displays a prominent demonstration-data watermark and never presents synthetic numbers as real fire history.

In the EmberTrace web application, a user can:
- **Explore an interactive story globe:** A scroll-driven 3D globe illuminates India’s real fire climatology alongside worldwide 7-day VIIRS context and illustrates how the satellite fleet evolved from 2000 to 2026.
- **Select any Area of Interest (AOI) and date range:** Draw a rectangle on an interactive map or enter exact latitude/longitude bounds. The map displays both the user-drawn box and the outward-snapped 0.25-degree grid boundary so users see the exact area analyzed.
- **Inspect the Burning Activity Calendar:** A 27-year by 12-month heatmap (2000–2026) showing monthly VIIRS-equivalent fire detections using a colorblind-safe Viridis scale, with exact counts and satellite provenance on hover.
- **Inspect the Historical Anomaly Calendar:** A second 27-year by 12-month heatmap comparing each month against the full-record historical median for that same calendar month (`monthly value / historical median`), rendered on a colorblind-safe diverging Blue-to-Orange log-2 scale centered at `1.0x` (normal activity).
- **Review Top Anomalies and Data Quality Flags:** View the top 5 most extreme anomaly months for the selected area alongside non-blocking quality indicators for converted pre-2012 MODIS years, lower-confidence chained Terra months (2000–2002), provisional NRT months (from August 2026 onward), partial current months (November 2026), sparse low-count areas, and unobserved (`unavailable`) months.
- **Download Analytics and Data:** Export the harmonized monthly series, anomalies, sources, and quality flags as a self-documented CSV file, or download the calendar and anomaly heatmaps as high-resolution PNG or SVG figures.

**Benefits:** Emergency responders can immediately check whether current fire activity is above or below the 26-year median for their district; land managers can identify seasonal peak burning windows without being misled by the 2018 or 2023 satellite additions; and scientists obtain a documented, reproducible baseline with explicit uncertainty bounds.

## How Harmonization Works (In Plain Language)

**[IMAGE 1 HERE — Upload repo file: `science/figures/hero.png` — Caption: "Before vs. After Harmonization over India (2000–2026, Real NASA FIRMS Data). Left: unnormalized raw MODIS and VIIRS monthly counts and 12-month rolling sums showing the 8x jump in 2012 and satellite-addition jumps in 2018 and 2023. Right: the harmonized VIIRS-equivalent series on the same vertical axis."]**

Our pipeline processes the raw FIRMS records in four main steps:

1. **Unify and Filter False Alarms & Static Industrial Sources:**
   We standardize MODIS numeric confidence (`0–100`, using cut-offs of `< 30` for low and `>= 80` for high) and VIIRS letter codes (`low`, `nominal`, `high`) into a common scale and remove low-confidence detections. For standard archive files, we keep only presumed vegetation fires, removing 97,540 MODIS and 1,785,274 VIIRS non-vegetation rows. Because recent Near-Real-Time files (August to November 2026) lack a source-type classification column, we build a spatial static-source mask from the 25-year archive: any 0.005-degree square (roughly 500 m) with 5 or more historical non-vegetation detections is flagged as a static industrial or flare site (1,626 MODIS squares and 3,695 VIIRS squares). Applying this mask to Near-Real-Time data removes 54,881 static-source detections (cutting August and September 2026 raw VIIRS counts by 60% and 74%) and brings Near-Real-Time monthly totals within ±4% of true vegetation fire counts when validated on held-out 2026 archive months. Altogether, 13,261,902 vegetation fire detections are retained (518,571 Terra, 1,240,487 Aqua, and 11,502,844 VIIRS after static-source masking).

2. **Grid Aggregation and Strict "Unavailable" vs. "Zero Fires" Separation:**
   Detections are counted per 0.25-degree grid cell and UTC calendar month for three series: Terra, Aqua, and combined VIIRS. A core rule of EmberTrace is that **"no satellite observing" (`unavailable`) is never confused with "zero fires" (`0`)**. Quiet cells where a satellite was flying receive `0.0`; months before a satellite launched or lost entirely to outages remain `unavailable` all the way from the pipeline through the API, UI, and CSV export.

3. **Normalize by Observing Satellites and Outage Days:**
   To prevent artificial jumps when NOAA-20 joins in April 2018, when NOAA-21 joins in March 2023, or when Suomi-NPP ends on November 2, 2026, each cell’s monthly count is divided by the effective number of satellites observing that month. We cross-checked NASA’s Missing Data table against daily detection counts across India and identified 159 verified satellite outage days (69 Terra, 31 Aqua, 51 Suomi-NPP, 6 NOAA-20, and 2 NOAA-21), subtracting them from the observing days in each month. After this normalization, the combined three-satellite VIIRS series agrees with a single-satellite Suomi-NPP-only series within 0.1% to 1.5% across 2018–2025.

4. **Calendar-Month Overlap Calibration (`Aqua → VIIRS` and `Terra → Aqua`):**
   From January 2012 onward, EmberTrace uses normalized VIIRS directly and never blends it with MODIS. Before January 2012, MODIS counts must be scaled into VIIRS-equivalent units using the years when both sensors observed the same fires:
   - **Why `Aqua → VIIRS` (`2012-01` to `2019-12`):** Both MODIS Aqua and the VIIRS satellites fly in afternoon orbits (~13:30 local time). We fit on the 96-month overlap from January 2012 through December 2019, stopping before Aqua’s orbit-maintenance maneuvers ended in March 2021.
   - **Why `Terra → Aqua` (`2002-08` to `2011-12`):** From November 2000 to June 2002, Terra was the only satellite in orbit. Because Terra passes in the morning (~10:30 local time) when fire activity is lower, we fit a conversion from Terra to Aqua over their 113-month pre-VIIRS overlap (August 2002 to December 2011) and chain it (`Terra → Aqua → VIIRS`) exclusively for the first 20 months of the record (November 2000 to June 2002).
   - **Zero-Preserving Calendar-Month Ratios:** An early log-linear regression with an intercept turned zero-detection cells into positive numbers (`3.22` for Aqua and `18.26` for Terra), creating a massive false floor before 2012. Replacing the regression with a multiplicative ratio through the origin guarantees that `0` detections always convert to `0.0`. Furthermore, because morning-versus-afternoon fire behavior and small-fire fractions vary across India’s agricultural and forest-fire seasons, a single annual factor overpredicts monsoon months and underpredicts post-monsoon crop burning. We therefore compute one ratio of totals (`sum of new sensor / sum of old sensor`) per calendar month, pooling the low-count monsoon months (June to September) into a single shared factor.
   - Over the full fitting windows, the overall `Aqua → VIIRS` ratio is `7.98` (ranging by calendar month from `5.02` in October and `7.43` in March to `16.67` in pooled June–September), and the overall `Terra → Aqua` ratio is `2.77` (ranging from `1.03` in May and `1.26` in June–September to `4.15` in October and `6.46` in November).

**[IMAGE 2 HERE — Upload repo files: `out/real_report/overlap_aqua_to_viirs.png` and `out/real_report/overlap_terra_to_aqua.png` — Caption: "Overlap validation on real India FIRMS data. Actual target detections (black) vs. single-factor prediction (blue dashed) and calendar-month ratio prediction (orange) across the 2012–2019 Aqua→VIIRS and 2002–2011 Terra→Aqua overlap windows."]**

## Validation Results: Hold-Out Checks, Splice Checks, and Grid Resolution

1. **70/30 Chronological Hold-Out Validation:**
   We trained each calibration on the first 70% of its overlap window and tested it on the unseen final 30% of months (`2017-08` to `2019-12`, 29 test months for `Aqua → VIIRS`; `2009-03` to `2011-12`, 34 test months for `Terra → Aqua`):
   - **Aqua → VIIRS Hold-Out:** Adopting calendar-month factors improves monthly-total correlation from `0.9566` (single factor) to **`0.9958`**, cuts unweighted Mean Absolute Percentage Error (MAPE) from `27.7%` to **`23.3%`**, and reduces **median monthly absolute percentage error from `19.8%` to `8.7%`**.
   - **Terra → Aqua Hold-Out:** Adopting calendar-month factors improves monthly-total correlation from `0.8744` (single factor) to **`0.9726`**, cuts unweighted MAPE from `97.0%` to **`27.6%`**, and reduces **median monthly absolute percentage error from `68.0%` to `24.1%`**.

2. **Splice Checks at Sensor and Satellite Handovers (`2002-07`, `2012-01`, and `2023-03` / `2024-01`):**
   *(Note on NOAA-21 handover date: while some online documentation lists January 17, 2024 for NOAA-21, profiling our real FIRMS archive confirmed that NOAA-21 detections begin on **March 1, 2023** with 447,875 detections in 2023; we therefore run the NOAA-21 splice check at `2023-03`.)*
   We run two complementary handover checks:
   - **Deseasonalized 12-Month Before/After Splice Check:** Because Indian fire activity varies tenfold between monsoon and spring peak months, month-to-month checks are swamped by seasonality. We compute the ratio of the 12-month harmonized sum after each handover to the 12-month sum before, and compare it against the empirical distribution of the same 12-vs-12 ratio across 217 non-handover interior months (`placebo mean = 1.0501`, `standard deviation = 0.2649`):
     - **`2002-07` (Chained Terra → Calibrated Aqua):** 12 months before = `309,138`; 12 months after = `310,320`; ratio = **`×1.004` (`z = −0.17σ`)** — virtually zero step.
     - **`2012-01` (Calibrated Aqua → VIIRS):** 12 months before = `367,356`; 12 months after = `464,257`; ratio = **`×1.264` (`z = +0.81σ`)** — well within ±1σ of natural year-to-year fire variability.
     - **`2023-03` (NOAA-21 joins VIIRS):** 12 months before = `478,402`; 12 months after = `375,117`; ratio = **`×0.784` (`z = −1.00σ`)** — within 1σ of natural variability.
   - **Strict 5%-Tolerance Overlap Check:** We also compare the converted old source against the new source during the 12 months immediately following each handover against a strict provisional tolerance of `1.00 ± 5%`. On this stricter test, `2002-07` is `×1.09` (`284,520` vs. `310,320`, **FAIL** by 4 percentage points above 1.05), `2012-01` is `×0.94` (`493,877` vs. `464,257`, **FAIL** by 1 percentage point below 0.95 because 2012’s annual overlap ratio of `7.465` was 6.4% below the 8-year average of `7.979`), and the weak month-to-month check at `2023-03` is `×1.56` (**FAIL** vs. historical Feb→Mar range `×1.84` to `×5.63`). We report both checks transparently without relaxing our 5% tolerance.

3. **Spatial Grid Resolution Comparison (`0.25°` vs. `0.50°`):**
   Comparing the 0.25-degree grid (`4,651` cells, `1,455,763` rows, `2.3 MB` Parquet file, cell-level Pearson `r = 0.8899` for Aqua→VIIRS and `0.6577` for Terra→Aqua) against a 0.50-degree grid (`1,259` cells, `394,067` rows, cell-level `r = 0.9131` and `0.7300`) showed identical regional calibration factors and hold-out errors while keeping the dataset under 2.5 MB. We therefore retain the 0.25-degree resolution for 4x finer spatial area selection.

## Known Scientific and Technical Limitations

To ensure scientific validity, EmberTrace states its limitations directly in the application and documentation:
- **Satellite detections, not ground-truth fire area:** Hotspots count thermal detections unobstructed by clouds at the time of satellite overpass.
- **Slight positive hold-out bias on `Aqua → VIIRS` (`mean pred/actual = 1.17`):** Although median monthly hold-out error is `8.7%`, the unweighted mean ratio of predicted to actual monthly totals across the 29 test months is `1.168`, pulled upward by low-count monsoon months.
- **High uncertainty in monsoon months (`Jun–Sep` factor `≈ 16.7`):** The pooled June–September `Aqua → VIIRS` factor (`16.67`) is roughly double the other calendar months (`5.02–12.26`). Because active-fire counts during the Indian monsoon are tiny (`30–100` Aqua detections per month across all of India), monsoon calibration is the least certain part of the record.
- **`2012-01` shows a `+26%` 12-month rise (`×1.264`, `+0.81σ`):** While `+0.81σ` is well inside normal year-to-year fire variability over India (`±26.5%`), the 12 months after January 2012 are 26% higher than the 12 months before—a rise, not a flat line.
- **Low statistical power of handover splice checks:** Because natural year-to-year fire variability over India has a standard deviation of `26.5%` (`placebo std = 0.2649`), any before-vs-after handover test can only detect artificial steps larger than roughly 50% (`±2σ`). The primary evidence for harmonization accuracy is the 8-year overlap fit (`r = 0.996`), not the splice check alone.
- **Higher uncertainty before 2012 (especially November 2000 – June 2002):** Even with calendar-month factors, `Terra → Aqua` has a `24.1%` median (`27.6%` mean) monthly hold-out error, and `Aqua → VIIRS` annual overlap ratios drift by about `10%` between 2012 (`7.465`) and 2019 (`8.197`, peaking at `8.512` in 2016). Pre-2012 values—and especially the two-step chained Terra segment (`2000-11` to `2002-06`)—are reliable for seasonal and multi-year patterns rather than single months.
- **Provisional Near-Real-Time months (`2026-08` to `2026-11`):** Static-source masking leaves an estimated `±4%` residual error in Near-Real-Time months, and November 2026 is a partial month (data through November 13, 2026) whose anomaly is marked non-comparable.
- **Assumed and provisional configuration constants:** MODIS confidence thresholds (`30` and `80`), the outage neighbor-median cut-off (`20`), and the static-mask parameters (`0.005°`, minimum 5 archive hits) are configuration values labeled assumed or provisional.

## Tools, Languages, and Software Used

- **Data Pipeline & Scientific Validation:** Python (`3.11+` / `3.12`), `pandas`, `numpy`, `pyarrow` (Parquet export), `PyYAML`, `matplotlib` (validation figures), `pytest` (63 automated pipeline and calibration unit tests).
- **Backend API:** Python, `FastAPI`, `Uvicorn`, `Pydantic`, `httpx` (contract and endpoint test suite).
- **Frontend Web Application:** `TypeScript`, `React 18`, `Vite`, `Tailwind CSS`, `Leaflet` + `react-leaflet` + `leaflet-draw` (interactive bounding-box selection and grid-snap overlay), `Three.js` + `@react-three/fiber` + `GSAP` (scroll-driven 3D story globe), custom SVG heatmaps and mathematical colorblind-safe color scales, `Vitest`.
- **Deployment & Infrastructure:** `Docker` (multi-stage single-container build serving `/api` and `/` on the same origin), `Google Cloud Run` (`asia-south1`, Mumbai) and `Google Cloud Build`.

---

# 6. NASA Data

EmberTrace is built on **real active-fire hotspot data from NASA’s Fire Information for Resource Management System (FIRMS)**, part of NASA’s Earth Observing System Data and Information System (EOSDIS) (`https://earthdata.nasa.gov/firms`).

Specifically, we used **8 regional archive and Near-Real-Time (NRT) CSV files** covering India (`6.76°N–35.11°N`, `68.31°E–97.34°E`, `18,035,986` total detections from `2000-11-01` to `2026-11-13`), plus **1 global 7-day VIIRS NRT file** for worldwide context on the 3D story globe, and **1 NASA FIRMS documentation table**:

1. **MODIS Collection 6.1 Active Fire Detections (`MCD14ML` Standard Archive & `MCD14DL` NRT) — Request ID `845077`:**
   - **DOI:** `10.5067/FIRMS/MODIS/MCD14ML`
   - **Satellites:** *Terra* and *Aqua*
   - **Files & Date Ranges Used:**
     - `fire_archive_M-C61_845077.csv`: `1,917,344` detections (`1,322,914` Aqua; `594,430` Terra) from **`2000-11-01` to `2026-08-31`** (versions `6.03` for 2000–2022 and `61.03` for 2023–2026).
     - `fire_nrt_M-C61_845077.csv`: `10,935` detections (`8,404` Aqua; `2,531` Terra) from **`2026-09-01` to `2026-11-13`** (version `6.1NRT`).
   - **How Used:** Provides the historical fire record before January 2012 (chained Terra for `2000-11` to `2002-06`; calibrated Aqua for `2002-07` to `2011-12`), the `2002-08` to `2011-12` overlap window for fitting `Terra → Aqua`, the `2012-01` to `2019-12` source series for fitting `Aqua → VIIRS`, and the archive non-vegetation type codes (`1, 2, 3`) used to construct the MODIS static-source mask.

2. **VIIRS 375 m Collection 2 Active Fire Detections — Suomi-NPP (`VNP14IMGT` Standard Archive & `VNP14IMGT_NRT` NRT) — Request ID `845080`:**
   - **DOI:** `10.5067/FIRMS/VIIRS/VNP14IMGT_NRT.002` (and standard archive counterpart `VNP14IMGT`)
   - **Satellite:** *Suomi National Polar-orbiting Partnership (S-NPP)*
   - **Files & Date Ranges Used:**
     - `fire_archive_SV-C2_845080.csv`: `8,726,813` detections from **`2012-01-20` to `2026-07-31`** (version `2`).
     - `fire_nrt_SV-C2_845080.csv`: `31,579` detections from **`2026-08-01` to `2026-11-02`** (version `2.0NRT`; S-NPP active-fire data production ended on November 2, 2026 at 13:00 UTC).
   - **How Used:** Primary VIIRS series from January 2012 through November 2, 2026; target series for the `2012-01` to `2019-12` `Aqua → VIIRS` calibration; and archive source for the VIIRS static-source mask.

3. **VIIRS 375 m Collection 2 Active Fire Detections — NOAA-20 / JPSS-1 (`VJ114IMGTDL_NRT` / Standard Archive) — Request ID `845078`:**
   - **Satellite:** *NOAA-20 (`N20`)*
   - **Files & Date Ranges Used:**
     - `fire_archive_J1V-C2_845078.csv`: `5,109,832` detections from **`2018-04-01` to `2026-07-31`** (version `2`).
     - `fire_nrt_J1V-C2_845078.csv`: `53,854` detections from **`2026-08-01` to `2026-11-13`** (version `2.0NRT`).
   - **How Used:** Combined with Suomi-NPP and NOAA-21 in the normalized VIIRS series from April 2018 onward (divided by active satellite count) and provides ongoing VIIRS coverage after Suomi-NPP’s retirement.

4. **VIIRS 375 m Collection 2 Active Fire Detections — NOAA-21 / JPSS-2 (`VJ214IMGTDL_NRT` / Standard Archive) — Request ID `845079`:**
   - **Satellite:** *NOAA-21 (`N21`)*
   - **Files & Date Ranges Used:**
     - `fire_archive_J2V-C2_845079.csv`: `2,135,511` detections from **`2023-03-01` to `2026-07-31`** (version `2`).
     - `fire_nrt_J2V-C2_845079.csv`: `50,118` detections from **`2026-08-01` to `2026-11-13`** (version `2.0NRT`).
   - **How Used:** Combined into the normalized VIIRS series from March 2023 onward and used to evaluate the `2023-03` satellite-join splice check.

5. **VIIRS 375 m Collection 2 Global 7-Day Near-Real-Time Active Fire Detections (`J1_VIIRS_C2_Global_7d.csv`):**
   - **Satellite:** *NOAA-20 (`N20`)*
   - **Date Range Used:** **`2026-11-07` to `2026-11-14`** (`369,539` nominal/high-confidence detections outside India, aggregated to a `0.5°` grid).
   - **How Used:** Provides global background fire context on the 3D story globe outside the harmonized India grid.

6. **NASA FIRMS Missing Data Table (`API / missing_dates`, Version `2.13.6`):**
   - **How Used:** Cross-checked against daily satellite counts in our India archive to remove `159` verified outage days when computing observing satellite-days per month.

---

# 7. Space Agency Partner & Other Data

## Partner Space Agency Contributions
- **NOAA (National Oceanic and Atmospheric Administration) / Joint Polar Satellite System (JPSS):** Operates the *Suomi-NPP*, *NOAA-20 (JPSS-1)*, and *NOAA-21 (JPSS-2)* spacecraft carrying the VIIRS instruments whose detections are distributed through NASA FIRMS.

## Other Datasets & Map Tiles
- **OpenStreetMap Map Tiles (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`):** Used as the interactive basemap in the frontend area selector. License: Open Data Commons Open Database License (**ODbL**), © OpenStreetMap contributors.
- **EmberTrace Synthetic Demonstration Dataset (`tools/synthetic/`):** Generated in-house by our deterministic synthetic generator script using planted mathematical ground-truth rates to test pipeline recovery and UI demonstration mode.

## Open-Source Software Libraries and Tools
*(Repository license: `[TBD: Person 3 — add root LICENSE file (e.g., MIT License) to repo before submitting and state license name here]`. Third-party open-source libraries used by EmberTrace and their upstream licenses are listed below:)*

- **Python Packages:**
  - `pandas` (`>=3.1,<4` in pipeline; `>=2.2,<4` in API) — BSD-3-Clause License
  - `numpy` (`>=2.4,<3` in pipeline; `>=1.26,<3` in API) — BSD-3-Clause License
  - `pyarrow` (`>=17`) — Apache License 2.0
  - `PyYAML` (`>=6`) — MIT License
  - `matplotlib` — Matplotlib License (PSF-based)
  - `fastapi` (`>=0.115,<1`) — MIT License
  - `uvicorn[standard]` (`>=0.30,<1`) — BSD-3-Clause License
  - `pytest` (`>=8`) — MIT License
  - `httpx` (`>=0.27`) — BSD-3-Clause License
- **Frontend JavaScript / TypeScript Packages:**
  - `react` (`^18.3.1`) and `react-dom` (`^18.3.1`) — MIT License
  - `leaflet` (`^1.9.4`) and `leaflet-draw` (`^1.0.4`) — BSD-2-Clause / MIT License
  - `react-leaflet` (`^4.2.1`) — Hippocratic / MIT License
  - `three` (`^0.170.0`) and `@react-three/fiber` (`^8.18.0`) — MIT License
  - `gsap` (`^3.15.1`) and `@gsap/react` (`^2.1.2`) — GSAP Standard "No Charge" License
  - `tailwindcss` (`^4.3.5`), `@tailwindcss/vite`, `@tailwindcss/postcss`, `postcss`, `autoprefixer` — MIT License
  - `typescript` (`^5.5.3`), `vite` (`^5.4.2`), `@vitejs/plugin-react` (`^4.3.1`), `vitest` (`^2.0.5`) — Apache-2.0 / MIT License
- **Color Scales:**
  - Viridis sequential perceptual colormap and ColorBrewer-based Blue-to-Orange diverging colormap — CC0 / Apache-style open specification.

---

# 8. Use of Artificial Intelligence

In accordance with NASA Space Apps Challenge rules, we disclose all Artificial Intelligence tools used during the development of EmberTrace and how every output was verified:

1. **Google DeepMind Antigravity:**
   - Used as an agentic coding assistant to implement and test the Stage 5–7 calibration upgrade (`pipeline/model/calibrate.py`, `pipeline/model/harmonize.py`, `pipeline/model/calendar.py`), unit tests (`pipeline/tests/model/`), deseasonalized splice and placebo scripts (`science/splice_placebo.py`, `science/placebo_lib.py`), hero figure and real-data runbook scripts (`science/hero_figure.py`, `science/real_report.py`), precomputed data exports (`data/cell_month.parquet`, `data/meta.json`, `data/calibration.json` generated by running the pipeline on real NASA FIRMS data), technical documentation (`docs/11-calibration-report.md`, `docs/explainer.md`), and this submission text (`docs/submission_form.md`).
2. **Anthropic Claude Code:**
   - Configured via `CLAUDE.md` (`@AGENTS.md`) as a coding assistant on the repository. `[FILL IN: Person 1 / Person 3 / Person 4 — list which folders/tasks were written or assisted with Claude Code]`.
3. **OpenAI Codex / OpenCode:**
   - Used during initial calibration prototyping (`ratio_of_totals` in `pipeline/model/calibrate.py`) and repository tasks. `[FILL IN: Team — note any other components assisted by Codex/OpenCode]`.
4. **GitHub Copilot / VS Code Copilot:**
   - Used during frontend chart, 3D globe, and visualization development (`CHANGELOG_ROLE5.md`). `[FILL IN: Person 4 & Person 5 — confirm scope of VS Code Copilot usage]`.
5. **Other AI Tools (Video, Voiceover, Subtitles, or Slide Deck):**
   - `[FILL IN: Person 4 & Person 5 — state whether any AI tools were used for the 30-second demo video voiceover/subtitles or slide deck graphics, or state "None used for media/slides"]`.
- **Verification of AI-Generated Code and Outputs:** All AI-assisted code was verified against 63 automated pipeline unit tests, API contract tests, synthetic planted-truth recovery checks (`make synthetic`), and empirical hold-out and splice checks on the 18.0-million-row real NASA FIRMS archive. No fire detection data was fabricated by AI; all production dataset values are computed deterministically from NASA FIRMS CSV files, and synthetic test data is generated strictly by the deterministic mathematical script `tools/synthetic/generate.py` and labeled `"data_kind": "synthetic"`.

---
---

<!-- ===================================================================== -->
<!-- DO NOT PASTE BELOW THIS LINE INTO THE SPACE APPS FORM                 -->
<!-- PART II: TEAM REFERENCE APPENDIX                                      -->
<!-- ===================================================================== -->

# Team Reference Appendix *(Do Not Paste into the Space Apps Form)*

## A. Complete Checklist of `[TBD]` and `[FILL IN]` Placeholders

1. **Section 3 (Link to Project Demo):**
   - `[TBD: Person 4 — paste public URL to 30-second demo video (YouTube/Vimeo/Drive, no login required)]`
   - `[TBD: Person 5 — paste public URL to 7-slide presentation deck (no login required)]`
2. **Section 4 (Link to Final Project):**
   - `[TBD: Person 3 — paste deployed Cloud Run public URL]`
   - `[FILL IN: Person 3 — confirm repository visibility is set to Public before submitting]`
3. **Section 7 (Space Agency Partner & Other Data):**
   - `[TBD: Person 3 — add root LICENSE file (e.g., MIT License) to repo before submitting and state license name here]`
4. **Section 8 (Use of Artificial Intelligence):**
   - `[FILL IN: Person 1 / Person 3 / Person 4 — list which folders/tasks were written or assisted with Claude Code]`
   - `[FILL IN: Team — note any other components assisted by Codex/OpenCode]`
   - `[FILL IN: Person 4 & Person 5 — confirm scope of VS Code Copilot usage]`
   - `[FILL IN: Person 4 & Person 5 — state whether any AI tools were used for the 30-second demo video voiceover/subtitles or slide deck graphics, or state "None used for media/slides"]`

---

## B. Source-File Verification Table for Every Number in This Submission

| Number / Fact in Submission Text | Verified Source File(s) in Repo |
|---|---|
| High-Level Summary word count: `144` words (requirement: `100–150` words) | `docs/submission_form.md` (§2) |
| Total raw India FIRMS detections: `18,035,986` (`18.0 million`), across `8` CSV files | `docs/07-data-profile.md`, `docs/09-first-real-run.md`, `out/normalized.meta.json` (`1,928,279` MODIS + `16,107,707` VIIRS) |
| Coverage period: `2000-11` to `2026-11` (`313` months, `27` calendar years, data through `2026-11-13`) | `data/meta.json`, `out/normalized.meta.json`, `CHANGELOG_ROLE5.md` |
| Grid resolution & size: `0.25°` cell size, `4,651` active cells, `1,455,763` rows, `2.3 MB` Parquet | `data/meta.json`, `docs/09-first-real-run.md`, `docs/11-calibration-report.md` (§6) |
| Grid extent (`data/meta.json`): `6.75°N–35.25°N`, `68.25°E–97.5°E` (raw detections `6.76°N–35.11°N`, `68.31°E–97.34°E`) | `data/meta.json`, `docs/07-data-profile.md` |
| Sensor pixel sizes: MODIS `~1 km`, VIIRS `375 m` | `docs/01-prd.md` (§1), `docs/02-architecture-methodology.md` (§2) |
| Satellite start/end dates: Terra `2000-11-01`, Aqua `2002-07-04`, S-NPP `2012-01-20` to `2026-11-02 13:00 UTC`, NOAA-20 `2018-04-01`, NOAA-21 `2023-03-01` | `pipeline/config.yaml`, `docs/07-data-profile.md`, `out/normalized.meta.json` |
| MODIS confidence thresholds: `< 30` (low), `>= 80` (high) | `pipeline/config.yaml` (`modis_confidence`) |
| Monsoon static heat-source share in 2025 VIIRS archive: `44%` (Jul), `70%` (Aug), `69%` (Sep), `43%` (Oct), `20%` (Nov), inflating unmasked NRT months by `2–4×` | `docs/10-nrt-static-mask.md` |
| Archive non-vegetation rows (`type != 0`) removed: `88,922` MODIS nominal/high (`97,540` total archive `type 1/2/3`) and `1,741,545` VIIRS nominal/high (`1,785,274` total archive `type 1/2/3`) | `out/normalized.meta.json` (`filter`), `docs/07-data-profile.md` |
| NRT static-source mask: `0.005°` (`~500 m`), `min_hits = 5`, `dilate = 0`; `1,626` MODIS squares and `3,695` VIIRS squares; `54,881` nominal/high NRT detections dropped (`1,329` MODIS, `53,552` VIIRS); cuts Aug/Sep 2026 VIIRS NRT by `60%` and `74%`; `±4%` residual error | `pipeline/config.yaml`, `out/normalized.meta.json` (`nrt_static_mask`), `docs/10-nrt-static-mask.md` |
| Detections kept after filtering & masking: `13,261,902` total (`1,757,729` MODIS = `518,571` Terra + `1,240,487` Aqua before NRT mask; `11,504,173` VIIRS / `11,502,844` after MODIS NRT split) | `out/normalized.meta.json` (`filter`), `docs/09-first-real-run.md` |
| Verified satellite outage days removed: `159` total (`69` Terra, `31` Aqua, `51` S-NPP, `6` NOAA-20, `2` NOAA-21); neighbor median cut-off `20` over `31` days | `out/normalized.meta.json` (`outage_days`), `docs/08-missing-data-table.md`, `pipeline/config.yaml` |
| Combined normalized VIIRS vs S-NPP-only agreement: `0.1%–1.5%` across `2018–2025` (Aqua→VIIRS factor `7.9791` vs `7.9755`, `0.045%` difference) | `docs/11-calibration-report.md` (§1.4, §4) |
| Earlier `0.1-calibration-pending` log-linear false floor on zero-detection cells: `3.22` (Aqua) and `18.26` (Terra) | `docs/09-first-real-run.md` (§4), `docs/11-calibration-report.md` (§1.1) |
| `Aqua → VIIRS` (`2012-01..2019-12`, `96` months, `175,941` cell-months): overall factor `7.9791` (`7.98`), cell-level Pearson `r = 0.8899`; monthly factors `m1=8.39, m2=8.39, m3=7.43, m4=10.03, m5=12.26, m6..9=16.67, m10=5.02, m11=6.27, m12=8.74` | `data/calibration.json`, `out/real_report/report.md`, `docs/11-calibration-report.md` |
| `Terra → Aqua` (`2002-08..2011-12`, `113` months, `73,696` cell-months): overall factor `2.7718` (`2.77`), cell-level Pearson `r = 0.6577`; monthly factors `m1=2.19, m2=2.50, m3=3.55, m4=2.15, m5=1.03, m6..9=1.26, m10=4.15, m11=6.46, m12=1.96` | `data/calibration.json`, `out/real_report/report.md`, `docs/11-calibration-report.md` |
| Hold-out `Aqua → VIIRS` (`train 2012-01..2017-07` = `67` mos, `test 2017-08..2019-12` = `29` mos): single-factor (`8.0046`) `corr = 0.9566`, `MAPE = 27.7%`, `median error = 19.8%`, `mean(pred/actual) = 0.939` vs. `monthly_ratio` `corr = 0.9958`, `MAPE = 23.3%` (`0.2329`), `median error = 8.7%` (`0.0875`), `mean(pred/actual) = 1.168` (`1.17`) | `data/calibration.json`, `out/real_report/report.md`, `docs/11-calibration-report.md` |
| Hold-out `Terra → Aqua` (`train 2002-08..2009-02` = `79` mos, `test 2009-03..2011-12` = `34` mos): single-factor (`2.8311`) `corr = 0.8744`, `MAPE = 97.0%`, `median error = 68.0%`, `mean(pred/actual) = 1.764` vs. `monthly_ratio` `corr = 0.9726`, `MAPE = 27.6%` (`0.2763`), `median error = 24.1%` (`0.2410`), `mean(pred/actual) = 1.096` | `data/calibration.json`, `out/real_report/report.md`, `docs/11-calibration-report.md` |
| Deseasonalized splice check (`science/splice_placebo.py`, `217` interior placebo months, `mean = 1.0501`, `std = 0.2649`, `min = 0.6451`, `max = 2.0450`): `2002-07` (`309,138 → 310,320`, `×1.004`, `−0.17σ`); `2012-01` (`367,356 → 464,257`, `×1.264`, `+0.81σ`, `+26.4%` rise); `2023-03` (`478,402 → 375,117`, `×0.784`, `−1.00σ`) | `out/real_report/report.md`, `out/real_report/deseasonalized_splice.csv`, `docs/11-calibration-report.md` (§3) |
| Strict `1 ± 5%` overlap splice check (`science/splice_check.py`): `2002-07` `284,520` vs `310,320` (`×1.09`, FAIL); `2012-01` `493,877` vs `464,257` (`×0.94`, FAIL); `2023-03` month-to-month `×1.56` vs `×1.84..×5.63` (FAIL) | `science/splice_check.py` output, `AGENTS.md`, `docs/11-calibration-report.md` (§3) |
| Annual `Aqua → VIIRS` overlap ratio drift (`2012..2019`): `7.465` (2012) to `8.197` (2019), max `8.512` (2016), `~10%` drift | `out/real_report/report.md`, `out/real_report/yearly_ratios_aqua_to_viirs.csv` |
| Cell size comparison (`0.50°` grid): `1,259` cells, `394,067` rows, cell-level `r = 0.9131` (Aqua→VIIRS) and `0.7300` (Terra→Aqua) | `docs/11-calibration-report.md` (§6) |
| Per-file row counts and date ranges for Request IDs `845077` (MODIS: `1,917,344` archive + `10,935` NRT), `845080` (S-NPP: `8,726,813` archive + `31,579` NRT), `845078` (NOAA-20: `5,109,832` archive + `53,854` NRT), `845079` (NOAA-21: `2,135,511` archive + `50,118` NRT; `447,875` rows in 2023) | `docs/07-data-profile.md`, `planning/Gmail - NASA-FIRMS _ Your Download Request Id - 845077..845080.pdf` |
| Global 7-day VIIRS NOAA-20 context layer (`J1_VIIRS_C2_Global_7d.csv`): `2026-11-07` to `2026-11-14`, `369,539` detections on `0.5°` grid | `scripts/build_story_data.py`, `web/public/story.json` |
| Automated pipeline unit test count: `63` passed | `pipeline/tests/`, `CHANGELOG_ROLE2.md` |

---

## C. Repo Consistency Items for Person 1 & Person 3 Before Making the Repo Public

1. **`README.md` Status Table (Person 1):**
   - `README.md` (lines 21, 78, 82) still says Stages 5–7 are `⚠️ In progress` with the old `0.1-calibration-pending` zero-to-positive floor issue. Update `README.md` on `main` so judges visiting the GitHub repo see `✅ Complete (0.3-monthly-ratio, zero-preserving calendar-month ratios)`.
2. **`pipeline/export.py` Default Version (Person 3):**
   - Update line 25 of `pipeline/export.py` from `DEFAULT_VERSION = "0.1-calibration-pending"` to `DEFAULT_VERSION = "0.3-monthly-ratio"` so running `make export` without `--pipeline-version` preserves the current version string.
3. **Root `LICENSE` File (Person 3):**
   - Add an open-source `LICENSE` file (e.g., MIT) at the repository root before submitting.
4. **Final Portal Checks (Person 3 / All):**
   - Open every URL in **Sections 3 and 4** (Demo Video/Slides, Cloud Run live app, GitHub repo) in an **incognito browser window** to confirm no login or permission wall blocks the judges.
   - Verify no NASA logos or official insignia appear on the web app, slide deck, or video.
