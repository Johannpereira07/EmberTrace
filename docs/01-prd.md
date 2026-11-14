# EmberTrace: Product Requirements Document

Historical Fire Activity Harmonization and Visualization Platform

|**Product**|EmberTrace|
|---|---|
|**Document**|Product Requirements Document (PRD)|
|**Version**|1.0|
|**Status**|Draft, for team review on 14 Nov 2026|
|**Date**|November 12, 2026|
|**Event**|NASA Space Apps Challenge 2026, Challenge 15: Harmonization of MODIS and VIIRS Hot Spots|
|**Platform**|Web application (browser-based) over a precomputed data layer|
|**Audience**|Hackathon team (backend, data pipeline, frontend, product)|
|**Delivery**|Hackathon MVP, built first on synthetic data and mock API responses|
|**Source documents**|Architecture and Methodology (draft, 9 Nov 2026), the primary source for science and pipeline behavior; Task Delegation (12 Nov 2026), the source for scope, priorities and deadlines|

### **Status legend**

Every statement in this document that is not simply a requirement carries one of these labels, so that facts, decisions and open items are never mixed.

|**Label**|**Meaning**|
|---|---|
|**[Established]**|Stated in the source documents.|
|**[Implemented]**|Exists today in`harmonize.py`, tested on synthetic data and two one-day sample files only.|
|**[Proposed]**|Not specified in the source documents. A recommendation by this PRD, open to team decision.|
|**[Pending validation]**|Requires the real FIRMS archive. Not yet done. Not to be reported as done.|
|**[Unverified]**|A fact taken from memory or from conflicting sources. Must stay labeled until confirmed.|

## **1. Executive Summary**

EmberTrace is a web application that lets a user select any geographical area and explore its historical fire activity as a year-by-month calendar, from **November 2000 to the latest available month** .

NASA FIRMS hotspot detections come from two sensor families: MODIS (Terra, Aqua) and VIIRS (S-NPP, NOAA-20, NOAA-21). VIIRS has smaller pixels (about 375 m against about 1 km) and detects more fires than MODIS for the same real activity. The number of satellites in orbit also changes over time, and the two sensors report confidence in different formats. Raw counts from the two families therefore cannot be compared, and joining them produces artificial jumps in the record.

The product addresses this with an offline preprocessing and calibration pipeline ( `harmonize.py` ) that converts the whole record into a single **VIIRS-equivalent monthly fire activity series** . The web application queries the precomputed result. It does not recalibrate anything per request.

Users can:

- Select an area on a map, or by latitude/longitude bounds, and choose a date range.

- See a **historical calendar** of monthly fire activity (years by months).

- See an **anomaly calendar** showing whether each month is above or below the historical median for the same calendar month.

- See which months are provisional, partial, converted from older satellites, or based on sparse detections.

- Download the monthly data for the selected area as CSV.

**Value proposition.** Raw FIRMS counts show step changes whenever the instrument changes, so a user cannot tell real change from sensor change. This product aims to present one continuous, comparable record in which a user does not need to know which satellite produced which year. **Success test [Established]: no visible jump in the calendar at the two sensor handovers, July 2002 and January 2012.**

**Current state.** The pipeline exists and has been tested on synthetic data and two one-day sample files. The web application is not built. The full FIRMS archive has not been processed, and no real-data calibration or scientific validation has been done. This PRD is written so that the MVP can be built on synthetic data and mock responses, and switched to real data when the archive arrives.

## **2. Problem Statement**

Scientists, land managers and emergency responders who want to know "is fire activity unusual here?" face the following problems with raw FIRMS data.

- **Different sensitivity and pixel size.** VIIRS detects small fires that MODIS often misses. A rise in counts after January 2012 can be a sensor effect rather than a change in fire.

- **Changing satellite count.** Terra flies alone from Nov 2000 to Jun 2002, Terra and Aqua fly together until Dec 2011, and VIIRS satellites join from 2012, 2018 and 2023. More satellites means more detections with no change in real fire activity.

- **Different confidence formats.** MODIS reports a number from 0 to 100. VIIRS reports low, nominal or high. They cannot be filtered with one rule without conversion.

- **Artificial discontinuities.** Switching sensors in the middle of a record produces visible steps. A user comparing this year with 2010 would be comparing different instruments.

- **Hard to compare now with history.** There is no simple answer to "is this month normal for my area?" without building a consistent baseline.

- **No intuitive geographic monthly view.** There is no easy way to select an area and see its monthly fire history as a calendar.

**Why combining raw MODIS and VIIRS counts is insufficient.** The three differences above compound. Sensor sensitivity, satellite count and confidence scale all change at the same handovers. Only a consistent conversion, with calibration on years when two sensors observed the same places, can remove them.

#### **Per user group:**

- **Scientists** need a continuous record whose uncertainty is stated, not hidden.

- **Land managers** need a quick, defensible answer on whether a month or season is above or below normal for their jurisdiction.

