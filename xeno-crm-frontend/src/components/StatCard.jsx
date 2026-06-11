import AnimatedCounter from './AnimatedCounter';
import { motion } from "motion/react";

export default function StatCard({ 
  title, rawValue, prefix = "", suffix = "", 
  decimals = 0, subtitle, icon: Icon, delay = 0 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut", delay }}
      className="glass-card p-6 flex flex-col"
    >
      <div className="flex items-start justify-between mb-4">
        <span className="text-xs font-medium uppercase tracking-widest 
                         text-text-muted">
          {title}
        </span>
        {Icon && (
          <div className="p-2 rounded-lg bg-brand-500/10">
            <Icon size={18} className="text-brand-400" />
          </div>
        )}
      </div>

      <div className="text-4xl font-bold tracking-tight mt-1 flex items-baseline">
        <span className="glow-text text-transparent bg-clip-text drop-shadow-[0_0_12px_rgba(164,141,255,0.4)]">
          {prefix}
          <AnimatedCounter 
            value={rawValue} 
            suffix={suffix} 
            decimals={decimals} 
          />
        </span>
      </div>

      {subtitle && (
        <p className="text-text-secondary text-sm mt-2">{subtitle}</p>
      )}
    </motion.div>
  );
}
