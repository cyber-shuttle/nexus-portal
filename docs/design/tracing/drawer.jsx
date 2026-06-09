/* ============================================================
   TraceDetailDrawer — header + tabs (Overview / Tree / Raw / Linked)
   ============================================================ */

function TraceDetailDrawer({ trace, onClose, tweaks }) {
  const [tab, setTab] = useState('tree');
  const drawerRef = useRef(null);

  // status of trace for header
  const traceTone = trace.status;
  const errCount = (trace.spans || []).filter((s) => rowTone(s) === 'error').length;

  // esc + focus
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // tweak opts
  const opts = tweaks || {};
  const treeOpts = {
    rail: opts.rail !== false,
    railWidth: opts.railWidth || 2,
    railLeaf: opts.railLeaf !== false,
    connectors: opts.connectors || 'none',
    panelWidth: 360,
    gutter: 24,
    onOpenRaw: () => setTab('raw'),
  };

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'tree', label: `Tree (${trace.span_count})` },
    { id: 'raw', label: 'Raw' },
    { id: 'linked', label: 'Linked entities' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}>
      {/* scrim */}
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,.32)', animation: 'scrimIn .18s ease' }} />
      {/* panel */}
      <div ref={drawerRef} role="dialog" aria-modal="true" aria-label={`Trace ${shortId(trace.trace_id)}`}
        style={{ position: 'relative', width: 'min(1080px, 94vw)', height: '100%', background: 'var(--background)',
          boxShadow: 'var(--shadow-drawer)', display: 'flex', flexDirection: 'column', animation: 'drawerIn .22s cubic-bezier(.22,1,.36,1)' }}>

        {/* header */}
        <div style={{ padding: '18px 24px 0', flex: '0 0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Trace</span>
                <CopyValue value={trace.trace_id} display={trace.trace_id} explicit label="Copy trace ID" />
                <StatusPill tone={statusToTone(traceTone)} />
              </div>
              <div className="display" style={{ fontFamily: isCodeShaped(trace.root_action) ? 'var(--font-mono)' : 'var(--font-display)', fontSize: 19, fontWeight: 700, color: 'var(--foreground)', wordBreak: 'break-word' }}>{trace.root_action}</div>
              {trace.status === 'error' && trace.error_summary && (
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 7, color: 'var(--nexus-red-700)', fontSize: 13.5, fontWeight: 600 }}>
                  <Ic.alert width="14" height="14" style={{ flex: '0 0 auto' }} />
                  <span>{trace.error_summary}{trace.failing_action ? <span style={{ fontWeight: 500 }}> at span <span className="mono" style={{ fontSize: 12.5 }}>{trace.failing_action}</span></span> : null}</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
              {trace.status === 'in-progress' && (
                <Tooltip label="Refresh — manual polling, no auto-refetch.">
                  <Button size="md" variant="outline" icon={<Ic.refresh />}>Refresh</Button>
                </Tooltip>
              )}
              <Tooltip label="Retry coming soon. When enabled, retry will replay the correlated event under a new trace, linked to this one. Preview the original payload in Overview." maxWidth={260}>
                <Button size="md" variant="primary" icon={<Ic.refresh />} disabled aria-label="Retry trace, currently disabled — coming soon">Retry</Button>
              </Tooltip>
              <button onClick={onClose} aria-label="Close" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--card)', color: 'var(--muted-foreground)', cursor: 'pointer' }}>
                <Ic.x />
              </button>
            </div>
          </div>

          {/* tabs */}
          <div style={{ display: 'flex', gap: 2, marginTop: 16, borderBottom: '1px solid var(--border)' }}>
            {TABS.map((tb) => (
              <button key={tb.id} onClick={() => setTab(tb.id)}
                style={{ position: 'relative', padding: '9px 14px', border: 'none', background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap',
                  fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: 600,
                  color: tab === tb.id ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                {tb.label}
                {tab === tb.id && <span style={{ position: 'absolute', left: 8, right: 8, bottom: -1, height: 2, borderRadius: 2, background: 'var(--brand)' }} />}
              </button>
            ))}
          </div>
        </div>

        {/* body */}
        <div style={{ flex: 1, minHeight: 0, padding: '18px 24px 24px', overflow: tab === 'tree' ? 'hidden' : 'auto' }}>
          {tab === 'tree' && <TraceTreePanel trace={trace} opts={treeOpts} />}
          {tab === 'overview' && <OverviewTab trace={trace} />}
          {tab === 'raw' && <RawTab trace={trace} />}
          {tab === 'linked' && <LinkedTab trace={trace} />}
        </div>
      </div>
    </div>
  );
}

function statusToTone(s) { return s; } // trace.status already matches tone keys

/* ---------- Overview tab ---------- */
function OverviewTab({ trace }) {
  const spans = trace.spans || [];
  const ended = spans.map((s) => s.ended_at).filter(Boolean).sort();
  const started = spans.map((s) => s.started_at).filter(Boolean).sort();
  const dur = started.length && ended.length ? durationMs(started[0], ended[ended.length - 1]) : '—';
  const rootEntity = trace.entity || {};

  const facts = [
    ['Trace ID', <CopyValue value={trace.trace_id} display={trace.trace_id} explicit />],
    ['Source', <SourcePill source={trace.source} />],
    ['Root action', <span className="mono" style={{ fontSize: 12.5 }}>{trace.root_action}</span>],
    ['Status', <StatusPill tone={trace.status} />],
    ['Started', `${absTime(started[0] || trace.started_at)} · ${relTime(started[0] || trace.started_at)}`],
    ['Ended', ended.length ? absTime(ended[ended.length - 1]) : <span style={{ color: 'var(--nexus-amber-700)', fontStyle: 'italic' }}>still running</span>],
    ['Duration', dur],
    ['Span count', String(trace.span_count)],
  ];

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={detailLabel}>Trace facts</div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 22 }}>
        {facts.map(([k, val], i) => (
          <div key={k} style={{ display: 'flex', gap: 16, padding: '11px 16px', background: i % 2 ? 'var(--muted-2)' : '#fff', alignItems: 'center' }}>
            <span style={{ flex: '0 0 150px', fontSize: 12.5, fontWeight: 500, color: 'var(--muted-foreground)' }}>{k}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13.5 }}>{val}</span>
          </div>
        ))}
      </div>

      <div style={detailLabel}>Root entity</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 22 }}>
        {Object.entries(rootEntity).map(([k, v]) => (
          <div key={k} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', background: 'var(--card)' }}>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>{k}</div>
            <CopyValue value={String(v)} />
          </div>
        ))}
      </div>

      {/* Attempts strip placeholder — designed-for, empty in v1 */}
      <div style={detailLabel}>Attempts</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px dashed var(--border-strong)', borderRadius: 10, padding: '14px 16px', color: 'var(--muted-foreground)', fontSize: 13 }}>
        <span style={{ display: 'inline-flex', width: 26, height: 26, borderRadius: 6, background: 'var(--muted)', alignItems: 'center', justifyContent: 'center' }}><Ic.refresh width="14" height="14" /></span>
        No retry attempts yet. When retry ships, each attempt appears here as a linked sub-trace.
      </div>
    </div>
  );
}

