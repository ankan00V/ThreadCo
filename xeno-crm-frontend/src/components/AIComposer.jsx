import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from "motion/react";
import Typewriter from './Typewriter';
import { generateSegment, createCampaign, sendCampaign } from '../api';

const AIComposer = ({ onSaved }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [campaignGoal, setCampaignGoal] = useState("");
  const [channel, setChannel] = useState("whatsapp");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [isLaunching, setIsLaunching] = useState(false);
  const [error, setError] = useState(null);

  const loadingTexts = [
    "🤔 Analysing your customer data...",
    "🔍 Scanning for matching audiences...",
    "✍️ Drafting personalized campaign copy...",
    "🧠 Applying AI reasoning to rules...",
    "✨ Almost ready..."
  ];
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);

  useEffect(() => {
    let interval;
    if (isLoading) {
      interval = setInterval(() => {
        setLoadingTextIndex((prev) => (prev + 1) % loadingTexts.length);
      }, 2000);
    } else {
      setLoadingTextIndex(0);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleGenerate = async () => {
    if (!query) return;
    setIsLoading(true);
    setError(null);
    setResult(null);
    setShowCampaignForm(false);
    
    try {
      const res = await generateSegment({
        query,
        campaign_goal: campaignGoal,
        channel,
        save: true
      });
      setResult(res);
      setCampaignName(`${res.segment?.name || 'Segment'} — ${new Date().toLocaleDateString('en-IN')}`);
    } catch (err) {
      setError(err.message || 'Failed to generate segment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLaunchCampaign = async () => {
    setIsLaunching(true);
    try {
      const campaign = await createCampaign({
        name: campaignName,
        segment_id: result.segment_id,
        channel: result.recommended_channel || channel,
        message_template: result.suggested_message.message?.body || result.suggested_message.message
      });
      
      await sendCampaign(campaign.id);
      if (onSaved) onSaved();
      navigate(`/campaigns/${campaign.id}`);
    } catch (err) {
      setError(err.message || 'Failed to launch campaign');
      setIsLaunching(false);
    }
  };

  const handleSaveSegment = () => {
    setIsSaving(true);
    setTimeout(() => {
      setResult(prev => ({...prev, saved: true}));
      setIsSaving(false);
      if (onSaved) onSaved();
    }, 500);
  };

  return (
    <div className="relative w-full text-left">

    {/* HEADER */}
    <div className="flex items-start justify-between mb-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-xl">✨</span>
        <h2 className="text-lg font-bold text-white aicomposer-title">
            AI Campaign Composer
          </h2>
        </div>
        <p className="text-white/60 text-sm ml-9 font-medium">
          Describe your audience in plain English — AI builds 
          the segment and message for you
        </p>
      </div>
    </div>

    {/* INPUT AREA */}
    <div className="space-y-3">

      {/* Main query textarea */}
      <textarea
        rows={3}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="e.g. High value customers in Mumbai who haven't ordered in 30 days"
        className="w-full glass-input rounded-2xl p-4 
                   text-white placeholder:text-white/40 
                   text-sm resize-none shadow-inner
                   focus:outline-none focus:border-red-600 
                   focus:ring-1 focus:ring-red-600
                   transition-all duration-200"
      />

      {/* Campaign goal + channel row */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          value={campaignGoal}
          onChange={(e) => setCampaignGoal(e.target.value)}
          placeholder="Campaign goal (e.g. Re-engage with a special offer)"
          className="flex-1 min-w-[200px] glass-input rounded-2xl px-4 py-2.5 
                     text-white placeholder:text-white/40 text-sm shadow-inner
                     focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600
                     transition-all duration-200"
        />

        {/* Channel pills */}
        <div className="flex gap-2">
          {["whatsapp", "sms", "email", "rcs"].map((ch) => {
            const colors = {
              whatsapp: "bg-green-600 border-green-600 shadow-[0_0_12px_rgba(22,163,74,0.4)] text-white",
              sms: "bg-yellow-600 border-yellow-600 shadow-[0_0_12px_rgba(202,138,4,0.4)] text-white",
              email: "bg-blue-600 border-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.4)] text-white",
              rcs: "bg-purple-600 border-purple-600 shadow-[0_0_12px_rgba(147,51,234,0.4)] text-white",
            };
            const isSelected = channel === ch;
            return (
              <button
                key={ch}
                onClick={() => setChannel(ch)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold 
                           border uppercase tracking-wide transition-all duration-300
                           ${isSelected
                             ? colors[ch]
                             : "border-white/20 text-white/50 hover:text-white hover:border-white/40 bg-white/5 shadow-sm backdrop-blur-md"
                           }`}
              >
                {ch}
              </button>
            );
          })}
        </div>
      </div>

      {error && <div className="text-sm text-red-400 mt-2 px-2">{error}</div>}

      {/* Generate button */}
      <motion.button
        onClick={handleGenerate}
        disabled={isLoading || !query.trim()}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="w-full py-3.5 rounded-full font-bold text-white text-sm
                   bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500
                   shadow-md hover:shadow-lg
                   disabled:opacity-40 disabled:cursor-not-allowed
                   transition-all duration-200 flex items-center 
                   justify-center gap-2"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10"
                stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Thinking...
          </>
        ) : (
          <>✨ Generate with AI</>
        )}
      </motion.button>
    </div>

    {/* LOADING SHIMMER STATE */}
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="mt-6 space-y-3"
        >
          <div className="h-6 flex items-center justify-center relative overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.p
                key={loadingTextIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="text-gray-500 font-medium text-sm absolute"
              >
                {loadingTexts[loadingTextIndex]}
              </motion.p>
            </AnimatePresence>
          </div>
          {[100, 75, 88].map((w, i) => (
            <div
              key={i}
              className="h-3 rounded-full loading-shimmer"
              style={{ width: `${w}%` }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>

    {/* RESULTS SECTION */}
    <AnimatePresence>
      {result && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6"
        >

          {/* LEFT — Audience Preview */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-black/5 dark:bg-white/5 backdrop-blur-md rounded-2xl p-5 
                       border border-black/10 dark:border-white/10 shadow-sm"
          >
            <p className="text-text-muted text-xs uppercase tracking-widest 
                          font-medium mb-3">
              Audience Preview
            </p>

            {/* Segment name with typewriter */}
            <h3 className="text-lg font-semibold mb-1"
                style={{
                  background: "linear-gradient(135deg, var(--color-brand-300), var(--color-brand-500))",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}>
              <Typewriter
                text={result.segment?.name || ""}
                delay={0.2}
                speed={0.02}
              />
            </h3>

            <p className="text-text-secondary text-sm mb-4">
              {result.segment?.description}
            </p>

            {/* Customer count pill */}
            <span className="inline-flex items-center gap-1.5 text-sm 
                             font-semibold px-3 py-1 rounded-full
                             bg-brand-500/10 text-brand-500 dark:text-brand-300 
                             border border-brand-500/20 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
              {result.segment?.customer_count} customers matched
            </span>

            {/* Filter tags */}
            {result.segment?.filters && (
              <div className="flex flex-wrap gap-2 mb-4">
                {Object.entries(result.segment.filters)
                  .filter(([_, v]) => v !== null && v !== undefined)
                  .map(([k, v]) => (
                    <span
                      key={k}
                      className="text-xs px-2.5 py-1 rounded-lg 
                                 bg-surface-hover text-text-secondary 
                                 border border-surface-border"
                    >
                      {k.replace(/_/g, " ")}: {String(v)}
                    </span>
                  ))}
              </div>
            )}

            {/* Customer list — first 5 */}
            <div className="space-y-2">
              {result.matched_customers?.slice(0, 5).map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.06 }}
                  className="flex items-center justify-between 
                             bg-black/5 dark:bg-white/5 rounded-xl px-3 py-2 border border-black/5 dark:border-white/10"
                >
                  <div>
                    <p className="text-text-primary text-sm font-medium">
                      {c.name}
                    </p>
                    <p className="text-text-muted text-xs">{c.city}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-brand-500 dark:text-brand-300 text-xs font-semibold">
                      ₹{c.total_spent?.toLocaleString("en-IN")}
                    </p>
                    <div className="flex gap-1 justify-end mt-1">
                      {c.tags?.slice(0, 2).map((tag) => {
                        const tc = {
                          vip: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
                          loyal: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
                          churned: "bg-red-500/20 text-red-600 dark:text-red-400",
                          new: "bg-green-500/20 text-green-600 dark:text-green-400",
                        };
                        return (
                          <span
                            key={tag}
                            className={`text-[10px] px-1.5 py-0.5 font-medium
                                       rounded-full ${tc[tag] || "bg-surface-border text-text-secondary"}`}
                          >
                            {tag}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              ))}
              {result.matched_customers?.length > 5 && (
                <p className="text-brand-500 dark:text-brand-400 text-xs text-center pt-1 font-medium
                              cursor-pointer hover:opacity-80">
                  +{result.matched_customers.length - 5} more customers
                </p>
              )}
            </div>
          </motion.div>

          {/* RIGHT — Suggested Message */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-black/5 dark:bg-white/5 backdrop-blur-md rounded-2xl p-5 
                       border border-black/10 dark:border-white/10 shadow-sm flex flex-col"
          >
            <p className="text-text-muted text-xs uppercase tracking-widest 
                          font-medium mb-3">
              Suggested Message
            </p>

            {/* Channel + open rate row */}
            <div className="flex items-center gap-3 mb-4">
              <span className={`text-xs font-semibold px-3 py-1 
                               rounded-full uppercase ${
                                 result.recommended_channel === "whatsapp"
                                   ? "bg-green-500/20 text-green-600 dark:text-green-400"
                                   : result.recommended_channel === "email"
                                   ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                                   : result.recommended_channel === "sms"
                                   ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                                   : "bg-purple-500/20 text-purple-600 dark:text-purple-400"
                               }`}>
                {result.recommended_channel || channel}
              </span>
              <span className="text-text-muted font-medium text-xs">
                ~{result.suggested_message?.estimated_open_rate} open rate
              </span>
            </div>

            {/* Email subject line */}
            {result.suggested_message?.subject_line && (
              <p className="text-text-secondary font-medium text-sm mb-2">
                <span className="text-text-muted text-xs uppercase mr-2">Subject</span>
                {result.suggested_message.subject_line}
              </p>
            )}

            {/* Phone mockup message bubble */}
            <div className="bg-surface-base/80 rounded-2xl p-4 border 
                            border-surface-border mb-4 flex-1">
              <div className="bg-brand-500/10 border border-brand-500/20 
                              rounded-2xl rounded-tl-sm p-4">
                <p className="text-text-primary text-sm leading-relaxed whitespace-pre-wrap">
                  {result.suggested_message?.message?.body || result.suggested_message?.message}
                </p>
              </div>
            </div>

            {/* Channel recommendation reason */}
            {result.suggested_message?.channel_recommendation && (
              <p className="text-text-muted text-xs italic border-l-2 
                            border-brand-500/40 pl-3 mb-5">
                {result.suggested_message.channel_recommendation}
              </p>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 pt-4 border-t border-surface-border">
              <button
                onClick={handleSaveSegment}
                disabled={isSaving || result.saved}
                className="flex-1 py-2.5 rounded-xl border border-surface-border 
                           text-text-secondary text-sm font-medium
                           hover:bg-surface-hover hover:text-text-primary
                           disabled:opacity-40 transition-all duration-200 bg-black/5 dark:bg-white/5"
              >
                {result.saved ? "✓ Saved" : "Save Segment"}
              </button>
              <button
                onClick={() => setShowCampaignForm(true)}
                className="flex-1 py-2.5 rounded-xl text-white text-sm 
                           font-semibold bg-brand-500 hover:bg-brand-600
                           shadow-[0_4px_16px_rgba(108,71,255,0.25)]
                           hover:shadow-[0_4px_24px_rgba(108,71,255,0.4)]
                           transition-all duration-200"
              >
                Create Campaign →
              </button>
            </div>

            {/* Inline campaign launch form */}
            <AnimatePresence>
              {showCampaignForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 p-4 bg-black/5 dark:bg-white/5 rounded-2xl 
                                  border border-black/10 dark:border-white/10 space-y-3">
                    <input
                      type="text"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      placeholder="Campaign name"
                      className="w-full bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 
                                 rounded-xl px-4 py-2.5 text-text-primary 
                                 placeholder:text-text-muted text-sm
                                 focus:outline-none focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/20
                                 transition-all duration-200"
                    />

                    <p className="text-status-warning text-xs font-medium">
                      ⚠ This will dispatch messages to{" "}
                      {result.segment?.customer_count} customers immediately.
                    </p>

                    <button
                      onClick={handleLaunchCampaign}
                      disabled={isLaunching || !campaignName.trim()}
                      className="w-full py-3 rounded-xl text-white 
                                 font-semibold text-sm
                                 bg-brand-500 hover:bg-brand-600
                                 shadow-[0_4px_20px_rgba(108,71,255,0.3)]
                                 disabled:opacity-40 transition-all duration-200
                                 flex items-center justify-center gap-2"
                    >
                      {isLaunching ? (
                        <>
                          <svg className="animate-spin h-4 w-4" 
                               viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" 
                              r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          Launching...
                        </>
                      ) : (
                        "🚀 Launch Campaign"
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

        </motion.div>
      )}
    </AnimatePresence>

  </div>
  );
};

export default AIComposer;
