/* ============================================================
   TraceListPage — filter strip + sticky banner + trace table
   ============================================================ */

const STATUS_OPTS = [
  { id: 'error', label: 'error', tone: 'error' },
  { id: 'ok', label: 'ok', tone: 'ok' },
  { id: 'in-progress', label: 'in-progress', tone: 'in-progress' },
  { id: 'orphaned', label: 'orphaned', tone: 'orphaned' },
];
const SOURCE_OPTS = ['amie', 'comanage', 'slurm', 'http', 'core'];
const WINDOWS = [['24h', '24h'], ['7d', '7d'], ['30d', '30d']];

function TraceListPage({ onOpenTrace }) {
  const [statusSel, setStatusSel] = useState(() => new Set(['error'])); // error pre-selected
  const [sourceSel, setSourceSel] = useState(() => new Set());
  const [win, setWin] = useState('30d');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(50);

  const banner = window.TRACES.filter((t) => t.status === 'error' && t.over24h).length;

  const filtered = useMemo(() => {
    return window.TRACES.filter((t) => {
      if (statusSel.size && !statusSel.has(t.status)) return false;
      if (sourceSel.size && !sourceSel.has(t.source)) return false;
      if (q) {
        const hay = [t.trace_id, t.root_action, t.error_summary, ...(Object.values(t.entity || {}))].join(' ').toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [statusSel, sourceSel, q]);

  const toggleSet = (setter) => (id) => setter((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleStatus = toggleSet(setStatusSel);
  const toggleSource = toggleSet(setSourceSel);

  const applyBanner = () => { setStatusSel(new Set(['error'])); setWin('30d'); };

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 32px 48px' }}>
      {/* page heading */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 6 }}>
        <div>
          <h1 className="display" style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--foreground)', lineHeight: 1.2 }}>Traces</h1>
          <p style={{ margin: '6px 0 0', fontSize: 14.5, color: 'var(--muted-foreground)', maxWidth: 560 }}>Investigate where a flow broke and retry from the failed step.</p>
        </div>
        <LastSynced />
      </div>

      {/* sticky banner */}
      {banner > 0 && (
        <button onClick={applyBanner} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', marginTop: 18,
          display: 'flex', alignItems: 'center', gap: 11, background: 'var(--nexus-red-50)', border: '1px solid var(--nexus-red-100)',
          borderRadius: 10, padding: '12px 16px', color: 'var(--nexus-red-700)', fontFamily: 'var(--font-sans)' }}>
          <Ic.alert style={{ flex: '0 0 auto' }} />
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{banner} {banner === 1 ? 'trace' : 'traces'} failing for over 24h</span>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600 }}>Investigate <Ic.arrowRight /></span>
        </button>
      )}

      {/* filter strip */}
      <div style={{ marginTop: 18, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--card)', padding: '14px 16px', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, alignItems: 'flex-start' }}>
          <FilterGroup label="Status">
            {STATUS_OPTS.map((s) => (
              <FilterPill key={s.id} active={statusSel.has(s.id)} onClick={() => toggleStatus(s.id)}>
                <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: TONE[s.tone].hollow ? 'transparent' : TONE[s.tone].dot, boxShadow: TONE[s.tone].hollow ? `inset 0 0 0 1.4px ${TONE[s.tone].dot}` : 'none' }} />
                {s.label}
              </FilterPill>
            ))}
          </FilterGroup>
          <Divider />
          <FilterGroup label="Source">
            {SOURCE_OPTS.map((s) => (
              <FilterPill key={s} active={sourceSel.has(s)} onClick={() => toggleSource(s)}>{s}</FilterPill>
            ))}
          </FilterGroup>
          <Divider />
          <FilterGroup label="Window">
            {WINDOWS.map(([id, label]) => (
              <FilterPill key={id} active={win === id} onClick={() => setWin(id)} radio>{label}</FilterPill>
            ))}
          </FilterGroup>
        </div>
        <div style={{ marginTop: 13, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', display: 'inline-flex' }}><Ic.search /></span>
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search trace_id / span_id / entity / action…"
            style={{ width: '100%', height: 38, padding: '0 12px 0 36px', border: '1px solid var(--border-strong)', borderRadius: 8,
              fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--foreground)', background: 'var(--card)', outline: 'none' }} />
        </div>
      </div>

      {/* table */}
      <div style={{ marginTop: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--card)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 132px 1fr 96px 64px', gap: 0, padding: '10px 18px', borderBottom: '1px solid var(--border)', background: 'var(--muted-2)' }}>
          {['Started', 'Trace ID', 'Root action', 'Source', 'Spans'].map((h) => (
            <span key={h} style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.03em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{h}</span>
          ))}
        </div>
        {filtered.length === 0 && (
          <div style={{ padding: '48px 18px', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 14 }}>No traces match these filters.</div>
        )}
        {filtered.map((t) => <TraceRow key={t.trace_id} t={t} onOpen={() => onOpenTrace(t)} />)}
      </div>

      {/* pagination */}
      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, color: 'var(--muted-foreground)', fontSize: 13 }}>
        <Button size="sm" variant="outline" disabled>‹ Prev</Button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span>Page 1 of 1 · <strong style={{ color: 'var(--foreground)' }}>{filtered.length}</strong> traces</span>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            Rows
            <select value={rows} onChange={(e) => setRows(+e.target.value)} style={{ height: 30, borderRadius: 7, border: '1px solid var(--border-strong)', padding: '0 8px', fontFamily: 'var(--font-sans)', fontSize: 13, background: 'var(--card)', color: 'var(--foreground)' }}>
              <option>25</option><option>50</option><option>100</option>
            </select>
          </label>
        </div>
        <Button size="sm" variant="outline" disabled>Next ›</Button>
      </div>
    </div>
  );
}

