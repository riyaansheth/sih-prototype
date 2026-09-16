'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Chip, Field, Panel, ScoreBar, STATUS_CLASS, RISK_CLASS, inr } from './ui.jsx';

const TABS = ['Compliance Checks', 'Cross-Verification', 'Portal Evidence', 'AI Recommendation', 'Audit Trail', 'Document AI'];

export default function Dashboard({ tender, bidders, sources }) {
  const [results, setResults] = useState({});
  const [inFlight, setInFlight] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState(TABS[0]);
  const [decisions, setDecisions] = useState({});

  useEffect(() => {
    try { setDecisions(JSON.parse(localStorage.getItem('officerDecisions') || '{}')); } catch {}
  }, []);

  const recordDecision = (id, decision, remark) => {
    const next = { ...decisions, [id]: { decision, remark, at: new Date().toISOString(), officer: 'AGM (Materials), CPCL — OFF-4471' } };
    setDecisions(next);
    try { localStorage.setItem('officerDecisions', JSON.stringify(next)); } catch {}
  };

  const verify = useCallback(async (id) => {
    setInFlight((f) => [...f, id]);
    try {
      const r = await fetch(`/api/verify?bidder=${id}`).then((x) => x.json());
      setResults((prev) => ({ ...prev, [id]: r }));
      setSelected((s) => s ?? id);
      return r;
    } finally {
      setInFlight((f) => f.filter((x) => x !== id));
    }
  }, []);

  const verifyAll = async () => {
    setResults({});
    for (const b of bidders) {
      await verify(b.id);
      await new Promise((r) => setTimeout(r, 260)); // paced so the fan-out is visible
    }
  };

  const ranked = useMemo(
    () => bidders.map((b) => ({ ...b, result: results[b.id] })).sort((a, z) => (z.result?.score ?? -1) - (a.result?.score ?? -1)),
    [bidders, results]
  );
  const done = Object.keys(results).length;
  const current = selected ? results[selected] : null;

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6">
      <TenderHeader tender={tender} sources={sources} />

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <button
          onClick={verifyAll}
          disabled={inFlight.length > 0}
          className="rounded-md bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
        >
          {inFlight.length ? `Verifying ${inFlight[0]}…` : done ? 'Re-run Verification' : `Verify All ${bidders.length} Bidders`}
        </button>
        <p className="text-xs text-slate-500">
          {done
            ? `${done} of ${bidders.length} verified · ${sources.length} sources queried per bidder · ${done * sources.length} portal calls`
            : `${sources.length} government sources will be queried for each bidder.`}
        </p>
        {done > 0 && <Summary results={results} />}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(320px,400px)_1fr]">
        <BidderList ranked={ranked} inFlight={inFlight} selected={selected} onSelect={setSelected} decisions={decisions} />
        <div className="min-w-0">
          {current ? (
            <>
              <BidderDetail result={current} decision={decisions[current.bidder.id]} onDecide={recordDecision} />
              <nav className="mt-4 flex flex-wrap gap-1 border-b border-slate-200">
                {TABS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`-mb-px border-b-2 px-3 py-2 text-[13px] font-medium transition ${
                      tab === t ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </nav>
              <div className="mt-4">
                {tab === 'Compliance Checks' && <ChecksTab result={current} />}
                {tab === 'Cross-Verification' && <CrossTab result={current} />}
                {tab === 'Portal Evidence' && <PortalsTab result={current} sources={sources} />}
                {tab === 'AI Recommendation' && <AITab result={current} />}
                {tab === 'Audit Trail' && <AuditTab result={current} decision={decisions[current.bidder.id]} />}
                {tab === 'Document AI' && <ExtractTab result={current} />}
              </div>
            </>
          ) : (
            <Empty />
          )}
        </div>
      </div>

      <footer className="mt-10 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500">
        <p className="font-medium text-slate-600">
          Decision-support tool. Qualification and disqualification remain with the Procurement Officer.
        </p>
        <p className="mt-1">
          Prototype — SIH 2026 PS 26100 · Ministry of Petroleum &amp; Natural Gas / Chennai Petroleum Corporation Limited.
          Portal responses are simulated behind a production-shaped connector interface; no live government API is called.
        </p>
      </footer>
    </div>
  );
}

function TenderHeader({ tender, sources }) {
  const r = tender.requirements;
  return (
    <header className="rounded-lg bg-slate-900 px-5 py-4 text-white">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[11px] tracking-wider text-slate-400">{tender.id} · GeM {tender.gemBidNo}</p>
          <h1 className="mt-1 text-lg font-semibold leading-snug">{tender.title}</h1>
          <p className="mt-1 text-[13px] text-slate-300">{tender.buyer} · {tender.ministry}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Estimated Value</p>
          <p className="font-mono text-xl font-semibold">{inr(tender.estimatedValue)}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">Closed {tender.bidCloseDate}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/10 pt-3 text-[11px]">
        {[
          r.msmeReserved && 'MSE Reserved',
          `Local content ≥ ${r.minLocalContentPct}%`,
          `Turnover ≥ ${inr(r.minAnnualTurnover)}`,
          r.epfoRequired && 'EPFO',
          r.esicRequired && 'ESIC',
          r.oemAuthorizationRequired && 'OEM Authorization',
          r.bisCertificationRequired && `BIS (${r.bisStandard})`,
        ].filter(Boolean).map((t) => (
          <span key={t} className="rounded bg-white/10 px-2 py-0.5 text-slate-200">{t}</span>
        ))}
        <span className="ml-auto text-slate-400">{sources.length} integrated sources</span>
      </div>
    </header>
  );
}

function Summary({ results }) {
  const all = Object.values(results);
  const counts = all.reduce((a, r) => ({ ...a, [r.risk]: (a[r.risk] ?? 0) + 1 }), {});
  return (
    <div className="ml-auto flex items-center gap-1.5">
      {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].filter((k) => counts[k]).map((k) => (
        <Chip key={k} kind={RISK_CLASS[k]}>{counts[k]} {k}</Chip>
      ))}
    </div>
  );
}

function BidderList({ ranked, inFlight, selected, onSelect, decisions }) {
  return (
    <div className="space-y-2">
      {ranked.map((b, i) => {
        const r = b.result;
        const busy = inFlight.includes(b.id);
        const dec = decisions[b.id];
        return (
          <button
            key={b.id}
            onClick={() => r && onSelect(b.id)}
            disabled={!r}
            style={{ animationDelay: `${i * 40}ms` }}
            className={`row-in w-full rounded-lg border bg-white px-4 py-3 text-left transition ${
              selected === b.id ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-400'
            } ${!r ? 'opacity-60' : ''}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-slate-900">{b.legalName}</p>
                <p className="mt-0.5 font-mono text-[11px] text-slate-400">{b.gemSellerId}</p>
              </div>
              {r ? <Chip kind={RISK_CLASS[r.risk]} solid={r.risk === 'CRITICAL'}>{r.risk}</Chip>
                 : <span className="text-[11px] text-slate-400">{busy ? 'querying…' : 'pending'}</span>}
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-3">
              {r ? <ScoreBar score={r.score} risk={r.risk} /> : <div className="h-1.5 w-full max-w-[110px] overflow-hidden rounded-full bg-slate-200"><div className={`h-full bg-slate-400 ${busy ? 'animate-pulse' : ''}`} style={{ width: busy ? '60%' : '0%' }} /></div>}
              <span className="font-mono text-[11px] text-slate-500">{inr(b.quotedValue)}</span>
            </div>
            {r?.overriddenByGate && (
              <p className="s-fail mt-2 rounded px-2 py-1 text-[11px] font-medium" style={{ background: 'var(--sb)', color: 'var(--s)' }}>
                Gating failure — {r.gateFailures.map((g) => g.label).join(', ')}
              </p>
            )}
            {dec && (
              <p className="mt-2 text-[11px] text-slate-500">
                Officer: <span className="font-semibold text-slate-700">{dec.decision.replace(/_/g, ' ')}</span>
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

function BidderDetail({ result: r, decision, onDecide }) {
  const [remark, setRemark] = useState('');
  const tally = r.checks.reduce((a, c) => ({ ...a, [c.status]: (a[c.status] ?? 0) + 1 }), {});
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-4 px-4 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">{r.bidder.legalName}</h2>
          <p className="mt-0.5 font-mono text-[11px] text-slate-400">{r.bidder.id} · {r.bidder.gemSellerId} · quoted {inr(r.bidder.quotedValue)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {['PASS', 'WARN', 'FAIL', 'NA'].filter((s) => tally[s]).map((s) => (
              <Chip key={s} kind={STATUS_CLASS[s]}>{tally[s]} {s}</Chip>
            ))}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Compliance Score</p>
          <p className={`${RISK_CLASS[r.risk]} font-mono text-4xl font-bold leading-none`} style={{ color: 'var(--s)' }}>{r.score}</p>
          <p className="mt-1 text-[11px] text-slate-500">{r.earnedWeight} / {r.totalWeight} weighted points</p>
          <p className="mt-1.5 text-[13px] font-semibold text-slate-900">{r.recommendation.replace(/_/g, ' ')}</p>
        </div>
      </div>

      {r.overriddenByGate && (
        <div className="s-fail border-t px-4 py-3" style={{ background: 'var(--sb)', borderColor: 'var(--s)' }}>
          <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--s)' }}>Gating failure — risk band overridden to CRITICAL</p>
          {r.gateFailures.map((g) => (
            <p key={g.id} className="mt-1 text-[13px] leading-relaxed text-slate-800"><span className="font-semibold">{g.label}:</span> {g.detail}</p>
          ))}
          <p className="mt-2 text-[11px] text-slate-600">
            The bidder scores {r.score}/100 on documentation. A gating failure is not curable by performance on other checks.
          </p>
        </div>
      )}

      <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Procurement Officer Decision</p>
        {decision ? (
          <div className="mt-1.5">
            <p className="text-[13px] text-slate-800">
              <span className="font-semibold">{decision.decision.replace(/_/g, ' ')}</span> — {decision.officer}
            </p>
            {decision.remark && <p className="mt-1 text-[13px] italic text-slate-600">“{decision.remark}”</p>}
            <p className="mt-1 font-mono text-[11px] text-slate-400">{new Date(decision.at).toLocaleString('en-IN')}</p>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Remark for the evaluation record…"
              className="min-w-[200px] flex-1 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-slate-900"
            />
            <button onClick={() => onDecide(r.bidder.id, 'QUALIFIED', remark)} className="rounded bg-emerald-700 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-800">Qualify</button>
            <button onClick={() => onDecide(r.bidder.id, 'DISQUALIFIED', remark)} className="rounded bg-red-700 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-red-800">Disqualify</button>
            <button onClick={() => onDecide(r.bidder.id, 'CLARIFICATION_SOUGHT', remark)} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:border-slate-500">Seek Clarification</button>
          </div>
        )}
      </div>
    </Panel>
  );
}

function ChecksTab({ result: r }) {
  const [open, setOpen] = useState(null);
  const order = { FAIL: 0, WARN: 1, PASS: 2, NA: 3 };
  const checks = [...r.checks].sort((a, b) => (a.gate === b.gate ? 0 : a.gate ? -1 : 1) || order[a.status] - order[b.status]);
  return (
    <Panel title="Compliance Checks" sub="Every status is produced by a deterministic rule and carries its portal evidence.">
      <ul className="divide-y divide-slate-100">
        {checks.map((c) => (
          <li key={c.id}>
            <button onClick={() => setOpen(open === c.id ? null : c.id)} className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
              <span className={`${STATUS_CLASS[c.status]} mt-0.5 h-2 w-2 shrink-0 rounded-full`} style={{ background: 'var(--s)' }} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold text-slate-900">{c.label}</span>
                  {c.gate && <Chip kind="s-fail">Gating</Chip>}
                  <span className="text-[11px] text-slate-400">{c.category} · weight {c.weight}</span>
                </span>
                <span className="mt-0.5 block text-[13px] leading-relaxed text-slate-600">{c.detail}</span>
              </span>
              <Chip kind={STATUS_CLASS[c.status]}>{c.status}</Chip>
            </button>
            {open === c.id && c.evidence?.length > 0 && (
              <div className="bg-slate-50 px-4 py-2.5 pl-10">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Evidence</p>
                <ul className="mt-1 space-y-0.5">
                  {c.evidence.map((e, i) => (
                    <li key={i} className="font-mono text-[11px] text-slate-600">
                      <span className="text-slate-400">{e.source}</span> · {e.ref} {e.portal && <span className="text-slate-400">({e.portal})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function CrossTab({ result: r }) {
  const badge = { MATCH: 's-pass', BENIGN_VARIANT: 's-warn', MATERIAL_MISMATCH: 's-fail', INSUFFICIENT_DATA: 's-na' };
  return (
    <Panel title="Cross-Source Reconciliation" sub="The same fact is pulled from every portal that reports it, then diffed. Formatting variants are cleared automatically; only real disagreements reach the officer.">
      <div className="divide-y divide-slate-100">
        {r.cross.map((c) => (
          <div key={c.field} className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-[13px] font-semibold text-slate-900">{c.label}</h4>
              <Chip kind={badge[c.severity]}>{c.severity.replace(/_/g, ' ')}</Chip>
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{c.note}</p>
            <table className="mt-2 w-full">
              <tbody>
                {c.values.map((v) => (
                  <tr key={v.source} className="align-top">
                    <td className="w-32 py-0.5 pr-3 font-mono text-[11px] text-slate-400">{v.source}</td>
                    <td className="py-0.5 font-mono text-[12px] text-slate-800">{v.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function PortalsTab({ result: r, sources }) {
  const [open, setOpen] = useState(null);
  const tone = { VERIFIED: 's-pass', CLEAR: 's-pass', PARTIAL: 's-warn', NOT_FOUND: 's-na', NOT_APPLICABLE: 's-na', NOT_SUBMITTED: 's-fail', EXPIRED: 's-fail', NON_COMPLIANT: 's-fail', LINKED_HIT: 's-fail', ERROR: 's-fail' };
  return (
    <Panel title="Portal Evidence" sub="Raw response from each integrated source, with the reference an auditor would cite.">
      <ul className="divide-y divide-slate-100">
        {sources.map((s) => {
          const p = r.portals[s.key];
          return (
            <li key={s.key}>
              <button onClick={() => setOpen(open === s.key ? null : s.key)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
                <span className="min-w-0 flex-1">
                  <span className="text-[13px] font-semibold text-slate-900">{s.label}</span>
                  <span className="ml-2 font-mono text-[11px] text-slate-400">{p.evidence?.ref ?? s.portal}</span>
                </span>
                {p.mock && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">simulated</span>}
                <Chip kind={tone[p.status] ?? 's-na'}>{p.status.replace(/_/g, ' ')}</Chip>
              </button>
              {open === s.key && (
                <pre className="overflow-x-auto bg-slate-900 px-4 py-3 font-mono text-[11px] leading-relaxed text-slate-100">
{JSON.stringify(p.data, null, 2)}
                </pre>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function AITab({ result: r }) {
  const [rec, setRec] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setRec(null);
    let live = true;
    setLoading(true);
    fetch(`/api/recommend?bidder=${r.bidder.id}`)
      .then((x) => x.json())
      .then((d) => live && setRec(d))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [r.bidder.id]);

  if (loading) return <Panel title="AI Recommendation"><p className="px-4 py-6 text-[13px] text-slate-500">Generating officer briefing…</p></Panel>;
  if (!rec) return null;

  const sev = { HIGH: 's-fail', MEDIUM: 's-warn', LOW: 's-na' };
  const label = { openai: `Generated live · ${rec.model}`, cache: `Cached response · ${rec.model}`, template: 'Deterministic fallback — no model call' }[rec.source];

  return (
    <Panel
      title="AI Recommendation"
      sub="The model explains the rule engine's findings. It cannot change a status, a score or the recommendation."
      right={<span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</span>}
    >
      <div className="space-y-4 px-4 py-4">
        <p className="text-[14px] leading-relaxed text-slate-800">{rec.summary}</p>

        {rec.keyRisks?.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Key Risks</p>
            <ul className="mt-1.5 space-y-1.5">
              {rec.keyRisks.map((k, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Chip kind={sev[k.severity] ?? 's-na'}>{k.severity}</Chip>
                  <span className="min-w-0 flex-1 text-[13px] leading-relaxed text-slate-700">
                    <span className="font-semibold text-slate-900">{k.title}</span> — {k.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {rec.actionsForOfficer?.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Suggested Actions</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-slate-700">
              {rec.actionsForOfficer.map((a, i) => <li key={i}>{a}</li>)}
            </ol>
          </div>
        )}

        {rec.curable && (
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Curability</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-slate-700">{rec.curable}</p>
          </div>
        )}
      </div>
    </Panel>
  );
}

function AuditTab({ result: r, decision }) {
  const rows = [
    ...r.audit,
    ...(decision ? [{ at: decision.at, actor: decision.officer, action: `OFFICER_${decision.decision}`, detail: decision.remark || 'No remark recorded.', ref: null }] : []),
  ];
  return (
    <Panel title="Audit Trail" sub={`${rows.length} events. Every portal query, rule evaluation and decision is recorded with its evidence reference.`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-2 font-semibold">Time</th>
              <th className="px-4 py-2 font-semibold">Actor</th>
              <th className="px-4 py-2 font-semibold">Action</th>
              <th className="px-4 py-2 font-semibold">Detail</th>
              <th className="px-4 py-2 font-semibold">Evidence Ref</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((e, i) => (
              <tr key={i} className="align-top hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-1.5 font-mono text-[11px] text-slate-400">{new Date(e.at).toLocaleTimeString('en-IN', { hour12: false })}</td>
                <td className="whitespace-nowrap px-4 py-1.5 font-mono text-[11px] text-slate-600">{e.actor}</td>
                <td className="whitespace-nowrap px-4 py-1.5 text-[11px] font-semibold text-slate-700">{e.action.replace(/_/g, ' ')}</td>
                <td className="px-4 py-1.5 text-[12px] leading-relaxed text-slate-600">{e.detail}</td>
                <td className="px-4 py-1.5 font-mono text-[10px] text-slate-400">{e.ref ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function ExtractTab({ result: r }) {
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file) => {
    if (!file) return;
    setBusy(true); setOut(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      setOut(await fetch('/api/extract', { method: 'POST', body: fd }).then((x) => x.json()));
    } catch (e) {
      setOut({ error: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Panel title="Documents on Record" sub={`${r.bidder.submittedDocs.length} files submitted with this bid. Fields for seeded bidders come from fixtures so the demo is reproducible.`}>
        <ul className="divide-y divide-slate-100">
          {r.bidder.submittedDocs.map((d) => (
            <li key={d.file} className="flex items-center justify-between gap-3 px-4 py-2">
              <span className="min-w-0">
                <span className="text-[13px] font-medium text-slate-800">{d.type.replace(/_/g, ' ')}</span>
                <span className="ml-2 font-mono text-[11px] text-slate-400">{d.file}</span>
              </span>
              <span className="whitespace-nowrap font-mono text-[11px] text-slate-400">{new Date(d.uploadedAt).toLocaleString('en-IN')}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Live Extraction" sub="Upload an actual certificate image to run it through the model now — this path calls OpenAI for real.">
        <div className="px-4 py-4">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => upload(e.target.files?.[0])}
            className="block w-full text-[13px] text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-white hover:file:bg-slate-700"
          />
          {busy && <p className="mt-3 text-[13px] text-slate-500">Reading document…</p>}
          {out?.error && <p className="s-fail mt-3 rounded px-3 py-2 text-[13px]" style={{ background: 'var(--sb)', color: 'var(--s)' }}>{out.error}</p>}
          {out && !out.error && (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Chip kind="s-pass">{out.documentType?.replace(/_/g, ' ')}</Chip>
                <Chip kind={out.legibility === 'GOOD' ? 's-pass' : out.legibility === 'PARTIAL' ? 's-warn' : 's-fail'}>Legibility {out.legibility}</Chip>
                <span className="font-mono text-[11px] text-slate-400">{out.fileName} · {out.model}</span>
              </div>
              <dl className="grid gap-3 sm:grid-cols-2">
                {Object.entries({ ...(out.identifiers ?? {}), ...(out.fields ?? {}) })
                  .filter(([, v]) => v)
                  .map(([k, v]) => <Field key={k} label={k.replace(/([A-Z])/g, ' $1')} mono>{String(v)}</Field>)}
              </dl>
              {out.observations?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Observations</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] text-slate-700">
                    {out.observations.map((o, i) => <li key={i}>{o}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white">
      <p className="text-[13px] text-slate-400">Run verification, then select a bidder to see the full assessment.</p>
    </div>
  );
}
