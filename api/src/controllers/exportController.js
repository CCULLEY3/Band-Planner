// backend/src/controllers/exportController.js
const db  = require('../config/db');
const { buildIcs, buildGoogleCalUrl } = require('../services/icsService');

// ─── Shared SQL fragment ──────────────────────────────────────────────────────

const GIG_COLS = `
  g.id, g.title, g.gig_date, g.start_time, g.end_time,
  g.load_in_time, g.soundcheck_time, g.notes, g.status,
  g.deal_type, g.deal_amount,
  v.name    AS venue_name,
  v.city    AS venue_city,
  v.state   AS venue_state,
  v.address AS venue_address,
  v.country AS venue_country,
  t.name    AS tour_name
`;

// Fetch a single gig owned by the authenticated user's band
const fetchGig = async (gigId, userId) => {
  const { rows } = await db.query(
    `SELECT ${GIG_COLS}
     FROM gigs g
     LEFT JOIN venues v ON v.id = g.venue_id
     LEFT JOIN tours  t ON t.id = g.tour_id
     JOIN band_members bm ON bm.band_id = g.band_id AND bm.user_id = $2
     WHERE g.id = $1`,
    [gigId, userId]
  );
  return rows[0] ?? null;
};

// Fetch multiple gigs with optional filters
const fetchGigs = async (userId, { tourId, fromDate, toDate, status } = {}) => {
  const conds = ['bm.user_id = $1'];
  const vals  = [userId];
  let   i = 2;

  if (tourId)   { conds.push(`g.tour_id  = $${i++}`); vals.push(tourId); }
  if (fromDate) { conds.push(`g.gig_date >= $${i++}`); vals.push(fromDate); }
  if (toDate)   { conds.push(`g.gig_date <= $${i++}`); vals.push(toDate); }
  if (status)   { conds.push(`g.status    = $${i++}`); vals.push(status); }
  else          { conds.push(`g.status != 'cancelled'`); }

  const { rows } = await db.query(
    `SELECT ${GIG_COLS}
     FROM gigs g
     LEFT JOIN venues v ON v.id = g.venue_id
     LEFT JOIN tours  t ON t.id = g.tour_id
     JOIN band_members bm ON bm.band_id = g.band_id
     WHERE ${conds.join(' AND ')}
     ORDER BY g.gig_date ASC, g.start_time ASC NULLS LAST`,
    vals
  );
  return rows;
};

// Helper: send .ics response
const sendIcs = (res, icsContent, filename) => {
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(icsContent);
};

// Sanitise a string for use in a filename
const toFilename = (s) => (s ?? 'export').replace(/[^a-z0-9]/gi, '-').toLowerCase().replace(/-+/g, '-');

// ── GET /export/gig/:gigId/ical ───────────────────────────────────────────────
const exportGigIcal = async (req, res, next) => {
  try {
    const gig = await fetchGig(req.params.gigId, req.user.id);
    if (!gig) return res.status(404).json({ error: 'Gig not found.' });

    sendIcs(res, buildIcs([gig], gig.title), `${toFilename(gig.title)}.ics`);
  } catch (err) { next(err); }
};

// ── GET /export/gig/:gigId/google ─────────────────────────────────────────────
const exportGigGoogle = async (req, res, next) => {
  try {
    const gig = await fetchGig(req.params.gigId, req.user.id);
    if (!gig) return res.status(404).json({ error: 'Gig not found.' });
    res.json({ url: buildGoogleCalUrl(gig) });
  } catch (err) { next(err); }
};

// ── GET /export/gigs/ical ─────────────────────────────────────────────────────
// All upcoming gigs for the authenticated user's band(s)
const exportAllGigsIcal = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const gigs = await fetchGigs(req.user.id, { fromDate: from, toDate: to });
    if (!gigs.length) return res.status(404).json({ error: 'No gigs found.' });

    sendIcs(res, buildIcs(gigs, 'Band Planner — All Gigs'), 'band-planner-all-gigs.ics');
  } catch (err) { next(err); }
};

// ── GET /export/tour/:tourId/ical ─────────────────────────────────────────────
const exportTourIcal = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT t.name FROM tours t
       JOIN band_members bm ON bm.band_id = t.band_id AND bm.user_id = $1
       WHERE t.id = $2`,
      [req.user.id, req.params.tourId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Tour not found.' });

    const gigs = await fetchGigs(req.user.id, { tourId: req.params.tourId });
    if (!gigs.length) return res.status(404).json({ error: 'No gigs on this tour.' });

    const name = rows[0].name;
    sendIcs(res, buildIcs(gigs, `Band Planner — ${name}`), `${toFilename(name)}-tour.ics`);
  } catch (err) { next(err); }
};

// ── GET /export/tour/:tourId/google ───────────────────────────────────────────
// Google Calendar only supports one event per URL, so we return an array
const exportTourGoogle = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT t.name FROM tours t
       JOIN band_members bm ON bm.band_id = t.band_id AND bm.user_id = $1
       WHERE t.id = $2`,
      [req.user.id, req.params.tourId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Tour not found.' });

    const gigs = await fetchGigs(req.user.id, { tourId: req.params.tourId });
    res.json({
      tour_name: rows[0].name,
      count: gigs.length,
      events: gigs.map(g => ({
        gig_id:    g.id,
        title:     g.title,
        gig_date:  g.gig_date,
        venue:     [g.venue_name, g.venue_city].filter(Boolean).join(', '),
        google_url: buildGoogleCalUrl(g),
      })),
    });
  } catch (err) { next(err); }
};

// ── GET /export/preview ───────────────────────────────────────────────────────
// Returns a lightweight list of what would be exported (no file download).
// Query params: gig_id | tour_id | (nothing = all gigs)
const exportPreview = async (req, res, next) => {
  try {
    const { gig_id, tour_id, from, to } = req.query;
    let gigs = [];

    if (gig_id) {
      const g = await fetchGig(gig_id, req.user.id);
      if (g) gigs = [g];
    } else if (tour_id) {
      gigs = await fetchGigs(req.user.id, { tourId: tour_id });
    } else {
      gigs = await fetchGigs(req.user.id, { fromDate: from, toDate: to });
    }

    res.json({
      count: gigs.length,
      events: gigs.map(g => ({
        id:          g.id,
        title:       g.title,
        gig_date:    g.gig_date,
        start_time:  g.start_time,
        venue_name:  g.venue_name,
        venue_city:  g.venue_city,
        venue_state: g.venue_state,
        tour_name:   g.tour_name,
        has_notes:   !!g.notes,
        google_url:  buildGoogleCalUrl(g),
      })),
    });
  } catch (err) { next(err); }
};

module.exports = {
  exportGigIcal,
  exportGigGoogle,
  exportAllGigsIcal,
  exportTourIcal,
  exportTourGoogle,
  exportPreview,
};
