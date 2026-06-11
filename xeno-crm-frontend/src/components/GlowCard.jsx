import { motion } from "motion/react";

export default function GlowCard({ 
  title, 
  description, 
  icon: Icon, 
  gradient, 
  delay = 0,
  value,
  badge,
  children
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut", delay }}
      className="relative flex flex-col justify-start items-start 
                 w-full group"
    >
      {/* Glow background layer */}
      <div
        className="absolute inset-0 opacity-40 rounded-[28px] 
                   pointer-events-none"
        style={{
          background: gradient,
          filter: "blur(40px)",
        }}
      />

      {/* Foreground card with gradient border */}
      <div
        className="relative w-full rounded-[28px] z-10 overflow-hidden 
                   p-6 flex flex-col justify-between min-h-[160px]"
        style={{
          border: "1px solid transparent",
          background: `linear-gradient(#0E0E1A, #0E0E1A) padding-box, 
                       ${gradient} border-box`,
          boxShadow: `0 0 20px rgba(108,71,255,0.06), 
                      0 1px 0 rgba(255,255,255,0.04) inset`,
        }}
      >
        {/* Top row: icon + badge */}
        <div className="flex items-start justify-between mb-4">
          {Icon && (
            <div className="text-white/80">
              <Icon size={24} strokeWidth={2} />
            </div>
          )}
          {badge && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full 
                             bg-white/10 text-white/60 border border-white/10">
              {badge}
            </span>
          )}
        </div>

        {/* Value (large number) */}
        {value !== undefined && (
          <div className="text-3xl font-bold text-white tracking-tight mb-1">
            {value}
          </div>
        )}

        {/* Title */}
        <div className="text-white/90 font-medium text-base tracking-tight">
          {title}
        </div>

        {/* Description */}
        {description && (
          <div className="text-white/40 text-sm leading-relaxed mt-1">
            {description}
          </div>
        )}

        {/* Custom children */}
        {children}
      </div>
    </motion.div>
  );
}
