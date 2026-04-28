// backend/src/controllers/notificationController.js
const db = require('../config/db');
const { sendTestEmail, sendGigReminder } = require('../services/emailService');
const { sendPushToUser, gigReminderPushPayload } = require('../services/pushService');
const { scheduleGigJobs, cancelGigJobs, logNotification } = require('../services/schedulerService');

// ─── NOTIFICATION LOG ──────────────────────────────────────────────────────────

// GET /notifications/history
// Query: ?limit=50&channel=email&status=sent&gig_id=
const getHistory = async (req, res, next) => {
  const { limit = 50, channel, status, gig_id } = req.query;
  const conditions = ['nl.user_id = $1'];
  const values = [req.user.id];
  let i = 2;

  if (channel) { conditions.push(`nl.channel = $${i++}`); values.push(channel); }
  if (status)  { conditions.push(`nl.status = $${i++}`);  values.push(status); }
  if (gig_id)  { conditions.push(`nl.gig_id = $${i++}`);  values.push(gig_id); }

  try {
    const { rows } = await db.query(
      `SELECT nl.*,
              g.title AS gig_title, g.gig_date,
              v.name AS venue_name, v.city AS venue_city
       FROM notification_log nl
       LEFT JOIN gigs g ON g.id = nl.gig_id
       LEFT JOIN venues v ON v.id = g.venue_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY nl.created_at DESC
       LIMIT $${i}`,
      [...values, parseInt(limit)]
    );
    res.json(rows);
  } catch (err) { next(err); }
};

// PATCH /notifications/history/:id/read
const markRead = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `UPDATE notification_log
       SET status = 'read', read_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status = 'sent'
       RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Notification not found.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

// PATCH /notifications/history/read-all
const markAllRead = async (req, res, next) => {
  try {
    const { rowCount } = await db.query(
      `UPDATE notification_log SET status = 'read', read_at = NOW()
       WHERE user_id = $1 AND status = 'sent'`,
      [req.user.id]
    );
    res.json({ updated: rowCount });
  } catch (err) { next(err); }
};

// ─── PREFERENCES ───────────────────────────────────────────────────────────────

// GET /notifications/preferences
const getPreferences = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM notification_preferences WHERE user_id = $1`,
      [req.user.id]
    );
    if (!rows[0]) {
      // Return defaults
      return res.json({
        user_id: req.user.id,
        email_enabled: true,
        push_enabled: false,
        reminders: [
          { label: '24h before', minutes: 1440, enabled: true },
          { label: '1h before',  minutes: 60,   enabled: true },
        ],
        email_address: null,
      });
    }
    res.json(rows[0]);
  } catch (err) { next(err); }
};

// PUT /notifications/preferences
const updatePreferences = async (req, res, next) => {
  const { email_enabled, push_enabled, reminders, email_address } = req.body;
  try {
    const { rows } = await db.query(
      `INSERT INTO notification_preferences (user_id, email_enabled, push_enabled, reminders, email_address)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id)
       DO UPDATE SET email_enabled=$2, push_enabled=$3, reminders=$4, email_address=$5
       RETURNING *`,
      [req.user.id, email_enabled, push_enabled, JSON.stringify(reminders), email_address]
    );

    // Reschedule all upcoming gig jobs for this user's bands
    const { rows: gigs } = await db.query(
      `SELECT DISTINCT g.id FROM gigs g
       JOIN band_members bm ON bm.band_id = g.band_id
       WHERE bm.user_id = $1 AND g.gig_date >= CURRENT_DATE`,
      [req.user.id]
    );
    for (const gig of gigs) {
      await scheduleGigJobs(gig.id).catch(e => console.error('Reschedule error:', e.message));
    }

    res.json(rows[0]);
  } catch (err) { next(err); }
};

// ─── PUSH SUBSCRIPTIONS ────────────────────────────────────────────────────────

