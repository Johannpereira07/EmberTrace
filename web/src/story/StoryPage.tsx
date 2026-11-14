/**
 * EmberTrace – story page (route "/"; the explorer lives at "#/explore").
 * Tells the problem and the fix with the real India record before handing over to the explorer.
 * Every number in the copy is computed from story.json.
 */

import React, { Suspense, lazy, useMemo, useRef, useState, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { YearChart } from './YearChart';
import {
  useStoryData,
  formatCount,
  yearOf,
  SOURCE_COLOR,
  SOURCE_LABEL,
  type StoryData,
  type StoryYear,
  type Source,
} from './storyData';

gsap.registerPlugin(ScrollTrigger, useGSAP);

const Globe = lazy(() => import('./Globe'));

const EXPLORER_HREF = '#/explore';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayRange = ([a, b]: [string, string]) => {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  if (ya === yb && ma === mb) return `${da}–${db} ${MONTHS[mb - 1]} ${yb}`;
  return `${da} ${MONTHS[ma - 1]} ${ya !== yb ? ya + ' ' : ''}– ${db} ${MONTHS[mb - 1]} ${yb}`;
};
const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

function mainSource(y: StoryYear): Source {
  if (y.sources.includes('VIIRS')) return 'VIIRS';
  if (y.sources.includes('AQUA_calibrated')) return 'AQUA_calibrated';
  return 'TERRA_chained';
}

const ALL_SOURCES: Source[] = ['TERRA_chained', 'AQUA_calibrated', 'VIIRS'];
const legendFor = (sources: Source[]) => sources.map((s) => ({ color: SOURCE_COLOR[s], label: SOURCE_LABEL[s] }));

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

function useFacts(data: StoryData) {
  return useMemo(() => {
    const byYear = new Map(data.years.map((y) => [y.year, y]));
    const full = data.years.filter((y) => y.months === 12);
    const firstViirs = full.find((y) => y.sources.length === 1 && y.sources[0] === 'VIIRS');
    const lastAqua = [...full].reverse().find((y) => y.sources.includes('AQUA_calibrated'));
    const jumpTo = lastAqua ? byYear.get(lastAqua.year + 1) : undefined;
    const viirsYears = full.filter((y) => y.sources.length === 1 && y.sources[0] === 'VIIRS');
    const singleSat = viirsYears.find((y) => y.year > (firstViirs?.year ?? 0)) ?? firstViirs; // first year S-NPP flew all 12 months
    const lastFull = viirsYears[viirsYears.length - 1];
    const sats = data.satellites;
    return {
      lastAqua,
      jumpTo,
      singleSat,
      lastFull,
      n20: sats['NOAA-20'] ? yearOf(sats['NOAA-20'].start) : null,
      n21: sats['NOAA-21'] ? yearOf(sats['NOAA-21'].start) : null,
      viirsStart: data.years.find((y) => y.sources.includes('VIIRS'))?.year ?? null,
      recordYears: Math.floor(
        ((yearOf(data.coverage.last_month) - yearOf(data.coverage.first_month)) * 12 +
          Number(data.coverage.last_month.slice(5)) -
          Number(data.coverage.first_month.slice(5)) +
          1) /
          12,
      ),
      check: (() => {
        const fitEnd = yearOf(data.conversion.aqua_to_viirs_window[1]);
        const overlap = full.filter((y) => y.aqua_converted !== null && y.harmonized > 0);
        if (!overlap.length) return null;
        const dev = Math.max(...overlap.map((y) => Math.abs((y.aqua_converted as number) / y.harmonized - 1)));
        const unseen = overlap.filter((y) => y.year > fitEnd);
        return {
          first: overlap[0].year,
          last: overlap[overlap.length - 1].year,
          maxPct: Math.ceil(dev * 100),
          unseen: unseen.length ? [unseen[0].year, unseen[unseen.length - 1].year] : null,
        };
      })(),
      synthetic: data.data_kind === 'synthetic',
    };
  }, [data]);
}

function Story({ data }: { data: StoryData }) {
  const f = useFacts(data);
  const reducedMotion = usePrefersReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef([1, 0, 0, 0, 0]);

  useGSAP(
    () => {
      gsap.utils.toArray<HTMLElement>('[data-stage]').forEach((el) => {
        const i = Number(el.dataset.stage);
        ScrollTrigger.create({
          trigger: el,
          start: 'top 75%',
          end: 'bottom 75%',
          onUpdate: (self) => (stage.current[i] = self.progress),
        });
      });
      if (!reducedMotion) {
        gsap.from('.story-hero-line', { opacity: 0, y: 24, duration: 0.9, stagger: 0.12, ease: 'power2.out' });
      }
    },
    { scope: root, dependencies: [reducedMotion] },
  );

  // The page renders after story.json loads, so an anchor in the URL (#story-jump) needs a nudge.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id && !id.startsWith('/')) document.getElementById(id)?.scrollIntoView();
  }, []);

  const viirsOnly = data.years.filter((y) => f.viirsStart !== null && y.year >= f.viirsStart);
  const terraYears = data.years.filter((y) => y.sources.includes('TERRA_chained'));

  return (
    <div ref={root} className="story">
      <div className="story-globe" aria-hidden="true">
        <Suspense fallback={null}>
          <Globe data={data} stage={stage} reducedMotion={reducedMotion} />
        </Suspense>
      </div>

      <header className="story-nav">
        <a href="#top" className="story-wordmark">EmberTrace</a>
        <a href={EXPLORER_HREF} className="story-button story-button-small">Open the explorer</a>
      </header>

      <main id="top">
        <section className="story-section story-hero" data-stage="0">
          <div className="story-column">
            <h1 className="story-hero-line">
              {f.recordYears} years of fire, counted one way.
            </h1>
            <p className="story-lede story-hero-line">
              NASA satellites have recorded the fires they could see over India since{' '}
              {monthLabel(data.coverage.first_month)}. But the satellites changed along the way, and each one
              counts fires differently. EmberTrace puts the whole record on one scale, so an unusual fire season
              stands out from a new instrument.
            </p>
            <p className="story-hero-line story-scope">
              Built and tested on India. The method works for any region NASA FIRMS covers, once it has been
              checked there.
            </p>
            <div className="story-actions story-hero-line">
              <a href={EXPLORER_HREF} className="story-button">Open the explorer</a>
              <a href="#story-jump" className="story-link">Read how it works</a>
            </div>
            <ul className="story-key story-hero-line" aria-label="What the globe shows">
              <li>
                <span className="story-key-dot story-key-india" aria-hidden="true" />
                Bright: India, the record EmberTrace has harmonized (yearly average, {data.cells_years[0]}–
                {data.cells_years[1]}).
              </li>
              {data.world && (
                <li>
                  <span className="story-key-dot story-key-world" aria-hidden="true" />
                  Faint: heat detections NASA's VIIRS saw worldwide, {dayRange(data.world.dates)}. Not harmonized.
                </li>
              )}
            </ul>
            {f.synthetic && <p className="story-flag story-hero-line">Demonstration data: these numbers are synthetic.</p>}
          </div>
        </section>

        <section id="story-jump" className="story-section" data-stage="1">
          <div className="story-column">
            <h2>In {f.jumpTo?.year} the fires didn't change. The satellite did.</h2>
            {f.lastAqua && f.jumpTo && (
              <p>
                Stitch the raw NASA FIRMS records end to end and India's fire count goes from{' '}
                <strong>{formatCount(f.lastAqua.naive_raw)}</strong> in {f.lastAqua.year} to{' '}
                <strong>{formatCount(f.jumpTo.naive_raw)}</strong> in {f.jumpTo.year}. That year VIIRS took over
                from MODIS. Its 375 m pixels pick up small fires that MODIS's 1 km pixels miss, so it simply counts
                more of them.
              </p>
            )}
          </div>
          <div className="story-wide">
            <YearChart
              title="Raw detections per year, stitched from whichever satellite was in use"
              summary={`Raw yearly detections over India. Around ${formatCount(f.lastAqua?.naive_raw ?? 0)} a year with MODIS, then ${formatCount(f.jumpTo?.naive_raw ?? 0)} in ${f.jumpTo?.year} when VIIRS starts.`}
              years={data.years}
              value={(y) => y.naive_raw}
              color={(y) => SOURCE_COLOR[mainSource(y)]}
              legend={legendFor(ALL_SOURCES)}
              highlight={f.lastAqua && f.jumpTo ? [f.lastAqua.year, f.jumpTo.year] : undefined}
            />
          </div>
        </section>

        <section className="story-section" data-stage="2">
          <div className="story-column">
            <h2>Then more satellites started counting.</h2>
            <p>
              {f.n20 && f.n21 ? (
                <>NOAA-20 joined S-NPP in {f.n20} and NOAA-21 followed in {f.n21}. </>
              ) : null}
              {f.singleSat && f.lastFull && (
                <>
                  Raw VIIRS detections went from <strong>{formatCount(f.singleSat.viirs_raw)}</strong> in{' '}
                  {f.singleSat.year} to <strong>{formatCount(f.lastFull.viirs_raw)}</strong> in {f.lastFull.year}.
                  More eyes on the same fires, not more fires.
                </>
              )}
            </p>
          </div>
          <div className="story-wide">
            <YearChart
              title="Raw VIIRS detections per year, all VIIRS satellites together"
              summary={`Raw VIIRS detections rise from ${formatCount(f.singleSat?.viirs_raw ?? 0)} to ${formatCount(f.lastFull?.viirs_raw ?? 0)} as satellites are added.`}
              years={viirsOnly}
              value={(y) => y.viirs_raw}
              color={() => SOURCE_COLOR.VIIRS}
              legend={legendFor(['VIIRS'])}
              markers={[
                ...(f.n20 ? [{ year: f.n20, label: 'NOAA-20 joins' }] : []),
                ...(f.n21 ? [{ year: f.n21, label: 'NOAA-21 joins' }] : []),
              ]}
            />
          </div>
        </section>

        <section className="story-section" data-stage="3">
          <div className="story-column">
            <h2>One scale for the whole record.</h2>
            <p>
              EmberTrace divides each month's count by the number of satellites watching, then converts the MODIS
              years to what VIIRS would have seen, using the years when both flew together. Each month keeps a
              label saying which satellite it came from.
            </p>
            {f.check && (
              <p>
                Does the conversion hold up? Aqua kept flying after VIIRS arrived, so we can test it. Converted
                the same way, Aqua's yearly count lands within <strong>{f.check.maxPct}%</strong> of VIIRS in every
                full year from {f.check.first} to {f.check.last}
                {f.check.unseen && (
                  <>
                    , including {f.check.unseen[0]} to {f.check.unseen[1]}, which the conversion never saw
                  </>
                )}
                .
              </p>
            )}
          </div>
          <div className="story-wide">
            <YearChart
              title="EmberTrace VIIRS-equivalent detections per year, per satellite"
              summary={`Yearly detections over India on one VIIRS-equivalent scale. In the VIIRS years, converted Aqua stays within ${f.check?.maxPct ?? '?'}% of VIIRS.`}
              years={data.years}
              value={(y) => y.ratio_converted}
              color={(y) => SOURCE_COLOR[mainSource(y)]}
              legend={legendFor(ALL_SOURCES)}
              overlay={{ value: (y) => y.aqua_converted, color: '#dfe6f3', label: 'Aqua, converted the same way' }}
              band={
                terraYears.length
                  ? { from: terraYears[0].year, to: terraYears[terraYears.length - 1].year, label: 'Least certain: Terra only' }
                  : undefined
              }
              footnote={
                <>
                  MODIS years use the overlap ratio from the pipeline's calibration: Aqua ×
                  {data.conversion.aqua_to_viirs.toFixed(2)} (fitted {yearOf(data.conversion.aqua_to_viirs_window[0])}–
                  {yearOf(data.conversion.aqua_to_viirs_window[1])}), Terra ×{data.conversion.terra_to_aqua.toFixed(2)} to
                  Aqua (fitted {yearOf(data.conversion.terra_to_aqua_window[0])}–
                  {yearOf(data.conversion.terra_to_aqua_window[1])}).
                </>
              }
            />
          </div>
        </section>

        <section className="story-section story-end" data-stage="4">
          <div className="story-column">
            <h2>Now ask it about your area.</h2>
            <p>
              Draw a box anywhere in India and get back a month-by-month fire calendar from{' '}
              {monthLabel(data.coverage.first_month)} to {monthLabel(data.coverage.last_month)}, how each month
              compares with its usual level, and the numbers as a CSV.
            </p>
            <dl className="story-features">
              <div>
                <dt>Fire calendar</dt>
                <dd>Years down the side, months across, so fire seasons and big years show at a glance.</dd>
              </div>
              <div>
                <dt>Compared with usual</dt>
                <dd>Each month against the median of the same month in every other year.</dd>
              </div>
              <div>
                <dt>Download</dt>
                <dd>The monthly numbers for your area, with the satellite each one came from.</dd>
              </div>
            </dl>
            <div className="story-actions">
              <a href={EXPLORER_HREF} className="story-button">Open the explorer</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="story-footer">
        <p>
          Counts are satellite fire detections, not burned area. Data: NASA FIRMS, MODIS Collection 6.1 and VIIRS
          Collection 2, India, {data.cell_size_deg}° grid. NASA Space Apps Challenge 2026.
        </p>
      </footer>
    </div>
  );
}

export function StoryPage() {
  const { data, error } = useStoryData();
  if (error) {
    return (
      <div className="story story-message">
        <p>
          The story data didn't load. <a href={EXPLORER_HREF}>Open the explorer</a> instead.
        </p>
      </div>
    );
  }
  if (!data) return <div className="story story-message" aria-busy="true" />;
  return <Story data={data} />;
}
