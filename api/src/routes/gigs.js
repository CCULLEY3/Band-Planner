const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/gigController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);

router.post('/',
  [
    body('band_id').isUUID(),
    body('title').notEmpty().trim(),
    body('gig_date').isDate(),
    body('status').optional().isIn(['inquiry','confirmed','cancelled','completed']),
    body('deal_type').optional().isIn(['flat','percentage','guarantee_vs_door']),
    body('deal_amount').optional().isNumeric(),
    body('ticket_price').optional().isNumeric(),
  ],
  ctrl.create
);

router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
