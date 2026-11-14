/**
 * EmberTrace – one code path for running a calendar query.
 * Used by the query button, the region presets and the first-visit auto-load.
 */

import { useCallback } from 'react';
import { useAppState, AoiBbox } from './store';
import { fetchCalendar, ApiError } from '../api/client';

export function useCalendarQuery() {
  const { state, dispatch } = useAppState();
  const { startMonth, endMonth } = state;

  return useCallback(
    async (aoi: AoiBbox) => {
      dispatch({ type: 'FETCH_START' });
      try {
        const data = await fetchCalendar({
          aoi: { type: 'bbox', ...aoi },
          start_month: startMonth ?? undefined,
          end_month: endMonth ?? undefined,
        });
        dispatch({ type: 'FETCH_SUCCESS', data });
      } catch (err: unknown) {
        if (err instanceof ApiError) {
          dispatch({ type: 'FETCH_ERROR', code: err.code, message: err.message });
        } else {
          dispatch({ type: 'FETCH_ERROR', code: 'UNKNOWN', message: 'An unexpected error occurred.' });
        }
      }
    },
    [dispatch, startMonth, endMonth],
  );
}
