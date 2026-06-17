import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboardStats } from '../api';
import { TrendingDown, TrendingUp, ChevronDown, ChevronRight, X } from 'lucide-react';
import Gauge from '../components/Gauge';
import AnimatedCounter from '../components/AnimatedCounter';

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total_customers: 0,
    total_campaigns: 0,
    total_messages_sent: 0,
    total_engagements: 0,
    revenue_generated: 0,
    avg_order_value: 0
  });
  
  const [activeToggle1, setActiveToggle1] = useState('Impressions');
  const [activeToggle3, setActiveToggle3] = useState('Video Clicks');

  useEffect(() => {
    const load = async () => {
      try {
        const s = await getDashboardStats();
        setStats(s || {});
      } catch(e) {
        console.error("Load failed:", e);
      }
    };
    load();
  }, []);

  return (
    <div className="w-full flex flex-col items-center">
      {/* Hero Content */}
      <div className="flex flex-col items-center px-4 pt-10 sm:pt-16 pb-8 sm:pb-12 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-1.5 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-[#ef4d23]"></span>
          <span className="text-[13px] font-medium text-white">ThreadCo CRM</span>
        </div>
        
        <h1 className="mt-5 sm:mt-6 text-[#f5f5dc]" 
            style={{ fontSize: "clamp(36px, 8vw, 72px)", lineHeight: 1.05, fontWeight: 500, letterSpacing: "-0.02em", textShadow: '0 2px 10px rgba(0,0,0,0.8), 0 1px 2px rgba(0,0,0,1)' }}>
          Shaping <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontWeight: 400 }}>Marketing</span><br />
          of tomorrow
        </h1>
        
        <p className="mt-4 sm:mt-6 text-white/90 px-2" style={{ fontSize: "clamp(13px, 3.5vw, 16px)", textShadow: '0 1px 4px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,1)' }}>
          The All-In-One Intelligence Powering the Future of CRM & Marketing
        </p>
        
        <button onClick={() => navigate('/campaigns/new')} className="mt-6 sm:mt-8 inline-flex items-center gap-3 bg-[#fcfaf5] hover:bg-gray-200 transition-colors text-black rounded-full pl-6 sm:pl-7 pr-2 py-2 sm:py-2.5 shadow-lg">
          <span className="text-[14px] font-medium">Get Started</span>
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-black/10 flex items-center justify-center">
            <ChevronRight size={16} strokeWidth={3} />
          </div>
        </button>
      </div>

      {/* Dashboard Preview */}
      <div className="w-full max-w-[1000px] mt-4 px-4 pb-12">
        <div className="bg-[#f5f2ee] rounded-3xl p-4 sm:p-6 shadow-2xl ring-1 ring-black/5 w-full flex flex-col sm:flex-row gap-4 sm:gap-6">
          
          {/* Card 1: Customers */}
          <div className="flex-1 bg-[#fcfaf5] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="font-semibold text-[15px] text-[#ef4d23]">Customers</span>
                <span className="text-[13px] text-neutral-400">Total Base</span>
              </div>
              
              <div className="flex items-end gap-3 mb-6">
                <span className="text-3xl sm:text-4xl font-bold text-[#0b0f1a]">
                  <AnimatedCounter value={stats.total_customers || 0} formatFn={(v) => Math.round(v).toLocaleString()} />
                </span>
                <div className="flex items-center gap-1 bg-[#f6ffed] text-[#52c41a] px-2 py-1 rounded-md text-xs font-medium mb-1">
                  <TrendingUp size={12} strokeWidth={3} />
                  <span>+{stats.new_this_month || 0} this month</span>
                </div>
              </div>
              <p className="text-[12px] text-neutral-400">Total registered shoppers</p>
            </div>
            
            <div className="mt-8 flex flex-col items-center">
              <p className="text-[12px] font-medium text-neutral-800 mb-4">New User Target (500)</p>
              <div className="w-full max-w-[200px]">
                <Gauge 
                  value={Math.min(100, Math.round(((stats.total_customers || 0) / 500) * 100))} 
                  color="#ef4d23" 
                  emptyColor="#f5f5f5" 
                />
              </div>
            </div>
          </div>
          
          {/* Card 2: Campaigns */}
          <div className="flex-1 bg-[#fcfaf5] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="font-semibold text-[15px] text-[#ef4d23]">Campaigns</span>
                <span className="text-[13px] text-neutral-400">Performance</span>
              </div>
              
              <div className="flex items-end gap-3 mb-6">
                <span className="text-3xl sm:text-4xl font-bold text-[#0b0f1a]">
                  <AnimatedCounter value={stats.total_campaigns || 0} formatFn={(v) => Math.round(v).toLocaleString()} />
                </span>
                <div className="flex items-center gap-1 bg-[#f3f4f6] text-neutral-600 px-2 py-1 rounded-md text-xs font-medium mb-1">
                  <span>Active</span>
                </div>
              </div>
              <p className="text-[12px] text-neutral-400">
                {stats.total_messages_sent.toLocaleString()} sent • {stats.total_engagements.toLocaleString()} engagements
              </p>
            </div>
            
            <div className="mt-8 flex flex-col items-center">
              <p className="text-[12px] font-medium text-neutral-800 mb-4">Messages Sent Target (5K)</p>
              <div className="w-full max-w-[200px]">
                <Gauge 
                  value={Math.min(100, Math.round(((stats.total_messages_sent || 0) / 5000) * 100))} 
                  color="#6366f1" 
                  emptyColor="#f5f5f5" 
                />
              </div>
            </div>
          </div>
          
          {/* Card 3: Revenue Starts */}
          <div className="flex-1 bg-[#fcfaf5] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="font-semibold text-[15px] text-[#ef4d23]">Revenue</span>
                <span className="text-[13px] text-neutral-400">Generated</span>
              </div>
              
              <div className="flex items-end gap-3 mb-6">
                <span className="text-3xl sm:text-4xl font-bold text-[#0b0f1a] truncate" title={`$${(stats.revenue_generated || 0).toLocaleString()}`}>
                  <AnimatedCounter value={stats.revenue_generated || 0} formatFn={(v) => '$' + Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v)} />
                </span>
              </div>
              <p className="text-[12px] text-neutral-400">Avg. Order Value: ${Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(stats.avg_order_value || 0)}</p>
            </div>
            
            <div className="mt-8 flex flex-col items-center">
              <p className="text-[12px] font-medium text-neutral-800 mb-4">Revenue Target ($100M)</p>
              <div className="w-full max-w-[200px]">
                <Gauge 
                  value={Math.min(100, Math.round(((stats.revenue_generated || 0) / 100000000) * 100))} 
                  color="#10b981" 
                  emptyColor="#f5f5f5" 
                />
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
