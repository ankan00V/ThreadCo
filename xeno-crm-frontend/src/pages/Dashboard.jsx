import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboardStats } from '../api';
import { ArrowUpRight, ChevronRight, Sparkles } from 'lucide-react';
import Gauge from '../components/Gauge';
import AnimatedCounter from '../components/AnimatedCounter';

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
            <div className="performance-card__metric"><AnimatedCounter value={stats.total_customers || 0} formatFn={(v) => Math.round(v).toLocaleString()} /></div>
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
            <div className="performance-card__metric"><AnimatedCounter value={stats.total_campaigns || 0} formatFn={(v) => Math.round(v).toLocaleString()} /></div>
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
            <div className="performance-card__metric performance-card__metric--currency"><AnimatedCounter value={stats.revenue_generated || 0} formatFn={(v) => '$' + Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v)} /></div>
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
