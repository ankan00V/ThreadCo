import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboardStats } from '../api';
import { ChevronRight } from 'lucide-react';

const LED_GLYPHS = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["010", "110", "010", "010", "010", "010", "111"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  ".": ["0", "0", "0", "0", "0", "0", "1"],
  ",": ["0", "0", "0", "0", "0", "1", "1"],
  "I": ["111", "010", "010", "010", "010", "010", "111"],
  "M": ["10001", "11011", "10101", "10001", "10001", "10001", "10001"],
  "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  "$": ["00100", "01111", "10100", "01110", "00101", "11110", "00100"]
};

const DotMetric = ({ value, pitchX = 5, pitchY = 4, dotRadius = 1.55, className = '' }) => {
  // Use explicit units for scaling instead of hardcoded px
  // dotRadius passed in is base size, but it needs to scale by var(--u) in the SVG
  
  const str = String(value).toUpperCase();
  let currentX = 0;
  const circles = [];

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const glyph = LED_GLYPHS[char] || LED_GLYPHS["0"];
    const width = glyph[0].length;

    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < width; c++) {
        if (glyph[r][c] === "1") {
          circles.push(
            <circle
              key={`${i}-${r}-${c}`}
              cx={currentX + c * pitchX + dotRadius}
              cy={r * pitchY + dotRadius}
              r={dotRadius}
            />
          );
        }
      }
    }
    currentX += width * pitchX + 2; 
  }

  const height = 6 * pitchY + dotRadius * 2;
  // Apply a dynamic font-size based on var(--u) to scale the em correctly
  // The original prompt implies this dot metric gets its size from the surrounding metric
  return (
    <svg className={`dot-svg ${className}`} viewBox={`0 0 ${currentX} ${height}`} fill="currentColor" style={{ height: `calc(${height} * var(--u))`, display: 'inline-block', overflow: 'visible' }}>
      {circles}
    </svg>
  );
};

