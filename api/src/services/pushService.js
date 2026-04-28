// backend/src/services/pushService.js
const webpush = require('web-push');
const db = require('../config/db');

// ─── VAPID Setup ─────────────────────────────────────────────────────────────
// Generate keys once: node -e "const wp=require('web-push');console.log(wp.generateVAPIDKeys())"
// Then set in .env:  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@bandplanner.dev',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// ─── Core send ────────────────────────────────────────────────────────────────
/**
 * Send a Web Push notification to a single subscription endpoint.
 */
const sendWebPush = async (subscription, payload) => {
  const pushSub = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth:   subscription.auth,
    },
  };

  try {
    await webpush.sendNotification(pushSub, JSON.stringify(payload), {
      TTL: 86400, // 24h
      urgency: 'normal',
    });
    return { success: true };
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      // Subscription expired — remove it
      await db.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [subscription.endpoint]);
      return { success: false, expired: true };
    }
    throw err;
  }
};

/**
 * Send a push notification to all of a user's subscriptions.
 * @param {string} userId
 * @param {Object} payload  – { title, body, icon, badge, data }
 */
const sendPushToUser = async (userId, payload) => {
  const { rows: subs } = await db.query(
    'SELECT * FROM push_subscriptions WHERE user_id = $1',
    [userId]
  );

  if (!subs.length) {
    console.log(`  ℹ️  No push subscriptions for user ${userId}`);
    return { sent: 0 };
  }

  let sent = 0;
  let failed = 0;
  for (const sub of subs) {
    try {
      await sendWebPush(sub, payload);
      sent++;
    } catch (err) {
      console.error(`  ❌ Push failed for sub ${sub.id}:`, err.message);
      failed++;
    }
  }
  return { sent, failed };
};

// ─── Gig push payload builders ────────────────────────────────────────────────
const gigReminderPushPayload = (gig, minutesBefore) => ({
  title: `🎸 ${gig.title}`,
  body: `${minutesBefore >= 1440 ? '24h' : `${minutesBefore}m`} until showtime · ${gig.venue_name}, ${gig.venue_city}`,
  icon: '/logo192.png',
  badge: '/badge.png',
  tag: `gig-reminder-${gig.id}-${minutesBefore}`,
  requireInteraction: minutesBefore <= 60,
  data: {
    url: `/gigs`,
    gigId: gig.id,
    type: 'gig_reminder',
  },
  actions: [
    { action: 'view', title: 'View Gig' },
    { action: 'dismiss', title: 'Dismiss' },
  ],
});

const gigUpdatePushPayload = (gig, changeDescription) => ({
  title: `📋 Gig Updated: ${gig.title}`,
  body: changeDescription,
  icon: '/logo192.png',
  badge: '/badge.png',
  tag: `gig-update-${gig.id}-${Date.now()}`,
  data: { url: `/gigs`, gigId: gig.id, type: 'gig_update' },
});

module.exports = {
  sendWebPush,
  sendPushToUser,
  gigReminderPushPayload,
  gigUpdatePushPayload,
};
