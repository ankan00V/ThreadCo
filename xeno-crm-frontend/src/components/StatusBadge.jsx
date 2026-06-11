import React from 'react';

const StatusBadge = ({ status }) => {
  const colors = {
    queued: 'bg-surface-hover text-text-muted border border-surface-border',
    sent: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    delivered: 'bg-brand-500/15 text-brand-300 border border-brand-500/30',
    failed: 'bg-status-danger/15 text-status-danger border border-status-danger/30',
    opened: 'bg-teal-500/15 text-teal-400 border border-teal-500/30',
    clicked: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
    
    // Campaign level statuses
    draft: 'bg-surface-hover text-text-muted border border-surface-border',
    running: 'bg-brand-500/15 text-brand-300 border border-brand-500/30',
    completed: 'bg-status-success/15 text-status-success border border-status-success/30'
  };

  const style = colors[status?.toLowerCase()] || colors.draft;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${style}`}>
      {status === 'running' && (
        <span className="relative flex h-1.5 w-1.5 mr-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-300 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-300"></span>
        </span>
      )}
      {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown'}
    </span>
  );
};

export default StatusBadge;
