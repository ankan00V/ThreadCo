import React from 'react';

const timeAgo = (dateStr) => {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const seconds = Math.floor((new Date() - date) / 1000);
  
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes ago";
  return Math.floor(seconds) + " seconds ago";
};

const TagPill = ({ tag }) => {
  const styles = {
    vip: 'bg-[#ef4d23]/10 text-[#ef4d23]',
    loyal: 'bg-blue-50 text-blue-600',
    churned: 'bg-red-50 text-red-600',
    new: 'bg-green-50 text-green-600'
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold mr-1 ${styles[tag?.toLowerCase()] || 'bg-neutral-100 text-neutral-600'}`}>
      {tag}
    </span>
  );
};

const CustomerRow = ({ customer }) => {
  return (
    <tr className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="font-semibold text-[#0b0f1a] text-[13px]">{customer.name}</div>
        <div className="text-neutral-500 text-[12px]">{customer.email}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-[#0b0f1a] text-[13px] font-medium">{customer.city}</div>
        <div className="text-neutral-500 text-[12px] capitalize">{customer.gender}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-[13px] font-semibold text-[#0b0f1a]">₹{(customer.total_spent || 0).toLocaleString()}</div>
        <div className="text-neutral-500 text-[12px]">{customer.total_orders || 0} orders</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex flex-wrap gap-1">
          {(customer.tags || []).map(tag => <TagPill key={tag} tag={tag} />)}
          {(!customer.tags || customer.tags.length === 0) && <span className="text-neutral-400 text-[12px]">-</span>}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-[12px] text-neutral-500">
        {timeAgo(customer.last_order_date)}
      </td>
    </tr>
  );
};

export default CustomerRow;
