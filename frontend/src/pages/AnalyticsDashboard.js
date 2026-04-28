// frontend/src/pages/AnalyticsDashboard.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  apiGetSummary, apiGetGigsByMonth, apiGetTopVenues,
  apiGetRevenue, apiGetDistance, apiGetHeatmap,
  apiGetFinancial, apiCreateFinancial, apiDeleteFinancial,
  fmtCurrency, fmtMiles, fmtDate,
} from '../utils/analyticsApi';
import './AnalyticsDashboard.css';

// ─── Animated counter hook ─────────────────────────────────────────────────────
const useCountUp = (target, duration = 1200, format = (n) => n) => {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!target) return;
    const steps = 50;
    const increment = target / steps;
    let current = 0;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      current = step === steps ? target : Math.min(current + increment, target);
      setValue(current);
      if (step >= steps) clearInterval(timer);
    }, duration / steps);
    return () => clearInterval(timer);
  }, [target, duration]);
  return format(Math.round(value));
};

// ─── KPI Card ──────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, accent, wide, icon }) => {
  return (
    <div className={`kpi-card ${wide ? 'kpi-wide' : ''}`} style={{ '--kpi-accent': accent || 'var(--accent)' }}>
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-body">
        <div className="kpi-value">{value}</div>
        <div className="kpi-label">{label}</div>
        {sub && <div className="kpi-sub">{sub}</div>}
      </div>
      <div className="kpi-glow" />
    </div>
  );
};

// ─── Bar Chart (custom SVG) ────────────────────────────────────────────────────
const BarChart = ({ data, xKey = 'label', yKey = 'gig_count', y2Key, color = '#f0522a', color2 = '#29cc6a', title, yLabel }) => {
  const [animated, setAnimated] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setAnimated(true); }, { threshold: 0.2 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  if (!data?.length) return <div className="chart-empty">No data</div>;

  const W = 720, H = 220, padL = 48, padR = 12, padT = 16, padB = 40;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const vals = data.map(d => d[yKey]);
  const vals2 = y2Key ? data.map(d => d[y2Key]) : [];
  const maxVal = Math.max(...vals, ...vals2, 1);
  const barW = (chartW / data.length) * 0.55;
  const barGap = (chartW / data.length) * 0.45;

  const yTicks = 4;
  const tickStep = Math.ceil(maxVal / yTicks);

  return (
    <div className="chart-wrap" ref={ref}>
      {title && <div className="chart-title">{title}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" preserveAspectRatio="none">
        {/* Grid lines */}
        {[...Array(yTicks + 1)].map((_, i) => {
          const y = padT + chartH - (i / yTicks) * chartH;
          const tickVal = i * tickStep;
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.3)" fontFamily="monospace">
                {tickVal}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const x = padL + i * (chartW / data.length) + barGap / 2;
          const h = animated ? Math.max((d[yKey] / maxVal) * chartH, 2) : 0;
          const y = padT + chartH - h;
          const bw = y2Key ? barW / 2 - 1 : barW;

          const h2 = y2Key && animated ? Math.max((d[y2Key] / maxVal) * chartH, 2) : 0;
          const y2 = padT + chartH - h2;

          return (
            <g key={i}>
              <rect
                x={x} y={y} width={bw} height={h}
                fill={color} rx="2"
                className="chart-bar"
                style={{ animationDelay: `${i * 40}ms`, transformOrigin: `${x + bw/2}px ${padT + chartH}px` }}
              />
              {y2Key && (
                <rect
                  x={x + bw + 2} y={y2} width={bw} height={h2}
                  fill={color2} rx="2"
                  className="chart-bar"
                  style={{ animationDelay: `${i * 40 + 20}ms`, transformOrigin: `${x + bw*1.5 + 2}px ${padT + chartH}px` }}
                />
              )}
              {/* X label */}
              <text
                x={x + (y2Key ? barW : bw / 2)} y={H - padB + 14}
                textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.35)" fontFamily="monospace"
              >
                {d[xKey]}
              </text>
            </g>
          );
        })}

        {/* Baseline */}
        <line x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      </svg>
      {y2Key && (
        <div className="chart-legend">
          <span style={{ color }}><span className="legend-dot" style={{ background: color }} />{yKey}</span>
          <span style={{ color: color2 }}><span className="legend-dot" style={{ background: color2 }} />{y2Key}</span>
        </div>
      )}
    </div>
  );
};

