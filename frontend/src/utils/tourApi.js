// frontend/src/utils/tourApi.js
// Mock API for tour planning — swap with real axios calls in production
const delay = (ms = 300) => new Promise(r => setTimeout(r, ms));
let nextId = 900;
const uid = () => `t-${++nextId}`;

// ─── Seed Data with real lat/lng ──────────────────────────────────────────────
export const MOCK_TOURS = [
  {
    id: 'tour-001',
    band_id: 'band-001',
    name: 'West Coast Run',
    description: 'Pacific coast swing — Austin to Seattle with stops along the way.',
    status: 'planning',
    color: '#f0522a',
    start_date: '2025-05-15',
    end_date: '2025-06-02',
    total_miles: 2184,
    total_shows: 5,
    home_city: 'Austin, TX',
    home_lat: 30.2672,
    home_lng: -97.7431,
    stop_count: 5,
    stops: [
      {
        stop_id: 's-001', tour_id: 'tour-001', gig_id: 'g-001',
        stop_order: 1,
        leg_miles: null, leg_drive_hrs: null, leg_mode: 'drive', leg_notes: null,
        gig_title: 'West Coast Kickoff', gig_date: '2025-05-15',
        start_time: '21:00', gig_status: 'confirmed',
        deal_type: 'flat', deal_amount: '2500',
        venue_id: 'v-001', venue_name: 'The Paramount', venue_city: 'Austin',
        venue_state: 'TX', venue_country: 'US', venue_address: '713 Congress Ave',
        lat: 30.2672, lng: -97.7431,
      },
      {
        stop_id: 's-002', tour_id: 'tour-001', gig_id: 'g-006',
        stop_order: 2,
        leg_miles: 1083, leg_drive_hrs: 19.7, leg_mode: 'drive', leg_notes: 'Overnight drive — split shifts',
        gig_title: 'Phoenix Stopover', gig_date: '2025-05-18',
        start_time: '20:00', gig_status: 'confirmed',
        deal_type: 'flat', deal_amount: '1800',
        venue_id: 'v-006', venue_name: 'The Van Buren', venue_city: 'Phoenix',
        venue_state: 'AZ', venue_country: 'US', venue_address: '401 W Van Buren St',
        lat: 33.4484, lng: -112.0740,
      },
      {
        stop_id: 's-003', tour_id: 'tour-001', gig_id: 'g-003',
        stop_order: 3,
        leg_miles: 372, leg_drive_hrs: 6.8, leg_mode: 'drive', leg_notes: null,
        gig_title: 'Fillmore Friday', gig_date: '2025-05-22',
        start_time: '21:00', gig_status: 'inquiry',
        deal_type: 'guarantee_vs_door', deal_amount: '1500',
        venue_id: 'v-003', venue_name: 'The Fillmore SF', venue_city: 'San Francisco',
        venue_state: 'CA', venue_country: 'US', venue_address: '1805 Geary Blvd',
        lat: 37.7833, lng: -122.4333,
      },
      {
        stop_id: 's-004', tour_id: 'tour-001', gig_id: 'g-007',
        stop_order: 4,
        leg_miles: 638, leg_drive_hrs: 11.6, leg_mode: 'drive', leg_notes: null,
        gig_title: 'Roseland Ballroom Portland', gig_date: '2025-05-26',
        start_time: '20:30', gig_status: 'confirmed',
        deal_type: 'flat', deal_amount: '2200',
        venue_id: 'v-007', venue_name: 'Roseland Theater', venue_city: 'Portland',
        venue_state: 'OR', venue_country: 'US', venue_address: '8 NW 6th Ave',
        lat: 45.5231, lng: -122.6765,
      },
      {
        stop_id: 's-005', tour_id: 'tour-001', gig_id: 'g-002',
        stop_order: 5,
        leg_miles: 174, leg_drive_hrs: 3.2, leg_mode: 'drive', leg_notes: 'Easy drive — take I-5 N',
        gig_title: 'Neumos Night — Seattle', gig_date: '2025-06-01',
        start_time: '21:00', gig_status: 'confirmed',
        deal_type: 'flat', deal_amount: '3000',
        venue_id: 'v-002', venue_name: 'Neumos', venue_city: 'Seattle',
        venue_state: 'WA', venue_country: 'US', venue_address: '925 E Pike St',
        lat: 47.6131, lng: -122.3201,
      },
    ],
  },
  {
    id: 'tour-002',
    band_id: 'band-001',
    name: 'Mountain States Circuit',
    description: 'Rocky Mountain run — Denver through the intermountain west.',
    status: 'planning',
    color: '#4a8cff',
    start_date: '2025-08-10',
    end_date: '2025-08-22',
    total_miles: 891,
    total_shows: 3,
    home_city: 'Austin, TX',
    home_lat: 30.2672,
    home_lng: -97.7431,
    stop_count: 3,
    stops: [
      {
        stop_id: 's-006', tour_id: 'tour-002', gig_id: 'g-004',
        stop_order: 1,
        leg_miles: null, leg_drive_hrs: null, leg_mode: 'drive', leg_notes: null,
        gig_title: 'Red Rocks After Party', gig_date: '2025-08-10',
        start_time: '22:00', gig_status: 'confirmed',
        deal_type: 'flat', deal_amount: '3500',
        venue_id: 'v-004', venue_name: 'Globe Hall', venue_city: 'Denver',
        venue_state: 'CO', venue_country: 'US', venue_address: '4483 Logan St',
        lat: 39.7840, lng: -104.9712,
      },
      {
        stop_id: 's-007', tour_id: 'tour-002', gig_id: 'g-008',
        stop_order: 2,
        leg_miles: 441, leg_drive_hrs: 8.0, leg_mode: 'drive', leg_notes: null,
        gig_title: 'Phoenix Summer Slam', gig_date: '2025-08-15',
        start_time: '20:00', gig_status: 'inquiry',
        deal_type: 'flat', deal_amount: '1500',
        venue_id: 'v-006', venue_name: 'The Van Buren', venue_city: 'Phoenix',
        venue_state: 'AZ', venue_country: 'US', venue_address: '401 W Van Buren St',
        lat: 33.4484, lng: -112.0740,
      },
      {
        stop_id: 's-008', tour_id: 'tour-002', gig_id: 'g-005',
        stop_order: 3,
        leg_miles: 595, leg_drive_hrs: 10.8, leg_mode: 'drive', leg_notes: null,
        gig_title: 'Local Warm-Up Show', gig_date: '2025-08-22',
        start_time: '20:00', gig_status: 'confirmed',
        deal_type: 'flat', deal_amount: '500',
        venue_id: 'v-005', venue_name: 'The Echo', venue_city: 'Los Angeles',
        venue_state: 'CA', venue_country: 'US', venue_address: '1822 Sunset Blvd',
        lat: 34.0764, lng: -118.2606,
      },
    ],
  },
];

