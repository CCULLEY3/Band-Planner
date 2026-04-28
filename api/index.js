const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit    = require('express-rate-limit');

const authRoutes          = require('./src/routes/auth');
const gigsRoutes          = require('./src/routes/gigs');
const venuesRoutes        = require('./src/routes/venues');
const toursRoutes         = require('./src/routes/tours');
const collaborationRoutes = require('./src/routes/collaboration');
const notificationsRoutes = require('./src/routes/notifications');
const exportRoutes        = require('./src/routes/export');
const analyticsRoutes     = require('./src/routes/analytics');

const app = express();
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: true, credentials: true, methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(rateLimit({ windowMs: 15*60*1000, max: 100 }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth',          rateLimit({ windowMs: 15*60*1000, max: 20 }), authRoutes);
app.use('/api/gigs',          gigsRoutes);
app.use('/api/venues',        venuesRoutes);
app.use('/api/tours',         toursRoutes);
app.use('/api',               collaborationRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/export',        exportRoutes);
app.use('/api/analytics',     analyticsRoutes);

app.use('/api/*', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  console.error(err.message);
  if (err.code === '23505') return res.status(409).json({ error: 'Already exists.' });
  if (err.code === '23503') return res.status(422).json({ error: 'Referenced record not found.' });
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
