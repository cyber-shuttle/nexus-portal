/* ============================================================
   TraceTreePanel — the centerpiece.
   Indented audit-row tree + red error-rail + detail panel.
   ============================================================ */
const { useLayoutEffect } = React;

const INDENT = 20;
const MAX_DEPTH = 5;

/* ---------- tree building ---------- */
function buildTree(spans) {
  const byId = {};
  spans.forEach((s) => { byId[s.span_id] = { ...s, children: [] }; });
  const roots = [];
  spans.forEach((s) => {
    const node = byId[s.span_id];
    if (s.parent_span_id && byId[s.parent_span_id]) byId[s.parent_span_id].children.push(node);
    else { node._orphan = !!s.parent_span_id && !byId[s.parent_span_id]; roots.push(node); }
  });
  return { roots, byId };
}

function computeErrorPath(spans, byId) {
  const pathSet = new Set();
  const errorIds = [];
  spans.forEach((s) => { if (rowTone(s) === 'error') errorIds.push(s.span_id); });
  errorIds.forEach((id) => {
    let cur = byId[id];
    while (cur) { pathSet.add(cur.span_id); cur = cur.parent_span_id ? byId[cur.parent_span_id] : null; }
  });
  return { pathSet, errorIds };
}

// does a node's subtree contain an error row?
function subtreeHasError(node) {
  if (rowTone(node) === 'error') return true;
  return node.children.some(subtreeHasError);
}

// flatten to visible rows honoring `expanded`
function flatten(roots, expanded) {
  const out = [];
  const walk = (node, depth) => {
    const hasChildren = node.children.length > 0;
    out.push({ node, depth, hasChildren });
    if (hasChildren && expanded.has(node.span_id)) node.children.forEach((c) => walk(c, depth + 1));
  };
  roots.forEach((r) => walk(r, 0));
  return out;
}

/* =====================================================================
   TraceTreePanel
   ===================================================================== */
