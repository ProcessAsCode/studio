# Algomation Studio

A full-stack web application for visual modeling of business processes, decisions, and cases using BPMN, DMN, and CMMN standards. Export and import projects as Unified Algorithmic Process Format (UAPF) files.

## Features

- **BPMN Process Modeling**: Create and edit business process diagrams using BPMN 2.0
- **DMN Decision Modeling**: Design decision tables and DRDs using DMN 1.3
- **CMMN Case Modeling**: Model case management scenarios using CMMN 1.1
- **UAPF Import/Export**: Package all models into a single `.uapf` archive
- **XML Import/Export**: Import and export individual BPMN, DMN, and CMMN XML files
- **Live XML Preview**: Toggle between visual and XML views for each model type
- **Auth0 Authentication**: Secure user authentication and authorization
- **Database Persistence**: Store projects in PostgreSQL database
- **Multi-device Access**: Access your projects from anywhere
- **Project Management**: Create, update, delete, and organize projects

## Tech Stack

### Frontend
- Vanilla JavaScript (ES6 modules)
- Bootstrap 5
- BPMN.js 17.0.1
- DMN.js 14.5.0
- CMMN.js 0.20.0
- JSZip 3.10.1
- Auth0 SPA SDK

### Backend
- Node.js 20
- Express 4.18
- PostgreSQL 15
- Redis 7
- Auth0 JWT authentication
- Winston logging
- Docker & Docker Compose

### Infrastructure
- Docker containers for all services
- Nginx for frontend serving
- Apache reverse proxy (on server)
- WSL2 for Windows Server deployment

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Apache (HTTPS)                        │
│                  https://studio.algomation.io                │
└──────────────────────────┬──────────────────────────────────┘
                           │
                ┌──────────┴──────────┐
                │                     │
        ┌───────▼────────┐   ┌───────▼────────┐
        │   Nginx:37101  │   │ Backend:37100  │
        │   (Frontend)   │   │   (API)        │
        └────────────────┘   └───┬─────┬──────┘
                                 │     │
                        ┌────────┘     └────────┐
                        │                       │
                ┌───────▼────────┐   ┌──────────▼─────────┐
                │ PostgreSQL:5432│   │   Redis:6379       │
                │   (Database)   │   │   (Cache/Session)  │
                └────────────────┘   └────────────────────┘
```

## Ports

- **Frontend**: 37101 (internal, proxied via Apache)
- **Backend API**: 37100 (internal, proxied via Apache)
- **PostgreSQL**: 5432 (internal only, localhost)
- **Redis**: 6379 (internal only, localhost)
- **Public**: 443 (Apache HTTPS)

*Unusual ports (37100, 37101) chosen to avoid conflicts with common services.*

## Getting Started

### Prerequisites

- Docker and Docker Compose
- WSL2 (for Windows Server deployment)
- Auth0 account
- Apache with SSL (for production)

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Algomation-AI/Studio.git
   cd Studio
   ```

2. **Run setup script**
   ```bash
   ./scripts/setup.sh
   ```
   This creates `.env` file with auto-generated passwords.

3. **Configure Auth0**

   Edit `.env`:
   ```bash
   AUTH0_DOMAIN=your-domain.auth0.com
   AUTH0_CLIENT_ID=your_client_id
   AUTH0_AUDIENCE=https://api.algomation.io
   ```

   Edit `frontend/js/auth.js`:
   ```javascript
   domain: 'your-domain.auth0.com',
   clientId: 'your_client_id',
   ```

4. **Start services**
   ```bash
   ./scripts/start.sh
   ```

5. **Access the application**
   - Frontend: http://localhost:37101
   - Backend API: http://localhost:37100/health

### Production Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed production deployment instructions on Windows Server with WSL2.

## Project Structure

```
Studio/
├── backend/              # Node.js Express API
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js
│   └── README.md
├── database/             # PostgreSQL schema
│   └── schema.sql
├── frontend/             # Frontend application
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── main.js       # Main application logic
│   │   ├── auth.js       # Auth0 authentication
│   │   └── api-client.js # Backend API client
│   └── index.html
├── nginx/                # Nginx configuration
│   ├── nginx.conf
│   └── conf.d/
│       └── default.conf
├── scripts/              # Deployment scripts
│   ├── setup.sh          # Initial setup
│   ├── start.sh          # Start services
│   ├── stop.sh           # Stop services
│   └── logs.sh           # View logs
├── docker-compose.yml    # Docker services
├── .env.example          # Environment template
├── .gitignore
├── DEPLOYMENT.md         # Deployment guide
└── README.md
```

