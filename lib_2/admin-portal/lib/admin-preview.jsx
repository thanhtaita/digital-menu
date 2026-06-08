// Phone preview — renders a tiny diner-app-style menu inside a phone frame.
// Reuses tokens visually so the user sees the editorial look they edit in.

function PreviewPhone({ dish, dishes, sections, scale = 0.62, mode = 'menu' }) {
  // Editorial diner tokens, inlined
  const t = {
    paper: 'oklch(0.97 0.008 80)',
    paperAlt: 'oklch(0.94 0.012 75)',
    ink: 'oklch(0.18 0.01 60)',
    inkMuted: 'oklch(0.45 0.01 60)',
    inkFaint: 'oklch(0.62 0.008 60)',
    rule: 'oklch(0.85 0.01 70)',
    accent: 'oklch(0.52 0.18 25)',
    display: '"Instrument Serif", Georgia, serif',
    mono: '"JetBrains Mono", monospace',
  };

  const PhoneShell = ({ children }) => (
    <div style={{
      width: 320, height: 660,
      borderRadius: 38, padding: 8,
      background: '#1a1a1a',
      boxShadow: '0 24px 60px rgba(0,0,0,0.18), 0 6px 16px rgba(0,0,0,0.08)',
      flexShrink: 0,
      transform: `scale(${scale})`, transformOrigin: 'top center',
    }}>
      <div style={{
        width: '100%', height: '100%',
        borderRadius: 30, overflow: 'hidden',
        background: t.paper, position: 'relative',
        fontFamily: 'Inter, sans-serif',
      }}>
        {/* Notch */}
        <div style={{
          position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
          width: 90, height: 22, background: '#1a1a1a', borderRadius: 12, zIndex: 5,
        }}/>
        {/* Status bar */}
        <div style={{
          padding: '10px 22px 0', display: 'flex', justifyContent: 'space-between',
          fontSize: 11, fontWeight: 600, color: t.ink,
        }}>
          <span>9:41</span><span style={{ width: 90 }}/><span style={{ fontFamily: t.mono, fontSize: 10 }}>● ●●</span>
        </div>
        <div style={{ height: 'calc(100% - 24px)', overflow: 'hidden' }}>
          {children}
        </div>
      </div>
    </div>
  );

  if (mode === 'dish' && dish) {
    return (
      <PhoneShell>
        <div style={{ padding: '20px 18px 0' }}>
          <div style={{ fontFamily: t.mono, fontSize: 9, letterSpacing: 0.12, textTransform: 'uppercase', color: t.inkFaint }}>
            ← Tsubaki · Ramen
          </div>
        </div>
        <div style={{
          margin: '12px 18px 0',
          height: 160, borderRadius: 8,
          background: 'linear-gradient(135deg, oklch(0.55 0.11 35), oklch(0.32 0.07 25))',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', right: 12, top: 8,
            fontFamily: t.display, fontSize: 96, fontWeight: 400,
            color: 'rgba(255,255,255,0.85)', lineHeight: 0.8,
          }}>{dish.name?.[0]}</div>
        </div>
        <div style={{ padding: '14px 18px' }}>
          <div style={{ fontFamily: t.mono, fontSize: 9, letterSpacing: 0.1, textTransform: 'uppercase', color: t.inkFaint }}>
            № {dish.id} · ${dish.price?.toFixed(2)}
          </div>
          <h1 style={{
            fontFamily: t.display, fontWeight: 400, fontSize: 32,
            margin: '6px 0 2px', lineHeight: 1, letterSpacing: -0.5, color: t.ink,
          }}>{dish.name || 'Untitled dish'}</h1>
          <div style={{ fontFamily: t.display, fontStyle: 'italic', fontSize: 14, color: t.inkMuted }}>{dish.jp}</div>
          <div style={{ fontSize: 12, color: t.ink, marginTop: 10, lineHeight: 1.5 }}>{dish.tagline}</div>
          <div style={{ fontFamily: t.mono, fontSize: 9, letterSpacing: 0.1, textTransform: 'uppercase', color: t.inkFaint, marginTop: 14, paddingTop: 10, borderTop: `1px solid ${t.rule}` }}>
            Ingredients · {dish.ingredients?.length || 0}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
            {(dish.ingredients || []).slice(0, 8).map(id => {
              const ing = window.ADMIN_INGREDIENTS[id];
              if (!ing) return null;
              return (
                <span key={id} style={{
                  fontSize: 10.5, padding: '3px 8px', borderRadius: 999,
                  border: `1px solid ${t.rule}`, color: t.ink,
                  background: t.paperAlt,
                }}>{ing.name}</span>
              );
            })}
          </div>
        </div>
      </PhoneShell>
    );
  }

  // Menu list mode
  return (
    <PhoneShell>
      <div style={{ padding: '14px 18px 6px' }}>
        <div style={{ fontFamily: t.mono, fontSize: 9, letterSpacing: 0.1, textTransform: 'uppercase', color: t.inkFaint }}>
          Mission District · ★ 4.8
        </div>
        <h1 style={{
          fontFamily: t.display, fontWeight: 400, fontSize: 36,
          margin: '4px 0 0', letterSpacing: -0.8, lineHeight: 1, color: t.ink,
        }}>Tsubaki</h1>
        <div style={{ fontFamily: t.display, fontStyle: 'italic', fontSize: 14, color: t.inkMuted }}>Izakaya & Ramen</div>
      </div>
      <div style={{
        margin: '10px 18px 0', height: 90, borderRadius: 8,
        background: 'radial-gradient(120% 100% at 30% 30%, oklch(0.94 0.03 60), oklch(0.78 0.08 40))',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', right: 10, top: 4,
          fontFamily: t.display, fontSize: 60, color: 'rgba(255,255,255,0.85)', lineHeight: 0.9,
        }}>T</div>
      </div>
      {(sections || []).slice(0, 2).map((sec, si) => (
        <div key={sec.id}>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 8,
            padding: '14px 18px 8px', marginTop: 4,
            borderBottom: `1px solid ${t.rule}`,
          }}>
            <span style={{ fontFamily: t.mono, fontSize: 9, color: t.inkFaint, letterSpacing: 0.1, textTransform: 'uppercase' }}>0{si + 1}</span>
            <span style={{ fontFamily: t.display, fontSize: 18, color: t.ink, letterSpacing: -0.2 }}>{sec.title}</span>
          </div>
          <div style={{ padding: '0 18px' }}>
            {(dishes || []).filter(d => d.section === sec.id).slice(0, 2).map((d, i) => (
              <div key={d.id} style={{
                display: 'flex', gap: 10, padding: '12px 0',
                borderBottom: `1px solid ${t.rule}`,
              }}>
                <div style={{ fontFamily: t.mono, fontSize: 9, color: t.inkFaint, paddingTop: 4, minWidth: 16 }}>0{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: t.display, fontSize: 15, color: t.ink, letterSpacing: -0.2, lineHeight: 1.1 }}>{d.name}</div>
                  <div style={{ fontFamily: t.display, fontSize: 10, fontStyle: 'italic', color: t.inkMuted, marginTop: 1 }}>{d.jp}</div>
                  <div style={{ fontSize: 10.5, color: t.ink, marginTop: 4, lineHeight: 1.35 }}>{d.tagline}</div>
                </div>
                <div style={{
                  width: 40, height: 40, borderRadius: 4,
                  background: 'linear-gradient(135deg, oklch(0.7 0.08 50), oklch(0.45 0.1 30))',
                  flexShrink: 0,
                }}/>
              </div>
            ))}
          </div>
        </div>
      ))}
    </PhoneShell>
  );
}

Object.assign(window, { PreviewPhone });
