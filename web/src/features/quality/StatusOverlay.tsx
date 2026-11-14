/**
 * EmberTrace – Error, loading & empty states (APP-7)
 * Person 4: App & Map Lead
 */

import React from 'react';
import { useAppState } from '../../app/store';

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_AOI: 'The selected area is invalid. Please draw a valid bounding box on the map.',
  INVALID_DATES: 'The selected date range is invalid. Please check your start and end months.',
  EMPTY_AREA: 'No data cells fall within the selected area. Try a larger region.',
  OUT_OF_COVERAGE: 'The selected area or date range is outside the available data coverage.',
  AOI_TOO_LARGE: 'The selected area is too large. Please draw a smaller bounding box.',
  NOT_AVAILABLE: 'This data is not currently available. Please try again later.',
  NETWORK_ERROR: 'Could not reach the server. Check your connection and try again.',
  UNKNOWN: 'An unexpected error occurred. Please try again.',
};

export function StatusOverlay() {
  const { state } = useAppState();

  if (state.status === 'idle') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 12,
          color: '#475569',
          userSelect: 'none',
        }}
      >
        <div style={{ fontSize: 48 }}>🗺️</div>
        <div style={{ fontSize: 15, fontWeight: 500 }}>Draw a rectangle on the map to explore fire activity</div>
        <div style={{ fontSize: 12, color: '#334155' }}>
          Covers Nov 2000 – Nov 2026 · MODIS Terra / Aqua · VIIRS
        </div>
      </div>
    );
  }

  if (state.status === 'loading') {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Loading fire data"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 16 }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            border: '4px solid #334155',
            borderTopColor: '#dc2626',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <div style={{ color: '#94a3b8', fontSize: 14 }}>Querying fire data…</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (state.status === 'error') {
    const msg = ERROR_MESSAGES[state.errorCode ?? 'UNKNOWN'] ?? ERROR_MESSAGES.UNKNOWN;
    return (
      <div
        role="alert"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 12,
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 36 }}>⚠️</div>
        <div style={{ fontWeight: 700, color: '#fca5a5', fontSize: 15 }}>
          {state.errorCode ?? 'Error'}
        </div>
        <div style={{ color: '#94a3b8', fontSize: 13, maxWidth: 360 }}>{msg}</div>
      </div>
    );
  }

  return null; // 'success' — render charts
}