// ─── Area/Line Chart (revenue) ─────────────────────────────────────────────────
const AreaChart = ({ data, title }) => {
  const [animated, setAnimated] = useState(false);
  const [hovered, setHovered] = useState(null);
  const ref = useRef();

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setAnimated(true); }, { threshold: 0.2 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  if (!data?.length) return <div className="chart-empty">No data</div>;

  const W = 720, H = 200, padL = 60, padR = 16, padT = 16, padB = 36;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const maxVal = Math.max(...data.map(d => Math.max(d.income || 0, d.expenses || 0)), 1);
  const xStep  = chartW / (data.length - 1);

  const ptIncome   = data.map((d, i) => [padL + i * xStep, padT + chartH - ((d.income   || 0) / maxVal) * chartH]);
  const ptExpenses = data.map((d, i) => [padL + i * xStep, padT + chartH - ((d.expenses || 0) / maxVal) * chartH]);

  const toPath = (pts) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const toArea = (pts, floor) => toPath(pts) + ` L${pts[pts.length-1][0].toFixed(1)},${floor} L${pts[0][0].toFixed(1)},${floor} Z`;
  const floor = padT + chartH;

  const yTicks = 4;
  const tickStep = Math.ceil(maxVal / yTicks / 1000) * 1000;

  const totalLen = 800; // rough path length for animation

  return (
    <div className="chart-wrap" ref={ref}>
      {title && <div className="chart-title">{title}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" onMouseLeave={() => setHovered(null)}>
        <defs>
          <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#29cc6a" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#29cc6a" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff4a4a" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#ff4a4a" stopOpacity="0.02" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Grid */}
        {[...Array(yTicks + 1)].map((_, i) => {
          const y = padT + chartH - (i / yTicks) * chartH;
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.3)" fontFamily="monospace">
                {fmtCurrency(i * tickStep, true)}
              </text>
            </g>
          );
        })}

        {/* Areas */}
        {animated && (
          <>
            <path d={toArea(ptIncome,   floor)} fill="url(#incomeGrad)" />
            <path d={toArea(ptExpenses, floor)} fill="url(#expGrad)" />
          </>
        )}

        {/* Lines */}
        <path
          d={toPath(ptIncome)}
          fill="none" stroke="#29cc6a" strokeWidth="2"
          className={animated ? 'line-draw' : ''}
          style={{ '--line-len': totalLen }}
          filter="url(#glow)"
        />
        <path
          d={toPath(ptExpenses)}
          fill="none" stroke="#ff4a4a" strokeWidth="1.5"
          className={animated ? 'line-draw' : ''}
          style={{ '--line-len': totalLen, animationDelay: '0.3s' }}
        />

        {/* Hover targets */}
        {data.map((d, i) => (
          <rect
            key={i}
            x={padL + i * xStep - xStep / 2}
            y={padT}
            width={xStep}
            height={chartH}
            fill="transparent"
            onMouseEnter={() => setHovered({ ...d, x: padL + i * xStep, y: Math.min(ptIncome[i][1], ptExpenses[i][1]) })}
          />
        ))}

        {/* Hover tooltip */}
        {hovered && (
          <g>
            <line x1={hovered.x} y1={padT} x2={hovered.x} y2={floor} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 3" />
            <rect x={Math.min(hovered.x - 10, W - padR - 110)} y={hovered.y - 56} width="110" height="52" rx="6" fill="#1c1c22" stroke="rgba(255,255,255,0.1)" />
            <text x={Math.min(hovered.x, W - padR - 55)} y={hovered.y - 38} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.5)" fontFamily="monospace">{hovered.label}</text>
            <text x={Math.min(hovered.x, W - padR - 55)} y={hovered.y - 24} textAnchor="middle" fontSize="11" fill="#29cc6a" fontFamily="monospace">{fmtCurrency(hovered.income)}</text>
            <text x={Math.min(hovered.x, W - padR - 55)} y={hovered.y - 10} textAnchor="middle" fontSize="11" fill="#ff4a4a" fontFamily="monospace">{fmtCurrency(hovered.expenses)}</text>
          </g>
        )}

        {/* X labels */}
        {data.map((d, i) => (
          (i % 2 === 0 || data.length <= 8) && (
            <text key={i} x={padL + i * xStep} y={H - padB + 14} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.3)" fontFamily="monospace">
              {d.label}
            </text>
          )
        ))}

        <line x1={padL} y1={floor} x2={W - padR} y2={floor} stroke="rgba(255,255,255,0.1)" />
      </svg>
      <div className="chart-legend">
        <span style={{ color: '#29cc6a' }}><span className="legend-dot" style={{ background: '#29cc6a' }} />Income</span>
        <span style={{ color: '#ff4a4a' }}><span className="legend-dot" style={{ background: '#ff4a4a' }} />Expenses</span>
      </div>
    </div>
  );
};

