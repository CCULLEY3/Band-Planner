// backend/src/services/icsService.js
// Pure Node RFC 5545 iCalendar generator. Zero npm dependencies.
// Spec: https://www.rfc-editor.org/rfc/rfc5545

const crypto = require('crypto');

// ─── Low-level RFC helpers ────────────────────────────────────────────────────

/** Fold long lines per RFC 5545 §3.1 (75-octet max, continuation starts with HTAB) */
const fold = (line) => {
  if (Buffer.byteLength(line, 'utf8') <= 75) return line;
  const out = [];
  let cur = '';
  for (const ch of [...line]) {
    if (Buffer.byteLength(cur + ch, 'utf8') > 75) {
      out.push(cur);
      cur = '\t' + ch;
    } else {
      cur += ch;
    }
  }
  if (cur) out.push(cur);
  return out.join('\r\n');
};

/** Escape TEXT-value special chars: backslash, semicolon, comma, newline */
const esc = (s) =>
  String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

/** Date → UTC iCal stamp: 20250515T210000Z */
const dtUtc = (d) =>
  (d instanceof Date ? d : new Date(d))
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

/** Date-string "YYYY-MM-DD" → iCal date "YYYYMMDD" */
const dateOnly = (s) => String(s).replace(/-/g, '');

/** Add h hours to Date d */
const addH = (d, h) => new Date(d.getTime() + h * 3_600_000);

/** Stable UID: md5(gigId)@bandplanner.app — re-imports update rather than duplicate */
const makeUid = (id) =>
  `${crypto.createHash('md5').update(String(id)).digest('hex')}@bandplanner.app`;

