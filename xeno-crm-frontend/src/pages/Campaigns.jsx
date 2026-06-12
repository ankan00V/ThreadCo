import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCampaigns, deleteCampaign } from '../api';
import { Plus, Trash2 } from 'lucide-react';

export default function Campaigns() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCampaigns().then(data => {
      setCampaigns(data);
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
    <div className="w-full px-3 sm:px-4 pt-8 mt-2 max-w-[1100px] mx-auto pb-12 font-['Inter']">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 px-2 gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-white rounded-full px-3 py-1.5 shadow-sm mb-4 border border-neutral-200">
            <span className="w-2 h-2 rounded-full bg-[#ef4d23]"></span>
            <span className="text-[12px] font-semibold text-neutral-800">Campaign Manager</span>
          </div>
          <h1 className="text-[#0b0f1a] font-medium" style={{ fontSize: "clamp(28px, 5vw, 42px)", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            Marketing <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontWeight: 400 }}>Campaigns</span>
          </h1>
          <p className="text-neutral-500 mt-2 text-[14px]">Manage and track your multi-channel marketing campaigns.</p>
        </div>
        <button onClick={() => navigate('/campaigns/new')} className="flex items-center gap-2 bg-[#ef4d23] hover:bg-[#d9421b] text-white px-5 py-2.5 rounded-full font-semibold transition-all shadow-sm">
          <Plus size={18} strokeWidth={2.5} /> New Campaign
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-neutral-500 flex flex-col items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ef4d23] mb-4"></div>
          <span className="text-[14px]">Loading campaigns...</span>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-neutral-200 shadow-sm">
          <h3 className="text-xl font-semibold text-[#0b0f1a] mb-2">No campaigns yet</h3>
          <p className="text-neutral-500 text-[14px]">Click 'New Campaign' to create your first one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map(c => {
            const statusColor = c.status === 'completed' ? 'bg-green-100 text-green-700' :
                                c.status === 'sending' || c.status === 'running' ? 'bg-blue-100 text-blue-700' :
                                'bg-neutral-100 text-neutral-600';
            const channelColor = c.channel === 'whatsapp' ? 'bg-[#25D366]/10 text-[#25D366]' :
                                 c.channel === 'email' ? 'bg-purple-100 text-purple-700' :
                                 'bg-orange-100 text-orange-700';

            return (
              <div key={c.id} onClick={() => navigate(`/campaigns/${c.id}`)} className="group bg-white rounded-2xl p-6 cursor-pointer border border-neutral-200 shadow-sm hover:shadow-md hover:border-[#ef4d23]/30 transition-all flex flex-col relative overflow-hidden">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-[16px] font-semibold text-[#0b0f1a] truncate pr-4">{c.name}</h3>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[11px] font-medium px-2 py-1 rounded-md capitalize ${statusColor}`}>
                      {c.status || 'draft'}
                    </span>
                    <button 
                      onClick={(e) => handleDelete(e, c.id)}
                      className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                      title="Delete Campaign"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                
                <div className="mb-5">
                  <span className={`inline-flex items-center text-[11px] font-medium px-2 py-1 rounded-md capitalize ${channelColor}`}>
                    {c.channel || 'unknown'}
                  </span>
                </div>

                <div className="text-[13px] text-neutral-500 mb-6 flex-grow flex items-end">
                  <div className="w-full">
                    {c.status !== 'draft' ? (
                      <div className="flex items-center justify-between bg-neutral-50 p-2.5 rounded-lg border border-neutral-100">
                        <div className="flex flex-col"><span className="text-[10px] uppercase text-neutral-400 font-semibold">Sent</span><span className="font-medium text-neutral-700">{c.total_sent || 0}</span></div>
                        <div className="w-px h-6 bg-neutral-200"></div>
                        <div className="flex flex-col"><span className="text-[10px] uppercase text-neutral-400 font-semibold">Delivered</span><span className="font-medium text-neutral-700">{c.total_delivered || 0}</span></div>
                        <div className="w-px h-6 bg-neutral-200"></div>
                        <div className="flex flex-col"><span className="text-[10px] uppercase text-neutral-400 font-semibold">Clicked</span><span className="font-medium text-neutral-700">{c.total_clicked || 0}</span></div>
                      </div>
                    ) : (
                      <div className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-100 text-center text-[12px] text-neutral-400">
                        Draft Campaign
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center text-[12px] border-t border-neutral-100 pt-4 mt-auto">
                  <span className="text-neutral-400">Created {c.created_at ? new Date(c.created_at).toLocaleDateString() : 'N/A'}</span>
                  <span className="text-[#ef4d23] font-medium opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0 duration-300">
                    View Analytics &rarr;
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
