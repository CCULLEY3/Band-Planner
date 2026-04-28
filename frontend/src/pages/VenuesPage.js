// src/pages/VenuesPage.js
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { apiCreateVenue, apiUpdateVenue, apiDeleteVenue } from '../utils/mockApi';
import './VenuesPage.css';

const EMPTY_VENUE = {
  name: '', address: '', city: '', state: '', country: 'US', zip: '',
  capacity: '', contact_name: '', contact_email: '', contact_phone: '', notes: '',
};

function VenueModal({ venue, onClose, onSaved }) {
  const { setVenues } = useApp();
  const [form, setForm] = useState(venue ? { ...venue } : { ...EMPTY_VENUE });
  const [saving, setSaving] = useState(false);
  const isEdit = !!venue?.id;

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        const updated = await apiUpdateVenue(venue.id, form);
        setVenues(prev => prev.map(v => v.id === venue.id ? updated : v));
      } else {
        const created = await apiCreateVenue(form);
        setVenues(prev => [...prev, created]);
      }
      onSaved?.();
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-wide">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? 'EDIT VENUE' : 'NEW VENUE'}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>Venue Name *</label>
            <input value={form.name} onChange={set('name')} required placeholder="The Paramount" />
          </div>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>Address</label>
            <input value={form.address} onChange={set('address')} placeholder="713 Congress Ave" />
          </div>
          <div className="grid-3" style={{ marginBottom: 14 }}>
            <div className="form-group">
              <label>City</label>
              <input value={form.city} onChange={set('city')} placeholder="Austin" />
            </div>
            <div className="form-group">
              <label>State</label>
              <input value={form.state} onChange={set('state')} placeholder="TX" />
            </div>
            <div className="form-group">
              <label>Capacity</label>
              <input type="number" value={form.capacity} onChange={set('capacity')} placeholder="500" />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 8 }}>
            <label>Contact Name</label>
            <input value={form.contact_name} onChange={set('contact_name')} placeholder="Dana Sparks" />
          </div>
          <div className="grid-2" style={{ marginBottom: 14 }}>
            <div className="form-group">
              <label>Contact Email</label>
              <input type="email" value={form.contact_email} onChange={set('contact_email')} placeholder="dana@venue.com" />
            </div>
            <div className="form-group">
              <label>Contact Phone</label>
              <input value={form.contact_phone} onChange={set('contact_phone')} placeholder="512-555-0101" />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label>Notes</label>
            <textarea value={form.notes} onChange={set('notes')} placeholder="Parking, load-in instructions, etc." />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Venue'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function VenuesPage() {
  const { venues, setVenues, gigs } = useApp();
  const [modal, setModal] = useState(null); // null | 'new' | venue object
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const filtered = venues.filter(v =>
    !search || v.name.toLowerCase().includes(search.toLowerCase()) || v.city?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this venue?')) return;
    await apiDeleteVenue(id);
    setVenues(prev => prev.filter(v => v.id !== id));
    if (selected === id) setSelected(null);
  };

  const selectedVenue = selected ? venues.find(v => v.id === selected) : null;
  const venueGigs = selected ? gigs.filter(g => g.venue_id === selected) : [];

  return (
    <div className="page">
      <div className="venues-layout">
        {/* List */}
        <div className="venues-list-panel">
          <div className="venues-list-header">
            <input
              className="search-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search venues…"
            />
            <button className="btn btn-primary btn-sm" onClick={() => setModal('new')}>+ Add Venue</button>
          </div>
          <div className="venues-count">{filtered.length} venue{filtered.length !== 1 ? 's' : ''}</div>

          {filtered.map(v => (
            <div
              key={v.id}
              className={`venue-row ${selected === v.id ? 'active' : ''}`}
              onClick={() => setSelected(v.id)}
            >
              <div className="venue-row-main">
                <div className="venue-row-name">{v.name}</div>
                <div className="venue-row-city">{v.city}{v.state ? `, ${v.state}` : ''}</div>
              </div>
              <div className="venue-row-cap">{v.capacity ? `${v.capacity.toLocaleString()} cap.` : ''}</div>
              <div className="venue-row-actions">
                <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setModal(v); }}>✎</button>
                <button className="btn btn-ghost btn-sm danger" onClick={(e) => { e.stopPropagation(); handleDelete(v.id); }}>✕</button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="empty-state">No venues found.</div>}
        </div>

        {/* Detail */}
        <div className="venue-detail">
          {!selectedVenue ? (
            <div className="venues-placeholder">
              <div className="placeholder-icon">◫</div>
              <div>Select a venue to see details</div>
            </div>
          ) : (
            <div>
              <div className="venue-detail-header">
                <div>
                  <div className="venue-detail-name">{selectedVenue.name}</div>
                  <div className="venue-detail-location">{selectedVenue.address}{selectedVenue.city ? `, ${selectedVenue.city}` : ''}{selectedVenue.state ? `, ${selectedVenue.state}` : ''}</div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => setModal(selectedVenue)}>✎ Edit</button>
              </div>

              <div className="venue-info-grid">
                {selectedVenue.capacity && (
                  <div className="venue-info-block">
                    <div className="info-label">Capacity</div>
                    <div className="info-value">{Number(selectedVenue.capacity).toLocaleString()}</div>
                  </div>
                )}
                {selectedVenue.contact_name && (
                  <div className="venue-info-block">
                    <div className="info-label">Contact</div>
                    <div className="info-value">{selectedVenue.contact_name}</div>
                  </div>
                )}
                {selectedVenue.contact_email && (
                  <div className="venue-info-block">
                    <div className="info-label">Email</div>
                    <div className="info-value">
                      <a href={`mailto:${selectedVenue.contact_email}`}>{selectedVenue.contact_email}</a>
                    </div>
                  </div>
                )}
                {selectedVenue.contact_phone && (
                  <div className="venue-info-block">
                    <div className="info-label">Phone</div>
                    <div className="info-value">
                      <a href={`tel:${selectedVenue.contact_phone}`}>{selectedVenue.contact_phone}</a>
                    </div>
                  </div>
                )}
              </div>

              {selectedVenue.notes && (
                <div className="venue-notes">
                  <div className="info-label" style={{ marginBottom: 6 }}>Notes</div>
                  <div className="venue-notes-text">{selectedVenue.notes}</div>
                </div>
              )}

              <div className="venue-gigs-section">
                <div className="section-label" style={{ marginBottom: 10, display: 'block' }}>
                  GIGS AT THIS VENUE ({venueGigs.length})
                </div>
                {venueGigs.length === 0 && <div style={{ color: 'var(--text3)', fontSize: 13 }}>No gigs recorded at this venue.</div>}
                {venueGigs.sort((a,b) => a.gig_date.localeCompare(b.gig_date)).map(g => (
                  <div key={g.id} className="venue-gig-item">
                    <div className="venue-gig-date">{g.gig_date}</div>
                    <div className="venue-gig-title">{g.title}</div>
                    <span className={`badge badge-${g.status}`}>{g.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <VenueModal
          venue={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => {}}
        />
      )}
    </div>
  );
}
