import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Play, 
  Search, 
  Bell, 
  ChevronDown, 
  CheckCircle2, 
  Plus, 
  MoreVertical, 
  LayoutDashboard,
  Users,
  Filter,
  Send,
  Building2,
  SlidersHorizontal,
  CreditCard,
  Sparkles
} from 'lucide-react';
import AnimatedNumber from '../components/AnimatedNumber';
import AIComposer from '../components/AIComposer';
import { getDashboardStats, getCampaigns, getCustomers, getAnalyticsOverview } from '../api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total_customers: 0,
    total_campaigns: 0,
    revenue_generated: 0
  });
    const [campaigns, setCampaigns] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');

    useEffect(() => {
    getDashboardStats().then(data => {
      if (data) setStats(data);
    }).catch(console.error);

    getCampaigns().then(data => {
      if (Array.isArray(data)) setCampaigns(data);
    }).catch(console.error);

    getCustomers().then(data => {
      // It might return { items: [...] } or just [...]
      const items = data.items || data || [];
      if (Array.isArray(items)) setCustomers(items);
    }).catch(console.error);

    getAnalyticsOverview().then(data => {
      if (data) setAnalytics(data);
    }).catch(console.error);
  }, []);

  return (
    <div className="relative w-full min-h-screen flex flex-col items-center px-4 sm:px-6 md:px-12 lg:px-20 pt-8 md:pt-12 pb-24 font-body overflow-x-hidden">
      
      {/* 1. Badge (top) - Framer Motion: fade up from y:10, duration 0.5s */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-1.5 text-sm text-muted-foreground font-body mb-6 cursor-default hover:border-accent/40 transition-colors"
      >
        <span>
          {analytics?.summary?.completed_orders && stats.total_customers
            ? `${Number(analytics.summary.completed_orders).toLocaleString()} completed orders · ${Number(stats.total_customers).toLocaleString()} customers · live Postgres`
            : 'Live Postgres dataset'}
        </span>
      </motion.div>

      {/* 2. Headline - Framer Motion: fade up from y:16, duration 0.6s, delay 0.1s */}
      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
        className="text-center font-display text-5xl md:text-6xl lg:text-[5rem] leading-[0.95] tracking-tight text-foreground max-w-xl"
      >
        Built to survive the <span className="font-display italic font-normal text-accent">second</span> question
      </motion.h1>

      {/* 3. Subheadline - Framer Motion: fade up from y:16, duration 0.6s, delay 0.2s */}
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
        className="mt-4 text-center text-base md:text-lg text-muted-foreground max-w-[650px] leading-relaxed font-body"
      >
        Every metric carries its definition. Every slow query shows its plan. The data-quality checks that failed are still on the page — because “where did that number come from?” is always what gets asked next.
      </motion.p>

      {/* 4. CTA Buttons - Framer Motion: fade up from y:16, duration 0.6s, delay 0.3s */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
        className="mt-5 flex items-center gap-3"
      >
        <button
          onClick={() => navigate('/workbench')}
          className="rounded-full px-6 py-5 text-sm font-medium font-body bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md active:scale-95"
        >
          See the query work
        </button>
        <button
          onClick={() => navigate('/analysis')}
          className="rounded-full px-6 py-5 text-sm font-medium font-body border border-border bg-background/80 backdrop-blur-md text-foreground hover:border-accent/40 transition-all active:scale-95"
        >
          Read the analysis
        </button>
        
      </motion.div>

      {/* 5. Dashboard Preview (custom coded, NOT an image) - Framer Motion: fade up from y:30, duration 0.8s, delay 0.5s */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.5, ease: 'easeOut' }}
        className="mt-8 w-full max-w-5xl"
      >
        <div
          className="rounded-2xl overflow-hidden p-3 md:p-4 text-[11px] select-none"
          style={{
            background: 'rgba(255, 255, 255, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.5)',
            boxShadow: 'var(--shadow-dashboard)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)'
          }}
        >
          {/* Top bar: Logo "N" in rounded box + "ThreadCo CRM" + chevron | Search bar with ⌘K shortcut | "Move Money" + bell + avatar "JB" */}
          <div className="flex items-center justify-between pb-3 border-b border-white/40">
            {/* Left Brand */}
            <div className="flex items-center gap-2">
              <img src="/app-logo.png" alt="ThreadCo" className="w-6 h-6 rounded-md shadow-sm object-contain bg-white/50" />
              <span className="font-semibold text-xs tracking-tight text-foreground">ThreadCo CRM</span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground opacity-70" />
            </div>

            

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => navigate('/campaigns/new')}
                className="bg-accent hover:bg-accent/90 text-accent-foreground font-medium rounded-full px-3 py-1 text-[11px] shadow-sm transition-all"
              >New Campaign</button>
              
              <div className="w-6 h-6 rounded-full bg-accent/10 text-accent font-bold flex items-center justify-center text-[10px] border border-accent/20 shadow-sm">AD</div>
            </div>
          </div>

          {/* Body: Sidebar (w-40) + Main Content */}
          <div className="flex flex-col md:flex-row gap-3 pt-3">
            
            
            {/* Sidebar (w-40) */}
            <div className="w-full md:w-40 shrink-0 flex flex-col justify-between gap-4 pr-1">
              <div className="flex flex-col gap-1">
                
                <button 
                  onClick={() => navigate('/dashboard')}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg font-medium text-foreground bg-white/70 border border-white/80 shadow-sm text-left"
                >
                  <LayoutDashboard className="w-3.5 h-3.5 text-accent" />
                  <span>Home</span>
                </button>

                <button 
                  onClick={() => navigate('/customers')}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/40 transition-colors text-left"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Customers</span>
                </button>

                <button 
                  onClick={() => navigate('/segments')}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/40 transition-colors text-left"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Segments</span>
                </button>

                <button 
                  onClick={() => navigate('/campaigns')}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/40 transition-colors text-left"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Campaigns</span>
                </button>

                <button 
                  onClick={() => navigate('/analytics')}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/40 transition-colors text-left"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Analytics</span>
                </button>

              </div>
            </div>

            {/* Main Content (bg-secondary/30) */}
            <div className="flex-1 bg-secondary/30 rounded-xl p-3 md:p-4 border border-white/50 flex flex-col gap-3.5">
              
              {/* Greeting: "Welcome, Jane" — text-sm font-semibold */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground tracking-tight">Welcome to ThreadCo</h3>
                <span className="text-[10px] text-muted-foreground">Updated live</span>
              </div>

              
              
              {/* Action buttons row */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button 
                  onClick={() => setActiveTab('dashboard')}
                  className={`rounded-full px-3 py-1 font-medium text-[10px] shadow-sm transition-all ${activeTab === 'dashboard' ? 'bg-accent text-accent-foreground' : 'bg-white/70 border border-white/80 text-foreground hover:bg-white'}`}
                >
                  Overview
                </button>
                <button 
                  onClick={() => setActiveTab('customers')}
                  className={`rounded-full px-3 py-1 font-medium text-[10px] shadow-sm transition-all ${activeTab === 'customers' ? 'bg-accent text-accent-foreground' : 'bg-white/70 border border-white/80 text-foreground hover:bg-white'}`}
                >
                  Customers
                </button>
                
                <button 
                  onClick={() => setActiveTab('campaigns')}
                  className={`rounded-full px-3 py-1 font-medium text-[10px] shadow-sm transition-all ${activeTab === 'campaigns' ? 'bg-accent text-accent-foreground' : 'bg-white/70 border border-white/80 text-foreground hover:bg-white'}`}
                >
                  Campaigns
                </button>
                <button 
                  onClick={() => setActiveTab('analytics')}
                  className={`rounded-full px-3 py-1 font-medium text-[10px] shadow-sm transition-all ${activeTab === 'analytics' ? 'bg-accent text-accent-foreground' : 'bg-white/70 border border-white/80 text-foreground hover:bg-white'}`}
                >
                  Analytics
                </button>
              </div>

              {activeTab === 'dashboard' && (
              <>
              {/* Two equal-width cards (flex-1 basis-0) side by side: */}
              <div className="flex flex-col sm:flex-row gap-3">
                
                {/* Balance card: "Total Revenue" with checkmark, amount ₹8,450,190.32 (cents in text-xs text-muted-foreground), stats (Last 30 Days, +₹1.8M green, -₹900K red), SVG area chart (h-20) with smooth cubic Bézier curve, linear gradient fill from accent at 15% opacity to transparent, stroke in accent color strokeWidth="1.5" */}
                <div className="flex-1 basis-0 bg-white/70 backdrop-blur rounded-xl p-3 border border-white/80 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-medium">
                        <span>Total Revenue</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      </div>
                    </div>
                    
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold text-foreground tracking-tight">₹<AnimatedNumber value={stats.revenue_generated || 0} formatter={(v) => v.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} /></span>
                      <span className="text-xs text-muted-foreground font-medium"></span>
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-[10px]">
                      <span className="text-muted-foreground">All time</span>
                      <span className="text-emerald-600 font-semibold flex items-center"></span>
                      <span className="text-rose-500 font-semibold flex items-center"></span>
                    </div>
                  </div>

                  {/* SVG area chart (h-20) with smooth cubic Bézier curve, linear gradient fill from accent at 15% opacity to transparent, stroke in accent color strokeWidth="1.5" */}
                  <div className="mt-3 w-full h-20 relative">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 300 80" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.15" />
                          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <motion.path d="M 0,65 C 40,55 70,30 110,40 C 150,50 190,15 240,25 C 270,30 285,10 300,12 L 300,80 L 0,80 Z" fill="url(#chartGradient)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.5, delay: 0.2 }} />
                      <motion.path d="M 0,65 C 40,55 70,30 110,40 C 150,50 190,15 240,25 C 270,30 285,10 300,12" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, ease: "easeOut" }} />
                    </svg>
                  </div>
                </div>

                {/* Accounts card: Header "Accounts" with + and ⋮ icons. Three rows (py-3, no dividers, text-xs, justify-between): Credit ₹98,125.50, Treasury ₹6,750,200.00, Operations ₹1,592,864.82 */}
                <div className="flex-1 basis-0 bg-white/70 backdrop-blur rounded-xl p-3 border border-white/80 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-black/5">
                      <span className="font-semibold text-xs text-foreground">Overview Metrics</span>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Plus className="w-3.5 h-3.5 hover:text-foreground cursor-pointer" />
                        <MoreVertical className="w-3.5 h-3.5 hover:text-foreground cursor-pointer" />
                      </div>
                    </div>

                    <div className="flex flex-col">
                      <div className="flex items-center justify-between py-3 text-xs">
                        <span className="text-muted-foreground font-medium">Total Customers</span>
                        <span className="font-semibold text-foreground"><AnimatedNumber value={stats.total_customers || 0} /></span>
                      </div>
                      <div className="flex items-center justify-between py-3 text-xs">
                        <span className="text-muted-foreground font-medium">Active Campaigns</span>
                        <span className="font-semibold text-foreground"><AnimatedNumber value={stats.total_campaigns || 0} /></span>
                      </div>
                      <div className="flex items-center justify-between py-3 text-xs">
                        <span className="text-muted-foreground font-medium">Messages Sent</span>
                        <span className="font-semibold text-foreground"><AnimatedNumber value={stats.total_messages_sent || 0} /></span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-black/5 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Real-time synched</span>
                    <span className="text-accent font-medium cursor-pointer hover:underline"></span>
                  </div>
                </div>

              </div>

              
              {/* Recent Campaigns table */}
              <div className="bg-white/70 backdrop-blur rounded-xl p-3 border border-white/80 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-xs text-foreground">Recent Campaigns</h4>
                  <span onClick={() => setActiveTab('campaigns')} className="text-[10px] text-accent font-medium cursor-pointer hover:underline">View all</span>
                </div>

                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="text-muted-foreground border-b border-black/5 pb-1">
                        <th className="pb-1.5 font-medium">Date</th>
                        <th className="pb-1.5 font-medium">Campaign Name</th>
                        <th className="pb-1.5 font-medium">Sent</th>
                        <th className="pb-1.5 font-medium text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      {campaigns.length > 0 ? campaigns.slice(0, 4).map((camp, idx) => (
                        <tr key={idx}>
                          <td className="py-2 text-muted-foreground">{new Date(camp.created_at).toLocaleDateString()}</td>
                          <td className="py-2 font-medium text-foreground">{camp.name}</td>
                          <td className="py-2 text-muted-foreground font-medium">{camp.total_sent || 0} msgs</td>
                          <td className="py-2 text-right">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-semibold border ${
                              camp.status === 'completed' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                              camp.status === 'running' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                              'bg-amber-100 text-amber-800 border-amber-200'
                            }`}>
                              {camp.status.charAt(0).toUpperCase() + camp.status.slice(1)}
                            </span>
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan="4" className="py-4 text-center text-muted-foreground">No recent campaigns</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              </>
              )}

              {activeTab === 'customers' && (
                <div className="flex-1 bg-white/70 backdrop-blur rounded-xl p-4 border border-white/80 shadow-sm flex flex-col animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-foreground text-xs flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-accent"/> Audience Directory</h4>
                    <button onClick={() => navigate('/customers')} className="text-[10px] text-accent font-medium hover:underline">View All</button>
                  </div>
                  <div className="bg-white/50 rounded-lg border border-black/5 overflow-hidden">
                    <table className="w-full text-[10px] text-left">
                      <thead className="bg-black/5 text-muted-foreground">
                        <tr><th className="px-3 py-2 font-medium">Customer</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium text-right">LTV</th></tr>
                      </thead>
                      <tbody className="divide-y divide-black/5">
                        {customers.slice(0, 4).map((c, i) => (
                          <tr key={i} className="hover:bg-white/50 transition-colors">
                            <td className="px-3 py-2"><div className="font-medium text-foreground">{c.name || c.first_name || 'Customer'}</div><div className="text-muted-foreground text-[9px]">{c.phone || c.email || '-'}</div></td>
                            <td className="px-3 py-2">
                              <span className={`px-1.5 py-0.5 rounded-full text-[8px] ${c.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{c.status || 'Active'}</span>
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-foreground">₹{c.ltv || c.total_spent || '0.00'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button onClick={() => navigate('/customers')} className="mt-3 w-full py-2 bg-secondary/80 hover:bg-secondary text-foreground text-[10px] font-medium rounded-lg transition-colors flex items-center justify-center gap-1">
                    For more view head to Customers page <span>→</span>
                  </button>
                </div>
              )}

              {activeTab === 'segments' && (
                <div className="flex-1 bg-white/70 backdrop-blur rounded-xl p-4 border border-white/80 shadow-sm flex flex-col animate-in fade-in zoom-in-95 duration-300 overflow-hidden">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-foreground text-xs flex items-center gap-1.5"><Filter className="w-3.5 h-3.5 text-accent"/> Segments</h4>
                    <button onClick={() => navigate('/segments')} className="text-[10px] text-accent font-medium hover:underline">Go to full page</button>
                  </div>
                  <div className="aicomposer-override transform scale-[0.85] origin-top -mt-4 w-[117%]">
                    <AIComposer onSaved={() => navigate('/segments')} />
                  </div>
                  <style>{`
                    .aicomposer-override * { color: var(--foreground); }
                    .aicomposer-override input, .aicomposer-override textarea { background: rgba(255,255,255,0.5) !important; border-color: rgba(0,0,0,0.1) !important; }
                    .aicomposer-override input::placeholder, .aicomposer-override textarea::placeholder { color: rgba(0,0,0,0.3) !important; }
                    .aicomposer-override p, .aicomposer-override span { color: var(--muted-foreground) !important; }
                    .aicomposer-override button.bg-brand-500 { background: var(--accent) !important; }
                    .aicomposer-override button.bg-brand-500 * { color: #ffffff !important; }
                    .aicomposer-override .aicomposer-title { color: var(--foreground) !important; }
                  `}</style>
                </div>
              )}

              {activeTab === 'campaigns' && (
                <div className="flex-1 bg-white/70 backdrop-blur rounded-xl p-4 border border-white/80 shadow-sm flex flex-col animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-foreground text-xs flex items-center gap-1.5"><Send className="w-3.5 h-3.5 text-accent"/> Active Campaigns</h4>
                    <button onClick={() => navigate('/campaigns')} className="text-[10px] text-accent font-medium hover:underline">Manage All</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {campaigns.slice(0, 4).map((c, i) => (
                      <div key={i} className="bg-white/60 p-3 rounded-lg border border-black/5 hover:border-accent/30 transition-colors cursor-pointer shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-foreground text-[11px] truncate pr-2">{c.name}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded ${c.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{c.status || 'active'}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <div><div className="text-muted-foreground mb-0.5">Sent</div><div className="font-semibold text-foreground"><AnimatedNumber value={c.total_sent || 0} /></div></div>
                          <div className="text-right"><div className="text-muted-foreground mb-0.5">Conv. Rate</div><div className="font-semibold text-emerald-600">{(c.total_sent > 0 ? ((c.total_clicked / c.total_sent) * 100).toFixed(1) : 0)}%</div></div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => navigate('/campaigns')} className="mt-3 w-full py-2 bg-secondary/80 hover:bg-secondary text-foreground text-[10px] font-medium rounded-lg transition-colors flex items-center justify-center gap-1">
                    For more view head to Campaigns page <span>→</span>
                  </button>
                </div>
              )}

              {activeTab === 'analytics' && (
                <div className="flex-1 bg-white/70 backdrop-blur rounded-xl p-4 border border-white/80 shadow-sm flex flex-col animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-foreground text-xs flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-accent"/> Performance Analytics</h4>
                    <button onClick={() => navigate('/analytics')} className="text-[10px] text-accent font-medium hover:underline">Full Report</button>
                  </div>
                  <div className="flex flex-col gap-3 flex-1">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-white/50 p-2 rounded-lg border border-black/5 text-center shadow-sm">
                        <div className="text-[9px] text-muted-foreground mb-1">Avg Open Rate</div>
                        <div className="text-sm font-bold text-foreground"><AnimatedNumber value={analytics?.avg_open_rate || 0} />%</div>
                      </div>
                      <div className="bg-white/50 p-2 rounded-lg border border-black/5 text-center shadow-sm">
                        <div className="text-[9px] text-muted-foreground mb-1">Click Through</div>
                        <div className="text-sm font-bold text-foreground"><AnimatedNumber value={analytics?.click_through || 0} />%</div>
                      </div>
                      <div className="bg-white/50 p-2 rounded-lg border border-black/5 text-center shadow-sm">
                        <div className="text-[9px] text-muted-foreground mb-1">Delivery Rate</div>
                        <div className="text-sm font-bold text-foreground"><AnimatedNumber value={analytics?.delivery_rate || 0} />%</div>
                      </div>
                    </div>
                    <div className="bg-white/50 p-3 rounded-lg border border-black/5 shadow-sm">
                      <div className="text-[10px] font-medium text-foreground mb-2">Channel Performance</div>
                      <div className="space-y-2">
                        {(analytics?.channel_performance || []).map((ch, i) => {
                          const colors = { whatsapp: 'bg-emerald-500', email: 'bg-blue-500', sms: 'bg-indigo-500', rcs: 'bg-amber-500' };
                          return (
                            <div key={ch.channel} className="flex items-center gap-2 text-[9px]">
                              <span className="w-12 text-muted-foreground capitalize">{ch.channel}</span>
                              <div className="flex-1 h-1.5 bg-black/5 rounded-full overflow-hidden">
                                <motion.div initial={{width: 0}} animate={{width: `${ch.share_of_sends}%`}} transition={{duration: 1, delay: i*0.1}} className={`h-full ${colors[ch.channel] || 'bg-neutral-400'}`}></motion.div>
                              </div>
                              {/* A channel with no sends is not a channel performing at 0%. */}
                              <span className={`w-20 text-right tabular-nums ${ch.has_data ? 'text-foreground font-medium' : 'text-muted-foreground/60 italic'}`}>
                                {ch.has_data ? `${ch.sent.toLocaleString()} sent` : 'no sends yet'}
                              </span>
                            </div>
                          );
                        })}
                        {!analytics?.channel_performance?.length && (
                          <div className="text-[9px] text-muted-foreground italic">No delivery data yet.</div>
                        )}
                      </div>
                      <p className="mt-2 text-[8.5px] text-muted-foreground/70 leading-snug">
                        Bar shows share of all messages sent. Rates are computed from delivery events,
                        not from campaign counters.
                      </p>
                    </div>
                  </div>
                  <button onClick={() => navigate('/campaigns')} className="mt-3 w-full py-2 bg-secondary/80 hover:bg-secondary text-foreground text-[10px] font-medium rounded-lg transition-colors flex items-center justify-center gap-1">
                    For more view head to Campaigns page <span>→</span>
                  </button>
                </div>
              )}


          </div>
        </div>
            </div>
      </motion.div>

    </div>
  );
}
