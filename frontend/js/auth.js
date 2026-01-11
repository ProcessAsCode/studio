class AuthManager {
  constructor() {
    this.auth0Client = null;
    this.user = null;
    this.isAuthenticated = false;
  }
  async init() {
    try {
      this.auth0Client = await createAuth0Client({
        domain: 'dev-4yciirk0gltvh1su.eu.auth0.com',
        clientId: 'xb1vtp5GSHmXloJ9bfS1mTmPdLpTX5mX',
        authorizationParams: {
          redirect_uri: window.location.origin,
          audience: 'https://api.algomation.io'
        }
      });
      if (window.location.search.includes('code=')) {
        await this.auth0Client.handleRedirectCallback();
        window.history.replaceState({}, document.title, '/');
      }
      this.isAuthenticated = await this.auth0Client.isAuthenticated();
      if (this.isAuthenticated) {
        this.user = await this.auth0Client.getUser();
        console.log('Authenticated:', this.user.email);
      } else {
        await this.login();
      }
      return this.isAuthenticated;
    } catch (error) {
      console.error('Auth failed:', error);
      throw error;
    }
  }
  async login() { await this.auth0Client.loginWithRedirect(); }
  async logout() { await this.auth0Client.logout({ logoutParams: { returnTo: window.location.origin } }); }
  async getAccessToken() {
    if (!this.isAuthenticated) return null;
    try { return await this.auth0Client.getTokenSilently(); }
    catch (error) { await this.login(); return null; }
  }
  getUser() { return this.user; }
}
export const authManager = new AuthManager();
window.authManager = authManager;
