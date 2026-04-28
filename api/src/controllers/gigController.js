const { validationResult } = require('express-validator');
const db = require('../config/db');

// GET /gigs  — supports ?band_id=, ?tour_id=, ?status=, ?from=, ?to=
const list = async (req, res, next) => {
  const { band_id, tour_id, status, from, to } = req.query;
  const conditions = [];
  const values = [];
  let i = 1;

  if (band_id)  { conditions.push(`g.band_id = $${i++}`);  values.push(band_id); }
  if (tour_id)  { conditions.push(`g.tour_id = $${i++}`);  values.push(tour_id); }
  if (status)   { conditions.push(`g.status = $${i++}`);   values.push(status); }
  if (from)     { conditions.push(`g.gig_date >= $${i++}`); values.push(from); }
  if (to)       { conditions.push(`g.gig_date <= $${i++}`); values.push(to); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const { rows } = await db.query(
      `SELECT g.*, v.name AS venue_name, v.city AS venue_city, t.name AS tour_name
       FROM gigs g
       LEFT JOIN venues v ON v.id = g.venue_id
       LEFT JOIN tours  t ON t.id = g.tour_id
       ${where}
       ORDER BY g.gig_date ASC`,
      values
    );
    res.json(rows);
  } catch (err) { next(err); }
};

// GET /gigs/:id
const getOne = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT g.*, v.name AS venue_name, v.city AS venue_city,
              v.address AS venue_address, t.name AS tour_name
       FROM gigs g
       LEFT JOIN venues v ON v.id = g.venue_id
       LEFT JOIN tours  t ON t.id = g.tour_id
       WHERE g.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Gig not found.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

// POST /gigs
const create = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const {
    band_id, venue_id, tour_id, title, description,
    gig_date, load_in_time, soundcheck_time, start_time, end_time,
    status = 'confirmed', deal_type, deal_amount, ticket_price, notes
  } = req.body;

  try {
    const { rows } = await db.query(
      `INSERT INTO gigs (band_id, venue_id, tour_id, title, description,
         gig_date, load_in_time, soundcheck_time, start_time, end_time,
         status, deal_type, deal_amount, ticket_price, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [band_id, venue_id, tour_id, title, description,
       gig_date, load_in_time, soundcheck_time, start_time, end_time,
       status, deal_type, deal_amount, ticket_price, notes, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
};

// PATCH /gigs/:id
const update = async (req, res, next) => {
  const fields = ['venue_id','tour_id','title','description','gig_date',
    'load_in_time','soundcheck_time','start_time','end_time','status',
    'deal_type','deal_amount','ticket_price','notes'];
  const updates = [];
  const values = [];
  let i = 1;

  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = $${i++}`);
      values.push(req.body[f]);
    }
  }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update.' });

  values.push(req.params.id);
  try {
    const { rows } = await db.query(
      `UPDATE gigs SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!rows[0]) return res.status(404).json({ error: 'Gig not found.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

// DELETE /gigs/:id
const remove = async (req, res, next) => {
  try {
    const { rowCount } = await db.query(`DELETE FROM gigs WHERE id = $1`, [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Gig not found.' });
    res.status(204).end();
  } catch (err) { next(err); }
};

module.exports = { list, getOne, create, update, remove };
