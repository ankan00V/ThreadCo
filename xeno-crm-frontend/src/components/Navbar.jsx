import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, ChevronDown, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const links = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Customers", path: "/customers" },
    { label: "Segments", path: "/segments" },
    { label: "Marketing", path: "/campaigns", dropdown: true }
  ];

  return (
    <div className="flex justify-center pt-4 sm:pt-6 px-3 sm:px-4 w-full relative z-50 font-['Inter']">
      <div className="bg-white rounded-full shadow-sm border border-neutral-200 p-2 w-max sm:w-full sm:pl-2 sm:pr-2 sm:py-2 max-w-[760px] relative flex items-center mx-auto sm:mx-0">
        
        {/* Logo */}
        <div className="shrink-0 cursor-pointer flex items-center gap-2 pr-2 sm:pr-0" onClick={() => navigate('/dashboard')}>
          <img src="/app-logo.png" alt="ThreadCo Logo" className="w-8 h-8 rounded-lg shadow-sm object-cover" />
          <span className="font-bold text-[15px] hidden sm:block text-[#0b0f1a]">ThreadCo</span>
        </div>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-6 ml-8">
          {links.map((link) => (
            <div key={link.label} className="relative group">
              <button 
                onClick={() => !link.dropdown && navigate(link.path)} 
                className={`text-[14px] font-medium transition-colors relative flex items-center gap-1 py-4 ${location.pathname.startsWith(link.path) ? 'text-[#ef4d23]' : 'text-neutral-800 hover:text-[#ef4d23]'}`}
              >
                {link.label}
                {location.pathname.startsWith(link.path) && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-[3px] h-[3px] bg-[#ef4d23] rounded-full" />
                )}
                {link.dropdown && (
                  <ChevronDown size={14} color="#ef4d23" strokeWidth={3} className="ml-0.5 group-hover:rotate-180 transition-transform duration-200" />
                )}
              </button>
              
              {/* Dropdown Menu */}
              {link.dropdown && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-0 w-40 bg-white rounded-xl shadow-xl border border-neutral-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 overflow-hidden transform origin-top translate-y-2 group-hover:translate-y-0">
                  <div className="py-2">
                    <button onClick={() => navigate('/campaigns')} className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-neutral-700 hover:text-[#ef4d23] hover:bg-neutral-50 transition-colors">
                      Campaigns
                    </button>
                    <button onClick={() => navigate('/analytics')} className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-neutral-700 hover:text-[#ef4d23] hover:bg-neutral-50 transition-colors">
                      Analytics Charts
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Mobile Center Button (In flow for shrink-wrap) */}
        <div className="sm:hidden flex items-center mx-2">
          <button onClick={() => navigate('/campaigns/new')} className="flex bg-[#ef4d23] hover:bg-[#d9421b] transition-colors rounded-full items-center gap-1.5 pl-3 pr-1 py-1 text-white shadow-sm">
            <span className="text-[12px] font-medium whitespace-nowrap">Early access</span>
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <ChevronRight size={12} strokeWidth={3} />
            </div>
          </button>
        </div>

        {/* Right Cluster */}
        <div className="sm:ml-auto flex items-center gap-2 sm:gap-4">
          
          <button onClick={() => navigate('/campaigns/new')} className="hidden sm:flex bg-[#ef4d23] hover:bg-[#d9421b] transition-colors rounded-full items-center gap-2 pl-4 pr-1.5 py-1.5 text-white">
            <span className="text-[13px] font-medium hidden sm:inline">Get early access</span>
            <span className="text-[13px] font-medium sm:hidden">Early access</span>
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
              <ChevronRight size={14} strokeWidth={3} />
            </div>
          </button>

          {/* Hamburger Mobile */}
          <button className="md:hidden p-2 text-[#0b0f1a] hover:bg-neutral-100 rounded-full transition-colors" onClick={() => { setOpen(!open); setExpandedMenu(null); }}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        <AnimatePresence>
          {open && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-2 right-2 mt-2 bg-white rounded-2xl shadow-lg border border-neutral-200 p-4 z-50 flex flex-col gap-4 md:hidden"
            >
              {links.map((link) => (
                <div key={link.label} className="flex flex-col">
                  <button 
                    onClick={() => { 
                      if (link.dropdown) {
                        setExpandedMenu(prev => prev === link.label ? null : link.label);
                      } else {
                        setOpen(false); 
                        navigate(link.path); 
                      }
                    }}
                    className="text-[15px] font-medium text-neutral-800 flex items-center justify-between"
                  >
                    {link.label}
                    {link.dropdown && (
                      <ChevronDown size={16} color="#ef4d23" className={`transition-transform duration-200 ${expandedMenu === link.label ? 'rotate-180' : ''}`} />
                    )}
                  </button>
                  
                  {link.dropdown && expandedMenu === link.label && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="flex flex-col gap-3 pl-4 mt-3 border-l-2 border-neutral-100"
                    >
                      <button onClick={() => { setOpen(false); navigate('/campaigns'); }} className="text-left text-[14px] text-neutral-600 font-medium hover:text-[#ef4d23] transition-colors">
                        Campaigns
                      </button>
                      <button onClick={() => { setOpen(false); navigate('/analytics'); }} className="text-left text-[14px] text-neutral-600 font-medium hover:text-[#ef4d23] transition-colors">
                        Analytics Charts
                      </button>
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
