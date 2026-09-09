import React, { useState, useEffect } from 'react';
import Loader from '../components/Loader';
import { useNavigate } from 'react-router-dom';
import { getCampaigns, deleteCampaign } from '../api';
import { Plus, Trash2, Sparkles, ArrowRight } from 'lucide-react';

export default function Campaigns() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCampaigns().then(data => {
      setCampaigns(data || []);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this campaign? This cannot be undone.")) {
      try {
        await deleteCampaign(id);
        setCampaigns(prev => prev.filter(c => c.id !== id));
      } catch (err) {
        console.error("Failed to delete campaign:", err);
        alert("Failed to delete campaign");
      }
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 md:px-12 max-w-[1100px] mx-auto pt-8 md:pt-12 pb-24 font-body">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 backdrop-blur-md px-4 py-1.5 text-xs text-muted-foreground font-body mb-3 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span>Campaign Studio</span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl text-foreground tracking-tight leading-[0.98]">
            Marketing & Lifecycle <span className="font-display italic font-normal text-accent">Campaigns</span>
          </h1>
          <p className="text-muted-foreground mt-3 text-sm md:text-base max-w-xl font-body">
            Manage, trigger, and track your multi-channel automated campaigns with real-time delivery logs.
          </p>
        </div>
        
        <button 
          onClick={() => navigate('/campaigns/new')} 
          className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-accent-foreground px-5 py-2.5 rounded-full font-medium text-xs sm:text-sm transition-all shadow-sm shrink-0 active:scale-95"
        >
          <Plus size={16} strokeWidth={2.5} /> 
          <span>New Campaign</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground flex flex-col items-center">
          <Loader className="mb-4" label="Loading campaigns" />
          <span className="text-xs">Loading campaign registry...</span>
        </div>
      ) : campaigns.length === 0 ? (
        <div 
          className="rounded-2xl p-12 text-center"
          style={{
            background: 'rgba(255, 255, 255, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.5)',
            boxShadow: 'var(--shadow-dashboard)',
            backdropFilter: 'blur(16px)'
          }}
        >
          <h3 className="text-lg font-semibold text-foreground mb-1">No campaigns created yet</h3>
          <p className="text-muted-foreground text-xs mb-5">Click 'New Campaign' to build your first segment broadcast.</p>
          <button 
            onClick={() => navigate('/campaigns/new')}
            className="bg-accent text-accent-foreground px-5 py-2 rounded-full text-xs font-medium shadow-sm hover:opacity-90"
          >
            Create First Campaign
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {campaigns.map(c => {
            const status = (c.status || 'draft').toLowerCase();
            let statusStyle = 'bg-secondary text-muted-foreground border-border';
            if (status === 'completed') statusStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
            else if (status === 'sending' || status === 'running') statusStyle = 'bg-accent/10 text-accent border-accent/20';
            else if (status === 'failed') statusStyle = 'bg-rose-50 text-rose-700 border-rose-200';

            const channel = (c.channel || 'email').toLowerCase();
            let channelBadge = 'bg-purple-50 text-purple-700 border-purple-200';
            if (channel === 'whatsapp') channelBadge = 'bg-emerald-50 text-emerald-700 border-emerald-200';
            else if (channel === 'sms') channelBadge = 'bg-blue-50 text-blue-700 border-blue-200';

            return (
              <div 
                key={c.id} 
                onClick={() => navigate(`/campaigns/${c.id}`)} 
                className="group rounded-2xl p-5 cursor-pointer flex flex-col relative overflow-hidden transition-all hover:scale-[1.01] border border-white/60 hover:border-accent/40 shadow-sm hover:shadow-md"
                style={{
                  background: 'rgba(255, 255, 255, 0.45)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)'
                }}
              >
                <div className="flex justify-between items-start mb-2.5">
                  <h3 className="text-sm font-semibold text-foreground truncate pr-3 group-hover:text-accent transition-colors">{c.name}</h3>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize border ${statusStyle}`}>
                      {c.status || 'draft'}
                    </span>
                    <button 
                      onClick={(e) => handleDelete(e, c.id)}
                      className="p-1 text-muted-foreground hover:text-rose-600 hover:bg-white/80 rounded-md transition-colors"
                      title="Delete Campaign"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                
                <div className="mb-4">
                  <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full capitalize border ${channelBadge}`}>
                    {c.channel || 'multi-channel'}
                  </span>
                </div>

                <div className="text-xs text-muted-foreground mb-5 flex-grow flex items-end">
                  <div className="w-full">
                    {c.status !== 'draft' ? (
                      <div className="flex items-center justify-between bg-white/60 p-2.5 rounded-xl border border-white/80 shadow-inner">
                        <div className="flex flex-col">
                          <span className="text-[9px] uppercase text-muted-foreground font-semibold">Sent</span>
                          <span className="font-semibold text-foreground text-xs">{c.total_sent || 0}</span>
                        </div>
                        <div className="w-px h-5 bg-border/60"></div>
                        <div className="flex flex-col">
                          <span className="text-[9px] uppercase text-muted-foreground font-semibold">Delivered</span>
                          <span className="font-semibold text-foreground text-xs">{c.total_delivered || 0}</span>
                        </div>
                        <div className="w-px h-5 bg-border/60"></div>
                        <div className="flex flex-col">
                          <span className="text-[9px] uppercase text-muted-foreground font-semibold">Clicks</span>
                          <span className="font-semibold text-foreground text-xs">{c.total_clicked || 0}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white/60 p-2.5 rounded-xl border border-white/80 text-center text-[11px] text-muted-foreground">
                        Draft Campaign
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center text-[11px] border-t border-border/40 pt-3 mt-auto">
                  <span className="text-muted-foreground">Created {c.created_at ? new Date(c.created_at).toLocaleDateString() : 'N/A'}</span>
                  <span className="text-accent font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-1 group-hover:translate-x-0">
                    Analytics <ArrowRight size={12} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
