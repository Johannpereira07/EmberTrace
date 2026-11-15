/**
 * EmberTrace – "What's this?" explanation toggles.
 * Each section gets a small toggle; the header switch opens or closes all of them at once.
 */

import React, { createContext, useContext, useEffect, useId, useState } from 'react';
import { GUIDE, GuideTopic } from './content';

const STORAGE_KEY = 'embertrace.explanations';

interface ExplainState {
  showAll: boolean;
  setShowAll: (v: boolean) => void;
}

const ExplainContext = createContext<ExplainState>({ showAll: false, setShowAll: () => {} });

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

export function ExplainProvider({ children }: { children: React.ReactNode }) {
  const [showAll, setShowAllState] = useState(readStored);
  const setShowAll = (v: boolean) => {
    setShowAllState(v);
    try {
      window.localStorage.setItem(STORAGE_KEY, v ? 'on' : 'off');
    } catch {
      /* private mode: the switch still works for this visit */
    }
  };
  return <ExplainContext.Provider value={{ showAll, setShowAll }}>{children}</ExplainContext.Provider>;
}

/** Header switch: show or hide every explanation on the page. */
export function ExplainAllSwitch() {
  const { showAll, setShowAll } = useContext(ExplainContext);
  return (
    <button
      type="button"
      onClick={() => setShowAll(!showAll)}
      aria-pressed={showAll}
      className={`whitespace-nowrap text-xs px-3 py-1.5 rounded-xl border transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
        showAll
          ? 'bg-sky-500/15 border-sky-500/40 text-sky-200'
          : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:text-white'
      }`}
    >
      Explanations: {showAll ? 'on' : 'off'}
    </button>
  );
}

/** A "What's this?" toggle with the section's explanation underneath. */
export function Explain({ topic, className = '' }: { topic: GuideTopic; className?: string }) {
  const { showAll } = useContext(ExplainContext);
  const [open, setOpen] = useState(showAll);
  const bodyId = useId();
  const entry = GUIDE[topic];

  // The header switch overrides each toggle; a toggle can still be flipped on its own afterwards.
  useEffect(() => setOpen(showAll), [showAll]);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="inline-flex items-center gap-1.5 text-[11px] text-sky-300/90 hover:text-sky-200 font-medium cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
      >
        <span
          aria-hidden="true"
          className="w-4 h-4 rounded-full border border-current inline-flex items-center justify-center text-[10px] leading-none"
        >
          ?
        </span>
        <span>{open ? 'Hide explanation' : "What's this?"}</span>
        <span className="sr-only">: {entry.title}</span>
      </button>
      {open && (
        <div
          id={bodyId}
          className="mt-2 p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-[12px] text-slate-300 leading-relaxed flex flex-col gap-1.5"
        >
          {entry.detail.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
    </div>
  );
}
