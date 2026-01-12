import { authManager } from './auth.js';

class ApiClient {
  constructor() {
    this.baseUrl = window.location.origin;
  }

  async request(endpoint, options = {}) {
    let token;

    try {
      token = await authManager.getToken();
    } catch (error) {
      await authManager.login();
      throw error;
    }

    const headers = { 'Content-Type': 'application/json', ...options.headers };
    headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${this.baseUrl}${endpoint}`, { ...options, headers });

    if (response.status === 401) {
      await authManager.login();
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async getProjects() {
    return this.request('/api/projects');
  }

  async getProject(id) {
    return this.request(`/api/projects/${id}`);
  }

  async createProject(data) {
    return this.request('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateProject(id, data) {
    return this.request(`/api/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteProject(id) {
    return this.request(`/api/projects/${id}`, { method: 'DELETE' });
  }

  async exportProject(id) {
    let token;

    try {
      token = await authManager.getToken();
    } catch (error) {
      await authManager.login();
      throw error;
    }

    const response = await fetch(`${this.baseUrl}/api/projects/${id}/export`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.status === 401) {
      await authManager.login();
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      throw new Error('Export failed');
    }

    return response.blob();
  }

  async importProject(file) {
    let token;

    try {
      token = await authManager.getToken();
    } catch (error) {
      await authManager.login();
      throw error;
    }

    const formData = new FormData();
    formData.append('uapf', file);

    const response = await fetch(`${this.baseUrl}/api/projects/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });

    if (response.status === 401) {
      await authManager.login();
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      throw new Error('Import failed');
    }

    return response.json();
  }
}

export const apiClient = new ApiClient();
window.apiClient = apiClient;
