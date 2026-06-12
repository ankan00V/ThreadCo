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

export const getCustomerStats = async () => {
  const response = await api.get('/api/customers/stats');
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
export const getDashboardStats = async () => {
  const response = await api.get('/api/campaigns/dashboard/stats');
  return response.data;
};

export default api;
