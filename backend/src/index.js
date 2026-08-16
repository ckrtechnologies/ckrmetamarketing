require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const morgan     = require('morgan');
const path       = require('path');
const fs         = require('fs');
const rateLimit  = require('express-rate-limit');

const authRoutes    = require('./routes/auth');
const wabaRoutes    = require('./routes/waba');
const webhookRoutes  = require('./routes/webhook');
const contactRoutes  = require('./routes/contacts');
const campaignRoutes = require('./routes/campaigns');
const chatRoutes      = require('./routes/chat');
const analyticsRoutes = require('./routes/analytics');

const app  = express();
const PORT = process.env.PORT || 5001;

// ── Ensure uploads dir exists ──────────────────────────────────────
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ── Morgan HTTP logging ────────────────────────────────────────────
morgan.token('org-id', (req) => req.orgId ? `[Org: ${req.orgId}]` : '[No Org]');
app.use(morgan(':method :url :status :response-time ms - :res[content-length] :org-id'));

// ── CORS ───────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',');
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body parsing ───────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Global rate limiter ────────────────────────────────────────────
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
}));

// ── Routes ─────────────────────────────────────────────────────────
app.use('/api/auth',        authRoutes);
app.use('/api/v2/waba',     wabaRoutes);
app.use('/api/v2/webhook',   webhookRoutes);
app.use('/api/v2/contacts',  contactRoutes);
app.use('/api/v2/campaigns', campaignRoutes);
app.use('/api/v2/chat',       chatRoutes);
app.use('/api/v2/analytics',  analyticsRoutes);

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
app.listen(PORT, () => {
  console.log('\n🚀 CKR Meta Marketing API');
  console.log(`   Listening on : http://localhost:${PORT}`);
  console.log(`   Environment  : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Supabase     : ${process.env.SUPABASE_URL ? '✅ Connected' : '⚠️  NOT SET'}`);
  console.log(`   Meta App     : ${process.env.META_APP_ID ? '✅ SET' : '⚠️  NOT SET'}`);
  console.log(`   Verify Token : ${process.env.WHATSAPP_VERIFY_TOKEN || '⚠️  using default'}\n`);
});
