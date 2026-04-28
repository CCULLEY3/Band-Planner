// frontend/src/components/ExportModal.js
import React, { useState, useEffect, useRef } from 'react';
import {
  apiGetExportPreview, downloadIcs, openGoogleCalTabs,
  MOCK_TOURS, fmtDate, fmtTime, statusColor,
} from '../utils/exportApi';
import './ExportModal.css';

// ─── Google Calendar SVG logo ─────────────────────────────────────────────────
const GoogleCalIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="white"/>
    <rect x="3" y="3" width="18" height="4" fill="#4285F4"/>
    <text x="12" y="16" textAnchor="middle" fill="#4285F4" fontSize="8" fontWeight="bold" fontFamily="sans-serif">
      {new Date().getDate()}
    </text>
    <rect x="7" y="3" width="2" height="4" rx="1" fill="#4285F4"/>
    <rect x="15" y="3" width="2" height="4" rx="1" fill="#4285F4"/>
  </svg>
);

// ─── iCal icon ────────────────────────────────────────────────────────────────
const ICalIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="4" width="20" height="18" rx="2.5" fill="#f0522a"/>
    <rect x="2" y="4" width="20" height="6" rx="2.5" fill="#c93d1a"/>
    <rect x="2" y="8" width="20" height="2" fill="#c93d1a"/>
    <rect x="7" y="2" width="2.5" height="5" rx="1.25" fill="#e0e0e0"/>
    <rect x="14.5" y="2" width="2.5" height="5" rx="1.25" fill="#e0e0e0"/>
    <text x="12" y="18" textAnchor="middle" fill="white" fontSize="6" fontWeight="bold" fontFamily="monospace">ICS</text>
  </svg>
);

// ─── Scope selector ───────────────────────────────────────────────────────────
const SCOPES = [
  { id: 'single',  label: 'This Gig',   icon: '🎸' },
  { id: 'tour',    label: 'Full Tour',   icon: '🗺' },
  { id: 'all',     label: 'All Gigs',    icon: '📅' },
];

// ─── Event preview row ────────────────────────────────────────────────────────
const EventRow = ({ event, index }) => (
  <div className="export-event-row" style={{ animationDelay: `${index * 40}ms` }}>
    <div className="eer-dot" style={{ background: statusColor(event.status) }} />
    <div className="eer-body">
      <div className="eer-title">{event.title}</div>
      <div className="eer-meta">
        <span className="eer-date">{fmtDate(event.gig_date)}</span>
        {event.start_time && (
          <>
            <span className="eer-sep">·</span>
            <span className="eer-time">{fmtTime(event.start_time)}</span>
          </>
        )}
        {event.venue_name && (
          <>
            <span className="eer-sep">·</span>
            <span className="eer-venue">{event.venue_name}</span>
          </>
        )}
        {event.venue_city && (
          <span className="eer-city">, {event.venue_city}</span>
        )}
      </div>
      {event.tour_name && (
        <div className="eer-tour">{event.tour_name}</div>
      )}
    </div>
    {event.has_notes && <div className="eer-notes-badge" title="Includes notes">📝</div>}
  </div>
);

// ─── Main ExportModal ─────────────────────────────────────────────────────────
/**
 * Props:
 *   open       boolean         — whether modal is visible
 *   onClose    () => void      — close handler
 *   gigId      string|null     — pre-select single gig scope
 *   tourId     string|null     — pre-select tour scope
 *   gigTitle   string|null     — label for the single-gig scope button
 *   tourName   string|null     — label for the tour scope button
 */