- **Emergency responders** need context on how current activity compares with history. This product is a historical context tool, not an operational alerting tool (see 3.2).

## **3. Goals & Non-Goals**

### **3.1 Goals**

|**#**|**Goal**|**Measure**|
|---|---|---|
|G1|Allow users to select a geographical area by map or by lat/lon bounds|Selection works with both methods; invalid input is rejected with a message|
|G2|Display monthly fire activity from November 2000 to the latest available month|Calendar covers the full range supported by the loaded data; no requests outside coverage are accepted|
|G3|Provide a harmonized VIIRS-equivalent series|Every displayed month uses one of the three harmonization sources (VIIRS, calibrated Aqua, chained Terra)|
|G4|Avoid visible artificial discontinuities at July 2002 and January 2012|Splice check shows no step at either date (synthetic data now; real data pending validation)|
|G5|Provide a year-by-month fire activity heatmap|Calendar renders for any valid selection|
|G6|Provide a historical anomaly heatmap|Anomaly calendar renders for any valid selection|
|G7|Let users identify unusually high or low months|Anomaly values are shown with a diverging scale centered on 1.0|
|G8|Allow CSV download of the selected area's monthly data|CSV matches what is displayed|
|G9|Communicate data quality, provisional data and historical uncertainty|Provisional, partial, converted, chained, low-count and unavailable states are each visible and explained|

### **3.2 Non-Goals**

The initial hackathon MVP shall not:

- Predict future fires or provide forecasts.

- Detect fires using cameras or machine learning.

- Provide real-time emergency dispatch or alerting.

- Replace NASA FIRMS or reproduce its map and download tools.

- Provide fire spread simulation.

- Identify individual fire incidents or their causes.

- Claim to represent ground-truth fire activity. The product counts satellite detections only.

- Claim to be a fully validated scientific product before validation on the real archive.

- Recalibrate satellite conversions separately for each user-selected area.

- Correct for pixel footprint or scan angle (see 11).

- Include user accounts, saved areas, sharing or notifications. None were scoped in the source documents.

## **4. Users & Personas**

|**Persona**|**Role**|**Primary objective**|**Key questions**|**How the application helps**|
|---|---|---|---|---|
|**Emergency Responder**|Fire and disaster response planner or analyst|Understand how current fire activity in a region compares with its history|Is fire activity in this region unusually high this month? How does the current season compare with previous years?|Anomaly calendar highlights the current month against the historical median, with provisional and partial-month labels. It provides context only, not operational decisions.|
|**Scientist / Researcher**|Remote sensing, climate or ecology researcher|Explore a continuous multi-decade record and judge its reliability|Has fire activity increased or decreased compared with the historical median? How reliable is the displayed historical data? Which part of the record is least certain?|Harmonized series from Nov 2000, source and uncertainty indicators per month, CSV export for further analysis|
|**Land** **Manager**|Forest or agricultural authority|Plan around seasonality and recognize abnormal seasons in their jurisdiction|Which months historically have the highest fire activity? Is this season worse than normal?|Year-by-month heatmap shows seasonality at a glance, and the anomaly view shows departures from normal|

#### **Cross-persona questions the product must be able to answer:**

1. Is this month normal for my area?

2. Which months are usually the most active?

3. How much should I trust what I am looking at?

## **5. Features & Requirements**

Priorities: **Must Have** , **Should Have** , **Could Have** . The Must Have set follows the Task Delegation document: area selection by map or lat/lon, date range, calendar heatmap, anomaly heatmap, CSV download, together with the data-quality behaviors the design flags. Where this PRD sets a priority the sources do not state, it is marked **[Proposed]** .

### **5.1 Geographical Area Selection**

Users define the area of interest (AOI) on a map or by typing bounds.

#### **Functional Requirements**

- **Must:** Users shall be able to draw a rectangle on an interactive map to select the AOI.

- **Must:** Users shall be able to enter the AOI manually as minimum and maximum latitude and longitude.

- **Must:** The map and the manual fields shall stay in sync. Changing one updates the other.

- **Must:** The system shall display the selected area on the map at all times.

- **Must:** The system shall snap the AOI to whole grid cells. After snapping, the system shall display the area that will actually be analyzed.

- **Must:** The system shall show a visible notice that the analyzed area may differ from the drawn area because of rounding to grid-cell boundaries. The notice shall state the cell size currently in use. The cell size is a pipeline setting (0.25° by default, 0.5° under comparison), so the UI shall read it from the data rather than hard-coding it.

- **Must:** The system shall validate coordinates: latitude within -90 to 90, longitude within -180 to 180, minimum less than maximum. It shall reject invalid areas with a specific message.

- **Must:** The system shall reject an empty area (no cells inside the selection) and an area entirely outside the data coverage, with a clear message.

- **Should [Proposed]:** Users shall be able to draw a polygon. The source design mentions "polygon or box", but the Must list does not require it.

