// backend/src/templates/emailTemplates.js

const baseStyle = `
  body { margin:0; padding:0; background:#0c0c0e; font-family:'Helvetica Neue',Arial,sans-serif; }
  .wrapper { max-width:600px; margin:0 auto; padding:32px 16px; }
  .card { background:#131316; border:1px solid #2a2a32; border-radius:12px; overflow:hidden; }
  .header { background:#f0522a; padding:28px 32px; }
  .header-label { color:rgba(255,255,255,.7); font-size:11px; text-transform:uppercase; letter-spacing:.15em; margin-bottom:6px; }
  .header-title { color:#fff; font-size:26px; font-weight:700; line-height:1.2; }
  .body { padding:28px 32px; }
  .greeting { color:#e8e8f0; font-size:15px; margin-bottom:20px; }
  .gig-block { background:#1a1a1f; border:1px solid #2a2a32; border-radius:8px; padding:20px; margin-bottom:20px; }
  .gig-title { color:#e8e8f0; font-size:18px; font-weight:700; margin-bottom:14px; }
  .detail-row { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
  .detail-icon { font-size:16px; width:20px; text-align:center; }
  .detail-text { color:#9090a8; font-size:14px; }
  .detail-text strong { color:#e8e8f0; }
  .timeline { background:#0c0c0e; border-radius:8px; padding:16px; margin:16px 0; }
  .timeline-title { color:#5a5a72; font-size:11px; text-transform:uppercase; letter-spacing:.1em; margin-bottom:12px; }
  .time-row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #1a1a1f; }
  .time-label { color:#5a5a72; font-size:13px; }
  .time-value { color:#e8e8f0; font-size:13px; font-weight:600; font-family:monospace; }
  .attachments { margin-top:16px; }
  .attach-title { color:#5a5a72; font-size:11px; text-transform:uppercase; letter-spacing:.1em; margin-bottom:8px; }
  .attach-item { display:flex; align-items:center; gap:8px; padding:8px; background:#0c0c0e; border-radius:6px; margin-bottom:4px; }
  .attach-icon { color:#f0522a; font-size:14px; }
  .attach-name { color:#9090a8; font-size:13px; }
  .cta { display:inline-block; background:#f0522a; color:#fff; text-decoration:none; padding:12px 24px; border-radius:8px; font-weight:600; font-size:14px; margin:16px 0; }
  .footer { padding:20px 32px; border-top:1px solid #2a2a32; }
  .footer-text { color:#3a3a45; font-size:12px; line-height:1.6; }
  .countdown { background:rgba(240,82,42,.1); border:1px solid rgba(240,82,42,.3); border-radius:8px; padding:14px 18px; margin-bottom:18px; }
  .countdown-text { color:#f0522a; font-size:15px; font-weight:600; }
  .badge { display:inline-block; padding:3px 10px; border-radius:4px; font-size:11px; font-weight:600; letter-spacing:.05em; }
  .badge-confirmed { background:rgba(41,204,106,.15); color:#29cc6a; }
  .badge-inquiry   { background:rgba(245,200,66,.15);  color:#f5c842; }
`;

const footer = () => `
  <div class="footer">
    <p class="footer-text">
      You're receiving this because you have gig reminders enabled in Band Planner.<br>
      <a href="#" style="color:#5a5a72;">Manage notification settings</a> · 
      <a href="#" style="color:#5a5a72;">Unsubscribe</a>
    </p>
  </div>
`;

