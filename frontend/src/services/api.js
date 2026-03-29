import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  signup: (data) => api.post('/auth/signup', data),
  login: (data) => api.post('/auth/login', data),
  getProfile: () => api.get('/auth/profile'),
};

// Users
export const userAPI = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.patch(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};

// Expenses
export const expenseAPI = {
  getAll: (params) => api.get('/expenses', { params }),
  getById: (id) => api.get(`/expenses/${id}`),
  create: (data) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value);
      }
    });
    return api.post('/expenses', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  update: (id, data) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value);
      }
    });
    return api.patch(`/expenses/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  submit: (id) => api.post(`/expenses/${id}/submit`),
  delete: (id) => api.delete(`/expenses/${id}`),
  getCategories: () => api.get('/expenses/categories'),
};

// Approvals
export const approvalAPI = {
  getPending: () => api.get('/approvals/pending'),
  approve: (id, comment) => api.post(`/approvals/${id}/approve`, { comment }),
  reject: (id, comment) => api.post(`/approvals/${id}/reject`, { comment }),
  override: (id, action, comment) =>
    api.post(`/approvals/${id}/override`, { action, comment }),
};

// Workflows
export const workflowAPI = {
  getAll: () => api.get('/workflows'),
  getById: (id) => api.get(`/workflows/${id}`),
  create: (data) => api.post('/workflows', data),
  update: (id, data) => api.patch(`/workflows/${id}`, data),
  delete: (id) => api.delete(`/workflows/${id}`),
  getRules: () => api.get('/workflows/rules/all'),
  createRule: (data) => api.post('/workflows/rules', data),
  attachRule: (stepId, ruleId) =>
    api.post(`/workflows/steps/${stepId}/rules`, { ruleId }),
};

// Currency
export const currencyAPI = {
  getCountries: () => api.get('/currency/countries'),
  getExchangeRate: (from, to) => api.get('/currency/exchange-rate', { params: { from, to } }),
  convert: (amount, from, to) => api.get('/currency/convert', { params: { amount, from, to } }),
};

// OCR
export const ocrAPI = {
  scanReceipt: (file) => {
    const formData = new FormData();
    formData.append('receipt', file);
    return api.post('/ocr/scan', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000, // OCR can take time
    });
  },
};

export default api;
