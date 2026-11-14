/**
 * EmberTrace – Harmonization explainer panel (APP-8)
 * Person 4: App & Map Lead
 */

import React, { useState } from 'react';

const PLACEHOLDER_TEXT = `EmberTrace harmonizes fire detection data from three satellite sensors:
Terra MODIS (Nov 2000 – present), Aqua MODIS (Jul 2002 – present), and VIIRS (Jan 2012 – present).

Counts from earlier sensors are calibrated to VIIRS-equivalent values using a linear regression
fit over the 2012–2019 overlap period — so the values before and after each sensor transition
are directly comparable.

Months before Jul 2002 are "chained" via Aqua calibration and carry slightly higher uncertainty.

Provisional (near real-time) months are based on preliminary data and may change.`;

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
