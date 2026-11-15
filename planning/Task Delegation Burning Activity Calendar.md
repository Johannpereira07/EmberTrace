# Task Delegation: Burning Activity Calendar

NASA Space Apps 2026, Challenge 15: Harmonization of MODIS and VIIRS Hot Spots. Prepared 12 Nov 2026 from our Architecture and Methodology draft (9 Nov).

## 1. Goal and timeline

We are building a web app that shows a year-by-month fire calendar for any area a user selects (Nov 2000 to today), where nobody can tell which satellite produced which year. **Our success test: no visible jump in the calendar where one sensor hands over to another** (Jul 2002 and Jan 2012).

This plan covers preparation only: the 2 days before the hackathon starts on 14 Nov. We have `harmonize.py`, tested on synthetic data plus two one-day sample files. **We are not counting on the real FIRMS archive**, because it may only become available after the hackathon starts. Every task below works with synthetic data and the two samples, and every deliverable is due by end of 13 Nov so the team starts building with a verified pipeline, a PRD, an API spec and a UI draft. Deployment, slides and the demo come later, during the hackathon.

| When | Milestone |
| --- | --- |
| 12 Nov (today) | All roles start; Roles 3 and 4 begin drafting the PRD and API spec |
| 13 Nov, noon | API spec draft and example responses (Role 4) shared with Role 5 |
| 13 Nov, end of day | All deliverables due: pipeline verification report (Role 1), verified constants and synthetic-data calibration report (Role 2), PRD (Role 3), API spec (Role 4), UI prototype (Role 5) |
| 14 Nov | Hackathon starts; team reviews the deliverables and implementation begins |

## 2. Role assignments

### Role 1: Pipeline Verifier

**Mission:** prove the end-to-end pipeline works and document it. Treat the conversion functions (`fit_conversion`, `apply_conversion`, the confidence converters) as **assumed accurate**. Do not edit them; that is Role 2's job.

- Run all 7 stages (load, filter, grid, normalize, calibrate, harmonize, calendar) one at a time on synthetic data and both sample files. Write one test per stage.
- Confirm the five output files exist with the columns in the design doc: `unified.csv`, `cell_month.csv`, `calibration.json`, `calendar.csv`, `calendar_anomaly.csv`.
- Check the edge cases the design names: empty cells are filled with 0, not dropped; a satellite not yet flying gives NaN, not 0; partial months get fractional satellite weights; the one-day sample is refused by the fit guard.
- Confirm the loader accepts both file formats described in the design doc (NRT text and archive-style: `acq_time` as integer, VIIRS confidence `l/n/h`, `type` and `instrument` columns), using small hand-made test files.
- **Deliver by end of 13 Nov:** `pipeline_verification.md` (approach, stage-by-stage results, pass/fail list, known issues) and the test suite.
- **Hand-offs:** any suspected conversion bug goes to Role 2 as a written issue (input, expected, actual). The final `cell_month.csv` schema goes to Role 4 by noon on 13 Nov.

### Role 2: Conversion Scientist

**Mission:** make the conversions correct, with evidence.

- Verify the confidence thresholds (30 and 80) against the FIRMS user guides, since the design doc says they are from memory. Verify the satellite start and end dates, including NOAA-21 (1 Mar 2023 vs 17 Jan 2024) and S-NPP ending 2 Nov 2026. Mark anything you cannot confirm as "unverified".
- On synthetic data with known answers: check that `fit_conversion` recovers the relationship we planted, that the bias factor removes the step at the handover, and that the hold-out error in `calibration.json` is reasonable.
- Run the splice checks from section 7 of the design doc at Jul 2002 and Jan 2012 on the synthetic calendar. There must be no step.
- Compare cell-level fitting against region-month fitting on synthetic data, and recommend 0.25 or 0.5 degree cells.
- Write down which validation checks need real archive data (overlap plot, drift check for 2020 onward, known bad fire seasons) so they can be run quickly if data arrives. Do not report them as done.
- **Deliver by end of 13 Nov:** a verified-constants list and `calibration_report.md` with honest numbers, stating clearly that results come from synthetic data.
- **Hand-offs:** change only function internals, never signatures, so Role 1's tests stay valid. Send the recommended cell size and fit settings to Role 1 and Role 4.

### Role 3: Product Lead (PRD)

**Mission:** one page that tells builders exactly what to ship.

- Define users (emergency responders, scientists, land managers) and their top 3 questions, for example "is this month normal for my area?"
- List features as Must, Should or Could. Must: area selection by map or lat/lon, date range, calendar heatmap, anomaly heatmap, CSV download. Decide whether FRP is Should or Could.
- Write requirements for the behaviors the design doc flags: partial current month labeled, provisional flag on the latest 2 to 5 months, low-count warning, shading for converted years and the chained 2000 to 2002 segment, snap-to-cell notice.
- Specify accessibility: colorblind-safe sequential ramp, diverging ramp centered on 1.0, values always shown on hover or in the cell.
- **Deliver by end of 13 Nov:** the PRD, one page.
- **Dependency:** review the API spec with Role 4 so every Must feature has a data source. Share the Must list with Role 5 by noon on 13 Nov.

### Role 4: API and Backend Lead

**Mission:** define the contract between frontend and backend.

- Write the API spec: `POST /calendar` (input: area of interest, start month, end month; output: calendar table, anomaly table, source flag per month, provisional flag, warnings) and three download endpoints (monthly CSV, chart image, raw detections). Include request and response JSON examples and error cases (empty area, area outside data coverage, invalid dates).
- Create 3 example response files from synthetic output: a normal area, a sparse area with a low-count warning, and an error case. Role 5 uses these as mock data.
- **Draft and example files to Role 5 by noon on 13 Nov. Final spec by end of 13 Nov.**
- **Dependency:** needs the `cell_month.csv` schema from Role 1. Test with synthetic output and the two sample files.

### Role 5: UI Prototype

**Mission:** show what the screen will look like before we build it.

- Build a simple UI prototype using Role 4's example responses as mock data: map area selection and lat/lon entry, date picker, calendar and anomaly heatmaps, hover values, download buttons.
- Follow the Must list from Role 3; do not add features beyond it.
- **Deliver by end of 13 Nov:** a prototype the team can open and click through. A rough one is fine.

## 3. Working rules

- **Check-ins:** a 10-minute stand-up every 6 hours. Post blockers in the team channel as soon as they appear.
- **Interfaces are frozen:** function signatures, file schemas and API fields change only after the owner tells everyone affected.
- **No assumed data:** if a file or fact is unverified, label it "unverified" in the docs and tell the owner.
- **Report honestly:** weak fits and unresolved issues go into the final presentation as limitations, not hidden.

We have a clear design, a clear success test and clear owners. Each of you holds one piece that the others depend on. Let's ship it.
