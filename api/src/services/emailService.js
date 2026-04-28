// backend/src/services/emailService.js
const nodemailer = require('nodemailer');
const { gigReminderTemplate, gigUpdateTemplate, testTemplate } = require('../templates/emailTemplates');

// ─── Transporter ─────────────────────────────────────────────────────────────
// Uses SMTP env vars. For dev: set EMAIL_DRIVER=log to just console.log
const createTransporter = () => {
  if (process.env.EMAIL_DRIVER === 'log') {
    return null; // log-only mode
  }
  if (process.env.EMAIL_DRIVER === 'sendgrid') {
    return nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: { user: 'apikey', pass: process.env.SENDGRID_API_KEY },
    });
  }
  // Default: generic SMTP (Mailgun, Amazon SES, etc.)
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.mailtrap.io',
    port:   parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

let transporter = null;
const getTransporter = () => {
  if (!transporter) transporter = createTransporter();
  return transporter;
};

// ─── Core send function ───────────────────────────────────────────────────────
const sendEmail = async ({ to, subject, html, text }) => {
  if (process.env.EMAIL_DRIVER === 'log') {
    console.log('\n📧  [EMAIL — log mode]');
    console.log(`   To:      ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Body:    ${text?.slice(0, 200) ?? '(html only)'}\n`);
    return { messageId: `log-${Date.now()}` };
  }

  const result = await getTransporter().sendMail({
    from: `"${process.env.EMAIL_FROM_NAME || 'Band Planner'}" <${process.env.EMAIL_FROM_ADDRESS || 'noreply@bandplanner.dev'}>`,
    to,
    subject,
    html,
    text,
  });
  return result;
};

// ─── Typed senders ────────────────────────────────────────────────────────────

/**
 * Send a gig reminder email.
 * @param {Object} params
 * @param {string} params.to - recipient email
 * @param {string} params.userName - e.g. "Alex Rivera"
 * @param {Object} params.gig - gig row with venue_name, venue_city, gig_date, start_time, etc.
 * @param {Object[]} params.attachments - attachment rows for this gig
 * @param {number} params.minutesBefore - 60 | 1440 etc.
 */
const sendGigReminder = async ({ to, userName, gig, attachments = [], minutesBefore }) => {
  const { subject, html, text } = gigReminderTemplate({ userName, gig, attachments, minutesBefore });
  return sendEmail({ to, subject, html, text });
};

const sendGigUpdate = async ({ to, userName, gig, changeDescription }) => {
  const { subject, html, text } = gigUpdateTemplate({ userName, gig, changeDescription });
  return sendEmail({ to, subject, html, text });
};

const sendTestEmail = async ({ to, userName }) => {
  const { subject, html, text } = testTemplate({ userName });
  return sendEmail({ to, subject, html, text });
};

module.exports = { sendEmail, sendGigReminder, sendGigUpdate, sendTestEmail };
