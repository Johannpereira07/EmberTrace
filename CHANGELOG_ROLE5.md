# EmberTrace - Role 5 (Charts Engineer) Contributions & Changelog

**Challenge:** NASA Space Apps Challenge 2026 — Challenge 15 (Harmonization of MODIS & VIIRS Hot Spots)  
**Author:** Person 5 (Charts Engineer)  
**Date:** Sat 14 Nov 2026  
**Status:** CHT-1 and CHT-9 completed ahead of schedule  

---

## 1. Summary of Deliverables

In accordance with the **NASA Space Apps 2026** guidelines and **Team Implementation Plan**, Person 5 owns the frontend visualization engine, color science, interactive heatmaps, inline exports, and historical anomaly insights.

### Components & Modules Created (Owned Paths)

| File Path | Description | Deliverable |
|---|---|---|
| `contracts/api/types.ts` | Canonical API types and H3 contract matching `docs/04-api-spec.md`. | H3 Contract |
| `web/src/styles/scales.ts` | Pure mathematical color scales: sequential Viridis with $\sqrt{\text{count}}$ scaling; ColorBrewer-based diverging Blue-Orange centered on $1.0\times$; safe $\log_2$ clamp (min 0.05) to prevent $-\infty$; zero-hollow styling. | CHT-1 / Foundations |
| `web/src/styles/scales.test.ts` | Automated unit tests verifying Viridis interpolation, hollow cell assignment for count=0, safe $\log_2(0)$ execution, and diverging anomaly thresholds. | Quality Gate |
| `web/src/features/charts/types.ts` | Complete TypeScript interface definitions establishing the **H4 Props Contract** with Person 4 and **H3 API schema** with Person 3. | H4 Contract |
| `web/src/features/charts/FireCalendar.tsx` | Drop-in unified `<FireCalendar response mode="activity" \| "anomaly" showProvenance />` component requested by Person 4 (H4). | H4 Deliverable |
| `web/src/features/charts/cellModel.ts` | Matrix transformer building 27 year rows (2000–2026) $\times$ 12 columns = 313 observation months (Nov 2000 to Nov 2026). Computes cell states, out-of-range bounds, provisional flags, and accessible screen-reader labels. | CHT-1 / Matrix |
| `web/src/features/charts/cellModel.test.ts` | Unit tests verifying active month counts (313), out-of-range months (Jan–Oct 2000), sensor transitions (Jul 2002, Jan 2012), and edge cases. | Quality Gate |
| `web/src/features/charts/ChartLegend.tsx` | Accessible, responsive visual legend showing Viridis ramp, hollow zero cell swatch, Blue-Orange anomaly swatches, sensor epoch indicators, and interactive Terra chained modal trigger. | CHT-1 / Accessibility |
| `web/src/features/charts/CalendarHeatmap.tsx` | 27-row fire activity count heatmap with square-root scaling, sensor handover dividers at Jul 2002 and Jan 2012, historical median summary row, inline SVG styles, and 2x PNG export capabilities. | CHT-1 / Primary Viz |
| `web/src/features/charts/AnomalyHeatmap.tsx` | Diverging ratio heatmap (suppressed vs. elevated vs. median) centered at $1.0\times$, supporting cell clicks, hovering, and inline SVG export. | CHT-1 / Anomaly Viz |
| `web/src/features/charts/index.ts` | Barrel export for Person 4 importing charts and `exportChart`. | H4 Contract |
| `web/src/features/insights/TopAnomalies.tsx` | Ranks the top 5 most extreme wildfire anomaly months across the entire 26-year series. Also aliased as `<TopMonths />` per H4 specification. | CHT-9 / Insights |
| `web/src/dev/makeResponse.ts` | Synthetic test data builders providing full 313-month mock fixtures conforming to `docs/04-api-spec.md` (Normal, Sparse, Edge Cases). | Test Fixtures |
| `web/src/dev/ChartPlayground.tsx` | Standalone interactive development environment for inspecting all heatmaps, switching mock datasets, testing handover lines, triggering SVG/PNG downloads, and inspecting cell data. | CHT-1 Milestone |
| `AGENTS.md` | Agent boundary rules and strict conventions for Antigravity and VS Code Copilot to safeguard role boundaries and visualization constraints. | Project Governance |

---

## 2. NASA Space Apps Challenge 2026 Official Resources Integration

All guidelines, technical literature, and satellite transition advisories from the official [NASA Space Apps Challenge 15 Resources Tab](https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/?tab=resources) have been explicitly reviewed and incorporated:

1. **NASA FIRMS Active Fire Products & Documentation:**
   - Incorporates MODIS C6.1 (Terra & Aqua) ~1 km thermal anomaly detection specifications and VIIRS (S-NPP, NOAA-20, NOAA-21) 375 m I-band active fire attributes.
   - Preserves distinction between archive science quality data and provisional Near-Real-Time (NRT) detections.
2. **Transition Advisories & Decommissioning:**
   - Accounted for the Suomi-NPP VIIRS transition advisory (ending FIRMS production on 2 Nov 2026, handing over continuous VIIRS tracking to NOAA-20 and NOAA-21).
   - Accounted for Terra and Aqua orbit maintenance cessation (2021/2022) and orbit drift, strictly confining the primary Aqua-to-VIIRS calibration window to 2012–2019.
3. **Core Challenge Objectives:**
   - Delivered the central deliverable: the **Harmonized Burning Activity Calendar** spanning 27 year rows (Nov 2000 to Nov 2026 = 313 months).
   - Implemented historical monthly median baselines and diverging anomaly scales centered at $1.0\times$.
   - Implemented downloadable visualizations (SVG and 2x PNG) with the mandatory synthetic demonstration watermark.

