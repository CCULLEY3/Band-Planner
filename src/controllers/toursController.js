// backend/src/controllers/toursController.js
const { validationResult } = require('express-validator');
const db = require('../config/db');
const { geocodeVenue, calculateLegs, sleep } = require('../services/geocodeService');

// ── Helper: recompute all legs for a tour ──────────────────────────────────────
const recomputeLegs = async (tourId) => {
  // Fetch stops ordered
  const { rows: stops } = await db.query(
    `SELECT ts.stop_order, v.lat, v.lng, v.city, v.name AS venue_name
     FROM tour_stops ts
     JOIN gigs g ON g.id = ts.gig_id
     LEFT JOIN venues v ON v.id = g.venue_id
     WHERE ts.tour_id = $1
     ORDER BY ts.stop_order`,
    [tourId]
  );

  if (stops.length < 2) return;

  const legs = calculateLegs(stops);

  // Update each stop's leg (leg = travel FROM previous stop TO this stop)
  for (let i = 1; i < stops.length; i++) {
    const leg = legs[i - 1];
    await db.query(
      `UPDATE tour_stops SET leg_miles=$1, leg_drive_hrs=$2
       WHERE tour_id=$3 AND stop_order=$4`,
      [leg.miles, leg.driveHrs, tourId, stops[i].stop_order]
    );
  }

  // Update tour totals
  const totalMiles = legs.reduce((sum, l) => sum + (l.miles || 0), 0);
  await db.query(
    `UPDATE tours SET total_miles=$1, total_shows=$2 WHERE id=$3`,
    [+totalMiles.toFixed(1), stops.length, tourId]
  );
};

// ── GET /tours  ────────────────────────────────────────────────────────────────
const list = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT t.*,
        (SELECT COUNT(*)::int FROM tour_stops ts WHERE ts.tour_id = t.id) AS stop_count,
        (SELECT MIN(g.gig_date) FROM tour_stops ts JOIN gigs g ON g.id = ts.gig_id WHERE ts.tour_id = t.id) AS first_date,
        (SELECT MAX(g.gig_date) FROM tour_stops ts JOIN gigs g ON g.id = ts.gig_id WHERE ts.tour_id = t.id) AS last_date
       FROM tours t
       WHERE t.band_id IN (SELECT band_id FROM band_members WHERE user_id = $1)
       ORDER BY t.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
};

// ── GET /tours/:id ─────────────────────────────────────────────────────────────
const getOne = async (req, res, next) => {
  try {
    const { rows: tourRows } = await db.query(
      `SELECT * FROM tours WHERE id = $1`, [req.params.id]
    );
    if (!tourRows[0]) return res.status(404).json({ error: 'Tour not found.' });
    const tour = tourRows[0];

    const { rows: stops } = await db.query(
      `SELECT * FROM tour_stop_details WHERE tour_id = $1 ORDER BY stop_order`, [tour.id]
    );

    res.json({ ...tour, stops });
  } catch (err) { next(err); }
};

