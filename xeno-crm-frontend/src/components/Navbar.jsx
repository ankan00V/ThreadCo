import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, ChevronDown, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Four top-level destinations: one direct link and three grouped headers.
 *
 * A flat list had grown to seven items plus a CTA, which wrapped onto two lines
 * and pushed "Perf Lab" underneath the button. Each header now names a job —
 * who you are talking to, what you are sending, what you are learning — with
 * the pages under it. One line at every width, and the analyst-facing pages are
 * easier to find grouped than they were scattered.
 */
const LINKS = [
  { label: 'Dashboard', path: '/dashboard' },
  {
    label: 'Audience',
    path: '/customers',
    matches: ['/customers', '/segments'],
    children: [
      { label: 'Customers', path: '/customers', note: 'Directory and search' },
      { label: 'Segments', path: '/segments', note: 'AI-built audiences' },
    ],
  },
  {
    label: 'Campaigns',
    path: '/campaigns',
    matches: ['/campaigns'],
    children: [
      { label: 'All campaigns', path: '/campaigns', note: 'Delivery and status' },
      { label: 'New campaign', path: '/campaigns/new', note: 'Compose and send' },
    ],
  },
  {
    label: 'Insights',
    path: '/analysis',
    matches: ['/analysis', '/analytics', '/workbench', '/your-data'],
    children: [
      { label: 'Your data', path: '/your-data', note: 'Upload a CSV' },
      { label: 'Analysis', path: '/analysis', note: 'Data-quality audit' },
      { label: 'Performance Lab', path: '/workbench', note: 'SQL sandbox' },
      { label: 'Analytics charts', path: '/analytics', note: 'Revenue and lifecycle' },
    ],
  },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (link) => {
    const paths = link.matches || [link.path];
    return paths.some((p) => location.pathname.startsWith(p));
  };

  const go = (path) => { setOpen(false); setExpandedMenu(null); navigate(path); };

  return (
    <div className="product-navbar flex justify-center pt-4 sm:pt-6 px-3 sm:px-4 w-full relative z-50 font-['Inter']">
      <div className="bg-[#fcfaf5] rounded-full shadow-sm border border-neutral-200 p-2 w-max sm:w-full sm:pl-2 sm:pr-2 sm:py-2 max-w-[920px] relative flex items-center mx-auto sm:mx-0">

        {/* Logo */}
        <div className="shrink-0 cursor-pointer flex items-center gap-2 pr-2 sm:pr-0" onClick={() => navigate('/dashboard')}>
          <img src="/app-logo.png" alt="ThreadCo" className="w-8 h-8 rounded-lg shadow-sm object-cover" />
          <span className="font-bold text-[15px] hidden sm:block text-[#0b0f1a]">ThreadCo</span>
        </div>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-5 lg:gap-7 ml-5 lg:ml-8">
          {LINKS.map((link) => (
            <div key={link.label} className="relative group">
              <button
                onClick={() => !link.children && navigate(link.path)}
                className={`text-[14px] font-medium transition-colors relative flex items-center gap-1 py-4 whitespace-nowrap ${
                  isActive(link) ? 'text-[#ef4d23]' : 'text-neutral-800 hover:text-[#ef4d23]'
                }`}
              >
                {link.label}
                {isActive(link) && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-[3px] h-[3px] bg-[#ef4d23] rounded-full" />
                )}
                {link.children && (
                  <ChevronDown size={14} color="#ef4d23" strokeWidth={3} className="ml-0.5 group-hover:rotate-180 transition-transform duration-200" />
                )}
              </button>

              {link.children && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-52 bg-[#fcfaf5] rounded-xl shadow-xl border border-neutral-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 overflow-hidden transform origin-top translate-y-2 group-hover:translate-y-0">
                  <div className="py-2">
                    {link.children.map((child) => (
                      <button
                        key={child.path}
                        onClick={() => go(child.path)}
                        className="w-full text-left px-4 py-2 hover:bg-neutral-50 transition-colors"
                      >
                        <span className={`block text-[13px] font-medium ${
                          location.pathname === child.path ? 'text-[#ef4d23]' : 'text-neutral-700'
                        }`}>
                          {child.label}
                        </span>
                        {child.note && (
                          <span className="block text-[11px] text-neutral-400 mt-0.5">{child.note}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Mobile centre CTA */}
        <div className="sm:hidden flex items-center mx-2">
          <button onClick={() => navigate('/campaigns/new')} className="flex bg-[#ef4d23] hover:bg-[#d9421b] transition-colors rounded-full items-center gap-1.5 pl-3 pr-1 py-1 text-white shadow-sm">
            <span className="text-[12px] font-medium whitespace-nowrap">New campaign</span>
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <ChevronRight size={12} strokeWidth={3} />
            </div>
          </button>
        </div>

        {/* Right cluster */}
        <div className="sm:ml-auto flex items-center gap-2 sm:gap-3">
          <button onClick={() => navigate('/campaigns/new')} className="hidden sm:flex bg-[#ef4d23] hover:bg-[#d9421b] transition-colors rounded-full items-center gap-2 pl-4 pr-1.5 py-1.5 text-white shrink-0">
            <span className="text-[13px] font-medium whitespace-nowrap">New campaign</span>
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <ChevronRight size={14} strokeWidth={3} />
            </div>
          </button>

          <button className="md:hidden p-2 text-[#0b0f1a] hover:bg-neutral-100 rounded-full transition-colors" onClick={() => { setOpen(!open); setExpandedMenu(null); }}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-2 right-2 mt-2 bg-[#fcfaf5] rounded-2xl shadow-lg border border-neutral-200 p-4 z-50 flex flex-col gap-4 md:hidden"
            >
              {LINKS.map((link) => (
                <div key={link.label} className="flex flex-col">
                  <button
                    onClick={() => {
                      if (link.children) setExpandedMenu((prev) => (prev === link.label ? null : link.label));
                      else go(link.path);
                    }}
                    className="text-[15px] font-medium text-neutral-800 flex items-center justify-between"
                  >
                    {link.label}
                    {link.children && (
                      <ChevronDown size={16} color="#ef4d23" className={`transition-transform duration-200 ${expandedMenu === link.label ? 'rotate-180' : ''}`} />
                    )}
                  </button>

                  {link.children && expandedMenu === link.label && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="flex flex-col gap-3 pl-4 mt-3 border-l-2 border-neutral-100"
                    >
                      {link.children.map((child) => (
                        <button key={child.path} onClick={() => go(child.path)}
                                className="text-left text-[14px] text-neutral-600 font-medium hover:text-[#ef4d23] transition-colors">
                          {child.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
