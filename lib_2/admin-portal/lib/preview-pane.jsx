// Toggleable diner-app preview pane. A simulated phone-frame rendering
// of one dish or one section so admins see how their edits read.

function PreviewPane({ menu, focusDishId, onClose }) {
  // Find the dish to focus, default to first dish
  let focusDish = null, focusSection = null;
  for (const sec of menu.sections) {
    for (const d of sec.dishes) {
      if (!focusDish) { focusDish = d; focusSection = sec; }
      if (d.id === focusDishId) { focusDish = d; focusSection = sec; }
    }
  }

  return (
    <aside style={{
      width: 360, flexShrink: 0,
      background: 'var(--panel-2)',
      borderLeft: '1px solid var(--rule)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0,
    }}>
      {/* Header */}
      <div style={{
        height: 'var(--header-h)',
        padding: '0 14px',
        borderBottom: '1px solid var(--rule)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <window.Icon name="eye" size={14} color="var(--ink-2)"/>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink)' }}>Diner preview</div>
        <window.Pill tone="neutral">live</window.Pill>
        <div style={{ flex: 1 }}/>
        <button onClick={onClose} style={{
          all: 'unset', cursor: 'pointer', padding: 4, color: 'var(--ink-mute)',
        }}>
          <window.Icon name="x" size={13}/>
        </button>
      </div>

      {/* Phone frame */}
      <div className="scroll" style={{ flex: 1, overflow: 'auto', padding: '20px 16px 30px' }}>
        <div style={{
          margin: '0 auto', maxWidth: 320,
          background: 'oklch(0.18 0.005 260)',
          borderRadius: 36, padding: 8,
          boxShadow: '0 12px 40px -10px rgba(20,30,50,0.18), 0 1px 0 oklch(0.92 0.005 260)',
        }}>
          {/* The diner-app surface — uses the editorial palette */}
          <div style={{
            background: 'oklch(0.97 0.008 80)',
            borderRadius: 30,
            overflow: 'hidden',
            color: 'oklch(0.18 0.01 60)',
            fontFamily: 'Inter, sans-serif',
          }}>
            {/* Status bar */}
            <div style={{
              padding: '12px 22px 6px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: 11, fontWeight: 600,
            }}>
              <span>9:41</span>
              <span style={{ display: 'flex', gap: 4 }}>
                <svg width="14" height="9" viewBox="0 0 14 9"><path d="M1 8h2M4 6h2M7 4h2M10 2h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                <span>100%</span>
              </span>
            </div>

            {/* Restaurant header */}
            <div style={{ padding: '8px 22px 14px' }}>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 9,
                color: 'oklch(0.62 0.008 60)', textTransform: 'uppercase', letterSpacing: 0.12,
              }}>Est. 2014 · Mission · $$</div>
              <div style={{
                fontFamily: '"Instrument Serif", serif', fontSize: 40, lineHeight: 1,
                marginTop: 4, letterSpacing: -0.8,
              }}>Tsubaki</div>
              <div style={{
                fontFamily: '"Instrument Serif", serif', fontStyle: 'italic',
                fontSize: 13, color: 'oklch(0.45 0.01 60)', marginTop: 2,
              }}>Izakaya & Ramen</div>
            </div>

            {/* Section break */}
            <div style={{
              padding: '14px 22px 8px',
              borderTop: '1px solid oklch(0.85 0.01 70)',
              borderBottom: '1px solid oklch(0.85 0.01 70)',
              display: 'flex', alignItems: 'baseline', gap: 8,
            }}>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 9,
                color: 'oklch(0.62 0.008 60)', letterSpacing: 0.12, textTransform: 'uppercase',
              }}>01</div>
              <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 22, letterSpacing: -0.3 }}>{focusSection ? focusSection.name : 'Menu'}</div>
            </div>

            {/* Focus dish */}
            {focusDish && (
              <div style={{ padding: '16px 22px 24px' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 22, lineHeight: 1.1, letterSpacing: -0.3 }}>
                      {focusDish.name}
                    </div>
                    <div style={{
                      fontFamily: '"Instrument Serif", serif', fontStyle: 'italic',
                      fontSize: 12, color: 'oklch(0.45 0.01 60)', marginTop: 2,
                    }}>{focusDish.jp}</div>
                    <div style={{ fontSize: 12, marginTop: 8, lineHeight: 1.45 }}>{focusDish.tagline || <span style={{ color: 'oklch(0.62 0.008 60)', fontStyle: 'italic' }}>No tagline yet</span>}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    {focusDish.photo ? (
                      <window.DishThumb dish={focusDish} size={64} radius={4}/>
                    ) : (
                      <div style={{
                        width: 64, height: 64, borderRadius: 4,
                        border: '1px dashed oklch(0.78 0.01 70)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'oklch(0.62 0.008 60)', fontSize: 9, fontFamily: '"JetBrains Mono", monospace', textAlign: 'center',
                      }}>NO<br/>PHOTO</div>
                    )}
                    <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, fontWeight: 600 }}>${focusDish.price.toFixed(2)}</div>
                  </div>
                </div>
                {/* Description */}
                {focusDish.description && (
                  <div style={{
                    fontSize: 12, lineHeight: 1.55, color: 'oklch(0.36 0.010 260)',
                    marginTop: 14, paddingTop: 14, borderTop: '1px solid oklch(0.85 0.01 70)',
                    textWrap: 'pretty',
                  }}>
                    {focusDish.description}
                  </div>
                )}
                {/* Ingredient pills */}
                {focusDish.ingredients && focusDish.ingredients.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{
                      fontFamily: '"JetBrains Mono", monospace', fontSize: 9,
                      color: 'oklch(0.62 0.008 60)', textTransform: 'uppercase',
                      letterSpacing: 0.12, marginBottom: 6,
                    }}>Ingredients · tap to learn</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {focusDish.ingredients.map(id => {
                        const ing = window.INGREDIENTS.find(i => i.id === id);
                        return ing ? (
                          <span key={id} style={{
                            fontSize: 11, padding: '3px 8px',
                            border: '1px solid oklch(0.85 0.01 70)', borderRadius: 999,
                            color: 'oklch(0.18 0.01 60)',
                          }}>{ing.name}</span>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!focusDish && (
              <div style={{
                padding: 40, textAlign: 'center',
                color: 'oklch(0.62 0.008 60)', fontSize: 12, fontStyle: 'italic',
                fontFamily: '"Instrument Serif", serif',
              }}>
                Add a dish to preview it here.
              </div>
            )}
          </div>
        </div>

        <div style={{
          textAlign: 'center', marginTop: 12,
          fontSize: 11, color: 'var(--ink-faint)',
        }}>
          Reflects unpublished draft · iPhone 14 frame
        </div>
      </div>
    </aside>
  );
}

Object.assign(window, { PreviewPane });
