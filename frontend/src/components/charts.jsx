import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { t } from './ui';

/**
 * Small SVG charts for the back-office dashboard, drawn on the panel surface (~#FFFFFF).
 * Series colours were checked with the dataviz palette validator against that surface
 * (lightness, chroma, colour-blind separation, normal vision, 3:1 contrast): all pass.
 * Slot 1 olive, slot 2 violet, always in this order. Text never takes a series colour.
 */
export const SERIES = ['#5e7d2a', '#7a5aa6'];
// Grid, axis and labels take the theme's ink (text-ink/… with currentColor), so they hold in dark

/** Width of an element, kept up to date */
function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return undefined;
    const update = () => setWidth(ref.current.getBoundingClientRect().width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Clean axis maximum and ticks: 0, step, 2·step… */
const niceTicks = (max, count = 4) => {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const ticks = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 1000) / 1000);
  if (ticks[ticks.length - 1] < max) ticks.push(Math.round((ticks[ticks.length - 1] + step) * 1000) / 1000);
  return ticks;
};

export const compact = (n, lang) =>
  n == null ? '—' : Number(n).toLocaleString(lang === 'ar' ? 'ar-TN' : 'fr-FR', { notation: Math.abs(n) >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 });

export const dayLabel = (day, lang, weekday = false) => new Date(`${day}T12:00:00Z`).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'fr-FR', { weekday: weekday ? 'short' : undefined, day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Legend: one swatch per series, text in ink. Only drawn for two series or more. */
export function Legend({ items }) {
  if (items.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
      {items.map((it) => (
        <li key={it.label} className="inline-flex items-center gap-1.5">
          {it.kind === 'line' ? (
            <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: it.color }} aria-hidden="true" />
          ) : (
            <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: it.color }} aria-hidden="true" />
          )}
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Daily chart: one series as columns (slot 1) and, optionally, a second as a line with
 * dots (slot 2), on one shared axis. Hovering a day shows both values.
 * data: [{ day: 'YYYY-MM-DD', [bar.key]: n, [line.key]: n }]
 * bar / line: { key, label, format? }
 */
export function DailyChart({ lang, data, bar, line, height = 220, ariaLabel }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const pad = { top: 12, right: 8, bottom: 26, left: 40 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(1, ...data.map((d) => Math.max(d[bar.key] || 0, line ? d[line.key] || 0 : 0)));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const band = data.length ? innerW / data.length : 0;
  const barW = Math.max(2, Math.min(24, band * 0.6));
  const x = (i) => pad.left + band * i + band / 2;
  const y = (v) => pad.top + innerH - (v / top) * innerH;
  const fmt = (v, s) => (s.format ? s.format(v) : compact(v, lang));
  // About six date labels whatever the period
  const every = Math.max(1, Math.ceil(data.length / 6));

  const linePath = line
    ? data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[line.key] || 0).toFixed(1)}`).join(' ')
    : '';

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - rect.left - pad.left) / band);
    setHover(i >= 0 && i < data.length ? i : null);
  };

  const h = hover != null ? data[hover] : null;
  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} onMouseMove={onMove} onMouseLeave={() => setHover(null)} className="block">
          {ticks.map((tv) => (
            <g key={tv}>
              <line x1={pad.left} x2={width - pad.right} y1={y(tv)} y2={y(tv)} stroke="currentColor" className={tv === 0 ? 'text-ink/30' : 'text-ink/10'} strokeWidth="1" />
              <text x={pad.left - 6} y={y(tv)} dy="0.32em" textAnchor="end" fontSize="11" fill="currentColor" className="text-ink-faint" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {compact(tv, lang)}
              </text>
            </g>
          ))}
          {hover != null && <rect x={pad.left + band * hover} y={pad.top} width={band} height={innerH} fill="rgba(47,38,29,0.06)" />}
          {data.map((d, i) => {
            const v = d[bar.key] || 0;
            if (!v) return null;
            const bx = x(i) - barW / 2;
            const by = y(v);
            const bh = pad.top + innerH - by;
            const r = Math.min(4, barW / 2, bh);
            // 4px rounded data end, square at the baseline
            const path = `M${bx},${by + bh} V${by + r} Q${bx},${by} ${bx + r},${by} H${bx + barW - r} Q${bx + barW},${by} ${bx + barW},${by + r} V${by + bh} Z`;
            return <path key={d.day} d={path} fill={SERIES[0]} />;
          })}
          {line && <path d={linePath} fill="none" stroke={SERIES[1]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
          {line &&
            data.map((d, i) =>
              (d[line.key] || 0) > 0 || hover === i ? (
                <circle key={d.day} cx={x(i)} cy={y(d[line.key] || 0)} r="4" fill={SERIES[1]} stroke="currentColor" className="text-canvas-paper" strokeWidth="2" />
              ) : null
            )}
          {data.map((d, i) =>
            i % every === (data.length - 1) % every ? (
              <text key={d.day} x={x(i)} y={height - 8} textAnchor="middle" fontSize="11" fill="currentColor" className="text-ink-faint">
                {dayLabel(d.day, lang)}
              </text>
            ) : null
          )}
        </svg>
      )}
      {h && (
        <div
          className="pointer-events-none absolute top-1 z-10 min-w-[9rem] rounded-xl border border-canvas-line bg-canvas-paper px-3 py-2 text-xs shadow-lg"
          style={{ left: Math.min(Math.max(0, x(hover) - 72), Math.max(0, width - 150)) }}
        >
          <p className="font-medium text-ink">{dayLabel(h.day, lang)}</p>
          {[bar, line].filter(Boolean).map((s, i) => (
            <p key={s.key} className="mt-0.5 flex items-center gap-1.5 text-ink-soft">
              <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: SERIES[i] }} aria-hidden="true" />
              {s.label}
              <span className="ms-auto ps-3 font-medium tabular-nums text-ink">{fmt(h[s.key] || 0, s)}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Horizontal bars, one series (slot 1): label on the left, value at the bar's tip.
 * rows: [{ key, label, value, note? }] — note is extra text beside the label (e.g. "2 en retard")
 */
export function BarList({ lang, rows, format, emptyText }) {
  const max = Math.max(1, ...rows.map((r) => r.value || 0));
  if (!rows.length) return <p className="py-6 text-center text-sm text-ink-faint">{emptyText}</p>;
  // Bars scale into the space left after the value, so the longest bar ends where the value
  // still fits and every bar stays proportional. On phones the label sits above its bar.
  return (
    <ul className="space-y-3 sm:space-y-2.5">
      {rows.map((r) => (
        <li
          key={r.key}
          className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-[minmax(6rem,38%)_minmax(0,1fr)] sm:items-center sm:gap-3"
          title={`${r.label} : ${format ? format(r.value) : compact(r.value, lang)}`}
        >
          <span className="flex min-w-0 items-baseline gap-2">
            <span dir="auto" className="truncate text-start text-ink-soft">{r.label}</span>
            {r.note && <span className="shrink-0 text-xs">{r.note}</span>}
          </span>
          <span className="flex min-w-0 items-center gap-2">
            {r.value > 0 && (
              <span
                className="h-3 shrink-0 rounded-e-[4px]"
                style={{ width: `max(2px, calc((100% - 4rem) * ${(r.value / max).toFixed(4)}))`, background: SERIES[0] }}
                aria-hidden="true"
              />
            )}
            <span className="shrink-0 font-medium tabular-nums text-ink">{format ? format(r.value) : compact(r.value, lang)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A panel with a title, an optional "table" toggle and its chart */
export function ChartCard({ lang, title, subtitle, legend, table, children, className = '' }) {
  const tr = t(lang);
  const [showTable, setShowTable] = useState(false);
  return (
    <section className={`panel min-w-0 space-y-3 p-4 sm:p-5 ${className}`}>
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-ink-soft">{subtitle}</p>}
        </div>
        {table && (
          <button type="button" className="text-xs text-ink-soft underline underline-offset-4 hover:text-ink" onClick={() => setShowTable((v) => !v)} aria-pressed={showTable}>
            {showTable ? tr('Graphique', 'رسم') : tr('Tableau', 'جدول')}
          </button>
        )}
      </div>
      {legend}
      {showTable ? table : children}
    </section>
  );
}

/** Plain data table, for the "Tableau" view and the detailed lists */
export function DataTable({ columns, rows, emptyText, maxHeight }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-ink-faint">{emptyText}</p>;
  return (
    <div className="-mx-1 overflow-x-auto" style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}>
      <table className="w-full min-w-[28rem] text-sm">
        <thead className="sticky top-0 bg-canvas-raised/95 text-xs text-ink-soft">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={`px-1 py-1.5 font-medium ${c.numeric ? 'text-end' : 'text-start'}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-canvas-line/70">
          {rows.map((r, i) => (
            <tr key={r.key ?? i}>
              {columns.map((c) => (
                <td key={c.key} dir={c.numeric ? undefined : 'auto'} className={`px-1 py-1.5 ${c.numeric ? 'text-end tabular-nums' : 'text-start'}`}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Stat tile: label, value, optional hint below */
export function StatTile({ label, value, hint, tone }) {
  return (
    <div className="panel p-4">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone === 'bad' ? 'text-status-unsafe-ink' : 'text-ink'}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

/** Re-renders every minute (for "updated 3 min ago") */
export function useMinuteTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, []);
}

