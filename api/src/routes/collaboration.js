// backend/src/routes/collaboration.js
// RSVPs, threaded comments, emoji reactions, activity feed
const router = require('express').Router();
const { body, param } = require('express-validator');
const { authenticate, requireBandAccess } = require('../middleware/auth');
const { query } = require('../config/db');

router.use(authenticate);

// ── RSVPs ─────────────────────────────────────────────────────────────────────
router.get('/gigs/:gigId/participants', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT p.*, u.name, u.email, u.avatar_color
       FROM participants p JOIN users u ON u.id = p.user_id
       WHERE p.gig_id = $1 ORDER BY p.created_at`,
      [req.params.gigId]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/gigs/:gigId/rsvp',
  [body('rsvp').isIn(['yes','no','maybe','pending'])],
  async (req, res) => {
    try {
      const { gigId } = req.params;
      const { rsvp, role, notes } = req.body;
      const { rows } = await query(
        `INSERT INTO participants (gig_id, user_id, rsvp, role, notes)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (gig_id, user_id) DO UPDATE
           SET rsvp=$3, role=COALESCE($4, participants.role),
               notes=COALESCE($5, participants.notes), updated_at=NOW()
         RETURNING *`,
        [gigId, req.user.sub, rsvp, role || null, notes || null]
      );
      res.json(rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
  }
);

// ── Comments ──────────────────────────────────────────────────────────────────
router.get('/comments', async (req, res) => {
  try {
    const { gig_id } = req.query;
    if (!gig_id) return res.status(400).json({ error: 'gig_id required' });
    const { rows } = await query(
      `SELECT c.*, u.name, u.avatar_color,
         COALESCE(
           json_agg(
             json_build_object('emoji', r.emoji, 'user_id', r.user_id, 'user_name', ru.name)
           ) FILTER (WHERE r.id IS NOT NULL), '[]'
         ) AS reactions
       FROM comments c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN comment_reactions r ON r.comment_id = c.id
       LEFT JOIN users ru ON ru.id = r.user_id
       WHERE c.gig_id = $1
       GROUP BY c.id, u.name, u.avatar_color
       ORDER BY c.created_at`,
      [gig_id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/comments',
  [body('gig_id').isUUID(), body('body').notEmpty().trim()],
  async (req, res) => {
    try {
      const { gig_id, body: text, parent_id } = req.body;
      const { rows } = await query(
        `INSERT INTO comments (gig_id, user_id, body, parent_id)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [gig_id, req.user.sub, text, parent_id || null]
      );
      res.status(201).json(rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
  }
);

router.patch('/comments/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE comments SET body=$1, edited_at=NOW()
       WHERE id=$2 AND user_id=$3 RETURNING *`,
      [req.body.body, req.params.id, req.user.sub]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found or not yours' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/comments/:id', async (req, res) => {
  try {
    // Users can delete their own; leaders can delete any
    const { rows } = await query(
      `DELETE FROM comments WHERE id=$1 AND (user_id=$2 OR EXISTS(
         SELECT 1 FROM band_members bm
         JOIN gigs g ON g.band_id=bm.band_id
         WHERE g.id=(SELECT gig_id FROM comments WHERE id=$1)
           AND bm.user_id=$2 AND bm.role='band_leader'
       )) RETURNING id`,
      [req.params.id, req.user.sub]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found or not permitted' });
    res.json({ deleted: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/comments/:id/pin', async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE comments SET is_pinned = NOT is_pinned WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/comments/:id/react',
  [body('emoji').notEmpty()],
  async (req, res) => {
    try {
      const { rows: existing } = await query(
        `SELECT id FROM comment_reactions WHERE comment_id=$1 AND user_id=$2 AND emoji=$3`,
        [req.params.id, req.user.sub, req.body.emoji]
      );
      if (existing.length) {
        await query(`DELETE FROM comment_reactions WHERE id=$1`, [existing[0].id]);
        return res.json({ toggled: false });
      }
      await query(
        `INSERT INTO comment_reactions (comment_id, user_id, emoji) VALUES ($1,$2,$3)`,
        [req.params.id, req.user.sub, req.body.emoji]
      );
      res.json({ toggled: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  }
);

// ── Activity feed ─────────────────────────────────────────────────────────────
router.get('/gigs/:gigId/activity', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT a.*, u.name, u.avatar_color
       FROM activity_feed a LEFT JOIN users u ON u.id=a.user_id
       WHERE a.gig_id=$1 ORDER BY a.created_at DESC LIMIT 50`,
      [req.params.gigId]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