## API Endpoints

### Authentication
All API endpoints (except `/health`) require Auth0 JWT authentication.

### Health Check
- `GET /health` - Health check endpoint (no auth required)

### User
- `GET /api/user` - Get current user info (auto-creates user on first login)

### Projects
- `GET /api/projects` - List all projects for current user
- `GET /api/projects/:id` - Get specific project
- `POST /api/projects` - Create new project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `GET /api/projects/:id/export` - Export project as UAPF
- `POST /api/projects/import` - Import UAPF file

## UAPF Format

UAPF (Unified Algorithmic Process Format) is a ZIP archive containing:

```
project.uapf
├── manifest.json         # Project metadata
├── bpmn/
│   └── main.bpmn.xml    # BPMN process model
├── dmn/
│   └── main.dmn.xml     # DMN decision model
└── cmmn/
    └── main.cmmn.xml    # CMMN case model
```

### Manifest Structure
```json
{
  "name": "Project Name",
  "description": "Project description",
  "version": "1.0.0",
  "created": "2025-01-11T00:00:00Z",
  "models": {
    "bpmn": ["bpmn/main.bpmn.xml"],
    "dmn": ["dmn/main.dmn.xml"],
    "cmmn": ["cmmn/main.cmmn.xml"]
  }
}
```

## Database Schema

### Tables
- **users**: User accounts (linked to Auth0)
- **projects**: Project metadata and XML content
- **project_shares**: Project sharing permissions (for future use)
- **usage_metrics**: Usage tracking and analytics

See [database/schema.sql](database/schema.sql) for full schema.

## Environment Variables

See [.env.example](.env.example) for all configuration options.

### Required Variables
- `AUTH0_DOMAIN` - Your Auth0 domain
- `AUTH0_CLIENT_ID` - Auth0 application client ID
- `AUTH0_AUDIENCE` - Auth0 API audience
- `POSTGRES_PASSWORD` - PostgreSQL password (auto-generated)
- `REDIS_PASSWORD` - Redis password (auto-generated)
- `SESSION_SECRET` - Express session secret (auto-generated)

## Scripts

- `./scripts/setup.sh` - Initial setup (creates .env, directories)
- `./scripts/start.sh` - Start all Docker services
- `./scripts/stop.sh` - Stop all Docker services
- `./scripts/logs.sh [service]` - View logs (optionally for specific service)

## Breaking Changes from Previous Version

1. **Authentication Required**: Users must login with Auth0 (previously no auth)
2. **Database Storage**: Projects stored in PostgreSQL (previously localStorage)
3. **Backend API**: Projects now managed via REST API (previously client-only)

## Migration

Projects created in the previous version (localStorage-based) can be:
1. Exported as `.uapf` files using the old version
2. Imported into the new version using the Import UAPF feature

## Security

- Auth0 JWT authentication for all API endpoints
- Rate limiting (100 requests per 15 minutes per IP)
- Helmet.js security headers
- CORS restricted to studio.algomation.io
- PostgreSQL and Redis only accessible from localhost
- All secrets auto-generated and stored in .env (excluded from git)
- Input validation on all API endpoints
- SQL injection protection via parameterized queries

## Maintenance

### View Logs
```bash
# All services
./scripts/logs.sh

# Specific service
./scripts/logs.sh backend
```

### Restart Services
```bash
docker compose restart
```

### Database Backup
```bash
docker compose exec -T postgres pg_dump -U algomation algomation_studio > backup.sql
```

### Update Application
```bash
git pull origin main
docker compose down
docker compose build
docker compose up -d
```

## Troubleshooting

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed troubleshooting steps.

Common issues:
- **Auth0 errors**: Verify credentials in `.env` and `frontend/js/auth.js`
- **Database connection**: Check PostgreSQL container is running
- **Port conflicts**: Ensure ports 37100 and 37101 are available

## Contributing

This is a private repository for Algomation Studio. For issues or questions, contact the development team.

## License

Proprietary - Algomation AI

## Learn More

- [Algomation Website](https://algomation.io)
- [BPMN.js Documentation](https://bpmn.io/toolkit/bpmn-js/)
- [DMN.js Documentation](https://bpmn.io/toolkit/dmn-js/)
- [CMMN.js Documentation](https://bpmn.io/toolkit/cmmn-js/)
- [Auth0 Documentation](https://auth0.com/docs)

---

**Version**: 2.0.0
**Last Updated**: 2025-01-11
**Status**: Production Ready