- **Should [Proposed]:** The system shall warn when the selection is very large, if a size limit is set after performance testing. The limit is not specified in the sources.

### **5.2 Date Range Selection**

#### **Functional Requirements**

- **Must:** Users shall be able to select a start month and an end month.

- **Must:** The default range shall be the full available record, starting November 2000.

- **Must:** The system shall not allow selection before November 2000 or after the latest available month, and shall return a clear message for invalid or reversed ranges.

- **Must:** The system shall state the latest available month and shall label the current month as incomplete (see 5.6).

- **Should [Proposed]:** The selector shall offer a one-click "full record" reset.

_Open item:_ the design computes the anomaly baseline over the years of the calendar table. It does not say whether a narrowed date range changes the baseline. See Appendix A, D1.

### **5.3 Historical Fire Activity Calendar**

#### **Functional Requirements**

- **Must:** The system shall display a year-by-month heatmap. Rows are years, columns are January to December.

- **Must:** Each cell shall show the harmonized monthly fire activity for the selected area. This is the sum of the harmonized per-cell values over all cells in the AOI, expressed in VIIRS-equivalent detections.

- **Must:** The color scale shall be sequential and colorblind-safe (Viridis or Cividis).

- **Must:** The numerical value shall be available on hover or shown in the cell. Color alone shall never carry the value.

- **Must:** The calendar shall visually distinguish three states: _zero detections_ (an observed month with no fires, a valid value of 0), _unavailable_ (no observation possible, such as before Nov 2000, or no data loaded), and _a value_ . Unavailable shall never be drawn as zero.

- **Must:** The calendar shall have a legend explaining the color scale and the cell states.

- **Must:** Months from the first record month onward shall appear. Months before November 2000 in the first year shall appear as unavailable, not empty or zero.

- **Should [Proposed]:** The displayed values shall be rounded for readability. The CSV shall carry the unrounded values.

### **5.4 Fire Activity Anomaly Calendar**

#### **Functional Requirements**

- **Must:** The system shall display a second year-by-month heatmap of anomalies for the same AOI and date range.

- **Must:** The anomaly for a month shall be its harmonized value divided by the median of the harmonized values for the same calendar month across years.

- **Must:** A value of 1.0 means normal activity. Above 1.0 means higher than usual, and below 1.0 means lower than usual.

- **Must:** The color scale shall be diverging, centered on 1.0 (blue for below normal, orange for above), and colorblind-safe.

- **Must:** The numerical anomaly shall be available on hover or inside the cell.

- **Must:** Where the historical median is zero or cannot be computed, the system shall not display a ratio, infinity or a misleading number. It shall show a distinct "not defined" state with an explanation. **[Proposed]** (the design states the ratio but not this case)

- **Must:** Unavailable months shall remain unavailable in the anomaly calendar, not become 0 or 1.

- **Should [Proposed]:** The system shall require a minimum number of years of data before it shows anomalies for a calendar month, and otherwise show "not enough history". The threshold is to be set when real data is available.

- **Should [Proposed]:** The system shall state the baseline period and the number of years used for the median.

### **5.5 Satellite Transition and Data Provenance**

Provenance is contextual. The calendar shall present one continuous record. It shall not draw the sensor handovers as visual breaks.

#### **Functional Requirements**

- **Must:** The system shall hold a source for each month: `VIIRS` (Jan 2012 onward), `AQUA_calibrated` (Jul 2002 to Dec 2011), or `TERRA_chained` (Nov 2000 to Jun 2002). **[Established]**

- **Must:** Converted years (before January 2012) shall be visually identified in a light-touch way, such as a subtle marker or a side label on the year rows. The marker shall not alter the color scale or create an apparent step.

- **Must:** The Nov 2000 to Jun 2002 segment shall carry an additional "lower confidence" indication, with a notice that it is converted in two stages (Terra to Aqua to VIIRS-equivalent) and is the least certain part of the record.

- **Must:** Source information for each month shall be shown on hover or in a detail view.

- **Must:** The application shall include a short plain-language explanation of what harmonization means and why it is applied. The explanation shall also state that fire activity is counted detections, not ground truth.

- **Should [Proposed]:** The user may toggle the provenance overlay on and off. The default shall be on, because hiding uncertainty is a non-goal.

- **Must (constraint):** The product shall not average or blend sensors after January 2012. VIIRS alone is used from then on. **[Established]**

_Note:_ From 2 Nov 2026 S-NPP no longer produces new FIRMS data. VIIRS from then on means NOAA-20 and NOAA-21. The source label stays `VIIRS` , so the user-facing experience is unchanged.

### **5.6 Data Quality and Reliability Indicators**

#### **Functional Requirements**

