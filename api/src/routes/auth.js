// backend/src/routes/auth.js
// Mount in app.js:
//   const cookieParser = require('cookie-parser');
//   app.use(cookieParser());
//   app.use('/auth', require('./routes/auth'));

const router = require('express').Router();
const { body } = require('express-validator');
const { authenticate, requireBandAccess, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/authController');

// ── Public ─────────────────────────────────────────────────────────────────────
router.post('/register',
  [
    body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Name must be 2–80 chars.'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required.'),
    body('password').isLength({ min: 8 }).withMessage('Password must be ≥ 8 characters.'),
    body('bandName').optional().trim().isLength({ min: 2, max: 80 }),
    body('joinCode').optional().trim(),
  ],
  ctrl.register
);

router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  ctrl.login
);

// Refresh uses httpOnly cookie set on /auth/refresh path
router.post('/refresh', ctrl.refresh);
router.post('/logout',  ctrl.logout);

// ── Protected ──────────────────────────────────────────────────────────────────
router.get('/me',   authenticate, ctrl.me);
router.patch('/me', authenticate, ctrl.updateMe);

// ── Band member management ────────────────────────────────────────────────────
// Any member can list; only leaders can invite/change/remove
router.get('/bands/:bandId/members',
  authenticate, requireBandAccess, ctrl.listMembers
);

router.post('/bands/:bandId/invite',
  authenticate, requireBandAccess, requireRole('band_leader', 'manager'),
  [
    body('email').isEmail().normalizeEmail(),
    body('role').optional().isIn(['band_member','manager','guest']),
  ],
  ctrl.inviteMember
);

router.patch('/bands/:bandId/members/:userId/role',
  authenticate, requireBandAccess, requireRole('band_leader'),
  [body('role').isIn(['band_leader','band_member','manager','guest'])],
  ctrl.updateMemberRole
);

router.delete('/bands/:bandId/members/:userId',
  authenticate, requireBandAccess, requireRole('band_leader'),
  ctrl.removeMember
);

module.exports = router;
