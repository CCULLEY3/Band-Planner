// backend/src/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const db     = require('../config/db');
const { validationResult } = require('express-validator');

// ─── Config ───────────────────────────────────────────────────────────────────
const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET  || 'dev-access-secret-change-me';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me';
const ACCESS_TTL     = '15m';
const REFRESH_TTL_S  = 7 * 24 * 60 * 60; // 7 days
const SALT_ROUNDS    = 12;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sign   = (payload, secret, opts) => jwt.sign(payload, secret, opts);
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

const setRefreshCookie = (res, token) =>
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   REFRESH_TTL_S * 1000,
    path:     '/auth/refresh',
  });

const clearRefreshCookie = (res) =>
  res.clearCookie('refreshToken', { path: '/auth/refresh' });

// Build JWT payload: includes band memberships so middleware can avoid DB queries
const buildPayload = async (userId) => {
  const { rows: [u] } = await db.query(
    `SELECT id, name, email, avatar_color FROM users WHERE id=$1`, [userId]
  );
  const { rows: memberships } = await db.query(
    `SELECT band_id, role FROM band_members WHERE user_id=$1`, [userId]
  );
  return {
    sub:         u.id,
    name:        u.name,
    email:       u.email,
    avatarColor: u.avatar_color,
    bands:       memberships.map(m => ({ bandId: m.band_id, role: m.role })),
  };
};

