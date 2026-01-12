require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const { createClient } = require('redis');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const multer = require('multer');
const JSZip = require('jszip');
const winston = require('winston');

function resolveRedisStoreCtor() {
  let mod = require('connect-redis');
  mod = mod?.default || mod;

  // Possible shapes:
  // - class RedisStore
  // - { RedisStore: class }
  // - function factory(session) -> class
  // - function RedisStore(options) -> store instance (older patterns)
  const candidate = mod?.RedisStore || mod;

  // If it's a factory expecting session, try that first.
  if (typeof candidate === 'function') {
    try {
      // Some versions: candidate(session) -> class
      const maybeCtor = candidate(session);
      if (typeof maybeCtor === 'function') return maybeCtor;
    } catch (e) {
      // ignore and fall through
    }
    // Otherwise candidate itself might be the ctor (class) OR creator fn
    return candidate;
  }

  return null;
}

const RedisStoreResolved = resolveRedisStoreCtor();

const app = express();
const PORT = process.env.PORT || 37100;
// Trust first proxy (nginx) - required for rate limiting and IP detection
app.set('trust proxy', 1);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.File({ filename: '/app/logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: '/app/logs/combined.log' }),
    new winston.transports.Console({ format: winston.format.simple() })
  ]
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.query('SELECT NOW()', (err) => {
  if (err) logger.error('Database connection failed:', err);
  else logger.info('Database connected');
});

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => { logger.info(`${req.method} ${req.path}`, { ip: req.ip }); next(); });

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

const COOKIE_SECURE = (process.env.COOKIE_SECURE || 'true') === 'true';

const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.on('error', (err) => logger.error('Redis error', err));

let sessionStore;
if (!RedisStoreResolved) {
  throw new Error('connect-redis: could not resolve RedisStore');
}

// Try as constructor first
try {
  sessionStore = new RedisStoreResolved({ client: redisClient });
} catch (e) {
  // Try as function returning store instance
  sessionStore = RedisStoreResolved({ client: redisClient });
}

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET,
  name: 'studio_session',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: COOKIE_SECURE,
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

async function initSession() {
  if (!redisClient.isOpen) await redisClient.connect();
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: (parseInt(process.env.MAX_PROJECT_SIZE_MB) || 10) * 1024 * 1024 }
});

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

async function getUserById(userId) {
  const r = await pool.query(
    'SELECT id, email, name, avatar_url, created_at, last_login_at FROM users WHERE id=$1',
    [userId]
  );
  return r.rows[0] || null;
}

async function getUserWorkspaces(userId) {
  const orgs = await pool.query(`
    SELECT o.id, o.name, o.slug, om.role
    FROM organization_members om
    JOIN organizations o ON o.id = om.org_id
    WHERE om.user_id = $1
    ORDER BY o.name ASC
  `, [userId]);

  return {
    personal: { type: 'personal', role: 'owner' },
    orgs: orgs.rows.map(r => ({ type: 'org', id: r.id, name: r.name, slug: r.slug, role: r.role }))
  };
}

async function getOrgRole(userId, orgId) {
  const mem = await pool.query(
    'SELECT role FROM organization_members WHERE org_id=$1 AND user_id=$2',
    [orgId, userId]
  );
  return mem.rows[0]?.role || null;
}