function TraceTreePanel({ trace, opts }) {
  const { roots, byId } = useMemo(() => buildTree(trace.spans), [trace]);
  const { pathSet, errorIds } = useMemo(() => computeErrorPath(trace.spans, byId), [trace, byId]);

  // expanded: default expand all structural nodes on the error path; expand roots & first 2 levels
  const allStructural = useMemo(() => trace.spans.filter((s) => byId[s.span_id].children.length).map((s) => s.span_id), [trace, byId]);
  const [expanded, setExpanded] = useState(() => new Set(allStructural));
  const [selected, setSelected] = useState(() => errorIds[0] || roots[0]?.span_id);
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [errorCursor, setErrorCursor] = useState(0);

  const containerRef = useRef(null);
  const rowRefs = useRef({});
  const [rail, setRail] = useState(null);

  const visibleAll = useMemo(() => flatten(roots, expanded), [roots, expanded]);
  const visible = useMemo(() => {
    if (!errorsOnly) return visibleAll;
    return visibleAll.filter(({ node }) => pathSet.has(node.span_id));
  }, [visibleAll, errorsOnly, pathSet]);

  // precise failing leaves = error rows with no error descendant (what the admin wants)
  const errorLeafIds = useMemo(() => {
    const errSet = new Set(trace.spans.filter((s) => rowTone(s) === 'error').map((s) => s.span_id));
    const hasErrChild = (n) => n.children.some((c) => errSet.has(c.span_id) || hasErrChild(c));
    return trace.spans.filter((s) => rowTone(s) === 'error' && !hasErrChild(byId[s.span_id])).map((s) => s.span_id);
  }, [trace, byId]);
  const errorLeafSet = useMemo(() => new Set(errorLeafIds), [errorLeafIds]);

  const errorRowsInOrder = useMemo(() => visibleAll.filter(({ node }) => errorLeafSet.has(node.span_id)).map((v) => v.node.span_id), [visibleAll, errorLeafSet]);

  /* ---- rail geometry (measured) ---- */
  useLayoutEffect(() => {
    if (!opts.rail || errorIds.length === 0) { setRail(null); return; }
    // among visible rows, first in pathSet → last in pathSet
    const idxs = visible.map((v, i) => (pathSet.has(v.node.span_id) ? i : -1)).filter((i) => i >= 0);
    if (!idxs.length) { setRail(null); return; }
    const firstId = visible[idxs[0]].node.span_id;
    const lastId = visible[idxs[idxs.length - 1]].node.span_id;
    const a = rowRefs.current[firstId];
    const b = rowRefs.current[lastId];
    const c = containerRef.current;
    if (a && b && c) {
      const cTop = c.getBoundingClientRect().top + c.scrollTop;
      const top = a.getBoundingClientRect().top + c.scrollTop - cTop;
      const bottom = b.getBoundingClientRect().bottom + c.scrollTop - cTop;
      setRail({ top, height: bottom - top });
    }
  }, [visible, pathSet, errorIds, opts.rail]);

  /* ---- selection helpers ---- */
  const selectId = useCallback((id) => { setSelected(id); if (window.history && window.location) { /* sync ?span= softly */ } }, []);

  const expandAll = () => setExpanded(new Set(allStructural));
  const collapseAll = () => setExpanded(new Set(roots.map((r) => r.span_id)));
  const toggle = (id) => setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const gotoError = (dir) => {
    if (!errorRowsInOrder.length) return;
    let i = (errorCursor + dir + errorRowsInOrder.length) % errorRowsInOrder.length;
    setErrorCursor(i);
    const id = errorRowsInOrder[i];
    selectId(id);
    const el = rowRefs.current[id];
    if (el && containerRef.current) {
      const c = containerRef.current;
      const r = el.getBoundingClientRect(); const cr = c.getBoundingClientRect();
      if (r.top < cr.top + 40 || r.bottom > cr.bottom - 8) c.scrollTop += (r.top - cr.top) - c.clientHeight / 2 + 40;
    }
  };

  /* ---- keyboard nav ---- */
  const onKeyDown = (e) => {
    const ids = visible.map((v) => v.node.span_id);
    const curIdx = ids.indexOf(selected);
    if (e.key === 'ArrowDown') { e.preventDefault(); selectId(ids[Math.min(ids.length - 1, curIdx + 1)]); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); selectId(ids[Math.max(0, curIdx - 1)]); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); const v = visible[curIdx]; if (v && v.hasChildren && !expanded.has(v.node.span_id)) toggle(v.node.span_id); else if (v && v.hasChildren) selectId(v.node.children[0].span_id); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); const v = visible[curIdx]; if (v && v.hasChildren && expanded.has(v.node.span_id)) toggle(v.node.span_id); else if (v && v.node.parent_span_id && byId[v.node.parent_span_id]) selectId(v.node.parent_span_id); }
    else if (e.key === 'n') { e.preventDefault(); gotoError(1); }
    else if (e.key === 'p') { e.preventDefault(); gotoError(-1); }
    else if ((e.metaKey || e.ctrlKey) && e.key === 'c') { const node = byId[selected]; if (node) { navigator.clipboard && navigator.clipboard.writeText(node.span_id); } }
  };

  const selectedNode = byId[selected];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 0 12px', flexWrap: 'wrap' }}>
        <Button size="sm" variant="outline" icon={<Ic.expand />} onClick={expandAll}>Expand all</Button>
        <Button size="sm" variant="outline" icon={<Ic.collapse />} onClick={collapseAll}>Collapse all</Button>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginLeft: 4, fontSize: 12.5, color: 'var(--muted-foreground)', cursor: 'pointer', fontWeight: 500 }}>
          <input type="checkbox" checked={errorsOnly} onChange={(e) => setErrorsOnly(e.target.checked)} style={{ accentColor: 'var(--brand)', width: 15, height: 15 }} />
          Errors only
        </label>
        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--muted-foreground)' }}>
          {errorIds.length > 0
            ? <span>{visible.length} of {trace.spans.length} rows</span>
            : trace.spans.some((s) => s.running)
              ? <span>{trace.spans.length} spans · <span style={{ color: 'var(--nexus-amber-700)' }}>running</span></span>
              : <span>{trace.spans.length} spans · <span style={{ color: 'var(--nexus-green-700)' }}>all ok</span></span>}
        </span>
      </div>

      {/* error chip — counts precise failing leaves */}
      {errorLeafIds.length > 0 && (
        <TraceErrorChip count={errorLeafIds.length} cursor={errorCursor} onPrev={() => gotoError(-1)} onNext={() => gotoError(1)} onJump={() => gotoError(0)} />
      )}

      {/* split: tree | detail */}
      <div style={{ display: 'flex', gap: opts.gutter, flex: 1, minHeight: 0 }}>
        {/* tree */}
        <div
          ref={containerRef}
          role="tree" aria-label="Span tree" tabIndex={0} onKeyDown={onKeyDown}
          style={{ position: 'relative', flex: 1, minWidth: 0, overflow: 'auto', outline: 'none',
            border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)', padding: '6px 4px 8px' }}>
          {/* red rail overlay */}
          {rail && (
            <div aria-hidden="true" style={{ position: 'absolute', left: 10, top: rail.top, height: rail.height,
              width: opts.railWidth, borderRadius: 2, background: 'var(--nexus-red-500)', zIndex: 2, pointerEvents: 'none' }} />
          )}
          {visible.map((v) => (
            <TraceTreeRow
              key={v.node.span_id}
              v={v}
              selected={selected === v.node.span_id}
              tone={rowTone(v.node)}
              inErrorPath={pathSet.has(v.node.span_id)}
              isErrorLeaf={errorLeafSet.has(v.node.span_id)}
              hiddenError={v.hasChildren && !expanded.has(v.node.span_id) && subtreeHasError(v.node)}
              expanded={expanded.has(v.node.span_id)}
              connectors={opts.connectors}
              railLeaf={opts.railLeaf}
              onToggle={() => toggle(v.node.span_id)}
              onSelect={() => selectId(v.node.span_id)}
              rowRef={(el) => { rowRefs.current[v.node.span_id] = el; }}
              nextSibStart={null}
            />
          ))}
        </div>

        {/* detail panel */}
        <TraceSpanDetailPanel node={selectedNode} trace={trace} width={opts.panelWidth} onOpenRaw={opts.onOpenRaw} />
      </div>
    </div>
  );
}

