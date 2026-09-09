import React, { useState, useEffect } from 'react';
import Loader from '../components/Loader';
import { Search, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import CustomerRow from '../components/CustomerRow';
import { getCustomerDirectory, getCustomerStats } from '../api';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [directoryStats, setDirectoryStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const perPage = 20;

  useEffect(() => {
    getCustomerStats().then(setDirectoryStats).catch(console.error);
  }, []);

  useEffect(() => {
    const fetchCustomers = async () => {
      setIsLoading(true);
      try {
        const data = await getCustomerDirectory({
          limit: perPage,
          offset: (page - 1) * perPage,
          search: search || undefined,
          city: cityFilter || undefined,
          tag: tagFilter || undefined,
          gender: genderFilter || undefined,
        });
        setCustomers(data.items || []);
        setTotalCustomers(data.total || 0);
      } catch (err) {
        console.error(err);
        setCustomers([]);
        setTotalCustomers(0);
      } finally {
        setIsLoading(false);
      }
    };
    const debounce = window.setTimeout(fetchCustomers, search ? 250 : 0);
    return () => window.clearTimeout(debounce);
  }, [page, search, cityFilter, tagFilter, genderFilter]);

  const cities = Object.keys(directoryStats?.city_breakdown || {}).sort();
  const tags = Object.keys(directoryStats?.tag_breakdown || {}).sort();
  const totalPages = Math.ceil(totalCustomers / perPage) || 1;

  return (
    <div className="w-full px-4 sm:px-6 md:px-12 max-w-[1100px] mx-auto pt-8 md:pt-12 pb-24 font-body">
      
      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 backdrop-blur-md px-4 py-1.5 text-xs text-muted-foreground font-body mb-3 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          <span>Customer Directory</span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl text-foreground tracking-tight leading-[0.98]">
          Explore and analyze your <span className="font-display italic font-normal text-accent">Audience</span>
        </h1>
        <p className="text-muted-foreground mt-3 text-sm md:text-base max-w-xl font-body">
          Browse, filter, and discover high-value customer cohorts directly from your synchronized database.
        </p>
      </div>

      {/* Top Filter Bar (Frosted Glass) */}
      <div 
        className="rounded-2xl p-4 mb-6 flex flex-col md:flex-row gap-3"
        style={{
          background: 'rgba(255, 255, 255, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.5)',
          boxShadow: 'var(--shadow-dashboard)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)'
        }}
      >
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <input 
            type="text"
            placeholder="Search customers by name, email..."
            className="w-full pl-9 pr-3 py-2 bg-white/70 border border-white/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-all text-xs text-foreground placeholder-muted-foreground shadow-inner"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        
        <select 
          className="bg-white/70 border border-white/80 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent shadow-sm"
          value={cityFilter}
          onChange={e => { setCityFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Cities</option>
          {cities.map(city => <option key={city} value={city}>{city}</option>)}
        </select>

        <select 
          className="bg-white/70 border border-white/80 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent shadow-sm"
          value={genderFilter}
          onChange={e => { setGenderFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Genders</option>
          <option value="M">Male</option>
          <option value="F">Female</option>
          <option value="Other">Other</option>
        </select>

        <select 
          className="bg-white/70 border border-white/80 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent shadow-sm"
          value={tagFilter}
          onChange={e => { setTagFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Tags</option>
          {tags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
        </select>
      </div>

      {/* Table Container (Frosted Glass) */}
      <div 
        className="rounded-2xl overflow-hidden shadow-sm"
        style={{
          background: 'rgba(255, 255, 255, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.5)',
          boxShadow: 'var(--shadow-dashboard)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)'
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-secondary/40 border-b border-border/50 text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                <th className="px-6 py-3.5">Customer</th>
                <th className="px-6 py-3.5">Demographics</th>
                <th className="px-6 py-3.5">Value</th>
                <th className="px-6 py-3.5">Tags</th>
                <th className="px-6 py-3.5">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-muted-foreground text-xs">
                    <div className="flex justify-center mb-3">
                      <Loader size="sm" label="Loading customers" />
                    </div>
                    Loading customer directory...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-muted-foreground text-xs">
                    No customers found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                customers.map(c => <CustomerRow key={c.id} customer={c} />)
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="bg-secondary/20 border-t border-border/50 px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <p className="text-muted-foreground text-center sm:text-left text-[11px]">
            Showing <span className="font-semibold text-foreground">{totalCustomers ? ((page - 1) * perPage) + 1 : 0}</span> to <span className="font-semibold text-foreground">{Math.min(page * perPage, totalCustomers)}</span> of <span className="font-semibold text-foreground">{totalCustomers}</span> customers
          </p>
          <div className="flex items-center gap-1.5">
            <button 
              className="p-1.5 rounded-full border border-white/80 bg-white/70 text-foreground hover:bg-white disabled:opacity-40 transition-colors shadow-sm"
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[11px] text-muted-foreground px-2 font-medium">Page {page} of {totalPages}</span>
            <button 
              className="p-1.5 rounded-full border border-white/80 bg-white/70 text-foreground hover:bg-white disabled:opacity-40 transition-colors shadow-sm"
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Customers;
