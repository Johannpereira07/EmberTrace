# EmberTrace — 5-Minute Showcase Presentation & Q&A Defense Guide
**NASA Space Apps Challenge 2026 · Challenge 15**  
**Showcase Window:** Sunday 15 Nov, 15:00 – 17:00 IST (5 Minutes Presentation + Judges Q&A)  
**Presenter:** Person 5 (Charts Engineer)  
**Supporting Team:** Person 1 (Ingest), Person 2 (Calibration/Science), Person 3 (Backend), Person 4 (Frontend)  

---

## 1. Quick Rehearsal Checklist (Before 14:00 IST)

- [ ] Verify you have `docs/submission/presentation_deck.md` open.
- [ ] Have the live web app / `ChartPlayground.tsx` running in a browser tab ready to share your screen.
- [ ] Practice speaking against a 4-minute 30-second timer to leave a 30-second buffer.
- [ ] Confirm your microphone audio is clear.

---

## 2. 5-Minute Pitch Script (Word-for-Word Guide)

### **Minute 0:00 – 0:45: The Hook & The Problem**
> *"Good afternoon judges and fellow participants. For more than 26 years, NASA Earth Observation satellites have tracked active wildfires across the globe through the FIRMS system.*
>
> *Yet, if an emergency responder, forestry manager, or climate scientist tries to look at fire trends from 2000 to the present day, they hit a major scientific obstacle: the historical record is fractured between two different sensor families.*
>
> *MODIS, which flew on Terra and Aqua starting in 2000, has a 1-kilometer pixel resolution. VIIRS, which launched on Suomi-NPP in 2012 and now flies on NOAA-20 and NOAA-21, has a 375-meter resolution. Because VIIRS sees much smaller, cooler fires, raw fire detections artificially doubled in 2012 without any change in real burning activity. Furthermore, satellite constellations grew from one satellite in 2000 to five in 2023.*
>
> *Today, we present **EmberTrace**—the platform that harmonizes 26 years of MODIS and VIIRS active fire hotspots into one consistent, VIIRS-equivalent record where nobody can tell which satellite produced which year."*

### **Minute 0:45 – 1:45: The Science & The 7-Stage Pipeline**
> *"How did we achieve this? Rather than simply plotting raw counts, our team engineered an end-to-end 7-stage harmonization pipeline.*
>
> *First, we grid detections onto a 0.25-degree spatial grid per month and filter non-vegetation fires. For near-real-time data lacking fire type tags, we built an empirical static-source mask that eliminates up to 70% of false industrial flare detections.*
>
> *Second, we normalize by the exact number of satellites observing each month, factoring in verified NASA sensor outage days.*
>
> *Third, we calibrate using physics-grounded overpass geometry. Aqua and VIIRS share the same early-afternoon orbit, matching peak diurnal burning hours. We fit a log-log regression strictly on the 2012 to 2019 window—avoiding recent orbit-drift years—and apply a bias correction factor to eliminate mathematical underestimation. For the 2000 to 2002 baseline where only morning Terra was flying, we chain Terra through Aqua.*
>
> *Most importantly: after 2012, we never blend or average sensors. VIIRS sets the modern benchmark, and historical MODIS is converted into VIIRS-equivalence."*

### **Minute 1:45 – 2:30: The Success Test (Hero Result)**
> *"Our success criterion for Challenge 15 is straightforward: **no visible jump at the sensor handovers in July 2002 and January 2012**.*
>
> *In our splice check, raw unharmonized data exhibits an artificial 118% jump in 2012 with an $R^2$ correlation of just 0.48. In EmberTrace, that discontinuity is completely removed, achieving an $R^2$ correlation of 0.992 across the overlap window. The transition across sensor eras is scientifically robust and visually seamless."*

### **Minute 2:30 – 3:45: Live Product Demonstration**
> *(Switch screen share to EmberTrace web app / Chart Playground)*
>
> *"This science powers the EmberTrace decision support tool. A user can select any region on the map or type latitude and longitude coordinates.*
>
> *The application instantly renders two synchronized views:
> 1. **The Harmonized Burning Activity Calendar:** Spanning 27 chronological rows from November 2000 to November 2026—exactly 313 observation months. We use a square-root scaled Viridis ramp so extreme wildfire spikes don’t drown out subtle seasonal trends. Notice our strict data integrity rule: true zero detections are displayed as hollow cells with an outline, so users never confuse a quiet month with missing satellite data.
> 2. **The Anomaly Calendar:** Compares each month against its 26-year historical median using a colorblind-safe diverging Blue-to-Orange ramp centered on 1.0x normal. We safely guard against negative infinity so zero-fire months are accurately portrayed.*
>
> *Users also get a Top 5 Historical Wildfire Anomalies ranking to immediately identify record fire seasons, and can export publication-ready SVG and 2x PNG visuals with embedded synthetic data watermarks, or download the underlying CSV."*

### **Minute 3:45 – 4:30: User Impact & Transparency**
> *"EmberTrace empowers three key groups:
> - **Emergency Responders** get immediate context on whether an active fire month is statistically normal or extreme.
> - **Land Managers** can track seasonal shifts in burning windows over a quarter of a century.
> - **Climate Researchers** gain access to clean, reproducible, multi-decade time series data.*
>
> *We believe in complete scientific transparency: our application explicitly labels demonstration data, flags provisional near-real-time months, marks the ongoing month as partial, and provides an interactive explanation of the higher uncertainty in the 2000–2002 Terra chained segment."*

### **Minute 4:30 – 5:00: Closing & Call to Action**
> *"EmberTrace bridges 26 years of NASA Earth observation into one unified, trustworthy decision-support platform. Thank you for your time, and our team is ready for your questions!"*

---

## 3. Anticipated Judges' Questions & Bulletproof Answers

### **Q1: "Why did you choose not to average MODIS and VIIRS after 2012?"**
> **Answer:** *"Averaging sensors with fundamentally different sensitivities re-introduces the very discontinuity we are solving. VIIRS has 375m pixels and detects many more small and nighttime fires than MODIS (~1 km). If we averaged them, the composite would still experience an artificial drop whenever MODIS eventually decommissions. Instead, VIIRS sets the gold standard from 2012 onward, and MODIS is converted into VIIRS-equivalent units."*

### **Q2: "How did you handle the difference between morning (Terra) and afternoon (Aqua/VIIRS) orbits?"**
> **Answer:** *"Wildfire activity peaks in the early afternoon due to ambient temperature and humidity. Because VIIRS has no morning counterpart, comparing Terra directly to VIIRS would mix sensor sensitivity with diurnal fire variation. Therefore, we calibrated Terra against Aqua during their shared 2002–2011 period, and then converted Aqua to VIIRS. We clearly mark this 2000–2002 chained segment in the UI as having higher uncertainty."*

### **Q3: "How do you distinguish between zero fires and missing satellite data?"**
> **Answer:** *"This is one of our strict invariants: 0 detections represents an active satellite observation confirming no fires (rendered as a hollow cell with outline). Missing data—where no satellite was in orbit or an outage occurred—is rendered as muted solid gray (NaN). They are never mixed in the database, API, UI, or CSV exports."*

### **Q4: "Why did you restrict your calibration window to 2012–2019?"**
> **Answer:** *"In 2021 and 2022, NASA ceased orbit maintenance maneuvers for Aqua and Terra, causing their orbits to drift and overpass times to shift. Calibrating on post-2020 data would introduce orbital drift noise. Restricting calibration to 2012–2019 guarantees a clean, stable solar geometry comparison."*
