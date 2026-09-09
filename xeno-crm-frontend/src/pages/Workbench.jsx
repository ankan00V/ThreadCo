import React, { useEffect, useState } from 'react';
import { getWorkbenchSummary, executeWorkbenchQuery } from '../api';
import { Database, Play, Clock, Activity, Table, Code, LayoutDashboard } from 'lucide-react';

const SAMPLE_QUERIES = [
  {
    name: "Customer Demographics",
    query: "SELECT city, gender, COUNT(*) as total_customers, ROUND(AVG(total_spent)::numeric, 2) as avg_spent\nFROM customers\nGROUP BY city, gender\nORDER BY total_customers DESC\nLIMIT 10;"
  },
  {
    name: "High Value Segments",
    query: "SELECT unnest(tags) as tag, COUNT(*) as tag_count, ROUND(SUM(total_spent)::numeric, 2) as total_revenue\nFROM customers\nGROUP BY tag\nORDER BY total_revenue DESC\nLIMIT 5;"
  },
  {
    name: "Recent Campaign Performance",
    query: "SELECT c.name as campaign, c.channel, c.status, \nc.total_sent, c.total_delivered, \nROUND((c.total_opened::float / NULLIF(c.total_delivered, 0) * 100)::numeric, 2) as open_rate_pct\nFROM campaigns c\nORDER BY c.created_at DESC\nLIMIT 5;"
  }
];

