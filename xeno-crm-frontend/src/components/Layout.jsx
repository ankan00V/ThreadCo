import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import StageBackground from './StageBackground';

const Layout = ({ children }) => {
  const contentRef = useRef(null);
  const { pathname } = useLocation();

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [pathname]);

  return (
    <div className="product-stage min-h-screen w-full font-inter">
      <div className="relative w-full h-[100dvh] overflow-hidden flex flex-col">
        
        <StageBackground />

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
