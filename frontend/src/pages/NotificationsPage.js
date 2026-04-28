// frontend/src/pages/NotificationsPage.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  apiGetHistory, apiGetPreferences, apiUpdatePreferences,
  apiGetJobs, apiGetStats, apiMarkRead, apiMarkAllRead,
  apiSendTest, apiSendNow, apiGetVapidKey, apiSubscribePush,
  REMINDER_PRESETS, formatReminderLabel,
} from '../utils/notificationApi';
import './NotificationsPage.css';

// ─── Sub-components ───────────────────────────────────────────────────────────

const CHANNEL_ICON = { email: '📧', push: '📲', in_app: '🔔' };
const TYPE_LABEL = {
  gig_reminder: 'Gig Reminder',
  gig_update:   'Gig Update',
  tour_reminder: 'Tour Reminder',
  test:         'Test',
};

function StatusBadge({ status }) {
  const cls = {
    sent: 'status-sent', read: 'status-read',
    failed: 'status-failed', pending: 'status-pending',
  }[status] || '';
  return <span className={`notif-status-badge ${cls}`}>{status}</span>;
}

function HistoryItem({ item, onRead }) {
  const isUnread = item.status === 'sent';
  const timeAgo = (iso) => {
    if (!iso) return '—';
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000)   return 'just now';
    if (diff < 3600000) return `${Math.round(diff/60000)}m ago`;
    if (diff < 86400000)return `${Math.round(diff/3600000)}h ago`;
    return `${Math.round(diff/86400000)}d ago`;
  };

  return (
    <div
      className={`history-item ${isUnread ? 'unread' : ''} ${item.status === 'failed' ? 'failed' : ''}`}
      onClick={() => isUnread && onRead(item.id)}
    >
      <div className="history-item-left">
        <div className="hi-channel-icon">{CHANNEL_ICON[item.channel] || '📬'}</div>
        {isUnread && <div className="unread-pulse" />}
      </div>
      <div className="history-item-body">
        <div className="hi-header">
          <span className="hi-type">{TYPE_LABEL[item.type] || item.type}</span>
          <StatusBadge status={item.status} />
          <span className="hi-time">{timeAgo(item.created_at)}</span>
        </div>
        <div className="hi-subject">{item.subject}</div>
        {item.gig_title && (
          <div className="hi-gig">
            {item.gig_title}
            {item.venue_name && <span> · {item.venue_name}, {item.venue_city}</span>}
            {item.gig_date && <span> · {new Date(item.gig_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
          </div>
        )}
        {item.status === 'failed' && item.metadata?.error && (
          <div className="hi-error">⚠ {item.metadata.error}</div>
        )}
      </div>
    </div>
  );
}

function StatsRow({ stats }) {
  return (
    <div className="notif-stats-row">
      {[
        { label: 'Total Sent',    value: stats.total_sent,    color: 'var(--green)' },
        { label: 'Opened',        value: stats.total_read,    color: 'var(--blue)' },
        { label: 'Failed',        value: stats.total_failed,  color: 'var(--red)' },
        { label: 'Pending Jobs',  value: stats.pending_jobs,  color: 'var(--yellow)' },
      ].map(s => (
        <div key={s.label} className="notif-stat">
          <div className="notif-stat-value" style={{ color: s.color }}>{s.value ?? '—'}</div>
          <div className="notif-stat-label">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function ReminderEditor({ reminders, onChange }) {
  const add = () => {
    onChange([...reminders, { label: '2 hours before', minutes: 120, enabled: true }]);
  };
  const remove = (i) => onChange(reminders.filter((_, idx) => idx !== i));
  const setMinutes = (i, minutes) => {
    const preset = REMINDER_PRESETS.find(p => p.minutes === parseInt(minutes));
    onChange(reminders.map((r, idx) => idx === i ? { ...r, minutes: parseInt(minutes), label: preset?.label || formatReminderLabel(parseInt(minutes)) } : r));
  };
  const toggle = (i) => onChange(reminders.map((r, idx) => idx === i ? { ...r, enabled: !r.enabled } : r));

  return (
    <div className="reminder-editor">
      {reminders.map((r, i) => (
        <div key={i} className={`reminder-row ${!r.enabled ? 'disabled' : ''}`}>
          <button
            className={`reminder-toggle ${r.enabled ? 'on' : 'off'}`}
            onClick={() => toggle(i)}
            title={r.enabled ? 'Disable' : 'Enable'}
          >
            <span className="toggle-knob" />
          </button>
          <select
            value={r.minutes}
            onChange={e => setMinutes(i, e.target.value)}
            className="reminder-select"
            disabled={!r.enabled}
          >
            {REMINDER_PRESETS.map(p => (
              <option key={p.minutes} value={p.minutes}>{p.label}</option>
            ))}
          </select>
          <button className="reminder-remove" onClick={() => remove(i)}>✕</button>
        </div>
      ))}
      <button className="btn-add-reminder" onClick={add}>+ Add reminder</button>
    </div>
  );
}

function PushSetupPanel({ pushEnabled, onToggle }) {
  const [pushStatus, setPushStatus] = useState('idle'); // idle | requesting | granted | denied | unsupported
  const [subbed, setSubbed] = useState(false);

  const setupPush = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setPushStatus('unsupported');
      return;
    }
    setPushStatus('requesting');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setPushStatus('denied');
      return;
    }
    try {
      const { publicKey } = await apiGetVapidKey();
      if (publicKey) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: publicKey,
        });
        await apiSubscribePush(sub.toJSON());
      }
      setPushStatus('granted');
      setSubbed(true);
      onToggle(true);
    } catch (err) {
      setPushStatus('denied');
      console.error('Push setup error:', err);
    }
  };

  const STATUS_MSG = {
    idle:        'Click to enable push notifications',
    requesting:  'Requesting permission…',
    granted:     '✅ Push notifications enabled',
    denied:      '❌ Permission denied — please allow in browser settings',
    unsupported: '❌ Push not supported in this browser',
  };

  return (
    <div className="push-panel">
      <div className="push-panel-status">{STATUS_MSG[pushStatus]}</div>
      {!subbed && pushStatus !== 'granted' && (
        <button
          className="btn btn-secondary btn-sm push-btn"
          onClick={setupPush}
          disabled={pushStatus === 'requesting' || pushStatus === 'unsupported'}
        >
          {pushStatus === 'requesting' ? '…' : '🔔 Enable Push'}
        </button>
      )}
      <div className="push-info">
        Web Push sends notifications directly to your browser/device even when Band Planner isn't open.
        Firebase FCM is also supported for mobile app integration.
      </div>
    </div>
  );
}

function ScheduledJobs({ jobs }) {
  const pending = jobs.filter(j => j.status === 'pending');
  if (!pending.length) return <div className="jobs-empty">No pending notification jobs.</div>;

  const fmt = (iso) => iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

  return (
    <div className="jobs-list">
      {pending.map(j => (
        <div key={j.id} className="job-item">
          <div className="job-item-left">
            <div className="job-channels">
              {(j.channels || ['email']).map(c => (
                <span key={c} className="job-channel-tag">{CHANNEL_ICON[c]}</span>
              ))}
            </div>
          </div>
          <div className="job-info">
            <div className="job-gig">{j.gig_title}</div>
            <div className="job-fire">Fires at {fmt(j.fire_at)}</div>
          </div>
          <div className="job-label">
            {formatReminderLabel(j.reminder_minutes)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const TABS = ['History', 'Preferences', 'Scheduled', 'Send Now'];

export default function NotificationsPage() {
  const [tab, setTab] = useState('History');
  const [history, setHistory] = useState([]);
  const [prefs, setPrefs] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [historyFilter, setHistoryFilter] = useState({ channel: '', status: '' });

  // Send Now state
  const [sendGigId, setSendGigId] = useState('g-001');
  const [sendChannel, setSendChannel] = useState('email');
  const [sendMinutes, setSendMinutes] = useState(60);
  const [sending, setSending] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [h, p, j, s] = await Promise.all([
        apiGetHistory(),
        apiGetPreferences(),
        apiGetJobs(),
        apiGetStats(),
      ]);
      setHistory(h);
      setPrefs(p);
      setJobs(j);
      setStats(s);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const refreshHistory = async () => {
    const h = await apiGetHistory(historyFilter);
    setHistory(h);
  };

  useEffect(() => { refreshHistory(); }, [historyFilter]); // eslint-disable-line

  const handleMarkRead = async (id) => {
    await apiMarkRead(id);
    setHistory(prev => prev.map(n => n.id === id ? { ...n, status: 'read' } : n));
  };

  const handleMarkAllRead = async () => {
    await apiMarkAllRead();
    setHistory(prev => prev.map(n => ({ ...n, status: 'read' })));
    showToast('All notifications marked as read');
  };

  const handleSavePrefs = async () => {
    setSaving(true);
    try {
      const updated = await apiUpdatePreferences(prefs);
      setPrefs(updated);
      showToast('Preferences saved!');
    } catch (err) {
      showToast('Failed to save preferences', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    setSending(true);
    try {
      const result = await apiSendTest();
      showToast(result.message);
      await refreshHistory();
    } catch (err) {
      showToast('Failed to send test: ' + err.message, 'error');
    } finally {
      setSending(false);
    }
  };

  const handleSendNow = async () => {
    setSending(true);
    try {
      const result = await apiSendNow(sendGigId, { channel: sendChannel, minutesBefore: sendMinutes });
      showToast(result.message);
      await refreshHistory();
    } catch (err) {
      showToast('Failed: ' + err.message, 'error');
    } finally {
      setSending(false);
    }
  };

  const unread = history.filter(n => n.status === 'sent').length;

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div className="page notif-page">
      {toast && (
        <div className={`notif-toast ${toast.type}`}>
          {toast.type === 'error' ? '❌' : '✅'} {toast.msg}
        </div>
      )}

      {/* Stats row */}
      {stats && <StatsRow stats={stats} />}

      {/* Tabs */}
      <div className="notif-tabs">
        {TABS.map(t => (
          <button
            key={t}
            className={`notif-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
            {t === 'History' && unread > 0 && <span className="tab-badge">{unread}</span>}
            {t === 'Scheduled' && jobs.filter(j => j.status === 'pending').length > 0 &&
              <span className="tab-badge tab-badge-neutral">{jobs.filter(j => j.status === 'pending').length}</span>
            }
          </button>
        ))}
      </div>

      {/* ── HISTORY ── */}
      {tab === 'History' && (
        <div className="notif-panel-body">
          <div className="history-toolbar">
            <div className="history-filters">
              <select value={historyFilter.channel} onChange={e => setHistoryFilter(f => ({ ...f, channel: e.target.value }))}>
                <option value="">All channels</option>
                <option value="email">Email</option>
                <option value="push">Push</option>
              </select>
              <select value={historyFilter.status} onChange={e => setHistoryFilter(f => ({ ...f, status: e.target.value }))}>
                <option value="">All statuses</option>
                <option value="sent">Unread</option>
                <option value="read">Read</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            {unread > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={handleMarkAllRead}>
                Mark all read
              </button>
            )}
          </div>
          <div className="history-list">
            {history.length === 0 && (
              <div className="notif-empty-state">
                <div className="empty-icon">📭</div>
                <div>No notifications yet</div>
                <div className="empty-sub">Notifications will appear here once your gig reminders fire</div>
              </div>
            )}
            {history.map(item => (
              <HistoryItem key={item.id} item={item} onRead={handleMarkRead} />
            ))}
          </div>
        </div>
      )}

      {/* ── PREFERENCES ── */}
      {tab === 'Preferences' && prefs && (
        <div className="notif-panel-body prefs-panel">
          <div className="pref-section">
            <div className="pref-section-title">Email Notifications</div>
            <div className="pref-row">
              <div className="pref-row-info">
                <div className="pref-row-label">Email reminders</div>
                <div className="pref-row-sub">Receive gig reminders via email</div>
              </div>
              <button
                className={`toggle-switch ${prefs.email_enabled ? 'on' : 'off'}`}
                onClick={() => setPrefs(p => ({ ...p, email_enabled: !p.email_enabled }))}
              >
                <span className="toggle-knob" />
              </button>
            </div>
            {prefs.email_enabled && (
              <div className="form-group" style={{ marginTop: 12 }}>
                <label>Override email address (leave blank to use account email)</label>
                <input
                  value={prefs.email_address || ''}
                  onChange={e => setPrefs(p => ({ ...p, email_address: e.target.value }))}
                  placeholder="band@yourdomain.com"
                  type="email"
                />
              </div>
            )}
          </div>

          <div className="pref-divider" />

          <div className="pref-section">
            <div className="pref-section-title">Push Notifications</div>
            <div className="pref-row">
              <div className="pref-row-info">
                <div className="pref-row-label">Browser / device push</div>
                <div className="pref-row-sub">Instant push to your browser or mobile device</div>
              </div>
              <button
                className={`toggle-switch ${prefs.push_enabled ? 'on' : 'off'}`}
                onClick={() => setPrefs(p => ({ ...p, push_enabled: !p.push_enabled }))}
              >
                <span className="toggle-knob" />
              </button>
            </div>
            {prefs.push_enabled && (
              <PushSetupPanel
                pushEnabled={prefs.push_enabled}
                onToggle={(val) => setPrefs(p => ({ ...p, push_enabled: val }))}
              />
            )}
          </div>

          <div className="pref-divider" />

          <div className="pref-section">
            <div className="pref-section-title">Reminder Timing</div>
            <div className="pref-row-sub" style={{ marginBottom: 14 }}>
              Set when to receive reminders before each gig. Multiple reminders can be active.
            </div>
            <ReminderEditor
              reminders={prefs.reminders}
              onChange={reminders => setPrefs(p => ({ ...p, reminders }))}
            />
          </div>

          <div className="pref-actions">
            <button className="btn btn-secondary btn-sm" onClick={handleSendTest} disabled={sending}>
              {sending ? '…' : '📧 Send test email'}
            </button>
            <button className="btn btn-primary" onClick={handleSavePrefs} disabled={saving}>
              {saving ? 'Saving…' : 'Save Preferences'}
            </button>
          </div>
        </div>
      )}

      {/* ── SCHEDULED ── */}
      {tab === 'Scheduled' && (
        <div className="notif-panel-body">
          <div className="scheduled-header">
            <div>
              <div className="sched-title">Pending Notification Jobs</div>
              <div className="sched-sub">These will fire automatically when each gig's reminder time arrives</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={loadAll}>↻ Refresh</button>
          </div>
          <ScheduledJobs jobs={jobs} />
        </div>
      )}

      {/* ── SEND NOW ── */}
      {tab === 'Send Now' && (
        <div className="notif-panel-body send-now-panel">
          <div className="send-now-header">
            <div className="sched-title">Manual Send</div>
            <div className="sched-sub">Send a notification immediately for testing or urgent updates</div>
          </div>

          <div className="send-now-form card">
            <div className="send-now-form-title">Send Gig Reminder</div>
            <div className="grid-2" style={{ marginBottom: 14 }}>
              <div className="form-group">
                <label>Gig</label>
                <select value={sendGigId} onChange={e => setSendGigId(e.target.value)}>
                  <option value="g-001">West Coast Kickoff – Austin</option>
                  <option value="g-002">Neumos Night – Seattle</option>
                  <option value="g-003">Fillmore Friday – San Francisco</option>
                  <option value="g-005">Local Warm-Up Show</option>
                </select>
              </div>
              <div className="form-group">
                <label>Channel</label>
                <select value={sendChannel} onChange={e => setSendChannel(e.target.value)}>
                  <option value="email">📧 Email</option>
                  <option value="push">📲 Push</option>
                </select>
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label>Simulate: minutes before show</label>
              <select value={sendMinutes} onChange={e => setSendMinutes(parseInt(e.target.value))}>
                {REMINDER_PRESETS.map(p => (
                  <option key={p.minutes} value={p.minutes}>{p.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" onClick={handleSendNow} disabled={sending}>
                {sending ? 'Sending…' : '🚀 Send Now'}
              </button>
            </div>
          </div>

          <div className="send-now-form card" style={{ marginTop: 16 }}>
            <div className="send-now-form-title">Test Email</div>
            <div className="sched-sub" style={{ marginBottom: 16 }}>
              Send a test email to verify your SMTP configuration is working correctly.
            </div>
            <button className="btn btn-secondary" onClick={handleSendTest} disabled={sending}>
              {sending ? 'Sending…' : '📧 Send Test Email'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