const Workbench = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [query, setQuery] = useState(SAMPLE_QUERIES[0].query);
  const [queryResult, setQueryResult] = useState(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState(null);
  const [activeTab, setActiveTab] = useState('results'); // 'results' or 'explain'

  useEffect(() => {
    getWorkbenchSummary()
      .then((data) => {
        setSummary(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleRunQuery = async () => {
    if (!query.trim()) return;
    
    setQueryLoading(true);
    setQueryError(null);
    setQueryResult(null);
    setActiveTab('results');
    
    try {
      const result = await executeWorkbenchQuery(query);
      setQueryResult(result);
    } catch (err) {
      setQueryError(err.response?.data?.detail || err.message || "Failed to execute query");
    } finally {
      setQueryLoading(false);
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 md:px-12 max-w-[1400px] mx-auto pt-8 md:pt-12 pb-24 font-body">
      
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 backdrop-blur-md px-4 py-1.5 text-xs text-muted-foreground font-body mb-3 shadow-sm">
          <Database className="w-3.5 h-3.5 text-[#ef4d23]" />
          <span>Data Analyst Workbench</span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl text-foreground tracking-tight leading-[0.98]">
          Query <span className="font-display italic font-normal text-[#ef4d23]">Optimization</span> & Analytics
        </h1>
        <p className="text-muted-foreground mt-3 text-sm md:text-base max-w-2xl font-body">
          Write SQL, analyze execution plans, and translate business problems into data insights. 
          Connected to real-time CRM database.
        </p>
      </div>

      {/* Database Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white/60 backdrop-blur-md border border-neutral-200 rounded-2xl p-5 flex flex-col">
          <div className="text-sm font-medium text-neutral-500 mb-1 flex items-center gap-2">
            <LayoutDashboard size={16} />
            Total Customers
          </div>
          <div className="text-3xl font-display font-semibold text-neutral-900">
            {loading ? "..." : (summary?.counts?.customers?.toLocaleString() || "0")}
          </div>
        </div>
        <div className="bg-white/60 backdrop-blur-md border border-neutral-200 rounded-2xl p-5 flex flex-col">
          <div className="text-sm font-medium text-neutral-500 mb-1 flex items-center gap-2">
            <Activity size={16} />
            Audience Segments
          </div>
          <div className="text-3xl font-display font-semibold text-neutral-900">
            {loading ? "..." : (summary?.counts?.segments?.toLocaleString() || "0")}
          </div>
        </div>
        <div className="bg-white/60 backdrop-blur-md border border-neutral-200 rounded-2xl p-5 flex flex-col">
          <div className="text-sm font-medium text-neutral-500 mb-1 flex items-center gap-2">
            <Database size={16} />
            Campaign Executions
          </div>
          <div className="text-3xl font-display font-semibold text-neutral-900">
            {loading ? "..." : (summary?.counts?.campaigns?.toLocaleString() || "0")}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Query Editor */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden flex flex-col h-full">
            <div className="bg-neutral-50 border-b border-neutral-200 px-4 py-3 flex justify-between items-center">
              <span className="font-semibold text-sm flex items-center gap-2">
                <Code size={16} />
                SQL Editor
              </span>
              <button 
                onClick={handleRunQuery}
                disabled={queryLoading}
                className="bg-[#ef4d23] hover:bg-[#d9421b] text-white px-4 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {queryLoading ? (
                  <div className="animate-spin h-3 w-3 border-2 border-white/30 border-t-white rounded-full" />
                ) : (
                  <Play size={12} fill="currentColor" />
                )}
                Run Query
              </button>
            </div>
            
            <textarea
              className="w-full h-[300px] p-4 font-mono text-sm bg-[#0d1117] text-[#c9d1d9] focus:outline-none resize-none"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="SELECT * FROM customers LIMIT 10;"
              spellCheck={false}
            />
            
            <div className="p-4 bg-neutral-50 border-t border-neutral-200">
              <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Sample Queries</h4>
              <div className="flex flex-col gap-2">
                {SAMPLE_QUERIES.map((sq, idx) => (
                  <button
                    key={idx}
                    onClick={() => setQuery(sq.query)}
                    className="text-left text-sm text-neutral-700 hover:text-[#ef4d23] transition-colors py-1 flex items-center gap-2"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
                    {sq.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Right Column: Results */}
        <div className="lg:col-span-2 flex flex-col">
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden flex-1 flex flex-col min-h-[500px]">
            
            {/* Results Header Tabs */}
            <div className="bg-neutral-50 border-b border-neutral-200 px-2 pt-2 flex items-end">
              <button 
                onClick={() => setActiveTab('results')}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'results' ? 'border-[#ef4d23] text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}
              >
                <Table size={16} />
                Data Results
              </button>
              <button 
                onClick={() => setActiveTab('explain')}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'explain' ? 'border-[#ef4d23] text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}
              >
                <Activity size={16} />
                Execution Plan
              </button>
              
              {queryResult && (
                <div className="ml-auto px-4 py-2 flex items-center gap-2 text-xs font-medium text-emerald-600 bg-emerald-50 rounded-t-lg border border-b-0 border-emerald-100">
                  <Clock size={14} />
                  {queryResult.execution_time_ms} ms
                </div>
              )}
            </div>
            
            {/* Results Content */}
            <div className="flex-1 overflow-auto bg-white p-0 relative">
              {queryLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ef4d23] mb-4"></div>
                  <p className="text-sm text-neutral-500">Executing query...</p>
                </div>
              ) : queryError ? (
                <div className="p-6">
                  <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 font-mono text-sm">
                    <strong>Error executing query:</strong>
                    <div className="mt-2 whitespace-pre-wrap">{queryError}</div>
                  </div>
                </div>
              ) : !queryResult ? (
                <div className="h-full flex flex-col items-center justify-center text-neutral-400 p-8 text-center">
                  <Database size={48} className="mb-4 opacity-20" />
                  <p>Enter a SQL query and click Run to see results and performance metrics.</p>
                </div>
              ) : activeTab === 'results' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-max">
                    <thead>
                      <tr className="bg-neutral-50/50 border-b border-neutral-200 text-neutral-600 text-[11px] font-semibold uppercase tracking-wider">
                        {queryResult.columns.map((col, i) => (
                          <th key={i} className="px-4 py-3 whitespace-nowrap">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {queryResult.rows.length === 0 ? (
                        <tr>
                          <td colSpan={queryResult.columns.length} className="px-4 py-8 text-center text-sm text-neutral-500">
                            Query returned 0 rows.
                          </td>
                        </tr>
                      ) : (
                        queryResult.rows.map((row, i) => (
                          <tr key={i} className="hover:bg-neutral-50/50">
                            {queryResult.columns.map((col, j) => (
                              <td key={j} className="px-4 py-2.5 text-sm text-neutral-800">
                                {row[col] !== null ? String(row[col]) : <span className="text-neutral-400 italic">null</span>}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  {queryResult.rows.length === 100 && (
                    <div className="p-3 text-center text-xs text-neutral-500 bg-neutral-50 border-t border-neutral-100">
                      Results limited to 100 rows for display.
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-[#0d1117] h-full text-[#c9d1d9] font-mono text-xs overflow-auto whitespace-pre">
                  {queryResult.explain_plan && queryResult.explain_plan.length > 0 ? (
                    queryResult.explain_plan.join('\n')
                  ) : (
                    "No EXPLAIN ANALYZE output available for this query."
                  )}
                </div>
              )}
            </div>
            
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default Workbench;
