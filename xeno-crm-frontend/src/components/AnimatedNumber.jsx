import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

export default function AnimatedNumber({ value, formatter = (v) => Math.round(v).toLocaleString(), duration = 1.5 }) {
  const [isReady, setIsReady] = useState(false);
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => formatter(latest));

  useEffect(() => {
    // Only animate when the value is > 0 or after initial render
    if (value >= 0) {
      setIsReady(true);
      const controls = animate(count, value, {
        duration: duration,
        ease: "easeOut"
      });
      return controls.stop;
    }
  }, [value, duration]);

  return <motion.span>{isReady ? rounded : formatter(0)}</motion.span>;
}
