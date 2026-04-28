// src/pages/GigsPage.js
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import GigCard from '../components/GigCard';
import { apiDeleteGig } from '../utils/mockApi';
import './GigsPage.css';

const STATUS_OPTIONS = ['all', 'confirmed', 'inquiry', 'cancelled', 'completed'];

export default function GigsPage({ onGigClick, onGigCreate }) {
  const { gigs, setGigs, loading } = useApp();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState(null);

  const filtered = gigs
    .filter(g => filter === 'all' || g.status === filter)
    .filter(g => !search || g.title.toLowerCase().includes(search.toLowerCase()) || g.venue_name?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.gig_date.localeCompare(b.gig_date));

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this gig?')) return;
    setDeleting(id);
    await apiDeleteGig(id);
    setGigs(prev => prev.filter(g => g.id !== id));
    setDeleting(null);
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="gigs-toolbar">
        <input
          className="search-input"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search gigs or venues…"
        />
        <div className="filter-pills">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              className={`pill ${filter === s ? 'pill-active' : ''}`}
              onClick={() => setFilter(s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <button className="btn btn-primary btn-sm" onClick={onGigCreate}>+ New Gig</button>
      </div>

      <div className="gigs-count">{filtered.length} gig{filtered.length !== 1 ? 's' : ''}</div>

      <div className="gigs-list">
        {filtered.map(g => (
          <div key={g.id} className="gig-row">
            <GigCard gig={g} onClick={() => onGigClick(g)} />
            <div className="gig-row-actions">
              <button
                className="btn btn-ghost btn-sm"
                onClick={(e) => { e.stopPropagation(); onGigClick(g); }}
              >✎ Edit</button>
              <button
                className="btn btn-ghost btn-sm danger"
                onClick={(e) => handleDelete(g.id, e)}
                disabled={deleting === g.id}
              >{deleting === g.id ? '…' : '✕'}</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="empty-state">
            {search ? `No gigs matching "${search}"` : 'No gigs found.'}
          </div>
        )}
      </div>
    </div>
  );
}
