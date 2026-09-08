import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSegments } from '../api';
import AIComposer from '../components/AIComposer';
import { ChevronRight, Sparkles, Layers } from 'lucide-react';

const Segments = () => {
  const navigate = useNavigate();
  const [segments, setSegments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSegments = async () => {
    setIsLoading(true);
    try {
      const data = await getSegments();
      setSegments(data || []);
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
    <div className="w-full px-4 sm:px-6 md:px-12 max-w-[1100px] mx-auto pt-8 md:pt-12 pb-24 font-body">
      
      {/* Header */}
      <div className="mb-8 text-center flex flex-col items-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 backdrop-blur-md px-4 py-1.5 text-xs text-muted-foreground font-body mb-3 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          <span>Targeting Engine</span>
        </div>
        
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl text-foreground tracking-tight leading-[0.98]">
          AI-Driven <span className="font-display italic font-normal text-accent">Segments</span>
        </h1>
        
        <p className="text-muted-foreground mt-3 text-sm md:text-base max-w-lg mx-auto font-body">
          Generate high-conversion customer segments instantly using natural language prompts.
        </p>
      </div>

      {/* AI Composer Wrapper (Frosted Glass) */}
      <div 
        className="w-full rounded-2xl p-6 mb-12 aicomposer-override"
        style={{
          background: 'rgba(255, 255, 255, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.5)',
          boxShadow: 'var(--shadow-dashboard)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)'
        }}
      >
        <style>{`
          .aicomposer-override * { color: var(--foreground); }
          .aicomposer-override input, .aicomposer-override textarea {
              background: rgba(255, 255, 255, 0.8) !important;
              border: 1px solid rgba(255, 255, 255, 0.9) !important;
              color: var(--foreground) !important;
              border-radius: 12px !important;
              box-shadow: inset 0 1px 2px rgba(0,0,0,0.04);
          }
          .aicomposer-override input::placeholder, .aicomposer-override textarea::placeholder {
              color: var(--muted-foreground) !important;
          }
          .aicomposer-override p, .aicomposer-override span { color: var(--muted-foreground) !important; }
          .aicomposer-override button.bg-brand-500 {
              background-color: var(--accent) !important;
              color: #ffffff !important;
              border-radius: 9999px !important;
              padding: 0.6rem 1.4rem !important;
              font-weight: 500 !important;
          }
          .aicomposer-override button.bg-brand-500 * { color: #ffffff !important; }
          .aicomposer-override .aicomposer-title { color: var(--foreground) !important; }
          .aicomposer-override .bg-surface-base { background: transparent !important; }
        `}</style>
        <AIComposer onSaved={fetchSegments} />
      </div>

      {/* Saved Segments */}
      <div className="w-full">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-4 h-4 text-accent" />
          <h2 className="text-base font-semibold text-foreground">Saved Segments</h2>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-xs flex flex-col items-center">
             <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-accent mb-3"></div>
             <span>Loading audience cohorts...</span>
          </div>
        ) : segments.length === 0 ? (
          <div 
            className="text-center p-10 rounded-2xl"
            style={{
              background: 'rgba(255, 255, 255, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.5)',
              boxShadow: 'var(--shadow-dashboard)',
              backdropFilter: 'blur(16px)'
            }}
          >
            <h3 className="text-sm font-semibold mb-1 text-foreground">No saved segments yet</h3>
            <p className="text-xs text-muted-foreground">Use the AI composer above to synthesize your first audience segment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {segments.map((seg) => (
              <div 
                key={seg.id} 
                className="group rounded-2xl p-5 flex flex-col justify-between transition-all hover:scale-[1.01] border border-white/60 hover:border-accent/40 shadow-sm"
                style={{
                  background: 'rgba(255, 255, 255, 0.45)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)'
                }}
              >
                <div>
                  <h3 className="text-sm font-semibold mb-1 text-foreground group-hover:text-accent transition-colors">{seg.name}</h3>
                  <p className="text-xs text-muted-foreground mb-4 line-clamp-2">{seg.description || 'Custom behavioral rule segment'}</p>
                  
                  <div className="flex flex-wrap gap-1 mb-5">
                    {Object.entries(seg.filter_logic || {})
                      .filter(([_, v]) => v !== null && v !== undefined)
                      .slice(0, 3)
                      .map(([key, val]) => (
                        <span key={key} className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-white/70 text-foreground border border-white/80">
                          {key.replace(/_/g, ' ')}: {String(val)}
                        </span>
                      ))}
                    {(!seg.filter_logic || Object.keys(seg.filter_logic).length === 0) && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-white/70 text-muted-foreground border border-white/80">
                        All customers
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => navigate(`/campaigns/new?segment_id=${seg.id}`)}
                  className="flex items-center gap-1.5 text-xs font-medium text-accent mt-auto hover:opacity-80 transition-opacity"
                >
                  <span>Use in Campaign</span>
                  <ChevronRight size={14} />
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