const storeRefreshToken = async (userId, token, family, req) =>
  db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, family, expires_at, user_agent, ip_address)
     VALUES ($1, $2, $3, NOW() + ($4 || ' seconds')::INTERVAL, $5, $6::inet)`,
    [userId, sha256(token), family, REFRESH_TTL_S,
     req?.headers?.['user-agent']?.slice(0, 200) || null,
     req?.ip || null]
  );

// ── POST /auth/register ───────────────────────────────────────────────────────
const register = async (req, res, next) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(422).json({ errors: errs.array() });

  const { name, email, password, bandName, joinCode } = req.body;
  const normalEmail = email.toLowerCase().trim();

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Duplicate email check
    const { rows: exists } = await client.query(
      `SELECT id FROM users WHERE LOWER(email)=$1`, [normalEmail]
    );
    if (exists.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'That email is already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const COLORS = ['#f0522a','#4a8cff','#29cc6a','#f5c842','#c44aff','#ff6b9d','#00d4aa'];
    const avatarColor = COLORS[Math.floor(Math.random() * COLORS.length)];

    // Create user
    const { rows: [user] } = await client.query(
      `INSERT INTO users (name, email, password_hash, avatar_color)
       VALUES ($1, $2, $3, $4) RETURNING id, name, email, avatar_color`,
      [name.trim(), normalEmail, passwordHash, avatarColor]
    );

    let bandId = null, role = 'band_member';

    // Option A: Join via invite token
    if (joinCode) {
      const { rows: [inv] } = await client.query(
        `SELECT * FROM band_invitations
         WHERE token=$1 AND LOWER(email)=$2
           AND accepted_at IS NULL AND expires_at > NOW()`,
        [joinCode, normalEmail]
      );
      if (!inv) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid or expired invite code.' });
      }
      bandId = inv.band_id;
      role   = inv.role;
      await client.query(
        `UPDATE band_invitations SET accepted_at=NOW() WHERE id=$1`, [inv.id]
      );
    }

    // Option B: Create new band (becomes leader)
    if (bandName && !joinCode) {
      const { rows: [band] } = await client.query(
        `INSERT INTO bands (name) VALUES ($1) RETURNING id`, [bandName.trim()]
      );
      bandId = band.id;
      role   = 'band_leader';
    }

    if (bandId) {
      await client.query(
        `INSERT INTO band_members (band_id, user_id, role) VALUES ($1,$2,$3)`,
        [bandId, user.id, role]
      );
    }

    await client.query('COMMIT');

    // Issue tokens
    const payload      = await buildPayload(user.id);
    const accessToken  = sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL });
    const refreshToken = sign({ sub: user.id }, REFRESH_SECRET, { expiresIn: `${REFRESH_TTL_S}s` });
    const family       = crypto.randomUUID();

    await storeRefreshToken(user.id, refreshToken, family, req);
    setRefreshCookie(res, refreshToken);
    res.status(201).json({ accessToken, user: payload });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// ── POST /auth/login ──────────────────────────────────────────────────────────
const login = async (req, res, next) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(422).json({ errors: errs.array() });

  const { email, password } = req.body;
  try {
    const { rows: [user] } = await db.query(
      `SELECT id, name, email, password_hash, avatar_color FROM users WHERE LOWER(email)=$1`,
      [email.toLowerCase().trim()]
    );

    // Constant-time compare to avoid user enumeration
    const hash = user?.password_hash || '$2b$12$invalidhashpadding000000000000000000000000000000000000000';
    const valid = await bcrypt.compare(password, hash);
    if (!user || !valid) return res.status(401).json({ error: 'Invalid email or password.' });

    await db.query(`UPDATE users SET last_login_at=NOW() WHERE id=$1`, [user.id]);

    const payload      = await buildPayload(user.id);
    const accessToken  = sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL });
    const refreshToken = sign({ sub: user.id }, REFRESH_SECRET, { expiresIn: `${REFRESH_TTL_S}s` });
    const family       = crypto.randomUUID();

    await storeRefreshToken(user.id, refreshToken, family, req);
    setRefreshCookie(res, refreshToken);
    res.json({ accessToken, user: payload });
  } catch (err) { next(err); }
};

// ── POST /auth/refresh ────────────────────────────────────────────────────────
const refresh = async (req, res, next) => {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ error: 'No refresh token.' });

  try {
    let decoded;
    try { decoded = jwt.verify(token, REFRESH_SECRET); }
    catch { clearRefreshCookie(res); return res.status(401).json({ error: 'Invalid refresh token.' }); }

    const { rows: [rt] } = await db.query(
      `SELECT * FROM refresh_tokens WHERE token_hash=$1`, [sha256(token)]
    );

    if (!rt) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Refresh token not recognised.' });
    }

    // Reuse detection: if a used token is presented, the family is compromised
    if (rt.used) {
      await db.query(`DELETE FROM refresh_tokens WHERE family=$1`, [rt.family]);
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Token reuse detected. Please log in again.' });
    }

    if (new Date(rt.expires_at) < new Date()) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Refresh token expired.' });
    }

    // Mark old as used, issue new pair
    await db.query(`UPDATE refresh_tokens SET used=TRUE WHERE id=$1`, [rt.id]);

    const payload      = await buildPayload(decoded.sub);
    const accessToken  = sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL });
    const newRefresh   = sign({ sub: decoded.sub }, REFRESH_SECRET, { expiresIn: `${REFRESH_TTL_S}s` });

    await db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, family, expires_at)
       VALUES ($1,$2,$3, NOW() + ($4 || ' seconds')::INTERVAL)`,
      [decoded.sub, sha256(newRefresh), rt.family, REFRESH_TTL_S]
    );

    setRefreshCookie(res, newRefresh);
    res.json({ accessToken, user: payload });
  } catch (err) { next(err); }
};

// ── POST /auth/logout ─────────────────────────────────────────────────────────
const logout = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (token) await db.query(`DELETE FROM refresh_tokens WHERE token_hash=$1`, [sha256(token)]);
    clearRefreshCookie(res);
    res.status(204).end();
  } catch (err) { next(err); }
};

// ── GET /auth/me ──────────────────────────────────────────────────────────────
const me = async (req, res, next) => {
  try {
    const { rows: [user] } = await db.query(
      `SELECT id, name, email, avatar_color, last_login_at, created_at FROM users WHERE id=$1`,
      [req.user.id]
    );
    const { rows: bands } = await db.query(
      `SELECT bm.band_id AS "bandId", bm.role, b.name AS "bandName"
       FROM band_members bm JOIN bands b ON b.id=bm.band_id
       WHERE bm.user_id=$1`, [req.user.id]
    );
    res.json({ ...user, bands });
  } catch (err) { next(err); }
};

