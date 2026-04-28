// frontend/src/utils/exportApi.js
// In production replace the mock functions below with:
//   axios.get(`${API_BASE}/export/...`, { responseType: 'blob' })

// ─── Seed data ────────────────────────────────────────────────────────────────
export const MOCK_GIGS = [
  {
    id: 'g-001', title: 'West Coast Kickoff', gig_date: '2025-05-15',
    start_time: '21:00', end_time: '23:30', load_in_time: '17:00', soundcheck_time: '19:00',
    status: 'confirmed', deal_type: 'flat', deal_amount: '2500',
    notes: 'Park on Red River St. Dana confirmed two load slots.',
    venue_name: 'The Paramount', venue_city: 'Austin', venue_state: 'TX',
    venue_address: '713 Congress Ave', venue_country: 'US', tour_name: 'West Coast Run',
  },
  {
    id: 'g-002', title: 'Neumos Night', gig_date: '2025-06-01',
    start_time: '21:00', end_time: '23:00', load_in_time: '18:00', soundcheck_time: '19:30',
    status: 'confirmed', deal_type: 'flat', deal_amount: '3000',
    notes: 'Strict no re-entry. Merch cut 15%.',
    venue_name: 'Neumos', venue_city: 'Seattle', venue_state: 'WA',
    venue_address: '925 E Pike St', venue_country: 'US', tour_name: 'West Coast Run',
  },
  {
    id: 'g-003', title: 'Fillmore Friday', gig_date: '2025-05-22',
    start_time: '21:00', end_time: '23:30', load_in_time: '17:30', soundcheck_time: '19:00',
    status: 'inquiry', deal_type: 'guarantee_vs_door', deal_amount: '1500',
    notes: 'Contract still pending from Morgan.',
    venue_name: 'The Fillmore SF', venue_city: 'San Francisco', venue_state: 'CA',
    venue_address: '1805 Geary Blvd', venue_country: 'US', tour_name: 'West Coast Run',
  },
  {
    id: 'g-004', title: 'Red Rocks After Party', gig_date: '2025-08-10',
    start_time: '22:00', end_time: '02:00', load_in_time: '20:00', soundcheck_time: null,
    status: 'confirmed', deal_type: 'flat', deal_amount: '3500',
    notes: null,
    venue_name: 'Globe Hall', venue_city: 'Denver', venue_state: 'CO',
    venue_address: '4483 Logan St', venue_country: 'US', tour_name: 'Mountain States Circuit',
  },
  {
    id: 'g-005', title: 'Local Warm-Up', gig_date: '2025-08-22',
    start_time: '20:00', end_time: '22:00', load_in_time: '18:00', soundcheck_time: '19:00',
    status: 'confirmed', deal_type: 'flat', deal_amount: '500',
    notes: 'Home show — invite list only.',
    venue_name: 'The Echo', venue_city: 'Los Angeles', venue_state: 'CA',
    venue_address: '1822 Sunset Blvd', venue_country: 'US', tour_name: 'Mountain States Circuit',
  },
];

export const MOCK_TOURS = [
  { id: 'tour-001', name: 'West Coast Run', color: '#f0522a' },
  { id: 'tour-002', name: 'Mountain States Circuit', color: '#4a8cff' },
];

// ─── In-browser iCal generator (mirrors backend icsService.js) ────────────────
// This lets the iCal download work entirely client-side without a backend round-trip.

const esc = (s) => String(s ?? '')
  .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

const fold = (line) => {
  if (line.length <= 75) return line;
  const chunks = [];
  let i = 0;
  chunks.push(line.slice(0, 75));
  for (i = 75; i < line.length; i += 74) chunks.push(' ' + line.slice(i, i + 74));
  return chunks.join('\r\n');
};

const dtUtc = (d) => (d instanceof Date ? d : new Date(d))
  .toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

const fmt12 = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

const makeUid = (id) => `gig-${id}@bandplanner.app`;

