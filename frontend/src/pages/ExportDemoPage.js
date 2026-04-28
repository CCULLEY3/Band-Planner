// frontend/src/pages/ExportDemoPage.js
// Standalone demo page showing export buttons in gig and tour contexts.
// In production: embed the <ExportButton> and <ExportModal> into your
// existing GigsPage, CalendarPage, and TourMapPage.
import React, { useState } from 'react';
import ExportModal from '../components/ExportModal';
import { MOCK_GIGS, MOCK_TOURS, fmtDate, fmtTime, statusColor } from '../utils/exportApi';
import './ExportDemoPage.css';

// ─── Reusable export trigger button ──────────────────────────────────────────
export function ExportButton({ onClick, size = 'sm', label = 'Export' }) {
  return (
    <button className={`export-trigger-btn export-trigger-${size}`} onClick={onClick}>
      <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 1a1 1 0 0 1 1 1v6.586l2.293-2.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L7 8.586V2a1 1 0 0 1 1-1z"/>
        <path d="M2 12a1 1 0 0 1 1 1h10a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1z" opacity=".5"/>
      </svg>
      {label}
    </button>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => (
  <span className={`demo-status-badge status-${status}`}>{status}</span>
);

// ─── Gig row in the demo list ─────────────────────────────────────────────────
const GigRow = ({ gig, onExport }) => (
  <div className="demo-gig-row">
    <div className="dgr-left">
      <div className="dgr-date">{fmtDate(gig.gig_date)}</div>
      {gig.start_time && <div className="dgr-time">{fmtTime(gig.start_time)}</div>}
    </div>
    <div className="dgr-body">
      <div className="dgr-title">{gig.title}</div>
      <div className="dgr-meta">
        {gig.venue_name && <span>{gig.venue_name}</span>}
        {gig.venue_city && <span className="dgr-sep">·</span>}
        {gig.venue_city && <span>{gig.venue_city}, {gig.venue_state}</span>}
        {gig.tour_name  && <span className="dgr-sep">·</span>}
        {gig.tour_name  && <span className="dgr-tour">{gig.tour_name}</span>}
      </div>
    </div>
    <div className="dgr-right">
      <StatusBadge status={gig.status} />
      <ExportButton
        label="Export"
        onClick={() => onExport({ gigId: gig.id, gigTitle: gig.title })}
      />
    </div>
  </div>
);

// ─── Tour card in the demo list ───────────────────────────────────────────────
const TourCard = ({ tour, gigs, onExport }) => {
  const tourGigs = gigs.filter(g => g.tour_name === tour.name);
  const dates    = tourGigs.map(g => g.gig_date).filter(Boolean).sort();
  return (
    <div className="demo-tour-card" style={{ borderLeftColor: tour.color }}>
      <div className="dtc-header">
        <div className="dtc-dot" style={{ background: tour.color }} />
        <div className="dtc-name">{tour.name}</div>
        <div className="dtc-count">{tourGigs.length} gigs</div>
        {dates.length > 0 && (
          <div className="dtc-dates">
            {fmtDate(dates[0])} → {fmtDate(dates[dates.length - 1])}
          </div>
        )}
        <ExportButton
          label="Export Tour"
          size="md"
          onClick={() => onExport({ tourId: tour.id, tourName: tour.name })}
        />
      </div>
      <div className="dtc-gigs">
        {tourGigs.map(g => (
          <div key={g.id} className="dtc-gig-row">
            <div className="dtc-gig-dot" style={{ background: statusColor(g.status) }} />
            <span className="dtc-gig-date">{fmtDate(g.gig_date)}</span>
            <span className="dtc-gig-title">{g.title}</span>
            <span className="dtc-gig-venue">{g.venue_name}, {g.venue_city}</span>
            <ExportButton
              label=""
              onClick={() => onExport({ gigId: g.id, gigTitle: g.title })}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Demo page ────────────────────────────────────────────────────────────────
export default function ExportDemoPage() {
  const [modalProps, setModalProps] = useState(null);
  const [activeTab, setActiveTab]   = useState('gigs'); // gigs | tours

  const openExport = (props) => setModalProps(props);
  const closeExport = () => setModalProps(null);

  return (
    <div className="export-demo-page page">
      {/* ── Page header ── */}
      <div className="demo-page-header">
        <div>
          <div className="demo-page-title">Calendar Export</div>
          <div className="demo-page-sub">Export gigs and tours to your calendar app</div>
        </div>
        <ExportButton
          label="Export All Gigs"
          size="lg"
          onClick={() => openExport({})}
        />
      </div>

      {/* ── Tabs ── */}
      <div className="demo-tabs">
        {[['gigs', '🎸 Gigs'], ['tours', '🗺 Tours']].map(([id, label]) => (
          <button
            key={id}
            className={`demo-tab ${activeTab === id ? 'active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Gigs list ── */}
      {activeTab === 'gigs' && (
        <div className="demo-gig-list">
          {MOCK_GIGS.map(g => (
            <GigRow
              key={g.id}
              gig={g}
              onExport={openExport}
            />
          ))}
        </div>
      )}

      {/* ── Tours list ── */}
      {activeTab === 'tours' && (
        <div className="demo-tour-list">
          {MOCK_TOURS.map(t => (
            <TourCard
              key={t.id}
              tour={t}
              gigs={MOCK_GIGS}
              onExport={openExport}
            />
          ))}
        </div>
      )}

      {/* ── Export Modal ── */}
      <ExportModal
        open={!!modalProps}
        onClose={closeExport}
        gigId={modalProps?.gigId || null}
        tourId={modalProps?.tourId || null}
        gigTitle={modalProps?.gigTitle || 'This Gig'}
        tourName={modalProps?.tourName || null}
      />
    </div>
  );
}
