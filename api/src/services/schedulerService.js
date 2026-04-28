// backend/src/services/schedulerService.js
// Manages the notification_jobs table and processes due jobs.
const db = require('../config/db');
const { sendGigReminder } = require('./emailService');
const { sendPushToUser, gigReminderPushPayload } = require('./pushService');

// ─── Schedule jobs for a gig ──────────────────────────────────────────────────
/**
 * When a gig is created or updated, (re)compute all notification_jobs for it
 * based on every user's notification preferences.
 */
const scheduleGigJobs = async (gigId) => {
  // Fetch gig + venue info
  const { rows: gigRows } = await db.query(
    `SELECT g.*, v.name AS venue_name, v.city AS venue_city, v.address AS venue_address, v.state
     FROM gigs g LEFT JOIN venues v ON v.id = g.venue_id WHERE g.id = $1`,
    [gigId]
  );
  const gig = gigRows[0];
  if (!gig || !gig.gig_date) return;

  // Only schedule for future gigs
  const gigDatetime = new Date(`${gig.gig_date}T${gig.start_time || '20:00'}:00`);
  if (gigDatetime < new Date()) return;

  // Get all users with preferences who belong to this band
  const { rows: users } = await db.query(
    `SELECT u.id AS user_id, u.email, u.name,
            COALESCE(np.reminders, '[{"label":"24h","minutes":1440,"enabled":true},{"label":"1h","minutes":60,"enabled":true}]'::jsonb) AS reminders,
            COALESCE(np.email_enabled, true) AS email_enabled,
            COALESCE(np.push_enabled, false) AS push_enabled,
            COALESCE(np.email_address, u.email) AS notify_email
     FROM band_members bm
     JOIN users u ON u.id = bm.user_id
     LEFT JOIN notification_preferences np ON np.user_id = u.id
     WHERE bm.band_id = $1`,
    [gig.band_id]
  );

  for (const user of users) {
    const reminders = Array.isArray(user.reminders) ? user.reminders : JSON.parse(user.reminders);
    const channels = [];
    if (user.email_enabled) channels.push('email');
    if (user.push_enabled)  channels.push('push');
    if (!channels.length) channels.push('email');

    for (const reminder of reminders) {
      if (reminder.enabled === false) continue;
      const fireAt = new Date(gigDatetime.getTime() - reminder.minutes * 60000);
      if (fireAt < new Date()) continue;  // already past

      await db.query(
        `INSERT INTO notification_jobs (user_id, gig_id, reminder_minutes, fire_at, channels)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, gig_id, reminder_minutes)
         DO UPDATE SET fire_at = $4, channels = $5, status = 'pending', fired_at = NULL`,
        [user.user_id, gigId, reminder.minutes, fireAt.toISOString(), channels]
      );
    }
  }
  console.log(`📅  Scheduled notification jobs for gig ${gigId}`);
};

// ─── Cancel jobs for a gig ────────────────────────────────────────────────────
const cancelGigJobs = async (gigId) => {
  await db.query(
    `UPDATE notification_jobs SET status = 'cancelled' WHERE gig_id = $1 AND status = 'pending'`,
    [gigId]
  );
};

// ─── Process due jobs (called by cron) ───────────────────────────────────────
const processDueJobs = async () => {
  const { rows: jobs } = await db.query(
    `SELECT nj.*, 
            u.name AS user_name, u.email AS user_email,
            np.email_address AS override_email,
            g.title AS gig_title, g.gig_date, g.start_time, g.load_in_time,
            g.soundcheck_time, g.end_time, g.notes, g.status, g.deal_type, g.deal_amount,
            g.band_id, g.tour_id,
            v.name AS venue_name, v.city AS venue_city, v.address AS venue_address, v.state,
            t.name AS tour_name
     FROM notification_jobs nj
     JOIN users u ON u.id = nj.user_id
     LEFT JOIN notification_preferences np ON np.user_id = nj.user_id
     JOIN gigs g ON g.id = nj.gig_id
     LEFT JOIN venues v ON v.id = g.venue_id
     LEFT JOIN tours  t ON t.id = g.tour_id
     WHERE nj.status = 'pending' AND nj.fire_at <= NOW()
     ORDER BY nj.fire_at ASC
     LIMIT 50`,
    []
  );

  if (!jobs.length) return;
  console.log(`🔔  Processing ${jobs.length} due notification jobs…`);

  for (const job of jobs) {
    // Mark as fired optimistically
    await db.query(
      `UPDATE notification_jobs SET status = 'fired', fired_at = NOW() WHERE id = $1`,
      [job.id]
    );

    // Fetch attachments for this gig
    const { rows: attachments } = await db.query(
      `SELECT * FROM attachments WHERE entity_type = 'gig' AND entity_id = $1`,
      [job.gig_id]
    );

    const gig = {
      id: job.gig_id,
      title: job.gig_title,
      gig_date: job.gig_date,
      start_time: job.start_time,
      load_in_time: job.load_in_time,
      soundcheck_time: job.soundcheck_time,
      end_time: job.end_time,
      notes: job.notes,
      status: job.status,
      deal_type: job.deal_type,
      deal_amount: job.deal_amount,
      venue_name: job.venue_name,
      venue_city: job.venue_city,
      venue_address: job.venue_address,
      state: job.state,
      tour_name: job.tour_name,
    };

    const channels = job.channels || ['email'];

    for (const channel of channels) {
      try {
        if (channel === 'email') {
          const to = job.override_email || job.user_email;
          const result = await sendGigReminder({
            to,
            userName: job.user_name,
            gig,
            attachments,
            minutesBefore: job.reminder_minutes,
          });
          await logNotification({
            userId: job.user_id, gigId: job.gig_id,
            channel: 'email', type: 'gig_reminder',
            subject: `Show reminder: ${gig.title}`,
            body: `Reminder sent to ${to}`,
            status: 'sent',
            scheduledFor: job.fire_at,
            metadata: { reminder_minutes: job.reminder_minutes, messageId: result?.messageId },
          });
        }

        if (channel === 'push') {
          await sendPushToUser(job.user_id, gigReminderPushPayload(gig, job.reminder_minutes));
          await logNotification({
            userId: job.user_id, gigId: job.gig_id,
            channel: 'push', type: 'gig_reminder',
            subject: `Push: ${gig.title}`,
            body: `${job.reminder_minutes}m reminder push sent`,
            status: 'sent',
            scheduledFor: job.fire_at,
            metadata: { reminder_minutes: job.reminder_minutes },
          });
        }
      } catch (err) {
        console.error(`  ❌ Failed ${channel} for job ${job.id}:`, err.message);
        await logNotification({
          userId: job.user_id, gigId: job.gig_id,
          channel, type: 'gig_reminder',
          subject: `Failed: ${gig.title}`,
          status: 'failed',
          errorMessage: err.message,
          scheduledFor: job.fire_at,
          metadata: { reminder_minutes: job.reminder_minutes },
        });
      }
    }
  }
};

// ─── Log helper ───────────────────────────────────────────────────────────────
const logNotification = async ({
  userId, gigId, channel, type, subject, body,
  status, errorMessage, scheduledFor, metadata = {}
}) => {
  await db.query(
    `INSERT INTO notification_log
       (user_id, gig_id, channel, type, subject, body, status, error_message, scheduled_for, sent_at, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      userId, gigId, channel, type, subject, body,
      status, errorMessage || null, scheduledFor,
      status === 'sent' ? new Date().toISOString() : null,
      JSON.stringify(metadata),
    ]
  );
};

module.exports = { scheduleGigJobs, cancelGigJobs, processDueJobs, logNotification };
