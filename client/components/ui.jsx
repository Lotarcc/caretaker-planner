import React from 'react';
import { ALL_ATTRS, MEMORY_ATTRS, compareSymbol, effective, pretty, round } from '../../shared/rules.js';

export const ATTR_SHORT = {
  Logic: 'LOG', Focus: 'FOC', Discipline: 'DIS', Creativity: 'CRE', Communication: 'COM', Empathy: 'EMP',
  Leadership: 'LEA', Wisdom: 'WIS', Patience: 'PAT', Adaptability: 'ADA',
  Strength: 'STR', Height: 'HGT', Weight: 'WGT', Intellect: 'INT', Life_Expectancy: 'LIFE',
};

export const attrKind = (a) => (MEMORY_ATTRS.includes(a) ? 'mind' : 'body');

export function Badge({ tone = 'muted', children, title }) {
  return <span className={`badge badge-${tone}`} title={title}>{children}</span>;
}

export const STATUS = {
  growable: { tone: 'good', label: 'Growable' },
  close: { tone: 'warn', label: 'Close' },
  far: { tone: 'bad', label: 'Far' },
};

export function StatusBadge({ status }) {
  const s = STATUS[status] ?? { tone: 'muted', label: '…' };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function TierBadge({ tier }) {
  return <span className={`tier tier-${tier}`} title={`Tier ${tier}`}>T{tier}</span>;
}

/** Non-zero stats of an item as small chips. */
export function StatChips({ item, attrs = ALL_ATTRS, limit = 10 }) {
  const stats = attrs.filter((a) => Number(item[a] ?? 0) !== 0);
  if (!stats.length) return <span className="muted small">{item.unverified ? 'stats unknown' : 'no stats'}</span>;
  return (
    <span className="chips">
      {stats.slice(0, limit).map((a) => (
        <span key={a} className={`chip chip-${attrKind(a)}`} title={pretty(a)}>
          {ATTR_SHORT[a]} {fmt(item[a])}
        </span>
      ))}
      {stats.length > limit && <span className="chip">+{stats.length - limit}</span>}
    </span>
  );
}

export function fmt(v, digits = 1) {
  const n = Number(v ?? 0);
  return Number.isInteger(n) ? String(n) : n.toFixed(digits).replace(/\.0+$/, '');
}

/** A horizontal progress bar; value/target, with an optional marker. */
export function Bar({ value, target, tone, label, right }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 100;
  const t = tone ?? (value >= target ? 'good' : pct >= 80 ? 'warn' : 'bad');
  return (
    <div className="bar-row">
      {label && <span className="bar-label">{label}</span>}
      <div className="bar"><div className={`bar-fill fill-${t}`} style={{ width: `${pct}%` }} /></div>
      {right !== undefined && <span className="bar-right">{right}</span>}
    </div>
  );
}

/** Attribute bars for an evaluation: effective value vs required. */
export function RequirementBars({ attrs }) {
  return (
    <div className="req-bars">
      {attrs.map((a) => (
        <Bar
          key={a.attr}
          label={pretty(a.attr)}
          value={a.effective}
          target={a.required || 1}
          tone={a.met ? 'good' : undefined}
          right={<>{fmt(a.effective)} <span className="muted">{compareSymbol(a.type)} {fmt(a.required)}</span></>}
        />
      ))}
    </div>
  );
}

export function WeightBar({ weight, capacity }) {
  return (
    <Bar
      label="Pod weight"
      value={weight}
      target={capacity}
      tone={weight > capacity ? 'bad' : 'info'}
      right={`${fmt(weight, 2)} / ${capacity} kg`}
    />
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          className={value === t.value ? 'tab active' : 'tab'}
          onClick={() => onChange(t.value)}
        >
          {t.label}
          {t.count !== undefined && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, onChange, min = 0, title }) {
  return (
    <span className="stepper" title={title}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="decrease">−</button>
      <input
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.floor(Number(e.target.value) || 0)))}
      />
      <button type="button" onClick={() => onChange(value + 1)} aria-label="increase">+</button>
    </span>
  );
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}

export function Spinner({ label = 'Working…' }) {
  return <div className="spinner-row"><span className="spinner" /> {label}</div>;
}

export function timeAgo(value) {
  if (!value) return '';
  const t = typeof value === 'number' ? value * 1000 : Date.parse(value);
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

export { effective, round, pretty };
