// Screen: Restaurant landing. Header + sections of dish cards.
// Dish-card layout is a tweak: 'editorial' | 'tile' | 'stack'

function DishCardEditorial({ dish, conflicts, onClick, index }) {
  return (
    <button onClick={onClick} style={{
      all: 'unset', cursor: 'pointer', display: 'block', width: '100%',
      padding: '18px 0',
      borderBottom: '1px solid var(--rule)',
    }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--inkFaint)',
          letterSpacing: 0.12, textTransform: 'uppercase',
          minWidth: 28, paddingTop: 6,
        }}>{String(index).padStart(2, '0')}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <div style={{
              fontFamily: 'var(--display)', fontWeight: 'var(--displayWeight)',
              fontSize: 22, letterSpacing: -0.3, lineHeight: 1.1, color: 'var(--ink)',
            }}>{dish.name}</div>
            {dish.chefPick && (
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: 0.12,
                textTransform: 'uppercase', color: 'var(--accent)',
                border: '1px solid var(--accent)', padding: '2px 6px', borderRadius: 999,
              }}>Chef’s pick</span>
            )}
          </div>
          <div style={{
            fontFamily: 'var(--display)', fontSize: 13, fontStyle: 'italic',
            color: 'var(--inkMuted)', marginTop: 2,
          }}>{dish.jp}</div>
          <div style={{
            fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--ink)',
            marginTop: 8, lineHeight: 1.45, textWrap: 'pretty',
          }}>{dish.tagline}</div>
          {conflicts.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <window.RestrictionFlag conflicts={conflicts} />
            </div>
          )}
        </div>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8,
          flexShrink: 0,
        }}>
          <window.DishGradient dish={dish} style={{
            width: 68, height: 68, borderRadius: 'var(--radius)',
          }} />
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink)',
            fontWeight: 600, letterSpacing: 0.02,
          }}>${dish.price.toFixed(2)}</div>
        </div>
      </div>
    </button>
  );
}

function DishCardTile({ dish, conflicts, onClick }) {
  return (
    <button onClick={onClick} style={{
      all: 'unset', cursor: 'pointer', display: 'block', width: '100%',
      borderRadius: 'var(--cardRadius)',
      overflow: 'hidden', border: '1px solid var(--rule)',
      background: 'var(--paper)',
    }}>
      <window.DishGradient dish={dish} style={{
        aspectRatio: '1/1', width: '100%',
        position: 'relative',
      }}>
        {dish.chefPick && (
          <div style={{
            position: 'absolute', top: 10, right: 10,
            fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: 0.12,
            textTransform: 'uppercase', color: 'white',
            padding: '3px 7px', background: 'rgba(0,0,0,0.25)',
            border: '0.5px solid rgba(255,255,255,0.4)',
            borderRadius: 999, backdropFilter: 'blur(8px)',
          }}>Chef’s pick</div>
        )}
      </window.DishGradient>
      <div style={{ padding: '12px 12px 14px' }}>
        <div style={{
          fontFamily: 'var(--display)', fontWeight: 'var(--displayWeight)',
          fontSize: 16, color: 'var(--ink)', lineHeight: 1.15, letterSpacing: -0.2,
        }}>{dish.name}</div>
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          marginTop: 6,
        }}>
          <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--inkFaint)' }}>{dish.jp}</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink)', fontWeight: 600 }}>${dish.price.toFixed(2)}</div>
        </div>
        {conflicts.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <window.RestrictionFlag conflicts={conflicts} />
          </div>
        )}
      </div>
    </button>
  );
}

