// frontend/src/pages/AuthPage.js
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AuthPage.css';

// ─── Field component ──────────────────────────────────────────────────────────
const Field = ({ label, type = 'text', value, onChange, error, autoFocus, placeholder, hint }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div className={`auth-field ${error ? 'has-error' : ''} ${focused || value ? 'active' : ''}`}>
      <label className="af-label">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        placeholder={focused ? placeholder : ''}
        autoComplete={type === 'password' ? 'current-password' : type === 'email' ? 'email' : 'off'}
        className="af-input"
      />
      <div className="af-bar"><div className="af-bar-fill" /></div>
      {error && <div className="af-error">{error}</div>}
      {hint && !error && <div className="af-hint">{hint}</div>}
    </div>
  );
};

// ─── Radio option ─────────────────────────────────────────────────────────────
const RadioCard = ({ value, selected, onChange, title, desc }) => (
  <button
    type="button"
    className={`radio-card ${selected ? 'selected' : ''}`}
    onClick={() => onChange(value)}
  >
    <div className="rc-dot"><div className="rc-dot-inner" /></div>
    <div>
      <div className="rc-title">{title}</div>
      <div className="rc-desc">{desc}</div>
    </div>
  </button>
);

// ─── Login form ───────────────────────────────────────────────────────────────
function LoginForm({ onSwitch }) {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const dest      = location.state?.from?.pathname || '/gigs';

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <div className="af-heading">
        <div className="af-title">Sign In</div>
        <div className="af-sub">Access your band dashboard</div>
      </div>

      {error && <div className="auth-banner error">{error}</div>}

      <Field label="EMAIL" type="email" value={email} onChange={setEmail}
        placeholder="your@email.com" autoFocus />
      <Field label="PASSWORD" type="password" value={password} onChange={setPassword}
        placeholder="••••••••" />

      <button type="submit" className={`auth-btn ${loading ? 'loading' : ''}`} disabled={loading}>
        <span className="ab-text">{loading ? 'Signing in…' : 'Sign In'}</span>
        <span className="ab-sweep" />
        <span className="ab-arrow">→</span>
      </button>

      <div className="auth-switch">
        New here?{' '}
        <button type="button" className="auth-link" onClick={onSwitch}>
          Create account
        </button>
      </div>
    </form>
  );
}