const RadarVisual = () => {
  const ticks = Array.from({length: 23}).map((_, i) => {
    const angle = (190 + i * 5) * Math.PI / 180;
    const outer = 142;
    const inner = i % 5 === 0 ? 129 : 133;
    const cx = 163, cy = 163;
    return (
      <line key={i} className="tick" 
        x1={cx + Math.cos(angle) * inner} y1={cy + Math.sin(angle) * inner}
        x2={cx + Math.cos(angle) * outer} y2={cy + Math.sin(angle) * outer}
        stroke="rgba(255,188,210,.34)" strokeWidth={i % 5 === 0 ? 1.5 : 1}
      />
    );
  });

  return (
    <svg className="gauge" viewBox="0 0 326 326">
      <defs>
        <linearGradient id="gaugeArc" gradientUnits="userSpaceOnUse" x1="7" y1="136" x2="312" y2="109">
          <stop offset="0" stopColor="#ff9ab7" stopOpacity=".06"/>
          <stop offset=".08" stopColor="#ff8caf" stopOpacity=".44"/>
          <stop offset=".34" stopColor="#ff6796" stopOpacity=".94"/>
          <stop offset=".58" stopColor="#ff6796" stopOpacity="1"/>
          <stop offset=".82" stopColor="#ffe7ed" stopOpacity=".74"/>
          <stop offset=".94" stopColor="#fff8fa" stopOpacity=".28"/>
          <stop offset="1" stopColor="#fff" stopOpacity="0"/>
        </linearGradient>
        <linearGradient id="gaugeShadow" gradientUnits="userSpaceOnUse" x1="11" y1="136" x2="308" y2="110">
          <stop offset="0" stopColor="#6e1639" stopOpacity=".04"/>
          <stop offset=".09" stopColor="#6e1639" stopOpacity=".17"/>
          <stop offset=".52" stopColor="#72163d" stopOpacity=".18"/>
          <stop offset=".78" stopColor="#7b1a43" stopOpacity=".1"/>
          <stop offset="1" stopColor="#7b1a43" stopOpacity="0"/>
        </linearGradient>
        <radialGradient id="radarBeam" cx="163" cy="163" r="145">
          <stop offset=".3" stopColor="#650f35" stopOpacity="0"/>
          <stop offset=".45" stopColor="#650f35" stopOpacity=".025"/>
          <stop offset=".7" stopColor="#650f35" stopOpacity=".065"/>
          <stop offset=".9" stopColor="#650f35" stopOpacity=".08"/>
          <stop offset="1" stopColor="#650f35" stopOpacity=".05"/>
        </radialGradient>
        <linearGradient id="radarBeamEdge" x1="238" y1="33" x2="190.5" y2="115.4">
          <stop offset="0" stopColor="#ffe7ef" stopOpacity=".19"/>
          <stop offset=".48" stopColor="#ffd1df" stopOpacity=".11"/>
          <stop offset=".82" stopColor="#ffc6d7" stopOpacity=".045"/>
          <stop offset="1" stopColor="#ffc6d7" stopOpacity="0"/>
        </linearGradient>
        <filter id="radarSoft"><feGaussianBlur stdDeviation="1.35"/></filter>
        <filter id="radarHalo"><feGaussianBlur stdDeviation="5.2"/></filter>
        <filter id="gaugeBlur"><feGaussianBlur stdDeviation="11"/></filter>
      </defs>
      <path d="M11.34 136.26A154 154 0 0 1 307.71 110.33" fill="none" strokeWidth="3.2" strokeLinecap="round" stroke="url(#gaugeShadow)"/>
      <path d="M6.91 135.48A158.5 158.5 0 0 1 311.94 108.79" fill="none" strokeWidth="2.2" strokeLinecap="round" stroke="url(#gaugeArc)"/>
      <path d="M19.22 137.65A146 146 0 0 1 236 36.56" fill="none" strokeWidth="1.15" stroke="rgba(255,166,194,.31)"/>
      <path d="M238 33.1A150 150 0 0 1 277.9 66.6L199.8 119.5A55 55 0 0 0 190.5 115.4Z" fill="#6a1238" opacity=".022" filter="url(#radarHalo)"/>
      <path d="M238 33.1A150 150 0 0 1 277.9 66.6L199.8 119.5A55 55 0 0 0 190.5 115.4Z" fill="url(#radarBeam)" filter="url(#radarSoft)"/>
      <path d="M238 33.1L190.5 115.4" stroke="url(#radarBeamEdge)" strokeWidth="1.25" strokeLinecap="round" filter="url(#radarSoft)"/>
      <g id="gaugeTicks">{ticks}</g>
      <ellipse cx="225" cy="166" rx="92" ry="76" fill="#fff" opacity=".055" filter="url(#gaugeBlur)"/>
    </svg>
  );
};


