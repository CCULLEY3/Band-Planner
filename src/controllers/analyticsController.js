// backend/src/controllers/analyticsController.js
const db = require('../config/db');
const { body, validationResult } = require('express-validator');

const getBandId = async (userId) => {
  const { rows } = await db.query(
    `SELECT band_id FROM band_members WHERE user_id=$1 ORDER BY created_at LIMIT 1`, [userId]
  );
  return rows[0]?.band_id ?? null;
};

// ── GET /analytics/summary ────────────────────────────────────────────────────
// KPIs: total gigs, revenue, expenses, net, venues, miles
const summary = async (req, res, next) => {
  try {
    const bandId = await getBandId(req.user.id);
    if (!bandId) return res.status(404).json({ error: 'No band.' });

    const yr = req.query.year ? `AND EXTRACT(YEAR FROM gig_date)=${parseInt(req.query.year)}` : '';

    const { rows: [g] } = await db.query(
      `SELECT
         COUNT(*)                                           AS total_gigs,
         COUNT(*) FILTER (WHERE status='confirmed')        AS confirmed_gigs,
         COUNT(*) FILTER (WHERE status='inquiry')          AS inquiry_gigs,
         COUNT(DISTINCT venue_id)                          AS unique_venues,
         COUNT(DISTINCT tour_id) FILTER (WHERE tour_id IS NOT NULL) AS total_tours,
         COALESCE(SUM(actual_payment),0)                   AS total_revenue,
         COALESCE(SUM(actual_expenses),0)                  AS total_expenses,
         COALESCE(SUM(actual_payment)-SUM(actual_expenses),0) AS net_income,
         COALESCE(AVG(actual_payment) FILTER (WHERE actual_payment>0),0) AS avg_payment
       FROM gigs WHERE band_id=$1 AND status!='cancelled' ${yr}`, [bandId]
    );

    const { rows: [d] } = await db.query(
      `SELECT COALESCE(SUM(total_miles),0) AS total_miles FROM tours WHERE band_id=$1`, [bandId]
    );

    const curYear = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();
    const { rows: [yoy] } = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM gig_date)=$2)   AS this_year,
         COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM gig_date)=$2-1) AS last_year
       FROM gigs WHERE band_id=$1 AND status!='cancelled'`, [bandId, curYear]
    );

    res.json({
      ...g, total_miles: d.total_miles,
      this_year_gigs: +yoy.this_year,
      last_year_gigs: +yoy.last_year,
      yoy_change: yoy.last_year > 0
        ? +(((yoy.this_year - yoy.last_year) / yoy.last_year) * 100).toFixed(1)
        : null,
    });
  } catch (e) { next(e); }
};

// ── GET /analytics/gigs-by-month ─────────────────────────────────────────────
const gigsByMonth = async (req, res, next) => {
  try {
    const bandId = await getBandId(req.user.id);
    if (!bandId) return res.status(404).json({ error: 'No band.' });
    const months = Math.min(Math.max(parseInt(req.query.months || 24), 6), 60);
    const { rows } = await db.query(
      `SELECT
         TO_CHAR(gig_date,'YYYY-MM')          AS month,
         TO_CHAR(gig_date,'Mon ''YY')         AS label,
         COUNT(*)::int                         AS gig_count,
         COUNT(*) FILTER(WHERE status='confirmed')::int AS confirmed,
         COALESCE(SUM(actual_payment),0)::float  AS revenue,
         COALESCE(SUM(actual_expenses),0)::float AS expenses,
         COALESCE(SUM(actual_payment)-SUM(actual_expenses),0)::float AS net
       FROM gigs
       WHERE band_id=$1 AND status!='cancelled'
         AND gig_date >= CURRENT_DATE - ($2 || ' months')::INTERVAL
       GROUP BY 1,2 ORDER BY 1`, [bandId, months]
    );
    res.json(rows);
  } catch (e) { next(e); }
};

// ── GET /analytics/top-venues ─────────────────────────────────────────────────
const topVenues = async (req, res, next) => {
  try {
    const bandId = await getBandId(req.user.id);
    if (!bandId) return res.status(404).json({ error: 'No band.' });
    const { rows } = await db.query(
      `SELECT
         v.id, v.name AS venue_name, v.city, v.state,
         COUNT(g.id)::int                        AS gig_count,
         COALESCE(SUM(g.actual_payment),0)::float AS total_revenue,
         COALESCE(AVG(g.actual_payment),0)::float AS avg_revenue,
         MAX(g.gig_date) AS last_played,
         MIN(g.gig_date) AS first_played
       FROM gigs g JOIN venues v ON v.id=g.venue_id
       WHERE g.band_id=$1 AND g.status!='cancelled'
       GROUP BY v.id ORDER BY gig_count DESC, total_revenue DESC LIMIT 10`, [bandId]
    );
    res.json(rows);
  } catch (e) { next(e); }
};

// ── GET /analytics/revenue ────────────────────────────────────────────────────
const revenue = async (req, res, next) => {
  try {
    const bandId = await getBandId(req.user.id);
    if (!bandId) return res.status(404).json({ error: 'No band.' });
    const yr = req.query.year ? `AND EXTRACT(YEAR FROM record_date)=${parseInt(req.query.year)}` : '';

    const { rows: monthly } = await db.query(
      `SELECT
         TO_CHAR(record_date,'YYYY-MM')   AS month,
         TO_CHAR(record_date,'Mon ''YY')  AS label,
         SUM(CASE WHEN record_type='payment' THEN amount ELSE 0 END)::float AS income,
         SUM(CASE WHEN record_type='expense' THEN amount ELSE 0 END)::float AS expenses
       FROM financial_records
       WHERE band_id=$1 ${yr}
       GROUP BY 1,2 ORDER BY 1`, [bandId]
    );

    const { rows: byCategory } = await db.query(
      `SELECT category, record_type,
         COUNT(*)::int AS cnt, SUM(amount)::float AS total
       FROM financial_records WHERE band_id=$1 ${yr}
       GROUP BY category, record_type ORDER BY total DESC`, [bandId]
    );

    const { rows: topGigs } = await db.query(
      `SELECT g.id, g.title, g.gig_date, g.actual_payment::float,
         v.name AS venue_name, v.city
       FROM gigs g LEFT JOIN venues v ON v.id=g.venue_id
       WHERE g.band_id=$1 AND g.actual_payment IS NOT NULL
         ${req.query.year ? `AND EXTRACT(YEAR FROM g.gig_date)=${parseInt(req.query.year)}` : ''}
       ORDER BY g.actual_payment DESC LIMIT 5`, [bandId]
    );

    res.json({ monthly, byCategory, topGigs });
  } catch (e) { next(e); }
};

// ── GET /analytics/distance ───────────────────────────────────────────────────
const distance = async (req, res, next) => {
  try {
    const bandId = await getBandId(req.user.id);
    if (!bandId) return res.status(404).json({ error: 'No band.' });
    const { rows } = await db.query(
      `SELECT id, name, color, total_miles::float, total_shows, start_date, end_date, status,
         COALESCE(total_miles/NULLIF(total_shows,0),0)::float AS miles_per_show
       FROM tours WHERE band_id=$1 AND total_miles>0
       ORDER BY start_date DESC NULLS LAST`, [bandId]
    );
    const total = rows.reduce((s, t) => s + (t.total_miles || 0), 0);
    res.json({ tours: rows, total_miles: +total.toFixed(1) });
  } catch (e) { next(e); }
};

// ── GET /analytics/heatmap ────────────────────────────────────────────────────
// Gig counts per day for the last 52 weeks
const heatmap = async (req, res, next) => {
  try {
    const bandId = await getBandId(req.user.id);
    if (!bandId) return res.status(404).json({ error: 'No band.' });
    const { rows } = await db.query(
      `SELECT gig_date::text AS date, COUNT(*)::int AS count
       FROM gigs WHERE band_id=$1 AND status!='cancelled'
         AND gig_date >= CURRENT_DATE - INTERVAL '364 days'
       GROUP BY gig_date ORDER BY gig_date`, [bandId]
    );
    res.json(rows);
  } catch (e) { next(e); }
};

// ── GET /analytics/financial ──────────────────────────────────────────────────
const listFinancial = async (req, res, next) => {
  try {
    const bandId = await getBandId(req.user.id);
    if (!bandId) return res.status(404).json({ error: 'No band.' });
    const conds = ['fr.band_id=$1']; const vals = [bandId]; let i = 2;
    if (req.query.gig_id)  { conds.push(`fr.gig_id=$${i++}`);      vals.push(req.query.gig_id); }
    if (req.query.type)    { conds.push(`fr.record_type=$${i++}`);  vals.push(req.query.type); }
    const { rows } = await db.query(
      `SELECT fr.*, g.title AS gig_title FROM financial_records fr
       LEFT JOIN gigs g ON g.id=fr.gig_id
       WHERE ${conds.join(' AND ')} ORDER BY fr.record_date DESC LIMIT 100`, vals
    );
    res.json(rows);
  } catch (e) { next(e); }
};

// ── POST /analytics/financial ─────────────────────────────────────────────────
const createFinancial = async (req, res, next) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(422).json({ errors: errs.array() });
  try {
    const bandId = await getBandId(req.user.id);
    const { gig_id, tour_id, record_type, category, amount, description, record_date } = req.body;
    const { rows } = await db.query(
      `INSERT INTO financial_records (band_id,gig_id,tour_id,record_type,category,amount,description,record_date,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [bandId, gig_id||null, tour_id||null, record_type, category||'misc', amount, description, record_date, req.user.id]
    );
    // Recalculate gig actuals
    if (gig_id) {
      const col = record_type === 'payment' ? 'actual_payment' : 'actual_expenses';
      await db.query(
        `UPDATE gigs SET ${col}=(SELECT COALESCE(SUM(amount),0) FROM financial_records WHERE gig_id=$1 AND record_type=$2) WHERE id=$1`,
        [gig_id, record_type]
      );
    }
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
};

// ── DELETE /analytics/financial/:id ──────────────────────────────────────────
const deleteFinancial = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `DELETE FROM financial_records WHERE id=$1 AND created_by=$2 RETURNING gig_id, record_type`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found.' });
    if (rows[0].gig_id) {
      const col = rows[0].record_type === 'payment' ? 'actual_payment' : 'actual_expenses';
      await db.query(
        `UPDATE gigs SET ${col}=(SELECT COALESCE(SUM(amount),0) FROM financial_records WHERE gig_id=$1 AND record_type=$2) WHERE id=$1`,
        [rows[0].gig_id, rows[0].record_type]
      );
    }
    res.status(204).end();
  } catch (e) { next(e); }
};

module.exports = { summary, gigsByMonth, topVenues, revenue, distance, heatmap, listFinancial, createFinancial, deleteFinancial };
