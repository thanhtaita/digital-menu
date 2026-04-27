// Screen: Dish detail. Big editorial header, gradient, nutrition pills,
// tappable ingredient grid, chef's note, warnings.

function DishDetailScreen({ dishId, onBack, onOpenIngredient, allergens, viewport = 'phone' }) {
  const d = window.DISHES.find(x => x.id === dishId);
  if (!d) return null;

  const conflicts = window.dishConflicts(d, allergens);
  const ings = d.ingredients.map(id => window.INGREDIENTS[id]).filter(Boolean);
  const isWide = viewport === 'tablet' || viewport === 'desktop';

  return (
    <div style={{ background: 'var(--paper)', minHeight: '100%', paddingBottom: 100, maxWidth: isWide ? 900 : 'none', margin: isWide ? '0 auto' : 0 }}>
      {/* Top bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'color-mix(in oklch, var(--paper) 85%, transparent)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        borderBottom: '1px solid var(--rule)',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
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
          Back to menu
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{
            all: 'unset', cursor: 'pointer',
            width: 30, height: 30, borderRadius: 999,
            border: '1px solid var(--rule)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" style={{ color: 'var(--inkMuted)' }}>
              <path d="M7 12.5S1 8.5 1 4.75A3.25 3.25 0 017 3a3.25 3.25 0 016 1.75C13 8.5 7 12.5 7 12.5z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Gradient header */}
      <window.DishGradient dish={d} style={{
        aspectRatio: '1/0.7',
        position: 'relative',
      }}>
        {/* Kanji */}
        <div style={{
          position: 'absolute', right: 20, top: 24,
          fontFamily: 'var(--display)', fontSize: 72, fontWeight: 400, lineHeight: 0.9,
          color: 'rgba(255,255,255,0.92)',
          textAlign: 'right',
          textShadow: '0 2px 20px rgba(0,0,0,0.25)',
        }}>{d.jp}</div>
        <div style={{
          position: 'absolute', left: 20, bottom: 16,
          display: 'flex', gap: 8,
          fontFamily: 'var(--mono)', fontSize: 10,
          textTransform: 'uppercase', letterSpacing: 0.1,
          color: 'rgba(255,255,255,0.95)',
        }}>
          <span style={{
            padding: '4px 9px', border: '0.5px solid rgba(255,255,255,0.5)', borderRadius: 999,
            background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)',
          }}>{d.section}</span>
          {d.chefPick && (
            <span style={{
              padding: '4px 9px', border: '0.5px solid rgba(255,255,255,0.5)', borderRadius: 999,
              background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)',
            }}>Chef’s pick</span>
          )}
        </div>
      </window.DishGradient>

      {/* Title block */}
      <div style={{ padding: '22px 20px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <window.MetaLine>Dish · {d.id}</window.MetaLine>
            <h1 style={{
              fontFamily: 'var(--display)', fontWeight: 'var(--displayWeight)',
              fontSize: 40, lineHeight: 1.0, letterSpacing: -0.8,
              color: 'var(--ink)', margin: '6px 0 0',
            }}>{d.name}</h1>
            <div style={{
              fontFamily: 'var(--display)', fontSize: 17, fontStyle: 'italic',
              color: 'var(--inkMuted)', marginTop: 4,
            }}>{d.jp}</div>
          </div>
          <div style={{
            fontFamily: 'var(--display)', fontWeight: 'var(--displayWeight)',
            fontSize: 32, color: 'var(--ink)', letterSpacing: -0.5,
          }}>${d.price.toFixed(2)}</div>
        </div>

        {/* Tagline */}
        <div style={{
          fontFamily: 'var(--display)', fontWeight: 'var(--displayWeight)',
          fontSize: 20, fontStyle: 'italic', color: 'var(--inkMuted)',
          marginTop: 14, lineHeight: 1.3, textWrap: 'pretty',
        }}>“{d.tagline}”</div>

        {/* Restriction banner */}
        {conflicts.length > 0 && (
          <div style={{
            marginTop: 16, padding: '12px 14px',
            borderRadius: 'var(--radius)',
            background: 'color-mix(in oklch, var(--warn) 10%, var(--paper))',
            border: '1px solid color-mix(in oklch, var(--warn) 30%, transparent)',
            display: 'flex', gap: 10, alignItems: 'flex-start',
            fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--warn)',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M8 1.5L15 14H1L8 1.5z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
              <path d="M8 6v3.5M8 11.5v0.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <div>
              <b style={{ textTransform: 'uppercase', letterSpacing: 0.06, fontSize: 11 }}>
                Flagged for your restrictions
              </b>
              <div style={{ marginTop: 2, color: 'var(--ink)' }}>
                Contains {conflicts.join(', ')}. Ingredients below are marked individually.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Nutrition */}
      <div style={{
        margin: '22px 20px 0',
        padding: '14px 16px',
        border: '1px solid var(--rule)',
        borderRadius: 'var(--cardRadius)',
        background: 'var(--paperAlt)',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <window.MetaLine>Nutrition · per serving</window.MetaLine>
          <span style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--inkFaint)' }}>approx.</span>
        </div>
        <window.NutritionPills n={d.nutrition} />
      </div>

      {/* Description */}
      <div style={{ padding: '22px 20px 0' }}>
        <window.MetaLine>About this dish</window.MetaLine>
        <div style={{
          fontFamily: 'var(--ui)', fontSize: 14, lineHeight: 1.55,
          color: 'var(--ink)', marginTop: 10, textWrap: 'pretty',
        }}>{d.description}</div>
      </div>

      {/* Ingredients — the hero interaction */}
      <window.SectionTitle title="Ingredients" subtitle={`${ings.length} · tap any to learn more`} />
      <div style={{ padding: '4px 20px 0' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
        }}>
          {ings.map(ing => {
            const flagged = (ing.allergens || []).some(a => allergens.includes(a));
            return (
              <button
                key={ing.id}
                onClick={() => onOpenIngredient(ing.id)}
                style={{
                  all: 'unset', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px 8px 8px',
                  border: '1px solid ' + (flagged ? 'color-mix(in oklch, var(--warn) 40%, transparent)' : 'var(--rule)'),
                  borderRadius: 999,
                  background: flagged ? 'color-mix(in oklch, var(--warn) 6%, var(--paper))' : 'var(--paper)',
                }}
              >
                <window.IngredientGradient ingredient={ing} style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 500,
                    color: 'var(--ink)', lineHeight: 1.1,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{ing.name}</div>
                  <div style={{
                    fontFamily: 'var(--mono)', fontSize: 9.5, color: flagged ? 'var(--warn)' : 'var(--inkFaint)',
                    textTransform: 'uppercase', letterSpacing: 0.1, marginTop: 1,
                  }}>{flagged ? 'Flagged' : ing.category}</div>
                </div>
                <svg width="8" height="12" viewBox="0 0 8 12" style={{ color: 'var(--inkFaint)', flexShrink: 0 }}>
                  <path d="M2 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chef note */}
      <div style={{ padding: '26px 20px 0' }}>
        <div style={{
          padding: '18px 18px',
          borderTop: '1px solid var(--rule)',
          borderBottom: '1px solid var(--rule)',
          fontFamily: 'var(--display)', fontWeight: 'var(--displayWeight)',
          fontSize: 16, fontStyle: 'italic', color: 'var(--inkMuted)',
          lineHeight: 1.4, textWrap: 'pretty',
        }}>
          {d.notes}
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{
        position: 'sticky', bottom: 0, zIndex: 30,
        padding: '14px 20px 18px',
        background: 'color-mix(in oklch, var(--paper) 85%, transparent)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        borderTop: '1px solid var(--rule)',
        display: 'flex', gap: 10, alignItems: 'center',
      }}>
        <button style={{
          all: 'unset', cursor: 'pointer', textAlign: 'center',
          padding: '13px 16px', minWidth: 54,
          border: '1px solid var(--rule)', borderRadius: 999,
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" style={{ color: 'var(--inkMuted)' }}>
            <path d="M4 2v12l4-3 4 3V2H4z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
          </svg>
        </button>
        <button style={{
          all: 'unset', cursor: 'pointer', flex: 1, textAlign: 'center',
          padding: '13px 16px',
          background: 'var(--ink)', color: 'var(--paper)',
          borderRadius: 999,
          fontFamily: 'var(--ui)', fontSize: 14, fontWeight: 500,
        }}>Add to order · ${d.price.toFixed(2)}</button>
      </div>
    </div>
  );
}

Object.assign(window, { DishDetailScreen });
