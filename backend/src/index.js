require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const morgan     = require('morgan');
const path       = require('path');
const fs         = require('fs');
const rateLimit  = require('express-rate-limit');
const http       = require('http');
const { Server } = require('socket.io');

const authRoutes    = require('./routes/auth');
const wabaRoutes    = require('./routes/waba');
const webhookRoutes  = require('./routes/webhook');
const contactRoutes  = require('./routes/contacts');
const campaignRoutes = require('./routes/campaigns');
const chatRoutes      = require('./routes/chat');
const analyticsRoutes = require('./routes/analytics');
const mediaRoutes     = require('./routes/media');

const app  = express();
app.set('trust proxy', 1); // Trust first-hop reverse proxy (Nginx) for client IP and rate limiting
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});
io.on('connection', (socket) => {
  socket.on('join_org', (orgId) => {
    socket.join(orgId);
    console.log(`[socket] Client joined org: ${orgId}`);
  });
});
app.set('io', io);

const PORT = process.env.PORT || 5001;

// ── Ensure uploads dir exists ──────────────────────────────────────
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ── Morgan HTTP logging ────────────────────────────────────────────
morgan.token('org-id', (req) => req.orgId ? `[Org: ${req.orgId}]` : '[No Org]');
app.use(morgan(':method :url :status :response-time ms - :res[content-length] :org-id'));

// ── CORS ───────────────────────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body parsing ───────────────────────────────────────────────────
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

const { getPublicDir } = require('./utils/paths');
const publicDir = getPublicDir();
const uploadsDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true, mode: 0o755 });

// Serve static CDN assets on both /public and /api/public (for Nginx compatibility)
app.use('/public', express.static(publicDir));
app.use('/api/public', express.static(publicDir));
app.use('/uploads', express.static(uploadsDir));
app.use('/api/uploads', express.static(uploadsDir));

// Explicit file serving handler for CDN media (direct sendFile with CORS headers)
const serveCdnFile = (req, res, next) => {
  const relPath = (req.path || '').replace(/^\//, '');
  if (!relPath) return next();
  const absPath = path.resolve(publicDir, relPath);
  if (!absPath.startsWith(publicDir)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=2592000, no-transform');
    return res.sendFile(absPath);
  }
  next();
};
app.use('/api/public', serveCdnFile);
app.use('/public', serveCdnFile);


// ── Global rate limiter ────────────────────────────────────────────
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { error: 'Too many requests, please slow down.' },
}));

// ── Routes ─────────────────────────────────────────────────────────
app.use('/api/auth',        authRoutes);
app.use('/api/v2/waba',     wabaRoutes);
app.use('/api/v2/webhook',   webhookRoutes);
app.use('/api/webhook',      webhookRoutes);
app.use('/webhook',          webhookRoutes);
app.use('/api/v2/contacts',  contactRoutes);
app.use('/api/v2/campaigns', campaignRoutes);
app.use('/api/v2/chat',       chatRoutes);
app.use('/api/v2/analytics',  analyticsRoutes);
app.use('/api/v2/media',       mediaRoutes);

// ── Health check ───────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'CKR Meta Marketing API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ── 404 handler ────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.url}` });
});

// ── Global error handler ───────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ── Start ──────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log('\n🚀 CKR Meta Marketing API');
  console.log(`   Listening on : http://localhost:${PORT}`);
  console.log(`   Environment  : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Supabase     : ${process.env.SUPABASE_URL ? '✅ Connected' : '⚠️  NOT SET'}`);
  console.log(`   Verify Token : ${process.env.WHATSAPP_VERIFY_TOKEN || '⚠️  using default'}`);
  console.log(`   Socket.io    : ✅ Enabled\n`);
});