// ─── Activity Heatmap ─────────────────────────────────────────────────────────
const ActivityHeatmap = ({ data }) => {
  const dateMap = {};
  data.forEach(d => { dateMap[d.date] = d.count; });

  const today = new Date();
  const start = new Date(today); start.setDate(start.getDate() - 363);
  // Align to Sunday
  start.setDate(start.getDate() - start.getDay());

  const weeks = [];
  let week = [];
  const cur = new Date(start);

  while (cur <= today) {
    if (week.length === 7) { weeks.push(week); week = []; }
    const ds = cur.toISOString().slice(0, 10);
    week.push({ date: ds, count: dateMap[ds] || 0 });
    cur.setDate(cur.getDate() + 1);
  }
  if (week.length) weeks.push(week);

  const cellSize = 11, gap = 2;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const getColor = (count) => {
    if (!count) return 'rgba(255,255,255,0.05)';
    if (count === 1) return 'rgba(240,82,42,0.45)';
    return '#f0522a';
  };

  return (
    <div className="heatmap-wrap">
      <div className="heatmap-scroll">
        <svg
          width={weeks.length * (cellSize + gap) + 20}
          height={7 * (cellSize + gap) + 28}
        >
          {/* Month labels */}
          {weeks.map((wk, wi) => {
            const firstDay = wk.find(d => d.date);
            if (!firstDay) return null;
            const d = new Date(firstDay.date + 'T12:00');
            if (d.getDate() <= 7) {
              return (
                <text key={wi} x={wi * (cellSize + gap)} y={10} fontSize="9" fill="rgba(255,255,255,0.35)" fontFamily="monospace">
                  {months[d.getMonth()]}
                </text>
              );
            }
            return null;
          })}
          {/* Cells */}
          {weeks.map((wk, wi) =>
            wk.map((day, di) => (
              <rect
                key={`${wi}-${di}`}
                x={wi * (cellSize + gap)}
                y={16 + di * (cellSize + gap)}
                width={cellSize} height={cellSize} rx="2"
                fill={getColor(day.count)}
                className="heatmap-cell"
              >
                {day.count > 0 && <title>{day.date}: {day.count} gig{day.count > 1 ? 's' : ''}</title>}
              </rect>
            ))
          )}
        </svg>
      </div>
      <div className="heatmap-legend">
        <span>Less</span>
        {[0, 0.3, 0.6, 1].map((o, i) => (
          <div key={i} className="heatmap-legend-cell" style={{ background: o === 0 ? 'rgba(255,255,255,0.05)' : `rgba(240,82,42,${o})` }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
};

// ─── Venue Leaderboard ────────────────────────────────────────────────────────
const VenueLeaderboard = ({ venues }) => {
  if (!venues?.length) return <div className="chart-empty">No venue data</div>;
  const maxCount = Math.max(...venues.map(v => v.gig_count));

  return (
    <div className="venue-board">
      {venues.map((v, i) => (
        <div key={v.id} className="venue-row" style={{ animationDelay: `${i * 60}ms` }}>
          <div className="vr-rank">{i + 1}</div>
          <div className="vr-bar-wrap">
            <div className="vr-bar" style={{ '--bar-pct': `${(v.gig_count / maxCount) * 100}%` }} />
            <div className="vr-info">
              <span className="vr-name">{v.venue_name}</span>
              <span className="vr-city">{v.city}, {v.state}</span>
            </div>
          </div>
          <div className="vr-stats">
            <div className="vr-count">{v.gig_count} gigs</div>
            {v.total_revenue > 0 && <div className="vr-rev">{fmtCurrency(v.total_revenue)}</div>}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Tour Distance Bars ───────────────────────────────────────────────────────
const TourDistanceBars = ({ tours, totalMiles }) => {
  if (!tours?.length) return <div className="chart-empty">No tour data</div>;
  const maxMiles = Math.max(...tours.map(t => t.total_miles));
  return (
    <div className="distance-list">
      <div className="distance-total">
        <span className="dt-num">{fmtMiles(totalMiles)}</span>
        <span className="dt-label">Total distance traveled</span>
        <span className="dt-equiv">≈ {Math.round(totalMiles / 12500 * 100)}% around the Earth</span>
      </div>
      {tours.map((t, i) => (
        <div key={t.id} className="dist-row" style={{ animationDelay: `${i * 80}ms` }}>
          <div className="drw-header">
            <span className="drw-dot" style={{ background: t.color }} />
            <span className="drw-name">{t.name}</span>
            <span className="drw-shows">{t.total_shows} shows</span>
            <span className="drw-miles">{fmtMiles(t.total_miles)}</span>
          </div>
          <div className="drw-track">
            <div className="drw-fill" style={{ '--fill-pct': `${(t.total_miles / maxMiles) * 100}%`, '--fill-color': t.color }} />
          </div>
          <div className="drw-sub">{Math.round(t.miles_per_show)} mi per show</div>
        </div>
      ))}
    </div>
  );
};

// ─── Revenue Category Breakdown ───────────────────────────────────────────────
const CategoryBreakdown = ({ byCategory }) => {
  const payments = byCategory.filter(c => c.record_type === 'payment');
  const expenses = byCategory.filter(c => c.record_type === 'expense');
  const totalIncome  = payments.reduce((s, c) => s + c.total, 0);
  const totalExpense = expenses.reduce((s, c) => s + c.total, 0);

  const Section = ({ items, total, color, label }) => (
    <div className="cat-section">
      <div className="cat-header">
        <span className="cat-label" style={{ color }}>{label}</span>
        <span className="cat-total">{fmtCurrency(total)}</span>
      </div>
      {items.map(c => (
        <div key={c.category} className="cat-row">
          <div className="cr-name">{c.category.replace(/_/g, ' ')}</div>
          <div className="cr-bar-wrap">
            <div className="cr-bar" style={{ '--pct': `${(c.total / total) * 100}%`, '--col': color }} />
          </div>
          <div className="cr-val">{fmtCurrency(c.total)}</div>
          <div className="cr-cnt">{c.cnt}×</div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="cat-breakdown">
      <Section items={payments} total={totalIncome}  color="#29cc6a" label="INCOME SOURCES" />
      <Section items={expenses} total={totalExpense} color="#ff4a4a" label="EXPENSE CATEGORIES" />
    </div>
  );
};

// ─── Add Financial Record Form ────────────────────────────────────────────────
const AddRecordForm = ({ onAdd, onClose }) => {
  const [form, setForm] = useState({
    record_type: 'payment', category: 'guarantee',
    amount: '', description: '', record_date: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);

  const PAYMENT_CATS = ['guarantee','merch','door_split','sponsorship','misc'];
  const EXPENSE_CATS = ['travel','lodging','gear','food','promo','venue_fee','misc'];
  const cats = form.record_type === 'payment' ? PAYMENT_CATS : EXPENSE_CATS;

  const handle = async (e) => {
    e.preventDefault();
    if (!form.amount || !form.record_date) return;
    setSaving(true);
    await onAdd({ ...form, amount: parseFloat(form.amount) });
    setSaving(false);
    onClose();
  };

  return (
    <div className="add-record-overlay" onClick={onClose}>
      <div className="add-record-panel" onClick={e => e.stopPropagation()}>
        <div className="arp-header">
          <div className="arp-title">Add Financial Record</div>
          <button className="arp-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handle} className="arp-form">
          <div className="arp-row">
            <div className="arp-group">
              <label>Type</label>
              <div className="arp-toggle">
                {['payment', 'expense'].map(t => (
                  <button
                    key={t} type="button"
                    className={`arp-toggle-btn ${form.record_type === t ? 'active' : ''} ${t}`}
                    onClick={() => setForm(f => ({ ...f, record_type: t, category: t === 'payment' ? 'guarantee' : 'travel' }))}
                  >
                    {t === 'payment' ? '💵 Payment' : '💸 Expense'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="arp-row">
            <div className="arp-group">
              <label>Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {cats.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="arp-group">
              <label>Amount (USD)</label>
              <input
                type="number" min="0.01" step="0.01"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0.00" required
              />
            </div>
          </div>
          <div className="arp-row">
            <div className="arp-group">
              <label>Date</label>
              <input type="date" value={form.record_date} onChange={e => setForm(f => ({ ...f, record_date: e.target.value }))} required />
            </div>
            <div className="arp-group">
              <label>Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional note" />
            </div>
          </div>
          <div className="arp-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className={`btn arp-submit ${form.record_type}`} disabled={saving}>
              {saving ? 'Saving…' : `Add ${form.record_type}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Financial Records Table ───────────────────────────────────────────────────
const FinancialTable = ({ records, onDelete }) => {
  if (!records?.length) return <div className="chart-empty">No financial records yet</div>;
  return (
    <div className="fin-table-wrap">
      {records.slice(0, 20).map(r => (
        <div key={r.id} className={`fin-row ${r.record_type}`}>
          <div className="fr-type-dot" style={{ background: r.record_type === 'payment' ? '#29cc6a' : '#ff4a4a' }} />
          <div className="fr-body">
            <div className="fr-title">{r.description || r.category.replace(/_/g, ' ')}</div>
            {r.gig_title && <div className="fr-sub">{r.gig_title}</div>}
          </div>
          <div className="fr-cat">{r.category.replace(/_/g, ' ')}</div>
          <div className="fr-date">{fmtDate(r.record_date).slice(0, -6)}</div>
          <div className={`fr-amount ${r.record_type}`}>
            {r.record_type === 'payment' ? '+' : '−'}{fmtCurrency(r.amount)}
          </div>
          <button className="fr-delete" onClick={() => onDelete(r.id)} title="Delete">✕</button>
        </div>
      ))}
    </div>
  );
};

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export default function AnalyticsDashboard() {
  const [summary,    setSummary]    = useState(null);
  const [monthly,    setMonthly]    = useState([]);
  const [venues,     setVenues]     = useState([]);
  const [revenueData,setRevenueData]= useState(null);
  const [distData,   setDistData]   = useState(null);
  const [heatmap,    setHeatmap]    = useState([]);
  const [financial,  setFinancial]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [activeTab,  setActiveTab]  = useState('overview');
  const [showAddForm,setShowAddForm]= useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, m, v, r, d, h, f] = await Promise.all([
      apiGetSummary(), apiGetGigsByMonth(), apiGetTopVenues(),
      apiGetRevenue(), apiGetDistance(), apiGetHeatmap(), apiGetFinancial(),
    ]);
    setSummary(s); setMonthly(m); setVenues(v);
    setRevenueData(r); setDistData(d); setHeatmap(h); setFinancial(f);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAddRecord = async (data) => {
    const record = await apiCreateFinancial(data);
    setFinancial(prev => [record, ...prev]);
  };

  const handleDeleteRecord = async (id) => {
    if (!window.confirm('Delete this record?')) return;
    await apiDeleteFinancial(id);
    setFinancial(prev => prev.filter(r => r.id !== id));
  };

  // Animated KPI values
  const totalGigsDisplay = useCountUp(summary?.total_gigs || 0);
  const revenueDisplay   = useCountUp(summary?.total_revenue   || 0, 1400, n => fmtCurrency(n, true));
  const netDisplay       = useCountUp(summary?.net_income      || 0, 1400, n => fmtCurrency(n, true));
  const milesDisplay     = useCountUp(summary?.total_miles     || 0, 1200, n => `${n.toLocaleString()}`);

  const TABS = [
    { id: 'overview',  label: 'Overview'  },
    { id: 'revenue',   label: 'Revenue'   },
    { id: 'venues',    label: 'Venues'    },
    { id: 'distance',  label: 'Distance'  },
    { id: 'finance',   label: 'Records'   },
  ];

  if (loading) {
    return (
      <div className="analytics-page loading-screen">
        <div className="loading-pulse">
          <div className="lp-bar" /><div className="lp-bar" /><div className="lp-bar" />
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-page">
      {showAddForm && (
        <AddRecordForm onAdd={handleAddRecord} onClose={() => setShowAddForm(false)} />
      )}

      {/* ── Page header ── */}
      <div className="analytics-header">
        <div>
          <div className="analytics-title">Analytics</div>
          <div className="analytics-sub">Band performance metrics & financials</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
          + Add Record
        </button>
      </div>

      {/* ── KPI Strip ── */}
      <div className="kpi-strip">
        <KpiCard icon="🎸" label="Total Gigs"     value={totalGigsDisplay} sub={`${summary?.confirmed_gigs} confirmed`} accent="#f0522a" />
        <KpiCard icon="💰" label="Total Revenue"  value={revenueDisplay}   sub={`Avg ${fmtCurrency(summary?.avg_payment)} / gig`} accent="#29cc6a" />
        <KpiCard icon="📈" label="Net Income"     value={netDisplay}       sub={`${fmtCurrency(summary?.total_expenses)} expenses`} accent="#4a8cff" />
        <KpiCard icon="🗺" label="Miles Traveled" value={`${milesDisplay} mi`} sub={`${summary?.total_tours} tours`} accent="#f5c842" />
        <KpiCard icon="🏛" label="Venues"         value={summary?.unique_venues} sub="Unique venues played" accent="#c44aff" />
        <KpiCard icon="📅" label="Year vs Last"   value={`+${summary?.yoy_change}%`} sub={`${summary?.this_year_gigs} vs ${summary?.last_year_gigs} gigs`} accent="#29cc6a" />
      </div>

      {/* ── Tabs ── */}
      <div className="analytics-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`analytics-tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === 'overview' && (
        <div className="analytics-grid">
          <div className="ag-card span-full">
            <div className="ac-label">Gigs Per Month</div>
            <BarChart data={monthly} xKey="label" yKey="gig_count" color="#f0522a" />
          </div>

          <div className="ag-card span-wide">
            <div className="ac-label">Activity Heatmap — Last 52 Weeks</div>
            <ActivityHeatmap data={heatmap} />
          </div>

          <div className="ag-card">
            <div className="ac-label">Top Venues</div>
            <VenueLeaderboard venues={venues.slice(0, 5)} />
          </div>
        </div>
      )}

      {/* ── Revenue Tab ── */}
      {activeTab === 'revenue' && (
        <div className="analytics-grid">
          <div className="ag-card span-full">
            <div className="ac-label">Income vs Expenses — Monthly</div>
            <AreaChart data={revenueData?.monthly || []} />
          </div>

          <div className="ag-card span-wide">
            <div className="ac-label">Monthly Breakdown (Bars)</div>
            <BarChart
              data={revenueData?.monthly?.map(m => ({ ...m, label: m.label })) || []}
              xKey="label" yKey="income" y2Key="expenses"
              color="#29cc6a" color2="#ff4a4a"
            />
          </div>

          <div className="ag-card">
            <div className="ac-label">Category Breakdown</div>
            <CategoryBreakdown byCategory={revenueData?.byCategory || []} />
          </div>

          <div className="ag-card">
            <div className="ac-label">Top Earning Gigs</div>
            <div className="top-gigs-list">
              {(revenueData?.topGigs || []).map((g, i) => (
                <div key={g.id} className="tg-row">
                  <div className="tg-rank">{i + 1}</div>
                  <div className="tg-body">
                    <div className="tg-title">{g.title}</div>
                    <div className="tg-sub">{g.venue_name} · {g.city} · {fmtDate(g.gig_date).slice(0, -6)}</div>
                  </div>
                  <div className="tg-amount">{fmtCurrency(g.actual_payment)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Venues Tab ── */}
      {activeTab === 'venues' && (
        <div className="analytics-grid">
          <div className="ag-card span-full">
            <div className="ac-label">Most Played Venues</div>
            <BarChart
              data={venues.map(v => ({ label: v.venue_name.slice(0, 14), gig_count: v.gig_count }))}
              xKey="label" yKey="gig_count" color="#c44aff"
            />
          </div>
          <div className="ag-card span-full">
            <div className="ac-label">Venue Leaderboard</div>
            <VenueLeaderboard venues={venues} />
          </div>
        </div>
      )}

      {/* ── Distance Tab ── */}
      {activeTab === 'distance' && (
        <div className="analytics-grid">
          <div className="ag-card span-full">
            <div className="ac-label">Miles Per Tour</div>
            <TourDistanceBars tours={distData?.tours || []} totalMiles={distData?.total_miles || 0} />
          </div>
          <div className="ag-card span-full">
            <div className="ac-label">Gigs Per Month (timeline)</div>
            <BarChart
              data={monthly} xKey="label" yKey="gig_count"
              color="#f5c842"
            />
          </div>
        </div>
      )}

      {/* ── Finance Records Tab ── */}
      {activeTab === 'finance' && (
        <div className="analytics-grid">
          <div className="ag-card span-full">
            <div className="ac-label-row">
              <span className="ac-label">Financial Records</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddForm(true)}>+ Add</button>
            </div>
            <FinancialTable records={financial} onDelete={handleDeleteRecord} />
          </div>
        </div>
      )}
    </div>
  );
}
