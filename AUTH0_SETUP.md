# Auth0 Configuration Guide

## Critical Missing Configuration

Your authentication is not working because the **Auth0 Client ID** is missing.

### Quick Fix Steps

1. **Get your Auth0 Client ID**:
   - Go to https://manage.auth0.com/
   - Navigate to **Applications** → **Applications**
   - Find or create your "Algomation Studio" application
   - Copy the **Client ID** (looks like: `abc123xyz456...`)

2. **Update frontend/js/auth.js**:
   ```bash
   nano frontend/js/auth.js
   ```

   Replace line 11:
   ```javascript
   clientId: 'MISSING_CLIENT_ID_SEE_AUTH0_DASHBOARD',
   ```

   With your actual Client ID:
   ```javascript
   clientId: 'your_actual_client_id_here',
   ```

3. **(Optional) Create .env file** for backend:
   ```bash
   cp .env.example .env
   nano .env
   ```

   Update these values:
   ```bash
   AUTH0_DOMAIN=dev-4yciirk0gltvh1su.eu.auth0.com
   AUTH0_CLIENT_ID=your_actual_client_id_here
   AUTH0_AUDIENCE=https://api.algomation.io
   ```

4. **Restart services**:
   ```bash
   docker compose down
   docker compose up -d
   ```

## Auth0 Application Settings

Make sure your Auth0 application has these settings:

### Allowed Callback URLs
```
https://studio.algomation.io
http://localhost:37101
```

### Allowed Logout URLs
```
https://studio.algomation.io
http://localhost:37101
```

### Allowed Web Origins
```
https://studio.algomation.io
http://localhost:37101
```

### Application Type
- **Single Page Application**

## Current Configuration Status

✅ **Configured Correctly:**
- Auth0 Domain: `dev-4yciirk0gltvh1su.eu.auth0.com`
- Auth0 Audience: `https://api.algomation.io`
- CORS Origin: `https://studio.algomation.io`
- Backend trust proxy configuration

❌ **Missing:**
- Auth0 Client ID in `frontend/js/auth.js`

## Troubleshooting

If you see errors like:
```
InvalidRequestError at getToken
```

This means the frontend is not sending valid Auth0 tokens because the Client ID is not configured.

Once you update the Client ID and restart, authentication should work properly.
