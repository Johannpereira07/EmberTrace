/**
 * EmberTrace – yearly bar chart for the story page (plain SVG).
 * Partial years (fewer than 12 months of data) are drawn as outlines, never as full bars,
 * and every colour has a text legend.
 */

import React from 'react';
import { formatCount, type StoryYear } from './storyData';

export interface ChartMarker {
  year: number;
  label: string;
}

export interface ChartBand {
  from: number;
  to: number;
  label: string;
}

interface Props {
  title: string;
  summary: string; // read by screen readers in place of the picture
  years: StoryYear[];
  value: (y: StoryYear) => number;
  color: (y: StoryYear) => string;
  legend: { color: string; label: string }[];
  markers?: ChartMarker[];
  band?: ChartBand; // a range of years to flag (e.g. values known to be off)
  highlight?: [number, number]; // draw a step annotation between these two years
  overlay?: { value: (y: StoryYear) => number | null; color: string; label: string };
  footnote?: React.ReactNode;
}

const W = 760;
const H = 300;
const PAD = { top: 36, right: 12, bottom: 30, left: 52 };

function niceMax(v: number): number {
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * mag >= v) return m * mag;
  return 10 * mag;
}

export function YearChart({ title, summary, years, value, color, legend, markers = [], band, highlight, overlay, footnote }: Props) {
  const max = niceMax(Math.max(...years.map(value), ...years.map((d) => overlay?.value(d) ?? 0)));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const step = plotW / years.length;
  const barW = Math.max(4, step * 0.68);
  const x = (year: number) => PAD.left + (years.findIndex((y) => y.year === year) + 0.5) * step;
  const y = (v: number) => PAD.top + plotH * (1 - v / max);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);

  const hi = highlight && highlight.map((yr) => years.find((d) => d.year === yr));
  const ratio = hi && hi[0] && hi[1] ? value(hi[1]) / value(hi[0]) : null;

  return (
    <figure className="story-chart">
      <figcaption className="story-chart-title">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className="w-full h-auto">
        {band && (
          <g>
            <rect
              x={x(band.from) - step / 2}
              y={PAD.top - 22}
              width={x(band.to) - x(band.from) + step}
              height={plotH + 22}
              fill="url(#story-hatch)"
            />
            <text x={x(band.from) - step / 2 + 4} y={PAD.top - 9} className="story-chart-note">
              {band.label}
            </text>
          </g>
        )}
        <defs>
          <pattern id="story-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="rgba(255,148,66,0.06)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,148,66,0.28)" strokeWidth="1.5" />
          </pattern>
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#1c2747" />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="story-chart-axis">
              {formatCount(t)}
            </text>
          </g>
        ))}

        {years.map((d) => {
          const v = value(d);
          const partial = d.months < 12;
          const top = y(v);
          return (
            <rect
              key={d.year}
              x={x(d.year) - barW / 2}
              y={top}
              width={barW}
              height={Math.max(0, PAD.top + plotH - top)}
              rx={1.5}
              fill={partial ? 'none' : color(d)}
              stroke={partial ? color(d) : 'none'}
              strokeWidth={partial ? 1.5 : 0}
              strokeDasharray={partial ? '3 2' : undefined}
            >
              <title>
                {d.year}: {Math.round(v).toLocaleString('en')}
                {partial ? ` (partial year, ${d.months} months)` : ''}
              </title>
            </rect>
          );
        })}

        {overlay && (
          <g>
            <polyline
              fill="none"
              stroke={overlay.color}
              strokeWidth={1.5}
              points={years
                .filter((d) => overlay.value(d) !== null && d.months === 12)
                .map((d) => `${x(d.year)},${y(overlay.value(d) as number)}`)
                .join(' ')}
            />
            {years
              .filter((d) => overlay.value(d) !== null && d.months === 12)
              .map((d) => (
                <circle key={d.year} cx={x(d.year)} cy={y(overlay.value(d) as number)} r={3.5} fill={overlay.color} stroke="#070b16" strokeWidth={1.5}>
                  <title>
                    {d.year}, {overlay.label}: {Math.round(overlay.value(d) as number).toLocaleString('en')}
                  </title>
                </circle>
              ))}
          </g>
        )}

        {years
          .filter((d) => d.year % 5 === 0)
          .map((d) => (
            <text key={d.year} x={x(d.year)} y={H - 8} textAnchor="middle" className="story-chart-axis">
              {d.year}
            </text>
          ))}

        {markers.map((m) => (
          <g key={m.label}>
            <line x1={x(m.year) - step / 2} x2={x(m.year) - step / 2} y1={PAD.top - 6} y2={PAD.top + plotH} stroke="#dfe6f3" strokeOpacity={0.5} strokeDasharray="2 3" />
            <text x={x(m.year) - step / 2 - 5} y={PAD.top - 10} textAnchor="end" className="story-chart-note">
              {m.label}
            </text>
          </g>
        ))}

        {hi && hi[0] && hi[1] && ratio && (
          <g>
            <path
              d={`M ${x(hi[0].year)} ${y(value(hi[0])) - 8} C ${x(hi[0].year)} ${y(value(hi[1])) - 30}, ${x(hi[1].year) - 20} ${y(value(hi[1])) - 30}, ${x(hi[1].year) - 4} ${y(value(hi[1])) - 10}`}
              fill="none"
              stroke="#ff9442"
              strokeWidth={1.5}
            />
            <text x={x(hi[1].year) - 24} y={y(value(hi[1])) - 34} textAnchor="end" className="story-chart-callout">
              ×{ratio.toFixed(1)} in one year
            </text>
          </g>
        )}
      </svg>
      <ul className="story-chart-legend">
        {legend.map((l) => (
          <li key={l.label}>
            <span className="story-swatch" style={{ background: l.color }} aria-hidden="true" />
            {l.label}
          </li>
        ))}
        {overlay && (
          <li>
            <span className="story-swatch story-swatch-dot" style={{ background: overlay.color }} aria-hidden="true" />
            {overlay.label}
          </li>
        )}
        {years.some((d) => d.months < 12) && (
          <li>
            <span className="story-swatch story-swatch-partial" aria-hidden="true" />
            Partial year
          </li>
        )}
      </ul>
      {footnote && <p className="story-chart-footnote">{footnote}</p>}
    </figure>
  );
}
