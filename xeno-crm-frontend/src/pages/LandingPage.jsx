import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRightCircle, Menu, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getPerfCases } from '../api';

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }
  })
};

const SmoothVideoLoop = () => {
  const [active, setActive] = useState(0);
  const v1 = useRef(null);
  const v2 = useRef(null);

  const handleTimeUpdate = (e, index) => {
    const video = e.target;
    if (!video.duration) return;
    
    // Crossfade 1s before the end
    if (video.currentTime >= video.duration - 1) {
      const nextIndex = index === 0 ? 1 : 0;
      if (active !== nextIndex) {
        const nextVideo = nextIndex === 0 ? v1.current : v2.current;
        if (nextVideo) {
          nextVideo.currentTime = 0;
          nextVideo.play().catch(err => console.log(err));
          setActive(nextIndex);
        }
      }
    }
  };

  return (
    <>
      <video
        ref={v1}
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260613_180732_a54afbf6-b30d-470e-861f-669871f09f67.mp4"
        muted
        playsInline
        autoPlay
        preload="auto"
        onTimeUpdate={(e) => handleTimeUpdate(e, 0)}
        className={`absolute inset-0 z-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${active === 0 ? 'opacity-100' : 'opacity-0'}`}
      />
      <video
        ref={v2}
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260613_180732_a54afbf6-b30d-470e-861f-669871f09f67.mp4"
        muted
        playsInline
        preload="auto"
        onTimeUpdate={(e) => handleTimeUpdate(e, 1)}
        className={`absolute inset-0 z-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${active === 1 ? 'opacity-100' : 'opacity-0'}`}
      />
    </>
  );
};

const Logo = () => (
  <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.location.href = '/'}>
    <div className="relative w-12 h-12 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
      <img src="/app-logo.png" alt="ThreadCo Logo" className="w-full h-full object-cover rounded-xl shadow-[0_4px_24px_rgba(255,43,68,0.25)]" />
    </div>
    
    <div className="flex flex-col justify-center">
      <span className="font-bold text-[1.2rem] leading-none tracking-tight" style={{ color: 'white', fontFamily: 'var(--font-heading)' }}>
        ThreadCo
      </span>
      <span className="text-[0.65rem] uppercase tracking-[0.2em] font-bold mt-1" style={{ color: '#ef4d23' }}>
        Xeno CRM
      </span>
    </div>
  </div>
);

