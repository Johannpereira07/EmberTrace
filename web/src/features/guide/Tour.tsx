/**
 * EmberTrace – optional guided tour of the explorer.
 * Steps point at elements marked `data-tour="<topic>"`; a step whose element is not on screen is skipped.
 * It starts by itself on the first visit in a browser session: not again on refresh, but again after the
 * tab or browser is closed (sessionStorage). The header "Guide" button restarts it.
 * The highlighted element stays usable, so a visitor can try it (e.g. draw an area) during the tour;
 * the dimmed rest of the page is blocked but does not close the tour.
 */

import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GUIDE, TOUR_ORDER, GuideTopic } from './content';
import { useAppState } from '../../app/store';

const SEEN_KEY = 'embertrace.tour.seen';
const PAD = 8;

interface TourState {
  start: () => void;
}

const TourContext = createContext<TourState>({ start: () => {} });

function target(topic: GuideTopic): HTMLElement | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${topic}"]`);
  return el && el.getBoundingClientRect().height > 0 ? el : null;
}

function markSeen() {
  try {
    window.sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* storage blocked: the tour may start again on refresh */
  }
}

function wasSeen(): boolean {
  try {
    return window.sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export function TourProvider({ ready, children }: { ready: boolean; children: React.ReactNode }) {
  const [steps, setSteps] = useState<GuideTopic[] | null>(null);
  const [index, setIndex] = useState(0);
  const returnFocus = useRef<HTMLElement | null>(null);

  const start = useCallback(() => {
    const available = TOUR_ORDER.filter((t) => target(t));
    if (available.length === 0) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    markSeen();
    setIndex(0);
    setSteps(available);
  }, []);

  // Start once per browser session, after the first calendar has loaded (or failed), so its steps exist.
  useEffect(() => {
    if (ready && !wasSeen()) start();
  }, [ready, start]);

  const close = useCallback(() => {
    setSteps(null);
    returnFocus.current?.focus?.();
  }, []);

  return (
    <TourContext.Provider value={{ start }}>
      {children}
      {steps && <TourStep steps={steps} index={index} setIndex={setIndex} onClose={close} />}
    </TourContext.Provider>
  );
}

/** Header button that (re)starts the tour. */
export function TourButton() {
  const { start } = useContext(TourContext);
  return (
    <button
      type="button"
      onClick={start}
      className="whitespace-nowrap text-xs px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
    >
      Guide
    </button>
  );
}

function TourStep({
  steps,
  index,
  setIndex,
  onClose,
}: {
  steps: GuideTopic[];
  index: number;
  setIndex: (i: number) => void;
  onClose: () => void;
}) {
  const topic = steps[index];
  const entry = GUIDE[topic];
  const last = index === steps.length - 1;
  const [rect, setRect] = useState<DOMRect | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const { state } = useAppState();
  const calendarAtStart = useRef(state.calendarData);

  // Learn by doing: when a new area is loaded during the map step (drawn, or a region picked),
  // move on to the next step once its calendar is on screen.
  useEffect(() => {
    if (index === 0) calendarAtStart.current = state.calendarData;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);
  useEffect(() => {
    if (topic !== 'map' || last) return;
    if (state.status === 'success' && state.calendarData !== calendarAtStart.current) setIndex(index + 1);
  }, [topic, last, index, setIndex, state.status, state.calendarData]);

  // Bring the step's element into view and follow it while the page scrolls or resizes.
  useLayoutEffect(() => {
    const el = target(topic);
    if (!el) {
      setRect(null);
      return;
    }
    // A tall element starts at the top of the screen, so its beginning (headings, legend) is in view.
    const tall = el.getBoundingClientRect().height > window.innerHeight * 0.6;
    el.scrollIntoView({ block: tall ? 'start' : 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
    const update = () => setRect(el.getBoundingClientRect());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true); // capture: the explorer scrolls inner panels
    const resize = new ResizeObserver(update); // e.g. an explanation opens inside the element
    resize.observe(el);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      resize.disconnect();
    };
  }, [topic]);

  useEffect(() => {
    card.current?.focus();
  }, [index]);

  // Keys work while focus is in the card. Not a focus trap: the highlighted element is usable too.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowRight' && !last) setIndex(index + 1);
    else if (e.key === 'ArrowLeft' && index > 0) setIndex(index - 1);
  }

  // Card below the element if there is room, else above, else in the bottom-right corner (tall
  // elements such as the calendar). On phones it always sits at the bottom.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardW = 340;
  const cardH = 220;
  let style: React.CSSProperties = { left: 16, right: 16, bottom: 16 };
  if (rect && vw >= 640) {
    const left = Math.min(Math.max(16, rect.left), vw - cardW - 16);
    if (rect.bottom + PAD + cardH < vh) style = { left, top: rect.bottom + PAD + 8, width: cardW };
    else if (rect.top - PAD - cardH > 0) style = { left, bottom: vh - rect.top + PAD + 8, width: cardW };
    else style = { right: 24, bottom: 24, width: cardW };
  }

  return (
    <div className="fixed inset-0 z-[2000] pointer-events-none" onKeyDown={onKeyDown}>
      {/* Four blockers around the highlighted element: the dimmed page can't be clicked, the element can. */}
      {(rect
        ? [
            { left: 0, top: 0, width: vw, height: Math.max(0, rect.top - PAD) },
            { left: 0, top: rect.bottom + PAD, width: vw, height: Math.max(0, vh - rect.bottom - PAD) },
            { left: 0, top: rect.top - PAD, width: Math.max(0, rect.left - PAD), height: rect.height + PAD * 2 },
            { left: rect.right + PAD, top: rect.top - PAD, width: Math.max(0, vw - rect.right - PAD), height: rect.height + PAD * 2 },
          ]
        : [{ left: 0, top: 0, width: vw, height: vh }]
      ).map((box, i) => (
        <div key={i} aria-hidden="true" className="absolute pointer-events-auto" style={box} />
      ))}
      {rect && (
        <div
          aria-hidden="true"
          className="absolute rounded-2xl ring-2 ring-sky-400 pointer-events-none"
          style={{
            left: rect.left - PAD,
            top: rect.top - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.72)',
            transition: reducedMotion() ? undefined : 'all 200ms ease',
          }}
        />
      )}
      <div
        ref={card}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        className="absolute pointer-events-auto p-4 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl text-slate-200 focus:outline-none"
        style={style}
      >
        <p className="text-[11px] font-mono text-sky-300">
          Step {index + 1} of {steps.length}
        </p>
        <h2 id="tour-title" className="mt-1 text-sm font-bold text-white">
          {entry.title}
        </h2>
        <p id="tour-body" className="mt-1.5 text-[13px] leading-relaxed text-slate-300">
          {entry.tour}
        </p>
        {last && (
          <p className="mt-2 text-[12px] text-slate-400">
            Every section has a "What's this?" link, and "Explanations" at the top opens them all.
          </p>
        )}
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            {last ? 'Close' : 'Skip tour'}
          </button>
          <div className="flex gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex(index - 1)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-200 border border-slate-700 hover:bg-slate-800 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => (last ? onClose() : setIndex(index + 1))}
              className="px-3 py-1.5 rounded-lg bg-sky-500 text-slate-950 font-semibold text-xs hover:bg-sky-400 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
            >
              {last ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
