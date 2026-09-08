import React, { useEffect, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { getAnalyticsOverview } from '../api';

const COLORS = ['#ef4d23', '#18181b', '#6366f1', '#0f766e', '#ca8a04', '#db2777'];
const inr = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

function Metric({ label, value, note }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-[#fcfaf5] p-5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-[#111827]">{Number(value || 0).toLocaleString()}</p>
      <p className="mt-2 text-xs text-neutral-500">{note}</p>
    </div>
  );
}

export default function Analytics() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getAnalyticsOverview()
      .then(setData)
      .catch(() => setError('Unable to load the analytics service. Check the API connection and try again.'));
  }, []);

  if (!data && !error) {
    return <div className="flex min-h-[500px] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-[#ef4d23]" /></div>;
  }

  if (error) {
    return <div className="mx-auto mt-12 max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">{error}</div>;
  }

  const { summary, revenue_by_month: monthly, city_performance: cities, lifecycle_distribution: lifecycle, data_quality: quality, recommendations, query_health: queryHealth } = data;

  return (
    <div className="product-page product-page--analytics mx-auto mt-6 w-full max-w-[1100px] px-3 pb-12 pt-8 sm:px-4">
      <div className="mb-7 px-2">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-[#ef4d23]" />
          <span className="text-[12px] font-semibold text-white">Data Intelligence Workbench</span>
        </div>
        <h2 className="text-[#f5f5dc]" style={{ fontSize: 'clamp(28px, 5vw, 42px)', lineHeight: 1.1, textShadow: '0 2px 10px rgba(0,0,0,.8)' }}>
          From business question to <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic' }}>decision</span>
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-white/90" style={{ textShadow: '0 1px 4px rgba(0,0,0,.8)' }}>
          Real aggregates, data-quality checks, and a safe query-plan diagnostic—built to show how customer decisions are supported by data.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Customers" value={summary.customers} note="Active customer base" />
        <Metric label="Completed orders" value={summary.completed_orders} note="Used for revenue analysis" />
        <Metric label="Campaigns" value={summary.active_campaigns} note="Draft, sending, or running" />
        <Metric label="Communications" value={summary.communications} note="Delivery-event records" />
      </div>

      <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        <span className="font-semibold">Data scope:</span> {data.data_notice}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-neutral-200 bg-[#fcfaf5] p-5 shadow-sm lg:col-span-2">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
            <div><h3 className="font-semibold text-[#111827]">Completed-order revenue by month</h3><p className="mt-1 text-xs text-neutral-500">Calculated from actual completed orders; no illustrative trend data.</p></div>
            <span className="text-xs text-neutral-500">Last 12 months</span>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly} margin={{ top: 5, right: 20, bottom: 5, left: 5 }}>
                <CartesianGrid stroke="#eceae5" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v) => `₹${Math.round(v / 100000)}L`} />
                <Tooltip formatter={(value, name) => [name === 'revenue' ? inr(value) : Number(value).toLocaleString(), name === 'revenue' ? 'Revenue' : name]} />
                <Line type="monotone" dataKey="revenue" stroke="#ef4d23" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-[#fcfaf5] p-5 shadow-sm">
          <h3 className="font-semibold text-[#111827]">Customer value by city</h3><p className="mt-1 text-xs text-neutral-500">Rank cities by recorded customer spend, not volume alone.</p>
          <div className="mt-4 h-[260px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={cities} margin={{ top: 5, right: 5, bottom: 30, left: 5 }}><CartesianGrid stroke="#eceae5" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="city" angle={-35} textAnchor="end" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${Math.round(v / 100000)}L`} /><Tooltip formatter={(value, name) => [name === 'revenue' ? inr(value) : Number(value).toLocaleString(), name === 'revenue' ? 'Recorded spend' : name]} /><Bar dataKey="revenue" fill="#18181b" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-[#fcfaf5] p-5 shadow-sm">
          <h3 className="font-semibold text-[#111827]">Lifecycle distribution</h3><p className="mt-1 text-xs text-neutral-500">Customers may have more than one behavioural tag.</p>
          <div className="mt-4 h-[260px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={lifecycle} dataKey="customers" nameKey="segment" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>{lifecycle.map((entry, index) => <Cell key={entry.segment} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(value) => [Number(value).toLocaleString(), 'Customers']} /></PieChart></ResponsiveContainer></div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-[#fcfaf5] p-5 shadow-sm lg:col-span-2">
          <div className="mb-4"><h3 className="font-semibold text-[#111827]">Business recommendations</h3><p className="mt-1 text-xs text-neutral-500">Each recommendation is tied to a live aggregate and states its evidence boundary.</p></div>
          <div className="grid gap-3 md:grid-cols-2">{recommendations.map((item) => <article key={item.title} className="rounded-xl border border-neutral-200 bg-white p-4"><h4 className="font-semibold text-[#111827]">{item.title}</h4><p className="mt-2 text-sm text-neutral-700">{item.finding}</p><p className="mt-3 text-sm"><span className="font-semibold text-[#ef4d23]">Recommended next step:</span> {item.action}</p><p className="mt-3 text-xs text-neutral-500">Evidence: {item.evidence}</p></article>)}</div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-[#fcfaf5] p-5 shadow-sm lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="font-semibold text-[#111827]">SQL performance diagnostic</h3><p className="mt-1 max-w-2xl text-xs text-neutral-500">A fixed, parameterized audience query is executed server-side. The app exposes its real planner summary, never arbitrary browser-supplied SQL.</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Parameterized query</span></div>
          <div className="mt-4 grid gap-3 md:grid-cols-3"><div className="rounded-xl bg-neutral-100 p-4"><p className="text-xs text-neutral-500">Current execution</p><p className="mt-1 text-2xl font-semibold">{queryHealth.elapsed_ms} ms</p><p className="mt-1 text-xs text-neutral-500">{queryHealth.returned_rows} rows returned</p></div><div className="rounded-xl bg-neutral-100 p-4"><p className="text-xs text-neutral-500">Planner strategy</p><p className="mt-1 text-sm font-semibold text-[#111827]">{queryHealth.strategy}</p><p className="mt-1 text-xs text-neutral-500">Estimated rows: {queryHealth.estimated_rows ?? 'n/a'}</p></div><div className="rounded-xl bg-neutral-100 p-4"><p className="text-xs text-neutral-500">Index evidence</p><p className="mt-1 text-sm font-semibold text-[#111827]">{queryHealth.indexes_used?.length ? queryHealth.indexes_used.join(', ') : 'No index selected at this table size'}</p><p className="mt-1 text-xs text-neutral-500">Indexes are defined for this filter path and plan choice remains data-dependent.</p></div></div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-[#fcfaf5] p-5 shadow-sm lg:col-span-2"><h3 className="font-semibold text-[#111827]">Data-quality notes</h3><div className="mt-3 flex flex-wrap gap-3 text-sm text-neutral-700"><span className="rounded-full bg-neutral-100 px-3 py-2">{quality.customer_email_uniqueness}</span><span className="rounded-full bg-neutral-100 px-3 py-2">{Number(quality.customers_without_completed_orders).toLocaleString()} customers without completed orders</span><span className="rounded-full bg-neutral-100 px-3 py-2">Scope: {quality.dataset_scope}</span></div></section>
      </div>
    </div>
  );
}
