import React, { useEffect, useState } from 'react';
import { Play, Trophy, AlertTriangle } from 'lucide-react';
import Loader from './Loader';
import { getChallenges, attemptChallenge } from '../api';

const fmtMs = (ms) =>
  ms == null ? '—' : ms < 1 ? `${ms.toFixed(2)} ms` : ms < 1000 ? `${ms.toFixed(1)} ms` : `${(ms / 1000).toFixed(2)} s`;

function ChallengeCard({ challenge }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const submit = async () => {
    setBusy(true); setErr(null); setResult(null);
    try { setResult(await attemptChallenge(challenge.id, query)); }
    catch (e) { setErr(e.response?.data?.detail || e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="min-w-[240px] flex-1">
          <h4 className="font-display text-lg text-neutral-900">{challenge.title}</h4>
          <p className="mt-1 text-[13px] text-neutral-600 leading-relaxed">{challenge.task}</p>
          {challenge.pass_speedup && (
            <p className="mt-1.5 text-[11px] text-neutral-500">
              Target: <strong>{challenge.pass_speedup}×</strong> faster, same rows returned.
            </p>
          )}
        </div>
        {result?.passed && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white">
            <Trophy size={12} /> {result.speedup}× faster
          </span>
        )}
      </div>

      {challenge.context && (
        <div className="mb-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
          <p className="text-[9.5px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
            {challenge.context_label || 'Given'}
          </p>
          {Object.entries(challenge.context).map(([k, v]) => (
            <div key={k} className="font-mono text-[11px] text-neutral-700 break-all">
              <span className="text-neutral-400">{k} = </span>{v}
            </div>
          ))}
        </div>
      )}

      <details className="mb-3">
        <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-neutral-500 hover:text-neutral-800">
          The slow version
        </summary>
        <pre className="mt-2 bg-[#0d1117] text-[#c9d1d9] rounded-lg p-3 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap">
          {challenge.slow_sql}
        </pre>
      </details>

      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        spellCheck={false}
        placeholder="Write a faster query that returns the same rows…"
        className="w-full h-28 p-3 rounded-lg font-mono text-[12.5px] bg-[#0d1117] text-[#c9d1d9] placeholder-[#6e7681] focus:outline-none focus:ring-2 focus:ring-[#ef4d23]/40 resize-y"
      />

      <div className="mt-2.5 flex flex-wrap items-center gap-3">
        <button
          onClick={submit}
          disabled={busy || !query.trim()}
          className="bg-[#ef4d23] hover:bg-[#d9421b] disabled:opacity-40 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
        >
          {busy ? <Loader size="sm" onDark className="!w-8" label="Running" /> : <Play size={13} fill="currentColor" />}
          Submit
        </button>
        <button onClick={() => setShowHint(!showHint)} className="text-[12px] text-neutral-500 hover:text-[#ef4d23] transition-colors">
          {showHint ? 'Hide hint' : 'Need a hint?'}
        </button>
      </div>

      {showHint && (
        <p className="mt-2.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12.5px] text-amber-900">
          {challenge.hint}
        </p>
      )}

      {err && (
        <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[12.5px] text-rose-800 font-mono">
          {err}
        </div>
      )}

      {result && (
        <div className={`mt-3 rounded-xl border px-4 py-3 ${result.passed ? 'border-emerald-200 bg-emerald-50' : 'border-neutral-200 bg-neutral-50'}`}>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[12.5px] mb-1.5">
            <span>yours: <strong className="tabular-nums">{fmtMs(result.your_ms)}</strong></span>
            <span>reference: <strong className="tabular-nums">{fmtMs(result.reference_ms)}</strong></span>
            {result.speedup && <span>speedup: <strong>{result.speedup}×</strong></span>}
          </div>
          <p className="text-[12.5px] text-neutral-800 flex items-start gap-1.5">
            {!result.returns_same_row_count && <AlertTriangle size={13} className="shrink-0 mt-0.5 text-amber-600" />}
            {result.verdict}
          </p>
        </div>
      )}
    </div>
  );
}

export default function Challenges() {
  const [data, setData] = useState(null);
  useEffect(() => { getChallenges().then(setData).catch(() => {}); }, []);

  if (!data) return <Loader label="Loading challenges" />;

  return (
    <div className="space-y-4">
      {data.challenges.map((c) => <ChallengeCard key={c.id} challenge={c} />)}
    </div>
  );
}
