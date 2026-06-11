import { useRef } from "react";
import { useInView, animate } from "motion/react";

export default function AnimatedCounter({ 
  value, suffix = "", prefix = "", decimals = 0 
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });

  if (inView && ref.current) {
    animate(0, value, {
      duration: 1.8,
      ease: "easeOut",
      onUpdate(val) {
        if (ref.current) {
          ref.current.textContent = 
            prefix + val.toFixed(decimals) + suffix;
        }
      }
    });
  }

  return (
    <span ref={ref}>
      {prefix}0{suffix}
    </span>
  );
}