const ContextWall = () => (
  <>
    <svg className="context-backdrop" viewBox="0 0 429 554" preserveAspectRatio="none">
      <defs>
        <mask id="deepM">
          <rect x="0" y="0" width="429" height="554" fill="url(#deepMaskGrad)"/>
        </mask>
        <linearGradient id="deepMaskGrad" x1="0" y1="0" x2="0" y2="1">
           <stop offset="0" stopColor="#000" />
           <stop offset=".54" stopColor="#000" />
           <stop offset=".58" stopColor="rgba(0,0,0,.72)" />
           <stop offset=".62" stopColor="rgba(0,0,0,.18)" />
           <stop offset=".65" stopColor="transparent" />
        </linearGradient>
        <filter id="tileSoft"><feGaussianBlur stdDeviation="3.4"/></filter>
        <filter id="groutSoft"><feGaussianBlur stdDeviation="6.5"/></filter>
        <linearGradient id="tTLf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d4b0ee" stopOpacity=".05"/><stop offset="1" stopColor="#c6bbff" stopOpacity=".18"/></linearGradient>
        <linearGradient id="tTCf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d5c2ff" stopOpacity=".22"/><stop offset=".26" stopColor="#e0bdff" stopOpacity=".26"/><stop offset=".32" stopColor="#f2a0ee" stopOpacity=".32"/><stop offset=".34" stopColor="#ff96da" stopOpacity=".34"/></linearGradient>
        <linearGradient id="tTRf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe8da" stopOpacity=".56"/><stop offset=".26" stopColor="#f9c6d0" stopOpacity=".26"/><stop offset=".08" stopColor="#eba4bf" stopOpacity=".08"/></linearGradient>
        <linearGradient id="tMRf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e858b8" stopOpacity=".52"/><stop offset=".46" stopColor="#e6459c" stopOpacity=".46"/><stop offset="1" stopColor="#de74ba" stopOpacity=".16"/></linearGradient>
        <linearGradient id="deepX" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="maroon"/><stop offset=".33" stopColor="coral"/><stop offset=".66" stopColor="pink"/><stop offset="1" stopColor="blue"/></linearGradient>
      </defs>
      <g mask="url(#deepM)" filter="url(#tileSoft)">
         <rect x="-24" y="22" width="106" height="149" rx="15" fill="url(#tTLf)"/>
         <rect x="88" y="22" width="247" height="150" rx="15" fill="url(#tTCf)"/>
         <rect x="346" y="22" width="111" height="147" rx="15" fill="url(#tTRf)"/>
         <rect x="-24" y="177" width="108" height="174" rx="15" fill="#e0c2ff" fillOpacity="0.2"/>
         <rect x="88" y="177" width="247" height="174" rx="15" fill="#d5c2ff" fillOpacity="0.2"/>
         <rect x="344" y="175" width="113" height="176" rx="15" fill="url(#tMRf)"/>
      </g>
      <rect x="-24" y="384" width="480" height="170" fill="url(#deepX)" mask="url(#deepM)"/>
      <g filter="url(#groutSoft)">
        <rect x="81" y="30" width="8" height="150" fill="rgba(255,255,255,0.2)"/>
        <rect x="338" y="30" width="8" height="322" fill="rgba(255,255,255,0.2)"/>
        <rect x="0" y="167" width="429" height="12" fill="rgba(255,255,255,0.2)"/>
      </g>
      <ellipse cx="352" cy="86" rx="140" ry="108" fill="#fff" opacity="0.1"/>
      <ellipse cx="75" cy="150" rx="82" ry="54" fill="#fff" opacity="0.1"/>
      <ellipse cx="8" cy="334" rx="76" ry="58" fill="#fff" opacity="0.1"/>
      <ellipse cx="56" cy="215" rx="56" ry="62" fill="#fff" opacity="0.1"/>
    </svg>
    <div className="context-window">
      <div className="window-lines">
        <span className="span1" />
        <span className="span2" />
        <span className="span3" />
      </div>
    </div>
  </>
);


