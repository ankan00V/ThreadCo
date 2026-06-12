import React from 'react';
import Navbar from './Navbar';

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen w-full bg-[#ededed] sm:p-3 md:p-4 font-inter">
      <div className="relative w-full h-[100dvh] sm:h-[calc(100vh-24px)] md:h-[calc(100vh-32px)] overflow-hidden bg-[#d9d9d9] sm:rounded-2xl md:rounded-3xl flex flex-col sm:shadow-2xl sm:ring-1 sm:ring-black/5">
        
        {/* Background Video */}
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          disableRemotePlayback
          webkit-playsinline="true"
          x5-playsinline="true"
          poster="https://images.unsplash.com/photo-1557683316-973673baf926?w=1600&q=60"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0"
        >
          <source src="/background-video.mp4" type="video/mp4" />
        </video>
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-white/10" />

        <Navbar />

        {/* Scrollable Content Container */}
        <div className="relative z-10 flex-1 overflow-y-auto no-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Layout;
