export const authManager = {
  isAuthenticated: false,
  user: null,
  workspaces: null,

  async init() {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    const data = await res.json();

    this.isAuthenticated = !!data.authenticated;
    this.user = data.user || null;
    this.workspaces = data.workspaces || null;

    return data;
  },

  async loginWithPassword(email, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error || 'Login failed');
    }
    return this.init();
  },

  async register(email, password, name) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error || 'Registration failed');
    }
    return this.init();
  },

  async logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    this.isAuthenticated = false;
    this.user = null;
    this.workspaces = null;
  }
};
