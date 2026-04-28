// frontend/src/pages/TourMapPage.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  apiGetTours, apiGetMapData, apiCreateTour, apiUpdateTour,
  apiDeleteTour, apiAddStop, apiRemoveStop, apiGetUngroupedGigs,
  fmtMiles, fmtDriveTime, fmtDate, fmtDateShort,
} from '../utils/tourApi';
import './TourMapPage.css';

// ─── Leaflet must be imported dynamically in React to avoid SSR issues ─────────
// We use CDN versions loaded in index.html; access via window.L

const STATUS_COLORS = {
  confirmed: '#29cc6a',
  inquiry:   '#f5c842',
  cancelled: '#ff4a4a',
  completed: '#5a5a72',
};
const STATUS_LABELS = { confirmed: 'Confirmed', inquiry: 'Inquiry', cancelled: 'Cancelled', completed: 'Completed' };

// ─── Leaflet Map Component ────────────────────────────────────────────────────
function TourMap({ stops, tourColor, homeCity, onStopClick, activeStopId }) {
  const mapRef     = useRef(null);
  const leafletRef = useRef(null);
  const markersRef = useRef([]);
  const linesRef   = useRef([]);

  useEffect(() => {
    if (!window.L || !mapRef.current) return;
    if (leafletRef.current) return; // already initialised

    const L = window.L;

    // Dark tile layer — CartoDB DarkMatter (free, no API key)
    const map = L.map(mapRef.current, {
      center: [39.5, -98.35],
      zoom: 4,
      zoomControl: false,
      attributionControl: true,
    });

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }
    ).addTo(map);

    // Custom zoom position
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    leafletRef.current = map;

    return () => {
      map.remove();
      leafletRef.current = null;
    };
  }, []); // eslint-disable-line

  // Update markers + route whenever stops change
  useEffect(() => {
    const L = window.L;
    const map = leafletRef.current;
    if (!L || !map) return;

    // Clear existing
    markersRef.current.forEach(m => m.remove());
    linesRef.current.forEach(l => l.remove());
    markersRef.current = [];
    linesRef.current = [];

    const validStops = stops.filter(s => s.lat && s.lng);
    if (!validStops.length) return;

    // Draw route polyline
    if (validStops.length >= 2) {
      const coords = validStops.map(s => [s.lat, s.lng]);
      const line = L.polyline(coords, {
        color: tourColor || '#f0522a',
        weight: 2.5,
        opacity: 0.7,
        dashArray: '8 6',
        lineJoin: 'round',
      }).addTo(map);
      linesRef.current.push(line);
    }

    // Draw numbered markers
    validStops.forEach((stop, i) => {
      const isActive = stop.stop_id === activeStopId || stop.gig_id === activeStopId;
      const statusColor = STATUS_COLORS[stop.gig_status] || '#5a5a72';
      const num = stop.stop_order || i + 1;

      // Custom SVG pin
      const svgPin = `
        <svg width="36" height="44" viewBox="0 0 36 44" xmlns="http://www.w3.org/2000/svg">
          <filter id="s${num}" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.6)"/>
          </filter>
          <path d="M18 2C10.268 2 4 8.268 4 16c0 10 14 26 14 26S32 26 32 16C32 8.268 25.732 2 18 2z"
                fill="${isActive ? '#ffffff' : '#131316'}"
                stroke="${isActive ? tourColor || '#f0522a' : statusColor}"
                stroke-width="${isActive ? 3 : 2}"
                filter="url(#s${num})"/>
          <circle cx="18" cy="16" r="9"
                  fill="${statusColor}"
                  opacity="${isActive ? 1 : 0.85}"/>
          <text x="18" y="20.5" text-anchor="middle"
                font-family="'Bebas Neue', monospace" font-size="11"
                fill="white" font-weight="bold">${num}</text>
        </svg>
      `;

      const icon = L.divIcon({
        className: '',
        html: svgPin,
        iconSize: [36, 44],
        iconAnchor: [18, 44],
        popupAnchor: [0, -44],
      });

      const marker = L.marker([stop.lat, stop.lng], { icon, zIndexOffset: isActive ? 1000 : 0 })
        .addTo(map);

      // Hover tooltip
      marker.bindTooltip(`
        <div class="map-tooltip">
          <div class="mt-stop">#${num} · ${stop.venue_city}, ${stop.venue_state}</div>
          <div class="mt-title">${stop.gig_title}</div>
          <div class="mt-date">${fmtDateShort(stop.gig_date)}</div>
          <div class="mt-venue">${stop.venue_name}</div>
        </div>
      `, { className: 'custom-tooltip', direction: 'top', offset: [0, -44] });

      marker.on('click', () => onStopClick(stop));

      if (isActive) {
        marker.openTooltip();
      }

      markersRef.current.push(marker);
    });

    // Fit bounds
    if (validStops.length === 1) {
      map.setView([validStops[0].lat, validStops[0].lng], 10);
    } else {
      const group = L.featureGroup(markersRef.current);
      map.fitBounds(group.getBounds().pad(0.12));
    }
  }, [stops, tourColor, activeStopId, onStopClick]);

  return <div ref={mapRef} id="tour-map" className="tour-map-canvas" />;
}

