# Charts: agent notes (Person 5)

Rules for `web/src/features/charts/`, `web/src/features/insights/`, `web/src/styles/scales.ts` and
`web/src/dev/ChartPlayground.tsx`. These add to the root `AGENTS.md`; where they disagree, the root file
and `docs/01-prd.md` win.

Owner: Person 5. Do not edit pipeline or API code from here without a contract sync (`contracts/`).

## Zero vs unavailable

- 0 detections = observed, no fires. Drawn as a hollow cell with an outline (`#ffffff` fill, `#94a3b8`
  stroke), not the lowest ramp color.
- `null` / unavailable = no satellite observing. Drawn muted gray (`#e2e8f0`). Never mix the two.

## Color scales

- Counts: Viridis sequential, square-root scaling `Math.sqrt(count / maxCount)`.
- Anomalies: diverging blue (< 1.0x) to neutral white (1.0x) to orange/red (> 1.0x), centered on 1.0.
- Guard ratio 0: clamp to at least 0.05 before `Math.log2` (no `-Infinity`). A zero median is
  `not_defined` (root `AGENTS.md`), shown blank + flag, not as a ratio.

## Calendar layout

- Oldest year at the top. The year and month range comes from the API response / `meta.json`, never
  hard-coded. Months before the first or after the last month are out-of-range cells (`#f8fafc`).

## Sensor epochs

- `TERRA_chained` (Nov 2000 to Jun 2002, least certain): purple indicator.
- `AQUA_calibrated` (Jul 2002 to Dec 2011): blue indicator. Handover 1 at Jul 2002.
- `VIIRS` (Jan 2012 on): green indicator. Handover 2 at Jan 2012.
- Take the epoch from the `source` column, not from dates.

## Exports

- Exported SVG/PNG use absolute colors (no CSS variables).
- If the data is synthetic (`data_kind: synthetic`) or the stand-in sample, the export carries the
  demonstration-data disclaimer. Real data carries its `pipeline_version` label.
