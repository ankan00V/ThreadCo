import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Send, Sparkles, Loader2, MessageSquare, Target } from 'lucide-react';
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
  
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const selectedSegmentObj = segments.find(s => s.id === segmentId);

  useEffect(() => {
    const fetchSegs = async () => {
      try {
        const data = await getSegments();
        setSegments(data);
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
      setMessageTemplate(data.message);
      // We could also use data.subject_line or data.channel_recommendation if we wanted to build those out.
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
    <div className="max-w-6xl mx-auto space-y-6 pt-8 pb-12 px-4">
      <div className="flex items-center space-x-4 mb-8">
        <Link to="/campaigns" className="p-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-full transition-colors shadow-sm">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Campaign Builder</h1>
          <p className="text-gray-500 text-sm mt-1">Design and launch your communication strategy.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Form Left Side */}
        <div className="lg:col-span-7 space-y-8">
          
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-8">
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900 border-b border-gray-100 pb-3">1. Campaign Details</h2>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Internal Name</label>
                <input 
                  type="text"
                  placeholder="e.g. Q3 VIP Reactivation"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#6C47FF] focus:border-transparent outline-none transition-all shadow-inner"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-bold text-gray-700">Target Audience</label>
                  <Link to="/segments" className="text-xs font-bold text-[#E62328] hover:text-[#0A0B2E] flex items-center transition-colors">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Create segment with AI
                  </Link>
                </div>
                <select 
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#6C47FF] focus:border-transparent outline-none transition-all shadow-inner cursor-pointer"
                  value={segmentId}
                  onChange={e => setSegmentId(e.target.value)}
                >
                  <option value="" disabled className="text-gray-500 bg-white">Select a saved audience...</option>
                  {segments.map(s => (
                    <option key={s.id} value={s.id} className="text-gray-900 bg-white">{s.name} ({s.customer_count} shoppers)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Delivery Channel</label>
                <div className="flex gap-3 flex-wrap">
                  {['whatsapp', 'sms', 'email', 'rcs'].map(c => (
                    <button
                      key={c}
                      onClick={() => setChannel(c)}
                      className={`flex-1 min-w-[100px] py-3 text-sm font-bold rounded-xl uppercase tracking-wider transition-all duration-200 ${
                        channel === c 
                          ? 'bg-[#6C47FF] text-white shadow-md ring-2 ring-[#6C47FF] ring-offset-2' 
                          : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="space-y-6 pt-4">
              <h2 className="text-xl font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center">
                2. Message Content
              </h2>

              <div className="bg-purple-50 p-5 rounded-2xl border border-purple-100 space-y-4">
                <label className="block text-sm font-bold text-gray-900 flex items-center">
                  <Sparkles className="w-4 h-4 mr-2" />
                  AI Co-Pilot Prompt (Optional)
                </label>
                <div className="flex gap-3">
                  <input 
                    type="text"
                    placeholder="e.g. Write a friendly reminder about abandoned carts..."
                    className="flex-1 px-4 py-3 border border-purple-200 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-[#6C47FF] focus:border-transparent outline-none"
                    value={campaignGoal}
                    onChange={e => setCampaignGoal(e.target.value)}
                  />
                  <button 
                    onClick={handleGenerateAI}
                    disabled={isGenerating || !segmentId || !campaignGoal}
                    className="px-6 py-3 bg-[#0A0B2E] hover:bg-[#E62328] text-white font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center whitespace-nowrap shadow-sm"
                  >
                    {isGenerating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />}
                    Generate
                  </button>
                </div>
                <p className="text-xs text-purple-600/70 font-medium">AI will analyze your selected audience and automatically tailor the tone.</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Final Message Template</label>
                <textarea 
                  rows={6}
                  placeholder="Hi {{name}}, check out our Summer Sale — 40% off premium threads!"
                  className="w-full px-5 py-4 border border-gray-200 rounded-2xl bg-gray-50 text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#6C47FF] focus:border-transparent outline-none resize-none shadow-inner leading-relaxed"
                  value={messageTemplate}
                  onChange={e => setMessageTemplate(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-3 font-medium">
                  Use <span className="font-mono bg-gray-200 px-1.5 py-0.5 rounded text-[#6C47FF]">{"{{name}}"}</span> to inject the recipient's first name.
                </p>
              </div>
            </div>
            
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-bold flex items-center">
                <div className="w-2 h-2 rounded-full bg-red-500 mr-3 animate-pulse" />
                {error}
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <button 
              onClick={() => handleLaunchInit(true)}
              disabled={isLoading}
              className="flex-1 py-4 bg-white border-2 border-gray-200 text-gray-700 font-bold rounded-2xl hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50 shadow-sm"
            >
              Save as Draft
            </button>
            <button 
              onClick={() => handleLaunchInit(false)}
              disabled={isLoading}
              className="flex-[2] py-4 bg-[#E63329] text-white font-extrabold rounded-2xl hover:bg-[#cc2b22] shadow-lg shadow-red-500/20 flex justify-center items-center space-x-2 disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              <span>Dispatch Campaign</span>
            </button>
          </div>
        </div>

        {/* Live Preview Right Side */}
        <div className="lg:col-span-5 sticky top-8">
          <div className="bg-[#0A0A2E] rounded-[2.5rem] p-8 shadow-2xl border border-white/10 flex flex-col items-center">
            
            <div className="w-full flex items-center justify-between mb-8 pb-4 border-b border-white/10">
              <h3 className="text-sm font-bold text-white/50 uppercase tracking-widest flex items-center">
                <span className="w-2 h-2 rounded-full bg-green-400 mr-2 shadow-[0_0_8px_rgba(74,222,128,0.6)]"></span>
                Device Preview
              </h3>
              <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white flex items-center ${
                  channel === 'whatsapp' ? 'bg-[#25D366]' :
                  channel === 'sms' ? 'bg-[#4A90E2]' :
                  channel === 'rcs' ? 'bg-[#7015E7]' :
                  'bg-[#D44638]'
                }`}>
                {channel}
              </div>
            </div>
            
            {/* Fake Phone Screen */}
            <div className="w-full max-w-[320px] bg-white rounded-[2rem] p-4 shadow-2xl ring-8 ring-white/5 relative overflow-hidden min-h-[400px] flex flex-col">
              
              {/* Fake Phone Header */}
              <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-gray-100">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-md ${
                  channel === 'whatsapp' ? 'bg-[#25D366]' :
                  channel === 'sms' ? 'bg-[#4A90E2]' :
                  channel === 'rcs' ? 'bg-[#7015E7]' :
                  'bg-[#D44638]'
                }`}>
                  {channel.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-extrabold text-gray-900 text-sm">ThreadCo</div>
                  <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Verified Business</div>
                </div>
              </div>
              
              {/* Message Bubble */}
              {messageTemplate ? (
                <div className={`p-4 rounded-2xl relative shadow-sm text-sm leading-relaxed ${
                  channel === 'whatsapp' ? 'bg-[#E7FFDB] text-gray-800 rounded-tl-sm' :
                  channel === 'email' ? 'bg-gray-50 text-gray-800 border border-gray-200' :
                  'bg-[#E9E9EB] text-gray-800 rounded-tl-sm'
                }`}>
                  <p className="whitespace-pre-wrap font-medium">
                    {messageTemplate.replace(/\{\{name\}\}/g, 'Alex')}
                  </p>
                  
                  {channel === 'whatsapp' && (
                    <div className="absolute -left-2 top-0 w-3 h-3 bg-[#E7FFDB]" style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}></div>
                  )}
                  {channel !== 'whatsapp' && channel !== 'email' && (
                    <div className="absolute -left-2 top-0 w-3 h-3 bg-[#E9E9EB]" style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}></div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-300 space-y-3">
                  <MessageSquare className="w-12 h-12 stroke-1" />
                  <p className="text-xs font-bold text-center px-4">Your personalized message will appear here.</p>
                </div>
              )}
              
            </div>
            
          </div>
        </div>
        
      </div>
      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Confirm Dispatch</h3>
            <p className="text-gray-600 mb-8">
              This will send to <strong className="text-gray-900">{selectedSegmentObj?.customer_count}</strong> customers via <strong className="text-gray-900 uppercase">{channel}</strong>. Continue?
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleLaunch(false)}
                className="flex-[2] py-3 bg-[#E63329] text-white font-bold rounded-xl hover:bg-[#cc2b22] transition-colors"
              >
                Yes, Dispatch Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewCampaign;