/* ---------- Raw tab ---------- */
function RawTab({ trace }) {
  const { copied, copy } = useCopy();
  const json = useMemo(() => buildRawJson(trace), [trace]);
  const text = JSON.stringify(json, null, 2);
  return (
    <div style={{ maxWidth: 920 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={detailLabel}>Trace JSON <span style={{ textTransform: 'none', fontWeight: 500, letterSpacing: 0 }}>· {trace.spans.length} spans</span></div>
        <Button size="sm" variant="outline" icon={copied ? <Ic.check /> : <Ic.copy />} onClick={() => copy(text)}>{copied ? 'Copied' : 'Copy JSON'}</Button>
      </div>
      <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.6, color: '#0f172a',
        background: 'var(--muted-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', overflow: 'auto', maxHeight: '100%' }}>
        {renderJson(json)}
      </pre>
    </div>
  );
}

function buildRawJson(trace) {
  return {
    trace_id: trace.trace_id,
    source: trace.source,
    status: trace.status,
    root_action: trace.root_action,
    span_count: trace.span_count,
    spans: (trace.spans || []).map((s) => ({
      span_id: s.span_id, parent_span_id: s.parent_span_id, action: s.action, source: s.source,
      status: s.status, started_at: s.started_at, ended_at: s.ended_at,
      ...(s.status_message ? { status_message: s.status_message } : {}),
      summary: s.summary, attributes: s.attributes || {},
    })),
  };
}