export default function ExportModal({
  open, onClose,
  gigId = null, tourId = null,
  gigTitle = 'This Gig', tourName = null,
}) {
  const defaultScope = gigId ? 'single' : tourId ? 'tour' : 'all';
  const [scope, setScope]         = useState(defaultScope);
  const [tourFilter, setTourFilter] = useState(tourId || '');
  const [preview, setPreview]     = useState(null);
  const [loading, setLoading]     = useState(false);
  const [exporting, setExporting] = useState(null); // 'ical' | 'google' | null
  const [done, setDone]           = useState(null);  // 'ical' | 'google' | null
  const overlayRef = useRef();

  // Reset when reopened
  useEffect(() => {
    if (open) {
      setScope(gigId ? 'single' : tourId ? 'tour' : 'all');
      setTourFilter(tourId || '');
      setDone(null);
      setExporting(null);
    }
  }, [open, gigId, tourId]);

  // Load preview whenever scope/filter changes
  useEffect(() => {
    if (!open) return;
    const fetchPreview = async () => {
      setLoading(true);
      setPreview(null);
      try {
        const params = {};
        if (scope === 'single') params.gigId = gigId;
        else if (scope === 'tour') params.tourId = tourFilter || tourId;
        const data = await apiGetExportPreview(params);
        setPreview(data);
      } catch (err) {
        console.error('Preview failed:', err);
      }
      setLoading(false);
    };
    fetchPreview();
  }, [open, scope, tourFilter, gigId, tourId]);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  const handleExportIcal = async () => {
    if (!preview?.events?.length || exporting) return;
    setExporting('ical');

    const calName = scope === 'single'
      ? preview.events[0].title
      : scope === 'tour'
        ? `Band Planner — ${preview.events[0]?.tour_name || 'Tour'}`
        : 'Band Planner — All Gigs';

    const filename = scope === 'single'
      ? `${(preview.events[0].title || 'gig').replace(/[^a-z0-9]/gi, '-').toLowerCase()}.ics`
      : scope === 'tour'
        ? `${(preview.events[0]?.tour_name || 'tour').replace(/[^a-z0-9]/gi, '-').toLowerCase()}-tour.ics`
        : 'band-planner-all-gigs.ics';

    // Small delay for animation feel
    await new Promise(r => setTimeout(r, 600));
    downloadIcs(preview.events, filename, calName);
    setExporting(null);
    setDone('ical');
    setTimeout(() => setDone(null), 3000);
  };

  const handleExportGoogle = async () => {
    if (!preview?.events?.length || exporting) return;
    setExporting('google');
    await new Promise(r => setTimeout(r, 400));

    await openGoogleCalTabs(preview.events);

    setExporting(null);
    setDone('google');
    setTimeout(() => setDone(null), 3000);
  };

  if (!open) return null;

  const eventCount = preview?.count ?? 0;
  const hasEvents  = eventCount > 0;

  const scopeLabels = {
    single: gigTitle || 'This Gig',
    tour:   tourName || 'Full Tour',
    all:    'All Gigs',
  };

  // Which scopes to show
  const availableScopes = SCOPES.filter(s => {
    if (s.id === 'single' && !gigId)  return false;
    if (s.id === 'tour'   && !tourId && MOCK_TOURS.length === 0) return false;
    return true;
  });

  return (
    <div className="export-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="export-modal" role="dialog" aria-modal="true" aria-label="Export Calendar">

        {/* ── Header ── */}
        <div className="export-header">
          <div className="export-header-left">
            <div className="export-title">Export to Calendar</div>
            <div className="export-subtitle">Choose scope and destination</div>
          </div>
          <button className="export-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* ── Scope selector ── */}
        <div className="export-section">
          <div className="export-section-label">What to export</div>
          <div className="export-scope-tabs">
            {availableScopes.map(s => (
              <button
                key={s.id}
                className={`scope-tab ${scope === s.id ? 'active' : ''}`}
                onClick={() => setScope(s.id)}
              >
                <span className="scope-tab-icon">{s.icon}</span>
                <span className="scope-tab-label">{s.id === 'single' ? scopeLabels.single : s.id === 'tour' ? scopeLabels.tour : s.label}</span>
              </button>
            ))}
          </div>

          {/* Tour picker (only when scope = tour and no tourId pre-set) */}
          {scope === 'tour' && !tourId && MOCK_TOURS.length > 0 && (
            <div className="export-tour-select">
              <select
                value={tourFilter}
                onChange={e => setTourFilter(e.target.value)}
              >
                <option value="">— Select a tour —</option>
                {MOCK_TOURS.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* ── Preview list ── */}
        <div className="export-preview">
          <div className="export-section-label">
            {loading ? 'Loading…' : `${eventCount} event${eventCount !== 1 ? 's' : ''} will be exported`}
          </div>
          <div className="export-event-list">
            {loading ? (
              <div className="export-loading">
                <div className="export-spinner" />
              </div>
            ) : hasEvents ? (
              preview.events.slice(0, 8).map((ev, i) => (
                <EventRow key={ev.id} event={ev} index={i} />
              ))
            ) : (
              <div className="export-empty">No events match the selected scope.</div>
            )}
            {!loading && hasEvents && preview.events.length > 8 && (
              <div className="export-more">
                +{preview.events.length - 8} more events
              </div>
            )}
          </div>
        </div>

        {/* ── Destination buttons ── */}
        <div className="export-section">
          <div className="export-section-label">Export to</div>
          <div className="export-destinations">

            {/* iCal / .ics download */}
            <button
              className={`dest-btn dest-ical ${exporting === 'ical' ? 'loading' : ''} ${done === 'ical' ? 'done' : ''}`}
              onClick={handleExportIcal}
              disabled={!hasEvents || !!exporting}
            >
              <div className="dest-icon">
                {done === 'ical' ? <span className="dest-check">✓</span> : <ICalIcon />}
              </div>
              <div className="dest-body">
                <div className="dest-name">Download .ics</div>
                <div className="dest-sub">
                  {done === 'ical'
                    ? 'Download started!'
                    : exporting === 'ical'
                      ? 'Generating file…'
                      : 'Apple Calendar, Outlook, Thunderbird'}
                </div>
              </div>
              {exporting === 'ical' && <div className="dest-spinner" />}
            </button>

            {/* Google Calendar */}
            <button
              className={`dest-btn dest-google ${exporting === 'google' ? 'loading' : ''} ${done === 'google' ? 'done' : ''}`}
              onClick={handleExportGoogle}
              disabled={!hasEvents || !!exporting}
            >
              <div className="dest-icon">
                {done === 'google' ? <span className="dest-check">✓</span> : <GoogleCalIcon />}
              </div>
              <div className="dest-body">
                <div className="dest-name">Google Calendar</div>
                <div className="dest-sub">
                  {done === 'google'
                    ? `${eventCount} tab${eventCount !== 1 ? 's' : ''} opened!`
                    : exporting === 'google'
                      ? `Opening ${eventCount} tab${eventCount !== 1 ? 's' : ''}…`
                      : eventCount > 1
                        ? `Opens ${eventCount} Google Calendar tabs`
                        : 'Opens in Google Calendar'}
                </div>
              </div>
              {exporting === 'google' && <div className="dest-spinner" />}
            </button>
          </div>
        </div>

        {/* ── Footer note ── */}
        <div className="export-footer">
          <div className="export-footer-note">
            {scope === 'all'
              ? 'Cancelled gigs are excluded from the export.'
              : scope === 'tour'
                ? 'All non-cancelled gigs in this tour will be exported.'
                : 'Only this gig will be exported.'}
            {' '}Reminders at 24h and 1h are included.
          </div>
        </div>
      </div>
    </div>
  );
}
