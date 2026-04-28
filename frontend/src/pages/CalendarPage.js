// src/pages/CalendarPage.js
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import './CalendarPage.css';

const STATUS_COLOR = {
  confirmed: 'var(--green)',
  inquiry:   'var(--yellow)',
  cancelled: 'var(--red)',
  completed: 'var(--blue)',
};

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function CalendarPage({ onGigClick }) {
  const { gigs } = useApp();
  const [view, setView] = useState('month');
  const [current, setCurrent] = useState(new Date());

  const year = current.getFullYear();
  const month = current.getMonth();

  const gigsByDate = useMemo(() => {
    const map = {};
    gigs.forEach(g => {
      if (!map[g.gig_date]) map[g.gig_date] = [];
      map[g.gig_date].push(g);
    });
    return map;
  }, [gigs]);

  const navigate = (dir) => {
    setCurrent(prev => {
      const d = new Date(prev);
      if (view === 'month') d.setMonth(d.getMonth() + dir);
      else if (view === 'week') d.setDate(d.getDate() + dir * 7);
      else d.setDate(d.getDate() + dir);
      return d;
    });
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const renderMonth = () => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];

    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let i = 1; i <= daysInMonth; i++) cells.push(i);

    return (
      <div className="cal-month">
        <div className="cal-week-headers">
          {DAYS.map(d => <div key={d} className="cal-weekday">{d}</div>)}
        </div>
        <div className="cal-grid">
          {cells.map((day, idx) => {
            const dateStr = day
              ? `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              : null;
            const dayGigs = dateStr ? (gigsByDate[dateStr] || []) : [];
            const isToday = dateStr === todayStr;

            return (
              <div key={idx} className={`cal-cell ${!day ? 'empty' : ''} ${isToday ? 'today' : ''}`}>
                {day && (
                  <>
                    <div className="cal-day-num">{day}</div>
                    <div className="cal-events">
                      {dayGigs.slice(0, 3).map(g => (
                        <div
                          key={g.id}
                          className="cal-event"
                          style={{ borderColor: STATUS_COLOR[g.status] }}
                          onClick={() => onGigClick(g)}
                          title={g.title}
                        >
                          {g.title}
                        </div>
                      ))}
                      {dayGigs.length > 3 && (
                        <div className="cal-more">+{dayGigs.length - 3} more</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeek = () => {
    const startOfWeek = new Date(current);
    startOfWeek.setDate(current.getDate() - current.getDay());
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      return d;
    });

    return (
      <div className="cal-week-view">
        {days.map((day, i) => {
          const dateStr = day.toISOString().split('T')[0];
          const dayGigs = gigsByDate[dateStr] || [];
          const isToday = dateStr === todayStr;
          return (
            <div key={i} className={`week-col ${isToday ? 'today' : ''}`}>
              <div className="week-col-header">
                <span className="week-day-name">{DAYS[i]}</span>
                <span className={`week-day-num ${isToday ? 'today-num' : ''}`}>{day.getDate()}</span>
              </div>
              <div className="week-col-events">
                {dayGigs.map(g => (
                  <div
                    key={g.id}
                    className="week-event"
                    style={{ background: `${STATUS_COLOR[g.status]}22`, borderLeft: `3px solid ${STATUS_COLOR[g.status]}` }}
                    onClick={() => onGigClick(g)}
                  >
                    <div className="week-event-time">{g.start_time || '—'}</div>
                    <div className="week-event-title">{g.title}</div>
                    <div className="week-event-venue">{g.venue_name}</div>
                  </div>
                ))}
                {dayGigs.length === 0 && <div className="week-empty" />}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderDay = () => {
    const dateStr = current.toISOString().split('T')[0];
    const dayGigs = gigsByDate[dateStr] || [];
    return (
      <div className="cal-day-view">
        <div className="day-date-header">
          {current.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
        {dayGigs.length === 0 && <div className="empty-state">No shows on this day.</div>}
        {dayGigs.map(g => (
          <div key={g.id} className="day-event card card-hover" onClick={() => onGigClick(g)}
               style={{ borderLeft: `4px solid ${STATUS_COLOR[g.status]}` }}>
            <div className="day-event-title">{g.title}</div>
            <div className="day-event-meta">
              <span>📍 {g.venue_name}, {g.venue_city}</span>
              <span>🕐 Load-in {g.load_in_time} · Doors {g.start_time}</span>
              {g.deal_amount && <span>💰 ${g.deal_amount}</span>}
            </div>
            {g.notes && <div className="day-event-notes">{g.notes}</div>}
          </div>
        ))}
      </div>
    );
  };

  const navLabel = view === 'month'
    ? `${MONTHS[month]} ${year}`
    : view === 'week'
    ? `Week of ${current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : current.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="page">
      <div className="cal-toolbar">
        <div className="cal-nav">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>‹</button>
          <div className="cal-nav-label">{navLabel}</div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(1)}>›</button>
        </div>
        <div className="cal-views">
          {['month', 'week', 'day'].map(v => (
            <button
              key={v}
              className={`btn btn-sm ${view === v ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setView(v)}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setCurrent(new Date())}>Today</button>
      </div>

      <div className="cal-body">
        {view === 'month' && renderMonth()}
        {view === 'week' && renderWeek()}
        {view === 'day' && renderDay()}
      </div>
    </div>
  );
}
