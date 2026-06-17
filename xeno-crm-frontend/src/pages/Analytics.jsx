import React, { useState, useEffect } from 'react';
import { getCustomerStats } from '../api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

export default function Analytics() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCustomerStats().then(data => {
      setStats(data);
      setLoading(false);
    }).catch(console.error);
  }, []);

  if (loading || !stats) {
    return (
      <div className="w-full h-full flex items-center justify-center min-h-[500px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#ef4d23]"></div>
      </div>
    );
  }

  // Prepare data for charts
  const cityData = Object.entries(stats.city_breakdown || {}).map(([name, value]) => ({ name, value }));
  const tagData = Object.entries(stats.tag_breakdown || {}).map(([name, value]) => ({ name, value }));
  
  // Mock trend data since backend only returns aggregate
  const trendData = [
    { name: 'Jan', revenue: Math.round(stats.total_revenue * 0.05) },
    { name: 'Feb', revenue: Math.round(stats.total_revenue * 0.08) },
    { name: 'Mar', revenue: Math.round(stats.total_revenue * 0.12) },
    { name: 'Apr', revenue: Math.round(stats.total_revenue * 0.10) },
    { name: 'May', revenue: Math.round(stats.total_revenue * 0.18) },
    { name: 'Jun', revenue: Math.round(stats.total_revenue * 0.22) },
    { name: 'Jul', revenue: Math.round(stats.total_revenue * 0.25) },
  ];

  const COLORS = ['#ef4d23', '#0b0f1a', '#4b5563', '#9ca3af', '#fcd34d', '#34d399', '#60a5fa'];

  return (
    <div className="w-full px-3 sm:px-4 pt-8 mt-6 max-w-[1100px] mx-auto pb-12">
      <div className="mb-8 px-2">
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full px-3 py-1.5 shadow-sm mb-4 border border-white/20">
          <span className="w-2 h-2 rounded-full bg-[#ef4d23]"></span>
          <span className="text-[12px] font-semibold text-white">Analytics & Reporting</span>
        </div>
        <h2 className="text-[#f5f5dc] font-medium" style={{ fontSize: "clamp(28px, 5vw, 42px)", lineHeight: 1.1, letterSpacing: "-0.02em", textShadow: '0 2px 10px rgba(0,0,0,0.8), 0 1px 2px rgba(0,0,0,1)' }}>
          Visualize your <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontWeight: 400 }}>Growth</span>
        </h2>
        <p className="text-white/90 mt-2 text-[14px]" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,1)' }}>
          Deep dive into your customer demographics, revenue trends, and tag distribution.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Revenue Trend Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 lg:col-span-2">
          <h3 className="text-[15px] font-semibold text-[#0b0f1a] mb-6">Revenue Trend (YTD)</h3>
          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <Line type="monotone" dataKey="revenue" stroke="#ef4d23" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                <CartesianGrid stroke="#f5f5f5" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(val) => `$${Intl.NumberFormat('en-US', { notation: 'compact' }).format(val)}`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value) => [`$${value.toLocaleString()}`, 'Revenue']}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* City Breakdown Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200">
          <h3 className="text-[15px] font-semibold text-[#0b0f1a] mb-6">Customers by City</h3>
          <div className="w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cityData} margin={{ top: 5, right: 0, bottom: 20, left: -20 }}>
                <CartesianGrid stroke="#f5f5f5" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} dy={10} angle={-45} textAnchor="end" />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip 
                  cursor={{ fill: '#f9fafb' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" fill="#0b0f1a" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tag Breakdown Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200">
          <h3 className="text-[15px] font-semibold text-[#0b0f1a] mb-6">Customer Segmentation</h3>
          <div className="w-full h-[250px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={tagData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {tagData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