export const UNGROUPED_GIGS = [
  { id: 'g-009', title: 'Nashville Country Club Show', gig_date: '2025-09-05', gig_status: 'confirmed', venue_name: 'The Bluebird Cafe', venue_city: 'Nashville', venue_state: 'TN', lat: 36.1156, lng: -86.8325 },
  { id: 'g-010', title: 'Chicago Roundup', gig_date: '2025-09-12', gig_status: 'inquiry', venue_name: 'Empty Bottle', venue_city: 'Chicago', venue_state: 'IL', lat: 41.8894, lng: -87.6763 },
  { id: 'g-011', title: 'New York City Headline', gig_date: '2025-09-20', gig_status: 'confirmed', venue_name: 'Brooklyn Steel', venue_city: 'New York', venue_state: 'NY', lat: 40.7285, lng: -73.9440 },
];

// ─── API Functions ────────────────────────────────────────────────────────────
export const apiGetTours = async () => { await delay(); return JSON.parse(JSON.stringify(MOCK_TOURS)); };

export const apiGetTour = async (id) => {
  await delay();
  const tour = MOCK_TOURS.find(t => t.id === id);
  return tour ? JSON.parse(JSON.stringify(tour)) : null;
};

export const apiGetMapData = async (id) => {
  await delay(200);
  const tour = MOCK_TOURS.find(t => t.id === id);
  if (!tour) return null;
  const totalMiles    = tour.stops.reduce((s, st) => s + (st.leg_miles || 0), 0);
  const totalDriveHrs = tour.stops.reduce((s, st) => s + (st.leg_drive_hrs || 0), 0);
  return {
    tour: { ...tour },
    stops: tour.stops,
    stats: {
      total_miles:     Math.round(totalMiles),
      total_drive_hrs: +totalDriveHrs.toFixed(1),
      stop_count:      tour.stops.length,
    },
  };
};

export const apiCreateTour = async (data) => {
  await delay(400);
  const tour = { ...data, id: uid(), stops: [], stop_count: 0, total_miles: 0, total_shows: 0, status: 'planning' };
  MOCK_TOURS.push(tour);
  return tour;
};

export const apiUpdateTour = async (id, data) => {
  await delay(300);
  const idx = MOCK_TOURS.findIndex(t => t.id === id);
  if (idx < 0) throw new Error('Tour not found');
  Object.assign(MOCK_TOURS[idx], data);
  return MOCK_TOURS[idx];
};

export const apiDeleteTour = async (id) => {
  await delay(300);
  const idx = MOCK_TOURS.findIndex(t => t.id === id);
  if (idx >= 0) MOCK_TOURS.splice(idx, 1);
};

export const apiAddStop = async (tourId, gigId) => {
  await delay(400);
  const tour = MOCK_TOURS.find(t => t.id === tourId);
  if (!tour) throw new Error('Tour not found');
  const gig = UNGROUPED_GIGS.find(g => g.id === gigId);
  if (gig) {
    const stop = {
      stop_id: uid(), tour_id: tourId, gig_id: gigId,
      stop_order: tour.stops.length + 1,
      leg_miles: null, leg_drive_hrs: null, leg_mode: 'drive', leg_notes: null,
      gig_title: gig.title, gig_date: gig.gig_date, gig_status: gig.gig_status,
      venue_name: gig.venue_name, venue_city: gig.venue_city, venue_state: gig.venue_state,
      lat: gig.lat, lng: gig.lng,
    };
    tour.stops.push(stop);
    tour.stop_count = tour.stops.length;
  }
  return tour.stops;
};

export const apiRemoveStop = async (tourId, gigId) => {
  await delay(300);
  const tour = MOCK_TOURS.find(t => t.id === tourId);
  if (tour) {
    tour.stops = tour.stops.filter(s => s.gig_id !== gigId);
    tour.stops.forEach((s, i) => { s.stop_order = i + 1; });
    tour.stop_count = tour.stops.length;
  }
  return tour?.stops || [];
};

export const apiGetUngroupedGigs = async () => { await delay(); return [...UNGROUPED_GIGS]; };

// Format helpers
export const fmtMiles = (m) => m ? `${Math.round(m).toLocaleString()} mi` : '—';
export const fmtDriveTime = (hrs) => {
  if (!hrs) return '—';
  const h = Math.floor(hrs);
  const m = Math.round((hrs - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};
export const fmtDate = (d) => d ? new Date(d + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
export const fmtDateShort = (d) => d ? new Date(d + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
