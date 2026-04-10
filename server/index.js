// ============================================================
//  AeroTrack — Main Server
//  Entry point for the Express application
// ============================================================

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const compression = require('compression');
const rateLimit  = require('express-rate-limit');
const path       = require('path');

const flightRoutes = require('./routes/flights');
const { logRequest } = require('./middleware/logger');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Security ────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdn.jsdelivr.net"],
      styleSrc:   ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc:    ["'self'", "fonts.gstatic.com"],
      connectSrc: ["'self'", "https://api.anthropic.com"],
      imgSrc:     ["'self'", "data:", "https:"],
    },
  },
}));

// ── CORS ────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS === '*'
  ? true
  : (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim());

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET'],
  allowedHeaders: ['Content-Type'],
}));

// ── Rate Limiting ───────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// ── General Middleware ──────────────────────────────────────
app.use(compression());
app.use(express.json());
app.use(morgan('dev'));
app.use(logRequest);

// ── Static Frontend ─────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: '1h',
  etag: true,
}));

// ── API Routes ──────────────────────────────────────────────
app.use('/api/flights', flightRoutes);

// ── Health Check ────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const hasCredentials = !!(process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET);
  res.json({
    status:      'ok',
    version:     '1.0.0',
    timestamp:   new Date().toISOString(),
    opensky_mode: hasCredentials ? 'authenticated' : 'anonymous',
    cache_ttl:   parseInt(process.env.CACHE_TTL) || 30,
  });
});

// ── SPA Fallback ────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── Global Error Handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({
    error:   err.message || 'Internal server error',
    status:  err.status || 500,
  });
});

// ── Start ───────────────────────────────────────────────────
app.listen(PORT, () => {
  const hasCredentials = !!(process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET);
  console.log(`\n✈  AeroTrack server running`);
  console.log(`   URL:         http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   OpenSky:     ${hasCredentials ? '🔐 Authenticated (4000 req/day)' : '👤 Anonymous (400 req/day)'}`);
  console.log(`   Cache TTL:   ${process.env.CACHE_TTL || 30}s\n`);
});

module.exports = app;