// ─── Stop Card in Sequence ───────────────────────────────────────────────────
function StopCard({ stop, index, isActive, onClick, onRemove, isLast }) {
  return (
    <div className={`stop-card ${isActive ? 'active' : ''}`} onClick={onClick}>
      {/* Leg info (travel from previous) */}
      {index > 0 && (
        <div className="leg-connector">
          <div className="leg-line" />
          <div className="leg-info">
            <span className="leg-icon">🚗</span>
            <span className="leg-dist">{fmtMiles(stop.leg_miles)}</span>
            <span className="leg-sep">·</span>
            <span className="leg-time">{fmtDriveTime(stop.leg_drive_hrs)}</span>
          </div>
        </div>
      )}

      {/* Stop body */}
      <div className="stop-body">
        <div className="stop-num-wrap">
          <div
            className="stop-num"
            style={{ background: STATUS_COLORS[stop.gig_status] || '#5a5a72' }}
          >
            {stop.stop_order}
          </div>
        </div>
        <div className="stop-info">
          <div className="stop-header">
            <span className="stop-city">{stop.venue_city}, {stop.venue_state}</span>
            <span
              className="stop-status"
              style={{ color: STATUS_COLORS[stop.gig_status] || '#5a5a72' }}
            >
              {STATUS_LABELS[stop.gig_status] || stop.gig_status}
            </span>
          </div>
          <div className="stop-title">{stop.gig_title}</div>
          <div className="stop-meta">
            <span className="stop-venue">{stop.venue_name}</span>
            <span className="stop-meta-sep">·</span>
            <span className="stop-date">{fmtDateShort(stop.gig_date)}</span>
            {stop.deal_amount && (
              <>
                <span className="stop-meta-sep">·</span>
                <span className="stop-deal">${Number(stop.deal_amount).toLocaleString()}</span>
              </>
            )}
          </div>
        </div>
        <button
          className="stop-remove"
          onClick={(e) => { e.stopPropagation(); onRemove(stop.gig_id); }}
          title="Remove from tour"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ─── Tour Stats Bar ──────────────────────────────────────────────────────────
function TourStatsBar({ stats, tour }) {
  const confirmed = (tour.stops || []).filter(s => s.gig_status === 'confirmed').length;
  return (
    <div className="tour-stats-bar">
      {[
        { label: 'Shows',       value: stats.stop_count || '—' },
        { label: 'Confirmed',   value: confirmed,              color: '#29cc6a' },
        { label: 'Total Miles', value: fmtMiles(stats.total_miles) },
        { label: 'Drive Time',  value: fmtDriveTime(stats.total_drive_hrs) },
      ].map(s => (
        <div key={s.label} className="tour-stat">
          <div className="ts-value" style={s.color ? { color: s.color } : {}}>{s.value}</div>
          <div className="ts-label">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Create Tour Modal ───────────────────────────────────────────────────────
function CreateTourModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', description: '', color: '#f0522a', home_city: '' });
  const [saving, setSaving] = useState(false);

  const COLORS = ['#f0522a','#4a8cff','#29cc6a','#f5c842','#c44aff','#ff6b6b','#00c9b1'];

  const handle = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onCreate(form);
    setSaving(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">New Tour</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handle} className="modal-form">
          <div className="form-group">
            <label>Tour Name *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="West Coast Run 2025"
              required autoFocus
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="A brief description of this tour…"
              rows={2}
            />
          </div>
          <div className="form-group">
            <label>Home City</label>
            <input
              value={form.home_city}
              onChange={e => setForm(f => ({ ...f, home_city: e.target.value }))}
              placeholder="Austin, TX"
            />
          </div>
          <div className="form-group">
            <label>Tour Color</label>
            <div className="color-picker">
              {COLORS.map(c => (
                <button
                  key={c} type="button"
                  className={`color-swatch ${form.color === c ? 'selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                />
              ))}
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !form.name}>
              {saving ? 'Creating…' : 'Create Tour'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TourMapPage() {
  const [tours, setTours]           = useState([]);
  const [selectedTour, setSelected] = useState(null);
  const [mapData, setMapData]       = useState(null);
  const [activeStop, setActiveStop] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [mapLoading, setMapLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast]           = useState(null);
  const [sidePanel, setSidePanel]   = useState('sequence'); // sequence | add-gig
  const [ungrouped, setUngrouped]   = useState([]);
  const [leafletReady, setLeafletReady] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Dynamically load Leaflet CSS + JS
  useEffect(() => {
    if (window.L) { setLeafletReady(true); return; }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => setLeafletReady(true);
    document.head.appendChild(script);

    return () => {
      // Leave Leaflet loaded for subsequent visits
    };
  }, []);

  const loadTours = async () => {
    const data = await apiGetTours();
    setTours(data);
    if (data.length && !selectedTour) {
      setSelected(data[0]);
    }
    setLoading(false);
  };

  useEffect(() => { loadTours(); }, []); // eslint-disable-line

  const loadMapData = useCallback(async (tourId) => {
    setMapLoading(true);
    const data = await apiGetMapData(tourId);
    setMapData(data);
    setMapLoading(false);
  }, []);

  useEffect(() => {
    if (selectedTour) {
      loadMapData(selectedTour.id);
      setActiveStop(null);
    }
  }, [selectedTour?.id]); // eslint-disable-line

  const handleSelectTour = (tour) => {
    setSelected(tour);
    setSidePanel('sequence');
  };

  const handleStopClick = (stop) => {
    setActiveStop(s => s?.stop_id === stop.stop_id ? null : stop);
    setSidePanel('sequence');
  };

  const handleAddStop = async (gigId) => {
    if (!selectedTour) return;
    try {
      await apiAddStop(selectedTour.id, gigId);
      await loadMapData(selectedTour.id);
      await loadTours();
      showToast('Stop added to tour!');
    } catch (err) {
      showToast('Failed to add stop', 'error');
    }
  };

  const handleRemoveStop = async (gigId) => {
    if (!selectedTour || !window.confirm('Remove this stop from the tour?')) return;
    try {
      await apiRemoveStop(selectedTour.id, gigId);
      await loadMapData(selectedTour.id);
      await loadTours();
      showToast('Stop removed');
    } catch (err) {
      showToast('Failed to remove stop', 'error');
    }
  };

  const handleCreateTour = async (form) => {
    try {
      const tour = await apiCreateTour({ ...form, band_id: 'band-001' });
      await loadTours();
      setSelected(tour);
      showToast('Tour created!');
    } catch (err) {
      showToast('Failed to create tour', 'error');
    }
  };

  const handleDeleteTour = async () => {
    if (!selectedTour || !window.confirm(`Delete "${selectedTour.name}"? This cannot be undone.`)) return;
    try {
      await apiDeleteTour(selectedTour.id);
      setSelected(null);
      setMapData(null);
      await loadTours();
      showToast('Tour deleted');
    } catch (err) {
      showToast('Failed to delete', 'error');
    }
  };

  const handleShowAddGig = async () => {
    setSidePanel('add-gig');
    const data = await apiGetUngroupedGigs();
    setUngrouped(data);
  };

  const stops = mapData?.stops || [];
  const stats = mapData?.stats || {};

  if (loading) {
    return (
      <div className="page tour-page loading-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="tour-page">
      {toast && (
        <div className={`tour-toast ${toast.type}`}>
          {toast.type === 'error' ? '❌' : '✅'} {toast.msg}
        </div>
      )}

      {showCreate && (
        <CreateTourModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreateTour}
        />
      )}

      {/* ── Three-column layout: tour list | map | sequence sidebar ── */}
      <div className="tour-layout">

        {/* ── Left: Tour List ── */}
        <div className="tour-list-panel">
          <div className="tlp-header">
            <div className="tlp-title">Tours</div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
              + New
            </button>
          </div>

          <div className="tlp-tours">
            {tours.map(tour => (
              <div
                key={tour.id}
                className={`tour-list-item ${selectedTour?.id === tour.id ? 'active' : ''}`}
                onClick={() => handleSelectTour(tour)}
              >
                <div className="tli-accent" style={{ background: tour.color }} />
                <div className="tli-body">
                  <div className="tli-name">{tour.name}</div>
                  <div className="tli-meta">
                    {tour.stop_count || 0} stops
                    {tour.total_miles > 0 && ` · ${fmtMiles(tour.total_miles)}`}
                  </div>
                  <div className="tli-dates">
                    {fmtDate(tour.start_date)}
                    {tour.end_date && tour.start_date !== tour.end_date && ` → ${fmtDate(tour.end_date)}`}
                  </div>
                  <div className="tli-status-dot" style={{ background: tour.color }} />
                </div>
              </div>
            ))}

            {tours.length === 0 && (
              <div className="tlp-empty">
                <div className="tlp-empty-icon">🗺</div>
                <div>No tours yet</div>
                <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
                  Create your first tour
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Center: Map ── */}
        <div className="tour-map-panel">
          {selectedTour ? (
            <>
              <div className="map-header">
                <div className="map-tour-name">
                  <span
                    className="map-tour-dot"
                    style={{ background: selectedTour.color }}
                  />
                  {selectedTour.name}
                  <span className="map-tour-status">{selectedTour.status}</span>
                </div>
                {mapData && (
                  <TourStatsBar stats={stats} tour={{ ...selectedTour, stops }} />
                )}
              </div>

              <div className="map-container">
                {leafletReady ? (
                  <TourMap
                    stops={stops}
                    tourColor={selectedTour.color}
                    homeCity={selectedTour.home_city}
                    onStopClick={handleStopClick}
                    activeStopId={activeStop?.stop_id}
                  />
                ) : (
                  <div className="map-loading">
                    <div className="spinner" />
                    <div>Loading map…</div>
                  </div>
                )}

                {mapLoading && (
                  <div className="map-overlay-loading">
                    <div className="spinner" style={{ width: 24, height: 24, borderWidth: 3 }} />
                  </div>
                )}

                {/* Active stop popup overlay */}
                {activeStop && (
                  <div className="map-stop-popup" key={activeStop.stop_id}>
                    <button className="popup-close" onClick={() => setActiveStop(null)}>✕</button>
                    <div className="popup-num" style={{ background: STATUS_COLORS[activeStop.gig_status] }}>
                      #{activeStop.stop_order}
                    </div>
                    <div className="popup-title">{activeStop.gig_title}</div>
                    <div className="popup-venue">{activeStop.venue_name}</div>
                    <div className="popup-city">{activeStop.venue_city}, {activeStop.venue_state}</div>
                    <div className="popup-date">{fmtDate(activeStop.gig_date)}</div>
                    {activeStop.start_time && (
                      <div className="popup-time">Doors: {activeStop.start_time}</div>
                    )}
                    {activeStop.leg_miles && (
                      <div className="popup-leg">
                        <span>🚗 {fmtMiles(activeStop.leg_miles)}</span>
                        <span className="popup-leg-sep">·</span>
                        <span>{fmtDriveTime(activeStop.leg_drive_hrs)} from prev stop</span>
                      </div>
                    )}
                    {activeStop.deal_amount && (
                      <div className="popup-deal">${Number(activeStop.deal_amount).toLocaleString()}</div>
                    )}
                    <div
                      className="popup-status"
                      style={{ color: STATUS_COLORS[activeStop.gig_status] }}
                    >
                      {STATUS_LABELS[activeStop.gig_status]}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="map-empty">
              <div className="map-empty-icon">🗺</div>
              <div className="map-empty-title">Select a tour to see the map</div>
              <div className="map-empty-sub">Or create a new tour and start adding gigs</div>
              <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                + Create Tour
              </button>
            </div>
          )}
        </div>

        {/* ── Right: Sequence / Add Gig Sidebar ── */}
        <div className="tour-seq-panel">
          {selectedTour ? (
            <>
              <div className="seq-header">
                <div className="seq-tabs">
                  <button
                    className={`seq-tab ${sidePanel === 'sequence' ? 'active' : ''}`}
                    onClick={() => setSidePanel('sequence')}
                  >
                    Sequence
                  </button>
                  <button
                    className={`seq-tab ${sidePanel === 'add-gig' ? 'active' : ''}`}
                    onClick={handleShowAddGig}
                  >
                    + Add Gig
                  </button>
                </div>
                <button
                  className="btn btn-ghost btn-sm tour-delete-btn"
                  onClick={handleDeleteTour}
                  title="Delete tour"
                >
                  🗑
                </button>
              </div>

              {sidePanel === 'sequence' && (
                <div className="seq-body">
                  {stops.length === 0 ? (
                    <div className="seq-empty">
                      <div className="seq-empty-icon">📍</div>
                      <div>No stops yet</div>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={handleShowAddGig}
                      >
                        Add your first stop
                      </button>
                    </div>
                  ) : (
                    <>
                      {stops.map((stop, i) => (
                        <StopCard
                          key={stop.stop_id}
                          stop={stop}
                          index={i}
                          isActive={activeStop?.stop_id === stop.stop_id}
                          onClick={() => handleStopClick(stop)}
                          onRemove={handleRemoveStop}
                          isLast={i === stops.length - 1}
                        />
                      ))}

                      {/* Tour summary */}
                      <div className="seq-summary">
                        <div className="seq-sum-row">
                          <span>Total distance</span>
                          <span className="seq-sum-val">{fmtMiles(stats.total_miles)}</span>
                        </div>
                        <div className="seq-sum-row">
                          <span>Drive time</span>
                          <span className="seq-sum-val">{fmtDriveTime(stats.total_drive_hrs)}</span>
                        </div>
                        <div className="seq-sum-row">
                          <span>Date range</span>
                          <span className="seq-sum-val">
                            {stops[0]?.gig_date ? fmtDateShort(stops[0].gig_date) : '—'}
                            {' → '}
                            {stops[stops.length - 1]?.gig_date ? fmtDateShort(stops[stops.length - 1].gig_date) : '—'}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {sidePanel === 'add-gig' && (
                <div className="seq-body">
                  <div className="add-gig-header">
                    Gigs not in any tour
                  </div>
                  {ungrouped.length === 0 ? (
                    <div className="seq-empty">
                      <div>All gigs are on tours!</div>
                    </div>
                  ) : (
                    ungrouped.map(gig => (
                      <div key={gig.id} className="add-gig-item">
                        <div className="agi-info">
                          <div className="agi-title">{gig.title}</div>
                          <div className="agi-meta">
                            {gig.venue_city}, {gig.venue_state} · {fmtDateShort(gig.gig_date)}
                          </div>
                        </div>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleAddStop(gig.id)}
                        >
                          + Add
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="seq-body seq-no-tour">
              Select a tour to manage its stop sequence.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
