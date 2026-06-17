import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from "motion/react";
import { getCampaignStats, checkCampaignCompletion } from '../api';
import { ArrowLeft, CheckCircle2, XCircle, MailOpen, MousePointerClick, RefreshCw } from 'lucide-react';

const StatusBadge = ({ status }) => {
  const styles = {
    queued: 'bg-gray-100 text-gray-600 border-gray-200',
    delivered: 'bg-purple-50 text-purple-700 border-purple-200',
    opened: 'bg-blue-50 text-blue-700 border-blue-200',
    clicked: 'bg-green-50 text-green-700 border-green-200',
    converted: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    failed: 'bg-red-50 text-red-700 border-red-200'
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${styles[status] || styles.queued}`}>
      {status}
    </span>
  );
};

const MetricCard = ({ title, value, badge, icon: Icon, colorClass, delay }) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4 }}
    className="bg-[#fcfaf5] p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between"
  >
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-2xl ${colorClass}`}>
        <Icon className="w-6 h-6" />
      </div>
      {badge && (
        <span className="px-2.5 py-1 bg-gray-50 text-gray-600 text-xs font-bold rounded-lg border border-gray-200 whitespace-nowrap">
          {badge}
        </span>
      )}
    </div>
    <div>
      <h3 className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-1">{title}</h3>
      <div className="text-3xl font-extrabold text-gray-900">{value}</div>
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
      <div className="flex items-center justify-center h-64 text-gray-400 font-medium">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        Loading campaign details...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pt-8">
      {/* Top Header */}
      <div className="flex items-center space-x-4 mb-8">
        <button onClick={() => navigate('/campaigns')}
          className="p-2 bg-[#fcfaf5] border border-gray-200 hover:bg-gray-50 rounded-full transition-colors shadow-sm">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              {stats?.name}
            </h1>
            <span className={`text-xs px-3 py-1.5 rounded-full border font-bold uppercase tracking-wider
              ${stats?.status === 'completed' 
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
              {stats?.status}
            </span>
            <span className="text-xs px-3 py-1.5 rounded-full border bg-purple-50 text-purple-700 border-purple-200 font-bold uppercase tracking-wider">
              {stats?.channel}
            </span>
          </div>
          <p className="text-gray-500 text-sm mt-2 font-medium flex items-center">
            Dispatched on {stats?.sent_at 
              ? new Date(stats.sent_at).toLocaleDateString('en-IN', {
                  day:'numeric', month:'long', year:'numeric',
                  hour:'2-digit', minute:'2-digit'
                })
              : '—'}
            <span className="mx-2">•</span>
            {stats?.total_sent || 0} Recipients
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricCard 
          title="Delivered"
          value={`${stats?.total_delivered||0}`}
          badge={`${(stats?.delivery_rate||0).toFixed(0)}% Rate`}
          icon={CheckCircle2}
          colorClass="bg-purple-100 text-purple-600"
          delay={0.1} 
        />
        <MetricCard 
          title="Opened"
          value={stats?.total_opened||0}
          badge={`${(stats?.open_rate||0).toFixed(0)}% Rate`}
          icon={MailOpen}
          colorClass="bg-blue-100 text-blue-600"
          delay={0.2} 
        />
        <MetricCard 
          title="Clicked"
          value={stats?.total_clicked||0}
          badge={`${(stats?.click_rate||0).toFixed(0)}% Rate`}
          icon={MousePointerClick}
          colorClass="bg-green-100 text-green-600"
          delay={0.3} 
        />
        <MetricCard 
          title="Converted"
          value={stats?.converted||0}
          badge={`₹${(stats?.total_revenue_attributed||0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Rev`}
          icon={CheckCircle2}
          colorClass="bg-emerald-100 text-emerald-600"
          delay={0.4} 
        />
        <MetricCard 
          title="Failed"
          value={stats?.total_failed||0}
          icon={XCircle}
          colorClass="bg-red-100 text-red-600"
          delay={0.5} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Conversion Funnel */}
        <div className="lg:col-span-1 bg-[#fcfaf5] p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-gray-900 font-bold text-lg mb-6 flex items-center">
            Engagement Funnel
          </h3>
          <div className="space-y-6">
            {[
              { label: "Sent", value: stats?.total_sent||0, color: "#6C47FF", pct: 100 },
              { label: "Delivered", value: stats?.total_delivered||0, color: "#A48DFF", pct: stats?.total_sent ? (stats.total_delivered/stats.total_sent*100) : 0 },
              { label: "Opened", value: stats?.total_opened||0, color: "#3B82F6", pct: stats?.total_sent ? (stats.total_opened/stats.total_sent*100) : 0 },
              { label: "Clicked", value: stats?.total_clicked||0, color: "#10B981", pct: stats?.total_sent ? (stats.total_clicked/stats.total_sent*100) : 0 },
              { label: "Converted", value: stats?.converted||0, color: "#059669", pct: stats?.total_sent ? (stats.converted/stats.total_sent*100) : 0 },
            ].map((stage, i) => (
              <div key={stage.label}>
                <div className="flex justify-between text-sm mb-2 font-bold">
                  <span className="text-gray-600">{stage.label}</span>
                  <span className="text-gray-900">
                    {stage.value}
                    <span className="text-gray-400 ml-2 font-medium">
                      ({stage.pct.toFixed(0)}%)
                    </span>
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${stage.pct}%` }}
                    transition={{ duration: 1, delay: 0.3 + i * 0.15, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ background: stage.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Communications Log */}
        <div className="lg:col-span-2 bg-[#fcfaf5] rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full max-h-[600px]">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <h3 className="text-gray-900 font-bold text-lg">
              Live Delivery Receipts
            </h3>
            <div className="flex items-center text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
              {stats?.status === 'completed' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-green-500" />
                  Completed
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
                  Syncing
                </>
              )}
            </div>
          </div>
          
          <div className="overflow-auto flex-1 p-2">
            <table className="w-full text-left">
              <thead>
                <tr>
                  {["Customer", "Recipient", "Status", "Delivered", "Clicked"].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats?.communications?.map((comm, i) => (
                  <motion.tr
                    key={comm.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                  >
                    <td className="px-4 py-4 text-sm text-gray-900 font-bold">
                      {comm.customer_name}
                    </td>
                    <td className="px-4 py-4 text-xs text-gray-500 font-mono">
                      {comm.recipient}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={comm.status} />
                    </td>
                    <td className="px-4 py-4 text-xs font-medium text-gray-500">
                      {comm.delivered_at 
                        ? new Date(comm.delivered_at).toLocaleTimeString('en-IN')
                        : '—'}
                    </td>
                    <td className="px-4 py-4 text-xs font-medium text-gray-500">
                      {comm.clicked_at 
                        ? new Date(comm.clicked_at).toLocaleTimeString('en-IN')
                        : '—'}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            
            {stats?.communications?.length === 0 && (
              <div className="text-center py-12 text-gray-500 font-medium">
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
