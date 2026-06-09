/* ============================================================
   UI primitives, icons, pills, status logic, helpers
   ============================================================ */
const { useState, useEffect, useRef, useCallback, useMemo } = React;

/* ---------- icons (simple functional SVGs) ---------- */
const Ic = {
  chevron: (p) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" {...p}><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  copy: (p) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" {...p}><rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M5 15V5a2 2 0 012-2h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>),
  check: (p) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" {...p}><path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  external: (p) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" {...p}><path d="M14 5h5v5M19 5l-8 8M17 13v5a1 1 0 01-1 1H6a1 1 0 01-1-1V8a1 1 0 011-1h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  refresh: (p) => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" {...p}><path d="M20 12a8 8 0 10-2.3 5.6M20 12V7m0 5h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  search: (p) => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" {...p}><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/><path d="M20 20l-3.2-3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>),
  x: (p) => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...p}><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>),
  alert: (p) => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" {...p}><path d="M12 8v5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/><circle cx="12" cy="16.5" r="1.2" fill="currentColor"/><path d="M10.3 3.8L2.5 18a2 2 0 001.7 3h15.6a2 2 0 001.7-3L13.7 3.8a2 2 0 00-3.4 0z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>),
  arrowRight: (p) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" {...p}><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  arrowUp: (p) => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" {...p}><path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  arrowDown: (p) => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" {...p}><path d="M12 5v14M6 13l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  expand: (p) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" {...p}><path d="M4 9V5a1 1 0 011-1h4M20 15v4a1 1 0 01-1 1h-4M4 14v5a1 1 0 001 1h4M20 10V5a1 1 0 00-1-1h-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  collapse: (p) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" {...p}><path d="M9 4v4a1 1 0 01-1 1H4M15 20v-4a1 1 0 011-1h4M15 4v4a1 1 0 001 1h4M9 20v-4a1 1 0 00-1-1H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  // sidebar/nav glyphs
  pulse: (p) => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p}><path d="M3 12h3l2.5-6 4 13 3-9 2 2h3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  grid: (p) => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p}><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/></svg>),
  users: (p) => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p}><circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="2"/><path d="M3.5 19a5.5 5.5 0 0111 0M16 6.2a3 3 0 010 5.6M21 19a5 5 0 00-3.5-4.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>),
  box: (p) => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p}><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>),
  server: (p) => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p}><rect x="3.5" y="4" width="17" height="7" rx="2" stroke="currentColor" strokeWidth="2"/><rect x="3.5" y="13" width="17" height="7" rx="2" stroke="currentColor" strokeWidth="2"/><circle cx="7.5" cy="7.5" r="1" fill="currentColor"/><circle cx="7.5" cy="16.5" r="1" fill="currentColor"/></svg>),
  cog: (p) => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p}><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M18.4 18.4l-2.1-2.1M7.7 7.7L5.6 5.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>),
  link: (p) => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...p}><path d="M10 14a3.5 3.5 0 005 0l3-3a3.5 3.5 0 00-5-5l-1.5 1.5M14 10a3.5 3.5 0 00-5 0l-3 3a3.5 3.5 0 005 5l1.5-1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>),
};

/* ---------- status + source semantics ---------- */
// derive a row's status tone from int status + name heuristics + run-state
function rowTone(row) {
  if (row.running) return 'in-progress';
  if (row.orphan && row.status == null) return 'orphaned';
  if (row.notRun) return 'no-status';
  if (row.status === 1) return 'error';
  if (row.status === 0) return 'ok';
  // name heuristics
  const a = row.action || '';
  if (/Failed$/.test(a) || /Error/.test(a) || row.status_message) return 'error';
  if (row.status == null) return 'no-status';
  return 'ok';
}