const LandingPage = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const navLinks = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Customers", path: "/customers" },
    { label: "Segments", path: "/segments" },
    { label: "Campaigns", path: "/campaigns" },
    { label: "Analysis", path: "/analysis" },
    { label: "Perf Lab", path: "/workbench" }
  ];

  // Headline numbers come from the database on load. Writing them into the copy
  // would mean the landing page quietly goes stale the moment the data changes.
  const [dataset, setDataset] = useState(null);
  const [caseCount, setCaseCount] = useState(null);
  useEffect(() => {
    getPerfCases()
      .then(d => { setDataset(d.dataset); setCaseCount(d.cases?.length ?? null); })
      .catch(() => {});
  }, []);
  const fmt = (n) => Number(n).toLocaleString('en-IN');

  return (
    <div className="relative w-full min-h-screen overflow-hidden" style={{ fontFamily: 'var(--font-body)', color: 'white', backgroundColor: '#000000', margin: 0, padding: 0 }}>
      {/* Background Video */}
      <SmoothVideoLoop />

      {/* Navbar */}
      <nav className="relative z-10 max-w-[1280px] mx-auto px-5 sm:px-8 py-4 sm:py-5 flex justify-between items-center">
        <Logo />
        
        {/* Desktop Links */}
        <div className="hidden md:flex gap-8">
          {navLinks.map((link) => (
            <button key={link.label} onClick={() => navigate(link.path)} className="text-sm font-medium transition-opacity hover:opacity-70" style={{ color: 'white' }}>
              {link.label}
            </button>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-sm font-semibold px-5 py-2.5 rounded-full hover:shadow-lg active:scale-95 transition-all" style={{ backgroundColor: 'white', color: 'black' }}>
            Open the dashboard
          </button>
        </div>

        {/* Mobile Toggle */}
        <button className="md:hidden" onClick={() => setMenuOpen(true)}>
          <Menu size={24} color="white" />
        </button>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-40 backdrop-blur-[4px]"
              style={{ backgroundColor: 'rgba(25,40,55,0.35)' }}
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{
                duration: 0.45,
                ease: [0.22, 1, 0.36, 1],
                exit: { duration: 0.35, ease: [0.55, 0, 1, 0.45] }
              }}
              className="fixed right-0 top-0 z-50 h-[100dvh]"
              style={{ width: 'min(88vw, 360px)', backgroundColor: '#CFC8C5', boxShadow: '-12px 0 48px rgba(25,40,55,0.18)' }}
            >
              <div className="flex justify-between items-center px-6 py-5">
                <Logo />
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setMenuOpen(false)}
                  className="w-[40px] h-[40px] rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(25,40,55,0.1)' }}
                >
                  <X size={20} color="black" />
                </motion.button>
              </div>
              
              <div className="h-[1px] mx-6" style={{ backgroundColor: 'rgba(25,40,55,0.12)' }} />

              <div className="flex flex-col px-4 py-6 gap-2">
                {navLinks.map((link, i) => (
                  <motion.button
                    key={link.label}
                    onClick={() => { setMenuOpen(false); navigate(link.path); }}
                    initial={{ x: 24, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.18 + i * 0.07, duration: 0.4 }}
                    className="text-[1.1rem] font-medium px-4 py-3 rounded-xl hover:bg-black/10 transition-colors text-left"
                    style={{ color: 'black' }}
                  >
                    {link.label}
                  </motion.button>
                ))}
              </div>

              <div className="px-6 mt-auto flex flex-col gap-3">
                <button onClick={() => navigate('/dashboard')} className="w-full py-3.5 rounded-full font-semibold text-[0.95rem]" style={{ backgroundColor: '#0b0f1a', color: 'white' }}>
                  Open the dashboard
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Hero Content */}
      <div className="relative z-10 max-w-[1280px] mx-auto" style={{ paddingTop: 'clamp(40px, 8vw, 72px)', paddingBottom: '48px' }}>
        <div className="max-w-[660px] mx-auto flex flex-col items-center text-center px-4">
          
          <motion.div
            custom={0}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5"
            style={{
              border: '1px solid rgba(255,255,255,0.18)',
              backgroundColor: 'rgba(255,255,255,0.06)',
              fontSize: '0.7rem',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.8)',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: '#ef4d23' }} />
            Retail CRM · live Postgres
          </motion.div>

          <motion.h1
            custom={1}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="mb-6"
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(1.65rem, 5vw, 3rem)',
              lineHeight: 1.05,
              letterSpacing: '-0.01em',
              color: 'white'
            }}
          >
            <span className="block">Dashboards are easy.</span>
            <span className="block">
              <span style={{ color: '#ef4d23' }}>Trust</span> is the hard part.
            </span>
          </motion.h1>

          <motion.p
            custom={2}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="mb-10 max-w-[560px]"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)',
              color: 'white',
              opacity: 0.8,
              lineHeight: 1.65
            }}
          >
            Every metric shows its definition. Every slow query shows its plan.
            On {dataset ? fmt(dataset.orders) : 'a million'} real orders.
          </motion.p>

          {/* One next action. The dashboard is the entry point; the Performance Lab
              and the analysis are reached from there, so the landing page does not
              deep-link past them. */}
          <motion.button
            custom={3}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            whileHover={{ scale: 1.04, filter: 'brightness(1.1)' }}
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate('/dashboard')}
            className="flex items-center justify-between"
            style={{
              backgroundColor: 'white',
              color: 'black',
              borderRadius: '50px',
              padding: '17px 26px',
              minWidth: '230px',
              fontSize: 'clamp(0.9rem, 2vw, 1rem)',
              boxShadow: '0 4px 24px rgba(255,255,255,0.12)',
              fontWeight: 600,
              gap: '32px'
            }}
          >
            Open the dashboard
            <ArrowRightCircle size={20} />
          </motion.button>

          {/* Live counts, so the scale above is evidence rather than a claim. */}
          <motion.div
            custom={4}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="mt-12 grid grid-cols-3 gap-6 sm:gap-10 rounded-2xl px-6 sm:px-10 py-5"
            style={{
              // The video behind this strip runs from near-black to a bright
              // earth limb; without a scrim the labels wash out on some frames.
              backgroundColor: 'rgba(0,0,0,0.42)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.10)',
            }}
          >
            {[
              // Each one backs a claim in the copy above rather than being a
              // number for its own sake.
              { label: 'Real orders', value: dataset && fmt(dataset.orders) },
              { label: 'Customers', value: dataset && fmt(dataset.customers) },
              { label: 'Query case studies', value: caseCount },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: 'clamp(1.1rem, 3vw, 1.6rem)',
                    color: 'white',
                    minHeight: '1.6em',
                  }}
                >
                  {stat.value || <span style={{ opacity: 0.25 }}>—</span>}
                </div>
                <div
                  className="uppercase"
                  style={{ fontSize: '0.65rem', letterSpacing: '0.18em', color: 'white', opacity: 0.72, marginTop: '5px' }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
