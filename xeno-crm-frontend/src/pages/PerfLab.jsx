import React, { useEffect, useState } from 'react';
import Loader from '../components/Loader';
import Loading from '../components/Loading';
import { Database, Play, Zap, AlertTriangle, ShieldCheck, ChevronDown } from 'lucide-react';
import { getPerfCases, runPerfCase, runSafeQuery } from '../api';

const fmtMs = (ms) =>
  ms == null ? '—' : ms < 1 ? `${ms.toFixed(2)} ms` : ms < 1000 ? `${ms.toFixed(1)} ms` : `${(ms / 1000).toFixed(2)} s`;

function Sql({ children }) {
  return (
    <pre className="bg-[#0d1117] text-[#c9d1d9] rounded-xl p-4 text-[12px] leading-relaxed font-mono overflow-x-auto whitespace-pre">
      {children}
    </pre>
  );
}

function Plan({ lines }) {
  if (!lines?.length) return null;
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-neutral-500 hover:text-neutral-800">
        PostgreSQL plan
      </summary>
      <pre className="mt-2 bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-[11px] font-mono overflow-x-auto text-neutral-700 whitespace-pre">
        {lines.join('\n')}
      </pre>
    </details>
  );
}

function Side({ label, sql, result, tone }) {
  const accent = tone === 'good' ? 'text-emerald-700' : 'text-rose-700';
  const ring = tone === 'good' ? 'border-emerald-200 bg-emerald-50/40' : 'border-rose-200 bg-rose-50/40';
  return (
    <div className={`rounded-2xl border ${ring} p-4 flex flex-col gap-3`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">{label}</span>
        {result && (
          <span className={`font-display text-2xl ${accent}`}>{fmtMs(result.execution_ms)}</span>
        )}
      </div>
      <Sql>{sql}</Sql>
      {result && (
        <div className="text-[11px] text-neutral-600 flex flex-wrap gap-x-4 gap-y-1">
          <span>rows returned: <strong>{(result.rows_returned ?? 0).toLocaleString()}</strong></span>
          {result.planning_ms != null && <span>planning: {fmtMs(result.planning_ms)}</span>}
        </div>
      )}
      {result && <Plan lines={result.plan} />}
    </div>
  );
}

function Case({ study, dataset }) {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [open, setOpen] = useState(false);

  const run = async () => {
    setBusy(true); setErr(null);
    try { setResult(await runPerfCase(study.id)); setOpen(true); }
    catch (e) { setErr(e.response?.data?.detail || e.message); }
    finally { setBusy(false); }
  };

  const headline = result?.speedup
    ? `${result.speedup.toLocaleString()}× faster`
    : result?.transfer_reduction
      ? `${result.transfer_reduction.toLocaleString()}× fewer rows`
      : null;

  return (
    <section className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur-md p-6 md:p-8 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-[260px]">
          <h3 className="font-display text-2xl text-neutral-900">{study.title}</h3>
          <p className="mt-2 text-sm text-neutral-600 leading-relaxed">{study.question}</p>
        </div>
        <div className="flex items-center gap-3">
          {headline && (
            <span className="rounded-full bg-emerald-600 text-white px-3 py-1.5 text-xs font-bold whitespace-nowrap">
              {headline}
            </span>
          )}
          <button
            onClick={run}
            disabled={busy}
            className="bg-[#ef4d23] hover:bg-[#d9421b] disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
          >
            {busy
              ? <Loader size="sm" onDark className="!w-8" label="Running" />
              : <Play size={13} fill="currentColor" />}
            {busy ? 'Running…' : result ? 'Re-run' : 'Run both'}
          </button>
        </div>
      </div>

      {err && <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800">{err}</div>}

      {(open || result) && (
        <div className="grid gap-4 lg:grid-cols-2 mb-5">
          <Side label={study.naive_label} sql={study.naive_sql} result={result?.naive} tone="bad" />
          <Side label={study.optimized_label} sql={result?.optimized?.sql_executed || study.optimized_sql} result={result?.optimized} tone="good" />
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">Why it's slow</p>
          <p className="text-[13px] text-neutral-700 leading-relaxed">{study.diagnosis}</p>
        </div>
        <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">The fix</p>
          <p className="text-[13px] text-neutral-700 leading-relaxed">{study.fix}</p>
        </div>
      </div>

      {study.caveat && (
        <div className="mt-3 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 flex gap-2.5">
          <AlertTriangle size={15} className="text-amber-700 shrink-0 mt-0.5" />
          <p className="text-[13px] text-amber-900 leading-relaxed">
            <strong className="font-semibold">Trade-off: </strong>{study.caveat}
          </p>
        </div>
      )}
    </section>
  );
}

function Console() {
  const [q, setQ] = useState('SELECT city, count(*) AS customers, avg(total_spent)::numeric(12,0) AS avg_spend\nFROM customers\nGROUP BY city\nORDER BY customers DESC');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true); setErr(null); setRes(null);
    try { setRes(await runSafeQuery(q)); }
    catch (e) { setErr(e.response?.data?.detail || e.message); }
    finally { setBusy(false); }
  };

  return (
    <section className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur-md p-6 md:p-8 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="font-display text-2xl text-neutral-900">Run your own query</h3>
          <p className="mt-2 text-sm text-neutral-600 max-w-2xl leading-relaxed">
            Against the live dataset. Read-only, and not because a regex says so —
            the connected Postgres role has been granted <code className="text-[12px] bg-neutral-100 px-1 rounded">SELECT</code> and
            nothing else, with a 4-second statement timeout set on the role itself.
          </p>
        </div>
        <button
          onClick={run}
          disabled={busy}
          className="bg-[#ef4d23] hover:bg-[#d9421b] disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2"
        >
          {busy ? <Loader size="sm" onDark className="!w-8" label="Running" /> : <Play size={13} fill="currentColor" />}
          Run
        </button>
      </div>

      <textarea
        value={q}
        onChange={(e) => setQ(e.target.value)}
        spellCheck={false}
        className="w-full h-40 p-4 rounded-xl font-mono text-[13px] bg-[#0d1117] text-[#c9d1d9] focus:outline-none focus:ring-2 focus:ring-[#ef4d23]/40 resize-y"
      />

      <div className="mt-3 flex items-start gap-2 text-[12px] text-neutral-500">
        <ShieldCheck size={14} className="shrink-0 mt-0.5 text-emerald-600" />
        <span>
          Blocked here: writes, multiple statements, system catalogs, filesystem functions and{' '}
          <code className="bg-neutral-100 px-1 rounded">pg_sleep</code>. A statement that slips past the
          text checks — <code className="bg-neutral-100 px-1 rounded">WITH x AS (DELETE …)</code>, for instance —
          is still refused by the database role.
        </span>
      </div>

      {err && <div className="mt-4 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800 font-mono">{err}</div>}

      {res && (
        <div className="mt-4">
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-neutral-600 mb-3">
            <span>execution: <strong>{fmtMs(res.execution_ms)}</strong></span>
            <span>planning: {fmtMs(res.planning_ms)}</span>
            <span>rows: <strong>{res.row_count}</strong>{res.truncated && ' (capped at 200)'}</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full text-[13px]">
              <thead className="bg-neutral-50">
                <tr>{res.columns.map((c) => (
                  <th key={c} className="text-left px-3 py-2 font-semibold text-neutral-700 whitespace-nowrap">{c}</th>
                ))}</tr>
              </thead>
              <tbody>
                {res.rows.map((r, i) => (
                  <tr key={i} className="border-t border-neutral-100">
                    {res.columns.map((c) => (
                      <td key={c} className="px-3 py-2 text-neutral-700 whitespace-nowrap">
                        {r[c] === null ? <span className="text-neutral-400 italic">null</span> : String(r[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Plan lines={res.plan} />
        </div>
      )}
    </section>
  );
}

export default function PerfLab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getPerfCases().then(setData).catch(() => setError('Could not reach the performance API.'));
  }, []);

  if (error) return <div className="mx-auto mt-12 max-w-xl rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</div>;
  if (!data) return <Loading label="Loading the performance lab" />;

  return (
    <div className="w-full px-4 sm:px-6 md:px-12 max-w-[1200px] mx-auto pt-8 md:pt-12 pb-24 font-body">
      <div className="mb-8">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 backdrop-blur-md px-4 py-1.5 text-xs text-muted-foreground mb-3 shadow-sm">
          <Database className="w-3.5 h-3.5 text-[#ef4d23]" />
          <span>
            {Number(data.dataset.customers).toLocaleString()} customers ·{' '}
            {Number(data.dataset.orders).toLocaleString()} orders · {data.dataset.db_size}
          </span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl text-foreground tracking-tight leading-[0.98]">
          Query <span className="font-display italic font-normal text-[#ef4d23]">Performance</span> Lab
        </h1>
        <p className="text-muted-foreground mt-3 text-sm md:text-base max-w-3xl leading-relaxed">
          Six queries that were fine on a few thousand rows and stopped being fine at{' '}
          {Number(data.dataset.orders).toLocaleString()}. Each one runs live, both ways, and reports
          PostgreSQL's own execution time rather than wall clock — so the numbers measure the database,
          not the round trip to it. Every "before" here is a pattern that was genuinely in this codebase
          before the dataset grew.
        </p>
      </div>

      <div className="mb-8 rounded-2xl border border-neutral-300/60 bg-neutral-50/80 px-5 py-4 flex gap-3">
        <Zap size={16} className="text-[#ef4d23] shrink-0 mt-0.5" />
        <p className="text-[13px] text-neutral-700 leading-relaxed">
          <strong className="font-semibold">Read the trade-offs, not just the multipliers.</strong>{' '}
          One case below makes the query <em>slower</em> in milliseconds and is still the right call.
          Another is a five-figure win where both sides use the identical index. A speedup number
          without its caveat is marketing, not analysis.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {data.cases.map((c) => <Case key={c.id} study={c} dataset={data.dataset} />)}
        <Console />
      </div>
    </div>
  );
}
