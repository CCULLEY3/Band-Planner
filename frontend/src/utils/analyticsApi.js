// frontend/src/utils/analyticsApi.js
// Mock data layer — replace fetch calls with real axios calls in production.

const delay = (ms = 280) => new Promise(r => setTimeout(r, ms));

// ─── Helpers ──────────────────────────────────────────────────────────────────
const rnd = (min, max) => Math.round(min + Math.random() * (max - min));
const fmtCurrency = (n, compact = false) => {
  const num = parseFloat(n) || 0;
  if (compact && num >= 1000) return `$${(num / 1000).toFixed(1)}k`;
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};
const fmtMiles = (m) => `${Math.round(m).toLocaleString()} mi`;
const fmtDate  = (d) => d ? new Date(d + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

// ─── Deterministic seed so charts look the same every render ─────────────────
const SEED_MONTHS = [
  { month: '2024-06', label: "Jun '24", gig_count: 2, confirmed: 2, revenue: 4100, expenses: 620, net: 3480 },
  { month: '2024-07', label: "Jul '24", gig_count: 3, confirmed: 3, revenue: 6200, expenses: 890, net: 5310 },
  { month: '2024-08', label: "Aug '24", gig_count: 4, confirmed: 3, revenue: 7850, expenses: 1240, net: 6610 },
  { month: '2024-09', label: "Sep '24", gig_count: 3, confirmed: 3, revenue: 5900, expenses: 780, net: 5120 },
  { month: '2024-10', label: "Oct '24", gig_count: 5, confirmed: 4, revenue: 9400, expenses: 1380, net: 8020 },
  { month: '2024-11', label: "Nov '24", gig_count: 4, confirmed: 4, revenue: 8100, expenses: 1050, net: 7050 },
  { month: '2024-12', label: "Dec '24", gig_count: 3, confirmed: 3, revenue: 5400, expenses: 820, net: 4580 },
  { month: '2025-01', label: "Jan '25", gig_count: 1, confirmed: 1, revenue: 2200, expenses: 410, net: 1790 },
  { month: '2025-02', label: "Feb '25", gig_count: 2, confirmed: 2, revenue: 3800, expenses: 590, net: 3210 },
  { month: '2025-03', label: "Mar '25", gig_count: 3, confirmed: 2, revenue: 5100, expenses: 780, net: 4320 },
  { month: '2025-04', label: "Apr '25", gig_count: 4, confirmed: 4, revenue: 7200, expenses: 1100, net: 6100 },
  { month: '2025-05', label: "May '25", gig_count: 6, confirmed: 5, revenue: 12400, expenses: 1890, net: 10510 },
];

const SEED_VENUES = [
  { id: 'v1', venue_name: 'The Paramount',   city: 'Austin',       state: 'TX', gig_count: 5, total_revenue: 12500, avg_revenue: 2500, last_played: '2025-05-15' },
  { id: 'v2', venue_name: 'Neumos',           city: 'Seattle',      state: 'WA', gig_count: 4, total_revenue: 12000, avg_revenue: 3000, last_played: '2025-06-01' },
  { id: 'v3', venue_name: 'The Fillmore SF',  city: 'San Francisco', state: 'CA', gig_count: 3, total_revenue: 4500,  avg_revenue: 1500, last_played: '2025-05-22' },
  { id: 'v4', venue_name: 'Globe Hall',       city: 'Denver',       state: 'CO', gig_count: 3, total_revenue: 10500, avg_revenue: 3500, last_played: '2025-08-10' },
  { id: 'v5', venue_name: 'Roseland Theater', city: 'Portland',     state: 'OR', gig_count: 2, total_revenue: 4400,  avg_revenue: 2200, last_played: '2025-05-26' },
  { id: 'v6', venue_name: 'The Van Buren',    city: 'Phoenix',      state: 'AZ', gig_count: 2, total_revenue: 3600,  avg_revenue: 1800, last_played: '2025-08-15' },
  { id: 'v7', venue_name: 'The Echo',         city: 'Los Angeles',  state: 'CA', gig_count: 1, total_revenue: 500,   avg_revenue: 500,  last_played: '2025-08-22' },
];

const SEED_TOURS = [
  { id: 't1', name: 'West Coast Run',         color: '#f0522a', total_miles: 2184, total_shows: 5, start_date: '2025-05-15', end_date: '2025-06-01', status: 'planning', miles_per_show: 546 },
  { id: 't2', name: 'Mountain States Circuit', color: '#4a8cff', total_miles: 891,  total_shows: 3, start_date: '2025-08-10', end_date: '2025-08-22', status: 'planning', miles_per_show: 297 },
];

const SEED_FINANCIAL = [
  { id: 'f1', record_type: 'payment', category: 'guarantee',   amount: 2250,  record_date: '2025-05-15', description: 'Paramount guarantee', gig_title: 'West Coast Kickoff' },
  { id: 'f2', record_type: 'payment', category: 'merch',       amount: 380,   record_date: '2025-05-15', description: 'Merch sales', gig_title: 'West Coast Kickoff' },
  { id: 'f3', record_type: 'expense', category: 'travel',      amount: 145,   record_date: '2025-05-15', description: 'Gas / rideshare', gig_title: 'West Coast Kickoff' },
  { id: 'f4', record_type: 'expense', category: 'food',        amount: 48,    record_date: '2025-05-15', description: 'Dinner before show', gig_title: 'West Coast Kickoff' },
  { id: 'f5', record_type: 'payment', category: 'guarantee',   amount: 2700,  record_date: '2025-06-01', description: 'Neumos guarantee', gig_title: 'Neumos Night' },
  { id: 'f6', record_type: 'payment', category: 'merch',       amount: 420,   record_date: '2025-06-01', description: 'Merch at Neumos', gig_title: 'Neumos Night' },
  { id: 'f7', record_type: 'expense', category: 'travel',      amount: 480,   record_date: '2025-05-08', description: 'Van rental — West Coast run', gig_title: null },
  { id: 'f8', record_type: 'expense', category: 'lodging',     amount: 220,   record_date: '2025-05-09', description: 'Hotel x2 nights', gig_title: null },
  { id: 'f9', record_type: 'payment', category: 'sponsorship', amount: 1000,  record_date: '2025-06-01', description: 'Gear sponsor deal', gig_title: null },
  { id:'f10', record_type: 'expense', category: 'gear',        amount: 350,   record_date: '2025-04-15', description: 'New kick pedal + cables', gig_title: null },
];

let financialRecords = [...SEED_FINANCIAL];
let nextId = 100;

// ─── API functions ────────────────────────────────────────────────────────────
export const apiGetSummary = async () => {
  await delay();
  const totalRevenue  = SEED_MONTHS.reduce((s, m) => s + m.revenue, 0);
  const totalExpenses = SEED_MONTHS.reduce((s, m) => s + m.expenses, 0);
  const totalGigs     = SEED_MONTHS.reduce((s, m) => s + m.gig_count, 0);
  return {
    total_gigs: totalGigs,
    confirmed_gigs: 35,
    inquiry_gigs: 7,
    unique_venues: SEED_VENUES.length,
    total_tours: SEED_TOURS.length,
    total_revenue: totalRevenue,
    total_expenses: totalExpenses,
    net_income: totalRevenue - totalExpenses,
    avg_payment: Math.round(totalRevenue / totalGigs),
    total_miles: SEED_TOURS.reduce((s, t) => s + t.total_miles, 0),
    this_year_gigs: 19,
    last_year_gigs: 14,
    yoy_change: 35.7,
  };
};

export const apiGetGigsByMonth = async () => { await delay(); return SEED_MONTHS; };
export const apiGetTopVenues   = async () => { await delay(); return SEED_VENUES; };
export const apiGetRevenue     = async () => {
  await delay();
  return {
    monthly: SEED_MONTHS.map(m => ({
      month: m.month, label: m.label,
      income: m.revenue, expenses: m.expenses,
    })),
    byCategory: [
      { category: 'guarantee',   record_type: 'payment', cnt: 18, total: 45200 },
      { category: 'merch',       record_type: 'payment', cnt: 18, total: 8400  },
      { category: 'sponsorship', record_type: 'payment', cnt: 1,  total: 1000  },
      { category: 'travel',      record_type: 'expense', cnt: 20, total: 6800  },
      { category: 'food',        record_type: 'expense', cnt: 18, total: 1440  },
      { category: 'gear',        record_type: 'expense', cnt: 7,  total: 1890  },
      { category: 'lodging',     record_type: 'expense', cnt: 3,  total: 660   },
      { category: 'promo',       record_type: 'expense', cnt: 5,  total: 375   },
    ],
    topGigs: [
      { id: 'g1', title: 'Neumos Night',        gig_date: '2025-06-01', actual_payment: 3000, venue_name: 'Neumos',       city: 'Seattle' },
      { id: 'g2', title: 'Red Rocks After Party',gig_date: '2025-08-10', actual_payment: 2800, venue_name: 'Globe Hall',   city: 'Denver'  },
      { id: 'g3', title: 'West Coast Kickoff',   gig_date: '2025-05-15', actual_payment: 2500, venue_name: 'The Paramount',city: 'Austin'  },
      { id: 'g4', title: 'Roseland Ballroom',    gig_date: '2025-05-26', actual_payment: 2200, venue_name: 'Roseland',     city: 'Portland'},
      { id: 'g5', title: 'Phoenix Stopover',     gig_date: '2025-05-18', actual_payment: 1800, venue_name: 'The Van Buren',city: 'Phoenix' },
    ],
  };
};
export const apiGetDistance = async () => {
  await delay();
  return { tours: SEED_TOURS, total_miles: SEED_TOURS.reduce((s, t) => s + t.total_miles, 0) };
};
export const apiGetHeatmap = async () => {
  await delay(150);
  // Generate 52 weeks of gig activity
  const result = [];
  const base = new Date(); base.setDate(base.getDate() - 364);
  for (let i = 0; i < 365; i++) {
    const d = new Date(base); d.setDate(base.getDate() + i);
    // Weighted random: weekends more likely, summer heavier
    const dow = d.getDay();
    const mon = d.getMonth();
    const weekendBoost = (dow === 5 || dow === 6) ? 3 : 1;
    const summerBoost  = (mon >= 4 && mon <= 9) ? 2 : 1;
    if (Math.random() < 0.08 * weekendBoost * summerBoost) {
      result.push({ date: d.toISOString().slice(0,10), count: Math.random() < 0.1 ? 2 : 1 });
    }
  }
  return result;
};
export const apiGetFinancial = async () => { await delay(150); return [...financialRecords]; };
export const apiCreateFinancial = async (data) => {
  await delay(400);
  const record = { ...data, id: `f${++nextId}`, created_at: new Date().toISOString() };
  financialRecords = [record, ...financialRecords];
  return record;
};
export const apiDeleteFinancial = async (id) => {
  await delay(300);
  financialRecords = financialRecords.filter(r => r.id !== id);
};

export { fmtCurrency, fmtMiles, fmtDate };
