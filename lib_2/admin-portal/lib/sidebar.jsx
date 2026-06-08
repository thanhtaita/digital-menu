// Sidebar navigation — dark, classic SaaS.

function Sidebar({ screen, onNav, restaurant, hasUnpublished }) {
  const items = [
    { id: 'dashboard', label: 'Dashboard',   icon: 'home' },
    { id: 'menu',      label: 'Menu editor', icon: 'menu',  badge: hasUnpublished ? '4' : null },
    { id: 'ingredients', label: 'Ingredients', icon: 'book' },
    { id: 'analytics', label: 'Analytics',   icon: 'chart', soft: true },
    { id: 'publish',   label: 'Publish',     icon: 'bolt',  highlight: hasUnpublished },
    { id: 'settings',  label: 'Settings',    icon: 'cog' },
  ];

  return (
    <aside style={{
      width: 'var(--side-w)', flexShrink: 0,
      background: 'var(--side)', color: 'var(--side-ink)',
      display: 'flex', flexDirection: 'column',
      borderRight: '1px solid oklch(0.16 0.012 265)',
      height: '100vh', position: 'sticky', top: 0,
    }}>
      {/* Restaurant switcher */}
      <button style={{
        all: 'unset', cursor: 'pointer',
        margin: 10, padding: '10px 10px',
        background: 'var(--side-2)', border: '1px solid var(--side-rule)',
        borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: 'linear-gradient(135deg, oklch(0.78 0.08 40), oklch(0.55 0.14 25))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: '"Instrument Serif", serif', fontSize: 18, color: '#fff',
        }}>T</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--side-ink)', lineHeight: 1.1 }}>{restaurant.name}</div>
          <div style={{ fontSize: 11, color: 'var(--side-mute)', marginTop: 2, lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{restaurant.subtitle}</div>
        </div>
        <window.Icon name="chevd" size={12} color="var(--side-mute)"/>
      </button>

      {/* Nav */}
      <nav style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {items.map(it => {
          const active = screen === it.id;
          return (
            <button key={it.id} onClick={() => onNav(it.id)} disabled={it.soft} style={{
              all: 'unset', cursor: it.soft ? 'not-allowed' : 'pointer',
              padding: '7px 10px', borderRadius: 6,
              display: 'flex', alignItems: 'center', gap: 10,
              fontSize: 13, fontWeight: active ? 500 : 400,
              color: active ? 'var(--side-ink)' : (it.soft ? 'var(--side-faint)' : 'var(--side-mute)'),
              background: active ? 'var(--side-3)' : 'transparent',
              opacity: it.soft ? 0.6 : 1,
            }}>
              <window.Icon name={it.icon} size={14} color={active ? 'var(--side-ink)' : 'var(--side-mute)'}/>
              <span style={{ flex: 1 }}>{it.label}</span>
              {it.badge && (
                <span style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 999,
                  background: 'var(--accent)', color: 'var(--accent-ink)', fontWeight: 600,
                }}>{it.badge}</span>
              )}
              {it.soft && (
                <span style={{ fontSize: 9.5, color: 'var(--side-faint)', textTransform: 'uppercase', letterSpacing: 0.06 }}>soon</span>
              )}
              {it.highlight && !it.badge && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }}/>}
            </button>
          );
        })}
      </nav>

      {/* Spacer */}
      <div style={{ flex: 1 }}/>

      {/* Search hint */}
      <div style={{ padding: '0 10px 8px' }}>
        <button style={{
          all: 'unset', cursor: 'pointer', width: '100%',
          padding: '7px 10px', borderRadius: 6,
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12, color: 'var(--side-mute)',
          background: 'var(--side-2)', border: '1px solid var(--side-rule)',
          boxSizing: 'border-box',
        }}>
          <window.Icon name="search" size={12} color="var(--side-faint)"/>
          <span style={{ flex: 1 }}>Search…</span>
          <window.Kbd>⌘K</window.Kbd>
        </button>
      </div>

      {/* User */}
      <div style={{
        padding: 10, margin: 10, marginTop: 0,
        borderTop: '1px solid var(--side-rule)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <window.Avatar initials="KW" online size={26}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--side-ink)', lineHeight: 1.1 }}>Kenji Watanabe</div>
          <div style={{ fontSize: 11, color: 'var(--side-mute)', marginTop: 2 }}>Owner · Chef</div>
        </div>
        <window.Icon name="cog" size={13} color="var(--side-faint)"/>
      </div>
    </aside>
  );
}

Object.assign(window, { Sidebar });
