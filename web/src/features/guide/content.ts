/**
 * EmberTrace – plain-language explanations for the explorer.
 * One source for both the "What's this?" toggles and the guided tour, so they never disagree.
 * Keep the wording true to the pipeline and API (root AGENTS.md); no dates or thresholds here.
 */

export type GuideTopic =
  | 'map'
  | 'regions'
  | 'bbox'
  | 'timeline'
  | 'mode'
  | 'flags'
  | 'calendar'
  | 'top'
  | 'download';

export interface GuideEntry {
  title: string;
  /** Short text for the tour step. */
  tour: string;
  /** Longer text for the "What's this?" toggle. */
  detail: string[];
}

export const GUIDE: Record<GuideTopic, GuideEntry> = {
  map: {
    title: 'Choose an area on the map',
    tour: 'Press "Draw an area", then click and drag a box. The calendar loads for that box straight away.',
    detail: [
      'The blue box is the area you asked for.',
      'Fire counts are stored on a grid of 0.25° cells, so the area is widened to the whole cells it touches. That analysed area is the orange dashed box.',
    ],
  },
  regions: {
    title: 'Quick regions',
    tour: 'No time to draw? One click loads a ready-made area.',
    detail: ['Ready-made areas to explore without drawing. One click loads their calendar.'],
  },
  bbox: {
    title: 'Coordinates',
    tour: 'The same area as numbers, if you prefer typing coordinates.',
    detail: [
      'South and north edges (latitude) and west and east edges (longitude), in degrees.',
      'Type new values, then press "Query Harmonized Fires".',
    ],
  },
  timeline: {
    title: 'Date range',
    tour: 'Limit the months you see and download. "Full Record" brings back every month.',
    detail: [
      'Changes which months are shown and downloaded.',
      'It does not change what "normal" means: anomalies are always measured against the full record for the area.',
    ],
  },
  mode: {
    title: 'Two ways to read the calendar',
    tour: 'Switch between how many fires were detected and how unusual each month was.',
    detail: [
      'Raw Fire Activity: fire detections per month. Older MODIS months are converted to the VIIRS scale, so the whole record is in one unit and a change means a change in fires, not a change of satellite.',
      'Baseline Anomalies: each month divided by the median of the same calendar month over all years. 1.0× is a typical month, 2× is twice the usual, 0.5× half.',
    ],
  },
  flags: {
    title: 'Data flags',
    tour: 'Notes about this area\'s data: what to be careful with before drawing conclusions.',
    detail: [
      'Grid snapped: the area was widened to whole grid cells.',
      'Chained Terra: the earliest months, before Aqua flew, are converted in two steps and are the least certain.',
      'Provisional: the most recent months use near-real-time data and can still change.',
      'Partial month: the current month is not over, so it cannot be compared with past months yet.',
      'Low detection: few fires in this area, so ratios can jump around.',
    ],
  },
  calendar: {
    title: 'The fire calendar',
    tour: 'One row per year, one column per month. Color shows how much fire was detected.',
    detail: [
      'Read across a row to see a year\'s fire season, down a column to compare the same month across years.',
      'Activity view: dark purple is few fires, yellow is many. A hollow square means satellites were watching and saw no fires. A gray square means no satellite was observing: no data, not zero.',
      'Anomaly view: blue is fewer fires than usual for that month, orange more. A square marked "–" has no ratio (the usual value is zero, or there are too few years to know); "n/c" is the unfinished current month.',
      'The colored marks show which satellite each month comes from (Terra, Aqua or VIIRS).',
    ],
  },
  top: {
    title: 'Most unusual months',
    tour: 'The months with the most fire compared with their usual level. A quick way to find standout seasons.',
    detail: ['Ranked by the anomaly ratio: the month\'s value divided by the median of the same calendar month.'],
  },
  download: {
    title: 'Download',
    tour: 'Take the monthly numbers with you as a CSV.',
    detail: [
      'One row per month for this area and date range, with the value, the anomaly, the source satellite and the flags.',
      'Months with no satellite observing are left empty, never written as 0.',
    ],
  },
};

/**
 * Tour order: five steps, kept short for first-time visitors (and judges). The other sections are
 * covered by their "What's this?" toggles. Steps whose element is not on screen are skipped.
 */
export const TOUR_ORDER: GuideTopic[] = ['map', 'calendar', 'mode', 'flags', 'download'];