- **Must:** The latest 2 to 5 months, which are near-real-time (NRT) observations, shall be labeled **provisional** with an explanation that they may change when science-quality data replaces them. **[Established]** The exact number of months depends on the data, so the label shall come from the data (see Appendix A, D4), not from a fixed UI constant.

- **Must:** The current month shall be labeled **partial** . A half-finished month shall not be presented as comparable with full-month history without a clear label. The design offers two options (compare with the same day-of-month window, or label as partial). **This PRD requires labeling as partial; the day-of-month comparison is Could Have.**

- **Must [Proposed]:** The anomaly for a partial month shall be visually marked as non-comparable (for example hatched or muted), not colored as a normal anomaly.

- **Must:** The system shall display a **low-count warning** when the selected area's detections are very low, because sparse areas give noisy calendars and unstable anomalies. The threshold is not specified in the sources. It shall be configurable and set after seeing real data (Appendix A, D5).

- **Must:** The system shall distinguish zero detections from unavailable data everywhere it appears, including the CSV.

- **Must:** The notice for the chained Terra segment (5.5) shall always be reachable from the calendar.

- **Must:** Warnings shall appear alongside the results. They shall not block the display.

- **Should [Proposed]:** The system shall show an overall data-quality summary for the selection, listing active warnings (provisional months, partial month, converted years, low counts).

- **Should [Proposed]:** The system shall state that the calibration is currently based on synthetic data until real-data validation is complete (see 10 and 11).

### **5.7 Data Download**

The architecture defines three downloads. All three are retained. Priorities reflect effort and the MVP journey.

|**Download**|**Priority**|**Notes**|
|---|---|---|
|Harmonized monthly CSV for the selected area|**Must** **Have**|Required by the Task Delegation Must list|
|Chart image (PNG or SVG) of the calendar and anomaly views|**Should** **Have**|The challenge asks for downloadable visualizations. Medium effort.**[Proposed]**priority.|
|Raw detections inside the selected area|**Could** **Have**|Highest effort: the source file may need partitioning by year or a spatial index.**[Proposed]**priority.|

#### **Functional Requirements**

- **Must:** Users shall be able to download the harmonized monthly data for the selected area as CSV.

- **Must:** The CSV shall match what is displayed and shall include, for each month: the harmonized value, the anomaly, the source, and the provisional, partial and warning flags. Unavailable months shall be empty or explicitly marked. They shall never be written as 0. The exact columns belong to the API specification.

- **Must:** The CSV shall record the area as analyzed (after snapping), the date range and the cell size.

- **Should:** Users shall be able to download the calendar and anomaly visualizations as PNG or SVG, including the legend and the status markers (provisional, partial, converted, chained).

- **Could:** Users shall be able to download the raw detections for the selected area. The download shall be labeled as unharmonized native-sensor data, and may be size-limited. Whether the file contains all detections or only filtered ones is an open decision (Appendix A, D6).

### **5.8 Optional Features**

|**Feature**|**Priority**|**Rationale**|
|---|---|---|
|Monthly FRP (fire radiative power) visualization|**Could** **Have**|**Decision requested by Task Delegation.**FRP totals are computed per cell and month, but no FRP conversion between sensors is calibrated. Showing FRP across 2012 would bring back the sensor discontinuity the product exists to remove. If built, it shall be limited to VIIRS-era months or be clearly labeled unharmonized.|
|Most active historical months (top-N table)|**Should** **Have**|**[Proposed]**Derived directly from the calendar table. Low effort.|
|Current-year line chart against the historical median|**Could** **Have**|Mentioned as a possible extra in the design.|
|Additional summary statistics (for example mean, maximum month)|**Could** **Have**|Not required for the MVP journey.|
|Comparing a partial month with the same day-of-month window|**Could** **Have**|Alternative to the partial label, not required.|

These features shall not delay any Must Have feature.

## **6. Data Processing & Harmonization**

This section describes the product-facing behavior of the pipeline. It is not an implementation guide. All stages exist in `harmonize.py` **[Implemented]** , tested only on synthetic data and two one-day sample files.

### **6.1 Preprocessing versus interactive behavior**

- The pipeline runs **offline** . It produces five outputs: `unified.csv` , `cell_month.csv` , `calibration.json` , `calendar.csv` and `calendar_anomaly.csv` .

- The web application shall read the precomputed `cell_month.csv` . For each request it selects cells inside the AOI, sums per month, and builds the calendar and anomaly tables.

- The application shall **not** recalibrate satellites per request or per selected area. Conversions are fitted once on a large region and reused for any AOI, because fitting on a small area gives a noisy, unreliable line.

### **6.2 The seven stages**

