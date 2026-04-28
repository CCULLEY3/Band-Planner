// src/components/GigCard.js
import React from 'react';
import './GigCard.css';

const STATUS_BADGE = {
  confirmed: 'badge-confirmed',
  inquiry:   'badge-inquiry',
  cancelled: 'badge-cancelled',
  completed: 'badge-completed',
};

export function formatDate(d) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function daysUntil(d) {
  if (!d) return null;
  const diff = Math.ceil((new Date(d + 'T12:00:00') - new Date()) / 86400000);
  if (diff < 0) return 'Past';
  if (diff === 0) return 'Today';
  return `${diff}d away`;
}

export default function GigCard({ gig, onClick, compact }) {
  const days = daysUntil(gig.gig_date);
  const isPast = days === 'Past';

  return (
    <div className={`gig-card card card-hover ${compact ? 'gig-card-compact' : ''} ${isPast ? 'gig-past' : ''}`} onClick={onClick}>
      <div className="gig-card-top">
        <div className="gig-date-chip">
          <span className="gig-month">{new Date(gig.gig_date + 'T12:00:00').toLocaleString('en-US', { month: 'short' })}</span>
          <span className="gig-day">{new Date(gig.gig_date + 'T12:00:00').getDate()}</span>
        </div>
        <div className="gig-main">
          <div className="gig-title">{gig.title}</div>
          <div className="gig-venue">{gig.venue_name} · {gig.venue_city}</div>
          {gig.tour_name && <div className="gig-tour">↳ {gig.tour_name}</div>}
        </div>
        <div className="gig-meta">
          <span className={`badge ${STATUS_BADGE[gig.status] || ''}`}>{gig.status}</span>
          <span className={`gig-days ${days === 'Today' ? 'today' : ''}`}>{days}</span>
        </div>
      </div>
      {!compact && (
        <div className="gig-card-bottom">
          <span>🕐 {gig.start_time || '—'}</span>
          {gig.deal_type && <span>💰 {gig.deal_type.replace(/_/g,' ')}{gig.deal_amount ? ` · $${gig.deal_amount}` : ''}</span>}
          {gig.ticket_price && <span>🎟 ${gig.ticket_price}/ticket</span>}
        </div>
      )}
    </div>
  );
}
