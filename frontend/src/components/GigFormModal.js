// src/components/GigFormModal.js
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { apiCreateGig, apiUpdateGig, apiUploadAttachment, apiGetAttachments, apiDeleteAttachment } from '../utils/mockApi';
import './GigFormModal.css';

const EMPTY = {
  title: '', venue_id: '', tour_id: '',
  gig_date: '', load_in_time: '', soundcheck_time: '', start_time: '', end_time: '',
  status: 'confirmed', deal_type: 'flat', deal_amount: '', ticket_price: '',
  notes: '',
};

export default function GigFormModal({ gig, onClose, onSaved }) {
  const { venues, tours, setGigs } = useApp();
  const [form, setForm] = useState(gig ? { ...gig } : { ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [attachLabel, setAttachLabel] = useState('other');

  const isEdit = !!gig?.id;

  useEffect(() => {
    if (isEdit) {
      apiGetAttachments('gig', gig.id).then(setAttachments);
    }
  }, [gig?.id, isEdit]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.gig_date) { setError('Title and date are required.'); return; }
    setSaving(true);
    try {
      if (isEdit) {
        const updated = await apiUpdateGig(gig.id, form);
        setGigs(prev => prev.map(g => g.id === gig.id ? updated : g));
      } else {
        const created = await apiCreateGig(form);
        setGigs(prev => [...prev, created]);
      }
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !isEdit) return;
    setUploading(true);
    try {
      const att = await apiUploadAttachment('gig', gig.id, file, attachLabel);
      setAttachments(prev => [...prev, att]);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteAttachment = async (id) => {
    await apiDeleteAttachment(id);
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const fmtSize = (b) => b > 1048576 ? `${(b/1048576).toFixed(1)} MB` : `${Math.round(b/1024)} KB`;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-wide">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? 'EDIT GIG' : 'NEW GIG'}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label>Gig Title *</label>
            <input value={form.title} onChange={set('title')} placeholder="e.g. Headline at The Paramount" required />
          </div>

          <div className="grid-2" style={{ marginBottom: 16 }}>
            <div className="form-group">
              <label>Venue</label>
              <select value={form.venue_id} onChange={set('venue_id')}>
                <option value="">— No venue —</option>
                {venues.map(v => <option key={v.id} value={v.id}>{v.name} ({v.city})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Tour</label>
              <select value={form.tour_id} onChange={set('tour_id')}>
                <option value="">— Standalone gig —</option>
                {tours.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid-2" style={{ marginBottom: 16 }}>
            <div className="form-group">
              <label>Gig Date *</label>
              <input type="date" value={form.gig_date} onChange={set('gig_date')} required />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={set('status')}>
                <option value="inquiry">Inquiry</option>
                <option value="confirmed">Confirmed</option>
                <option value="cancelled">Cancelled</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <div className="grid-4" style={{ marginBottom: 16 }}>
            {[
              ['Load-In', 'load_in_time'],
              ['Soundcheck', 'soundcheck_time'],
              ['Start Time', 'start_time'],
              ['End Time', 'end_time'],
            ].map(([label, key]) => (
              <div className="form-group" key={key}>
                <label>{label}</label>
                <input type="time" value={form[key]} onChange={set(key)} />
              </div>
            ))}
          </div>

          <div className="grid-3" style={{ marginBottom: 16 }}>
            <div className="form-group">
              <label>Deal Type</label>
              <select value={form.deal_type} onChange={set('deal_type')}>
                <option value="flat">Flat Fee</option>
                <option value="percentage">Percentage</option>
                <option value="guarantee_vs_door">Guarantee vs Door</option>
              </select>
            </div>
            <div className="form-group">
              <label>Deal Amount ($)</label>
              <input type="number" value={form.deal_amount} onChange={set('deal_amount')} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label>Ticket Price ($)</label>
              <input type="number" value={form.ticket_price} onChange={set('ticket_price')} placeholder="0.00" />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label>Notes</label>
            <textarea value={form.notes} onChange={set('notes')} placeholder="Backline, hospitality, parking..." />
          </div>

          {/* Attachments — only show on edit */}
          {isEdit && (
            <div className="attachments-section">
              <div className="attach-header">
                <span className="section-label">Attachments</span>
                <div className="attach-upload-row">
                  <select value={attachLabel} onChange={e => setAttachLabel(e.target.value)} style={{ width: 130 }}>
                    <option value="contract">Contract</option>
                    <option value="rider">Rider</option>
                    <option value="flyer">Flyer</option>
                    <option value="invoice">Invoice</option>
                    <option value="other">Other</option>
                  </select>
                  <label className="btn btn-secondary btn-sm file-label">
                    {uploading ? 'Uploading…' : '+ Upload'}
                    <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploading}
                      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt" />
                  </label>
                </div>
              </div>
              {attachments.length === 0 && (
                <div className="attach-empty">No files yet. Upload a contract, rider, or flyer.</div>
              )}
              {attachments.map(a => (
                <div key={a.id} className="attach-item">
                  <span className="attach-icon">{a.mime_type?.includes('image') ? '🖼' : '📄'}</span>
                  <div className="attach-info">
                    <div className="attach-name">{a.file_name}</div>
                    <div className="attach-meta">{a.label} · {fmtSize(a.size_bytes)}</div>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDeleteAttachment(a.id)}>✕</button>
                </div>
              ))}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Gig'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
