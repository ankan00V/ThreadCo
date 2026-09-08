import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Send, Sparkles, Loader2, MessageSquare, Target, Smartphone } from 'lucide-react';
import { getSegments, createCampaign, sendCampaign, generateMessage } from '../api';

const NewCampaign = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillSegmentId = searchParams.get('segment_id');

  const [segments, setSegments] = useState([]);
  const [name, setName] = useState('');
  const [segmentId, setSegmentId] = useState(prefillSegmentId || '');
  const [channel, setChannel] = useState('whatsapp');
  const [campaignGoal, setCampaignGoal] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const selectedSegmentObj = segments.find(s => s.id === segmentId);

  useEffect(() => {
    const fetchSegs = async () => {
      try {
        const data = await getSegments();
        setSegments(data || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchSegs();
  }, []);

  const handleGenerateAI = async () => {
    if (!segmentId) {
      setError("Please select an audience segment first so the AI knows who to talk to.");
      return;
    }
    if (!campaignGoal) {
      setError("Please enter a brief campaign goal for the AI (e.g., 'Announce our summer sale').");
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      const data = await generateMessage({
        segment_id: segmentId,
        channel: channel,
        campaign_goal: campaignGoal
      });
      setMessageTemplate(data.message.body || data.message);
      if (data.message.subject && channel === 'email') {
        setEmailSubject(data.message.subject);
      }
    } catch (err) {
      console.error(err);
      setError("AI Generation failed. Please try again or write manually.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLaunchInit = (draftOnly = false) => {
    if (!name || !segmentId || !messageTemplate) {
      setError("Please fill in all required fields (Name, Segment, Message).");
      return;
    }
    
    if (draftOnly) {
      handleLaunch(true);
    } else {
      setShowConfirmModal(true);
    }
  };

  const handleLaunch = async (draftOnly = false) => {
    setIsLoading(true);
    setError(null);
    setShowConfirmModal(false);
    
    let campaign;
    try {
      campaign = await createCampaign({
        name,
        segment_id: segmentId,
        channel,
        message_template: messageTemplate
      });
    } catch (err) {
      setError(err.message || "Failed to create campaign.");
      setIsLoading(false);
      return;
    }

    if (!draftOnly) {
      try {
        await sendCampaign(campaign.id);
      } catch (err) {
        setError(err.message || "Failed to dispatch campaign. Draft was saved.");
        setIsLoading(false);
        return;
      }
    }
    
    navigate(`/campaigns/${campaign.id}`);
  };

  return (
    <div className="w-full px-4 sm:px-6 md:px-12 max-w-[1100px] mx-auto pt-8 md:pt-12 pb-24 font-body">
      
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link 
          to="/campaigns" 
          className="p-2.5 bg-white/70 border border-white/80 hover:bg-white backdrop-blur-md rounded-full transition-colors shadow-sm text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 backdrop-blur-md px-3.5 py-1 text-xs text-muted-foreground font-body mb-2 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span>Campaign Studio</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl text-foreground tracking-tight leading-[0.98]">
            Launch a <span className="font-display italic font-normal text-accent">New Campaign</span>
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Form Left Side */}
        <div className="lg:col-span-7 space-y-6">
          
          <div 
            className="rounded-2xl p-6 sm:p-8 space-y-6"
            style={{
              background: 'rgba(255, 255, 255, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.5)',
              boxShadow: 'var(--shadow-dashboard)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)'
            }}
          >
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-foreground border-b border-border/40 pb-2">1. Campaign Configuration</h2>
              
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Internal Campaign Name</label>
                <input 
                  type="text"
                  placeholder="e.g. Q3 VIP Reactivation Wave"
                  className="w-full px-3.5 py-2.5 bg-white/70 border border-white/80 rounded-xl text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-all shadow-inner"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-medium text-foreground">Target Audience Cohort</label>
                  <Link to="/segments" className="text-xs font-medium text-accent hover:underline flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>Create segment with AI</span>
                  </Link>
                </div>
                <select 
                  className="w-full px-3.5 py-2.5 bg-white/70 border border-white/80 rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent shadow-sm cursor-pointer"
                  value={segmentId}
                  onChange={e => setSegmentId(e.target.value)}
                >
                  <option value="" disabled>Select a target audience segment...</option>
                  {segments.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.customer_count || 0} customers)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-2">Delivery Channel</label>
                <div className="flex gap-2 flex-wrap">
                  {['whatsapp', 'sms', 'email', 'rcs'].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setChannel(c)}
                      className={`px-4 py-2 text-xs font-semibold rounded-full uppercase tracking-wider transition-all duration-200 ${
                        channel === c 
                          ? 'bg-accent text-accent-foreground shadow-sm ring-2 ring-accent/30' 
                          : 'bg-white/60 border border-white/80 text-muted-foreground hover:bg-white hover:text-foreground'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="space-y-4 pt-2">
              <h2 className="text-sm font-semibold text-foreground border-b border-border/40 pb-2">
                2. Message Content & AI Co-Pilot
              </h2>

              <div className="bg-accent/5 p-4 rounded-xl border border-accent/15 space-y-3">
                <label className="block text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  <span>AI Co-Pilot Prompt (Optional)</span>
                </label>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="e.g. Write a friendly reminder about abandoned carts..."
                    className="flex-1 px-3.5 py-2 bg-white/80 border border-white/90 rounded-xl text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent shadow-inner"
                    value={campaignGoal}
                    onChange={e => setCampaignGoal(e.target.value)}
                  />
                  <button 
                    type="button"
                    onClick={handleGenerateAI}
                    disabled={isGenerating || !segmentId || !campaignGoal}
                    className="px-4 py-2 bg-accent hover:bg-accent/90 text-accent-foreground font-medium rounded-full text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0 shadow-sm"
                  >
                    {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    <span>Generate</span>
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">AI will analyze your selected audience and automatically tailor the message voice.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Final Message Copy</label>
                <textarea 
                  rows={5}
                  placeholder="Hi {{name}}, discover our exclusive summer styles — 40% off premium threads!"
                  className="w-full px-4 py-3 bg-white/70 border border-white/80 rounded-xl text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent resize-none shadow-inner leading-relaxed"
                  value={messageTemplate}
                  onChange={e => setMessageTemplate(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground mt-2 font-medium">
                  Use <span className="font-mono bg-white/80 px-1.5 py-0.5 rounded text-accent border border-border/50">{"{{name}}"}</span> to inject the customer's first name dynamically.
                </p>
              </div>
            </div>
            
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button 
              type="button"
              onClick={() => handleLaunchInit(true)}
              disabled={isLoading}
              className="flex-1 py-3 bg-white/70 border border-white/80 text-foreground font-medium text-xs rounded-full hover:bg-white transition-colors disabled:opacity-50 shadow-sm"
            >
              Save as Draft
            </button>
            <button 
              type="button"
              onClick={() => handleLaunchInit(false)}
              disabled={isLoading}
              className="flex-[2] py-3 bg-accent text-accent-foreground font-medium text-xs rounded-full hover:bg-accent/90 shadow-md flex justify-center items-center gap-2 disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>Dispatch Campaign</span>
            </button>
          </div>
        </div>

        {/* Live Preview Right Side */}
        <div className="lg:col-span-5 sticky top-8">
          <div 
            className="rounded-2xl p-6 shadow-sm flex flex-col items-center"
            style={{
              background: 'rgba(255, 255, 255, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.5)',
              boxShadow: 'var(--shadow-dashboard)',
              backdropFilter: 'blur(16px)'
            }}
          >
            <div className="w-full flex items-center justify-between mb-6 pb-3 border-b border-border/40">
              <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Device Preview</span>
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-accent/10 text-accent border border-accent/20">
                {channel}
              </span>
            </div>
            
            {/* Phone Screen Mockup */}
            <div className="w-full max-w-[290px] bg-white/90 backdrop-blur rounded-2xl p-4 shadow-lg border border-border/60 relative overflow-hidden min-h-[380px] flex flex-col">
              {/* Header */}
              <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-border/40">
                <div className="w-8 h-8 rounded-full bg-accent/15 text-accent font-bold flex items-center justify-center text-xs shadow-inner">
                  T
                </div>
                <div>
                  <div className="font-semibold text-foreground text-xs">ThreadCo</div>
                  <div className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">Verified Business</div>
                </div>
              </div>
              
              {/* Message Bubble */}
              {messageTemplate ? (
                <div className="bg-secondary/60 text-foreground border border-border/60 p-3.5 rounded-2xl rounded-tl-sm text-xs leading-relaxed w-full font-medium">
                  {messageTemplate.replace(/\{\{name\}\}/g, 'Alex')}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <MessageSquare className="w-8 h-8 opacity-40" />
                  <p className="text-[11px] text-center px-4">Your personalized message will render here in real time.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white/95 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-white/80">
            <h3 className="text-sm font-bold text-foreground mb-2">Confirm Live Dispatch</h3>
            <p className="text-xs text-muted-foreground mb-6">
              This will dispatch messages to <strong className="text-foreground">{selectedSegmentObj?.customer_count || 0}</strong> customers via <strong className="text-foreground uppercase">{channel}</strong>.
            </p>
            <div className="flex gap-2.5">
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2 bg-secondary text-foreground text-xs font-medium rounded-full hover:bg-secondary/80 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleLaunch(false)}
                className="flex-[1.5] py-2 bg-accent text-accent-foreground text-xs font-medium rounded-full hover:bg-accent/90 transition-colors shadow-sm"
              >
                Dispatch Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewCampaign;