/* =====================================================================
   TraceErrorChip — sticky error count + prev/next
   ===================================================================== */
function TraceErrorChip({ count, cursor, onPrev, onNext, onJump }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
      background: 'var(--nexus-red-50)', border: '1px solid var(--nexus-red-100)', color: 'var(--nexus-red-700)',
      borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 600 }}>
      <Ic.alert style={{ flex: '0 0 auto' }} />
      <span>{count === 1 ? '1 error' : `${count} errors`}</span>
      {count > 1 && (
        <>
          <span style={{ opacity: .5 }}>·</span>
          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{cursor + 1} of {count}</span>
          <div style={{ display: 'inline-flex', gap: 4, marginLeft: 2 }}>
            <button onClick={onPrev} aria-label="Previous error" style={chipBtn}><Ic.arrowUp /></button>
            <button onClick={onNext} aria-label="Next error" style={chipBtn}><Ic.arrowDown /></button>
          </div>
        </>
      )}
      <button onClick={onJump} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5,
        background: 'transparent', border: 'none', color: 'var(--nexus-red-700)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
        jump to row <Ic.arrowRight />
      </button>
    </div>
  );
}
const chipBtn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22,
  borderRadius: 5, border: '1px solid var(--nexus-red-100)', background: '#fff', color: 'var(--nexus-red-700)', cursor: 'pointer' };

/* =====================================================================
   TraceTreeRow
   ===================================================================== */