const TONE = {
  ok:            { dot: 'var(--nexus-green-500)', bg: 'var(--nexus-green-50)',  fg: 'var(--nexus-green-700)', label: 'ok' },
  error:         { dot: 'var(--nexus-red-500)',   bg: 'var(--nexus-red-50)',    fg: 'var(--nexus-red-700)',   label: 'error' },
  'in-progress': { dot: 'var(--nexus-amber-500)', bg: 'var(--nexus-amber-50)',  fg: 'var(--nexus-amber-700)', label: 'in progress' },
  orphaned:      { dot: 'var(--muted-foreground)',bg: 'var(--muted)',           fg: 'var(--muted-foreground)',label: 'orphaned', hollow: true },
  'no-status':   { dot: 'var(--muted-foreground)',bg: 'var(--muted)',           fg: 'var(--muted-foreground)',label: 'no status', hollow: true },
};

const SOURCE = {
  amie:     { bg: 'var(--nexus-blue-50)',   fg: 'var(--nexus-blue-700)' },
  comanage: { bg: 'var(--nexus-purple-50)', fg: 'var(--nexus-purple-700)' },
  slurm:    { bg: 'var(--nexus-amber-50)',  fg: 'var(--nexus-amber-700)' },
  http:     { bg: 'var(--muted)',           fg: 'var(--muted-foreground)' },
  core:     { bg: 'var(--muted)',           fg: 'var(--muted-foreground)' },
};

/* ---------- StatusPill ---------- */
function StatusPill({ tone = 'no-status', children, dotOnly = false, size = 'md' }) {
  const c = TONE[tone] || TONE['no-status'];
  const dot = (
    <span aria-hidden="true" style={{
      width: 8, height: 8, borderRadius: '50%', flex: '0 0 auto',
      background: c.hollow ? 'transparent' : c.dot,
      boxShadow: c.hollow ? `inset 0 0 0 1.6px ${c.dot}` : 'none',
      animation: tone === 'in-progress' ? 'pulseDot 1.5s ease-in-out infinite' : 'none',
    }} />
  );
  if (dotOnly) return <span role="status" aria-label={`Status: ${c.label}`} style={{ display: 'inline-flex' }}>{dot}</span>;
  return (
    <span role="status" aria-label={`Status: ${c.label}`} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: size === 'sm' ? 20 : 22, padding: '0 8px', borderRadius: 6,
      background: c.bg, color: c.fg, fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-sans)',
      whiteSpace: 'nowrap', lineHeight: 1,
    }}>{dot}{children || c.label}</span>
  );
}

/* ---------- SourcePill ---------- */
function SourcePill({ source }) {
  const c = SOURCE[source] || SOURCE.core;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 7px', borderRadius: 5,
      background: c.bg, color: c.fg, fontSize: 11.5, fontWeight: 600, letterSpacing: '.01em',
      fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', lineHeight: 1,
    }}>{source}</span>
  );
}

/* ---------- Button ---------- */
function Button({ variant = 'default', size = 'md', children, icon, disabled, title, onClick, style, ...rest }) {
  const [hover, setHover] = useState(false);
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: size === 'sm' ? 12.5 : 13.5,
    height: size === 'sm' ? 30 : 36, padding: size === 'sm' ? '0 11px' : '0 15px',
    borderRadius: 7, cursor: disabled ? 'not-allowed' : 'pointer', border: '1px solid transparent',
    transition: 'background .12s, border-color .12s, box-shadow .12s, color .12s', whiteSpace: 'nowrap',
    opacity: disabled ? 0.5 : 1, userSelect: 'none',
  };
  const skins = {
    primary:   { background: hover && !disabled ? '#1e293b' : 'var(--primary)', color: 'var(--primary-fg)', boxShadow: 'var(--shadow-sm)' },
    brand:     { background: hover && !disabled ? '#1d4ed8' : 'var(--brand)', color: 'var(--brand-fg)', boxShadow: 'var(--shadow-sm)' },
    default:   { background: hover ? 'var(--muted)' : 'var(--card)', color: 'var(--foreground)', borderColor: 'var(--border-strong)' },
    outline:   { background: hover ? 'var(--muted)' : 'transparent', color: 'var(--foreground)', borderColor: 'var(--border-strong)' },
    ghost:     { background: hover ? 'var(--muted)' : 'transparent', color: 'var(--muted-foreground)' },
  };
  return (
    <button type="button" disabled={disabled} title={title} onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ ...base, ...skins[variant], ...style }} {...rest}>
      {icon}{children}
    </button>
  );
}

