// src/utils/mockApi.js
// Simulates all backend API calls with realistic data and latency

const delay = (ms = 350) => new Promise(r => setTimeout(r, ms));

// ─── Seed Data ────────────────────────────────────────────────────────────────

export const MOCK_USER = {
  id: 'u-001',
  name: 'Alex Rivera',
  email: 'alex@bandplanner.dev',
  role: 'band_admin',
  avatar: null,
  bio: 'Guitarist & founder of The Static Wolves',
};

export const MOCK_BAND = {
  id: 'b-001',
  name: 'The Static Wolves',
  genre: 'Indie Rock',
  bio: 'Three-piece indie rock band based out of Austin, TX.',
  members: [
    { id: 'u-001', name: 'Alex Rivera', role: 'Guitarist / Vocalist' },
    { id: 'u-002', name: 'Jamie Lee',   role: 'Bassist' },
    { id: 'u-003', name: 'Sam Torres',  role: 'Drummer' },
  ],
};

export let MOCK_VENUES = [
  { id: 'v-001', name: 'The Paramount',    city: 'Austin',        state: 'TX', capacity: 2500, contact_name: 'Dana Sparks',  contact_email: 'dana@paramount.example',  contact_phone: '512-555-0101', address: '713 Congress Ave' },
  { id: 'v-002', name: 'Neumos',           city: 'Seattle',       state: 'WA', capacity: 650,  contact_name: 'Chris Vega',   contact_email: 'chris@neumos.example',    contact_phone: '206-555-0202', address: '925 E Pike St' },
  { id: 'v-003', name: 'The Fillmore SF',  city: 'San Francisco', state: 'CA', capacity: 1150, contact_name: 'Morgan Hill',  contact_email: 'morgan@fillmore.example', contact_phone: '415-555-0303', address: '1805 Geary Blvd' },
  { id: 'v-004', name: 'Troubadour',       city: 'West Hollywood',state: 'CA', capacity: 400,  contact_name: 'Riley Stone',  contact_email: 'riley@troubadour.example',contact_phone: '310-555-0404', address: '9081 Santa Monica Blvd' },
  { id: 'v-005', name: 'The Echo',         city: 'Los Angeles',   state: 'CA', capacity: 350,  contact_name: 'Jordan Kim',   contact_email: 'jordan@theecho.example',  contact_phone: '213-555-0505', address: '1822 Sunset Blvd' },
];

const now = new Date();
const d = (offset) => {
  const dt = new Date(now);
  dt.setDate(dt.getDate() + offset);
  return dt.toISOString().split('T')[0];
};

export let MOCK_TOURS = [
  {
    id: 't-001',
    band_id: 'b-001',
    name: 'West Coast Run 2026',
    description: 'Spring West Coast tour hitting Austin, Seattle & SF.',
    start_date: d(14),
    end_date: d(45),
    status: 'planning',
    gig_count: 3,
  },
  {
    id: 't-002',
    band_id: 'b-001',
    name: 'Summer Headline Tour',
    description: 'Headlining shows across the Southwest.',
    start_date: d(90),
    end_date: d(120),
    status: 'planning',
    gig_count: 2,
  },
];