|**#**|**Stage**|**Product-facing behavior**|
|---|---|---|
|1|**Load and unify**|Reads MODIS and VIIRS files into one schema and one confidence scale. Accepts both NRT text files and archive CSVs. The sensor is detected from column names.|
|2|**Filter**|Drops low-confidence detections. Keeps vegetation fires (type 0) where the archive provides fire type.|
|3|**Grid and count**|Counts detections per grid cell, per month, per series (Terra, Aqua, VIIRS). Empty cells are filled explicitly with 0, so quiet areas are not dropped.|
|4|**Normalize**|Divides counts by the number of satellites observing, with fractional weights for partial months. If no satellite was observing, the result is NaN.|
|5|**Calibrate**|Fits two conversions: Aqua to VIIRS and Terra to Aqua. Includes a bias factor and a 70/30 hold-out test. Refuses to fit on insufficient data.|
|6|**Harmonize**|Chooses the source for each cell and month and applies the conversions.|
|7|**Calendar and** **anomalies**|Sums cells over the selected area into the year-by-month table, and divides by the same-calendar-month median to give the anomaly table.|

### **6.3 Methodology the product relies on**

- **Confidence harmonization [Established, thresholds Unverified].** MODIS 0 to 100 and VIIRS l/n/h are mapped to low, nominal and high. The MODIS thresholds of 30 and 80 are from memory and are to be verified against the FIRMS user guides.

- **Filtering [Established].** Low-confidence detections are removed. Vegetation fires (type 0) are kept where the archive provides fire type. NRT sample files have no type column.

- **Grid aggregation [Established].** Monthly counts per cell. Default 0.25°, with 0.5° under comparison.

- **Satellite-count normalization [Established].** Fractional weights for months in which a satellite starts or ends. Terra and Aqua are normalized separately, and all VIIRS satellites together.

- **Aqua to VIIRS calibration [Established].** Fitted on 2012 to 2019, chosen to stay clear of orbit-drift years. Window is adjustable.

- **Terra to Aqua calibration [Established].** Fitted on August 2002 to December 2011. Used only for Nov 2000 to Jun 2002.

- **Source selection [Established].** VIIRS from January 2012 onward. Calibrated Aqua from July 2002 to December 2011. Chained Terra (Terra to Aqua to VIIRS-equivalent) for November 2000 to June 2002. MODIS is never averaged with VIIRS after 2012.

- **Missing data [Established].** NaN means no satellite was observing. 0 means observed with no detections. They shall never be interchanged.

- **Fit guard [Implemented].** A fit needs enough evidence (at least 30 rows and 12 distinct months in the window). The one-day samples are refused.

### **6.4 Product requirements on the data layer**

- The data layer shall deliver, for each cell and month: the harmonized value, its source, and the information needed to show NaN versus 0.

- The data layer shall deliver a flag marking NRT (provisional) months. **Gap:** the current `cell_month.csv` description lists counts per sensor, harmonized value and source. It does not mention a provisional flag or NRT origin. This needs to be agreed between the pipeline and API owners (Appendix A, D4).

- The data layer shall keep the schema frozen once shared, per the working rules in the Task Delegation document.

- The system shall be developed and demonstrated first on synthetic data and the two sample files, then switch to the real archive output without UI changes.

## **7. User Stories**

|**ID**|**User Story**|**Priority**|**Feature**|
|---|---|---|---|
|US-01|As a land manager, I want to draw a rectangle on a map, so that I can look at my jurisdiction's fire history.|Must Have|Area Selection (5.1)|
|US-02|As a scientist, I want to type exact latitude and longitude bounds, so that my analysis area is reproducible.|Must Have|Area Selection (5.1)|
|US-03|As a scientist, I want to be told the area was rounded to grid cells and to see the area actually used, so that I interpret the numbers correctly.|Must Have|Area Selection (5.1)|
|US-04|As a user, I want invalid or empty areas and out-of-coverage areas rejected with a clear message, so that I never get a silently wrong result.|Must Have|Area Selection (5.1)|
|US-05|As an analyst, I want to choose a start and end month, so that I can focus on the period I care about.|Must Have|Date Range (5.2)|
|US-06|As a land manager, I want a year-by-month calendar of fire activity for my area, so that I can see seasonality and bad years at a glance.|Must Have|Calendar (5.3)|
|US-07|As a user, I want to read the exact value of any month on hover or in the cell, so that I never depend on color alone.|Must Have|Calendar (5.3)|
|US-08|As a scientist, I want zero detections and unavailable data shown differently, so that I do not mistake missing data for a quiet month.|Must Have|Calendar (5.3, 5.6)|
|US-09|As an emergency responder, I want an anomaly calendar centered on 1.0, so that I can tell whether this month is unusually high or low for my area.|Must Have|Anomaly (5.4)|
|US-10|As a user, I want months with an undefined anomaly (zero median) marked as such, so that I am not shown a misleading ratio.|Must Have|Anomaly (5.4)|
|US-11|As a scientist, I want to see which years are converted and which source each month came from, so that I can judge the record's reliability without the calendar showing a jump.|Must Have|Provenance (5.5)|
|US-12|As a scientist, I want the Nov 2000 to Jun 2002 segment clearly marked as less certain, so that I do not over-interpret it.|Must Have|Provenance (5.5, 5.6)|
|US-13|As a user, I want a plain-language explanation of harmonization, so that I understand what the calendar shows without remote sensing background.|Must Have|Provenance (5.5)|
|US-14|As an emergency responder, I want recent months labeled provisional, so that I know they may change.|Must Have|Quality (5.6)|
|US-15|As a user, I want the current month labeled incomplete, so that I do not compare a partial month with full months.|Must Have|Quality (5.6)|
|US-16|As a land manager, I want a warning when my area has very few detections, so that I do not over-read a noisy anomaly.|Must Have|Quality (5.6)|
|US-17|As a scientist, I want to download the monthly data for my area as CSV, so that I can analyze it elsewhere.|Must Have|Download (5.7)|
|US-18|As a land manager, I want to download the calendar and anomaly charts as images, so that I can include them in reports.|Should Have|Download (5.7)|
|US-19|As a land manager, I want to draw a polygon, so that I can match an irregular boundary.|Should Have|Area Selection (5.1)|
|US-20|As a land manager, I want a list of the most active months for my area, so that I can see peak seasons.|Should Have|Optional (5.8)|
|US-21|As an analyst, I want a data-quality summary for my selection, so that I see every caveat in one place.|Should Have|Quality (5.6)|
|US-22|As a scientist, I want to download the raw detections inside my area, so that I can check the data behind the monthly numbers.|Could Have|Download (5.7)|
|US-23|As a scientist, I want monthly FRP as a second metric, so that I can look at fire intensity.|Could Have|Optional (5.8)|
|US-24|As an emergency responder, I want a line chart of the current year against the historical median, so that I can see how this season is tracking.|Could Have|Optional (5.8)|

