// frontend/src/pages/BandSettingsPage.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Can } from '../components/auth/ProtectedRoute';
import './BandSettingsPage.css';

// ─── Role badge ───────────────────────────────────────────────────────────────
const ROLE_META = {
  band_leader: { label: 'Leader', color: '#f0522a' },
  manager:     { label: 'Manager', color: '#4a8cff' },
  band_member: { label: 'Member',  color: '#29cc6a' },
  guest:       { label: 'Guest',   color: '#5a5a72' },
};

const RoleBadge = ({ role }) => {
  const m = ROLE_META[role] || { label: role, color: '#5a5a72' };
  return (
    <span className="role-badge" style={{ '--rb-color': m.color }}>{m.label}</span>
  );
};

// ─── Avatar ───────────────────────────────────────────────────────────────────
const Avatar = ({ name = '?', color = '#f0522a', size = 36 }) => (
  <div
    className="member-avatar"
    style={{ '--av-bg': color, '--av-size': `${size}px` }}
  >
    {(name[0] || '?').toUpperCase()}
  </div>
);

// ─── Invite modal ─────────────────────────────────────────────────────────────
const InviteModal = ({ bandId, onClose, onSuccess }) => {
  const { authFetch } = useAuth();
  const [email,   setEmail]   = useState('');
  const [role,    setRole]    = useState('band_member');
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handle = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res  = await authFetch(`/auth/bands/${bandId}/invite`, {
        method: 'POST',
        body:   JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      onSuccess?.();
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <div className="mp-header">
          <div className="mp-title">Invite Band Member</div>
          <button className="mp-close" onClick={onClose}>✕</button>
        </div>

        {result ? (
          <div className="invite-success">
            <div className="is-check">✓</div>
            <div className="is-text">Invite created for <strong>{email}</strong></div>
            <div className="is-url-label">Share this link with them:</div>
            <div className="is-url">
              <code>{result.inviteUrl}</code>
              <button
                className="is-copy"
                onClick={() => navigator.clipboard.writeText(result.inviteUrl)}
              >
                Copy
              </button>
            </div>
            <button className="btn btn-primary" onClick={onClose} style={{ marginTop: 20 }}>Done</button>
          </div>
        ) : (
          <form className="invite-form" onSubmit={handle}>
            {error && <div className="invite-error">{error}</div>}
            <div className="if-group">
              <label>Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="bandmate@email.com"
                required
                autoFocus
              />
            </div>
            <div className="if-group">
              <label>Role</label>
              <div className="if-role-options">
                {['band_member','manager','guest'].map(r => (
                  <button
                    key={r} type="button"
                    className={`if-role-btn ${role === r ? 'selected' : ''}`}
                    onClick={() => setRole(r)}
                  >
                    <span className="irb-dot" style={{ background: ROLE_META[r].color }} />
                    {ROLE_META[r].label}
                  </button>
                ))}
              </div>
              <div className="if-role-desc">
                {{
                  band_member: 'Can RSVP, comment, and view all gigs and tours.',
                  manager:     'Can also create/edit gigs, tours, and add financial records.',
                  guest:       'Can view gigs and RSVP only. Cannot access financials.',
                }[role]}
              </div>
            </div>
            <div className="if-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Sending…' : 'Create Invite'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// ─── Member row ───────────────────────────────────────────────────────────────
const MemberRow = ({ member, bandId, currentUserId, isCurrentLeader, onRoleChange, onRemove }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const isSelf = member.id === currentUserId;

  return (
    <div className="member-row" key={member.id}>
      <Avatar name={member.name} color={member.avatar_color} />
      <div className="mr-body">
        <div className="mr-name">
          {member.name}
          {isSelf && <span className="mr-you">you</span>}
        </div>
        <div className="mr-email">{member.email}</div>
      </div>
      <RoleBadge role={member.role} />
      <div className="mr-joined">
        {member.last_login_at
          ? `Active ${new Date(member.last_login_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
          : 'Never logged in'}
      </div>

      {/* Role menu — leader only, and can't demote self if last leader */}
      {isCurrentLeader && !isSelf && (
        <div className="mr-actions">
          <button
            className="mr-menu-btn"
            onClick={() => setMenuOpen(o => !o)}
          >
            ···
          </button>
          {menuOpen && (
            <div className="mr-menu">
              <div className="mm-label">Change role to</div>
              {['band_member','manager','band_leader'].filter(r => r !== member.role).map(r => (
                <button
                  key={r}
                  className="mm-item"
                  onClick={() => { onRoleChange(member.id, r); setMenuOpen(false); }}
                >
                  <span className="mm-dot" style={{ background: ROLE_META[r].color }} />
                  {ROLE_META[r].label}
                </button>
              ))}
              <div className="mm-divider" />
              <button
                className="mm-item mm-remove"
                onClick={() => { onRemove(member.id, member.name); setMenuOpen(false); }}
              >
                Remove from band
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── ProfileSection ───────────────────────────────────────────────────────────
const ProfileSection = () => {
  const { user, authFetch } = useAuth();
  const [name, setName]     = useState(user?.name || '');
  const [curPw, setCurPw]   = useState('');
  const [newPw, setNewPw]   = useState('');
  const [msg,   setMsg]     = useState('');
  const [err,   setErr]     = useState('');
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setMsg(''); setErr(''); setSaving(true);
    try {
      const body = { name };
      if (newPw) { body.currentPassword = curPw; body.newPassword = newPw; }
      const res  = await authFetch('/auth/me', { method: 'PATCH', body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg('Profile updated.'); setCurPw(''); setNewPw('');
    } catch (e) { setErr(e.message); }
    setSaving(false);
  };

  return (
    <section className="settings-section">
      <div className="ss-header">
        <div className="ss-title">Profile</div>
      </div>
      <form className="profile-form" onSubmit={save}>
        <div className="pf-avatar">
          <Avatar name={user?.name} color={user?.avatarColor} size={56} />
          <div>
            <div className="pfa-name">{user?.name}</div>
            <div className="pfa-email">{user?.email}</div>
          </div>
        </div>
        {msg && <div className="pf-msg success">{msg}</div>}
        {err && <div className="pf-msg error">{err}</div>}
        <div className="pf-row">
          <div className="pf-group">
            <label>Display Name</label>
            <input value={name} onChange={e => setName(e.target.value)} />
          </div>
        </div>
        <div className="pf-row">
          <div className="pf-group">
            <label>Current Password</label>
            <input type="password" value={curPw} onChange={e => setCurPw(e.target.value)} placeholder="Leave blank to keep" />
          </div>
          <div className="pf-group">
            <label>New Password</label>
            <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Minimum 8 chars" />
          </div>
        </div>
        <div className="pf-actions">
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </section>
  );
};

// ─── Main BandSettingsPage ────────────────────────────────────────────────────
export default function BandSettingsPage() {
  const { user, authFetch, bandId, role, isLeader } = useAuth();
  const [members,     setMembers]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showInvite,  setShowInvite]  = useState(false);
  const [toast,       setToast]       = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const loadMembers = async () => {
    if (!bandId) return;
    const res  = await authFetch(`/auth/bands/${bandId}/members`);
    const data = await res.json();
    setMembers(data);
    setLoading(false);
  };

  useEffect(() => { loadMembers(); }, [bandId]); // eslint-disable-line

  const handleRoleChange = async (userId, newRole) => {
    const res = await authFetch(`/auth/bands/${bandId}/members/${userId}/role`, {
      method: 'PATCH',
      body:   JSON.stringify({ role: newRole }),
    });
    if (res.ok) { showToast('Role updated.'); loadMembers(); }
  };

  const handleRemove = async (userId, name) => {
    if (!window.confirm(`Remove ${name} from the band?`)) return;
    const res = await authFetch(`/auth/bands/${bandId}/members/${userId}`, { method: 'DELETE' });
    if (res.ok) { showToast(`${name} removed.`); loadMembers(); }
  };

  const activeBand = user?.bands?.[0];

  return (
    <div className="settings-page page">
      {showInvite && (
        <InviteModal
          bandId={bandId}
          onClose={() => setShowInvite(false)}
          onSuccess={() => loadMembers()}
        />
      )}

      {toast && <div className="settings-toast">{toast}</div>}

      {/* ── Page header ── */}
      <div className="settings-header">
        <div>
          <div className="settings-title">Band Settings</div>
          <div className="settings-sub">
            {activeBand?.bandName || 'Your Band'}
            {' · '}
            <span style={{ color: ROLE_META[role]?.color }}>{ROLE_META[role]?.label || role}</span>
          </div>
        </div>
      </div>

      {/* ── Members section ── */}
      <section className="settings-section">
        <div className="ss-header">
          <div className="ss-title">
            Band Members
            <span className="ss-count">{members.length}</span>
          </div>
          <Can roles={['band_leader', 'manager']}>
            <button className="btn btn-primary btn-sm" onClick={() => setShowInvite(true)}>
              + Invite Member
            </button>
          </Can>
        </div>

        {loading ? (
          <div className="settings-loading">Loading members…</div>
        ) : (
          <div className="members-list">
            {members.map(m => (
              <MemberRow
                key={m.id}
                member={m}
                bandId={bandId}
                currentUserId={user?.sub}
                isCurrentLeader={isLeader}
                onRoleChange={handleRoleChange}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Role legend ── */}
      <section className="settings-section">
        <div className="ss-header"><div className="ss-title">Role Permissions</div></div>
        <div className="role-legend">
          {[
            ['Band Leader',   'band_leader', 'Full control: gigs, tours, venues, financials, members.'],
            ['Manager',       'manager',     'Create/edit gigs & tours. Add financial records. Invite members.'],
            ['Band Member',   'band_member', 'RSVP, comment, and view all gigs and tours.'],
            ['Guest',         'guest',       'View gigs and RSVP only.'],
          ].map(([name, r, desc]) => (
            <div key={r} className="rl-row">
              <RoleBadge role={r} />
              <div className="rl-desc">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Profile section ── */}
      <ProfileSection />
    </div>
  );
}
