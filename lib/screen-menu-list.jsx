// Screen: Menu list — pick a restaurant.
// Editorial list treatment — numbered, rule-divided, kanji wordmark plays.

function MenuListScreen({ onPickRestaurant, onOpenFilters, hasRestrictions }) {
  const restaurants = window.RESTAURANTS;

  return (
    <div style={{
      background: 'var(--paper)', minHeight: '100%',
      paddingBottom: 40,
    }}>
      {/* Masthead */}
      <div style={{ padding: '16px 20px 0' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <window.MetaLine>Diner · San Francisco</window.MetaLine>
          <button onClick={onOpenFilters} style={{
            all: 'unset', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 10px',
            border: '1px solid var(--rule)', borderRadius: 999,
            fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase',
            letterSpacing: 0.1, color: 'var(--ink)',
            background: hasRestrictions ? 'var(--accent)' : 'transparent',
          }}>
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M1 2h8M2.5 5h5M4 8h2" stroke={hasRestrictions ? 'var(--accentInk)' : 'currentColor'} strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <span style={{ color: hasRestrictions ? 'var(--accentInk)' : 'inherit' }}>
              {hasRestrictions ? 'Filters on' : 'Filters'}
            </span>
          </button>
        </div>
        <h1 style={{
          fontFamily: 'var(--display)', fontWeight: 'var(--displayWeight)',
          fontSize: 52, lineHeight: 0.95, letterSpacing: -1,
          color: 'var(--ink)', margin: '14px 0 0',
        }}>
          the<span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>Menu</span>
        </h1>
        <div style={{
          fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--inkMuted)',
          marginTop: 10, textWrap: 'balance',
          maxWidth: 320,
        }}>
          Read the dish. Know the ingredient. Eat with intention.
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '22px 20px 6px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px',
          background: 'var(--paperAlt)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--rule)',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" style={{ color: 'var(--inkFaint)' }}>
            <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M9.5 9.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <div style={{ flex: 1, fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--inkFaint)' }}>
            Search restaurants or dishes…
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--inkFaint)', padding: '2px 6px', border: '1px solid var(--rule)', borderRadius: 4 }}>⌘K</div>
        </div>
      </div>

      {/* Section header */}
      <window.SectionTitle number={1} title="Nearby tonight" subtitle="Four places within a mile" />

      {/* Restaurants as editorial rows */}
      <div style={{ padding: '0 20px' }}>
        {restaurants.map((r, i) => (
          <button
            key={r.id}
            onClick={() => onPickRestaurant(r.id)}
            style={{
              all: 'unset', cursor: 'pointer',
              display: 'block', width: '100%',
              borderBottom: i === restaurants.length - 1 ? 'none' : '1px solid var(--rule)',
              padding: '18px 0',
            }}
          >
            <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
              {/* Number + cover */}
              <div style={{ width: 86, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: 0.12,
                  color: 'var(--inkFaint)', textTransform: 'uppercase',
                }}>№ {String(i + 1).padStart(2, '0')}</div>
                <div style={{
                  height: 110, borderRadius: 'var(--radius)',
                  background: `radial-gradient(120% 100% at 30% 30%, ${r.cover[0]}, ${r.cover[1]})`,
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'flex-end', padding: '8px 10px',
                    fontFamily: 'var(--display)', fontWeight: 500, fontSize: 32,
                    color: 'rgba(255,255,255,0.9)', lineHeight: 1,
                  }}>{r.name[0]}</div>
                </div>
              </div>
              {/* Copy */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <div style={{
                    fontFamily: 'var(--display)', fontWeight: 'var(--displayWeight)',
                    fontSize: 24, color: 'var(--ink)', letterSpacing: -0.3, lineHeight: 1.1,
                  }}>{r.name}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--inkFaint)' }}>{r.priceLevel}</div>
                </div>
                <div style={{
                  fontFamily: 'var(--ui)', fontSize: 12, fontStyle: 'italic',
                  color: 'var(--inkMuted)', marginBottom: 4,
                }}>{r.subtitle}</div>
                <div style={{
                  fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--ink)',
                  lineHeight: 1.4, textWrap: 'pretty',
                }}>{r.tagline}</div>
                <div style={{
                  display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap',
                  fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase',
                  letterSpacing: 0.1, color: 'var(--inkFaint)',
                }}>
                  <span>{r.neighborhood}</span>
                  <span>·</span>
                  <span>{r.distance}</span>
                  <span>·</span>
                  <span style={{ color: 'var(--ink)' }}>★ {r.rating}</span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Colophon */}
      <div style={{
        padding: '40px 20px 20px',
        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--inkFaint)',
        textAlign: 'center', letterSpacing: 0.12, textTransform: 'uppercase',
      }}>
        theMenu — MMXXVI edition · v0.4
      </div>
    </div>
  );
}

Object.assign(window, { MenuListScreen });