export let MOCK_GIGS = [
  {
    id: 'g-001',
    band_id: 'b-001',
    venue_id: 'v-001',
    tour_id: 't-001',
    title: 'West Coast Kickoff – Austin',
    gig_date: d(14),
    load_in_time: '17:00',
    soundcheck_time: '18:00',
    start_time: '20:00',
    end_time: '23:00',
    status: 'confirmed',
    deal_type: 'flat',
    deal_amount: 1500,
    ticket_price: 20,
    notes: 'Bring full backline. Dana handling door.',
    venue_name: 'The Paramount',
    venue_city: 'Austin',
    tour_name: 'West Coast Run 2026',
  },
  {
    id: 'g-002',
    band_id: 'b-001',
    venue_id: 'v-002',
    tour_id: 't-001',
    title: 'Neumos Night – Seattle',
    gig_date: d(21),
    load_in_time: '18:00',
    soundcheck_time: '19:00',
    start_time: '21:00',
    end_time: '23:30',
    status: 'confirmed',
    deal_type: 'guarantee_vs_door',
    deal_amount: 800,
    ticket_price: 15,
    notes: '',
    venue_name: 'Neumos',
    venue_city: 'Seattle',
    tour_name: 'West Coast Run 2026',
  },
  {
    id: 'g-003',
    band_id: 'b-001',
    venue_id: 'v-003',
    tour_id: 't-001',
    title: 'Fillmore Friday – San Francisco',
    gig_date: d(28),
    load_in_time: '16:00',
    soundcheck_time: '17:30',
    start_time: '20:30',
    end_time: '23:00',
    status: 'inquiry',
    deal_type: 'percentage',
    deal_amount: null,
    ticket_price: 18,
    notes: 'Awaiting contract from Morgan.',
    venue_name: 'The Fillmore SF',
    venue_city: 'San Francisco',
    tour_name: 'West Coast Run 2026',
  },
  {
    id: 'g-004',
    band_id: 'b-001',
    venue_id: 'v-004',
    tour_id: 't-002',
    title: 'Troubadour Takeover',
    gig_date: d(95),
    load_in_time: '18:00',
    soundcheck_time: '19:00',
    start_time: '21:00',
    end_time: '23:30',
    status: 'confirmed',
    deal_type: 'flat',
    deal_amount: 2000,
    ticket_price: 22,
    notes: '',
    venue_name: 'Troubadour',
    venue_city: 'West Hollywood',
    tour_name: 'Summer Headline Tour',
  },
  {
    id: 'g-005',
    band_id: 'b-001',
    venue_id: 'v-005',
    tour_id: null,
    title: 'Local Warm-Up Show',
    gig_date: d(5),
    load_in_time: '19:00',
    soundcheck_time: '19:30',
    start_time: '21:00',
    end_time: '23:00',
    status: 'confirmed',
    deal_type: 'flat',
    deal_amount: 500,
    ticket_price: 10,
    notes: 'Low-key show before the tour.',
    venue_name: 'The Echo',
    venue_city: 'Los Angeles',
    tour_name: null,
  },
];

export let MOCK_ATTACHMENTS = [
  { id: 'a-001', entity_type: 'gig', entity_id: 'g-001', file_name: 'paramount_contract.pdf',  mime_type: 'application/pdf',  size_bytes: 245000, label: 'contract', created_at: new Date().toISOString() },
  { id: 'a-002', entity_type: 'gig', entity_id: 'g-001', file_name: 'stage_rider.pdf',         mime_type: 'application/pdf',  size_bytes: 88000,  label: 'rider',    created_at: new Date().toISOString() },
  { id: 'a-003', entity_type: 'gig', entity_id: 'g-003', file_name: 'fillmore_flyer.png',      mime_type: 'image/png',        size_bytes: 512000, label: 'flyer',    created_at: new Date().toISOString() },
  { id: 'a-004', entity_type: 'tour', entity_id: 't-001', file_name: 'westcoast_itinerary.pdf', mime_type: 'application/pdf', size_bytes: 130000, label: 'other',    created_at: new Date().toISOString() },
];

export let MOCK_NOTIFICATIONS = [
  { id: 'n-001', type: 'reminder', message: 'Load-in for Local Warm-Up Show in 5 days', read: false, created_at: new Date().toISOString(), gigId: 'g-005' },
  { id: 'n-002', type: 'inquiry',  message: 'Fillmore Friday status is still "inquiry" — follow up with Morgan', read: false, created_at: new Date().toISOString(), gigId: 'g-003' },
  { id: 'n-003', type: 'contract', message: 'Contract uploaded for The Paramount gig', read: true, created_at: new Date(Date.now() - 86400000).toISOString(), gigId: 'g-001' },
];

// ─── API Functions ────────────────────────────────────────────────────────────

let nextId = 100;
const uid = (prefix) => `${prefix}-${++nextId}`;

// Auth
export const apiLogin = async (email, password) => {
  await delay();
  if (email === 'alex@bandplanner.dev' && password === 'Password123!') {
    return { user: MOCK_USER, token: 'mock-jwt-token-xyz' };
  }
  throw new Error('Invalid email or password.');
};

