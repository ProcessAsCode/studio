import createAuth0Client from 'https://cdn.auth0.com/js/auth0-spa-js/2.0/auth0-spa-js.production.esm.js';

export const authManager = {
  auth0Client: null,
  isAuthenticated: false,
  user: null,

  async init() {
    this.auth0Client = await createAuth0Client({
      domain: 'dev-4yciirk0gltvh1su.eu.auth0.com',
      clientId: 'xb1vtp5GSHmXloJ9bfS1mTmPdLpTX5mX',
      authorizationParams: {
        redirect_uri: window.location.origin,
        audience: 'https://api.algomation.io'
      }
    });

    if (window.location.search.includes('code=') && window.location.search.includes('state=')) {
      await this.auth0Client.handleRedirectCallback();
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    this.isAuthenticated = await this.auth0Client.isAuthenticated();
    if (this.isAuthenticated) {
      this.user = await this.auth0Client.getUser();
    }
  },

  async login() {
    if (!this.auth0Client) throw new Error('Auth0 client not initialized');
    await this.auth0Client.loginWithRedirect();
  },

  async signup() {
    if (!this.auth0Client) throw new Error('Auth0 client not initialized');
    await this.auth0Client.loginWithRedirect({
      authorizationParams: { screen_hint: 'signup' }
    });
  },

  async logout() {
    if (!this.auth0Client) return;
    await this.auth0Client.logout({ logoutParams: { returnTo: window.location.origin } });
  },

  async getToken() {
    if (!this.auth0Client) throw new Error('Auth0 client not initialized');
    return await this.auth0Client.getTokenSilently();
  }
};

window.authManager = authManager;
