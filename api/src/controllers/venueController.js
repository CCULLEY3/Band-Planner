const { validationResult } = require('express-validator');
const db = require('../config/db');

// GET /venues
const list = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM venues ORDER BY name ASC`
    );
    res.json(rows);
  } catch (err) { next(err); }
};

// GET /venues/:id
const getOne = async (req, res, next) => {
  try {
    const { rows } = await db.query(`SELECT * FROM venues WHERE id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Venue not found.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

// POST /venues
const create = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const { name, address, city, state, country, zip, capacity,
          contact_name, contact_email, contact_phone, notes } = req.body;
  try {
    const { rows } = await db.query(
      `INSERT INTO venues (name, address, city, state, country, zip, capacity,
         contact_name, contact_email, contact_phone, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [name, address, city, state, country, zip, capacity,
       contact_name, contact_email, contact_phone, notes, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
};

// PATCH /venues/:id
const update = async (req, res, next) => {
  const fields = ['name','address','city','state','country','zip','capacity',
                  'contact_name','contact_email','contact_phone','notes'];
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
      `UPDATE venues SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!rows[0]) return res.status(404).json({ error: 'Venue not found.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

// DELETE /venues/:id
const remove = async (req, res, next) => {
  try {
    const { rowCount } = await db.query(`DELETE FROM venues WHERE id = $1`, [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Venue not found.' });
    res.status(204).end();
  } catch (err) { next(err); }
};

module.exports = { list, getOne, create, update, remove };
