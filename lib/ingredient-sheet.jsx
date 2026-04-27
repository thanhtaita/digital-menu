// Ingredient bottom sheet — the core feature.
// Surprising touch: shows *not just* a dictionary card, but
// "used across this menu" discovery, so it becomes a wayfinding tool.

function IngredientSheet({ ingredientId, menu, onClose, onOpenIngredient, onOpenDish }) {
  const ing = window.INGREDIENTS[ingredientId];
  const [lang, setLang] = React.useState('en');
  const sheetRef = React.useRef(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setMounted(true), 20);
    return () => clearTimeout(t);
  }, [ingredientId]);

  if (!ing) return null;

  // Find other dishes in this menu using this ingredient
  const alsoIn = (menu || []).filter(d =>
    d.ingredients.includes(ingredientId)
  );

  const translations = {
    en: { name: ing.name, desc: ing.description, tag: ing.tagline },
    jp: { name: ing.jp || ing.name, desc: '原料について、日本語の説明がここに入ります。（翻訳プレビュー）', tag: ing.tagline },
    es: { name: ing.name, desc: 'Descripción del ingrediente en español. (Vista previa de traducción.)', tag: ing.tagline },
  };
  const t = translations[lang];

  return (
    <>
      {/* scrim */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0, zIndex: 200,
          background: mounted ? 'rgba(10,8,6,0.42)' : 'rgba(10,8,6,0)',
          transition: 'background 220ms ease',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
        }}
      />
      {/* sheet */}
      <div
        ref={sheetRef}
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 201,
          background: 'var(--paper)',
          borderTopLeftRadius: 'calc(var(--cardRadius) * 1.4)',
          borderTopRightRadius: 'calc(var(--cardRadius) * 1.4)',
          maxHeight: '85%',
          overflow: 'hidden',
          transform: mounted ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 320ms cubic-bezier(.22,.8,.26,1)',
          boxShadow: '0 -20px 60px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* grab handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 4 }}>
          <div style={{ width: 40, height: 4, borderRadius: 4, background: 'var(--rule)' }} />
        </div>

        {/* header image */}
        <div style={{ padding: '8px 20px 0', position: 'relative' }}>
          <window.IngredientGradient ingredient={ing} style={{
            height: 140,
            borderRadius: 'var(--cardRadius)',
            position: 'relative',
          }} />
          {/* Kanji overlay */}
          <div style={{
            position: 'absolute', right: 32, top: 20,
            fontFamily: 'var(--display)',
            fontSize: 64, lineHeight: 1,
            color: 'rgba(255,255,255,0.88)',
            fontWeight: 400,
            textShadow: '0 2px 16px rgba(0,0,0,0.3)',
          }}>{ing.jp}</div>
          {/* category tag */}
          <div style={{
            position: 'absolute', left: 32, bottom: 14,
            display: 'inline-flex', gap: 8, alignItems: 'center',
            fontFamily: 'var(--mono)', fontSize: 10,
            textTransform: 'uppercase', letterSpacing: 0.1,
            color: 'rgba(255,255,255,0.92)',
          }}>
            <span style={{ padding: '3px 8px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 999, backdropFilter: 'blur(8px)' }}>{ing.category}</span>
            <span>{ing.origin}</span>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px 24px' }}>
          {/* Title line */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <window.MetaLine>Ingredient · {ing.id}</window.MetaLine>
              <div style={{
                fontFamily: 'var(--display)', fontWeight: 'var(--displayWeight)',
                fontSize: 34, lineHeight: 1.05, color: 'var(--ink)',
                letterSpacing: -0.5, marginTop: 4,
              }}>{t.name}</div>
              {ing.aliases && ing.aliases.length > 0 && (
                <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--inkMuted)', marginTop: 4, fontStyle: 'italic' }}>
                  also: {ing.aliases.join(' · ')}
                </div>
              )}
            </div>
            {/* lang toggle */}
            <div style={{
              display: 'flex', gap: 2, padding: 2,
              border: '1px solid var(--rule)', borderRadius: 999,
              fontFamily: 'var(--mono)', fontSize: 10,
            }}>
              {['en', 'jp', 'es'].map(l => (
                <button key={l} onClick={() => setLang(l)} style={{
                  border: 'none',
                  background: lang === l ? 'var(--ink)' : 'transparent',
                  color: lang === l ? 'var(--paper)' : 'var(--inkMuted)',
                  padding: '4px 10px', borderRadius: 999,
                  textTransform: 'uppercase', letterSpacing: 0.1, cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 'inherit',
                }}>{l}</button>
              ))}
            </div>
          </div>

          {/* Pull quote */}
          <div style={{
            fontFamily: 'var(--display)', fontWeight: 'var(--displayWeight)',
            fontSize: 19, lineHeight: 1.35, color: 'var(--inkMuted)',
            fontStyle: 'italic',
            padding: '18px 0 16px',
            borderTop: '1px solid var(--rule)',
            borderBottom: '1px solid var(--rule)',
            marginTop: 18,
          }}>
            “{t.tag}”
          </div>

          {/* Description */}
          <div style={{
            fontFamily: 'var(--ui)', fontSize: 14, lineHeight: 1.55,
            color: 'var(--ink)', marginTop: 16, textWrap: 'pretty',
          }}>{t.desc}</div>

          {/* Allergen flag */}
          {ing.allergens && ing.allergens.length > 0 && (
            <div style={{
              marginTop: 16, padding: '10px 12px',
              borderRadius: 'var(--radius)',
              background: 'color-mix(in oklch, var(--warn) 10%, var(--paper))',
              border: '1px solid color-mix(in oklch, var(--warn) 30%, transparent)',
              display: 'flex', gap: 10, alignItems: 'center',
              fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--warn)',
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M7 4v4M7 10v0.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <div>
                <b style={{ textTransform: 'uppercase', letterSpacing: 0.06, fontSize: 10.5 }}>Common allergen</b> · contains {ing.allergens.join(', ')}
              </div>
            </div>
          )}

          {/* SURPRISE: Appears across this menu */}
          {alsoIn.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={{
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                paddingBottom: 10, borderBottom: '1px solid var(--rule)',
              }}>
                <window.MetaLine color="var(--inkMuted)">On this menu · {alsoIn.length}×</window.MetaLine>
                <span style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--inkFaint)' }}>tap to jump</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {alsoIn.map((d, i) => (
                  <button key={d.id} onClick={() => onOpenDish && onOpenDish(d.id)}
                    style={{
                      all: 'unset', cursor: 'pointer',
                      display: 'flex', gap: 12, alignItems: 'center',
                      padding: '12px 0',
                      borderBottom: i === alsoIn.length - 1 ? 'none' : '1px solid var(--rule)',
                    }}>
                    <window.DishGradient dish={d} style={{
                      width: 44, height: 44, flexShrink: 0,
                      borderRadius: 'var(--radius)',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: 'var(--display)', fontWeight: 'var(--displayWeight)',
                        fontSize: 17, color: 'var(--ink)', lineHeight: 1.2,
                      }}>{d.name}</div>
                      <div style={{ fontFamily: 'var(--ui)', fontSize: 11.5, color: 'var(--inkFaint)' }}>
                        {d.section} · ${d.price.toFixed(2)}
                      </div>
                    </div>
                    <svg width="10" height="14" viewBox="0 0 10 14" style={{ color: 'var(--inkFaint)' }}>
                      <path d="M2 2l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Common dishes it appears in globally */}
          {ing.commonIn && (
            <div style={{ marginTop: 22 }}>
              <window.MetaLine>Typically in</window.MetaLine>
              <div style={{
                fontFamily: 'var(--display)', fontWeight: 'var(--displayWeight)',
                fontSize: 16, color: 'var(--inkMuted)', marginTop: 6, lineHeight: 1.3,
              }}>{ing.commonIn.join(' · ')}</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

Object.assign(window, { IngredientSheet });
