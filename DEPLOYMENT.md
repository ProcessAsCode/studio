# Deployment Guide

## After Merging PR on Windows Server

### 1. Pull Changes
```bash
cd ~/Studio
git checkout main
git pull origin main
```

### 2. Setup
```bash
./scripts/setup.sh
```

This will:
- Copy `.env.example` to `.env`
- Generate secure random passwords for PostgreSQL and Redis
- Generate a secure session secret
- Create necessary directories (data, logs, backups)

### 3. Configure Auth0

Edit `.env` with your Auth0 credentials:
```bash
nano .env
```

Update these values:
```
AUTH0_DOMAIN=your-actual-domain.auth0.com
AUTH0_CLIENT_ID=your_actual_client_id
AUTH0_AUDIENCE=https://api.algomation.io
```

Also update `frontend/js/auth.js`:
```bash
nano frontend/js/auth.js
```

Update:
```javascript
domain: 'your-actual-domain.auth0.com',
clientId: 'your_actual_client_id',
```

### 4. Start Services
```bash
./scripts/start.sh
```

**Important**: Note the WSL IP address displayed in the output!

### 5. Configure Apache

Edit your Apache VirtualHost configuration:
```
C:\wamp64\bin\apache\apache2.x.x\conf\extra\httpd-vhosts.conf
```

Inside your `<VirtualHost *:443>` for studio.algomation.io, add:

```apache
Define WSL_IP <your_wsl_ip_from_step_4>

SSLProxyEngine On
ProxyPreserveHost On
ProxyRequests Off

# Backend API
ProxyPass /api http://${WSL_IP}:37100/api
ProxyPassReverse /api http://${WSL_IP}:37100/api

ProxyPass /health http://${WSL_IP}:37100/health
ProxyPassReverse /health http://${WSL_IP}:37100/health

# Frontend (must be last)
ProxyPass / http://${WSL_IP}:37101/
ProxyPassReverse / http://${WSL_IP}:37101/
```

Restart Apache:
```cmd
net stop wampapache64
net start wampapache64
```

### 6. Test

Visit: https://studio.algomation.io

The application should:
1. Redirect to Auth0 login
2. Return to app after login
3. Load all modelers (BPMN, DMN, CMMN)
4. Allow creating and saving projects
5. Support UAPF import/export

## Troubleshooting

### Services won't start
```bash
# Check service status
docker compose ps

# View logs
docker compose logs

# Check specific service
docker compose logs backend
```

### Can't reach from Apache
```bash
# Verify WSL IP address
ip addr show eth0 | grep "inet\b"

# Test connectivity from WSL
curl http://localhost:37100/health
curl http://localhost:37101

# Test from Windows (replace IP)
curl http://<wsl-ip>:37100/health
```

### Auth0 errors
- Verify `.env` has correct Auth0 credentials
- Verify `frontend/js/auth.js` has correct credentials
- Check Auth0 dashboard for correct callback URLs
- Ensure callback URL includes: `https://studio.algomation.io`

### Database connection issues
```bash
# Check PostgreSQL is running
docker compose ps postgres

# Check PostgreSQL logs
docker compose logs postgres

# Test database connection
docker compose exec postgres psql -U algomation -d algomation_studio -c "SELECT NOW();"
```

## Maintenance Commands

```bash
# View all logs (follow mode)
./scripts/logs.sh

# View specific service logs
./scripts/logs.sh backend
./scripts/logs.sh postgres
./scripts/logs.sh nginx

# Stop all services
./scripts/stop.sh

# Restart all services
docker compose restart

# Rebuild and restart specific service
docker compose up -d --build backend
```

## Backup

### Manual Backup
```bash
# Create backup directory with timestamp
BACKUP_DIR="backups/backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup database
docker compose exec -T postgres pg_dump -U algomation algomation_studio > "$BACKUP_DIR/database.sql"

# Backup environment config
cp .env "$BACKUP_DIR/env.backup"

echo "Backup created in $BACKUP_DIR"
```

### Restore from Backup
```bash
# Restore database
docker compose exec -T postgres psql -U algomation algomation_studio < backups/backup-YYYYMMDD-HHMMSS/database.sql
```

## Monitoring

### Health Checks
```bash
# Backend health
curl http://localhost:37100/health

# Frontend health
curl http://localhost:37101/health

# All services status
docker compose ps
```

### View Logs
- Backend logs: `./logs/combined.log`
- Backend errors: `./logs/error.log`
- Nginx logs: `./logs/nginx/access.log` and `./logs/nginx/error.log`

## Updating

When new changes are pushed to main:

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart services
docker compose down
docker compose build
docker compose up -d

# Verify everything is running
docker compose ps
./scripts/logs.sh
```

## Security Notes

- Database and Redis are only accessible from localhost (127.0.0.1)
- Backend API requires valid Auth0 JWT tokens
- All passwords are auto-generated during setup
- `.env` file is excluded from git (contains secrets)
- CORS is configured to only allow requests from studio.algomation.io
