import React, { useEffect, useState } from 'react';
import Loading from '../components/Loading';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CheckCircle2, XCircle, FileText, Target } from 'lucide-react';
import { getDataAudit, getRetention, getConcentration, getRecommendation } from '../api';

const inr = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

function Check({ check }) {
  const pass = check.status === 'pass';
  const Icon = pass ? CheckCircle2 : XCircle;
  return (
    <div className={`rounded-2xl border p-5 ${pass ? 'border-emerald-200 bg-emerald-50/50' : 'border-rose-200 bg-rose-50/50'}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={17} className={pass ? 'text-emerald-600' : 'text-rose-600'} />
        <h4 className="font-semibold text-neutral-900">{check.name}</h4>
        <span className={`ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${pass ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {check.status}
        </span>
      </div>
      <dl className="space-y-2.5 text-[13px] leading-relaxed">
        <div><dt className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Observed</dt><dd className="text-neutral-800">{check.observed}</dd></div>
        <div><dt className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Expected</dt><dd className="text-neutral-700">{check.expected}</dd></div>
        <div><dt className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Diagnosis</dt><dd className="text-neutral-700">{check.diagnosis}</dd></div>
        <div><dt className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">So what</dt><dd className="text-neutral-800 font-medium">{check.consequence}</dd></div>
        {check.to_fix && <div><dt className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">To fix</dt><dd className="text-neutral-700">{check.to_fix}</dd></div>}
      </dl>
    </div>
  );
}

function RetentionMatrix({ matrix }) {
  const shade = (pct) => {
    if (pct == null) return 'transparent';
    const a = Math.min(pct / 100, 1);
    return `rgba(239, 77, 35, ${0.08 + a * 0.75})`;
  };
  return (
    <div className="overflow-x-auto">
      <table className="text-[12px] border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="text-left px-2 py-1 font-semibold text-neutral-600 whitespace-nowrap">Cohort</th>
            <th className="text-right px-2 py-1 font-semibold text-neutral-600">Size</th>
            {Array.from({ length: 9 }, (_, i) => (
              <th key={i} className="px-2 py-1 font-semibold text-neutral-600 w-14">M{i}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row) => (
            <tr key={row.cohort}>
              <td className="px-2 py-1 text-neutral-700 whitespace-nowrap font-mono">{row.cohort.slice(0, 7)}</td>
              <td className="px-2 py-1 text-right text-neutral-600 font-mono">{row.size.toLocaleString()}</td>
              {row.retention.map((c) => (
                <td key={c.month} className="px-2 py-1 text-center rounded font-mono text-neutral-900"
                    style={{ background: shade(c.pct) }}>
                  {c.pct ? `${c.pct}%` : '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Analysis() {
  const [audit, setAudit] = useState(null);
  const [retention, setRetention] = useState(null);
  const [conc, setConc] = useState(null);
  const [rec, setRec] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([getDataAudit(), getRetention(), getConcentration(), getRecommendation()])
      .then(([a, r, c, x]) => { setAudit(a); setRetention(r); setConc(c); setRec(x); })
      .catch(() => setError('Could not reach the analysis API.'));
  }, []);

  if (error) return <div className="mx-auto mt-12 max-w-xl rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</div>;
  if (!audit) return <Loading label="Loading the analysis" />;

  const f = rec.finding;

  return (
    <div className="w-full px-4 sm:px-6 md:px-12 max-w-[1100px] mx-auto pt-8 md:pt-12 pb-24 font-body">
      <div className="mb-10">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 backdrop-blur-md px-4 py-1.5 text-xs text-muted-foreground mb-3 shadow-sm">
          <FileText className="w-3.5 h-3.5 text-[#ef4d23]" />
          <span>Written analysis</span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl text-foreground tracking-tight leading-[0.98]">
          Can this dataset answer <span className="font-display italic font-normal text-[#ef4d23]">the question</span>?
        </h1>
        <p className="text-muted-foreground mt-4 text-sm md:text-base max-w-3xl leading-relaxed">
          "How is our retention trending?" is the question a growth lead actually asks. Before answering
          it, the dataset has to be able to answer it. Three checks were run. Two of them failed — and
          the failures are the finding.
        </p>
      </div>

      {/* Audit */}
      <section className="mb-12">
        <h2 className="font-display text-3xl text-foreground mb-1">Data-quality audit</h2>
        <p className="text-[13px] text-muted-foreground mb-5">Run against the live database, not a fixture.</p>
        <div className="grid gap-4 lg:grid-cols-3">
          {audit.checks.map((c) => <Check key={c.name} check={c} />)}
        </div>
        <div className="mt-5 rounded-2xl border-l-4 border-[#ef4d23] bg-neutral-50 px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">Verdict</p>
          <p className="text-[14px] text-neutral-800 leading-relaxed">{audit.verdict}</p>
        </div>
      </section>

      {/* Retention */}
      <section className="mb-12">
        <h2 className="font-display text-3xl text-foreground mb-1">The retention matrix</h2>
        <p className="text-[13px] text-muted-foreground mb-4 max-w-3xl leading-relaxed">
          The query is correct and the matrix renders cleanly — which is exactly why this is worth
          showing. A stakeholder handed this chart would read a healthy flat retention curve. It is an
          artifact of how the data was generated. Read across any row: no decay.
        </p>
        <div className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur-md p-5 md:p-6 shadow-sm">
          <RetentionMatrix matrix={retention.matrix} />
          <p className="mt-4 text-[11px] text-neutral-500">{retention.served_from}</p>
          <details className="mt-3">
            <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-neutral-500 hover:text-neutral-800">SQL</summary>
            <pre className="mt-2 bg-[#0d1117] text-[#c9d1d9] rounded-xl p-4 text-[11px] font-mono overflow-x-auto whitespace-pre">{retention.sql}</pre>
          </details>
        </div>
      </section>

      {/* Concentration */}
      <section className="mb-12">
        <h2 className="font-display text-3xl text-foreground mb-1">What the data <span className="italic font-normal">can</span> support</h2>
        <p className="text-[13px] text-muted-foreground mb-4 max-w-3xl leading-relaxed">
          Revenue concentration passed the audit — it emerges from the basket-size distribution rather
          than being imposed. So segment-value work built on it is sound.
        </p>
        <div className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur-md p-5 md:p-6 shadow-sm">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={conc.deciles} margin={{ top: 10, right: 16, bottom: 5, left: 4 }}>
                <CartesianGrid stroke="rgba(0,0,0,0.05)" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="decile" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }}
                       label={{ value: 'Customer spend decile (1 = highest)', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#6b7280' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 12 }}
                  formatter={(v, n) => [n === 'pct_of_revenue' ? `${v}% of revenue` : v, '']} />
                <Bar dataKey="pct_of_revenue" fill="#ef4d23" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-[13px] text-neutral-700">
            Top decile: <strong>{conc.deciles[0].pct_of_revenue}%</strong> of revenue ·
            top three deciles: <strong>{conc.deciles[2].cumulative_pct}%</strong>
          </p>
        </div>
      </section>

      {/* Recommendation */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Target size={20} className="text-[#ef4d23]" />
          <h2 className="font-display text-3xl text-foreground">The recommendation</h2>
        </div>
        <p className="text-[13px] text-muted-foreground mb-4">{rec.question}</p>
        <div className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur-md p-6 md:p-8 shadow-sm">
          <h3 className="font-display text-2xl text-neutral-900 mb-4">{rec.title}</h3>
          <div className="grid gap-4 sm:grid-cols-3 mb-5">
            <div className="rounded-2xl bg-neutral-50 border border-neutral-200 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Customers in segment</p>
              <p className="mt-1 font-display text-3xl text-neutral-900">{f.customers.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl bg-neutral-50 border border-neutral-200 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Avg spend (vs {inr(f.baseline_avg_spend)} baseline)</p>
              <p className="mt-1 font-display text-3xl text-neutral-900">{inr(f.avg_spend)}</p>
            </div>
            <div className="rounded-2xl bg-neutral-50 border border-neutral-200 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Historical spend at stake</p>
              <p className="mt-1 font-display text-3xl text-neutral-900">{inr(f.historical_spend)}</p>
            </div>
          </div>
          <dl className="space-y-3 text-[14px] leading-relaxed">
            <div><dt className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Reasoning</dt><dd className="text-neutral-800">{rec.reasoning}</dd></div>
            <div><dt className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Action</dt><dd className="text-neutral-800">{rec.action}</dd></div>
            <div><dt className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">How to measure it</dt><dd className="text-neutral-800">{rec.how_to_measure}</dd></div>
          </dl>
          <div className="mt-5 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3">
            <p className="text-[13px] text-amber-900 leading-relaxed">
              <strong className="font-semibold">What I don't know: </strong>{rec.caveat}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
