import React, { useEffect, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { getAnalyticsOverview } from '../api';

const COLORS = ['#6366f1', '#a855f7', '#3b82f6', '#10b981', '#8b5cf6', '#f43f5e']; // updated semantic colors
const inr = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

function Metric({ label, value, note }) {
  return (
    <div className="frosted-glass-card rounded-2xl p-5 shadow-sm flex flex-col justify-between">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl sm:text-3xl font-display font-medium text-foreground">{Number(value || 0).toLocaleString()}</p>
      <p className="mt-2 text-[11px] text-muted-foreground/80">{note}</p>
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
    return <div className="flex min-h-[500px] items-center justify-center font-body"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-accent" /></div>;
  }

  if (error) {
    return <div className="mx-auto mt-12 max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 font-body shadow-sm">{error}</div>;
  }

  const { summary, revenue_by_month: monthly, city_performance: cities, lifecycle_distribution: lifecycle, data_quality: quality, recommendations, query_health: queryHealth } = data;

  return (
    <div className="w-full px-4 sm:px-6 md:px-12 max-w-[1100px] mx-auto pt-8 md:pt-12 pb-24 font-body">
      
      <div className="mb-10 px-2">
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 backdrop-blur-md px-4 py-1.5 shadow-sm">
          <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
          <span className="text-[11px] font-semibold text-foreground tracking-wide">Data Intelligence Workbench</span>
        </div>
        <h2 className="font-display text-4xl sm:text-5xl md:text-6xl text-foreground tracking-tight leading-[0.98]">
          From business question to <span className="font-display italic font-normal text-accent">Decision</span>
        </h2>
        <p className="mt-3 text-muted-foreground text-sm md:text-base max-w-xl">
          Real aggregates, data-quality checks, and a safe query-plan diagnostic—built to show how customer decisions are supported by data.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric label="Customers" value={summary.customers} note="Active customer base" />
        <Metric label="Completed orders" value={summary.completed_orders} note="Used for revenue analysis" />
        <Metric label="Campaigns" value={summary.active_campaigns} note="Draft, sending, or running" />
        <Metric label="Communications" value={summary.communications} note="Delivery-event records" />
      </div>

      <div className="mb-8 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 py-4 text-[13px] text-amber-800 backdrop-blur-sm">
        <span className="font-bold uppercase tracking-wider text-[11px] mr-2">Data scope:</span> {data.data_notice}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:gap-8 lg:grid-cols-2">
        
        {/* Revenue Trend */}
        <section className="frosted-glass-wrapper rounded-3xl p-6 lg:p-8 shadow-sm lg:col-span-2">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h3 className="text-foreground font-display text-2xl md:text-3xl mb-1">Completed-order <span className="italic font-normal">Revenue</span></h3>
              <p className="text-[12px] text-muted-foreground">Calculated from actual completed orders; no illustrative trend data.</p>
            </div>
            <span className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground bg-white/60 px-3 py-1.5 rounded-lg border border-white/80 shadow-sm">Last 12 months</span>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid stroke="rgba(0,0,0,0.05)" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 500 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 500 }} tickFormatter={(v) => `₹${Math.round(v / 100000)}L`} dx={-10} />
                <Tooltip 
                  contentStyle={{ background: 'rgba(255, 255, 255, 0.9)', border: '1px solid rgba(255,255,255,0.6)', borderRadius: '12px', backdropFilter: 'blur(8px)', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)', fontWeight: 600, fontSize: '12px' }}
                  itemStyle={{ color: '#111827' }}
                  formatter={(value, name) => [name === 'revenue' ? inr(value) : Number(value).toLocaleString(), name === 'revenue' ? 'Revenue' : name]} 
                />
                <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#6366f1' }} activeDot={{ r: 6, strokeWidth: 0, fill: '#6366f1' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* City Performance */}
        <section className="frosted-glass-wrapper rounded-3xl p-6 lg:p-8 shadow-sm">
          <div className="mb-6">
            <h3 className="text-foreground font-display text-2xl md:text-3xl mb-1">Customer <span className="italic font-normal">Value</span> by City</h3>
            <p className="text-[12px] text-muted-foreground">Rank cities by recorded customer spend, not volume alone.</p>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cities} margin={{ top: 10, right: 10, bottom: 40, left: 10 }}>
                <CartesianGrid stroke="rgba(0,0,0,0.05)" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="city" angle={-35} textAnchor="end" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 500 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 500 }} tickFormatter={(v) => `₹${Math.round(v / 100000)}L`} dx={-10} />
                <Tooltip 
                  contentStyle={{ background: 'rgba(255, 255, 255, 0.9)', border: '1px solid rgba(255,255,255,0.6)', borderRadius: '12px', backdropFilter: 'blur(8px)', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', fontWeight: 600, fontSize: '12px' }}
                  cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                  formatter={(value, name) => [name === 'revenue' ? inr(value) : Number(value).toLocaleString(), name === 'revenue' ? 'Recorded spend' : name]} 
                />
                <Bar dataKey="revenue" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Lifecycle */}
        <section className="frosted-glass-wrapper rounded-3xl p-6 lg:p-8 shadow-sm">
          <div className="mb-2">
            <h3 className="text-foreground font-display text-2xl md:text-3xl mb-1">Lifecycle <span className="italic font-normal">Distribution</span></h3>
            <p className="text-[12px] text-muted-foreground">Customers may have more than one behavioural tag.</p>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={lifecycle} 
                  dataKey="customers" 
                  nameKey="segment" 
                  cx="50%" 
                  cy="50%" 
                  innerRadius={65} 
                  outerRadius={100} 
                  paddingAngle={4}
                  stroke="none"
                >
                  {lifecycle.map((entry, index) => <Cell key={entry.segment} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip 
                  contentStyle={{ background: 'rgba(255, 255, 255, 0.9)', border: '1px solid rgba(255,255,255,0.6)', borderRadius: '12px', backdropFilter: 'blur(8px)', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', fontWeight: 600, fontSize: '12px' }}
                  formatter={(value) => [Number(value).toLocaleString(), 'Customers']} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Recommendations */}
        <section className="frosted-glass-wrapper rounded-3xl p-6 lg:p-8 shadow-sm lg:col-span-2">
          <div className="mb-6">
            <h3 className="text-foreground font-display text-2xl md:text-3xl mb-1">Business <span className="italic font-normal">Recommendations</span></h3>
            <p className="text-[12px] text-muted-foreground">Each recommendation is tied to a live aggregate and states its evidence boundary.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {recommendations.map((item) => (
              <article key={item.title} className="frosted-glass-card rounded-2xl p-5 md:p-6 transition-all hover:-translate-y-1 hover:shadow-md">
                <h4 className="font-semibold text-foreground text-sm md:text-base">{item.title}</h4>
                <p className="mt-2 text-sm text-muted-foreground">{item.finding}</p>
                <div className="mt-4 pt-4 border-t border-border/40">
                  <p className="text-sm">
                    <span className="font-bold text-accent text-[11px] uppercase tracking-wider mr-2">Next step:</span> 
                    <span className="font-medium text-foreground">{item.action}</span>
                  </p>
                  <p className="mt-3 text-[11px] font-medium text-muted-foreground bg-white/50 inline-block px-2.5 py-1 rounded-lg border border-white/60">
                    Evidence: {item.evidence}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* SQL Diagnostic */}
        <section className="frosted-glass-wrapper rounded-3xl p-6 lg:p-8 shadow-sm lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h3 className="text-foreground font-display text-2xl md:text-3xl mb-1">SQL <span className="italic font-normal">Performance</span></h3>
              <p className="max-w-2xl text-[12px] text-muted-foreground">A fixed, parameterized audience query is executed server-side. The app exposes its real planner summary, never arbitrary browser-supplied SQL.</p>
            </div>
            <span className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 border border-emerald-500/20">
              Parameterized query
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="frosted-glass-card rounded-2xl p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Current execution</p>
              <p className="mt-2 text-3xl font-display font-medium text-foreground">{queryHealth.elapsed_ms} <span className="text-lg text-muted-foreground">ms</span></p>
              <p className="mt-2 text-[11px] text-muted-foreground">{Number(queryHealth.returned_rows).toLocaleString()} rows returned</p>
            </div>
            <div className="frosted-glass-card rounded-2xl p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Planner strategy</p>
              <p className="mt-2 text-sm font-semibold text-foreground bg-white/60 px-3 py-1.5 rounded-lg border border-white/80 inline-block">{queryHealth.strategy}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">Estimated rows: {queryHealth.estimated_rows ? Number(queryHealth.estimated_rows).toLocaleString() : 'n/a'}</p>
            </div>
            <div className="frosted-glass-card rounded-2xl p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Index evidence</p>
              <p className="mt-2 text-[13px] font-mono text-foreground bg-white/60 px-3 py-1.5 rounded-lg border border-white/80 block break-all">
                {queryHealth.indexes_used?.length ? queryHealth.indexes_used.join(', ') : 'No index selected'}
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground">Indexes are defined for this filter path; plan choice is data-dependent.</p>
            </div>
          </div>
        </section>

        {/* Data Quality */}
        <section className="frosted-glass-wrapper rounded-3xl p-6 lg:p-8 shadow-sm lg:col-span-2">
          <h3 className="text-foreground font-display text-2xl md:text-3xl mb-4">Data Quality <span className="italic font-normal">Notes</span></h3>
          <div className="flex flex-wrap gap-3">
            <span className="rounded-xl border border-white/80 bg-white/60 px-4 py-2 text-sm font-medium text-foreground shadow-sm">
              {quality.customer_email_uniqueness}
            </span>
            <span className="rounded-xl border border-white/80 bg-white/60 px-4 py-2 text-sm font-medium text-foreground shadow-sm">
              {Number(quality.customers_without_completed_orders).toLocaleString()} customers without completed orders
            </span>
            <span className="rounded-xl border border-white/80 bg-white/60 px-4 py-2 text-sm font-medium text-foreground shadow-sm">
              <span className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider mr-2">Scope:</span>
              {quality.dataset_scope}
            </span>
          </div>
        </section>
        
      </div>
    </div>
  );
}