async function logMetric(userId, action, resourceType, resourceId, metadata = {}) {
  try {
    await pool.query(
      `INSERT INTO usage_metrics (user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, action, resourceType, resourceId, JSON.stringify(metadata)]
    );
  } catch (error) { logger.error('Metric logging failed:', error); }
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'Algomation Studio API', port: PORT });
});

app.get('/api/auth/me', async (req, res) => {
  if (!req.session?.userId) return res.json({ authenticated: false });

  const user = await getUserById(req.session.userId);
  if (!user) return res.json({ authenticated: false });

  const workspaces = await getUserWorkspaces(user.id);
  return res.json({ authenticated: true, user, workspaces });
});

app.post('/api/auth/register', express.json(), async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Invalid email or password (min 8 chars)' });
  }

  const exists = await pool.query('SELECT 1 FROM users WHERE email=$1', [email.toLowerCase()]);
  if (exists.rowCount > 0) return res.status(409).json({ error: 'Email already registered' });

  const password_hash = await bcrypt.hash(password, 12);

  const created = await pool.query(
    `INSERT INTO users (email, name, auth_provider, password_hash, auth_provider_id)
     VALUES ($1, $2, 'local', $3, NULL)
     RETURNING id, email, name, avatar_url, created_at`,
    [email.toLowerCase(), name || null, password_hash]
  );

  req.session.userId = created.rows[0].id;
  return res.json({ ok: true, user: created.rows[0] });
});

app.post('/api/auth/login', express.json(), async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing email/password' });

  const r = await pool.query(
    `SELECT id, email, name, password_hash, account_status
     FROM users WHERE email=$1`,
    [email.toLowerCase()]
  );
  if (r.rowCount === 0) return res.status(401).json({ error: 'Invalid credentials' });

  const user = r.rows[0];
  if (user.account_status !== 'active') return res.status(403).json({ error: 'Account disabled' });
  if (!user.password_hash) return res.status(401).json({ error: 'Local password not set' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  await pool.query('UPDATE users SET last_login_at=NOW() WHERE id=$1', [user.id]);

  req.session.userId = user.id;
  return res.json({ ok: true });
});

app.post('/api/auth/logout', async (req, res) => {
  if (!req.session) return res.json({ ok: true });
  req.session.destroy(() => {
    res.clearCookie('studio_session');
    res.json({ ok: true });
  });
});

app.get('/api/projects', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const orgId = req.query.orgId || null;

    let result;
    if (orgId) {
      const role = await getOrgRole(userId, orgId);
      if (!role) return res.status(403).json({ error: 'Forbidden' });

      result = await pool.query(
        `SELECT * FROM projects WHERE owner_org_id=$1 ORDER BY updated_at DESC`,
        [orgId]
      );
    } else {
      result = await pool.query(
        `SELECT * FROM projects WHERE owner_user_id=$1 ORDER BY updated_at DESC`,
        [userId]
      );
    }

    await logMetric(userId, 'list_projects', 'project', null, { count: result.rows.length });
    res.json({ projects: result.rows, total: result.rows.length });
  } catch (error) {
    logger.error('Error listing projects:', error);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

app.get('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    const project = result.rows[0];

    if (project.owner_org_id) {
      const role = await getOrgRole(userId, project.owner_org_id);
      if (!role) return res.status(403).json({ error: 'Forbidden' });
    } else if (project.owner_user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await pool.query('UPDATE projects SET last_accessed_at = NOW() WHERE id = $1', [id]);
    await logMetric(userId, 'get_project', 'project', id);
    res.json(project);
  } catch (error) {
    logger.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

app.post('/api/projects', requireAuth, express.json(), async (req, res) => {
  try {
    const userId = req.session.userId;
    const {
      name,
      description,
      manifest,
      bpmn_xml,
      dmn_xml,
      cmmn_xml,
      orgId,
      bpmnXml,
      dmnXml,
      cmmnXml
    } = req.body || {};

    const resolvedBpmn = bpmn_xml ?? bpmnXml ?? null;
    const resolvedDmn = dmn_xml ?? dmnXml ?? null;
    const resolvedCmmn = cmmn_xml ?? cmmnXml ?? null;

    if (!name || name.length < 3) return res.status(400).json({ error: 'Name too short' });
    if (!manifest) return res.status(400).json({ error: 'Manifest is required' });
    const manifestValue = JSON.stringify(manifest || {});

    if (orgId) {
      const role = await getOrgRole(userId, orgId);
      if (!role) return res.status(403).json({ error: 'Forbidden' });
      if (!['owner', 'admin', 'editor'].includes(role)) return res.status(403).json({ error: 'Insufficient role' });

      const created = await pool.query(
        `INSERT INTO projects (owner_org_id, owner_user_id, name, description, manifest, bpmn_xml, dmn_xml, cmmn_xml)
         VALUES ($1, NULL, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [orgId, name, description || null, manifestValue, resolvedBpmn, resolvedDmn, resolvedCmmn]
      );
      await logMetric(userId, 'create_project', 'project', created.rows[0].id);
      return res.json(created.rows[0]);
    }

    const created = await pool.query(
      `INSERT INTO projects (owner_user_id, owner_org_id, name, description, manifest, bpmn_xml, dmn_xml, cmmn_xml)
       VALUES ($1, NULL, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, name, description || null, manifestValue, resolvedBpmn, resolvedDmn, resolvedCmmn]
    );
    await logMetric(userId, 'create_project', 'project', created.rows[0].id);
    res.json(created.rows[0]);
  } catch (error) {
    logger.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

app.put('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { id } = req.params;
    const checkResult = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    const project = checkResult.rows[0];

    if (project.owner_org_id) {
      const role = await getOrgRole(userId, project.owner_org_id);
      if (!role) return res.status(403).json({ error: 'Forbidden' });
      if (!['owner', 'admin', 'editor'].includes(role)) return res.status(403).json({ error: 'Insufficient role' });
    } else if (project.owner_user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const {
      name,
      description,
      bpmnXml,
      dmnXml,
      cmmnXml,
      bpmn_xml,
      dmn_xml,
      cmmn_xml,
      manifest
    } = req.body;
    const resolvedBpmn = bpmn_xml ?? bpmnXml;
    const resolvedDmn = dmn_xml ?? dmnXml;
    const resolvedCmmn = cmmn_xml ?? cmmnXml;
    const updates = [];
    const values = [id];
    let idx = 2;
    if (name !== undefined) { updates.push(`name = $${idx++}`); values.push(name.trim()); }
    if (description !== undefined) { updates.push(`description = $${idx++}`); values.push(description); }
    if (resolvedBpmn !== undefined) { updates.push(`bpmn_xml = $${idx++}`); values.push(resolvedBpmn); }
    if (resolvedDmn !== undefined) { updates.push(`dmn_xml = $${idx++}`); values.push(resolvedDmn); }
    if (resolvedCmmn !== undefined) { updates.push(`cmmn_xml = $${idx++}`); values.push(resolvedCmmn); }
    if (manifest !== undefined) { updates.push(`manifest = $${idx++}`); values.push(JSON.stringify(manifest)); }
    updates.push('updated_at = NOW()');
    const result = await pool.query(`UPDATE projects SET ${updates.join(', ')} WHERE id = $1 RETURNING *`, values);
    await logMetric(userId, 'update_project', 'project', id);
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

app.delete('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { id } = req.params;
    const checkResult = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    const project = checkResult.rows[0];

    if (project.owner_org_id) {
      const role = await getOrgRole(userId, project.owner_org_id);
      if (!role) return res.status(403).json({ error: 'Forbidden' });
      if (!['owner', 'admin', 'editor'].includes(role)) return res.status(403).json({ error: 'Insufficient role' });
    } else if (project.owner_user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING id', [id]);
    await logMetric(userId, 'delete_project', 'project', id);
    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    logger.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

app.get('/api/projects/:id/export', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    const project = result.rows[0];

    if (project.owner_org_id) {
      const role = await getOrgRole(userId, project.owner_org_id);
      if (!role) return res.status(403).json({ error: 'Forbidden' });
    } else if (project.owner_user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify(project.manifest, null, 2));
    if (project.bpmn_xml) zip.file('bpmn/main.bpmn.xml', project.bpmn_xml);
    if (project.dmn_xml) zip.file('dmn/main.dmn.xml', project.dmn_xml);
    if (project.cmmn_xml) zip.file('cmmn/main.cmmn.xml', project.cmmn_xml);
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    await logMetric(userId, 'export_project', 'project', id, { format: 'uapf' });
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${project.name.replace(/[^a-z0-9_-]/gi, '_')}.uapf"`);
    res.send(buffer);
  } catch (error) {
    logger.error('Error exporting project:', error);
    res.status(500).json({ error: 'Failed to export project' });
  }
});

