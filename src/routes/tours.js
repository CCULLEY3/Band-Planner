// backend/src/routes/tours.js
// Replace (or merge with) your existing src/routes/tours.js
const router  = require('express').Router();
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const ctrl    = require('../controllers/toursController');

router.use(authenticate);

// ── Tours CRUD ─────────────────────────────────────────────────────────────────
router.get('/',    ctrl.list);
router.get('/:id', ctrl.getOne);

router.post('/',
  [
    body('band_id').isUUID(),
    body('name').notEmpty().trim(),
    body('start_date').optional().isDate(),
    body('end_date').optional().isDate(),
    body('color').optional().matches(/^#[0-9a-fA-F]{6}$/),
  ],
  ctrl.create
);

router.patch('/:id',
  [
    body('name').optional().notEmpty().trim(),
    body('status').optional().isIn(['planning','active','completed','cancelled']),
    body('color').optional().matches(/^#[0-9a-fA-F]{6}$/),
  ],
  ctrl.update
);

router.delete('/:id', ctrl.remove);

// ── Tour stops ─────────────────────────────────────────────────────────────────
router.get('/:id/stops',              ctrl.listStops);
router.post('/:id/stops',             ctrl.addStop);
router.delete('/:id/stops/:gigId',    ctrl.removeStop);
router.put('/:id/stops/reorder',      ctrl.reorderStops);

// ── Map data ───────────────────────────────────────────────────────────────────
router.get('/:id/map-data',           ctrl.getMapData);
router.post('/:id/geocode-all',       ctrl.geocodeAll);

module.exports = router;