const formatTime = (t) => {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2,'0')} ${period}`;
};

const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
};

const formatCountdown = (minutes) => {
  if (minutes >= 1440) return `${Math.round(minutes / 1440)} day${minutes >= 2880 ? 's' : ''} away`;
  if (minutes >= 60)   return `${Math.round(minutes / 60)} hour${minutes >= 120 ? 's' : ''} away`;
  return `${minutes} minute${minutes !== 1 ? 's' : ''} away`;
};

// ─── GIG REMINDER ─────────────────────────────────────────────────────────────
const gigReminderTemplate = ({ userName, gig, attachments = [], minutesBefore }) => {
  const firstName = userName?.split(' ')[0] || 'there';
  const countdownText = formatCountdown(minutesBefore);
  const hasSetlist = attachments.some(a => a.label === 'setlist' || a.file_name?.toLowerCase().includes('setlist'));
  const hasContract = attachments.some(a => a.label === 'contract');

  const subject = `🎸 Show reminder: ${gig.title} is ${countdownText}`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>${baseStyle}</style></head><body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="header-label">🎸 Band Planner · Show Reminder</div>
        <div class="header-title">${gig.title}</div>
      </div>
      <div class="body">
        <p class="greeting">Hey ${firstName},</p>
        <div class="countdown">
          <div class="countdown-text">⏰ Your show is ${countdownText}</div>
        </div>
        
        <div class="gig-block">
          <div class="gig-title">${gig.title} <span class="badge badge-${gig.status}">${gig.status}</span></div>
          
          <div class="detail-row">
            <span class="detail-icon">📍</span>
            <span class="detail-text"><strong>${gig.venue_name}</strong> · ${gig.venue_city}${gig.state ? `, ${gig.state}` : ''}</span>
          </div>
          ${gig.venue_address ? `<div class="detail-row">
            <span class="detail-icon">🗺</span>
            <span class="detail-text">${gig.venue_address}</span>
          </div>` : ''}
          <div class="detail-row">
            <span class="detail-icon">📅</span>
            <span class="detail-text"><strong>${formatDate(gig.gig_date)}</strong></span>
          </div>
          ${gig.tour_name ? `<div class="detail-row">
            <span class="detail-icon">🗺</span>
            <span class="detail-text">Part of <strong>${gig.tour_name}</strong></span>
          </div>` : ''}
          ${gig.deal_amount ? `<div class="detail-row">
            <span class="detail-icon">💰</span>
            <span class="detail-text"><strong>$${Number(gig.deal_amount).toLocaleString()}</strong> · ${gig.deal_type?.replace(/_/g,' ')}</span>
          </div>` : ''}
          
          <div class="timeline">
            <div class="timeline-title">Show Schedule</div>
            ${gig.load_in_time   ? `<div class="time-row"><span class="time-label">Load-In</span><span class="time-value">${formatTime(gig.load_in_time)}</span></div>` : ''}
            ${gig.soundcheck_time? `<div class="time-row"><span class="time-label">Soundcheck</span><span class="time-value">${formatTime(gig.soundcheck_time)}</span></div>` : ''}
            ${gig.start_time     ? `<div class="time-row"><span class="time-label">Doors / Start</span><span class="time-value">${formatTime(gig.start_time)}</span></div>` : ''}
            ${gig.end_time       ? `<div class="time-row"><span class="time-label">End</span><span class="time-value">${formatTime(gig.end_time)}</span></div>` : ''}
          </div>
          
          ${gig.notes ? `<div style="background:#0c0c0e;border-radius:6px;padding:12px;margin-top:12px;">
            <div style="color:#5a5a72;font-size:11px;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px;">Notes</div>
            <div style="color:#9090a8;font-size:13px;line-height:1.6;">${gig.notes}</div>
          </div>` : ''}
        </div>
        
        ${attachments.length > 0 ? `
        <div class="attachments">
          <div class="attach-title">📎 Attachments (${attachments.length})</div>
          ${attachments.map(a => `
          <div class="attach-item">
            <span class="attach-icon">${a.mime_type?.includes('image') ? '🖼' : '📄'}</span>
            <span class="attach-name">${a.file_name} <span style="color:#3a3a45">(${a.label})</span></span>
          </div>`).join('')}
        </div>` : ''}
        
        ${!hasSetlist && minutesBefore <= 1440 ? `
        <div style="background:rgba(245,200,66,.08);border:1px solid rgba(245,200,66,.2);border-radius:8px;padding:12px 16px;margin:16px 0;">
          <span style="color:#f5c842;font-size:13px;">⚠️ No setlist uploaded yet — make sure you're prepared!</span>
        </div>` : ''}
        
        <a href="${process.env.APP_URL || 'http://localhost:3000'}/gigs" class="cta">View Gig Details →</a>
      </div>
      ${footer()}
    </div>
  </div>
  </body></html>`;

  const text = `SHOW REMINDER: ${gig.title}
  
Your show is ${countdownText}.

📍 Venue: ${gig.venue_name}, ${gig.venue_city}
📅 Date:  ${formatDate(gig.gig_date)}
🕐 Load-in: ${formatTime(gig.load_in_time)} | Soundcheck: ${formatTime(gig.soundcheck_time)} | Doors: ${formatTime(gig.start_time)}
${gig.notes ? `\nNotes: ${gig.notes}` : ''}
${attachments.length ? `\nAttachments: ${attachments.map(a => a.file_name).join(', ')}` : ''}

View in Band Planner: ${process.env.APP_URL || 'http://localhost:3000'}/gigs
`;

  return { subject, html, text };
};

