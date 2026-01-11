import { authManager } from './auth.js';

class ApiClient {
  constructor() { this.baseUrl = window.location.origin; }
  async request(endpoint, options = {}) {
    try {
      const token = await authManager.getAccessToken();
      const headers = { 'Content-Type': 'application/json', ...options.headers };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch(`${this.baseUrl}${endpoint}`, { ...options, headers });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }
      return response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }
  async getProjects() { return this.request('/api/projects'); }
  async getProject(id) { return this.request(`/api/projects/${id}`); }
  async createProject(data) { return this.request('/api/projects', { method: 'POST', body: JSON.stringify(data) }); }
  async updateProject(id, data) { return this.request(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
  async deleteProject(id) { return this.request(`/api/projects/${id}`, { method: 'DELETE' }); }
  async exportProject(id) {
    const token = await authManager.getAccessToken();
    const response = await fetch(`${this.baseUrl}/api/projects/${id}/export`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Export failed');
    return response.blob();
  }
  async importProject(file) {
    const token = await authManager.getAccessToken();
    const formData = new FormData();
    formData.append('uapf', file);
    const response = await fetch(`${this.baseUrl}/api/projects/import`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    if (!response.ok) throw new Error('Import failed');
    return response.json();
  }
}
export const apiClient = new ApiClient();
window.apiClient = apiClient;
