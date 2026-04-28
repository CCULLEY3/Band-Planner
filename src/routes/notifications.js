// backend/src/routes/notifications.js
const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/notificationController');

router.use(authenticate);

// ── History & status ──────────────────────────────────────────────────────────
router.get('/history',              ctrl.getHistory);
router.patch('/history/:id/read',   ctrl.markRead);
router.patch('/history/read-all',   ctrl.markAllRead);
router.get('/stats',                ctrl.getStats);

// ── Preferences ───────────────────────────────────────────────────────────────
router.get('/preferences',          ctrl.getPreferences);
router.put('/preferences',          ctrl.updatePreferences);

// ── Push subscriptions ────────────────────────────────────────────────────────
router.get('/push/vapid-key',       ctrl.getVapidKey);
router.post('/push/subscribe',      ctrl.subscribePush);
router.delete('/push/unsubscribe',  ctrl.unsubscribePush);

// ── Job management ────────────────────────────────────────────────────────────
router.get('/jobs',                        ctrl.getJobs);
router.post('/jobs/schedule/:gigId',       ctrl.scheduleForGig);

// ── Manual sends ──────────────────────────────────────────────────────────────
router.post('/test-email',                 ctrl.sendTest);
router.post('/send-now/:gigId',            ctrl.sendNow);

module.exports = router;
