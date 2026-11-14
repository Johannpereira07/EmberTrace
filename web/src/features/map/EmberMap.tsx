/**
 * EmberTrace – Map component (APP-3 + APP-4)
 * Person 4: App & Map Lead
 *
 * Uses react-leaflet + leaflet-draw (loaded via script tag in index.html to avoid type conflicts).
 * Shows:
 *   - A drawn bounding box (user's selection, blue)
 *   - The snapped / analyzed bbox from the API response (orange dashed)
 * Two-way sync with the lat/lon form via the store.
 */

import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Rectangle, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression, Map as LeafletMap } from 'leaflet';
import { useAppState, AoiBbox } from '../../app/store';

// ---- Initialise leaflet-draw controls after map is ready ----

function DrawControls({ onBboxChange }: { onBboxChange: (bbox: AoiBbox) => void }) {
  const map = useMap() as LeafletMap;
  const initialised = useRef(false);

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    // leaflet-draw attaches itself to the global L object when imported.
    import('leaflet-draw').then(() => {
      import('leaflet').then((L) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const LDraw = L as any;
        if (!LDraw.Control?.Draw) return;

        const drawControl = new LDraw.Control.Draw({
          draw: {
            rectangle: { shapeOptions: { color: '#3b82f6', weight: 2 } },
            polyline: false,
            polygon: false,
            circle: false,
            circlemarker: false,
            marker: false,
          },
          edit: false,
        });
        map.addControl(drawControl);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.on(LDraw.Draw.Event.CREATED, (e: any) => {
          const bounds = e.layer.getBounds();
          onBboxChange({
            min_lat: parseFloat(bounds.getSouth().toFixed(4)),
            max_lat: parseFloat(bounds.getNorth().toFixed(4)),
            min_lon: parseFloat(bounds.getWest().toFixed(4)),
            max_lon: parseFloat(bounds.getEast().toFixed(4)),
          });
        });
      });
    });
  }, [map, onBboxChange]);

  return null;
}

// ---- Main Map component ----

export function EmberMap() {
  const { state, dispatch } = useAppState();

  const handleBboxChange = React.useCallback(
    (bbox: AoiBbox) => dispatch({ type: 'SET_AOI', aoi: bbox }),
    [dispatch],
  );

  const requestedBounds: LatLngBoundsExpression | null = state.aoi
    ? [
        [state.aoi.min_lat, state.aoi.min_lon],
        [state.aoi.max_lat, state.aoi.max_lon],
      ]
    : null;

  const snappedBounds: LatLngBoundsExpression | null =
    state.calendarData?.meta?.aoi_analyzed
      ? [
          [state.calendarData.meta.aoi_analyzed.min_lat, state.calendarData.meta.aoi_analyzed.min_lon],
          [state.calendarData.meta.aoi_analyzed.max_lat, state.calendarData.meta.aoi_analyzed.max_lon],
        ]
      : null;

  return (
    <div style={{ width: '100%', height: '100%', borderRadius: 8, overflow: 'hidden' }}>
      <MapContainer
        center={[20, 78]}
        zoom={5}
        style={{ height: '100%', width: '100%' }}
        attributionControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
        />

        <DrawControls onBboxChange={handleBboxChange} />

        {/* User's drawn selection — blue */}
        {requestedBounds && (
          <Rectangle
            bounds={requestedBounds}
            pathOptions={{ color: '#3b82f6', weight: 2, fillOpacity: 0.1, fillColor: '#3b82f6' }}
          />
        )}

        {/* Snapped / analyzed area — orange dashed */}
        {snappedBounds && (
          <Rectangle
            bounds={snappedBounds}
            pathOptions={{ color: '#f97316', weight: 2, dashArray: '6 4', fillOpacity: 0.05, fillColor: '#f97316' }}
          />
        )}
      </MapContainer>
    </div>
  );
}
