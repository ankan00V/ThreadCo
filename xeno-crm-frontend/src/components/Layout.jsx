import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';

const Layout = ({ children }) => {
  const contentRef = useRef(null);
  const { pathname } = useLocation();

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [pathname]);

  return (
    <div className="product-stage min-h-screen w-full font-inter">
      <div className="relative w-full h-[100dvh] overflow-hidden flex flex-col">
        
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
          className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0"
        >
          <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260319_015952_e1deeb12-8fb7-4071-a42a-60779fc64ab6.mp4" type="video/mp4" />
        </video>
        
        {/* Overlay */}
        <div className="absolute inset-0 product-stage__veil" />

        <Navbar />

        {/* Scrollable Content Container */}
        <div ref={contentRef} className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden no-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Layout;
