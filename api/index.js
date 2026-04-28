const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const morgan       = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit    = require('express-rate-limit');

const authRoutes          = require('./server/src/routes/auth');
const gigsRoutes          = require('./server/src/routes/gigs');
const venuesRoutes        = require('./server/src/routes/venues');
const toursRoutes         = require('./server/src/routes/tours');
const collaborationRoutes = require('./server/src/routes/collaboration');
const notificationsRoutes = require('./server/src/routes/notifications');
const exportRoutes        = require('./server/src/routes/export');
const analyticsRoutes     = require('./server/src/routes/analytics');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

const allowedOrigins = (process.env.CORS_ORIGINS || process.env.APP_URL || '*')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} blocked`));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

const generalLimiter = rateLimit({ windowMs: 15*60*1000, max: 100, standardHeaders: true, legacyHeaders: false });
const authLimiter    = rateLimit({ windowMs: 15*60*1000, max: 20 });
app.use(generalLimiter);

app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.use('/api/auth',          authLimiter, authRoutes);
app.use('/api/gigs',          gigsRoutes);
app.use('/api/venues',        venuesRoutes);
app.use('/api/tours',         toursRoutes);
app.use('/api',               collaborationRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/export',        exportRoutes);
app.use('/api/analytics',     analyticsRoutes);

app.use('/api/*', (req, res) => res.status(404).json({ error: `Not found: ${req.method} ${req.path}` }));

app.use((err, req, res, next) => {
  console.error(err.message);
  if (err.code === '23505') return res.status(409).json({ error: 'Already exists.' });
  if (err.code === '23503') return res.status(422).json({ error: 'Referenced record not found.' });
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