// ── PATCH /auth/me ────────────────────────────────────────────────────────────
const updateMe = async (req, res, next) => {
  const { name, currentPassword, newPassword } = req.body;
  try {
    const { rows: [user] } = await db.query(
      `SELECT id, password_hash FROM users WHERE id=$1`, [req.user.id]
    );
    const sets = []; const vals = []; let i = 1;

    if (name?.trim()) { sets.push(`name=$${i++}`); vals.push(name.trim()); }

    if (newPassword) {
      if (!currentPassword) return res.status(422).json({ error: 'currentPassword required.' });
      const ok = await bcrypt.compare(currentPassword, user.password_hash || '');
      if (!ok) return res.status(403).json({ error: 'Current password incorrect.' });
      if (newPassword.length < 8) return res.status(422).json({ error: 'New password too short.' });
      sets.push(`password_hash=$${i++}`);
      vals.push(await bcrypt.hash(newPassword, SALT_ROUNDS));
    }

    if (!sets.length) return res.status(422).json({ error: 'Nothing to update.' });
    vals.push(user.id);
    const { rows: [updated] } = await db.query(
      `UPDATE users SET ${sets.join(',')} WHERE id=$${i} RETURNING id, name, email, avatar_color`,
      vals
    );
    res.json(updated);
  } catch (err) { next(err); }
};

// ── POST /bands/:bandId/invite ────────────────────────────────────────────────
const inviteMember = async (req, res, next) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(422).json({ errors: errs.array() });

  const { email, role = 'band_member' } = req.body;
  const { bandId } = req.params;

  try {
    const token = crypto.randomBytes(32).toString('hex');
    await db.query(
      `INSERT INTO band_invitations (band_id, email, role, token, invited_by)
       VALUES ($1, LOWER($2), $3, $4, $5)`,
      [bandId, email, role, token, req.user.id]
    );
    const APP_URL = process.env.APP_URL || 'http://localhost:3000';
    // In production: send email via nodemailer/sendgrid with this link
    res.json({
      token,
      inviteUrl: `${APP_URL}/register?invite=${token}`,
      message:   `Invitation created. Send the inviteUrl to ${email}.`,
    });
  } catch (err) { next(err); }
};

// ── GET /bands/:bandId/members ─────────────────────────────────────────────────
const listMembers = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.name, u.email, u.avatar_color,
              u.last_login_at, bm.role, bm.created_at AS joined_at
       FROM band_members bm
       JOIN users u ON u.id=bm.user_id
       WHERE bm.band_id=$1
       ORDER BY CASE bm.role
         WHEN 'band_leader' THEN 1 WHEN 'manager' THEN 2
         WHEN 'band_member' THEN 3 ELSE 4 END, u.name`,
      [req.params.bandId]
    );
    res.json(rows);
  } catch (err) { next(err); }
};

// ── PATCH /bands/:bandId/members/:userId/role ──────────────────────────────────
const updateMemberRole = async (req, res, next) => {
  const { role } = req.body;
  const VALID = ['band_leader','band_member','manager','guest'];
  if (!VALID.includes(role)) return res.status(422).json({ error: 'Invalid role.' });

  try {
    // Prevent removing the last leader
    if (role !== 'band_leader') {
      const { rows: [cnt] } = await db.query(
        `SELECT COUNT(*)::int AS c FROM band_members WHERE band_id=$1 AND role='band_leader'`,
        [req.params.bandId]
      );
      if (cnt.c <= 1 && req.params.userId === req.user.id)
        return res.status(400).json({ error: 'Cannot remove the last band leader.' });
    }
    const { rows: [m] } = await db.query(
      `UPDATE band_members SET role=$1 WHERE band_id=$2 AND user_id=$3 RETURNING *`,
      [role, req.params.bandId, req.params.userId]
    );
    if (!m) return res.status(404).json({ error: 'Member not found.' });
    res.json(m);
  } catch (err) { next(err); }
};

// ── DELETE /bands/:bandId/members/:userId ──────────────────────────────────────
const removeMember = async (req, res, next) => {
  try {
    const { rowCount } = await db.query(
      `DELETE FROM band_members WHERE band_id=$1 AND user_id=$2`,
      [req.params.bandId, req.params.userId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Member not found.' });
    res.status(204).end();
  } catch (err) { next(err); }
};

module.exports = {
  register, login, logout, refresh, me, updateMe,
  inviteMember, listMembers, updateMemberRole, removeMember,
};