function TraceTreeRow({ v, selected, tone, inErrorPath, isErrorLeaf, hiddenError, expanded, connectors, railLeaf, onToggle, onSelect, rowRef }) {
  const { node, depth, hasChildren } = v;
  const [hover, setHover] = useState(false);
  const isError = tone === 'error';
  const loud = isErrorLeaf; // precise failing leaf gets the loud treatment
  const capped = Math.min(depth, MAX_DEPTH);
  const overCap = depth > MAX_DEPTH;
  const structural = hasChildren;

  const action = node.action || '';
  const code = isCodeShaped(action);
  const display = overCap ? `…/${action}` : action;

  // meta tail
  let meta = null;
  if (node.running) meta = '…still running';
  else if (node.notRun) meta = node.action && /not_run/i.test(node.summary || '') ? 'not run (parent err)' : 'skipped (parent err)';
  const entityMeta = node.attributes && (node.attributes['entity.user_id'] || node.attributes['person.id'] || node.attributes['amie.packet_id'] || node.attributes['comanage.co_person_id'] || node.attributes['slurm.cluster'] || node.attributes['allocation.id']);
  const errSuffix = isError && node.attributes && node.attributes['http.status_code'] ? `status=${node.attributes['http.status_code']}` : null;

  return (
    <div
      ref={rowRef}
      role="treeitem"
      aria-level={depth + 1}
      aria-selected={selected}
      aria-expanded={hasChildren ? expanded : undefined}
      onClick={onSelect}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative', display: 'flex', alignItems: 'center', gap: 7,
        minHeight: structural ? 36 : 32, padding: '0 10px 0 0',
        marginLeft: 6, borderRadius: 6, cursor: 'pointer',
        background: selected ? 'var(--brand-tint)' : (loud ? 'rgba(239,68,68,.05)' : (hover ? 'var(--muted)' : 'transparent')),
        boxShadow: selected ? 'inset 0 0 0 1px rgba(37,99,235,.28)' : 'none',
        transition: 'background .1s',
      }}>
      {/* selection / error-leaf left accent */}
      {selected && <span style={{ position: 'absolute', left: 0, top: 4, bottom: 4, width: 2.5, borderRadius: 2, background: 'var(--brand)' }} />}
      {!selected && loud && railLeaf && <span style={{ position: 'absolute', left: 0, top: 4, bottom: 4, width: 3, borderRadius: 2, background: 'var(--nexus-red-500)' }} />}

      {/* indent + connectors */}
      <span style={{ flex: '0 0 auto', width: 10 + capped * INDENT, display: 'flex', alignItems: 'center', height: '100%', position: 'relative' }}>
        {connectors === 'dotted' && Array.from({ length: capped }).map((_, i) => (
          <span key={i} aria-hidden="true" style={{ position: 'absolute', left: 16 + i * INDENT, top: 0, bottom: 0, width: 1, borderLeft: '1px dotted #cbd5e1' }} />
        ))}
        {/* chevron */}
        {hasChildren && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            aria-label={expanded ? 'Collapse' : 'Expand'}
            style={{ position: 'absolute', right: 2, width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', background: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer', padding: 0 }}>
            <Ic.chevron style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform .12s' }} />
          </button>
        )}
      </span>

      {/* status dot */}
      <StatusPill tone={tone} dotOnly />

      {/* action name */}
      <span style={{
        fontFamily: code ? 'var(--font-mono)' : 'var(--font-sans)',
        fontSize: code ? 13 : 14, fontWeight: structural ? 600 : (isError ? 600 : 500),
        color: 'var(--foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 1, minWidth: 0,
      }}>{display}</span>

      {/* hidden-error badge on collapsed parents */}
      {hiddenError && !expanded && (
        <span title="Contains a failed span" style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', color: 'var(--nexus-red-600)' }}><Ic.alert width="13" height="13" /></span>
      )}
      {node._orphan && (
        <span style={{ flex: '0 0 auto', fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 500 }}>(orphan)</span>
      )}

      {/* source pill */}
      <span style={{ flex: '0 0 auto', marginLeft: 2 }}><SourcePill source={node.source} /></span>

      {/* meta tail */}
      <span style={{ flex: '0 0 auto', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 8,
        fontSize: 12, color: 'var(--muted-foreground)', maxWidth: '46%', overflow: 'hidden', whiteSpace: 'nowrap' }}>
        {errSuffix && <span className="mono" style={{ color: 'var(--nexus-red-700)' }}>{errSuffix}</span>}
        {meta && <span style={{ fontStyle: node.running ? 'italic' : 'normal', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta}</span>}
        {!meta && entityMeta && <span className="mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{entityMeta}</span>}
        {loud && <Ic.alert width="13" height="13" style={{ color: 'var(--nexus-red-600)', flex: '0 0 auto' }} />}
      </span>
    </div>
  );
}

