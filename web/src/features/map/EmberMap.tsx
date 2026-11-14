/**
 * EmberTrace – Map component (APP-3 + APP-4)
 * Person 4: App & Map Lead
 *
 * Free Dark Satellite / Terrain Map:
 *  - Uses OpenStreetMap with a custom high-contrast dark filter (Zero API key / zero watermark)
 *  - User requested bounding box (neon cyan/blue)
 *  - Grid-snapped 0.25° analyzed area (neon amber/orange dashed)
 *  - Dynamic coordinate HUD badge
 */

import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Rectangle, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression, Map as LeafletMap } from 'leaflet';
import { useAppState, AoiBbox } from '../../app/store';

function DrawControls({ onBboxChange }: { onBboxChange: (bbox: AoiBbox) => void }) {
  const map = useMap() as LeafletMap;
  const initialised = useRef(false);

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    import('leaflet-draw').then(() => {
      import('leaflet').then((L) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const LDraw = L as any;
        if (!LDraw.Control?.Draw) return;

        const drawControl = new LDraw.Control.Draw({
          draw: {
            rectangle: {
              shapeOptions: {
                color: '#38bdf8',
                weight: 2,
                fillColor: '#0284c7',
                fillOpacity: 0.25,
              },
            },
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
    <div className="relative w-full h-full overflow-hidden rounded-2xl bg-slate-950">
      <MapContainer
        center={[20.5, 78.5]}
        zoom={5}
        style={{ height: '100%', width: '100%' }}
        attributionControl={true}
      >
        {/* OpenStreetMap with High-Contrast Dark Filter — No API Key Required */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
          className="dark-map-tiles"
          maxZoom={19}
        />

        <DrawControls onBboxChange={handleBboxChange} />

        {/* User Drawn Selection (Neon Cyan) */}
        {requestedBounds && (
          <Rectangle
            bounds={requestedBounds}
            pathOptions={{
              color: '#38bdf8',
              weight: 2.5,
              fillOpacity: 0.2,
              fillColor: '#38bdf8',
            }}
          />
        )}

        {/* Snapped Grid Cells (Neon Amber/Orange) */}
        {snappedBounds && (
          <Rectangle
            bounds={snappedBounds}
            pathOptions={{
              color: '#f97316',
              weight: 2,
              dashArray: '5 5',
              fillOpacity: 0.1,
              fillColor: '#f97316',
            }}
          />
        )}
      </MapContainer>

      {/* Coordinate HUD Badge */}
      <div className="absolute top-3 right-3 z-[1000] pointer-events-none flex items-center gap-2">
        <div className="bg-slate-950/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[11px] font-mono shadow-2xl flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>AOI</span>
          </span>
          {state.aoi ? (
            <span className="text-slate-300">
              {state.aoi.min_lat.toFixed(2)}°N – {state.aoi.max_lat.toFixed(2)}°N · {state.aoi.min_lon.toFixed(2)}°E – {state.aoi.max_lon.toFixed(2)}°E
            </span>
          ) : (
            <span className="text-slate-500 italic">No area selected (Use draw tool)</span>
          )}
        </div>
      </div>
    </div>
  );
}
