import React, { useEffect, useState } from 'react';

const Gauge = ({ value = 0, color = "#ef4d23", showLabels = false, min = "", max = "" }) => {
  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    const duration = 1500;
    const startTime = performance.now();
    
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const ease = 1 - Math.pow(1 - progress, 4); // easeOutQuart
      setAnimatedValue(Math.round(value * ease));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setAnimatedValue(value);
      }
    };
    
    const rAF = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rAF);
  }, [value]);

  const activeCount = Math.round((animatedValue / 100) * 40);
  
  const renderTicks = () => {
    const ticks = [];
    for (let i = 0; i < 40; i++) {
      const theta = Math.PI + (i / 39) * Math.PI;
      const x1 = 100 + 70 * Math.cos(theta);
      const y1 = 100 + 70 * Math.sin(theta);
      const x2 = 100 + 80 * Math.cos(theta);
      const y2 = 100 + 80 * Math.sin(theta);
      
      const isActive = i < activeCount;
      
      ticks.push(
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          strokeWidth="2.5"
          strokeLinecap="round"
          stroke={isActive ? color : "#d4d4d8"}
          style={{ transition: 'stroke 0.1s ease-in-out' }}
        />
      );
    }
    return ticks;
  };

  return (
    <div className="w-full max-w-[260px] mx-auto flex flex-col">
      <svg viewBox="0 0 200 120" className="w-full h-auto">
        {renderTicks()}
        <text x="100" y="105" textAnchor="middle" fontSize="22" fontWeight="600" fill="#0b0f1a" style={{ fontFamily: 'Inter, sans-serif' }}>
          {animatedValue}%
        </text>
      </svg>
      {showLabels && (
        <div className="flex justify-between items-center text-[11px] text-neutral-500 font-medium px-4 -mt-2">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      )}
    </div>
  );
};

export default Gauge;
