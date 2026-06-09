/* ============================================================
   App — portal chrome (sidebar + topbar), routing, Tweaks, mount
   ============================================================ */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "connectors": "none",
  "railWidth": 2,
  "rail": true,
  "railLeaf": true
}/*EDITMODE-END*/;

const NAV = [
  { id: 'overview', label: 'Overview', icon: <Ic.grid /> },
  { id: 'users', label: 'Users', icon: <Ic.users /> },
  { id: 'projects', label: 'Projects', icon: <Ic.box /> },
  { id: 'allocations', label: 'Allocations', icon: <Ic.server /> },
  { id: 'tracing', label: 'Tracing', icon: <Ic.pulse />, active: true },
  { id: 'connectors', label: 'Connectors', icon: <Ic.link /> },
  { id: 'settings', label: 'Settings', icon: <Ic.cog /> },
];

function Sidebar() {
  return (
    <aside style={{ flex: `0 0 var(--sidebar-w)`, width: 'var(--sidebar-w)', background: 'var(--card)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* brand */}
      <div style={{ height: 'var(--topbar-h)', display: 'flex', alignItems: 'center', gap: 10, padding: '0 18px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flex: '0 0 auto' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 3l7 4v6c0 4.2-2.9 6.7-7 8-4.1-1.3-7-3.8-7-8V7l7-4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div style={{ lineHeight: 1.1 }}>
          <div className="display" style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em' }}>Custos</div>
          <div style={{ fontSize: 10.5, color: 'var(--muted-foreground)', fontWeight: 600, letterSpacing: '.04em' }}>NEXUS PORTAL</div>
        </div>
      </div>

      <div style={{ padding: '10px 12px', fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', color: 'var(--muted-foreground)', textTransform: 'uppercase', marginTop: 6 }}>Admin</div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 10px' }}>
        {NAV.map((n) => (
          <a key={n.id} href="#" onClick={(e) => e.preventDefault()}
            style={{ display: 'flex', alignItems: 'center', gap: 11, height: 38, padding: '0 12px', borderRadius: 8,
              textDecoration: 'none', fontSize: 13.5, fontWeight: n.active ? 600 : 500,
              color: n.active ? 'var(--foreground)' : 'var(--muted-foreground)',
              background: n.active ? 'var(--muted)' : 'transparent' }}>
            <span style={{ color: n.active ? 'var(--brand)' : 'var(--muted-foreground)', display: 'inline-flex' }}>{n.icon}</span>
            {n.label}
          </a>
        ))}
      </nav>

      <div style={{ marginTop: 'auto', padding: 14, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#6d28d9,#2563eb)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700, flex: '0 0 auto' }}>LJ</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Lahiru J.</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>Site administrator</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Topbar() {
  return (
    <header style={{ height: 'var(--topbar-h)', flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,.82)', backdropFilter: 'saturate(180%) blur(8px)', position: 'sticky', top: 0, zIndex: 20 }}>
      <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
        <span style={{ color: 'var(--muted-foreground)', fontWeight: 500 }}>Admin</span>
        <span style={{ color: 'var(--border-strong)' }}>/</span>
        <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>Tracing</span>
      </nav>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 34, padding: '0 12px 0 6px', borderRadius: 18, border: '1px solid var(--border)', background: 'var(--card)' }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#6d28d9,#2563eb)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 700 }}>LJ</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>Lahiru J.</span>
        </div>
      </div>
    </header>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [openTrace, setOpenTrace] = useState(null);

  const tweaks = { rail: t.rail, railWidth: t.railWidth, railLeaf: t.railLeaf, connectors: t.connectors };

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--muted-2)' }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <Topbar />
        <main style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <TraceListPage onOpenTrace={setOpenTrace} />
        </main>
      </div>

      {openTrace && <TraceDetailDrawer trace={openTrace} tweaks={tweaks} onClose={() => setOpenTrace(null)} />}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Span tree" />
        <TweakToggle label="Error rail" value={t.rail} onChange={(v) => setTweak('rail', v)} />
        <TweakSlider label="Rail width" value={t.railWidth} min={2} max={4} step={1} unit="px" onChange={(v) => setTweak('railWidth', v)} />
        <TweakToggle label="Leaf accent" value={t.railLeaf} onChange={(v) => setTweak('railLeaf', v)} />
        <TweakRadio label="Connectors" value={t.connectors} options={['none', 'dotted']} onChange={(v) => setTweak('connectors', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
