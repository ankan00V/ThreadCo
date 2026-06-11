import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSegments } from '../api';
import AIComposer from '../components/AIComposer';
import { ChevronRight } from 'lucide-react';

const Segments = () => {
  const navigate = useNavigate();
  const [segments, setSegments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSegments = async () => {
    setIsLoading(true);
    try {
      const data = await getSegments();
      setSegments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSegments();
  }, []);

  return (
    <div className="w-full px-3 sm:px-4 pt-8 mt-2 max-w-[1100px] mx-auto pb-12 font-['Inter']">
      
      {/* Header */}
      <div className="mb-6 px-2 text-center flex flex-col items-center">
        <div className="inline-flex items-center gap-2 bg-white rounded-full px-3 py-1.5 shadow-sm mb-4 border border-neutral-200">
          <span className="w-2 h-2 rounded-full bg-[#ef4d23]"></span>
          <span className="text-[12px] font-semibold text-neutral-800">Targeting Engine</span>
        </div>
        
        <h2 className="text-[#0b0f1a] font-medium" style={{ fontSize: "clamp(28px, 5vw, 42px)", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
          AI-Driven <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontWeight: 400 }}>Segments</span>
        </h2>
        
        <p className="text-neutral-500 mt-3 text-[14px] max-w-lg mx-auto">
          Generate precise customer segments instantly using natural language prompts.
        </p>
      </div>

      {/* AI Composer Wrapper */}
      <div className="w-full bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 mb-12 aicomposer-override">
        <style>{`
          /* Force AIComposer to match light theme */
          .aicomposer-override * { color: #0b0f1a; }
          .aicomposer-override input, .aicomposer-override textarea {
              background: #f5f2ee !important;
              border: 1px solid #e5e5e5 !important;
              color: #0b0f1a !important;
              border-radius: 8px !important;
          }
          .aicomposer-override p, .aicomposer-override span { color: #525252 !important; }
          .aicomposer-override button.bg-brand-500 {
              background-color: #ef4d23 !important;
              color: #ffffff !important;
              border-radius: 8px !important;
          }
          .aicomposer-override button.bg-brand-500 * { color: #ffffff !important; }
          .aicomposer-override .text-white { color: #ffffff !important; }
          .aicomposer-override .aicomposer-title { color: #0b0f1a !important; }
          .aicomposer-override .bg-surface-base { background: transparent !important; }
        `}</style>
        <AIComposer onSaved={fetchSegments} />
      </div>

      {/* Saved Segments */}
      <div className="w-full">
        <h3 className="text-[16px] font-semibold text-[#0b0f1a] mb-4 px-2">Saved Segments</h3>

        {isLoading ? (
          <div className="text-center py-12 text-neutral-500 text-[13px]">
             <div className="flex justify-center mb-4">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ef4d23]"></div>
             </div>
             Loading segments...
          </div>
        ) : segments.length === 0 ? (
          <div className="text-center p-12 bg-white rounded-2xl border border-neutral-200">
            <h3 className="text-[15px] font-semibold mb-2 text-[#0b0f1a]">No saved segments</h3>
            <p className="text-[13px] text-neutral-500">Use the AI composer above to generate your first audience segment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {segments.map((seg) => (
              <div key={seg.id} className="group bg-white rounded-2xl p-5 flex flex-col justify-between shadow-sm border border-neutral-200 transition-all hover:shadow-md hover:border-neutral-300">
                
                <div>
                  <h3 className="text-[15px] font-semibold mb-1 text-[#0b0f1a]">{seg.name}</h3>
                  <p className="text-[13px] text-neutral-500 mb-4 line-clamp-2">{seg.description}</p>
                  
                  <div className="flex flex-wrap gap-1 mb-6">
                    {Object.entries(seg.filter_logic || {})
                      .filter(([_, v]) => v !== null && v !== undefined)
                      .slice(0, 3)
                      .map(([key, val]) => (
                        <span key={key} className="text-[11px] px-2 py-0.5 rounded-md font-medium bg-neutral-100 text-neutral-600">
                          {key.replace(/_/g, ' ')}: {String(val)}
                        </span>
                      ))}
                    {(!seg.filter_logic || Object.keys(seg.filter_logic).length === 0) && (
                      <span className="text-[11px] px-2 py-0.5 rounded-md font-medium bg-neutral-100 text-neutral-600">
                        All customers
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => navigate(`/campaigns/new?segment_id=${seg.id}`)}
                  className="flex items-center gap-2 text-[13px] font-medium text-[#ef4d23] mt-auto hover:text-[#d9421b] transition-colors"
                >
                  Use in Campaign <ChevronRight size={16} />
                </button>

              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default Segments;
