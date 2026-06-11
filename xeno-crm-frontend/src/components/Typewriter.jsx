import { useRef } from "react";
import { motion, useInView } from "motion/react";

export default function Typewriter({ 
  text, delay = 0, speed = 0.015, className = "" 
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10px" });

  const containerVariants = {
    hidden: { opacity: 1 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: speed,
        delayChildren: delay,
      }
    }
  };

  const charVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 }
  };

  return (
    <motion.span
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={containerVariants}
    >
      {[...text].map((char, i) => (
        <motion.span key={i} variants={charVariants}>
          {char === " " ? "\u00A0" : char}
        </motion.span>
      ))}
    </motion.span>
  );
}
