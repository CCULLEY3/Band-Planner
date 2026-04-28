const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/venueController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.post('/',
  [body('name').notEmpty().trim()],
  ctrl.create
);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
