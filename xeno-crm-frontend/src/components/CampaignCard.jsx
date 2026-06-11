import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from "motion/react";
import { Send } from 'lucide-react';

export default function CampaignCard({ campaign }) {
  const navigate = useNavigate();

  return (
    <div className="service-card glass-card-hover cursor-pointer"
      onClick={() => navigate(`/campaigns/${campaign.id}`)}>

      {/* Top row */}
      <div className="flex justify-between items-start mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ 
            background: "rgba(108,71,255,0.15)",
            border: "1px solid rgba(108,71,255,0.2)"
          }}>
          <Send size={18} style={{ color: "#A48DFF" }} />
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium
          ${campaign.status === 'completed'
            ? 'bg-green-500/15 text-green-400 border-green-500/30'
            : campaign.status === 'running'
            ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
            : 'bg-white/5 text-white/40 border-white/10'
          }`}>
          {campaign.status}
        </span>
      </div>

      <h3 className="text-white font-semibold text-base mb-1 leading-tight">
        {campaign.name}
      </h3>
      
      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full 
                       uppercase border inline-block mb-4
        ${campaign.channel === 'whatsapp'
          ? 'bg-green-500/15 text-green-400 border-green-500/25'
          : campaign.channel === 'email'
          ? 'bg-blue-500/15 text-blue-400 border-blue-500/25'
          : 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25'
        }`}>
        {campaign.channel}
      </span>

      {/* Delivery bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1.5"
          style={{ color: "rgba(255,255,255,0.4)" }}>
          <span>Delivered</span>
          <span style={{ color: "rgba(255,255,255,0.7)" }}>
            {campaign.total_delivered}/{campaign.total_sent}
          </span>
        </div>
        <div className="h-1 rounded-full overflow-hidden"
          style={{ background: "rgba(255,255,255,0.06)" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ 
              width: campaign.total_sent > 0
                ? `${(campaign.total_delivered/campaign.total_sent*100).toFixed(0)}%`
                : '0%'
            }}
            transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #6C47FF, #A48DFF)" }}
          />
        </div>
      </div>

      <div className="flex gap-4 text-xs"
        style={{ color: "rgba(255,255,255,0.35)" }}>
        <span>Opened: <span style={{ color: "#10B981" }}>
          {campaign.total_sent > 0
            ? Math.round(campaign.total_opened/campaign.total_sent*100)
            : 0}%
        </span></span>
        <span>Clicked: <span style={{ color: "#F59E0B" }}>
          {campaign.total_sent > 0
            ? Math.round(campaign.total_clicked/campaign.total_sent*100)
            : 0}%
        </span></span>
      </div>

    </div>
  );
}
