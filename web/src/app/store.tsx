/**
 * EmberTrace – Global app state (APP-1)
 * Person 4: App & Map Lead
 *
 * Lightweight React context — holds AOI, date range, API data, and UI state.
 * Avoids heavyweight state libraries; easy to swap if the team decides to.
 */

import React, { createContext, useContext, useReducer } from 'react';
import type { MetaResponse, CalendarResponse } from '../../../contracts/api/types';

// ---- Types ----

export interface AoiBbox {
  min_lat: number;
  max_lat: number;
  min_lon: number;
  max_lon: number;
}

export type AppStatus =
  | 'idle'         // no area selected
  | 'loading'      // API call in flight
  | 'success'      // data loaded
  | 'error';       // API returned an error

export interface AppState {
  aoi: AoiBbox | null;
  startMonth: string | null;  // "YYYY-MM" | null means use coverage default
  endMonth: string | null;
  meta: MetaResponse | null;
  calendarData: CalendarResponse | null;
  status: AppStatus;
  errorCode: string | null;
  errorMessage: string | null;
  /** Which notice panel is open (driven by chart onNoticeRequest) */
  openNotice: 'terra_chain' | 'provisional' | 'low_count' | 'synthetic_watermark' | null;
  /** Activity or anomaly calendar mode */
  chartMode: 'activity' | 'anomaly';
}

const INITIAL: AppState = {
  aoi: null,
  startMonth: null,
  endMonth: null,
  meta: null,
  calendarData: null,
  status: 'idle',
  errorCode: null,
  errorMessage: null,
  openNotice: null,
  chartMode: 'activity',
};

// ---- Actions ----

type Action =
  | { type: 'SET_AOI'; aoi: AoiBbox | null }
  | { type: 'SET_DATE_RANGE'; startMonth: string | null; endMonth: string | null }
  | { type: 'SET_META'; meta: MetaResponse }
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; data: CalendarResponse }
  | { type: 'FETCH_ERROR'; code: string; message: string }
  | { type: 'SET_NOTICE'; notice: AppState['openNotice'] }
  | { type: 'SET_CHART_MODE'; mode: 'activity' | 'anomaly' }
  | { type: 'RESET_DATE_RANGE' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_AOI':
      return { ...state, aoi: action.aoi, status: action.aoi ? state.status : 'idle', calendarData: action.aoi ? state.calendarData : null };
    case 'SET_DATE_RANGE':
      return { ...state, startMonth: action.startMonth, endMonth: action.endMonth };
    case 'RESET_DATE_RANGE':
      return { ...state, startMonth: null, endMonth: null };
    case 'SET_META':
      return { ...state, meta: action.meta };
    case 'FETCH_START':
      return { ...state, status: 'loading', errorCode: null, errorMessage: null };
    case 'FETCH_SUCCESS':
      return { ...state, status: 'success', calendarData: action.data };
    case 'FETCH_ERROR':
      return { ...state, status: 'error', errorCode: action.code, errorMessage: action.message, calendarData: null };
    case 'SET_NOTICE':
      return { ...state, openNotice: action.notice };
    case 'SET_CHART_MODE':
      return { ...state, chartMode: action.mode };
    default:
      return state;
  }
}

// ---- Context ----

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useAppState(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used inside AppProvider');
  return ctx;
}
