// backend/src/middleware/auth.js
//
// USAGE EXAMPLES:
//   router.use(authenticate)                               → any logged-in user
//   router.post('/', requireBandAccess, requireRole('band_leader'), ...)
//   router.put('/rsvp', requireBandAccess, ...)            → any member
//   router.patch('/:id', requireBandAccess, requireRole('band_leader','manager'), ...)

const jwt = require('jsonwebtoken');
const db  = require('../config/db');

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me';

// ── authenticate ──────────────────────────────────────────────────────────────
// Reads Bearer token from Authorization header.
// On success: sets req.user = { id, name, email, avatarColor, bands }
const authenticate = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Authentication required.' });

  try {
    const decoded = jwt.verify(header.slice(7), ACCESS_SECRET);
    req.user = {
      id:          decoded.sub,
      name:        decoded.name,
      email:       decoded.email,
      avatarColor: decoded.avatarColor,
      bands:       decoded.bands || [],
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ error: 'Token expired.', code: 'TOKEN_EXPIRED' });
    return res.status(401).json({ error: 'Invalid token.' });
  }
};

// ── requireBandAccess ─────────────────────────────────────────────────────────
// Verifies the authenticated user belongs to the band in the request.
// Resolves band_id from: req.params.bandId → req.body.band_id → req.query.band_id
// Sets: req.bandRole, req.bandId
const requireBandAccess = async (req, res, next) => {
  const bandId = req.params.bandId || req.body.band_id || req.query.band_id;
  if (!bandId) return res.status(400).json({ error: 'band_id is required.' });

  // Fast path: JWT already carries band memberships
  const fromJwt = req.user.bands?.find(b => b.bandId === bandId);
  if (fromJwt) {
    req.bandRole = fromJwt.role;
    req.bandId   = bandId;
    return next();
  }

  // Fallback DB check (user joined band after token was issued)
  try {
    const { rows: [m] } = await db.query(
      `SELECT role FROM band_members WHERE band_id=$1 AND user_id=$2`,
      [bandId, req.user.id]
    );
    if (!m) return res.status(403).json({ error: 'You are not a member of this band.' });
    req.bandRole = m.role;
    req.bandId   = bandId;
    next();
  } catch (err) { next(err); }
};

// ── requireRole ───────────────────────────────────────────────────────────────
// Factory: requireRole('band_leader') or requireRole('band_leader', 'manager')
// Must be used AFTER requireBandAccess (which sets req.bandRole).
const requireRole = (...roles) => (req, res, next) => {
  const role = req.bandRole;
  if (!role || !roles.includes(role)) {
    return res.status(403).json({
      error:    `Requires role: ${roles.join(' or ')}. Your role: ${role || 'none'}.`,
      required: roles,
      actual:   role || null,
    });
  }
  next();
};

// ── requireSelf ───────────────────────────────────────────────────────────────
// Allows modification only if req.user.id === req.params.userId
// OR the user is a band_leader in the current band context.
const requireSelf = (req, res, next) => {
  const targetId = req.params.userId || req.params.id;
  if (req.user.id === targetId)          return next();
  if (req.bandRole === 'band_leader')    return next();
  return res.status(403).json({ error: 'You can only modify your own data.' });
};

// ── optionalAuth ──────────────────────────────────────────────────────────────
// Like authenticate but does NOT reject unauthenticated requests.
// Useful for public routes that behave differently when logged in.
const optionalAuth = (req, res, next) => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(header.slice(7), ACCESS_SECRET);
      req.user = { id: decoded.sub, name: decoded.name, email: decoded.email, bands: decoded.bands || [] };
    } catch { /* not logged in, continue */ }
  }
  next();
};

module.exports = { authenticate, requireBandAccess, requireRole, requireSelf, optionalAuth };
