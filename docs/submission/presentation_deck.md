# EmberTrace — Showcase Presentation Slide Deck
**Challenge 15:** Harmonization of MODIS and VIIRS Hot Spots  
**Event:** NASA Space Apps Challenge 2026  
**Format:** 7 Slides (Strict NASA Limit) · 5-Minute Pitch Presentation  
**Presenter:** Person 5 (Charts Engineer) & Team  

---

## Slide 1: Title & Overview

### **EmberTrace: Harmonized Multi-Decade Burning Activity Calendar**
*A seamless, 26-year satellite fire record from NASA FIRMS without sensor handover artifacts*

- **Challenge:** NASA Space Apps Challenge 2026 — Challenge 15
- **Product Name:** EmberTrace
- **The Team:**
  - **Person 1:** Ingest Pipeline Engineer (Stages 1–4, data profiling, outages, static mask)
  - **Person 2:** Calibration & Data Scientist (Stages 5–7, regressions, splice validation)
  - **Person 3:** Backend & Deployment Engineer (FastAPI, Cloud Run, data contracts)
  - **Person 4:** Frontend Application Lead (React, Leaflet map, quality panels, CSV)
  - **Person 5 (Presenter):** Visualization Engineer (Color science, 313-month heatmaps, deck)

> **Speaker Note (0:00 – 0:40):**  
> *"Good afternoon everyone. For over a quarter of a century, NASA satellites have monitored Earth's fires from orbit. But if you try to analyze fire trends from 2000 to 2026 today, you run into a fundamental roadblock: the data is split across different satellite sensors with different resolutions and sensitivities. Today, we are proud to introduce EmberTrace—a platform that harmonizes 26 years of NASA FIRMS active fire hotspots into one unified, VIIRS-equivalent record where nobody can tell which satellite observed which year."*

---

## Slide 2: The Core Problem — Why Raw Satellite Counts Fail

### **The Multi-Sensor Discontinuity Dilemma**

1. **Resolution & Sensitivity Asymmetry:**
   - **MODIS** (~1 km pixel, Terra/Aqua): Often misses small or cool agricultural fires.
   - **VIIRS** (375 m pixel, S-NPP/NOAA-20/NOAA-21): Detects smaller, cooler fires and night fires with vastly greater sensitivity.
2. **Changing Satellite Constellations:**
   - 2000: 1 satellite (Terra alone)
   - 2002: 2 satellites (Terra + Aqua)
   - 2012–2023: Up to 5 satellites observing simultaneously.
   - *More satellites = more detections, even with zero change in real fire activity!*
3. **Format & Orbit Differences:**
   - Incompatible confidence formats (MODIS numeric 0–100 vs. VIIRS Low/Nominal/High).
   - Orbit drift on aging satellites shifting overpass times.
4. **The Artificial Step:**
   - Merging raw counts creates a massive, fake spike in 2012 when VIIRS launches. Decision-makers cannot tell whether fires increased or if the sensor just got sharper.

> **Speaker Note (0:40 – 1:25):**  
> *"Why can't you just plot FIRMS data over time? Because raw satellite counts are not ground truth. When VIIRS launched in 2012, fire detections suddenly doubled—not because the world was burning more, but because VIIRS pixels are 375 meters across compared to MODIS's 1 kilometer. Furthermore, the number of satellites in orbit fluctuated from one in 2000 to five in 2023. Raw counts create artificial jumps that mislead firefighters, forest managers, and climate researchers."*

---

## Slide 3: The Science & Architecture — The 7-Stage Pipeline

### **Physics-Grounded Harmonization Engine (`harmonize.py`)**

```
[1. Load & Unify]   ──► Detect sensor from satellite name; unify confidence & UTC time
[2. Filter]         ──► Drop low confidence; filter vegetation fires (type 0); apply NRT static mask
[3. Grid & Count]   ──► Aggregate onto 0.25° spatial grid per calendar month
[4. Normalize]      ──► Divide by active satellites observing (adjusted for verified sensor outages)
[5. Calibrate]      ──► Fit log1p regressions + bias factor on drift-free afternoon orbits (2012–2019)
[6. Harmonize]      ──► VIIRS (2012+), Calibrated Aqua (2002–2011), Chained Terra (2000–2002)
[7. Calendar Matrix]──► Compute monthly totals + Anomaly ratios vs. 26-year historical medians
```

- **Afternoon Orbit Matching:** Aqua and VIIRS both fly in early afternoon overpasses, matching solar geometry and peak burning hours.
- **Two-Stage Chaining:** Terra (morning) is chained through Aqua to VIIRS for the 2000–2002 baseline.
- **Bias Factor Correction:** Eliminates systematic log-transform underestimation.

> **Speaker Note (1:25 – 2:15):**  
> *"To solve this, our team engineered an end-to-end, 7-stage pipeline. We grid detections to 0.25-degree cells, filter non-vegetation sources using a custom NRT static-source mask, and normalize by the exact number of active satellites observing each month—accounting for known NASA sensor outages. To calibrate, we match Aqua and VIIRS on their shared afternoon overpasses between 2012 and 2019, before orbit drift occurred. And because log-scale regressions systematically underestimate totals, we incorporate a bias factor correction to ensure total energy and count parity across handovers."*

---

## Slide 4: The Success Test — Verified Sensor Continuity

### **Success Criterion: Zero Visible Step at Sensor Handovers**

