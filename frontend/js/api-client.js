class ApiClient {
  constructor() {
    this.baseUrl = ''; // same-origin
  }

  async request(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include'
    });

    if (res.status === 401) {
      // Let caller show modal; do not redirect.
      throw new Error('Unauthorized');
    }

    // Allow empty responses
    const text = await res.text();
    if (!res.ok) {
      try {
        const obj = text ? JSON.parse(text) : {};
        throw new Error(obj.error || `Request failed (${res.status})`);
      } catch {
        throw new Error(`Request failed (${res.status})`);
      }
    }

    return text ? JSON.parse(text) : null;
  }

  get(endpoint) { return this.request(endpoint, { method: 'GET' }); }
  post(endpoint, body) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) }); }
  put(endpoint, body) { return this.request(endpoint, { method: 'PUT', body: JSON.stringify(body) }); }
  delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); }

  getProjects() { return this.get('/api/projects'); }
  getProject(id) { return this.get(`/api/projects/${id}`); }
  createProject(payload) { return this.post('/api/projects', payload); }
  updateProject(id, payload) { return this.put(`/api/projects/${id}`, payload); }
  deleteProject(id) { return this.delete(`/api/projects/${id}`); }

  async exportProject(id) {
    const res = await fetch(`${this.baseUrl}/api/projects/${id}/export`, {
      credentials: 'include'
    });
    if (res.status === 401) throw new Error('Unauthorized');
    if (!res.ok) throw new Error('Export failed');
    return res.blob();
  }

  importProject(file) {
    return this.upload('/api/projects/import', file);
  }

  // Upload helper for imports
  async upload(endpoint, file) {
    const form = new FormData();
    form.append('uapf', file);

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      body: form,
      credentials: 'include'
    });

    if (res.status === 401) throw new Error('Unauthorized');
    if (!res.ok) throw new Error('Import failed');
    return res.json();
  }
}

export const apiClient = new ApiClient();
window.apiClient = apiClient;
