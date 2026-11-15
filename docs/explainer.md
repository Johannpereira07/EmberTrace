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
3. **Convert pre-2012 MODIS to VIIRS-equivalent (`Option C` Ratio-of-Totals):**
   - **Jan 2012 – Present (`VIIRS`):** Normalized VIIRS detections directly (never blended with MODIS).
   - **Jul 2002 – Dec 2011 (`AQUA_calibrated`):** Afternoon Aqua normalized detections multiplied by the 2012–2019 Aqua→VIIRS overlap factor (**`×7.98`**).
   - **Nov 2000 – Jun 2002 (`TERRA_chained`, lower confidence):** Morning Terra normalized detections chained through the 2002–2011 Terra→Aqua overlap factor (**`×2.77`**) and then to VIIRS (**`×22.12`** combined).
   - **Zero stays zero:** A quiet cell with `0` detections always converts to `0.0` (no artificial floor).

---

## 2. Showcase Slide Copy (Person 2's Two Slides)

### Slide A: How Harmonization Works
- **The Problem:** VIIRS (375 m) detects **~8× more hotspots** than MODIS Aqua (1 km), and adding NOAA-20 (2018) and NOAA-21 (2023) triples raw VIIRS counts.
- **Step 1 — Per-Satellite Normalization & Outage Correction:** Divide raw counts by active satellite-days observing each month (`platform_weight`). Agreement between combined VIIRS and S-NPP-only is within **±1.5%** across 2018–2025.
- **Step 2 — Overlap Ratio Calibration (`Option C`):**
  - **Aqua → VIIRS (`2012–2019`):** `×7.98` (hold-out monthly-total $r = 0.96$, median error $19.8\%$).
  - **Terra → Aqua (`2002–2011`, chained for `2000–2002`):** `×2.77` (monthly-total $r = 0.87$).
  - **Zero-preserving:** $0 \text{ detections} \mapsto 0.0$ everywhere; unobserved months stay `NaN`.
- **Evidence:** Deseasonalized 12-month handover steps are **`−0.60σ` at `2002-07`** and **`+0.64σ` at `2012-01`** (well within normal year-to-year fire variability).

### Slide B: Limitations (Exact Wording)
> **Calibrated on the 2012–2019 overlap (monthly-total $r = 0.96$). Handover steps are within natural variability, but the splice check can only detect large steps. 2000–2011 values are reliable for yearly and seasonal patterns, not individual months.**

- **Splice check power:** Natural year-to-year fire variability over India is **±27%** (`placebo std = 0.27`), so handover tests can only detect steps larger than ~50%. The primary evidence is the 8-year overlap fit ($r = 0.96$).
- **2000–2011 single-month uncertainty:** Terra→Aqua has a **68% median (97% mean)** monthly hold-out error because one global factor cannot capture seasonal diurnal shifts (overpredicting May–Sep monsoon troughs by 2–4× and underpredicting Oct–Nov agricultural burns by 0.2–0.4×).
- **Overlap drift:** The Aqua→VIIRS yearly ratio drifts by **~10%** between 2012 (`7.47`) and 2019 (`8.20`).
- **Provisional NRT months (Aug 2026+):** Static-source masking leaves ~±4% residual error; the final month is partial.
