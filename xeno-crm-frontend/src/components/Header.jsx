import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Globe, ChevronDown, Activity, Users, Filter, Send } from 'lucide-react';

export default function Header() {
  const location = useLocation();

  const mainLinks = [
    { label: "Dashboard", path: "/" },
    { label: "Customers", path: "/customers" },
    { label: "Segments", path: "/segments" },
    { label: "Campaigns", path: "/campaigns" },
  ];

  const subLinks = [
    { label: "Overview", icon: Activity, path: "/" },
    { label: "Value proposition", icon: Users, path: "/customers" },
    { label: "Targeting", icon: Filter, path: "/segments" },
    { label: "Outreach", icon: Send, path: "/campaigns" },
  ];

  return (
    <header className="w-full sticky top-0 z-50">
      {/* Main Nav (Glass) */}
      <div className="glass-panel-dark py-4 px-8 flex items-center justify-between border-b border-white/10">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600 rounded flex items-center justify-center text-white font-bold text-xl shadow-[2px_2px_0px_#fff]">
            TC
          </div>
          <div className="flex flex-col">
            <span className="text-white text-2xl font-serif tracking-tight leading-none mb-1">threadco</span>
            <span className="text-gray-400 text-[9px] uppercase tracking-[0.2em] leading-none">Intelligence First</span>
          </div>
        </Link>

        {/* Center Links */}
        <nav className="hidden md:flex items-center gap-8">
          {mainLinks.map(link => (
            <Link 
              key={link.path} 
              to={link.path}
              className={`text-sm flex items-center gap-1 transition-colors ${
                location.pathname === link.path ? 'text-white font-medium' : 'text-gray-300 hover:text-white'
              }`}
            >
              {link.label}
              <ChevronDown size={14} className="opacity-50" />
            </Link>
          ))}
        </nav>

        {/* Right - Search */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search" 
              className="glass-input rounded-full py-1.5 pl-4 pr-10 text-sm w-48 transition-all"
            />
            <div className="absolute right-1 top-1 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center cursor-pointer">
              <Search size={12} className="text-white" />
            </div>
          </div>
        </div>
      </div>

    </header>
  );
}
