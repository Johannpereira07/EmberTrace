/**
 * EmberTrace – Data quality / warnings panel (APP-6)
 * Person 4: App & Map Lead
 *
 * Shows:
 *  - Synthetic data banner (always when data_kind === "synthetic")
 *  - Snap notice with cell size
 *  - All warnings with their month ranges
 * Never blocks chart results from rendering.
 */

import React from 'react';
import { useAppState } from '../../app/store';
import type { ApiWarning } from '../../../contracts/api/types';

const WARNING_LABELS: Record<string, string> = {
  SYNTHETIC_DATA: '⚠️ Demonstration data',
  SNAPPED_AOI: '📐 Area snapped to grid',
  CHAINED_SEGMENT: '🔗 Chained segment (lower confidence)',
  PROVISIONAL: '🕐 Provisional (near real-time)',
  PARTIAL_MONTH: '📅 Partial month',
  LOW_COUNT: '🔵 Low detection count',
};

function WarningBadge({ warning }: { warning: ApiWarning }) {
  const label = WARNING_LABELS[warning.code] ?? `ℹ️ ${warning.code}`;
  const hasRanges = warning.ranges.length > 0;

  return (
    <div
      role="status"
      aria-label={warning.message}
      style={{
        background: warning.code === 'SYNTHETIC_DATA' ? '#7c2d12' : '#1e293b',
        border: `1px solid ${warning.code === 'SYNTHETIC_DATA' ? '#ea580c' : '#334155'}`,
        borderRadius: 6,
        padding: '8px 12px',
        fontSize: 12,
        marginBottom: 6,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ color: '#94a3b8' }}>{warning.message}</div>
      {hasRanges && (
        <div style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>
          Affects:{' '}
          {warning.ranges.map((r: { from: string; to: string }, i: number) => (
            <span key={i}>
              {r.from} → {r.to}
              {i < warning.ranges.length - 1 ? ', ' : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function QualityPanel() {
  const { state } = useAppState();
  const data = state.calendarData;

  if (!data) return null;

  const isSynthetic = data.meta.data_kind === 'synthetic';
  const isSnapped = data.meta.snapped;

  return (
    <div
      aria-label="Data quality information"
      style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
    >
      {/* Synthetic data banner — mandatory per AGENTS.md */}
      {isSynthetic && (
        <div
          role="alert"
          style={{
            background: '#7c2d12',
            border: '2px solid #ea580c',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 13,
            fontWeight: 700,
            color: '#fed7aa',
            marginBottom: 8,
            textAlign: 'center',
          }}
        >
          ⚠️ DEMONSTRATION DATA — Synthetic values, not real observations
        </div>
      )}

      {/* Snap notice */}
      {isSnapped && (
        <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6 }}>
          Area snapped outward to {data.meta.cell_size_deg}° grid boundaries.
        </div>
      )}

      {/* All warnings */}
      {data.warnings.map((w: ApiWarning, i: number) =>
        w.code === 'SYNTHETIC_DATA' ? null : <WarningBadge key={i} warning={w} />,
      )}
    </div>
  );
}