// POST /notifications/push/subscribe
const subscribePush = async (req, res, next) => {
  const { endpoint, keys: { p256dh, auth } = {}, userAgent } = req.body;
  if (!endpoint || !p256dh || !auth) {
    return res.status(400).json({ error: 'endpoint, keys.p256dh and keys.auth are required.' });
  }
  try {
    const { rows } = await db.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh=$3, auth=$4
       RETURNING id`,
      [req.user.id, endpoint, p256dh, auth, userAgent || req.headers['user-agent']]
    );
    res.status(201).json({ id: rows[0].id, message: 'Push subscription saved.' });
  } catch (err) { next(err); }
};

// DELETE /notifications/push/unsubscribe
const unsubscribePush = async (req, res, next) => {
  const { endpoint } = req.body;
  try {
    await db.query(
      'DELETE FROM push_subscriptions WHERE user_id=$1 AND endpoint=$2',
      [req.user.id, endpoint]
    );
    res.json({ message: 'Unsubscribed.' });
  } catch (err) { next(err); }
};

// GET /notifications/push/vapid-key
const getVapidKey = (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
};

// ─── JOBS / SCHEDULING ─────────────────────────────────────────────────────────

// GET /notifications/jobs?gig_id=
const getJobs = async (req, res, next) => {
  const { gig_id } = req.query;
  try {
    const { rows } = await db.query(
      `SELECT nj.*, g.title AS gig_title FROM notification_jobs nj
       JOIN gigs g ON g.id = nj.gig_id
       WHERE nj.user_id = $1 ${gig_id ? 'AND nj.gig_id = $2' : ''}
       ORDER BY nj.fire_at ASC`,
      gig_id ? [req.user.id, gig_id] : [req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
};

// POST /notifications/jobs/schedule/:gigId  — manually trigger scheduling for a gig
const scheduleForGig = async (req, res, next) => {
  try {
    await scheduleGigJobs(req.params.gigId);
    const { rows } = await db.query(
      'SELECT * FROM notification_jobs WHERE gig_id=$1 AND user_id=$2 ORDER BY fire_at',
      [req.params.gigId, req.user.id]
    );
    res.json({ scheduled: rows.length, jobs: rows });
  } catch (err) { next(err); }
};

// ─── SEND NOW (manual / test) ──────────────────────────────────────────────────

// POST /notifications/test-email
const sendTest = async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT name, email FROM users WHERE id=$1', [req.user.id]);
    const user = rows[0];
    const { rows: prefRows } = await db.query('SELECT email_address FROM notification_preferences WHERE user_id=$1', [req.user.id]);
    const to = prefRows[0]?.email_address || user.email;

    await sendTestEmail({ to, userName: user.name });
    await logNotification({
      userId: req.user.id, gigId: null,
      channel: 'email', type: 'test',
      subject: 'Test email', status: 'sent',
      metadata: { to },
    });
    res.json({ message: `Test email sent to ${to}` });
  } catch (err) { next(err); }
};

// POST /notifications/send-now/:gigId  — send reminder immediately (for testing)
const sendNow = async (req, res, next) => {
  const { gigId } = req.params;
  const { channel = 'email', minutesBefore = 60 } = req.body;
  try {
    const { rows: gigRows } = await db.query(
      `SELECT g.*, v.name AS venue_name, v.city AS venue_city, v.address AS venue_address, v.state, t.name AS tour_name
       FROM gigs g LEFT JOIN venues v ON v.id=g.venue_id LEFT JOIN tours t ON t.id=g.tour_id WHERE g.id=$1`,
      [gigId]
    );
    const gig = gigRows[0];
    if (!gig) return res.status(404).json({ error: 'Gig not found.' });

    const { rows: [user] } = await db.query('SELECT name, email FROM users WHERE id=$1', [req.user.id]);
    const { rows: [pref] } = await db.query('SELECT email_address FROM notification_preferences WHERE user_id=$1', [req.user.id]);
    const { rows: attachments } = await db.query("SELECT * FROM attachments WHERE entity_type='gig' AND entity_id=$1", [gigId]);

    let result = {};
    if (channel === 'email') {
      const to = pref?.email_address || user.email;
      await sendGigReminder({ to, userName: user.name, gig, attachments, minutesBefore: parseInt(minutesBefore) });
      result = { channel: 'email', to };
    } else if (channel === 'push') {
      result = await sendPushToUser(req.user.id, gigReminderPushPayload(gig, parseInt(minutesBefore)));
    }

    await logNotification({
      userId: req.user.id, gigId,
      channel, type: 'gig_reminder',
      subject: `Manual send: ${gig.title}`,
      status: 'sent',
      metadata: { manual: true, minutesBefore, ...result },
    });
    res.json({ message: 'Notification sent.', result });
  } catch (err) { next(err); }
};

// GET /notifications/stats
const getStats = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT 
         COUNT(*) FILTER (WHERE status IN ('sent','read')) AS total_sent,
         COUNT(*) FILTER (WHERE status = 'read')           AS total_read,
         COUNT(*) FILTER (WHERE status = 'failed')         AS total_failed,
         COUNT(*) FILTER (WHERE channel = 'email')         AS email_count,
         COUNT(*) FILTER (WHERE channel = 'push')          AS push_count,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS last_7_days
       FROM notification_log WHERE user_id = $1`,
      [req.user.id]
    );
    const stats = rows[0];
    const { rows: pending } = await db.query(
      `SELECT COUNT(*) AS pending_jobs FROM notification_jobs WHERE user_id=$1 AND status='pending'`,
      [req.user.id]
    );
    res.json({ ...stats, pending_jobs: pending[0].pending_jobs });
  } catch (err) { next(err); }
};

module.exports = {
  getHistory, markRead, markAllRead,
  getPreferences, updatePreferences,
  subscribePush, unsubscribePush, getVapidKey,
  getJobs, scheduleForGig,
  sendTest, sendNow,
  getStats,
};