function DishCardStack({ dish, conflicts, onClick }) {
  return (
    <button onClick={onClick} style={{
      all: 'unset', cursor: 'pointer', display: 'flex', gap: 12, width: '100%',
      padding: '10px',
      border: '1px solid var(--rule)',
      borderRadius: 'var(--cardRadius)',
      background: 'var(--paper)',
    }}>
      <window.DishGradient dish={dish} style={{
        width: 88, height: 88, borderRadius: 'var(--radius)', flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          fontFamily: 'var(--display)', fontWeight: 'var(--displayWeight)',
          fontSize: 17, color: 'var(--ink)', lineHeight: 1.15, letterSpacing: -0.2,
        }}>{dish.name}</div>
        <div style={{
          fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--inkMuted)',
          marginTop: 3, lineHeight: 1.35, textWrap: 'pretty',
          overflow: 'hidden', textOverflow: 'ellipsis',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>{dish.tagline}</div>
        <div style={{ flex: 1 }} />
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8,
          marginTop: 6,
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {conflicts.length > 0
              ? <window.RestrictionFlag conflicts={conflicts} />
              : <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--inkFaint)', letterSpacing: 0.1, textTransform: 'uppercase' }}>
                  {dish.nutrition.cal} cal
                </span>
            }
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>${dish.price.toFixed(2)}</div>
        </div>
      </div>
    </button>
  );
}