// ─── GIG UPDATE ───────────────────────────────────────────────────────────────
const gigUpdateTemplate = ({ userName, gig, changeDescription }) => {
  const firstName = userName?.split(' ')[0] || 'there';
  const subject = `📋 Gig updated: ${gig.title}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseStyle}</style></head><body>
  <div class="wrapper"><div class="card">
    <div class="header" style="background:#4a8cff;">
      <div class="header-label">📋 Band Planner · Gig Update</div>
      <div class="header-title">${gig.title}</div>
    </div>
    <div class="body">
      <p class="greeting">Hey ${firstName},</p>
      <p style="color:#9090a8;font-size:14px;margin-bottom:20px;">A gig has been updated:</p>
      <div class="gig-block">
        <div class="gig-title">${gig.title}</div>
        <div style="color:#9090a8;font-size:14px;line-height:1.6;background:#0c0c0e;border-radius:6px;padding:12px;">
          ${changeDescription}
        </div>
        <div style="margin-top:14px;">
          <div class="detail-row"><span class="detail-icon">📍</span><span class="detail-text"><strong>${gig.venue_name}</strong> · ${gig.venue_city}</span></div>
          <div class="detail-row"><span class="detail-icon">📅</span><span class="detail-text"><strong>${formatDate(gig.gig_date)}</strong></span></div>
        </div>
      </div>
      <a href="${process.env.APP_URL || 'http://localhost:3000'}/gigs" class="cta">View Updated Details →</a>
    </div>
    ${footer()}
  </div></div></body></html>`;
  const text = `GIG UPDATE: ${gig.title}\n\n${changeDescription}\n\nView: ${process.env.APP_URL}/gigs`;
  return { subject, html, text };
};

// ─── TEST EMAIL ────────────────────────────────────────────────────────────────
const testTemplate = ({ userName }) => {
  const firstName = userName?.split(' ')[0] || 'there';
  const subject = '✅ Band Planner notifications are working!';
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseStyle}</style></head><body>
  <div class="wrapper"><div class="card">
    <div class="header" style="background:#29cc6a;">
      <div class="header-label">✅ Band Planner · Test Notification</div>
      <div class="header-title">Notifications Active</div>
    </div>
    <div class="body">
      <p class="greeting">Hey ${firstName}!</p>
      <p style="color:#9090a8;font-size:15px;line-height:1.7;">
        Your email notifications are set up and working correctly. You'll receive reminders before your upcoming gigs with full details including venue, schedule, and attached documents.
      </p>
      <div class="gig-block" style="margin-top:20px;">
        <div class="gig-title" style="font-size:14px;color:#5a5a72;margin-bottom:10px;">WHAT YOU'LL RECEIVE</div>
        <div class="detail-row"><span class="detail-icon">⏰</span><span class="detail-text">Configurable reminders (1h, 24h, etc.) before each gig</span></div>
        <div class="detail-row"><span class="detail-icon">📍</span><span class="detail-text">Full venue details and contact info</span></div>
        <div class="detail-row"><span class="detail-icon">🕐</span><span class="detail-text">Schedule: load-in, soundcheck, and doors times</span></div>
        <div class="detail-row"><span class="detail-icon">📎</span><span class="detail-text">Links to contracts, riders, and setlists</span></div>
      </div>
      <a href="${process.env.APP_URL || 'http://localhost:3000'}/notifications" class="cta">Manage Preferences →</a>
    </div>
    ${footer()}
  </div></div></body></html>`;
  const text = `Hey ${firstName}! Your Band Planner email notifications are working correctly.`;
  return { subject, html, text };
};

module.exports = { gigReminderTemplate, gigUpdateTemplate, testTemplate };
