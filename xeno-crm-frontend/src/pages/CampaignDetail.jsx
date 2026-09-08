import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from "motion/react";
import { getCampaignStats, checkCampaignCompletion } from '../api';
import { ArrowLeft, CheckCircle2, XCircle, MailOpen, MousePointerClick, RefreshCw } from 'lucide-react';

const StatusBadge = ({ status }) => {
  const styles = {
    queued: 'bg-secondary/50 text-muted-foreground border-border',
    delivered: 'bg-accent/10 text-accent border-accent/20',
    opened: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    clicked: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    converted: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
    failed: 'bg-red-500/10 text-red-600 border-red-500/20'
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles[status] || styles.queued}`}>
      {status}
    </span>
  );
};

const MetricCard = ({ title, value, badge, icon: Icon, colorClass, delay }) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4 }}
    className="frosted-glass-card p-5 rounded-2xl flex flex-col justify-between"
  >
    <div className="flex justify-between items-start mb-4">
      <div className={`p-2.5 rounded-xl ${colorClass}`}>
        <Icon className="w-5 h-5" />
      </div>
      {badge && (
        <span className="px-2 py-1 bg-white/60 text-muted-foreground text-[10px] font-bold uppercase tracking-wider rounded-lg border border-white/80 whitespace-nowrap shadow-sm">
          {badge}
        </span>
      )}
    </div>
    <div>
      <h3 className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider mb-1">{title}</h3>
      <div className="text-2xl sm:text-3xl font-display font-medium text-foreground">{value}</div>
    </div>
  </motion.div>
);

const CampaignDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let timeoutId;
    const fetchStats = async () => {
      try {
        const res = await getCampaignStats(id);
        setStats(res);
        // Stop polling if completed
        if (res?.status === 'completed') {
          clearInterval(timeoutId);
        }
      } catch (error) {
        console.error("Failed to fetch campaign stats:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Polling logic for webhook receipts
    fetchStats();
    timeoutId = setInterval(fetchStats, 3000);
    return () => clearInterval(timeoutId);
  }, [id]);

  // Fallback completion checker
  useEffect(() => {
    let intervalId;
    const checkCompletion = async () => {
      if (stats?.status === 'sending' || stats?.status === 'running') {
        try {
          const res = await checkCampaignCompletion(id);
          if (res.status === 'completed') {
            clearInterval(intervalId);
            setStats(prev => ({ ...prev, status: 'completed' }));
          }
        } catch (error) {
          console.error("Completion check failed:", error);
        }
      }
    };
    
    if (stats?.status === 'sending' || stats?.status === 'running') {
      intervalId = setInterval(checkCompletion, 5000);
    }
    
    return () => clearInterval(intervalId);
  }, [id, stats?.status]);

  if (isLoading && !stats) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground font-medium font-body">
        <RefreshCw className="w-6 h-6 animate-spin mr-2 text-accent" />
        Loading campaign details...
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 md:px-12 max-w-[1100px] mx-auto pt-8 md:pt-12 pb-24 font-body">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4 mb-8">
        <button onClick={() => navigate('/campaigns')}
          className="p-2.5 bg-white/70 border border-white/80 hover:bg-white rounded-full transition-colors shadow-sm self-start">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl text-foreground tracking-tight leading-[0.98]">
              {stats?.name || "Campaign Details"}
            </h1>
            <span className={`text-[10px] px-2.5 py-1 rounded-full border font-semibold uppercase tracking-wider mt-1 md:mt-0
              ${stats?.status === 'completed' 
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                : 'bg-blue-500/10 text-blue-600 border-blue-500/20'
              }`}>
              {stats?.status}
            </span>
            <span className="text-[10px] px-2.5 py-1 rounded-full border bg-accent/10 text-accent border-accent/20 font-semibold uppercase tracking-wider mt-1 md:mt-0">
              {stats?.channel}
            </span>
          </div>
          <p className="text-muted-foreground text-sm mt-3 font-medium flex flex-wrap items-center gap-1.5">
            Dispatched on {stats?.sent_at 
              ? new Date(stats.sent_at).toLocaleDateString('en-IN', {
                  day:'numeric', month:'long', year:'numeric',
                  hour:'2-digit', minute:'2-digit'
                })
              : '—'}
            <span className="mx-1 text-border/60">•</span>
            <span className="text-foreground font-semibold">{stats?.total_sent || 0}</span> Recipients
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <MetricCard 
          title="Delivered"
          value={`${stats?.total_delivered||0}`}
          badge={`${(stats?.delivery_rate||0).toFixed(0)}% Rate`}
          icon={CheckCircle2}
          colorClass="bg-accent/10 text-accent"
          delay={0.1} 
        />
        <MetricCard 
          title="Opened"
          value={stats?.total_opened||0}
          badge={`${(stats?.open_rate||0).toFixed(0)}% Rate`}
          icon={MailOpen}
          colorClass="bg-blue-500/10 text-blue-600"
          delay={0.2} 
        />
        <MetricCard 
          title="Clicked"
          value={stats?.total_clicked||0}
          badge={`${(stats?.click_rate||0).toFixed(0)}% Rate`}
          icon={MousePointerClick}
          colorClass="bg-emerald-500/10 text-emerald-600"
          delay={0.3} 
        />
        <MetricCard 
          title="Converted"
          value={stats?.converted||0}
          badge={`₹${(stats?.total_revenue_attributed||0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Rev`}
          icon={CheckCircle2}
          colorClass="bg-violet-500/10 text-violet-600"
          delay={0.4} 
        />
        <MetricCard 
          title="Failed"
          value={stats?.total_failed||0}
          icon={XCircle}
          colorClass="bg-red-500/10 text-red-600"
          delay={0.5} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
        
        {/* Conversion Funnel */}
        <div className="lg:col-span-1 frosted-glass-wrapper p-6 lg:p-8 rounded-3xl">
          <h3 className="text-foreground font-display text-2xl md:text-3xl mb-6">
            Engagement <span className="italic font-normal">Funnel</span>
          </h3>
          <div className="space-y-6">
            {[
              { label: "Sent", value: stats?.total_sent||0, color: "var(--accent)", pct: 100 },
              { label: "Delivered", value: stats?.total_delivered||0, color: "#a855f7", pct: stats?.total_sent ? (stats.total_delivered/stats.total_sent*100) : 0 },
              { label: "Opened", value: stats?.total_opened||0, color: "#3b82f6", pct: stats?.total_sent ? (stats.total_opened/stats.total_sent*100) : 0 },
              { label: "Clicked", value: stats?.total_clicked||0, color: "#10b981", pct: stats?.total_sent ? (stats.total_clicked/stats.total_sent*100) : 0 },
              { label: "Converted", value: stats?.converted||0, color: "#8b5cf6", pct: stats?.total_sent ? (stats.converted/stats.total_sent*100) : 0 },
            ].map((stage, i) => (
              <div key={stage.label}>
                <div className="flex justify-between text-xs mb-2 font-semibold">
                  <span className="text-muted-foreground">{stage.label}</span>
                  <span className="text-foreground">
                    {stage.value}
                    <span className="text-muted-foreground/50 ml-2 font-medium">
                      ({stage.pct.toFixed(0)}%)
                    </span>
                  </span>
                </div>
                <div className="h-2.5 bg-secondary/50 rounded-full overflow-hidden border border-border/30">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${stage.pct}%` }}
                    transition={{ duration: 1, delay: 0.3 + i * 0.15, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Communications Log */}
        <div className="lg:col-span-2 frosted-glass-wrapper rounded-3xl overflow-hidden flex flex-col h-[500px] lg:h-[600px]">
          <div className="p-5 md:p-6 border-b border-border/30 flex justify-between items-center bg-white/30 backdrop-blur-md">
            <h3 className="text-foreground font-display text-2xl md:text-3xl">
              Live <span className="italic font-normal">Delivery</span> Receipts
            </h3>
            <div className="flex items-center text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg border border-emerald-500/20">
              {stats?.status === 'completed' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
                  Completed
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
                  Syncing
                </>
              )}
            </div>
          </div>
          
          <div className="overflow-x-auto overflow-y-auto flex-1 p-2">
            <table className="w-full text-left min-w-[500px]">
              <thead>
                <tr>
                  {["Customer", "Recipient", "Status", "Delivered", "Clicked"].map(h => (
                    <th key={h} className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/30 bg-secondary/20 first:rounded-tl-lg last:rounded-tr-lg">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {stats?.communications?.map((comm, i) => (
                  <motion.tr
                    key={comm.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="hover:bg-white/40 transition-colors"
                  >
                    <td className="px-4 py-3 text-xs text-foreground font-semibold">
                      {comm.customer_name}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-muted-foreground font-mono">
                      {comm.recipient}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={comm.status} />
                    </td>
                    <td className="px-4 py-3 text-[11px] font-medium text-muted-foreground">
                      {comm.delivered_at 
                        ? new Date(comm.delivered_at).toLocaleTimeString('en-IN')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-[11px] font-medium text-muted-foreground">
                      {comm.clicked_at 
                        ? new Date(comm.clicked_at).toLocaleTimeString('en-IN')
                        : '—'}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            
            {(!stats?.communications || stats.communications.length === 0) && (
              <div className="text-center py-12 text-muted-foreground text-sm font-medium">
                No communications found for this campaign.
              </div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default CampaignDetail;