const buildVEvent = (gig) => {
  const {
    id, title = 'Untitled Gig', gig_date, start_time, end_time,
    load_in_time, soundcheck_time, notes, status, deal_type, deal_amount,
    venue_name, venue_city, venue_state, venue_address, venue_country = 'US',
    tour_name,
  } = gig;

  if (!gig_date) return '';

  let dtstart, dtend;
  if (start_time) {
    const s = new Date(`${gig_date}T${start_time}`);
    let e = end_time ? new Date(`${gig_date}T${end_time}`) : new Date(s.getTime() + 3 * 3600000);
    if (e <= s) e = new Date(e.getTime() + 24 * 3600000);
    dtstart = `DTSTART:${dtUtc(s)}`;
    dtend   = `DTEND:${dtUtc(e)}`;
  } else {
    const next = new Date(gig_date + 'T12:00:00');
    next.setDate(next.getDate() + 1);
    dtstart = `DTSTART;VALUE=DATE:${gig_date.replace(/-/g, '')}`;
    dtend   = `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, '')}`;
  }

  const location = [venue_name, venue_address, venue_city, venue_state, venue_country].filter(Boolean).join(', ');
  const summary  = tour_name ? `${title} [${tour_name}]` : title;

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

  return [
    'BEGIN:VEVENT',
    `UID:${makeUid(id)}`,
    `DTSTAMP:${dtUtc(new Date())}`,
    dtstart, dtend,
    fold(`SUMMARY:${esc(summary)}`),
    location ? fold(`LOCATION:${esc(location)}`) : null,
    fold(`DESCRIPTION:${esc(dl.join('\n'))}`),
    `STATUS:${status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE'}`,
    'TRANSP:OPAQUE',
    'BEGIN:VALARM', 'TRIGGER:-PT24H', 'ACTION:DISPLAY',
    fold(`DESCRIPTION:Tomorrow: ${esc(summary)}`),
    'END:VALARM',
    'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY',
    fold(`DESCRIPTION:Tonight: ${esc(summary)}`),
    'END:VALARM',
    'END:VEVENT',
  ].filter(Boolean).join('\r\n');
};

export const buildIcsBlob = (gigs, calendarName = 'Band Planner') => {
  const events = gigs.map(buildVEvent).filter(Boolean).join('\r\n');
  const ics = [
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
  return new Blob([ics], { type: 'text/calendar;charset=utf-8' });
};

export const buildGoogleCalUrl = (gig) => {
  const {
    title = 'Untitled', gig_date, start_time, end_time,
    notes, deal_type, deal_amount, tour_name,
    load_in_time, soundcheck_time,
    venue_name, venue_address, venue_city, venue_state,
  } = gig;

  const p = new URLSearchParams();
  p.set('action', 'TEMPLATE');
  p.set('text', tour_name ? `${title} [${tour_name}]` : title);

  const gcFmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '');
  if (gig_date && start_time) {
    const s = new Date(`${gig_date}T${start_time}`);
    const e = end_time
      ? (() => { const r = new Date(`${gig_date}T${end_time}`); if (r <= s) r.setDate(r.getDate() + 1); return r; })()
      : new Date(s.getTime() + 3 * 3600000);
    p.set('dates', `${gcFmt(s)}/${gcFmt(e)}`);
  } else if (gig_date) {
    const d  = gig_date.replace(/-/g, '');
    const nx = new Date(gig_date + 'T12:00:00'); nx.setDate(nx.getDate() + 1);
    p.set('dates', `${d}/${nx.toISOString().slice(0, 10).replace(/-/g, '')}`);
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

// ─── API functions (swap for real HTTP calls in production) ───────────────────
const delay = (ms = 250) => new Promise(r => setTimeout(r, ms));

export const apiGetExportPreview = async ({ gigId, tourId } = {}) => {
  await delay();
  if (gigId) {
    const g = MOCK_GIGS.find(x => x.id === gigId);
    return { count: g ? 1 : 0, events: g ? [g] : [] };
  }
  if (tourId) {
    const tour = MOCK_TOURS.find(t => t.id === tourId);
    const gigs = MOCK_GIGS.filter(g => g.tour_name === tour?.name);
    return { count: gigs.length, events: gigs };
  }
  return { count: MOCK_GIGS.length, events: MOCK_GIGS };
};

// Download .ics file client-side
export const downloadIcs = (gigs, filename, calendarName) => {
  const blob = buildIcsBlob(gigs, calendarName);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Open Google Calendar tabs for all gigs (with slight delay to avoid popup blockers)
export const openGoogleCalTabs = async (gigs) => {
  for (let i = 0; i < gigs.length; i++) {
    const url = buildGoogleCalUrl(gigs[i]);
    if (i === 0) window.open(url, '_blank');
    else {
      await delay(400);
      window.open(url, '_blank');
    }
  }
};

// Helpers
export const fmtDate = (d) => d
  ? new Date(d + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  : '—';
export const fmtTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
export const statusColor = (s) => ({ confirmed: '#29cc6a', inquiry: '#f5c842', cancelled: '#ff4a4a' }[s] || '#5a5a72');
