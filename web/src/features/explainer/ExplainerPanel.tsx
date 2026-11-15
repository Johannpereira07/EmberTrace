/**
 * EmberTrace – Harmonization explainer panel (APP-8)
 * Person 4: App & Map Lead
 */

import React, { useState } from 'react';

const PLACEHOLDER_TEXT = `EmberTrace combines fire detections from three satellite series: Terra MODIS,
Aqua MODIS and VIIRS (S-NPP, NOAA-20 and NOAA-21). MODIS and VIIRS count fires differently,
so their counts cannot be compared directly.

Each older series is converted to VIIRS-equivalent counts with one factor per calendar month:
total VIIRS detections divided by total Aqua detections in that month, over years when both observed
the same places (and Terra to Aqua the same way). The ratio changes with the seasons, so January and
October get their own factors; the monsoon months June to September have few fires and share one.
A month with no fires stays at zero. The factors are fitted once for the whole region, offline; they
are never refitted for your selected area.

The earliest months, before Aqua flew, are converted in two steps (Terra to Aqua to VIIRS) and are
the least certain. Provisional (near real-time) months use preliminary data and may change.`;

export function ExplainerPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="pt-2 border-t border-slate-850">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="explainer-body"
        className="text-xs text-slate-400 hover:text-slate-200 transition flex items-center gap-2 cursor-pointer w-full text-left font-medium py-1"
      >
        <span className={`transform transition-transform text-[10px] ${open ? 'rotate-90' : ''}`}>
          ▶
        </span>
        <span>How are sensors harmonized?</span>
      </button>
      {open && (
        <div
          id="explainer-body"
          className="mt-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 leading-relaxed font-sans"
        >
          {PLACEHOLDER_TEXT}
        </div>
      )}
    </div>
  );
}
