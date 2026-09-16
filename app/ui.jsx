'use client';

export const STATUS_CLASS = { PASS: 's-pass', WARN: 's-warn', FAIL: 's-fail', NA: 's-na' };
export const RISK_CLASS = { LOW: 's-pass', MEDIUM: 's-warn', HIGH: 's-fail', CRITICAL: 's-fail' };

export const inr = (n) =>
  n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : `₹${(n / 1e5).toFixed(2)} L`;

export function Chip({ kind, children, solid = false }) {
  return (
    <span
      className={`${kind} inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase whitespace-nowrap`}
      style={solid ? { background: 'var(--s)', color: '#fff' } : { background: 'var(--sb)', color: 'var(--s)' }}
    >
      {children}
    </span>
  );
}

export function ScoreBar({ score, risk }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full max-w-[110px] overflow-hidden rounded-full bg-slate-200">
        <div className={RISK_CLASS[risk]} style={{ width: `${score}%`, background: 'var(--s)' }} />
      </div>
      <span className="w-9 text-right font-mono text-sm font-semibold tabular-nums">{score}</span>
    </div>
  );
}

export function Field({ label, children, mono = false }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className={`mt-0.5 break-words text-[13px] text-slate-800 ${mono ? 'font-mono' : ''}`}>{children ?? '—'}</dd>
    </div>
  );
}

export function Panel({ title, sub, right, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      {(title || right) && (
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
          <div>
            <h3 className="text-[13px] font-semibold text-slate-900">{title}</h3>
            {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}
