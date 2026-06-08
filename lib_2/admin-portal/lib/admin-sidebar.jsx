// Sidebar nav — sticky left rail. Collapses to icons on narrow viewports.

function Sidebar({ route, onNavigate, collapsed, restaurant }) {
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: 'home' },
    { id: 'menu',      label: 'Menu',      icon: 'menu', badge: 5 },
    { id: 'ingredients', label: 'Ingredients', icon: 'leaf' },
    { id: 'publish',   label: 'Publish',   icon: 'send', badge: 5, badgeTone: 'accent' },
    { id: 'settings',  label: 'Settings',  icon: 'settings' },
  ];

  return (
    <aside style={{
      width: collapsed ? 64 : 232, flexShrink: 0,
      background: 'var(--surface)',
      borderRight: '1px solid var(--rule)',
      display: 'flex', flexDirection: 'column',
      position: 'sticky', top: 0, height: '100vh',
      transition: 'width .18s',
    }}>
      {/* Brand */}
      <div style={{
        padding: collapsed ? '20px 0' : '20px 18px',
        borderBottom: '1px solid var(--rule)',
        display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
        gap: 10,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: 'var(--ink)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--display)', fontSize: 18, fontStyle: 'italic',
          flexShrink: 0,
        }}>tM</div>
        {!collapsed && (
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', letterSpacing: -0.1 }}>theMenu</div>
            <div style={{ fontSize: 10.5, color: 'var(--inkFaint)', letterSpacing: 0.05, fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>Admin · v0.4</div>
          </div>
        )}
      </div>

      {/* Restaurant switcher */}
      <div style={{
        padding: collapsed ? '12px 8px' : '12px 12px',
        borderBottom: '1px solid var(--rule)',
      }}>
        <button style={{
          all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center',
          gap: 10, width: '100%', boxSizing: 'border-box',
          padding: collapsed ? 6 : '8px 10px',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--surfaceAlt)',
          border: '1px solid var(--rule)',
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6, flexShrink: 0,
            background: `radial-gradient(120% 100% at 30% 30%, ${restaurant.cover[0]}, ${restaurant.cover[1]})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--display)', fontSize: 16, color: 'rgba(255,255,255,0.92)',
          }}>{restaurant.name[0]}</div>
          {!collapsed && (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', letterSpacing: -0.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{restaurant.name}</div>
                <div style={{ fontSize: 11, color: 'var(--inkFaint)' }}>{restaurant.subtitle}</div>
              </div>
              <window.Icon name="chevron-down" size={14} color="var(--inkFaint)" />
            </>
          )}
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: collapsed ? '10px 8px' : '10px 12px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {items.map(it => {
          const active = route === it.id;
          return (
            <button
              key={it.id}
              onClick={() => onNavigate(it.id)}
              style={{
                all: 'unset', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10,
                padding: collapsed ? '9px 0' : '8px 10px',
                borderRadius: 'var(--radius-sm)',
                background: active ? 'var(--surfaceSunken)' : 'transparent',
                color: active ? 'var(--ink)' : 'var(--inkMuted)',
                fontSize: 13, fontWeight: active ? 600 : 500,
                justifyContent: collapsed ? 'center' : 'flex-start',
                position: 'relative',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surfaceAlt)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
            >
              <window.Icon name={it.icon} size={16} color={active ? 'var(--accent)' : 'var(--inkMuted)'} />
              {!collapsed && <span style={{ flex: 1 }}>{it.label}</span>}
              {!collapsed && it.badge && (
                <span style={{
                  fontSize: 10.5, fontWeight: 600,
                  padding: '1px 6px', borderRadius: 999,
                  background: it.badgeTone === 'accent' ? 'var(--accent)' : 'var(--surfaceSunken)',
                  color: it.badgeTone === 'accent' ? '#fff' : 'var(--inkMuted)',
                  fontFamily: 'var(--mono)', minWidth: 16, textAlign: 'center',
                }}>{it.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer — user */}
      <div style={{
        padding: collapsed ? '12px 8px' : '12px 12px',
        borderTop: '1px solid var(--rule)',
        display: 'flex', alignItems: 'center', gap: 10,
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, oklch(0.65 0.14 30), oklch(0.5 0.16 20))',
          color: '#fff', fontSize: 12, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>M</div>
        {!collapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>Mika Tanaka</div>
            <div style={{ fontSize: 11, color: 'var(--inkFaint)' }}>Owner</div>
          </div>
        )}
      </div>
    </aside>
  );
}

Object.assign(window, { Sidebar });
