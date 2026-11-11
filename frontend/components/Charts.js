'use client';
/**
 * Lightweight SVG/CSS charts following the dataviz method:
 *  - single-series charts use one validated hue (--series-1) and no legend box
 *  - thin bars, 4px rounded data-ends anchored to the baseline, 2px gaps
 *  - recessive grid/axes; values in text tokens, never in the series colour
 *  - hover tooltip on every bar; hit target = full column
 */
import { useState } from 'react';
import { enumLabel, toneOf } from '@/lib/format';

function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/** Vertical bar chart, one series. data: [{label, value, sub?}] */
export function BarChart({ data, format = (v) => v, height = 220, ariaLabel }) {
  const [hover, setHover] = useState(null);
  const W = 640, H = height, padL = 52, padR = 8, padT = 12, padB = 28;
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const iw = W - padL - padR, ih = H - padT - padB;
  const slot = iw / Math.max(1, data.length);
  const bw = Math.min(36, slot * 0.6);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const y = (v) => padT + ih - (v / max) * ih;

  return (
    <div className="vchart" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="1" strokeDasharray={t === 0 ? '' : '2 4'} />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{format(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = padL + slot * i + (slot - bw) / 2;
          const top = y(d.value);
          const h = Math.max(0, padT + ih - top);
          const r = Math.min(4, h);
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)}>
              <rect x={padL + slot * i} y={padT} width={slot} height={ih} fill="transparent" />
              <path
                d={`M${x},${padT + ih} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${padT + ih} Z`}
                fill="var(--series-1)" opacity={hover == null || hover === i ? 1 : 0.45} style={{ transition: 'opacity .15s' }} />
              <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill={hover === i ? 'var(--text)' : 'var(--muted)'}>{d.label}</text>
            </g>
          );
        })}
      </svg>
      {hover != null && data[hover] && (
        <div className="tip" style={{ left: `${((padL + slot * hover + slot / 2) / W) * 100}%`, top: `${(y(data[hover].value) / H) * 100}%` }}>
          <div style={{ color: 'var(--muted)', fontSize: 11 }}>{data[hover].label}</div>
          <strong>{format(data[hover].value)}</strong>{data[hover].sub && <div style={{ color: 'var(--text-2)' }}>{data[hover].sub}</div>}
        </div>
      )}
    </div>
  );
}

/** Horizontal bars. status=true colours by state (with the label always shown). */
export function HBarList({ data, status = false, format = (v) => v }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      {data.map((d) => {
        const tone = status ? toneOf(d.label) : null;
        const color = tone ? (tone === 'neutral' ? 'var(--neutral)' : `var(--${tone})`) : 'var(--series-1)';
        return (
          <div className="hbar" key={d.label} title={`${enumLabel(d.label)}: ${format(d.value)}`}>
            <span className="hbar-label">
              {status && <span className="badge-dot" style={{ width: 8, height: 8, borderRadius: 2, background: color, flex: 'none' }} />}
              {enumLabel(d.label)}
            </span>
            <div className="hbar-track"><div className="hbar-fill" style={{ width: `${(d.value / max) * 100}%`, background: color }} /></div>
            <span className="hbar-value">{format(d.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Ring gauge for a single headline ratio. */
export function Ring({ value, total, label }) {
  const pct = total ? value / total : 0;
  const r = 42, c = 2 * Math.PI * r;
  return (
    <div className="row" style={{ gap: 18, flexWrap: 'nowrap' }}>
      <svg width="104" height="104" viewBox="0 0 104 104" role="img" aria-label={`${label}: ${Math.round(pct * 100)}%`}>
        <circle cx="52" cy="52" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="10" />
        <circle cx="52" cy="52" r={r} fill="none" stroke="var(--series-1)" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 52 52)" style={{ transition: 'stroke-dasharray .6s' }} />
        <text x="52" y="57" textAnchor="middle" fontSize="20" fontWeight="800" fill="var(--text)">{Math.round(pct * 100)}%</text>
      </svg>
      <div>
        <div className="stat-label">{label}</div>
        <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{value} <span className="muted" style={{ fontSize: 14, fontWeight: 500 }}>/ {total}</span></div>
      </div>
    </div>
  );
}
