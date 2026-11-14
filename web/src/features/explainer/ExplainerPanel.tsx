/**
 * EmberTrace – Harmonization explainer panel (APP-8)
 * Person 4: App & Map Lead
 *
 * Text will be provided by Person 2 in docs/explainer.md.
 * This component renders a collapsible panel with placeholder text until then.
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
    <div style={{ borderTop: '1px solid #1e293b', paddingTop: 12 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="explainer-body"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#64748b',
          fontSize: 12,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: 0,
          width: '100%',
          textAlign: 'left',
        }}
      >
        <span style={{ transform: open ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 0.15s' }}>▶</span>
        How are sensors harmonized?
      </button>
      {open && (
        <div
          id="explainer-body"
          style={{
            marginTop: 10,
            color: '#94a3b8',
            fontSize: 12,
            lineHeight: 1.65,
            whiteSpace: 'pre-wrap',
          }}
        >
          {PLACEHOLDER_TEXT}
        </div>
      )}
    </div>
  );
}
