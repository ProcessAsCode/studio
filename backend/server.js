require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { auth } = require('express-oauth2-jwt-bearer');
const { Pool } = require('pg');
const multer = require('multer');
const JSZip = require('jszip');
const winston = require('winston');

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

const checkJwt = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/`,
  tokenSigningAlg: 'RS256'
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: (parseInt(process.env.MAX_PROJECT_SIZE_MB) || 10) * 1024 * 1024 }
});

function getUserId(req) { return req.auth.payload.sub; }

async function logMetric(userId, action, resourceType, resourceId, metadata = {}) {
  try {
    await pool.query(
      `INSERT INTO usage_metrics (user_id, action, resource_type, resource_id, metadata)
       VALUES ((SELECT id FROM users WHERE auth_provider_id = $1), $2, $3, $4, $5)`,
      [userId, action, resourceType, resourceId, JSON.stringify(metadata)]
    );
  } catch (error) { logger.error('Metric logging failed:', error); }
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'Algomation Studio API', port: PORT });
});

app.get('/api/user', checkJwt, async (req, res) => {
  try {
    const userId = getUserId(req);
    let result = await pool.query('SELECT * FROM users WHERE auth_provider_id = $1', [userId]);
    if (result.rows.length === 0) {
      const userInfo = req.auth.payload;
      result = await pool.query(
        `INSERT INTO users (email, name, auth_provider, auth_provider_id) VALUES ($1, $2, $3, $4) RETURNING *`,
        [userInfo.email || '', userInfo.name || '', 'auth0', userId]
      );
    }
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

app.get('/api/projects', checkJwt, async (req, res) => {
  try {
    const userId = getUserId(req);
    const result = await pool.query(
      `SELECT p.id, p.name, p.description, p.is_public, p.created_at, p.updated_at
       FROM projects p WHERE p.user_id = (SELECT id FROM users WHERE auth_provider_id = $1)
       ORDER BY p.updated_at DESC LIMIT 100`,
      [userId]
    );
    await logMetric(userId, 'list_projects', 'project', null, { count: result.rows.length });
    res.json({ projects: result.rows, total: result.rows.length });
  } catch (error) {
    logger.error('Error listing projects:', error);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

app.get('/api/projects/:id', checkJwt, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const result = await pool.query(
      `SELECT p.* FROM projects p WHERE p.id = $1 AND p.user_id = (SELECT id FROM users WHERE auth_provider_id = $2)`,
      [id, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    await pool.query('UPDATE projects SET last_accessed_at = NOW() WHERE id = $1', [id]);
    await logMetric(userId, 'get_project', 'project', id);
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

app.post('/api/projects', checkJwt, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { name, description = '', bpmnXml, dmnXml, cmmnXml, manifest } = req.body;
    if (!name || name.trim().length < 3) return res.status(400).json({ error: 'Project name must be at least 3 characters' });
    if (!manifest) return res.status(400).json({ error: 'Manifest is required' });
    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM projects WHERE user_id = (SELECT id FROM users WHERE auth_provider_id = $1)`,
      [userId]
    );
    const maxProjects = parseInt(process.env.MAX_PROJECTS_PER_USER) || 50;
    if (countResult.rows[0].count >= maxProjects) return res.status(429).json({ error: `Maximum ${maxProjects} projects reached` });
    const result = await pool.query(
      `INSERT INTO projects (user_id, name, description, bpmn_xml, dmn_xml, cmmn_xml, manifest)
       VALUES ((SELECT id FROM users WHERE auth_provider_id = $1), $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, name.trim(), description, bpmnXml, dmnXml, cmmnXml, JSON.stringify(manifest)]
    );
    await logMetric(userId, 'create_project', 'project', result.rows[0].id);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

app.put('/api/projects/:id', checkJwt, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const { name, description, bpmnXml, dmnXml, cmmnXml, manifest } = req.body;
    const checkResult = await pool.query(
      `SELECT * FROM projects WHERE id = $1 AND user_id = (SELECT id FROM users WHERE auth_provider_id = $2)`,
      [id, userId]
    );
    if (checkResult.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    const updates = [];
    const values = [id];
    let idx = 2;
    if (name !== undefined) { updates.push(`name = $${idx++}`); values.push(name.trim()); }
    if (description !== undefined) { updates.push(`description = $${idx++}`); values.push(description); }
    if (bpmnXml !== undefined) { updates.push(`bpmn_xml = $${idx++}`); values.push(bpmnXml); }
    if (dmnXml !== undefined) { updates.push(`dmn_xml = $${idx++}`); values.push(dmnXml); }
    if (cmmnXml !== undefined) { updates.push(`cmmn_xml = $${idx++}`); values.push(cmmnXml); }
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

app.delete('/api/projects/:id', checkJwt, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM projects WHERE id = $1 AND user_id = (SELECT id FROM users WHERE auth_provider_id = $2) RETURNING id`,
      [id, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    await logMetric(userId, 'delete_project', 'project', id);
    res.json({ success: true, id });
  } catch (error) {
    logger.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

app.get('/api/projects/:id/export', checkJwt, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const result = await pool.query(
      `SELECT * FROM projects WHERE id = $1 AND user_id = (SELECT id FROM users WHERE auth_provider_id = $2)`,
      [id, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    const project = result.rows[0];
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

app.post('/api/projects/import', checkJwt, upload.single('uapf'), async (req, res) => {
  try {
    const userId = getUserId(req);
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
      `INSERT INTO projects (user_id, name, description, bpmn_xml, dmn_xml, cmmn_xml, manifest)
       VALUES ((SELECT id FROM users WHERE auth_provider_id = $1), $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, manifest.name || 'Imported Project', manifest.description || '', bpmnXml, dmnXml, cmmnXml, JSON.stringify(manifest)]
    );
    await logMetric(userId, 'import_project', 'project', result.rows[0].id, { fileSize: req.file.size });
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Error importing project:', error);
    res.status(500).json({ error: 'Failed to import project' });
  }
});

app.use((err, req, res, next) => {
  // Do not log auth missing-token as "Unhandled error" at error level
  if (err?.name === 'UnauthorizedError' || err?.name === 'InvalidRequestError') {
    return res.status(401).json({ error: 'Invalid or missing token' });
  }

  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => { res.status(404).json({ error: 'Not found' }); });

const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Algomation Studio API running on port ${PORT}`);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received');
  server.close();
  await pool.end();
  process.exit(0);
});
