// Responsive shell — renders the diner app at three breakpoints.
// phone:   ≤ 767   — single iOS frame column
// tablet:  768–1199 — 2-pane: restaurant rail + content, filter as drawer
// desktop: ≥ 1200   — 3-pane: rail + content + sticky filter; dish grid widens
//
// `mode` can be 'auto' (picks by width), 'phone', 'tablet', 'desktop',
// or 'compare' (shows all three side by side for design review).

function useViewport(mode) {
  const [w, setW] = React.useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  React.useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  if (mode && mode !== 'auto') return mode;
  if (w < 768) return 'phone';
  if (w < 1200) return 'tablet';
  return 'desktop';
}

// ─────────────────────────────────────────────────────────────────────
// Tablet / desktop: "app window" chrome instead of iOS frame
// ─────────────────────────────────────────────────────────────────────
function AppChrome({ children, width, height, viewport }) {
  return (
    <div style={{
      width, height: height || '100%',
      background: 'var(--paper)',
      borderRadius: 18,
      overflow: 'hidden',
      boxShadow: '0 40px 80px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)',
      display: 'flex', flexDirection: 'column',
      position: 'relative',
    }}>
      {/* top bar — three traffic-lights + URL-ish breadcrumb */}
      <div style={{
        height: 38, flexShrink: 0,
        background: 'color-mix(in oklch, var(--paper) 70%, oklch(0.92 0.01 70))',
        borderBottom: '1px solid var(--rule)',
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 14px',
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['oklch(0.68 0.18 25)', 'oklch(0.78 0.14 85)', 'oklch(0.65 0.14 140)'].map((c, i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.85 }} />
          ))}
        </div>
        <div style={{
          flex: 1, display: 'flex', justifyContent: 'center',
          fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: 0.05,
          color: 'var(--inkFaint)',
        }}>
          <div style={{
            padding: '3px 12px', borderRadius: 6,
            background: 'color-mix(in oklch, var(--paperAlt) 60%, transparent)',
            border: '1px solid var(--rule)',
          }}>themenu.app <span style={{ color: 'var(--inkFaint)' }}>/ diner</span></div>
        </div>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: 0.1,
          textTransform: 'uppercase', color: 'var(--inkFaint)',
        }}>{viewport}</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Left rail — restaurant list, always visible on tablet+
// ─────────────────────────────────────────────────────────────────────
function RestaurantRail({ currentId, onPick, compact = false }) {
  return (
    <div style={{
      width: compact ? 240 : 300, flexShrink: 0,
      height: '100%',
      borderRight: '1px solid var(--rule)',
      background: 'color-mix(in oklch, var(--paper) 75%, var(--paperAlt))',
      overflow: 'auto',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Masthead */}
      <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid var(--rule)' }}>
        <window.MetaLine>Diner · SF</window.MetaLine>
        <div style={{
          fontFamily: 'var(--display)', fontWeight: 'var(--displayWeight)',
          fontSize: compact ? 30 : 36, lineHeight: 1, letterSpacing: -0.6,
          color: 'var(--ink)', marginTop: 6,
        }}>
          the<span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>Menu</span>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '14px 16px 6px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 12px',
          background: 'var(--paper)',
          border: '1px solid var(--rule)',
          borderRadius: 'var(--radius)',
        }}>
          <svg width="13" height="13" viewBox="0 0 14 14" style={{ color: 'var(--inkFaint)' }}>
            <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M9.5 9.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <div style={{ flex: 1, fontFamily: 'var(--ui)', fontSize: 12.5, color: 'var(--inkFaint)' }}>Search…</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--inkFaint)', padding: '1px 5px', border: '1px solid var(--rule)', borderRadius: 4 }}>⌘K</div>
        </div>
      </div>

      <div style={{ padding: '10px 16px 4px' }}>
        <window.MetaLine>Nearby · 4</window.MetaLine>
      </div>

      {/* Restaurants */}
      <div style={{ padding: '4px 10px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {window.RESTAURANTS.map(r => {
          const on = currentId === r.id;
          return (
            <button key={r.id} onClick={() => onPick(r.id)} style={{
              all: 'unset', cursor: 'pointer',
              display: 'flex', gap: 10, alignItems: 'center',
              padding: '9px 10px', borderRadius: 'var(--radius)',
              background: on ? 'var(--paper)' : 'transparent',
              border: '1px solid ' + (on ? 'var(--rule)' : 'transparent'),
              boxShadow: on ? '0 1px 2px rgba(0,0,0,0.03)' : 'none',
            }}>
              <div style={{
                width: 36, height: 44, flexShrink: 0,
                borderRadius: 4,
                background: `radial-gradient(120% 100% at 30% 30%, ${r.cover[0]}, ${r.cover[1]})`,
                display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start',
                padding: 5,
                fontFamily: 'var(--display)', fontSize: 16, color: 'rgba(255,255,255,0.9)',
                lineHeight: 1,
              }}>{r.name[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--display)', fontWeight: 'var(--displayWeight)',
                  fontSize: 15, color: 'var(--ink)', letterSpacing: -0.2, lineHeight: 1.1,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{r.name}</div>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 9.5, textTransform: 'uppercase',
                  letterSpacing: 0.1, color: 'var(--inkFaint)', marginTop: 2,
                }}>{r.priceLevel} · {r.distance} · ★ {r.rating}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer — user tag */}
      <div style={{ marginTop: 'auto', padding: '14px 16px', borderTop: '1px solid var(--rule)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent), color-mix(in oklch, var(--accent) 50%, var(--ink)))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--display)', fontSize: 13, color: 'var(--paper)',
          }}>M</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--ink)', lineHeight: 1.1 }}>Mei</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--inkFaint)', textTransform: 'uppercase', letterSpacing: 0.1 }}>2 restrictions</div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { useViewport, AppChrome, RestaurantRail });