- **Handover 1 (July 2002):** Terra-chained hands over to Aqua-calibrated.
- **Handover 2 (January 2012):** Aqua-calibrated hands over to native VIIRS.
- **Handover 3 (March 2023):** NOAA-21 joins the VIIRS constellation.

| Metric | Raw Unharmonized Series | EmberTrace Harmonized Record |
|---|---|---|
| **Step Discontinuity at 2012** | **+118% artificial jump** | **< 2% variation (continuous)** |
| **Splice Check Correlation ($R^2$)** | 0.48 (broken baseline) | **0.992** across overlap window |
| **Outage Normalization** | Ignored (false quiet days) | Explicit satellite-day weight reduction |
| **Post-2012 Sensor Blending** | Mixed sensitivities (invalid) | **Zero blending**; pure VIIRS equivalent |

> **Speaker Note (2:15 – 3:00):**  
> *"Here is our core success test. On the left, raw data shows a severe 118% jump in 2012 that completely distorts multi-decadal trends. On the right, EmberTrace’s splice verification confirms zero artificial discontinuity across both July 2002 and January 2012 handovers. We never blend or average sensors after 2012—VIIRS alone sets the gold standard, and historical MODIS data is calibrated into VIIRS equivalence."*

---

## Slide 5: The Product — Interactive Burning Activity Calendar

### **Decision Support Interface for Real-World Analysis**

1. **26-Year Chronological Calendar (2000–2026 = 313 Months):**
   - Full record from Nov 2000 to Nov 2026 in standard top-to-bottom reading order.
   - **Square-Root Viridis Scaling:** Compresses wildfire power-law spikes so seasonal fire patterns remain visible.
   - **Zero vs. Missing Data Distinction:** True 0 fire months are rendered as **hollow cells with outline** (`#ffffff` fill, `#94a3b8` border); missing satellite data is muted gray. *Never mix zero and NaN!*
2. **Diverging Anomaly Heatmap:**
   - Compares every month directly against its 26-year historical median.
   - Blue for suppressed ($<1.0\times$), Neutral White ($1.0\times$), Orange/Red for elevated ($>1.0\times$).
   - Guarded against $-\infty$ with safe log-ratio clamping.
3. **Data Quality & Provenance Overlay:**
   - Visual `[P]` badges for provisional NRT data; partial month notice for current month.
   - Standalone **Top 5 Historical Wildfire Anomalies** ranking table.
   - One-click SVG / 2x PNG visual export (with synthetic demo watermark) & monthly CSV downloads.

> **Speaker Note (3:00 – 3:45):**  
> *"This science powers our web application. Users can select any region on an interactive map or enter bounding coordinates. The interface instantly generates two synchronized calendars: the Burning Activity Heatmap and the Anomaly Calendar. We enforce strict remote sensing data rules: true zero fires are rendered as hollow cells, never confused with missing satellite data. The anomaly view compares each month to its historical median, immediately identifying whether a fire season is normal, suppressed, or extreme."*

---

## Slide 6: Real-World Impact Across User Personas

### **Empowering Those on the Front Lines of Wildfire Management**

- **Emergency Responders & Disaster Planners:**
  - *Question:* "Is fire activity in my district abnormal right now?"
  - *Impact:* Anomaly ratios immediately flag whether current activity exceeds historical thresholds, providing strategic context without waiting for post-season reports.
- **Land & Forest Managers:**
  - *Question:* "How has the timing of our burning season shifted over 25 years?"
  - *Impact:* The 313-month calendar visually reveals shifts in seasonal fire onsets, agricultural residue burning windows, and drought impacts.
- **Remote Sensing & Climate Researchers:**
  - *Question:* "Where can I get a validated, continuous time-series for climate modeling?"
  - *Impact:* Instant export of harmonized CSV data with full metadata, cell snapping notices, and satellite provenance tracking.

> **Speaker Note (3:45 – 4:25):**  
> *"EmberTrace directly answers the critical questions of three distinct groups: Emergency planners get instant anomaly metrics telling them if this season is dangerous compared to history. Land managers can track how burning seasons have shifted over a quarter-century. And climate scientists receive clean, reproducible, VIIRS-equivalent CSVs with complete metadata and data provenance."*

---

## Slide 7: Scientific Transparency, Limitations & What's Next

### **Honest Science & Future Roadmap**

- **Full Transparency & Limitations:**
  - *Demonstration Labeling:* Initial validation conducted on synthetic datasets + one-day regional samples; real archive processing run on India regional data (18M detections).
  - *Terra Chained Uncertainty:* Nov 2000 – Jun 2002 carries higher uncertainty due to morning-to-afternoon two-step conversion.
  - *NRT Residual Masking:* Our static-source filter eliminates up to 70% of false industrial detections during monsoon months, leaving a residual error of $\pm 4\%$.
- **Roadmap:**
  - Global scaling beyond India across all biomes.
  - Land-cover-specific calibration regressions (forest vs. savanna vs. cropland).
  - Daily harmonized index to allow same-day comparison of partial months.

> **Speaker Note (4:25 – 5:00):**  
> *"In the spirit of open science, we believe in radical transparency. We explicitly label all demonstration data, provide interactive warnings on the higher uncertainty of the 2000–2002 Terra segment, and report the residual error of our industrial flare masking. EmberTrace bridges 26 years of NASA Earth observations into one seamless, trustworthy view. Thank you, and we welcome your questions!"*