// lightweight syntax-highlight for JSON
function renderJson(obj) {
  const text = JSON.stringify(obj, null, 2);
  const parts = [];
  const re = /("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  let last = 0, m, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    let cls = 'num', tok = m[0];
    if (/^"/.test(tok)) cls = /:$/.test(tok) ? 'key' : 'str';
    else if (/true|false|null/.test(tok)) cls = 'bool';
    const color = cls === 'key' ? '#6d28d9' : cls === 'str' ? '#15803d' : cls === 'bool' ? '#b45309' : '#1d4ed8';
    parts.push(<span key={i++} style={{ color }}>{tok}</span>);
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/* ---------- Linked entities tab ---------- */
function LinkedTab({ trace }) {
  // collect entity-ish attributes across spans
  const entities = useMemo(() => collectEntities(trace), [trace]);
  return (
    <div style={{ maxWidth: 820 }}>
      <div style={detailLabel}>Linked entities</div>
      <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 16 }}>Entities referenced by spans in this trace. Each deep-links into its portal record.</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
        {entities.map((e) => (
          <div key={e.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, background: 'var(--card)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ display: 'inline-flex', width: 30, height: 30, borderRadius: 8, background: e.bg, color: e.fg, alignItems: 'center', justifyContent: 'center' }}>{e.icon}</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.03em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{e.kind}</span>
            </div>
            <div style={{ marginBottom: 10 }}><CopyValue value={e.id} /></div>
            <a href="#" onClick={(ev) => ev.preventDefault()} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: 'var(--brand)', textDecoration: 'none' }}>
              View {e.kind.toLowerCase()} <Ic.external width="13" height="13" />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

function collectEntities(trace) {
  const found = {};
  const add = (kind, id, icon, bg, fg) => { if (id && !found[id]) found[id] = { kind, id, icon, bg, fg }; };
  (trace.spans || []).forEach((s) => {
    const a = s.attributes || {};
    add('AMIE packet', a['amie.packet_id'], <Ic.box width="16" height="16" />, 'var(--nexus-blue-50)', 'var(--nexus-blue-700)');
    add('User', a['entity.user_id'], <Ic.users width="16" height="16" />, 'var(--muted)', 'var(--muted-foreground)');
    add('Project', a['entity.project_id'] || a['project.id'], <Ic.grid width="16" height="16" />, 'var(--muted)', 'var(--muted-foreground)');
    add('CO person', a['comanage.co_person_id'], <Ic.users width="16" height="16" />, 'var(--nexus-purple-50)', 'var(--nexus-purple-700)');
    add('Allocation', a['allocation.id'], <Ic.box width="16" height="16" />, 'var(--muted)', 'var(--muted-foreground)');
    add('Cluster account', a['slurm.account'], <Ic.server width="16" height="16" />, 'var(--nexus-amber-50)', 'var(--nexus-amber-700)');
  });
  return Object.values(found);
}

Object.assign(window, { TraceDetailDrawer, OverviewTab, RawTab, LinkedTab });
