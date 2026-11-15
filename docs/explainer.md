# How Harmonization Works (`CAL-10`: In-App Explainer & Slide Text)

---

## 1. Plain-Language Explainer (For the App Panel)

### Why Raw Satellite Counts Cannot Be Compared Directly
EmberTrace combines active-fire detections from two NASA sensor families spanning November 2000 to today:
- **MODIS** (*Terra* from Nov 2000; *Aqua* from Jul 2002) has a ~1 km pixel footprint and provides the first 11 years of the record.
- **VIIRS** (*Suomi-NPP* from Jan 2012 to Nov 2026; *NOAA-20* from Apr 2018; *NOAA-21* from Mar 2023) has a finer 375 m pixel footprint and detects **~8× as many hotspots** as MODIS Aqua for the same fire activity.

Stitching raw counts together creates artificial jumps in January 2012 (when VIIRS begins), April 2018 (when NOAA-20 joins), and March 2023 (when NOAA-21 joins).

### How EmberTrace Harmonizes the Record
Every month on the 0.25° grid is expressed in **VIIRS-equivalent detections per satellite**:
1. **Filter non-fire & low-confidence detections:** Drop low-confidence hits and non-vegetation static heat sources (factories, flares, offshore platforms). For recent near-real-time (NRT) months where NASA omits the `type` code, apply a spatial static-source mask built from the 25-year archive (`±4%` residual error).
2. **Account for satellite count & outages:** Divide each series' monthly cell count by the fraction of satellites actually observing that month (removing verified satellite outage days). Months with no satellite observing remain **`unavailable` (`NaN`)**, never `0`.
3. **Convert pre-2012 MODIS to VIIRS-equivalent (`monthly_ratio`, Jun–Sep pooled):**
   - **Jan 2012 – Present (`VIIRS`):** Normalized VIIRS detections directly (never blended with MODIS).
   - **Jul 2002 – Dec 2011 (`AQUA_calibrated`):** Afternoon Aqua normalized detections multiplied by the 2012–2019 Aqua→VIIRS calendar-month overlap factors (overall ratio **`×7.98`**, ranging from `×5.02` in Oct and `×7.43` in Mar to `×16.67` in pooled Jun–Sep monsoon months).
   - **Nov 2000 – Jun 2002 (`TERRA_chained`, lower confidence):** Morning Terra normalized detections chained through the 2002–2011 Terra→Aqua calendar-month overlap factors (overall ratio **`×2.77`**, ranging from `×1.26` in Jun–Sep to `×4.15–6.46` in Oct–Nov) and then to VIIRS.
   - **Zero stays zero:** A quiet cell with `0` detections always converts to `0.0` (no artificial floor).

---

## 2. Showcase Slide Copy (Person 2's Two Slides)

### Slide A: How Harmonization Works
- **The Problem:** VIIRS (375 m) detects **~8× more hotspots** than MODIS Aqua (1 km), and adding NOAA-20 (2018) and NOAA-21 (2023) triples raw VIIRS counts.
- **Step 1 — Per-Satellite Normalization & Outage Correction:** Divide raw counts by active satellite-days observing each month (`platform_weight`). Agreement between combined VIIRS and S-NPP-only is within **±1.5%** across 2018–2025.
- **Step 2 — Calendar-Month Overlap Calibration (`monthly_ratio`, Jun–Sep pooled):**
  - **Aqua → VIIRS (`2012–2019`):** overall `×7.98` (hold-out monthly-total $r = 0.996$, median error **$8.7\%$** vs $19.8\%$ single-factor).
  - **Terra → Aqua (`2002–2011`, chained for `2000–2002`):** overall `×2.77` (hold-out monthly-total $r = 0.973$, median error **$24.1\%$** vs $68.0\%$ single-factor).
  - **Zero-preserving:** $0 \text{ detections} \mapsto 0.0$ everywhere; unobserved months stay `NaN`.
- **Evidence:** Deseasonalized 12-month handover steps are **`−0.17σ` at `2002-07`** and **`+0.81σ` at `2012-01`** (well within normal year-to-year fire variability).

### Slide B: Limitations (Exact Wording)
> **Calibrated on the 2012–2019 overlap (monthly-total $r = 0.996$ with seasonal factors, $0.96$ single factor). Handover steps are within natural variability, but the splice check can only detect large steps. 2000–2011 values carry higher uncertainty than 2012+.**

- **Slight positive bias on Aqua → VIIRS (`mean pred/actual = 1.17`):** While median hold-out error drops from **19.8% to 8.7%**, the prediction is slightly high on average (`1.17×`) across hold-out months due to low-count monsoon months.
- **Monsoon factor uncertainty (`Jun–Sep` Aqua → VIIRS factor $\approx 17$):** The pooled Jun–Sep factor for Aqua→VIIRS is **16.7** (~17), roughly double the other months (`5.0–12.3`). Monsoon season is where calibration is least certain because active-fire counts are tiny across India.
- **`2012-01` handover shows a +26% rise (`×1.264`, `+0.81σ`):** The 12 months after `2012-01` are **+26% higher** than the 12 months before (`2002-07` is `×1.004`, `−0.17σ`). That is within normal year-to-year fire variation (`±26.5%`), but it is a rise, not a flat line.
- **Splice check power & pre-2012 uncertainty:** Natural year-to-year fire variability is **±26.5%** (`placebo std = 0.265`), so handover checks can only detect steps larger than ~50%. Terra→Aqua (`2000–2002` chained) has a **24.1% median (27.6% mean)** monthly hold-out error, and the Aqua→VIIRS annual ratio drifts **~10%** from 2012 (`7.47`) to 2019 (`8.20`).
- **Provisional NRT months (Aug 2026+):** Static-source masking leaves ~±4% residual error; the final month is partial.