app.post('/api/projects/import', requireAuth, upload.single('uapf'), async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const zip = await JSZip.loadAsync(req.file.buffer);
    const manifestFile = zip.files['manifest.json'];
    if (!manifestFile) return res.status(400).json({ error: 'Invalid UAPF: manifest.json missing' });
    const manifestText = await manifestFile.async('string');
    const manifest = JSON.parse(manifestText);
    const bpmnXml = zip.files['bpmn/main.bpmn.xml'] ? await zip.files['bpmn/main.bpmn.xml'].async('string') : null;
    const dmnXml = zip.files['dmn/main.dmn.xml'] ? await zip.files['dmn/main.dmn.xml'].async('string') : null;
    const cmmnXml = zip.files['cmmn/main.cmmn.xml'] ? await zip.files['cmmn/main.cmmn.xml'].async('string') : null;
    const result = await pool.query(
      `INSERT INTO projects (owner_user_id, owner_org_id, name, description, manifest, bpmn_xml, dmn_xml, cmmn_xml)
       VALUES ($1, NULL, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, manifest.name || 'Imported Project', manifest.description || '', JSON.stringify(manifest), bpmnXml, dmnXml, cmmnXml]
    );
    await logMetric(userId, 'import_project', 'project', result.rows[0].id, { fileSize: req.file.size });
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Error importing project:', error);
    res.status(500).json({ error: 'Failed to import project' });
  }
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => { res.status(404).json({ error: 'Not found' }); });

async function start() {
  await initSession();
  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`API listening on ${PORT}`);
  });

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received');
    server.close();
    await pool.end();
    process.exit(0);
  });
}

start().catch(err => {
  logger.error('Startup failed', err);
  process.exit(1);
});