/* ---------- Tooltip (hover, simple) ---------- */
function Tooltip({ label, children, side = 'top', maxWidth = 240 }) {
  const [show, setShow] = useState(false);
  const pos = {
    top:    { bottom: '100%', left: '50%', transform: 'translateX(-50%) translateY(-7px)' },
    bottom: { top: '100%', left: '50%', transform: 'translateX(-50%) translateY(7px)' },
    left:   { right: '100%', top: '50%', transform: 'translateY(-50%) translateX(-7px)' },
    right:  { left: '100%', top: '50%', transform: 'translateY(-50%) translateX(7px)' },
  };
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} onFocus={() => setShow(true)} onBlur={() => setShow(false)}>
      {children}
      {show && (
        <span role="tooltip" style={{
          position: 'absolute', ...pos[side], zIndex: 1000, maxWidth, width: 'max-content',
          background: '#0f172a', color: '#fff', fontSize: 12, lineHeight: 1.4, fontWeight: 500,
          padding: '7px 10px', borderRadius: 7, boxShadow: 'var(--shadow-md)', pointerEvents: 'none',
          fontFamily: 'var(--font-sans)', textAlign: 'left', whiteSpace: 'normal',
        }}>{label}</span>
      )}
    </span>
  );
}

/* ---------- CopyChip / CopyButton ---------- */
function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text) => {
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1100); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done).catch(done); }
      else { done(); }
    } catch (e) { done(); }
  }, []);
  return { copied, copy };
}

// inline value with click-to-copy; explicit icon variant for detail panel
function CopyValue({ value, display, mono = true, explicit = false, label }) {
  const { copied, copy } = useCopy();
  const [hover, setHover] = useState(false);
  return (
    <span
      onClick={(e) => { e.stopPropagation(); copy(value); }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      title={label || 'Click to copy'} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copy(value); } }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)', fontSize: mono ? 12 : 13,
        color: 'var(--foreground)', borderRadius: 4, padding: explicit ? '1px 2px' : 0,
        background: hover && explicit ? 'var(--muted)' : 'transparent', maxWidth: '100%',
      }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{display || value}</span>
      <span aria-hidden="true" style={{ flex: '0 0 auto', color: copied ? 'var(--nexus-green-600)' : 'var(--muted-foreground)', opacity: (hover || copied || explicit) ? 1 : 0, transition: 'opacity .12s' }}>
        {copied ? <Ic.check /> : <Ic.copy />}
      </span>
    </span>
  );
}

/* ---------- time helpers ---------- */
function relTime(iso) {
  const ms = window.NOW - Date.parse(iso);
  const s = Math.round(ms / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
function absTime(iso) {
  // 2026-06-04 14:21:33.812 UTC
  const d = new Date(iso);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}.${p(d.getUTCMilliseconds(),3)} UTC`;
}
function durationMs(a, b) {
  if (!a || !b) return null;
  const d = Date.parse(b) - Date.parse(a);
  if (d < 1000) return `${d}ms`;
  return `${(d/1000).toFixed(d < 10000 ? 2 : 1)}s`;
}
function shortId(id, n = 8) { return id ? id.slice(0, n) : ''; }
function midTrunc(id, head = 8, tail = 5) {
  if (!id || id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}
// is an action "code-shaped" (no spaces) → monospace, else phrase → sans
function isCodeShaped(s) { return !/\s/.test(s || ''); }

Object.assign(window, {
  Ic, rowTone, TONE, SOURCE, StatusPill, SourcePill, Button, Tooltip,
  useCopy, CopyValue, relTime, absTime, durationMs, shortId, midTrunc, isCodeShaped,
});
