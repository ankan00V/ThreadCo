import React, { useRef, useState } from 'react';
import { Upload, Volume2, Trash2, CheckCircle2, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import Loader from '../components/Loader';
import {
  previewDataset, createDataset, getDatasetAnalysis, getBriefing, briefingAudioUrl, deleteDataset,
} from '../api';

const inr = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const FIELDS = [
  { key: 'customer_id', label: 'Customer', required: true, help: 'Email or customer ID — how repeat buyers are identified.' },
  { key: 'order_date', label: 'Order date', required: true, help: 'When the order was placed or paid.' },
  { key: 'amount', label: 'Order value', required: true, help: 'Order total. Currency symbols and commas are handled.' },
  { key: 'status', label: 'Status', required: false, help: 'Optional. Without it, refunds count as revenue.' },
];

const SEGMENT_TONE = {
  Champions: 'bg-emerald-500', Loyal: 'bg-emerald-400', 'Potential Loyalist': 'bg-teal-400',
  'New Customers': 'bg-sky-400', Promising: 'bg-sky-300', 'Need Attention': 'bg-amber-400',
  'At Risk': 'bg-orange-500', 'Cannot Lose Them': 'bg-rose-500',
  Hibernating: 'bg-neutral-400', Lost: 'bg-neutral-300',
};

export default function YourData() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [datasetId, setDatasetId] = useState(null);
  const [script, setScript] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef();

  const reset = () => {
    setFile(null); setPreview(null); setMapping(null);
    setAnalysis(null); setDatasetId(null); setScript(null); setError(null);
  };

  const onPick = async (picked) => {
    if (!picked) return;
    reset(); setFile(picked); setBusy('preview'); setError(null);

    const looksTabular = /\.(csv|tsv|txt)$/i.test(picked.name);
    try {
      if (!looksTabular) {
        // Not a hard block: the server decides. This just sets expectations.
        setError(`"${picked.name}" is not a .csv — trying to read it anyway. Export as CSV if this fails.`);
      }
      const p = await previewDataset(picked);
      setPreview(p);
      setMapping({ ...p.detected });
      setError(null);   // it parsed, so the extension warning no longer applies
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally { setBusy(null); }
  };

  const analyse = async () => {
    setBusy('analyse'); setError(null);
    try {
      const created = await createDataset(file, mapping);
      setDatasetId(created.dataset_id);
      const a = await getDatasetAnalysis(created.dataset_id);
      setAnalysis(a);
      getBriefing(created.dataset_id).then(setScript).catch(() => {});
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally { setBusy(null); }
  };

  const remove = async () => {
    if (!datasetId) return;
    try { await deleteDataset(datasetId); } catch { /* already gone */ }
    reset();
  };

  const ready = mapping && FIELDS.filter((f) => f.required).every((f) => mapping[f.key]);

  return (
    <div className="w-full px-4 sm:px-6 md:px-12 max-w-[1100px] mx-auto pt-8 md:pt-12 pb-24 font-body">
      <div className="mb-8">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 backdrop-blur-md px-4 py-1.5 text-xs text-muted-foreground mb-3 shadow-sm">
          <FileSpreadsheet className="w-3.5 h-3.5 text-[#ef4d23]" />
          <span>Your data</span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl text-foreground tracking-tight leading-[0.98]">
          Upload your orders. <span className="italic font-normal text-[#ef4d23]">Get the answer.</span>
        </h1>
        <p className="text-muted-foreground mt-3 text-sm md:text-base max-w-2xl leading-relaxed">
          Export orders from Shopify, WooCommerce or a spreadsheet and drop the CSV here. You get RFM
          segments, cohort retention, and an honest read on what your export can and cannot support —
          with the SQL that produced it. Deleted automatically after 24 hours.
        </p>
      </div>

      {/* Step 1 — file */}
      {!preview && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); onPick(e.dataTransfer.files?.[0]); }}
          className="rounded-3xl border-2 border-dashed border-neutral-300 bg-white/60 backdrop-blur-md p-12 text-center"
        >
          <Upload className="mx-auto mb-3 text-neutral-400" size={28} />
          <p className="text-sm text-neutral-700 mb-4">Drop a CSV here, or choose a file.</p>
          <input ref={inputRef} type="file" className="hidden"
                 onChange={(e) => onPick(e.target.files?.[0])} />
          <button onClick={() => inputRef.current?.click()}
                  className="bg-[#ef4d23] hover:bg-[#d9421b] text-white px-5 py-2.5 rounded-xl text-sm font-medium">
            Choose CSV
          </button>
          <p className="mt-4 text-[11px] text-neutral-500">
            Up to 50,000 rows · 8 MB · nothing is stored until you confirm the columns
          </p>
          {busy === 'preview' && <div className="mt-5 flex justify-center"><Loader label="Reading file" /></div>}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800">
          {error}
        </div>
      )}

      {/* Step 2 — mapping */}
      {preview && !analysis && (
        <section className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur-md p-6 md:p-8 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-3 mb-1">
            <h3 className="font-display text-2xl text-neutral-900">Confirm the columns</h3>
            <button onClick={reset} className="text-[12px] text-neutral-500 hover:text-[#ef4d23]">Use a different file</button>
          </div>
          <p className="text-[13px] text-neutral-600 mb-5">
            Detected from <span className="font-mono">{preview.filename}</span>. Every export names these
            differently, so check them — a wrong guess here would produce a confidently wrong analysis.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 mb-6">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-neutral-800 mb-1">
                  {f.label} {f.required ? <span className="text-[#ef4d23]">*</span> : <span className="text-neutral-400">(optional)</span>}
                </label>
                <select
                  value={mapping?.[f.key] || ''}
                  onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value || null })}
                  className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl text-[13px] focus:outline-none focus:ring-1 focus:ring-[#ef4d23]"
                >
                  <option value="">— not mapped —</option>
                  {preview.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                <p className="mt-1 text-[11px] text-neutral-500">{f.help}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-neutral-200 mb-6">
            <table className="w-full text-[12px]">
              <thead className="bg-neutral-50">
                <tr>{preview.headers.map((h) => (
                  <th key={h} className="text-left px-3 py-2 font-semibold text-neutral-700 whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {preview.preview.map((row, i) => (
                  <tr key={i} className="border-t border-neutral-100">
                    {preview.headers.map((h) => (
                      <td key={h} className="px-3 py-1.5 text-neutral-600 whitespace-nowrap">{row[h]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={analyse} disabled={!ready || busy}
                  className="bg-[#ef4d23] hover:bg-[#d9421b] disabled:opacity-40 text-white px-6 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
            {busy === 'analyse' ? <Loader size="sm" onDark className="!w-8" label="Analysing" /> : null}
            {busy === 'analyse' ? 'Analysing…' : 'Analyse my data'}
          </button>
        </section>
      )}

      {/* Step 3 — results */}
      {analysis && (
        <div className="space-y-6">
          <section className="rounded-3xl border-l-4 border-[#ef4d23] bg-white/80 backdrop-blur-md p-6 md:p-8 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-2">The number to act on</p>
            <p className="font-display text-3xl md:text-4xl text-neutral-900 leading-tight">
              {analysis.headline.at_risk_customers.toLocaleString()} customers are slipping away,
              holding {inr(analysis.headline.at_risk_revenue)}
            </p>
            <p className="mt-2 text-sm text-neutral-600">
              That is {analysis.headline.at_risk_pct_of_revenue}% of your revenue, sitting in the
              At Risk, Cannot Lose Them and Need Attention segments.
            </p>

            {script?.audio_available && (
              <div className="mt-5 rounded-2xl bg-neutral-50 border border-neutral-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Volume2 size={15} className="text-[#ef4d23]" />
                  <span className="text-[12px] font-semibold text-neutral-800">Hear the briefing</span>
                </div>
                <audio controls preload="none" src={briefingAudioUrl(datasetId)} className="w-full h-9" />
                {script?.script && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] uppercase tracking-wider text-neutral-500">Transcript</summary>
                    <p className="mt-1.5 text-[12.5px] text-neutral-700 leading-relaxed">{script.script}</p>
                  </details>
                )}
              </div>
            )}
          </section>

          {/* Data quality first, on purpose */}
          <section className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur-md p-6 md:p-8 shadow-sm">
            <h3 className="font-display text-2xl text-neutral-900 mb-1">Can your export support this?</h3>
            <p className="text-[13px] text-neutral-600 mb-4">
              Checked before the conclusions, not after. {analysis.quality.passing} of {analysis.quality.total} passing.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {analysis.quality.checks.map((c) => (
                <div key={c.name} className={`rounded-xl border p-4 ${c.status === 'pass' ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/60'}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    {c.status === 'pass'
                      ? <CheckCircle2 size={15} className="text-emerald-600" />
                      : <AlertTriangle size={15} className="text-amber-600" />}
                    <h4 className="text-[13px] font-semibold text-neutral-900">{c.name}</h4>
                  </div>
                  <p className="text-[12.5px] text-neutral-700 leading-relaxed">{c.detail}</p>
                  <p className="mt-1.5 text-[12.5px] text-neutral-800 font-medium leading-relaxed">{c.consequence}</p>
                </div>
              ))}
            </div>
          </section>

          {/* RFM */}
          <section className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur-md p-6 md:p-8 shadow-sm">
            <h3 className="font-display text-2xl text-neutral-900 mb-1">Your customers, segmented</h3>
            <p className="text-[13px] text-neutral-600 mb-5">
              RFM: recency, frequency and monetary value scored into quintiles, then bucketed into the
              standard segments — so the names mean the same thing they mean everywhere else.
            </p>
            <div className="space-y-2">
              {analysis.segments.map((s) => (
                <div key={s.segment} className="rounded-xl border border-neutral-200 bg-white p-4">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${SEGMENT_TONE[s.segment] || 'bg-neutral-300'}`} />
                    <span className="font-semibold text-[14px] text-neutral-900">{s.segment}</span>
                    <span className="text-[12px] text-neutral-500">{s.customers.toLocaleString()} customers</span>
                    <span className="ml-auto text-[13px] font-medium tabular-nums text-neutral-900">{inr(s.revenue)}</span>
                    <span className="text-[12px] text-neutral-500 tabular-nums w-12 text-right">{s.pct_of_revenue}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden mb-2">
                    <div className={`h-full ${SEGMENT_TONE[s.segment] || 'bg-neutral-300'}`} style={{ width: `${s.pct_of_revenue}%` }} />
                  </div>
                  <p className="text-[12.5px] text-neutral-600 leading-relaxed">{s.action}</p>
                  <p className="mt-1 text-[11px] text-neutral-400">
                    avg {inr(s.avg_value)} · {s.avg_orders} orders · last seen {Math.round(s.avg_recency_days)} days ago
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Cohorts */}
          {analysis.cohorts.length > 0 && (
            <section className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur-md p-6 md:p-8 shadow-sm">
              <h3 className="font-display text-2xl text-neutral-900 mb-1">Retention by cohort</h3>
              <p className="text-[13px] text-neutral-600 mb-4">
                Each row is customers who first bought that month. Read across to see how many came back.
              </p>
              <div className="overflow-x-auto">
                <table className="text-[12px] border-separate border-spacing-1">
                  <thead>
                    <tr>
                      <th className="text-left px-2 py-1 font-semibold text-neutral-600">Cohort</th>
                      <th className="text-right px-2 py-1 font-semibold text-neutral-600">Size</th>
                      {Array.from({ length: 7 }, (_, i) => <th key={i} className="px-2 py-1 font-semibold text-neutral-600 w-14">M{i}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.cohorts.map((row) => (
                      <tr key={row.cohort}>
                        <td className="px-2 py-1 font-mono text-neutral-700 whitespace-nowrap">{row.cohort.slice(0, 7)}</td>
                        <td className="px-2 py-1 text-right font-mono text-neutral-600">{row.size.toLocaleString()}</td>
                        {row.retention.slice(0, 7).map((c) => (
                          <td key={c.month} className="px-2 py-1 text-center rounded font-mono text-neutral-900"
                              style={{ background: c.pct ? `rgba(239,77,35,${0.08 + Math.min(c.pct / 100, 1) * 0.7})` : 'transparent' }}>
                            {c.pct ? `${c.pct}%` : '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur-md p-6 md:p-8 shadow-sm">
            <h3 className="font-display text-2xl text-neutral-900 mb-3">The SQL behind it</h3>
            <details>
              <summary className="cursor-pointer text-[12px] font-semibold uppercase tracking-wider text-neutral-500 hover:text-neutral-800">RFM segmentation</summary>
              <pre className="mt-2 bg-[#0d1117] text-[#c9d1d9] rounded-xl p-4 text-[11px] font-mono overflow-x-auto whitespace-pre">{analysis.sql.rfm}</pre>
            </details>
            <details className="mt-2">
              <summary className="cursor-pointer text-[12px] font-semibold uppercase tracking-wider text-neutral-500 hover:text-neutral-800">Cohort retention</summary>
              <pre className="mt-2 bg-[#0d1117] text-[#c9d1d9] rounded-xl p-4 text-[11px] font-mono overflow-x-auto whitespace-pre">{analysis.sql.cohort}</pre>
            </details>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={remove} className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-700 hover:border-rose-300 hover:text-rose-700 transition-colors">
              <Trash2 size={14} /> Delete my data now
            </button>
            <p className="text-[12px] text-neutral-500">
              Otherwise deleted automatically 24 hours after upload.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