// ─── Register form ────────────────────────────────────────────────────────────
function RegisterForm({ onSwitch }) {
  const { register } = useAuth();
  const navigate     = useNavigate();
  const [params]     = useSearchParams();
  const inviteCode   = params.get('invite') || '';

  const [name,      setName]      = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [mode,      setMode]      = useState(inviteCode ? 'join' : 'create'); // 'create' | 'join'
  const [bandName,  setBandName]  = useState('');
  const [joinCode,  setJoinCode]  = useState(inviteCode);
  const [errors,    setErrors]    = useState({});
  const [loading,   setLoading]   = useState(false);
  const [banner,    setBanner]    = useState('');

  const validate = () => {
    const e = {};
    if (!name.trim() || name.trim().length < 2) e.name = 'At least 2 characters.';
    if (!email || !/\S+@\S+\.\S+/.test(email))  e.email = 'Valid email required.';
    if (password.length < 8)                    e.password = 'At least 8 characters.';
    if (mode === 'create' && !bandName.trim())   e.bandName = 'Band name required.';
    if (mode === 'join'   && !joinCode.trim())   e.joinCode = 'Invite code required.';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBanner('');
    if (!validate()) return;
    setLoading(true);
    try {
      await register({
        name, email, password,
        bandName: mode === 'create' ? bandName : undefined,
        joinCode:  mode === 'join'  ? joinCode  : undefined,
      });
      navigate('/gigs', { replace: true });
    } catch (err) {
      setBanner(err.message);
    }
    setLoading(false);
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <div className="af-heading">
        <div className="af-title">Create Account</div>
        <div className="af-sub">Get your band on the road</div>
      </div>

      {banner && <div className="auth-banner error">{banner}</div>}

      <Field label="YOUR NAME" value={name} onChange={setName}
        error={errors.name} placeholder="Jamie Rhodes" autoFocus />
      <Field label="EMAIL" type="email" value={email} onChange={setEmail}
        error={errors.email} placeholder="you@band.com" />
      <Field label="PASSWORD" type="password" value={password} onChange={setPassword}
        error={errors.password} placeholder="••••••••" hint="Minimum 8 characters" />

      {/* Band mode selector */}
      <div className="auth-mode-group">
        <div className="amg-label">BAND SETUP</div>
        <div className="amg-options">
          <RadioCard
            value="create" selected={mode === 'create'} onChange={setMode}
            title="Start a band" desc="Create a new band — you'll be the leader"
          />
          <RadioCard
            value="join" selected={mode === 'join'} onChange={setMode}
            title="Join a band" desc="Enter an invite code from your band leader"
          />
        </div>
      </div>

      {mode === 'create' && (
        <Field label="BAND NAME" value={bandName} onChange={setBandName}
          error={errors.bandName} placeholder="The Midnight Signals" />
      )}
      {mode === 'join' && (
        <Field label="INVITE CODE" value={joinCode} onChange={setJoinCode}
          error={errors.joinCode} placeholder="Paste your invite code"
          hint="Ask your band leader for an invite code" />
      )}

      <button type="submit" className={`auth-btn ${loading ? 'loading' : ''}`} disabled={loading}>
        <span className="ab-text">{loading ? 'Creating account…' : 'Create Account'}</span>
        <span className="ab-sweep" />
        <span className="ab-arrow">→</span>
      </button>

      <div className="auth-switch">
        Already in a band?{' '}
        <button type="button" className="auth-link" onClick={onSwitch}>Sign in</button>
      </div>
    </form>
  );
}

// ─── Animated poster panel ────────────────────────────────────────────────────
function PosterPanel() {
  const lines = ['BAND', 'PLAN-', 'NER'];
  return (
    <div className="poster-panel" aria-hidden="true">
      <div className="pp-noise" />
      <div className="pp-stripes" />
      <div className="pp-content">
        <div className="pp-eyebrow">BACKSTAGE MANAGEMENT</div>
        <div className="pp-wordmark">
          {lines.map((l, i) => (
            <div key={i} className="pp-wordmark-line" style={{ animationDelay: `${i * 0.12}s` }}>
              {l}
            </div>
          ))}
        </div>
        <div className="pp-tagline">GIGS · TOURS · VENUES · CREW</div>
        <div className="pp-divider" />
        <div className="pp-features">
          {['Tour routing & mileage', 'Gig calendar & export', 'Revenue analytics', 'Team collaboration'].map((f, i) => (
            <div key={i} className="pp-feature" style={{ animationDelay: `${0.6 + i * 0.1}s` }}>
              <span className="pp-feature-dot" />
              {f}
            </div>
          ))}
        </div>
        <div className="pp-year">{new Date().getFullYear()}</div>
      </div>
    </div>
  );
}

// ─── AuthPage ─────────────────────────────────────────────────────────────────
export default function AuthPage({ defaultMode = 'login' }) {
  const [params]  = useSearchParams();
  const hasInvite = !!params.get('invite');
  const [mode, setMode] = useState(hasInvite ? 'register' : defaultMode);

  // Flip animation on mode switch
  const [flipping, setFlipping] = useState(false);
  const switchMode = () => {
    setFlipping(true);
    setTimeout(() => {
      setMode(m => m === 'login' ? 'register' : 'login');
      setFlipping(false);
    }, 220);
  };

  return (
    <div className="auth-page">
      <PosterPanel />
      <div className={`auth-panel ${flipping ? 'flipping' : ''}`}>
        <div className="auth-panel-inner">
          {mode === 'login'
            ? <LoginForm    onSwitch={switchMode} />
            : <RegisterForm onSwitch={switchMode} />
          }
        </div>
      </div>
    </div>
  );
}
