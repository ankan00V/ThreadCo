import React, { useEffect, useState } from 'react';
import Loading from '../components/Loading';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CheckCircle2, XCircle, FileText, Target } from 'lucide-react';
import { Volume2 } from 'lucide-react';
import {
  getDataAudit, getRetention, getConcentration, getRecommendation,
  getAnalysisBriefing, analysisBriefingAudioUrl,
} from '../api';

const inr = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

function Check({ check }) {
  const pass = check.status === 'pass';
  const Icon = pass ? CheckCircle2 : XCircle;
  // Only rows that have content. A label over nothing reads as a broken page.
  const rows = [
    ['Observed', check.observed, 'text-neutral-800'],
    ['Threshold', check.threshold, 'text-neutral-700'],
    ['Why it matters', check.why_it_matters, 'text-neutral-800 font-medium'],
  ].filter(([, value]) => value);
  return (
    <div className={`rounded-2xl border p-5 ${pass ? 'border-emerald-200 bg-emerald-50/60' : 'border-rose-200 bg-rose-50/60'}`}>
      <div className="flex items-start gap-2 mb-3">
        <Icon size={17} className={`shrink-0 mt-0.5 ${pass ? 'text-emerald-600' : 'text-rose-600'}`} />
        <h4 className="font-semibold text-neutral-900 leading-snug">{check.name}</h4>
        <span className={`ml-auto shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${pass ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {check.status}
        </span>
      </div>
      <dl className="space-y-2.5 text-[13px] leading-relaxed">
        {rows.map(([label, value, tone]) => (
          <div key={label}>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">{label}</dt>
            <dd className={tone}>{value}</dd>
          </div>
        ))}
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
  const [briefing, setBriefing] = useState(null);

  useEffect(() => {
    Promise.all([getDataAudit(), getRetention(), getConcentration(), getRecommendation()])
      .then(([a, r, c, x]) => { setAudit(a); setRetention(r); setConc(c); setRec(x); })
      .then(() => getAnalysisBriefing().then(setBriefing).catch(() => {}))
      .catch(() => setError('Could not reach the analysis API.'));
  }, []);

  if (error) return <div className="mx-auto mt-12 max-w-xl rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</div>;
  if (!audit) return <Loading label="Loading the analysis" />;

  const f = rec.finding;
  const retentionPasses = audit.checks.some(
    (c) => c.name.toLowerCase().includes('decay') && c.status === 'pass'
  );

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
          it, the dataset has to be able to answer it. {audit.total} checks run against it and{' '}
          {audit.passing} of {audit.total} pass today{audit.provenance ? (
            <> — but the first time they ran, two failed, and that is the more useful story. It is below.</>
          ) : '.'}
        </p>
      </div>

      {briefing?.audio_available && (
        <div className="mb-10 rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur-md p-5">
          <div className="flex items-center gap-2 mb-2">
            <Volume2 size={16} className="text-[#ef4d23]" />
            <span className="text-[13px] font-semibold text-neutral-900">Listen to this analysis</span>
            <span className="text-[11px] text-neutral-500">· 60 seconds</span>
          </div>
          <audio controls preload="none" src={analysisBriefingAudioUrl()} className="w-full h-9" />
          {briefing.script && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[11px] uppercase tracking-wider text-neutral-500">Transcript</summary>
              <p className="mt-1.5 text-[12.5px] text-neutral-700 leading-relaxed">{briefing.script}</p>
            </details>
          )}
        </div>
      )}

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

        {audit.provenance && (
          <div className="mt-5 rounded-3xl border border-neutral-200 bg-white/80 backdrop-blur-md p-6 md:p-7 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#ef4d23] mb-2">Why these checks exist</p>
            <h3 className="font-display text-2xl text-neutral-900 mb-4">{audit.provenance.headline}</h3>
            <dl className="grid gap-5 md:grid-cols-2 text-[13.5px] leading-relaxed">
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1">What failed</dt>
                <dd className="text-neutral-800">{audit.provenance.detail}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1">What changed</dt>
                <dd className="text-neutral-800">{audit.provenance.fix}</dd>
              </div>
            </dl>
            {audit.provenance.caveat && (
              <p className="mt-5 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 leading-relaxed">
                <strong className="font-semibold">Read this with care: </strong>{audit.provenance.caveat}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Retention */}
      <section className="mb-12">
        <h2 className="font-display text-3xl text-foreground mb-1">The retention matrix</h2>
        <p className="text-[13px] text-muted-foreground mb-4 max-w-3xl leading-relaxed">
          {retentionPasses ? (
            <>Read across any row: each cohort loses a large share of its customers after the first
            month, then flattens into a loyal tail. That is what real retail looks like — and it is the
            shape this dataset did <em>not</em> have the first time this query ran, when every row sat
            flat at the same rate. A flat matrix renders just as cleanly as this one, which is why the
            shape has to be checked rather than trusted.</>
          ) : (
            <>Read across any row: there is no decay. A stakeholder handed this chart would read a
            healthy, stable retention curve. It is an artifact of how the data was generated, and no
            lifecycle conclusion drawn from it is safe.</>
          )}
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
        <h2 className="font-display text-3xl text-foreground mb-1">Where the revenue <span className="italic font-normal">sits</span></h2>
        <p className="text-[13px] text-muted-foreground mb-4 max-w-3xl leading-relaxed">
          The top tenth of customers by spend account for {conc.deciles[0].pct_of_revenue}% of revenue,
          and the top three tenths for {conc.deciles[2].cumulative_pct}%. That concentration is what makes
          targeting worth doing: if value were spread evenly, a segment would buy nothing over a blast.
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
          {rec.lapse_window && (
            <div className="mb-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">Lapse window — derived, not assumed</p>
              <p className="text-[13.5px] text-neutral-800 leading-relaxed">
                <strong className="font-display text-2xl text-neutral-900 mr-1">{rec.lapse_window.days} days</strong>
                — {rec.lapse_window.method}, across {rec.lapse_window.gaps_measured.toLocaleString()} repeat
                purchases. The median gap is {rec.lapse_window.median_gap_days} days.
              </p>
            </div>
          )}
          <dl className="space-y-3 text-[14px] leading-relaxed">
            <div><dt className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Reasoning</dt><dd className="text-neutral-800">{rec.reasoning}</dd></div>
            <div><dt className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Action</dt><dd className="text-neutral-800">{rec.action}</dd></div>
            <div><dt className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">How to measure it</dt><dd className="text-neutral-800">{rec.how_to_measure}</dd></div>
          </dl>
          <div className="mt-5 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3">
            <p className="text-[13px] text-amber-900 leading-relaxed">
              <strong className="font-semibold">The judgement calls inside this: </strong>{rec.caveat}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