## **8. Non-Functional Requirements**

Numerical targets marked **[Proposed target]** are recommendations to be confirmed by testing, not requirements from the sources.

|**Area**|**Requirements**|
|---|---|
|**Performance**|Because the pipeline is precomputed, a request shall only filter and sum precomputed values. Typical requests should return quickly enough to feel interactive.**[Proposed** **target]**: under 3 seconds for a typical area on the demo dataset, to be measured.|
|**Usability**|A first-time user shall complete the journey (select area, choose dates, read the calendar) without instructions. Technical terms shall be explained in plain language.|
|**Accessibility**|Sequential and diverging scales shall be colorblind-safe. Values shall be visible on hover or in the cell. Information shall never be carried by color alone, so unavailable, zero, provisional, partial and chained states shall also differ by pattern, label or icon. Keyboard focus and screen-reader labels for the main controls are**[Proposed]**.|
|**Data integrity**|The application shall display exactly what the pipeline produced, with no silent changes. NaN and 0 shall remain distinct from file to screen to CSV. The CSV shall match the display.|
|**Reliability**|The application shall return clear, specific errors for invalid input and shall not display partial or wrong results when a request fails.|
|**Sparse and missing data**|Sparse areas shall trigger a warning, missing data shall never be filled with 0, and undefined anomalies shall be shown as such.|
|**Scalability**|Queries shall remain workable as the area and date range grow, up to the full 2000-to-now record over the largest allowed area. Cell size (0.25° or 0.5°) affects table size and shall be compared for performance. Raw-detection downloads may need partitioning or a spatial index, and may need a size limit.|
|**Browser compatibility**|Current versions of the major desktop browsers. Mobile layout is**[Proposed]**as nice-to-have, not an MVP requirement.|
|**Security**|The application is public and read-only. It shall validate all input on the server, shall not expose any credentials, and shall not accept uploads. Earthdata and FIRMS credentials used to obtain data shall stay out of the repository and the client.|
|**Maintainability**|The pipeline shall keep stable function signatures and file schemas. Satellite dates, calibration windows and cell size shall be configuration, not hard-coded. The frontend shall run against mock responses and real responses without code changes.|

## **9. Data Sources & External Dependencies**

|**Source**|**Role**|**Status**|
|---|---|---|
|**NASA FIRMS archive**(MODIS Terra and Aqua; VIIRS S-NPP and NOAA-20, and NOAA-21 for recent years)|Science-quality history, the basis for all calibration and the calendar|**Not yet available to the team.** Requires an Earthdata Login and an Archive Download request that the FIRMS team approves. It may arrive only after the hackathon starts (the Architecture document expected it on 13 Nov, the Task Delegation document warns it may be later). **[Pending]**|
|**FIRMS NRT data**|Recent months, provisional, replaced by science-quality data usually after 2 to 3 months, up to 5|Two one-day samples held (10 Sep 2026, South Asia: MODIS 24 rows, VIIRS NOAA-20 523 rows)|
|**MODIS Terra / Aqua**|Terra from Nov 2000, Aqua from Jul 2002. Aqua is calibrated to VIIRS. Terra is used only for Nov 2000 to Jun 2002.|Satellite start and end dates to be verified**[Unverified]**|
|**VIIRS S-NPP / NOAA-20 / NOAA-21**|S-NPP Jan 2012 to 2 Nov 2026, NOAA-20 from Apr 2018, NOAA-21 from Mar 2023|NOAA-21 start date conflicts across FIRMS pages (1 Mar 2023 versus 17 Jan 2024); the archive date of 1 Mar 2023 is used.**[Unverified]**|
|**Synthetic development data**|Initial inputs to build and test the pipeline, API, UI and splice logic|Available. It proves the code runs and the splice logic works. It does not prove the science.|
|**LANCE archive path**|Possible bulk source for history|Not verified as a source of full history. The FIRMS page describes it as covering about the last two months. Use the Archive Download tool until tested.**[Unverified]**|