// ── POST /tours ────────────────────────────────────────────────────────────────
const create = async (req, res, next) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(422).json({ errors: errs.array() });

  const { band_id, name, description, start_date, end_date, color, home_city } = req.body;
  try {
    // Verify user is in this band
    const { rows: access } = await db.query(
      `SELECT 1 FROM band_members WHERE band_id=$1 AND user_id=$2`,
      [band_id, req.user.id]
    );
    if (!access.length) return res.status(403).json({ error: 'Access denied.' });

    const { rows } = await db.query(
      `INSERT INTO tours (band_id, name, description, start_date, end_date, color, home_city)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [band_id, name, description, start_date, end_date, color || '#f0522a', home_city]
    );
    res.status(201).json({ ...rows[0], stops: [] });
  } catch (err) { next(err); }
};

// ── PATCH /tours/:id ───────────────────────────────────────────────────────────
const update = async (req, res, next) => {
  const { name, description, start_date, end_date, status, color, home_city } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE tours
       SET name        = COALESCE($1, name),
           description = COALESCE($2, description),
           start_date  = COALESCE($3, start_date),
           end_date    = COALESCE($4, end_date),
           status      = COALESCE($5, status),
           color       = COALESCE($6, color),
           home_city   = COALESCE($7, home_city)
       WHERE id = $8 RETURNING *`,
      [name, description, start_date, end_date, status, color, home_city, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Tour not found.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

// ── DELETE /tours/:id ──────────────────────────────────────────────────────────
const remove = async (req, res, next) => {
  try {
    // Nullify tour_id on gigs first
    await db.query(`UPDATE gigs SET tour_id = NULL WHERE tour_id = $1`, [req.params.id]);
    const { rowCount } = await db.query(`DELETE FROM tours WHERE id = $1`, [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Tour not found.' });
    res.status(204).end();
  } catch (err) { next(err); }
};

// ── GET /tours/:id/stops ───────────────────────────────────────────────────────
const listStops = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM tour_stop_details WHERE tour_id = $1 ORDER BY stop_order`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
};

// ── POST /tours/:id/stops ──────────────────────────────────────────────────────
const addStop = async (req, res, next) => {
  const { gig_id, stop_order, leg_mode, leg_notes } = req.body;
  if (!gig_id) return res.status(422).json({ error: 'gig_id required.' });

  try {
    // Determine order if not provided
    let order = stop_order;
    if (order == null) {
      const { rows } = await db.query(
        `SELECT COALESCE(MAX(stop_order), 0) + 1 AS next_order
         FROM tour_stops WHERE tour_id = $1`, [req.params.id]
      );
      order = rows[0].next_order;
    }

    // Shift existing stops if inserting in the middle
    if (stop_order != null) {
      await db.query(
        `UPDATE tour_stops SET stop_order = stop_order + 1
         WHERE tour_id = $1 AND stop_order >= $2`,
        [req.params.id, stop_order]
      );
    }

    await db.query(
      `INSERT INTO tour_stops (tour_id, gig_id, stop_order, leg_mode, leg_notes)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (tour_id, gig_id) DO UPDATE
         SET stop_order=$3, leg_mode=$4, leg_notes=$5`,
      [req.params.id, gig_id, order, leg_mode || 'drive', leg_notes]
    );

    // Also set gig.tour_id for backward compat
    await db.query(`UPDATE gigs SET tour_id=$1 WHERE id=$2`, [req.params.id, gig_id]);

    // Geocode venue if not already done
    const { rows: gigRows } = await db.query(
      `SELECT v.id, v.name, v.city, v.state, v.country, v.address, v.lat, v.lng
       FROM gigs g LEFT JOIN venues v ON v.id = g.venue_id WHERE g.id = $1`,
      [gig_id]
    );
    if (gigRows[0]?.id && !gigRows[0].lat) {
      // Fire-and-forget geocoding (don't block the response)
      geocodeVenue(gigRows[0]).then(geo => {
        if (geo) {
          db.query(
            `UPDATE venues SET lat=$1, lng=$2, geocoded_at=NOW() WHERE id=$3`,
            [geo.lat, geo.lng, gigRows[0].id]
          ).catch(console.error);
        }
      }).catch(console.error);
    }

    await recomputeLegs(req.params.id);

    const { rows: stops } = await db.query(
      `SELECT * FROM tour_stop_details WHERE tour_id=$1 ORDER BY stop_order`, [req.params.id]
    );
    res.status(201).json(stops);
  } catch (err) { next(err); }
};

// ── DELETE /tours/:id/stops/:gigId ────────────────────────────────────────────
const removeStop = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `DELETE FROM tour_stops WHERE tour_id=$1 AND gig_id=$2 RETURNING stop_order`,
      [req.params.id, req.params.gigId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Stop not found.' });

    // Renumber stops
    await db.query(
      `UPDATE tour_stops SET stop_order = stop_order - 1
       WHERE tour_id=$1 AND stop_order > $2`,
      [req.params.id, rows[0].stop_order]
    );

    // Remove tour association from gig
    await db.query(`UPDATE gigs SET tour_id=NULL WHERE id=$1`, [req.params.gigId]);

    await recomputeLegs(req.params.id);

    const { rows: stops } = await db.query(
      `SELECT * FROM tour_stop_details WHERE tour_id=$1 ORDER BY stop_order`, [req.params.id]
    );
    res.json(stops);
  } catch (err) { next(err); }
};

// ── PUT /tours/:id/stops/reorder ──────────────────────────────────────────────
const reorderStops = async (req, res, next) => {
  // Body: { order: ['gig_id_1', 'gig_id_2', ...] }
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(422).json({ error: 'order array required.' });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < order.length; i++) {
      await client.query(
        `UPDATE tour_stops SET stop_order=$1 WHERE tour_id=$2 AND gig_id=$3`,
        [i + 1, req.params.id, order[i]]
      );
    }
    await client.query('COMMIT');
    await recomputeLegs(req.params.id);

    const { rows: stops } = await db.query(
      `SELECT * FROM tour_stop_details WHERE tour_id=$1 ORDER BY stop_order`, [req.params.id]
    );
    res.json(stops);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// ── GET /tours/:id/map-data ────────────────────────────────────────────────────
// Returns everything the map needs in one shot
const getMapData = async (req, res, next) => {
  try {
    const { rows: tourRows } = await db.query(
      `SELECT * FROM tours WHERE id=$1`, [req.params.id]
    );
    if (!tourRows[0]) return res.status(404).json({ error: 'Tour not found.' });

    const { rows: stops } = await db.query(
      `SELECT * FROM tour_stop_details WHERE tour_id=$1 ORDER BY stop_order`, [req.params.id]
    );

    // Attach band members' RSVPs per stop (if collab module installed)
    const totalMiles = stops.reduce((s, st) => s + (st.leg_miles || 0), 0);
    const totalDriveHrs = stops.reduce((s, st) => s + (st.leg_drive_hrs || 0), 0);

    res.json({
      tour: tourRows[0],
      stops,
      stats: {
        total_miles:     +totalMiles.toFixed(1),
        total_drive_hrs: +totalDriveHrs.toFixed(1),
        stop_count:      stops.length,
        gig_count:       stops.length,
      },
    });
  } catch (err) { next(err); }
};

// ── POST /tours/:id/geocode-all ───────────────────────────────────────────────
// Geocode all venues on this tour that are missing coordinates
const geocodeAll = async (req, res, next) => {
  try {
    const { rows: venues } = await db.query(
      `SELECT DISTINCT v.id, v.name, v.city, v.state, v.country, v.address
       FROM tour_stops ts
       JOIN gigs g ON g.id = ts.gig_id
       JOIN venues v ON v.id = g.venue_id
       WHERE ts.tour_id=$1 AND (v.lat IS NULL OR v.lng IS NULL)`,
      [req.params.id]
    );

    if (!venues.length) {
      return res.json({ geocoded: 0, message: 'All venues already geocoded.' });
    }

    // Start async geocoding — return immediately
    res.json({ geocoding: venues.length, message: 'Geocoding started in background.' });

    // Background work
    (async () => {
      for (const v of venues) {
        const geo = await geocodeVenue(v);
        if (geo) {
          await db.query(
            `UPDATE venues SET lat=$1, lng=$2, state=$3, geocoded_at=NOW() WHERE id=$4`,
            [geo.lat, geo.lng, geo.state, v.id]
          );
          console.log(`📍  Geocoded: ${v.name}, ${v.city} → ${geo.lat}, ${geo.lng}`);
        } else {
          console.warn(`⚠️  Could not geocode: ${v.name}, ${v.city}`);
        }
        await sleep(1100); // Nominatim rate limit
      }
      await recomputeLegs(req.params.id);
      console.log(`✅  Tour ${req.params.id} geocoding complete.`);
    })().catch(console.error);
  } catch (err) { next(err); }
};

module.exports = {
  list, getOne, create, update, remove,
  listStops, addStop, removeStop, reorderStops,
  getMapData, geocodeAll,
};
