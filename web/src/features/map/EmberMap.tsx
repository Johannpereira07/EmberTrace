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

import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Rectangle, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression, Map as LeafletMap } from 'leaflet';
import { useAppState, AoiBbox } from '../../app/store';
import { useCalendarQuery } from '../../app/useCalendarQuery';

/** Lets the "Draw an area" button (outside the Leaflet map) start and cancel the rectangle tool. */
interface DrawApi {
  start: () => void;
  cancel: () => void;
}

const RECTANGLE_OPTIONS = {
  // leaflet-draw 1.0.4's area tooltip uses an undeclared `type` variable, which throws
  // in ES modules and breaks dragging. No area tooltip, no crash.
  showArea: false,
  shapeOptions: {
    color: '#38bdf8',
    weight: 2,
    fillColor: '#0284c7',
    fillOpacity: 0.25,
  },
};

function DrawControls({
  onBboxChange,
  api,
  onDrawingChange,
}: {
  onBboxChange: (bbox: AoiBbox) => void;
  api: React.MutableRefObject<DrawApi | null>;
  onDrawingChange: (drawing: boolean) => void;
}) {
  const map = useMap() as LeafletMap;
  const initialised = useRef(false);

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    import('leaflet-draw').then(() => {
      import('leaflet').then((L) => {
        // leaflet-draw attaches L.Draw to the global `window.L`. In the production build the
        // imported module is a copy taken before that, so it has no L.Draw: use the global.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const LDraw = ((window as any).L ?? L) as any;
        if (!LDraw.Control?.Draw || !LDraw.Draw?.Rectangle) {
          console.error('leaflet-draw did not load: drawing an area is unavailable');
          return;
        }

        const drawControl = new LDraw.Control.Draw({
          draw: {
            rectangle: RECTANGLE_OPTIONS,
            polyline: false,
            polygon: false,
            circle: false,
            circlemarker: false,
            marker: false,
          },
          edit: false,
        });
        map.addControl(drawControl);

        const rectangle = new LDraw.Draw.Rectangle(map, RECTANGLE_OPTIONS);
        api.current = { start: () => rectangle.enable(), cancel: () => rectangle.disable() };
        map.on(LDraw.Draw.Event.DRAWSTART, () => onDrawingChange(true));
        map.on(LDraw.Draw.Event.DRAWSTOP, () => onDrawingChange(false));

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
  }, [map, onBboxChange, api, onDrawingChange]);

  return null;
}

// Zoom to the selected area, keeping enough surroundings in view to recognise where it is.
function FitToAoi({ aoi }: { aoi: AoiBbox | null }) {
  const map = useMap() as LeafletMap;
  useEffect(() => {
    if (!aoi) return;
    map.flyToBounds(
      [
        [aoi.min_lat, aoi.min_lon],
        [aoi.max_lat, aoi.max_lon],
      ],
      { padding: [40, 40], maxZoom: 7, duration: 0.8 },
    );
  }, [map, aoi]);
  return null;
}

export function EmberMap() {
  const { state, dispatch } = useAppState();
  const runQuery = useCalendarQuery();
  const drawApi = useRef<DrawApi | null>(null);
  const [drawing, setDrawing] = useState(false);

  // A drawn area loads straight away, like the region presets.
  const handleBboxChange = React.useCallback(
    (bbox: AoiBbox) => {
      dispatch({ type: 'SET_AOI', aoi: bbox });
      runQuery(bbox);
    },
    [dispatch, runQuery],
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

        <DrawControls onBboxChange={handleBboxChange} api={drawApi} onDrawingChange={setDrawing} />
        <FitToAoi aoi={state.aoi} />

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

      {/* Draw button: the toolbar's small square is easy to miss */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] flex flex-col items-center gap-2">
        {drawing && (
          <div role="status" className="whitespace-nowrap px-3 py-1.5 rounded-lg bg-slate-950/90 border border-slate-700 text-xs text-slate-200 shadow-xl">
            Click and drag on the map. Esc cancels.
          </div>
        )}
        <button
          type="button"
          onClick={() => (drawing ? drawApi.current?.cancel() : drawApi.current?.start())}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold shadow-xl transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
            drawing
              ? 'bg-slate-800 text-slate-100 border border-slate-600 hover:bg-slate-700'
              : 'bg-sky-500 text-slate-950 hover:bg-sky-400'
          }`}
        >
          {!drawing && (
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="2" y="3" width="12" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeDasharray="3 2" />
            </svg>
          )}
          {drawing ? 'Cancel drawing' : state.aoi ? 'Draw a new area' : 'Draw an area'}
        </button>
      </div>

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
            <span className="text-slate-500 italic">No area selected</span>
          )}
        </div>
      </div>
    </div>
  );
}
