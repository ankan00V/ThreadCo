import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Filter, Send } from 'lucide-react';

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/customers', label: 'Customers', icon: Users },
    { path: '/segments', label: 'Segments', icon: Filter },
    { path: '/campaigns', label: 'Campaigns', icon: Send },
  ];

  return (
    <div className="fixed left-0 top-0 h-screen w-60 flex flex-col z-20"
      style={{
        background: "rgba(4,4,20,0.97)",
        borderRight: "1px solid rgba(108,71,255,0.12)",
        backdropFilter: "blur(20px)"
      }}
    >
      {/* Logo — Xeno style */}
      <div className="p-5 border-b"
        style={{ borderColor: "rgba(108,71,255,0.1)" }}>
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10">
            <img src="/app-logo.png" alt="ThreadCo" className="w-full h-full object-cover rounded-xl shadow-[0_4px_24px_rgba(255,43,68,0.25)]" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-none">
              ThreadCo
            </p>
            <p className="text-xs mt-0.5 uppercase tracking-widest font-bold"
              style={{ color: "rgba(108,71,255,0.8)" }}>
              Xeno CRM
            </p>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ path, label, icon: Icon }) => {
          const isActive = location.pathname === path ||
            (path !== '/' && location.pathname.startsWith(path));
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="w-full flex items-center gap-3 px-3 py-2.5 
                         rounded-xl text-sm font-medium transition-all 
                         duration-200 text-left"
              style={isActive ? {
                background: "rgba(108,71,255,0.15)",
                color: "#A48DFF",
                border: "1px solid rgba(108,71,255,0.25)",
                boxShadow: "inset 0 0 20px rgba(108,71,255,0.08)"
              } : {
                color: "rgba(255,255,255,0.4)",
                border: "1px solid transparent"
              }}
            >
              <Icon size={17} strokeWidth={isActive ? 2 : 1.5} />
              {label}
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full"
                  style={{ background: "#6C47FF" }} />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom — Xeno style footer */}
      <div className="p-4 border-t"
        style={{ borderColor: "rgba(108,71,255,0.1)" }}>
        {/* AI status */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-3"
          style={{
            background: "rgba(16,185,129,0.08)",
            border: "1px solid rgba(16,185,129,0.2)"
          }}>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full 
                             rounded-full opacity-75"
              style={{ background: "#10B981" }} />
            <span className="relative inline-flex rounded-full h-2 w-2"
              style={{ background: "#10B981" }} />
          </span>
          <span className="text-xs font-medium"
            style={{ color: "#10B981" }}>
            AI Active
          </span>
          <span className="ml-auto text-xs"
            style={{ color: "rgba(255,255,255,0.3)" }}>
            NIM
          </span>
        </div>

        <div className="flex justify-between px-1">
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
            Xeno CRM
          </span>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
            v1.0
          </span>
        </div>
      </div>
    </div>
  );
}