/* =====================================================================
   TraceSpanDetailPanel — read-only detail on the right
   ===================================================================== */
function TraceSpanDetailPanel({ node, trace, width, onOpenRaw }) {
  if (!node) return null;
  const tone = rowTone(node);
  const attrs = node.attributes || {};
  const keys = Object.keys(attrs).sort();
  const action = node.action || '';
  const code = isCodeShaped(action);

  const Row = ({ k, children, mono }) => (
    <div style={{ display: 'flex', gap: 12, padding: '6px 0', alignItems: 'baseline' }}>
      <div style={{ flex: '0 0 132px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', fontFamily: 'var(--font-sans)' }}>{k}</div>
      <div style={{ flex: 1, minWidth: 0, fontSize: mono ? 12 : 13, fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)', color: 'var(--foreground)', wordBreak: 'break-word' }}>{children}</div>
    </div>
  );

  return (
    <div style={{ flex: `0 0 ${width}px`, width, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 10,
      background: 'var(--card)', padding: '16px 18px', display: 'flex', flexDirection: 'column' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
        <div style={{ fontFamily: code ? 'var(--font-mono)' : 'var(--font-sans)', fontSize: code ? 14 : 15.5, fontWeight: 700, color: 'var(--foreground)', wordBreak: 'break-word', lineHeight: 1.3 }}>{action}</div>
      </div>
      <button onClick={onOpenRaw} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', color: 'var(--brand)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '2px 0 10px', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
        Open in Raw tab <Ic.arrowRight width="12" height="12" />
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <StatusPill tone={tone} />
        <SourcePill source={node.source} />
        {node.kind && <span style={{ fontSize: 11.5, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>{node.kind}</span>}
      </div>

      {/* facts */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6 }}>
        <Row k="Time">{absTime(node.started_at)}<span style={{ color: 'var(--muted-foreground)', marginLeft: 6 }}>· {relTime(node.started_at)}</span></Row>
        {node.ended_at && <Row k="Duration" mono>{durationMs(node.started_at, node.ended_at) || '—'}</Row>}
        {node.status_message && <Row k="Status message"><span style={{ color: 'var(--nexus-red-700)', fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: 12 }}>{node.status_message}</span></Row>}
      </div>

      {/* summary */}
      {node.summary && (
        <div style={{ marginTop: 8 }}>
          <div style={detailLabel}>Summary</div>
          <div style={{ fontSize: 13, color: 'var(--foreground)', lineHeight: 1.5, textWrap: 'pretty' }}>{node.summary}</div>
        </div>
      )}

      {/* attributes */}
      {keys.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={detailLabel}>Attributes</div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {keys.map((k, i) => (
              <div key={k} style={{ display: 'flex', gap: 10, padding: '6px 10px', background: i % 2 ? 'var(--muted-2)' : '#fff', alignItems: 'baseline' }}>
                <span style={{ flex: '0 0 46%', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--muted-foreground)', wordBreak: 'break-all' }}>{k}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <CopyValue value={String(attrs[k])} label={`Copy ${k}`} />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* IDs */}
      <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <IdRow label="Trace ID" value={trace.trace_id} width={width} />
        <IdRow label="Span ID" value={node.span_id} width={width} />
        {node.parent_span_id && <IdRow label="Parent" value={node.parent_span_id} width={width} />}
      </div>
    </div>
  );
}

function IdRow({ label, value, width }) {
  const display = width < 320 ? midTrunc(value) : value;
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <span style={{ flex: '0 0 64px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)' }}>{label}</span>
      <span style={{ flex: 1, minWidth: 0 }}><CopyValue value={value} display={display} explicit label={`Copy ${label}`} /></span>
    </div>
  );
}

const detailLabel = { fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: 6 };

Object.assign(window, { TraceTreePanel, TraceTreeRow, TraceErrorChip, TraceSpanDetailPanel, buildTree, computeErrorPath, subtreeHasError });
