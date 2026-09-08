import React from 'react';

const timeAgo = (dateStr) => {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const seconds = Math.floor((new Date() - date) / 1000);
  
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "mo ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m ago";
  return Math.floor(seconds) + "s ago";
};

const TagPill = ({ tag }) => {
  const t = tag?.toLowerCase();
  let pillStyle = "bg-secondary text-foreground border-border";
  if (t === 'vip') pillStyle = "bg-accent/10 text-accent border-accent/20";
  else if (t === 'loyal') pillStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
  else if (t === 'churned') pillStyle = "bg-rose-50 text-rose-700 border-rose-200";
  else if (t === 'new') pillStyle = "bg-blue-50 text-blue-700 border-blue-200";

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold mr-1 border ${pillStyle}`}>
      {tag}
    </span>
  );
};

const CustomerRow = ({ customer }) => {
  const initials = customer.name ? customer.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'CU';

  return (
    <tr className="border-b border-border/40 hover:bg-white/60 transition-colors">
      <td className="px-6 py-3.5 whitespace-nowrap">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-secondary/80 border border-border/60 flex items-center justify-center text-[10px] font-semibold text-foreground shrink-0 shadow-inner">
            {initials}
          </div>
          <div>
            <div className="font-medium text-foreground text-xs">{customer.name}</div>
            <div className="text-muted-foreground text-[11px]">{customer.email}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-3.5 whitespace-nowrap">
        <div className="text-foreground text-xs font-medium">{customer.city || 'Remote'}</div>
        <div className="text-muted-foreground text-[11px] capitalize">{customer.gender || 'Unknown'}</div>
      </td>
      <td className="px-6 py-3.5 whitespace-nowrap">
        <div className="text-xs font-semibold text-foreground">₹{(customer.total_spent || 0).toLocaleString()}</div>
        <div className="text-muted-foreground text-[11px]">{customer.total_orders || 0} orders</div>
      </td>
      <td className="px-6 py-3.5 whitespace-nowrap">
        <div className="flex flex-wrap gap-1">
          {(customer.tags || []).map(tag => <TagPill key={tag} tag={tag} />)}
          {(!customer.tags || customer.tags.length === 0) && <span className="text-muted-foreground text-[11px]">—</span>}
        </div>
      </td>
      <td className="px-6 py-3.5 whitespace-nowrap text-[11px] text-muted-foreground font-mono">
        {timeAgo(customer.last_order_date)}
      </td>
    </tr>
  );
};

export default CustomerRow;