/* ---------- table row ---------- */
function TraceRow({ t, onOpen }) {
  const [hover, setHover] = useState(false);
  const isErr = t.status === 'error';
  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: 'grid', gridTemplateColumns: '120px 132px 1fr 96px 64px', alignItems: 'center', gap: 0,
        padding: '12px 18px', borderBottom: '1px solid var(--border)', cursor: 'pointer',
        background: hover ? 'var(--muted-2)' : 'var(--card)', transition: 'background .1s', position: 'relative' }}>
      {isErr && <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--nexus-red-500)' }} />}

      <span style={{ fontSize: 13, color: 'var(--foreground)' }} title={absTime(t.started_at)}>{relTime(t.started_at)}</span>

      <span onClick={(e) => e.stopPropagation()}>
        <CopyValue value={t.trace_id} display={shortId(t.trace_id) + '…'} label="Copy trace ID" />
      </span>

      <div style={{ minWidth: 0, paddingRight: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <StatusPill tone={t.status} dotOnly />
          <span className="mono" style={{ fontSize: 13, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.root_action}</span>
        </div>
        {isErr && t.error_summary && (
          <div style={{ marginTop: 3, marginLeft: 16, fontSize: 12.5, color: 'var(--nexus-red-700)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.error_summary}</div>
        )}
        {t.status === 'in-progress' && (
          <div style={{ marginTop: 3, marginLeft: 16, fontSize: 12.5, color: 'var(--nexus-amber-700)', fontStyle: 'italic' }}>…still running</div>
        )}
      </div>

      <span><SourcePill source={t.source} /></span>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span className="mono" style={{ fontSize: 13, color: 'var(--muted-foreground)', fontVariantNumeric: 'tabular-nums' }}>{t.span_count}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 600, color: hover ? 'var(--brand)' : 'var(--muted-foreground)', transition: 'color .1s' }}>
          open <Ic.arrowRight width="13" height="13" />
        </span>
      </div>
    </div>
  );
}

/* ---------- filter sub-components ---------- */
function FilterGroup({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)' }}>{label}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{children}</div>
    </div>
  );
}
function Divider() { return <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)' }} />; }

function FilterPill({ active, onClick, children, radio }) {
  return (
    <button onClick={onClick} aria-pressed={active} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 11px', borderRadius: radio ? 14 : 7,
      border: '1px solid', borderColor: active ? 'var(--brand)' : 'var(--border-strong)',
      background: active ? 'var(--brand-tint)' : 'var(--card)', color: active ? 'var(--brand)' : 'var(--foreground)',
      fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all .12s',
    }}>{children}</button>
  );
}

/* ---------- LastSynced badge (ticks) ---------- */
function LastSynced() {
  const [s, setS] = useState(12);
  useEffect(() => { const id = setInterval(() => setS((x) => (x >= 59 ? 0 : x + 1)), 1000); return () => clearInterval(id); }, []);
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 32, padding: '0 12px', borderRadius: 16, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted-foreground)', fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--nexus-green-500)', animation: 'pulseDot 2s ease-in-out infinite' }} />
      Last synced {s}s ago
    </div>
  );
}

Object.assign(window, { TraceListPage });