The distinctions that the application and its documentation shall preserve:

- **Archive data** is science quality. **NRT data** is provisional.

- **Synthetic data** is for development only and is never presented as real fire history.

- The **two sample files** cover one day each. They test the loader and confirm schema differences, and cannot calibrate anything.

Other dependencies: hosting for the data and the app is an open question (Appendix A, D7). Real archive access and calibration validation are **pending** .

## **10. Validation & Success Criteria**

### **10.1 Pipeline and product tests (possible now with synthetic data and samples)**

These show that the software behaves as specified. They are **not** scientific validation.

|**#**|**Criterion**|**Pass condition**|
|---|---|---|
|V1|No visible discontinuity at July 2002|Splice check on the synthetic calendar shows no step|
|V2|No visible discontinuity at January 2012|Splice check on the synthetic calendar shows no step|
|V3|Calendar and anomaly generation|Both tables are produced for valid selections|
|V4|Zero versus unavailable|A satellite not yet flying gives NaN, empty cells give 0, and the UI and CSV preserve the difference|
|V5|Provisional labeling|The latest 2 to 5 NRT months are labeled provisional|
|V6|Partial-month labeling|The current month is labeled incomplete|
|V7|Area selection and snapping|A drawn or typed area snaps to whole cells, the snapped area is shown, and the notice appears|
|V8|Input validation|Invalid coordinates, empty areas, out-of-coverage areas and invalid dates are rejected with clear messages|
|V9|CSV export|The file for a selected area matches the displayed values and preserves the unavailable state|
|V10|Low-count warning|A sparse synthetic area triggers the warning and a normal area does not|
|V11|Fit guard|The one-day sample is refused by the fit guard|
|V12|Anomaly edge cases|Zero or undefined medians show "not defined", never a ratio or infinity|
|V13|Loader formats|Both NRT and archive-style files load|

### **10.2 Scientific validation on the real FIRMS archive [Pending validation]**

None of these has been done. None shall be reported as passed until run on real data.

- **Overlap comparison:** converted Aqua against actual VIIRS inside the fitting window, with correlation reported. This is the main evidence.

- **Correlation and hold-out error** for both fits, read from `calibration.json` .

- **Splice checks on real data** at July 2002 and January 2012.

- **Post-2019 drift assessment:** compare converted Aqua with actual VIIRS from 2020 onward. A growing gap supports ending the fitting window at 2019.

- **Known fire-season sanity checks:** known bad seasons in the test region should show high anomaly values.

- **Verify the constants:** confidence thresholds (30, 80) and satellite start and end dates, with anything unconfirmed left as "unverified".

- **Cell-size and fit-level comparison:** 0.25° versus 0.5°, and cell-level versus region-month fitting.

Results shall be reported honestly, including weak fits and unresolved issues, as limitations in the final presentation.

## **11. Assumptions, Constraints & Known Limitations**

#### **Assumptions**

- The Architecture and Methodology document is the source of truth for the science. This PRD does not change the harmonization strategy.

- The real archive may arrive late, so the MVP is built on synthetic data and mock responses.

**Known limitations** (all shall be reflected in what the UI and documentation claim)

- Calibration has been evaluated on **synthetic data only** . Synthetic results (for example a correlation of 0.996 and about 17% error for Aqua to VIIRS) say nothing about real fire data.

- The two one-day samples **cannot establish a conversion relationship** .

- Terra's morning overpass has **no VIIRS counterpart** , so the Nov 2000 to Jun 2002 segment is chained through Aqua. It is the **least certain** part of the calendar and shall be marked as such.

- One regression per satellite pair for the whole region probably does not represent all **land cover types and regions** (for example forest fires versus crop burning).

- Satellite normalization assumes about equal fire observation per satellite, which is approximate because satellites pass at different times of day.

- **Pixel footprint and scan-angle effects** are not corrected. Only detections are counted.

- **Sparse areas** give noisy calendars and unstable anomalies.

- **NRT data may change** when science-quality data replaces it.

- Terra and Aqua orbit drift (maneuvers ended in 2022 and 2021) affects later years. Calibration windows are conservative and are to be checked against the data.

