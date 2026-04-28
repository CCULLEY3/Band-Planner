// frontend/src/utils/notificationApi.js
// Extends the existing mockApi.js with notification-specific calls.
// In production, replace these with real axios calls to /notifications/*

const delay = (ms = 300) => new Promise(r => setTimeout(r, ms));

let nextId = 200;
const uid = () => `nl-${++nextId}`;

// ─── Seed Data ────────────────────────────────────────────────────────────────
const now = new Date();
const daysAgo = (n) => { const d = new Date(now); d.setDate(d.getDate() - n); return d.toISOString(); };
const daysFromNow = (n) => { const d = new Date(now); d.setDate(d.getDate() + n); return d.toISOString(); };

export let MOCK_HISTORY = [
  {
    id: 'nl-001', channel: 'email', type: 'gig_reminder', status: 'read',
    subject: 'Show reminder: Local Warm-Up Show is 1 day away',
    body: 'Sent to alex@bandplanner.dev',
    gig_id: 'g-005', gig_title: 'Local Warm-Up Show', gig_date: daysFromNow(5),
    venue_name: 'The Echo', venue_city: 'Los Angeles',
    scheduled_for: daysFromNow(4), sent_at: daysFromNow(4), read_at: daysAgo(0),
    created_at: daysAgo(1),
    metadata: { reminder_minutes: 1440, to: 'alex@bandplanner.dev' },
  },
  {
    id: 'nl-002', channel: 'push', type: 'gig_reminder', status: 'sent',
    subject: '🎸 Local Warm-Up Show',
    body: '1h until showtime · The Echo, Los Angeles',
    gig_id: 'g-005', gig_title: 'Local Warm-Up Show', gig_date: daysFromNow(5),
    venue_name: 'The Echo', venue_city: 'Los Angeles',
    scheduled_for: daysFromNow(5), sent_at: null, read_at: null,
    created_at: daysAgo(0),
    metadata: { reminder_minutes: 60 },
  },
  {
    id: 'nl-003', channel: 'email', type: 'gig_reminder', status: 'sent',
    subject: 'Show reminder: West Coast Kickoff – Austin is 24h away',
    body: 'Sent to alex@bandplanner.dev',
    gig_id: 'g-001', gig_title: 'West Coast Kickoff – Austin', gig_date: daysFromNow(14),
    venue_name: 'The Paramount', venue_city: 'Austin',
    scheduled_for: daysFromNow(13), sent_at: null,
    created_at: daysAgo(0),
    metadata: { reminder_minutes: 1440, to: 'alex@bandplanner.dev' },
  },
  {
    id: 'nl-004', channel: 'email', type: 'test', status: 'sent',
    subject: '✅ Band Planner notifications are working!',
    body: 'Sent to alex@bandplanner.dev',
    gig_id: null, gig_title: null, gig_date: null,
    venue_name: null, venue_city: null,
    scheduled_for: null, sent_at: daysAgo(3), read_at: daysAgo(3),
    created_at: daysAgo(3),
    metadata: { to: 'alex@bandplanner.dev' },
  },
  {
    id: 'nl-005', channel: 'email', type: 'gig_reminder', status: 'failed',
    subject: 'Show reminder: Fillmore Friday – San Francisco',
    body: 'SMTP connection timeout',
    gig_id: 'g-003', gig_title: 'Fillmore Friday – San Francisco', gig_date: daysFromNow(28),
    venue_name: 'The Fillmore SF', venue_city: 'San Francisco',
    scheduled_for: daysAgo(2), sent_at: null,
    created_at: daysAgo(2),
    metadata: { error: 'SMTP connect timeout' },
  },
];

export let MOCK_PREFERENCES = {
  user_id: 'u-001',
  email_enabled: true,
  push_enabled: false,
  email_address: '',
  reminders: [
    { label: '24h before', minutes: 1440, enabled: true },
    { label: '1h before',  minutes: 60,   enabled: true },
    { label: '3 days before', minutes: 4320, enabled: false },
    { label: '15 min before', minutes: 15, enabled: false },
  ],
};