function RestaurantScreen({
  restaurantId, onBack, onOpenDish, onOpenFilters,
  dietary, allergens, cardLayout = 'editorial', hasRestrictions,
  viewport = 'phone', hideRail = false,
}) {
  const r = window.RESTAURANTS.find(x => x.id === restaurantId);
  if (!r) return null;

  // Dishes (we use the shared DISHES set for any restaurant in the mock)
  const allDishes = window.DISHES;

  // Group by section, apply dietary filter (hides), compute conflicts (flags)
  const sections = {};
  for (const d of allDishes) {
    if (!window.dishMatchesDietary(d, dietary)) continue;
    (sections[d.section] = sections[d.section] || []).push(d);
  }
  const sectionOrder = ['Ramen', 'Sushi', 'Small plates'];

  const isWide = viewport === 'tablet' || viewport === 'desktop';
  const tileCols = viewport === 'desktop' ? 'repeat(3, 1fr)' : viewport === 'tablet' ? 'repeat(2, 1fr)' : '1fr 1fr';
  const pad = isWide ? 40 : 20;

  return (
    <div style={{ background: 'var(--paper)', minHeight: '100%', paddingBottom: 40 }}>
      {/* Top bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'var(--paper)',
        borderBottom: '1px solid var(--rule)',
        padding: `12px ${pad}px`,
        display: hideRail ? 'flex' : (isWide ? 'none' : 'flex'),
        alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button onClick={onBack} style={{
          all: 'unset', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase',
          letterSpacing: 0.12, color: 'var(--inkMuted)',
        }}>
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M7 1L2 5l5 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          All menus
        </button>
        <button onClick={onOpenFilters} style={{
          all: 'unset', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px',
          border: '1px solid ' + (hasRestrictions ? 'var(--accent)' : 'var(--rule)'),
          borderRadius: 999,
          fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase',
          letterSpacing: 0.12,
          background: hasRestrictions ? 'var(--accent)' : 'transparent',
          color: hasRestrictions ? 'var(--accentInk)' : 'var(--ink)',
        }}>Filters {hasRestrictions ? `· ${dietary.length + allergens.length}` : ''}</button>
      </div>

      {/* Restaurant header */}
      <div style={{ padding: `${isWide ? 40 : 18}px ${pad}px 0` }}>
        <window.MetaLine>Est. {r.established} · {r.neighborhood} · {r.priceLevel}</window.MetaLine>
        <h1 style={{
          fontFamily: 'var(--display)', fontWeight: 'var(--displayWeight)',
          fontSize: isWide ? 84 : 54, lineHeight: 0.95, letterSpacing: -1.5,
          color: 'var(--ink)', margin: '10px 0 0',
        }}>{r.name}</h1>
        <div style={{
          fontFamily: 'var(--display)', fontSize: 18, fontStyle: 'italic',
          color: 'var(--inkMuted)', marginTop: 4,
        }}>{r.subtitle}</div>
      </div>

      {/* Cover */}
      <div style={{ padding: `16px ${pad}px 0` }}>
        <div style={{
          height: isWide ? 280 : 140, borderRadius: 'var(--cardRadius)',
          background: `radial-gradient(120% 100% at 30% 30%, ${r.cover[0]}, ${r.cover[1]})`,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', right: 16, top: 16,
            fontFamily: 'var(--display)', fontSize: isWide ? 180 : 96, fontWeight: 400,
            color: 'rgba(255,255,255,0.9)', lineHeight: 0.8,
          }}>{r.name[0]}</div>
          <div style={{
            position: 'absolute', left: 20, bottom: 20,
            fontFamily: 'var(--ui)', fontSize: isWide ? 16 : 13, color: 'rgba(255,255,255,0.92)',
            fontStyle: 'italic', maxWidth: '70%',
          }}>{r.tagline}</div>
        </div>
      </div>

      {/* About */}
      <div style={{ padding: `20px ${pad}px 0`, display: 'flex', gap: 14 }}>
        <div style={{
          fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--ink)', lineHeight: 1.5,
          textWrap: 'pretty', flex: 1,
        }}>
          {r.tagline} {r.hours}. Kitchen sources from the Ferry Plaza market every Tuesday and Saturday. Walk-ins seated at the counter; tables by reservation only.
        </div>
      </div>

      {/* Quick facts */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)',
        margin: '20px 0 0',
      }}>
        {[
          { k: 'Rating', v: '★ ' + r.rating },
          { k: 'Distance', v: r.distance },
          { k: 'Status', v: r.hours.split('·')[0].trim() },
        ].map((f, i) => (
          <div key={f.k} style={{
            padding: '14px 16px',
            borderLeft: i === 0 ? 'none' : '1px solid var(--rule)',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <window.MetaLine>{f.k}</window.MetaLine>
            <div style={{
              fontFamily: 'var(--display)', fontWeight: 'var(--displayWeight)',
              fontSize: 17, color: 'var(--ink)', letterSpacing: -0.2,
            }}>{f.v}</div>
          </div>
        ))}
      </div>

      {/* Sections */}
      {sectionOrder.map((sec, secIdx) => {
        const items = sections[sec];
        if (!items || !items.length) return null;
        return (
          <div key={sec}>
            <window.SectionTitle
              number={secIdx + 1}
              title={sec}
              subtitle={`${items.length} dish${items.length > 1 ? 'es' : ''}`}
            />
            {cardLayout === 'editorial' && (
              <div style={{ padding: `0 ${pad}px` }}>
                {items.map((d, i) => {
                  const conflicts = window.dishConflicts(d, allergens);
                  return (
                    <DishCardEditorial
                      key={d.id}
                      dish={d}
                      conflicts={conflicts}
                      index={i + 1}
                      onClick={() => onOpenDish(d.id)}
                    />
                  );
                })}
              </div>
            )}
            {cardLayout === 'tile' && (
              <div style={{ padding: `10px ${pad}px 0`, display: 'grid', gridTemplateColumns: tileCols, gap: 12 }}>
                {items.map(d => {
                  const conflicts = window.dishConflicts(d, allergens);
                  return (
                    <DishCardTile
                      key={d.id}
                      dish={d}
                      conflicts={conflicts}
                      onClick={() => onOpenDish(d.id)}
                    />
                  );
                })}
              </div>
            )}
            {cardLayout === 'stack' && (
              <div style={{ padding: `8px ${pad}px 0`, display: 'grid', gridTemplateColumns: viewport === 'desktop' ? 'repeat(2, 1fr)' : '1fr', gap: 10 }}>
                {items.map(d => {
                  const conflicts = window.dishConflicts(d, allergens);
                  return (
                    <DishCardStack
                      key={d.id}
                      dish={d}
                      conflicts={conflicts}
                      onClick={() => onOpenDish(d.id)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

Object.assign(window, { RestaurantScreen });
