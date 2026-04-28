// backend/src/routes/analytics.js
// Mount in app.js: app.use('/analytics', require('./routes/analytics'));
const router = require('express').Router();
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/analyticsController');

router.use(authenticate);

// Dashboard endpoints
router.get('/summary',        ctrl.summary);         // ?year=2024
router.get('/gigs-by-month',  ctrl.gigsByMonth);     // ?months=24
router.get('/top-venues',     ctrl.topVenues);
router.get('/revenue',        ctrl.revenue);          // ?year=2024
router.get('/distance',       ctrl.distance);
router.get('/heatmap',        ctrl.heatmap);

// Financial records CRUD
router.get('/financial',      ctrl.listFinancial);    // ?gig_id=&type=
router.post('/financial',
  [
    body('record_type').isIn(['payment','expense']),
    body('amount').isFloat({ min: 0.01 }),
    body('record_date').isDate(),
    body('category').optional().isString().trim(),
  ],
  ctrl.createFinancial
);
router.delete('/financial/:id', ctrl.deleteFinancial);

module.exports = router;
