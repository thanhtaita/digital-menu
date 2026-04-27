// Filter sheet — allergens & dietary preferences.
// On narrow viewports: slides up from bottom.
// On wide viewports (tablet+): caller renders it as a sticky side panel instead.

function FilterPanel({
  dietary, allergens, onChange, onClose, isSheet = true, inline = false,
}) {
  const [mounted, setMounted] = React.useState(!isSheet);
  React.useEffect(() => {
    if (isSheet) {
      const t = setTimeout(() => setMounted(true), 20);
      return () => clearTimeout(t);
    }
  }, []);

  const toggleDietary = (id) => {
    const next = dietary.includes(id) ? dietary.filter(x => x !== id) : [...dietary, id];
    onChange({ dietary: next, allergens });
  };
  const toggleAllergen = (id) => {
    const next = allergens.includes(id) ? allergens.filter(x => x !== id) : [...allergens, id];
    onChange({ dietary, allergens: next });
  };
  const clear = () => onChange({ dietary: [], allergens: [] });

  const body = (
    <div style={{ padding: inline ? '20px 22px' : '6px 20px 24px' }}>
      {/* DIETARY */}
      <div>
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          paddingBottom: 10, borderBottom: '1px solid var(--rule)',
        }}>
          <window.MetaLine>Diet</window.MetaLine>
          <span style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--inkFaint)' }}>choose all that apply</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 12 }}>
          {window.DIETARY_FILTERS.map(d => {
            const on = dietary.includes(d.id);
            return (
              <button key={d.id} onClick={() => toggleDietary(d.id)} style={{
                all: 'unset', cursor: 'pointer',
                fontFamily: 'var(--ui)', fontSize: 13,
                padding: '8px 14px',
                borderRadius: 999,
                border: '1px solid ' + (on ? 'var(--ink)' : 'var(--rule)'),
                background: on ? 'var(--ink)' : 'transparent',
                color: on ? 'var(--paper)' : 'var(--ink)',
                transition: 'all 140ms ease',
              }}>{d.label}</button>
            );
          })}
        </div>
      </div>

      {/* ALLERGENS */}
      <div style={{ marginTop: 24 }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          paddingBottom: 10, borderBottom: '1px solid var(--rule)',
        }}>
          <window.MetaLine>Avoid allergens</window.MetaLine>
          <span style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--inkFaint)' }}>dishes will be flagged, not hidden</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 4 }}>
          {window.ALLERGENS.map((a, i) => {
            const on = allergens.includes(a.id);
            return (
              <button key={a.id} onClick={() => toggleAllergen(a.id)} style={{
                all: 'unset', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 2px',
                borderBottom: i === window.ALLERGENS.length - 1 ? 'none' : '1px solid var(--rule)',
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 4,
                  border: '1.5px solid ' + (on ? 'var(--warn)' : 'var(--rule)'),
                  background: on ? 'var(--warn)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {on && (
                    <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
                      <path d="M1 4l3 3 6-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <div style={{ flex: 1, fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--ink)' }}>
                  {a.label}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        <button onClick={clear} style={{
          all: 'unset', cursor: 'pointer', flex: 1, textAlign: 'center',
          padding: '12px 14px',
          border: '1px solid var(--rule)', borderRadius: 999,
          fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--inkMuted)',
        }}>Reset</button>
        {isSheet && (
          <button onClick={onClose} style={{
            all: 'unset', cursor: 'pointer', flex: 2, textAlign: 'center',
            padding: '12px 14px',
            background: 'var(--accent)', color: 'var(--accentInk)',
            borderRadius: 999,
            fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 500,
            letterSpacing: 0.02,
          }}>Apply</button>
        )}
      </div>
    </div>
  );

  if (inline) {
    return (
      <div style={{
        background: 'var(--paper)',
        borderLeft: '1px solid var(--rule)',
        height: '100%', overflow: 'auto',
      }}>
        <div style={{ padding: '20px 22px 8px', borderBottom: '1px solid var(--rule)' }}>
          <window.MetaLine>Preferences</window.MetaLine>
          <div style={{
            fontFamily: 'var(--display)', fontWeight: 'var(--displayWeight)',
            fontSize: 28, lineHeight: 1.05, color: 'var(--ink)', marginTop: 4,
            letterSpacing: -0.3,
          }}>Filters</div>
          <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--inkMuted)', marginTop: 6 }}>
            Personalize what’s shown.
          </div>
        </div>
        {body}
      </div>
    );
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0, zIndex: 200,
          background: mounted ? 'rgba(10,8,6,0.42)' : 'rgba(10,8,6,0)',
          transition: 'background 220ms ease',
          backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
        }}
      />
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 201,
        background: 'var(--paper)',
        borderTopLeftRadius: 'calc(var(--cardRadius) * 1.4)',
        borderTopRightRadius: 'calc(var(--cardRadius) * 1.4)',
        maxHeight: '88%', overflow: 'hidden',
        transform: mounted ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 320ms cubic-bezier(.22,.8,.26,1)',
        boxShadow: '0 -20px 60px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 4 }}>
          <div style={{ width: 40, height: 4, borderRadius: 4, background: 'var(--rule)' }} />
        </div>
        <div style={{ padding: '10px 20px 12px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div>
            <window.MetaLine>Preferences</window.MetaLine>
            <div style={{
              fontFamily: 'var(--display)', fontWeight: 'var(--displayWeight)',
              fontSize: 28, lineHeight: 1.05, color: 'var(--ink)', marginTop: 2,
              letterSpacing: -0.3,
            }}>Filter menu</div>
          </div>
          <button onClick={onClose} style={{
            all: 'unset', cursor: 'pointer',
            fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase',
            letterSpacing: 0.1, color: 'var(--inkFaint)',
            padding: '6px 10px', border: '1px solid var(--rule)', borderRadius: 999,
          }}>Close</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {body}
        </div>
      </div>
    </>
  );
}

Object.assign(window, { FilterPanel });
