import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: BASE,
});

// Customers
export const getCustomers = async (filters = {}) => {
  const response = await api.get('/api/customers', { params: filters });
  return response.data;
};

export const getCustomerDirectory = async (filters = {}) => {
  const response = await api.get('/api/customers/directory', { params: filters });
  return response.data;
};

export const getCustomerStats = async () => {
  const response = await api.get('/api/customers/stats');
  return response.data;
};

export const getAnalyticsOverview = async () => {
  const response = await api.get('/api/analytics/overview');
  return response.data;
};

export const getCustomer = async (id) => {
  const response = await api.get(`/api/customers/${id}`);
  return response.data;
};

// Segments
export const generateSegment = async (payload) => {
  const response = await api.post('/api/segments/generate', payload);
  return response.data;
};

export const getSegments = async () => {
  const response = await api.get('/api/segments');
  return response.data;
};

// Campaigns
export const getCampaigns = async () => {
  const response = await api.get('/api/campaigns');
  return response.data;
};

export const getCampaign = async (id) => {
  const response = await api.get(`/api/campaigns/${id}`);
  return response.data;
};

export const getCampaignStats = async (id) => {
  const response = await api.get(`/api/campaigns/${id}/stats`);
  return response.data;
};

export const checkCampaignCompletion = async (id) => {
  const response = await api.get(`/api/campaigns/${id}/check-completion`);
  return response.data;
};

export const createCampaign = async (payload) => {
  const response = await api.post('/api/campaigns', payload);
  return response.data;
};

export const generateMessage = async (payload) => {
  const response = await api.post('/api/campaigns/generate-message', payload);
  return response.data;
};

export const sendCampaign = async (id) => {
  const response = await api.post(`/api/campaigns/${id}/dispatch`);
  return response.data;
};

export const deleteCampaign = async (id) => {
  const response = await api.delete(`/api/campaigns/${id}`);
  return response.data;
};

// Dashboard
export const getWorkbenchSummary = async () => {
  const response = await api.get('/workbench/summary');
  return response.data;
};

export const getDashboardStats = async () => {
  const response = await api.get('/api/campaigns/dashboard/stats');
  return response.data;
};

export default api;

export const executeWorkbenchQuery = async (query) => {
  const response = await api.post('/workbench/query', { query });
  return response.data;
};

// ── Query Performance Lab ────────────────────────────────────────────────
export const getPerfCases = async () => {
  const response = await api.get('/api/perf/cases');
  return response.data;
};

export const runPerfCase = async (caseId) => {
  const response = await api.post(`/api/perf/cases/${caseId}/run`);
  return response.data;
};

export const runSafeQuery = async (query) => {
  const response = await api.post('/api/perf/query', { query });
  return response.data;
};

// ── Analysis ─────────────────────────────────────────────────────────────
export const getDataAudit = async () => {
  const response = await api.get('/api/insights/audit');
  return response.data;
};

export const getRetention = async () => {
  const response = await api.get('/api/insights/retention');
  return response.data;
};

export const getConcentration = async () => {
  const response = await api.get('/api/insights/concentration');
  return response.data;
};

export const getRecommendation = async () => {
  const response = await api.get('/api/insights/recommendation');
  return response.data;
};