const ConnectionVisual = () => (
  <svg className="connections-map" viewBox="0 0 429 238" preserveAspectRatio="none">
    <defs>
      <mask id="connMask">
        <linearGradient id="connMaskGrad" x1="0" y1="0" x2="0" y2="1">
           <stop offset="0" stopColor="#000" />
           <stop offset=".50" stopColor="#000" />
           <stop offset=".67" stopColor="rgba(0,0,0,.46)" />
           <stop offset=".83" stopColor="rgba(0,0,0,.15)" />
           <stop offset=".96" stopColor="transparent" />
        </linearGradient>
        <rect x="0" y="0" width="429" height="238" fill="url(#connMaskGrad)"/>
      </mask>
    </defs>
    <g mask="url(#connMask)">
      <path opacity=".20" stroke="#fff" strokeWidth="1" fill="none" d="M0 5H128c27 0 36 7 39 26 2 16 9 22 24 22h106c16 0 23-8 25-25 2-16 10-23 31-23h76" />
      <path opacity=".30" stroke="#fff" strokeWidth="1" fill="none" d="M0 117h46c15 0 22 8 26 25 5 23 12 31 31 31h174c18 0 25-8 30-31 4-17 11-25 26-25h96" />
      <path opacity=".34" stroke="#fff" strokeWidth="1" fill="none" d="M0 173h87c15 0 22 7 27 25 4 15 11 22 28 22h140c17 0 25-7 29-22 5-18 12-25 28-25h90" />
      <path opacity=".16" stroke="#fff" strokeWidth="1" fill="none" d="M0 228h120c17 0 25-5 28-18 4-15 10-20 28-20h81c18 0 25 6 28 20 4 13 11 18 28 18h116" />
      <path opacity=".26" stroke="#fff" strokeWidth="1" fill="none" d="M0 5H429M0 61H429M0 117H429" />
      <path opacity=".09" stroke="#fff" strokeWidth="1" fill="none" d="M0 173H429" />
      <path opacity=".52" stroke="#fff8dd" strokeWidth="1.15" fill="none" d="M0 61h95c14 0 22-6 27-20 4-13 12-20 27-20h115c15 0 23 6 27 20 5 14 13 20 28 20h110" />
      <path opacity=".94" stroke="#fff8dd" strokeWidth="1.15" fill="none" d="M0 117h88c15 0 22-8 25-25 4-24 12-31 31-31h129c20 0 27 7 31 31 3 17 10 25 26 25h99" />
      <circle cx="45" cy="117" r="6.5" fill="#fff" />
      <circle cx="133" cy="61" r="6.5" fill="#fff4a7" />
      <circle cx="189" cy="61" r="6.5" fill="#fff1a4" />
      <circle cx="319" cy="61" r="6.5" fill="#fff4a6" />
      <circle cx="319" cy="117" r="6.5" fill="#fff2a0" />
    </g>
  </svg>
);

