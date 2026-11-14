# EmberTrace Agent Guidelines (NASA Space Apps Challenge 2026)

## Project Overview
- **Challenge:** Challenge 15: Harmonization of MODIS and VIIRS Hot Spots
- **Product Name:** EmberTrace
- **Success Test:** No visible jump in the calendar at the sensor handovers (Jul 2002 and Jan 2012).
- **Core Principle:** Demonstration data (synthetic + two 1-day samples) must be clearly labeled as such everywhere (UI and exports).

## Role 5: Charts Engineer (Current Agent / Copilot Workspace)
- **Owned paths ONLY:**
  - `web/src/features/charts/`
  - `web/src/features/insights/`
  - `web/src/styles/scales.ts`
  - `web/src/dev/ChartPlayground.tsx`
- Do NOT edit pipeline code (`harmonize.py`) or backend API routes owned by other teammates without contract sync.

## Strict Rules & Conventions
1. **Zero vs NaN / Unavailable:**
   - 0 detections = real observation of zero fires. Displayed as hollow cell with outline (`#ffffff` fill, `#94a3b8` stroke), NOT lowest ramp color.
   - NaN / Unavailable = missing data / no satellite observing. Displayed as muted gray (`#e2e8f0`). Never mix NaN and 0!
2. **Color Scales:**
   - Counts: Viridis sequential palette with square-root scaling `Math.sqrt(count / maxCount)`.
   - Anomalies: Diverging Blue (< 1.0x, suppressed) to Neutral White (1.0x, normal) to Orange/Red (> 1.0x, elevated). Centered on 1.0.
   - Math safety: Always guard anomaly ratio when 0: clamp to minimum 0.05 before `Math.log2` to prevent `-Infinity`.
3. **Calendar Dimensions:**
   - Chronological top-to-bottom: Oldest year at top (2000 at top, 2026 at bottom).
   - Range: Nov 2000 to Nov 2026 = 27 rows x 12 columns = exactly 313 active months.
   - Out-of-range cells (e.g. Jan-Oct 2000) are grayed out (`#f8fafc`).
4. **Sensor Epochs & Handover Accents:**
   - Nov 2000 – Jun 2002: Terra chained (least certain; purple indicator).
   - Jul 2002 – Dec 2011: Aqua calibrated (blue indicator). Handover 1 at Jul 2002.
   - Jan 2012 – Nov 2026: VIIRS (green indicator). Handover 2 at Jan 2012.
5. **Watermark & Export:**
   - Exported SVGs and PNGs must render text and fills with absolute colors (no CSS variables) and contain the synthetic demonstration disclaimer.

