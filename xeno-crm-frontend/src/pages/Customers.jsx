import React, { useState, useEffect, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import CustomerRow from '../components/CustomerRow';
import { getCustomers } from '../api';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
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
    const fetchCustomers = async () => {
      setIsLoading(true);
      try {
        const data = await getCustomers({ limit: 500 });
        setCustomers(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  // Compute derived filter lists
  const cities = useMemo(() => [...new Set(customers.map(c => c.city))], [customers]);
  const tags = useMemo(() => {
    const allTags = customers.flatMap(c => c.tags || []);
    return [...new Set(allTags)];
  }, [customers]);

  // Apply filters locally
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchSearch = (c.name?.toLowerCase() || '').includes(search.toLowerCase()) || 
                          (c.email?.toLowerCase() || '').includes(search.toLowerCase());
      const matchCity = cityFilter ? c.city === cityFilter : true;
      const matchTag = tagFilter ? (c.tags || []).includes(tagFilter) : true;
      const matchGender = genderFilter ? c.gender === genderFilter : true;
      return matchSearch && matchCity && matchTag && matchGender;
    });
  }, [customers, search, cityFilter, tagFilter, genderFilter]);

  const totalPages = Math.ceil(filteredCustomers.length / perPage) || 1;
  const paginatedCustomers = filteredCustomers.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="w-full px-3 sm:px-4 pt-8 mt-2 max-w-[1100px] mx-auto pb-12">
      
      {/* Header */}
      <div className="mb-6 px-2">
        <div className="inline-flex items-center gap-2 bg-white rounded-full px-3 py-1.5 shadow-sm mb-4 border border-neutral-200">
          <span className="w-2 h-2 rounded-full bg-[#ef4d23]"></span>
          <span className="text-[12px] font-semibold text-neutral-800">Customer Directory</span>
        </div>
        <h2 className="text-[#0b0f1a] font-medium" style={{ fontSize: "clamp(28px, 5vw, 42px)", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
          Explore and analyze your <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontWeight: 400 }}>Audience</span>
        </h2>
        <p className="text-neutral-500 mt-2 text-[14px]">
          Browse, filter, and discover new high-value segments from your database.
        </p>
      </div>

      {/* Top Filter Bar */}
      <div className="bg-white p-4 rounded-2xl mb-6 flex flex-col md:flex-row gap-3 shadow-sm border border-neutral-200">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" />
          <input 
            type="text"
            placeholder="Search customers..."
            className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-[#ef4d23] focus:ring-1 focus:ring-[#ef4d23] transition-all text-[13px] text-neutral-800 placeholder-neutral-400"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        
        <select 
          className="bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-[13px] text-neutral-800 focus:outline-none focus:border-[#ef4d23]"
          value={cityFilter}
          onChange={e => { setCityFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Cities</option>
          {cities.map(city => <option key={city} value={city}>{city}</option>)}
        </select>

        <select 
          className="bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-[13px] text-neutral-800 focus:outline-none focus:border-[#ef4d23]"
          value={genderFilter}
          onChange={e => { setGenderFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Genders</option>
          <option value="M">Male</option>
          <option value="F">Female</option>
          <option value="Other">Other</option>
        </select>

        <select 
          className="bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-[13px] text-neutral-800 focus:outline-none focus:border-[#ef4d23]"
          value={tagFilter}
          onChange={e => { setTagFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Tags</option>
          {tags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
        </select>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="px-6 py-3 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Demographics</th>
                <th className="px-6 py-3 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Value</th>
                <th className="px-6 py-3 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Tags</th>
                <th className="px-6 py-3 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Last Active</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-neutral-500 text-[13px]">
                    <div className="flex justify-center mb-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ef4d23]"></div>
                    </div>
                    Loading customer data...
                  </td>
                </tr>
              ) : paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-neutral-500 text-[13px]">
                    No customers found matching the criteria.
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map(c => <CustomerRow key={c.id} customer={c} />)
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="bg-white border-t border-neutral-200 px-6 py-4 flex items-center justify-between">
          <p className="text-[12px] text-neutral-500">
            Showing <span className="font-semibold text-[#0b0f1a]">{((page - 1) * perPage) + 1}</span> to <span className="font-semibold text-[#0b0f1a]">{Math.min(page * perPage, filteredCustomers.length)}</span> of <span className="font-semibold text-[#0b0f1a]">{filteredCustomers.length}</span> results
          </p>
          <div className="flex gap-2">
            <button 
              className="p-1.5 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 disabled:opacity-50 disabled:hover:bg-white transition-colors"
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              className="p-1.5 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 disabled:opacity-50 disabled:hover:bg-white transition-colors"
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Customers;