const formatNumberStr = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total_customers: 1500,
    total_campaigns: 8,
    revenue_generated: 11400000
  });
  
  useEffect(() => {
    const load = async () => {
      try {
        const s = await getDashboardStats();
        if (s) setStats(s);
      } catch(e) {
        console.error("Load failed:", e);
      }
    };
    load();
  }, []);

  return (
    <div className="dashboard-experience">
      <video className="dashboard-experience__motion dashboard-experience__motion--wide" autoPlay loop muted playsInline preload="auto" aria-hidden="true" poster="https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/5c3ec08f-2dbf-4c0a-8588-f6106a789443.webp">
        <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260826_125226_45cb4f38-aa7e-47e1-885d-ae0b69745369.mp4" type="video/mp4" />
      </video>
      <video className="dashboard-experience__motion dashboard-experience__motion--narrow" autoPlay loop muted playsInline preload="none" aria-hidden="true" poster="https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/0f4926a4-e660-4df2-9195-2bfb3e341bdd.webp">
        <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260826_125242_daae1570-386d-4bd5-8896-80499e2371e0.mp4" type="video/mp4" />
      </video>
      <div className="dashboard-experience__veil" aria-hidden="true" />

      <section className="dashboard-hero">
        <div className="dashboard-kicker"><span /> ThreadCo intelligence</div>
        <h1 className="headline">Built for <em>intelligent</em><br />performance.</h1>
        <p className="intro">See the customer signals, campaign momentum, and revenue outcomes that matter—<br className="desktop-break" />at a glance.</p>
        <button onClick={() => navigate('/campaigns/new')} className="dashboard-primary-action">
          Launch campaign <span><ChevronRight size={17} strokeWidth={3} /></span>
        </button>
      </section>

      <section className="cards" aria-label="CRM performance overview">
        
        <article className="card card--speed">
          <video className="card__media" autoPlay loop muted playsInline preload="auto" aria-hidden="true" poster="https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/167977c6-8539-46b1-9a15-8dba566f50b8.png">
            <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260826_130045_1a612b69-4854-4b34-8043-ccb91f2c60af.mp4" type="video/mp4" />
          </video>
          <div className="card__grain">
            <svg viewBox="0 0 429 554" preserveAspectRatio="none" style={{width:'100%', height:'100%'}}>
              <filter id="cardNoise"><feTurbulence type="fractalNoise" baseFrequency=".54" numOctaves="3" seed="27" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope="1.8" intercept="-.25"/><feFuncG type="linear" slope="1.8" intercept="-.25"/><feFuncB type="linear" slope="1.8" intercept="-.25"/><feFuncA type="table" tableValues="0 .52"/></feComponentTransfer></filter>
              <rect width="100%" height="100%" filter="url(#cardNoise)" />
            </svg>
          </div>
          
          <h2 className="card__title">Customer Base<br /><span style={{fontWeight: 400}}>Customer momentum</span></h2>
          <RadarVisual />
          
          <div className="metric metric--speed">
            <DotMetric targetValue={stats.total_customers || 0} formatType="comma" />
          </div>
          <p className="caption">Registered shoppers<br />across your audience</p>
          
          <div className="learn-more">
            <button type="button" onClick={() => navigate('/customers')}>Explore customers</button>
          </div>
        </article>

        <article className="card card--context">
          <video className="card__media" autoPlay loop muted playsInline preload="auto" aria-hidden="true" poster="https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/0446d1d5-e65e-4db5-8090-3e30d09afc43.png">
            <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260826_130054_dd005674-d693-4d81-80a5-357f7f10b3a3.mp4" type="video/mp4" />
          </video>
          <div className="card__grain">
            <svg viewBox="0 0 429 554" preserveAspectRatio="none" style={{width:'100%', height:'100%'}}><rect width="100%" height="100%" filter="url(#cardNoise)" /></svg>
          </div>
          
          <h2 className="card__title">Campaign Activity<br /><span style={{fontWeight: 400}}>Campaign reach</span></h2>
          <ContextWall />
          
          <div className="metric metric--context">
            <DotMetric targetValue={stats.total_campaigns || 0} formatType="compact" dotRadius={2.32} />
            <span className="metric__unit">{formatNumberStr(stats.total_campaigns || 0).replace(/[0-9.]/g, '') || ' '}</span>
          </div>
          <p className="caption">Active and completed<br />campaigns</p>
          
          <div className="learn-more">
            <button type="button" onClick={() => navigate('/campaigns')}>Explore campaigns</button>
          </div>
        </article>

        <article className="card card--connections">
          <video className="card__media" autoPlay loop muted playsInline preload="auto" aria-hidden="true" poster="https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/da8d0242-4dee-4f6d-813f-a5887e86ad77.png">
            <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260826_130103_7550f407-f14b-40a6-9616-7a26d7a8bd9f.mp4" type="video/mp4" />
          </video>
          <div className="card__grain">
            <svg viewBox="0 0 429 554" preserveAspectRatio="none" style={{width:'100%', height:'100%'}}><rect width="100%" height="100%" filter="url(#cardNoise)" /></svg>
          </div>
          
          <h2 className="card__title">Revenue Generated<br /><span style={{fontWeight: 400}}>Revenue clarity</span></h2>
          <ConnectionVisual />
          
          <div className="metric metric--connections">
            <span style={{fontSize:'calc(30.6 * var(--u))', transform:'translateY(3u)', marginRight:'4px'}}>$</span>
            <DotMetric targetValue={stats.revenue_generated || 0} formatType="compact" />
            <span className="metric__unit">{formatNumberStr(stats.revenue_generated || 0).replace(/[0-9.]/g, '')}</span>
          </div>
          <p className="caption">Revenue attributed to<br />customer outcomes</p>
          
          <div className="learn-more">
            <button type="button" onClick={() => navigate('/analytics')}>Explore analytics</button>
          </div>
        </article>

      </section>
    </div>
  );
};

export default Dashboard;