export let MOCK_JOBS = [
  { id: 'nj-001', gig_id: 'g-005', gig_title: 'Local Warm-Up Show', reminder_minutes: 1440, fire_at: daysFromNow(4), channels: ['email','push'], status: 'pending' },
  { id: 'nj-002', gig_id: 'g-005', gig_title: 'Local Warm-Up Show', reminder_minutes: 60,   fire_at: daysFromNow(5), channels: ['email'], status: 'pending' },
  { id: 'nj-003', gig_id: 'g-001', gig_title: 'West Coast Kickoff – Austin', reminder_minutes: 1440, fire_at: daysFromNow(13), channels: ['email'], status: 'pending' },
  { id: 'nj-004', gig_id: 'g-001', gig_title: 'West Coast Kickoff – Austin', reminder_minutes: 60,   fire_at: daysFromNow(14), channels: ['email'], status: 'pending' },
  { id: 'nj-005', gig_id: 'g-002', gig_title: 'Neumos Night – Seattle',      reminder_minutes: 1440, fire_at: daysFromNow(20), channels: ['email'], status: 'pending' },
];

export const MOCK_STATS = {
  total_sent: '8', total_read: '2', total_failed: '1',
  email_count: '7', push_count: '1', last_7_days: '5', pending_jobs: '5',
};

// ─── API Functions ────────────────────────────────────────────────────────────

export const apiGetHistory = async ({ channel, status } = {}) => {
  await delay();
  let results = [...MOCK_HISTORY];
  if (channel) results = results.filter(n => n.channel === channel);
  if (status)  results = results.filter(n => n.status === status);
  return results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
};

export const apiMarkRead = async (id) => {
  await delay(150);
  const item = MOCK_HISTORY.find(n => n.id === id);
  if (item) { item.status = 'read'; item.read_at = new Date().toISOString(); }
  return item;
};

export const apiMarkAllRead = async () => {
  await delay(200);
  MOCK_HISTORY.forEach(n => { if (n.status === 'sent') { n.status = 'read'; n.read_at = new Date().toISOString(); } });
  return { updated: MOCK_HISTORY.filter(n => n.status === 'read').length };
};

export const apiGetPreferences = async () => { await delay(); return { ...MOCK_PREFERENCES }; };

export const apiUpdatePreferences = async (prefs) => {
  await delay(400);
  Object.assign(MOCK_PREFERENCES, prefs);
  return { ...MOCK_PREFERENCES };
};

export const apiGetJobs = async () => { await delay(); return [...MOCK_JOBS]; };

export const apiGetStats = async () => { await delay(150); return { ...MOCK_STATS }; };

export const apiSendTest = async () => {
  await delay(800);
  const entry = {
    id: uid(), channel: 'email', type: 'test', status: 'sent',
    subject: '✅ Band Planner notifications are working!',
    body: 'Test email sent successfully',
    gig_id: null, gig_title: null, venue_name: null, venue_city: null,
    sent_at: new Date().toISOString(), created_at: new Date().toISOString(),
    metadata: {},
  };
  MOCK_HISTORY.unshift(entry);
  return { message: 'Test email sent successfully!' };
};

export const apiSendNow = async (gigId, { channel = 'email', minutesBefore = 60 } = {}) => {
  await delay(600);
  const entry = {
    id: uid(), channel, type: 'gig_reminder', status: 'sent',
    subject: `Manual send: ${minutesBefore}m reminder`,
    body: `Sent via ${channel}`,
    gig_id: gigId, created_at: new Date().toISOString(),
    sent_at: new Date().toISOString(), metadata: { manual: true, minutesBefore },
  };
  MOCK_HISTORY.unshift(entry);
  return { message: 'Notification sent.' };
};

export const apiGetVapidKey = async () => {
  await delay(100);
  return { publicKey: null }; // null in mock/dev
};

export const apiSubscribePush = async (subscription) => {
  await delay(300);
  return { id: uid(), message: 'Push subscription saved.' };
};

// Helper
export const formatReminderLabel = (minutes) => {
  if (minutes >= 1440) return `${minutes / 1440} day${minutes >= 2880 ? 's' : ''} before`;
  if (minutes >= 60)   return `${minutes / 60} hour${minutes >= 120 ? 's' : ''} before`;
  return `${minutes} min before`;
};

export const REMINDER_PRESETS = [
  { label: '15 min before',  minutes: 15 },
  { label: '30 min before',  minutes: 30 },
  { label: '1 hour before',  minutes: 60 },
  { label: '2 hours before', minutes: 120 },
  { label: '6 hours before', minutes: 360 },
  { label: '12h before',     minutes: 720 },
  { label: '24h before',     minutes: 1440 },
  { label: '2 days before',  minutes: 2880 },
  { label: '3 days before',  minutes: 4320 },
  { label: '1 week before',  minutes: 10080 },
];
