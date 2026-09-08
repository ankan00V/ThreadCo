import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboardStats } from '../api';
import { ArrowUpRight, ChevronRight, Sparkles } from 'lucide-react';
import Gauge from '../components/Gauge';

const DotMetric = ({ value, className = '' }) => (
  <span className={`dot-metric ${className}`} aria-label={value}>
    {value}
  </span>
);

const RadarVisual = () => (
  <div className="instrument instrument--radar" aria-hidden="true">
    <span className="radar-ring radar-ring--outer" />
    <span className="radar-ring radar-ring--inner" />
    <span className="radar-sweep" />
    <span className="radar-core" />
  </div>
);

const ContextVisual = () => (
  <div className="instrument instrument--context" aria-hidden="true">
    <span className="context-orb context-orb--one" /><span className="context-orb context-orb--two" />
    <div className="context-window"><i /><i /><i /></div>
  </div>
);

const ConnectionVisual = () => (
  <div className="instrument instrument--connections" aria-hidden="true">
    <svg viewBox="0 0 320 190" preserveAspectRatio="none">
      <path d="M-8 105H45c26 0 22-54 52-54h46c29 0 19 54 53 54h37c24 0 27-53 56-53h39" />
      <path className="connection-line--soft" d="M-8 105H45c26 0 22 54 52 54h46c29 0 19-54 53-54h37c24 0 27 53 56 53h39" />
      {[45, 97, 143, 196, 233, 289].map((x, index) => <circle key={index} cx={x} cy={index % 2 ? 51 : 105} r="5" />)}
    </svg>
  </div>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total_customers: 0,
    total_campaigns: 0,
    total_messages_sent: 0,
    total_engagements: 0,
    revenue_generated: 0,
    avg_order_value: 0
  });
  
  useEffect(() => {
    const load = async () => {
      try {
        const s = await getDashboardStats();
        setStats(s || {});
      } catch(e) {
        console.error("Load failed:", e);
      }
    };
    load();
  }, []);

  return (
    <div className="dashboard-experience">
      <video className="dashboard-experience__motion" autoPlay loop muted playsInline preload="auto" aria-hidden="true">
        <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260826_125226_45cb4f38-aa7e-47e1-885d-ae0b69745369.mp4" type="video/mp4" />
      </video>
      <div className="dashboard-experience__veil" aria-hidden="true" />
      <section className="dashboard-hero">
        <div className="dashboard-kicker"><span /> ThreadCo intelligence</div>
        <h1>Built for <em>intelligent</em><br />performance.</h1>
        <p>See the customer signals, campaign momentum, and revenue outcomes that matter—at a glance.</p>
        <button onClick={() => navigate('/campaigns/new')} className="dashboard-primary-action">
          Launch campaign <span><ChevronRight size={17} strokeWidth={3} /></span>
        </button>
      </section>

      <section className="dashboard-metrics" aria-label="CRM performance overview">
        <article className="performance-card performance-card--customers">
          <video className="performance-card__media" autoPlay loop muted playsInline preload="auto" aria-hidden="true"><source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260826_130045_1a612b69-4854-4b34-8043-ccb91f2c60af.mp4" type="video/mp4" /></video>
          <div className="performance-card__content">
            <p className="performance-card__eyebrow">Customer base</p>
            <h2>Customer<br />momentum</h2>
            <RadarVisual />
            <div className="performance-card__metric"><DotMetric value={Math.round(stats.total_customers || 0).toLocaleString()} /></div>
            <p className="performance-card__caption">registered shoppers<br />across your audience</p>
            <div className="performance-card__gauge"><Gauge value={Math.min(100, Math.round(((stats.total_customers || 0) / 500) * 100))} color="#fff5f7" emptyColor="rgba(255,255,255,.2)" /></div>
            <p className="performance-card__foot"><ArrowUpRight size={15} /> {stats.new_this_month || 0} new this month</p>
          </div>
        </article>

        <article className="performance-card performance-card--campaigns">
          <video className="performance-card__media" autoPlay loop muted playsInline preload="auto" aria-hidden="true"><source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260826_130054_dd005674-d693-4d81-80a5-357f7f10b3a3.mp4" type="video/mp4" /></video>
          <div className="performance-card__content">
            <p className="performance-card__eyebrow">Campaign activity</p>
            <h2>Campaign<br />reach</h2>
            <ContextVisual />
            <div className="performance-card__metric"><DotMetric value={Math.round(stats.total_campaigns || 0).toLocaleString()} /></div>
            <p className="performance-card__caption">active and completed<br />campaigns</p>
            <div className="performance-card__gauge"><Gauge value={Math.min(100, Math.round(((stats.total_messages_sent || 0) / 5000) * 100))} color="#fff9ff" emptyColor="rgba(255,255,255,.2)" /></div>
            <p className="performance-card__foot"><Sparkles size={15} /> {(stats.total_messages_sent || 0).toLocaleString()} messages sent</p>
          </div>
        </article>

        <article className="performance-card performance-card--revenue">
          <video className="performance-card__media" autoPlay loop muted playsInline preload="auto" aria-hidden="true"><source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260826_130103_7550f407-f14b-40a6-9616-7a26d7a8bd9f.mp4" type="video/mp4" /></video>
          <div className="performance-card__content">
            <p className="performance-card__eyebrow">Revenue generated</p>
            <h2>Revenue<br />clarity</h2>
            <ConnectionVisual />
            <div className="performance-card__metric performance-card__metric--currency"><DotMetric value={'$' + Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(stats.revenue_generated || 0)} /></div>
            <p className="performance-card__caption">attributed customer<br />value</p>
            <div className="performance-card__gauge"><Gauge value={Math.min(100, Math.round(((stats.revenue_generated || 0) / 100000000) * 100))} color="#f6fffb" emptyColor="rgba(255,255,255,.2)" /></div>
            <p className="performance-card__foot"><ArrowUpRight size={15} /> ${Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(stats.avg_order_value || 0)} average order</p>
          </div>
        </article>
      </section>
    </div>
  );
};

export default Dashboard;
