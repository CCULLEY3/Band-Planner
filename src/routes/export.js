// backend/src/routes/export.js
// Mount in app.js: app.use('/export', require('./routes/export'));
const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/exportController');

router.use(authenticate);

// ── Preview (no download) ──────────────────────────────────────────────────────
// GET /export/preview?gig_id=<uuid>           → preview single gig
// GET /export/preview?tour_id=<uuid>          → preview all gigs in a tour
// GET /export/preview                         → preview all upcoming gigs
// GET /export/preview?from=2025-05-01&to=...  → preview date-ranged gigs
router.get('/preview', ctrl.exportPreview);

// ── Single gig ─────────────────────────────────────────────────────────────────
// GET /export/gig/:gigId/ical    → downloads .ics file
// GET /export/gig/:gigId/google  → returns { url } to open in Google Calendar
router.get('/gig/:gigId/ical',   ctrl.exportGigIcal);
router.get('/gig/:gigId/google', ctrl.exportGigGoogle);

// ── All gigs ───────────────────────────────────────────────────────────────────
// GET /export/gigs/ical?from=YYYY-MM-DD&to=YYYY-MM-DD  → downloads all-gigs.ics
router.get('/gigs/ical', ctrl.exportAllGigsIcal);

// ── Tour ───────────────────────────────────────────────────────────────────────
// GET /export/tour/:tourId/ical    → downloads tour.ics
// GET /export/tour/:tourId/google  → returns { tour_name, events: [{ google_url }] }
router.get('/tour/:tourId/ical',   ctrl.exportTourIcal);
router.get('/tour/:tourId/google', ctrl.exportTourGoogle);

module.exports = router;