/** Format time string "HH:MM" to "12:30 PM" */
const fmt12 = (t) => {
  if (!t) return '';
  const [hh, mm] = t.split(':').map(Number);
  return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'PM' : 'AM'}`;
};

// ─── VEVENT builder ───────────────────────────────────────────────────────────

/**
 * Build a single VEVENT block string for one gig.
 *
 * Gig fields used (all optional except id + gig_date):
 *   id, title, gig_date, start_time, end_time, load_in_time, soundcheck_time,
 *   notes, status, deal_type, deal_amount,
 *   venue_name, venue_city, venue_state, venue_address, venue_country,
 *   tour_name
 */
const buildVEvent = (gig) => {
  const {
    id, title = 'Untitled Gig', gig_date,
    start_time, end_time, load_in_time, soundcheck_time,
    notes, status, deal_type, deal_amount,
    venue_name, venue_city, venue_state, venue_address, venue_country = 'US',
    tour_name,
  } = gig;

  if (!gig_date) return '';

  const now = dtUtc(new Date());
  const uid = makeUid(id || `${title}${gig_date}`);

  // ── DTSTART / DTEND ──────────────────────────────────────────────
  let dtstart, dtend;
  if (start_time) {
    const s = new Date(`${gig_date}T${start_time}`);
    let e = end_time
      ? (() => { const r = new Date(`${gig_date}T${end_time}`); if (r <= s) r.setDate(r.getDate() + 1); return r; })()
      : addH(s, 3);
    dtstart = `DTSTART:${dtUtc(s)}`;
    dtend   = `DTEND:${dtUtc(e)}`;
  } else {
    const next = new Date(gig_date + 'T12:00:00');
    next.setDate(next.getDate() + 1);
    dtstart = `DTSTART;VALUE=DATE:${dateOnly(gig_date)}`;
    dtend   = `DTEND;VALUE=DATE:${dateOnly(next.toISOString().slice(0, 10))}`;
  }

  // ── LOCATION ──────────────────────────────────────────────────────
  const location = [venue_name, venue_address, venue_city, venue_state, venue_country]
    .filter(Boolean).join(', ');

  // ── SUMMARY ───────────────────────────────────────────────────────
  const summary = tour_name ? `${title} [${tour_name}]` : title;

  // ── DESCRIPTION ───────────────────────────────────────────────────
  const dl = [];
  if (load_in_time)    dl.push(`Load-In: ${fmt12(load_in_time)}`);
  if (soundcheck_time) dl.push(`Soundcheck: ${fmt12(soundcheck_time)}`);
  if (start_time)      dl.push(`Show: ${fmt12(start_time)}`);
  if (end_time)        dl.push(`End: ${fmt12(end_time)}`);
  if (deal_type && deal_amount) {
    const label = { flat: 'Flat Fee', percentage: 'Percentage', guarantee_vs_door: 'Guarantee vs Door' }[deal_type] ?? deal_type;
    dl.push('', `Deal: ${label} — $${Number(deal_amount).toLocaleString()}`);
  }
  if (tour_name) dl.push(`Tour: ${tour_name}`);
  if (notes)     dl.push('', 'Notes:', notes);
  dl.push('', '— Band Planner');

  const icalStatus = status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE';

  // ── Assemble ──────────────────────────────────────────────────────
  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    dtstart,
    dtend,
    fold(`SUMMARY:${esc(summary)}`),
    location ? fold(`LOCATION:${esc(location)}`) : null,
    fold(`DESCRIPTION:${esc(dl.join('\n'))}`),
    `STATUS:${icalStatus}`,
    'TRANSP:OPAQUE',
    // 24h reminder
    'BEGIN:VALARM',
    'TRIGGER:-PT24H',
    'ACTION:DISPLAY',
    fold(`DESCRIPTION:Tomorrow: ${esc(summary)}`),
    'END:VALARM',
    // 1h reminder
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    fold(`DESCRIPTION:Tonight: ${esc(summary)}`),
    'END:VALARM',
    'END:VEVENT',
  ].filter(Boolean).join('\r\n');
};

// ─── VCALENDAR wrapper ────────────────────────────────────────────────────────

/**
 * Build a complete .ics string from an array of gig objects.
 */
const buildIcs = (gigs, calendarName = 'Band Planner') => {
  const events = gigs.map(buildVEvent).filter(Boolean).join('\r\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Band Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    fold(`X-WR-CALNAME:${esc(calendarName)}`),
    'X-APPLE-CALENDAR-COLOR:#f0522a',
    events,
    'END:VCALENDAR',
  ].join('\r\n');
};

// ─── Google Calendar URL ──────────────────────────────────────────────────────

/**
 * Build a Google Calendar "Add Event" URL for a single gig.
 * Opens in a browser tab; the user clicks Save in Google's UI.
 */
const buildGoogleCalUrl = (gig) => {
  const {
    title = 'Untitled Gig', gig_date, start_time, end_time,
    notes, deal_type, deal_amount, tour_name,
    load_in_time, soundcheck_time,
    venue_name, venue_address, venue_city, venue_state,
  } = gig;

  const p = new URLSearchParams();
  p.set('action', 'TEMPLATE');
  p.set('text', tour_name ? `${title} [${tour_name}]` : title);

  // Google wants YYYYMMDDTHHMMSS (no Z)
  const gcFmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '');

  if (gig_date && start_time) {
    const s = new Date(`${gig_date}T${start_time}`);
    const e = end_time
      ? (() => { const r = new Date(`${gig_date}T${end_time}`); if (r <= s) r.setDate(r.getDate() + 1); return r; })()
      : addH(s, 3);
    p.set('dates', `${gcFmt(s)}/${gcFmt(e)}`);
  } else if (gig_date) {
    const d = dateOnly(gig_date);
    const next = new Date(gig_date + 'T12:00:00');
    next.setDate(next.getDate() + 1);
    p.set('dates', `${d}/${dateOnly(next.toISOString().slice(0, 10))}`);
  }

  const loc = [venue_name, venue_address, venue_city, venue_state].filter(Boolean).join(', ');
  if (loc) p.set('location', loc);

  const det = [];
  if (load_in_time)    det.push(`Load-In: ${fmt12(load_in_time)}`);
  if (soundcheck_time) det.push(`Soundcheck: ${fmt12(soundcheck_time)}`);
  if (deal_type && deal_amount)
    det.push(`Deal: $${Number(deal_amount).toLocaleString()} (${deal_type.replace(/_/g, ' ')})`);
  if (tour_name) det.push(`Tour: ${tour_name}`);
  if (notes)     det.push(`Notes: ${notes}`);
  det.push('Band Planner');
  p.set('details', det.join('\n'));

  return `https://calendar.google.com/calendar/render?${p.toString()}`;
};

module.exports = { buildIcs, buildVEvent, buildGoogleCalUrl };
