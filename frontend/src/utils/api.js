// frontend/src/utils/api.js
// Central API helper. On Vercel, the React app and the Express API live on the
// same domain, so all calls go to /api/... with no CORS or cross-origin tokens.
// Locally (npm start), CRA's proxy forwards /api/* to localhost:4000.

const BASE = '/api';

// authFetch is injected by AuthContext so token refresh happens transparently.
// Direct callers that don't need auth can import `apiFetch` below.

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || `HTTP ${res.status}`), { status: res.status });
  }
  // 204 No Content
  if (res.status === 204) return null;
  return res.json();
}

// ── Gigs ──────────────────────────────────────────────────────────────────────
export const gigsApi = {
  list:   (bandId, params = {}) => apiFetch(`/gigs?band_id=${bandId}&${new URLSearchParams(params)}`),
  get:    (id)                  => apiFetch(`/gigs/${id}`),
  create: (data)                => apiFetch('/gigs',     { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data)            => apiFetch(`/gigs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id)                  => apiFetch(`/gigs/${id}`, { method: 'DELETE' }),
};

// ── Venues ────────────────────────────────────────────────────────────────────
export const venuesApi = {
  list:   (bandId) => apiFetch(`/venues?band_id=${bandId}`),
  get:    (id)     => apiFetch(`/venues/${id}`),
  create: (data)   => apiFetch('/venues',      { method: 'POST',  body: JSON.stringify(data) }),
  update: (id, d)  => apiFetch(`/venues/${id}`, { method: 'PATCH', body: JSON.stringify(d) }),
  remove: (id)     => apiFetch(`/venues/${id}`, { method: 'DELETE' }),
};

// ── Tours ─────────────────────────────────────────────────────────────────────
export const toursApi = {
  list:      (bandId) => apiFetch(`/tours?band_id=${bandId}`),
  get:       (id)     => apiFetch(`/tours/${id}`),
  mapData:   (id)     => apiFetch(`/tours/${id}/map-data`),
  create:    (data)   => apiFetch('/tours',       { method: 'POST',  body: JSON.stringify(data) }),
  update:    (id, d)  => apiFetch(`/tours/${id}`,  { method: 'PATCH', body: JSON.stringify(d) }),
  remove:    (id)     => apiFetch(`/tours/${id}`,  { method: 'DELETE' }),
  addStop:   (id, d)  => apiFetch(`/tours/${id}/stops`,        { method: 'POST', body: JSON.stringify(d) }),
  removeStop:(id, gigId) => apiFetch(`/tours/${id}/stops/${gigId}`, { method: 'DELETE' }),
  reorder:   (id, d)  => apiFetch(`/tours/${id}/stops/reorder`, { method: 'PUT',  body: JSON.stringify(d) }),
  geocodeAll:(id)     => apiFetch(`/tours/${id}/geocode-all`,   { method: 'POST' }),
};

// ── Collaboration ─────────────────────────────────────────────────────────────
export const collabApi = {
  participants: (gigId)       => apiFetch(`/gigs/${gigId}/participants`),
  rsvp:         (gigId, data) => apiFetch(`/gigs/${gigId}/rsvp`,  { method: 'PUT',  body: JSON.stringify(data) }),
  comments:     (gigId)       => apiFetch(`/comments?gig_id=${gigId}`),
  addComment:   (data)        => apiFetch('/comments',             { method: 'POST', body: JSON.stringify(data) }),
  editComment:  (id, data)    => apiFetch(`/comments/${id}`,       { method: 'PATCH',body: JSON.stringify(data) }),
  deleteComment:(id)          => apiFetch(`/comments/${id}`,       { method: 'DELETE' }),
  pinComment:   (id)          => apiFetch(`/comments/${id}/pin`,   { method: 'POST' }),
  react:        (id, emoji)   => apiFetch(`/comments/${id}/react`, { method: 'POST', body: JSON.stringify({ emoji }) }),
  activity:     (gigId)       => apiFetch(`/gigs/${gigId}/activity`),
};

// ── Analytics ─────────────────────────────────────────────────────────────────
export const analyticsApi = {
  summary:    (bandId) => apiFetch(`/analytics/summary?band_id=${bandId}`),
  byMonth:    (bandId) => apiFetch(`/analytics/gigs-by-month?band_id=${bandId}`),
  topVenues:  (bandId) => apiFetch(`/analytics/top-venues?band_id=${bandId}`),
  revenue:    (bandId) => apiFetch(`/analytics/revenue?band_id=${bandId}`),
  distance:   (bandId) => apiFetch(`/analytics/distance?band_id=${bandId}`),
  heatmap:    (bandId) => apiFetch(`/analytics/heatmap?band_id=${bandId}`),
  financial:  (bandId, type) => apiFetch(`/analytics/financial?band_id=${bandId}${type ? `&type=${type}` : ''}`),
  addRecord:  (data)   => apiFetch('/analytics/financial', { method: 'POST',   body: JSON.stringify(data) }),
  delRecord:  (id)     => apiFetch(`/analytics/financial/${id}`, { method: 'DELETE' }),
};

// ── Export ────────────────────────────────────────────────────────────────────
export const exportApi = {
  preview:      (params) => apiFetch(`/export/preview?${new URLSearchParams(params)}`),
  gigIcal:      (id)     => `${BASE}/export/gig/${id}/ical`,
  gigGoogle:    (id)     => apiFetch(`/export/gig/${id}/google`).then(r => r.url),
  allGigsIcal:  (bandId) => `${BASE}/export/gigs/ical?band_id=${bandId}`,
  tourIcal:     (id)     => `${BASE}/export/tour/${id}/ical`,
  tourGoogle:   (id)     => apiFetch(`/export/tour/${id}/google`).then(r => r.url),
};

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationsApi = {
  getPrefs:    (bandId) => apiFetch(`/notifications/preferences/${bandId}`),
  savePrefs:   (bandId, d) => apiFetch(`/notifications/preferences/${bandId}`, { method: 'PUT', body: JSON.stringify(d) }),
  history:     ()       => apiFetch('/notifications/history'),
  subscribe:   (sub)    => apiFetch('/notifications/push/subscribe',  { method: 'POST',   body: JSON.stringify(sub) }),
  unsubscribe: (sub)    => apiFetch('/notifications/push/subscribe',  { method: 'DELETE', body: JSON.stringify(sub) }),
  sendNow:     (gigId)  => apiFetch(`/notifications/send-now/${gigId}`, { method: 'POST' }),
};