- **Unverified items** (NOAA-21 start date, confidence thresholds, satellite dates, LANCE archive coverage) must stay labeled unverified until confirmed.

- **Cell resolution** (0.25° or 0.5°) is undecided and subject to calibration and performance comparison.

- Fitting at cell level is noisy. Region-month fitting may be more stable, and both are to be compared.

- After 2 Nov 2026, VIIRS means NOAA-20 and NOAA-21 only.

- The hosting plan is undecided.

## **12. MVP Scope & Delivery Priorities**

### **12.1 Priority summary**

|**Priority**|**Features**|
|---|---|
|**Must Have**|Rectangle selection on a map and lat/lon entry with validation (5.1); grid snapping and notice (5.1); date range (5.2); historical calendar heatmap with zero/unavailable distinction (5.3); anomaly heatmap with edge-case handling (5.4); converted-years and chained-segment indication, per-month source, harmonization explanation (5.5); provisional, partial-month and low-count labeling (5.6); monthly CSV download (5.7)|
|**Should Have**|Polygon selection; chart image download (PNG/SVG); most active months table; data-quality summary; provenance toggle|
|**Could Have**|Raw detections download; monthly FRP; current-year line chart; extra summary statistics; day-of-month partial-month comparison|

### **12.2 MVP user journey**

1. Select an area (map or lat/lon).

2. Choose a date range.

3. Retrieve harmonized monthly fire activity.

4. View the historical calendar.

5. View the anomaly calendar.

6. Understand data quality and provenance.

7. Download the monthly CSV.

### **12.3 What can run on synthetic data and mock responses**

Every Must Have feature can be built and demonstrated on synthetic output and mock API responses (a normal area, a sparse area with a low-count warning, and an error case, as planned in the Task Delegation document). The two sample files test the loader and the schema. The numbers shown in the MVP are **synthetic** and shall be labeled as demonstration data until real-archive results exist.

### **12.4 Preparation timeline (from the Task Delegation document)**

|**When**|**Milestone**|
|---|---|
|13 Nov, noon|API spec draft and examples to the UI role; Must list shared with the UI role|
|13 Nov, end of day|Pipeline verification report, verified constants and calibration report, this PRD, the API spec and a clickable UI prototype|
|14 Nov|Hackathon starts. Review deliverables and begin implementation. Deployment, slides and demo follow later.|

## **Appendix A: Open Decisions and Proposed Decisions**

|**ID**|**Decision**|**Status and recommendation**|
|---|---|---|
|D1|Does the anomaly baseline use the selected date range, or always the full available record?|Open. The design builds the median from the calendar table.**[Proposed]**use the full record and display the baseline period, so a narrower view does not change the meaning of 1.0. Needs agreement with the API owner.|
|D2|Cell size, 0.25° or 0.5°|Open. Pending the comparison on synthetic data and, later, real data. The UI reads cell size from the data.|
|D3|Polygon selection in the MVP|**[Proposed]**Should Have. Rectangle is Must.|
|D4|How the provisional (NRT) flag reaches the application|Gap. The`cell_month.csv`description has no such flag. The pipeline and API owners must agree on it.|
|D5|Low-count threshold, and the minimum years needed for a median|Gap. Not in the sources. Set after seeing real data.|
|D6|Whether the raw-detections download contains all or only filtered detections|Gap.`unified.csv`holds every detection, while the calendar uses filtered ones.|
|D7|Where the data and the app are hosted|Open, listed as an open question in the design.|
|D8|FRP priority|**[Proposed]**Could Have, because FRP has no sensor-to-sensor calibration.|
|D9|Partial-month handling|**[Proposed]**label as partial and mark its anomaly non-comparable.|
|D10|Calibrate globally, per region or per land cover|Open. The design reuses one fit per satellite pair. Per-AOI recalibration is excluded.|

## **Appendix B: Consistency Check**

|**Check**|**Result**|
|---|---|
|Every goal G1 to G9 has a Must Have feature and at least one user story|Yes: G1 to US-01 to US-04; G2 to US-05; G3 and G4 to US-06, US-11; G5 to US-06; G6 and G7 to US-09; G8 to US-17; G9 to US-08, US-11 to US-16|
|Every Must Have feature in 12.1 has a user story|Yes: US-01 to US-17|
|Must Have list matches the Task Delegation document|Yes: area selection by map or lat/lon, date range, calendar, anomaly, CSV. The data-quality behaviors listed there are Must Have.|
|All three downloads are retained|Yes: CSV Must, chart Should, raw Could|
|Validation criteria V1 to V13 cover every Must Have behavior|Yes. Real-data validation is listed separately as pending.|
|No claim of real-data processing or validated calibration|Correct. All results are labeled synthetic or pending.|
|No invented API endpoints, schemas or numbers|Correct. Unspecified items are labeled [Proposed] or listed as gaps.|