// Gigs
export const apiGetGigs = async () => { await delay(); return [...MOCK_GIGS]; };
export const apiGetGig = async (id) => { await delay(); return MOCK_GIGS.find(g => g.id === id); };
export const apiCreateGig = async (data) => {
  await delay();
  const venue = MOCK_VENUES.find(v => v.id === data.venue_id);
  const tour  = MOCK_TOURS.find(t => t.id === data.tour_id);
  const gig = { id: uid('g'), ...data, venue_name: venue?.name, venue_city: venue?.city, tour_name: tour?.name };
  MOCK_GIGS.push(gig);
  return gig;
};
export const apiUpdateGig = async (id, data) => {
  await delay();
  const idx = MOCK_GIGS.findIndex(g => g.id === id);
  if (idx === -1) throw new Error('Gig not found');
  const venue = MOCK_VENUES.find(v => v.id === (data.venue_id || MOCK_GIGS[idx].venue_id));
  const tour  = MOCK_TOURS.find(t => t.id === (data.tour_id || MOCK_GIGS[idx].tour_id));
  MOCK_GIGS[idx] = { ...MOCK_GIGS[idx], ...data, venue_name: venue?.name, venue_city: venue?.city, tour_name: tour?.name };
  return MOCK_GIGS[idx];
};
export const apiDeleteGig = async (id) => {
  await delay();
  MOCK_GIGS = MOCK_GIGS.filter(g => g.id !== id);
};

// Tours
export const apiGetTours = async () => { await delay(); return [...MOCK_TOURS]; };
export const apiCreateTour = async (data) => {
  await delay();
  const tour = { id: uid('t'), ...data, gig_count: 0 };
  MOCK_TOURS.push(tour);
  return tour;
};
export const apiUpdateTour = async (id, data) => {
  await delay();
  const idx = MOCK_TOURS.findIndex(t => t.id === id);
  if (idx === -1) throw new Error('Tour not found');
  MOCK_TOURS[idx] = { ...MOCK_TOURS[idx], ...data };
  return MOCK_TOURS[idx];
};
export const apiDeleteTour = async (id) => {
  await delay();
  MOCK_TOURS = MOCK_TOURS.filter(t => t.id !== id);
};

// Venues
export const apiGetVenues = async () => { await delay(); return [...MOCK_VENUES]; };
export const apiCreateVenue = async (data) => {
  await delay();
  const venue = { id: uid('v'), ...data };
  MOCK_VENUES.push(venue);
  return venue;
};
export const apiUpdateVenue = async (id, data) => {
  await delay();
  const idx = MOCK_VENUES.findIndex(v => v.id === id);
  if (idx === -1) throw new Error('Venue not found');
  MOCK_VENUES[idx] = { ...MOCK_VENUES[idx], ...data };
  return MOCK_VENUES[idx];
};
export const apiDeleteVenue = async (id) => {
  await delay();
  MOCK_VENUES = MOCK_VENUES.filter(v => v.id !== id);
};

// Attachments
export const apiGetAttachments = async (entityType, entityId) => {
  await delay();
  return MOCK_ATTACHMENTS.filter(a => a.entity_type === entityType && a.entity_id === entityId);
};
export const apiUploadAttachment = async (entityType, entityId, file, label) => {
  await delay(600);
  const att = {
    id: uid('a'), entity_type: entityType, entity_id: entityId,
    file_name: file.name, mime_type: file.type, size_bytes: file.size,
    label: label || 'other', created_at: new Date().toISOString(),
  };
  MOCK_ATTACHMENTS.push(att);
  return att;
};
export const apiDeleteAttachment = async (id) => {
  await delay();
  MOCK_ATTACHMENTS = MOCK_ATTACHMENTS.filter(a => a.id !== id);
};

// Notifications
export const apiGetNotifications = async () => { await delay(150); return [...MOCK_NOTIFICATIONS]; };
export const apiMarkNotificationRead = async (id) => {
  await delay(100);
  const n = MOCK_NOTIFICATIONS.find(n => n.id === id);
  if (n) n.read = true;
};
