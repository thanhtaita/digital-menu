// Main app — responsive shell with phone / tablet / desktop viewports.

const DEFAULT_TWEAKS = /*EDITMODE-BEGIN*/{
  "theme": "editorial",
  "cardLayout": "editorial",
  "viewport": "auto",
  "startScreen": "menuList",
  "seedRestrictions": true
}/*EDITMODE-END*/;

function App() {
  const [tweaks, setTweaks] = React.useState(DEFAULT_TWEAKS);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('theMenu:tweaks');
      if (saved) setTweaks({ ...DEFAULT_TWEAKS, ...JSON.parse(saved) });
    } catch {}
  }, []);

  React.useEffect(() => {
    const onMsg = (e) => {
      const m = e.data;
      if (!m || !m.type) return;
      if (m.type === '__activate_edit_mode') setTweaksOpen(true);
      if (m.type === '__deactivate_edit_mode') setTweaksOpen(false);
    };
    window.addEventListener('message', onMsg);
    try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch {}
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const updateTweak = (key, value) => {
    const next = { ...tweaks, [key]: value };
    setTweaks(next);
    try { localStorage.setItem('theMenu:tweaks', JSON.stringify(next)); } catch {}
    try { window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [key]: value } }, '*'); } catch {}
  };

  const [tweaksOpen, setTweaksOpen] = React.useState(false);

  const [screen, setScreen] = React.useState({ kind: tweaks.startScreen || 'menuList' });
  const [ingredientSheet, setIngredientSheet] = React.useState(null);
  const [filterOpen, setFilterOpen] = React.useState(false);

  const [dietary, setDietary] = React.useState(tweaks.seedRestrictions ? ['vegetarian'] : []);
  const [allergens, setAllergens] = React.useState(tweaks.seedRestrictions ? ['wheat'] : []);
  const hasRestrictions = dietary.length + allergens.length > 0;

  const viewport = window.useViewport(tweaks.viewport);
  const tTokens = window.themeStyles(tweaks.theme);

  // When user picks a restaurant on tablet/desktop, we auto-open it on right pane.
  // But keep menuList as the "root" on phone.
  const effectiveScreen = React.useMemo(() => {
    if ((viewport === 'tablet' || viewport === 'desktop') && screen.kind === 'menuList') {
      return { kind: 'restaurant', id: window.RESTAURANTS[0].id };
    }
    return screen;
  }, [screen, viewport]);

  const pickRestaurant = (id) => setScreen({ kind: 'restaurant', id });
  const openDish = (id) => setScreen({ kind: 'dish', id, lastRestaurant: (screen.id || window.RESTAURANTS[0].id) });

  const screenInner = (
    <>
      {effectiveScreen.kind === 'menuList' && (
        <window.MenuListScreen
          onPickRestaurant={pickRestaurant}
          onOpenFilters={() => setFilterOpen(true)}
          hasRestrictions={hasRestrictions}
        />
      )}
      {effectiveScreen.kind === 'restaurant' && (
        <window.RestaurantScreen
          restaurantId={effectiveScreen.id}
          onBack={() => setScreen({ kind: 'menuList' })}
          onOpenDish={openDish}
          onOpenFilters={() => setFilterOpen(true)}
          dietary={dietary}
          allergens={allergens}
          cardLayout={tweaks.cardLayout}
          hasRestrictions={hasRestrictions}
          viewport={viewport}
          hideRail={viewport === 'phone'}
        />
      )}
      {effectiveScreen.kind === 'dish' && (
        <window.DishDetailScreen
          dishId={effectiveScreen.id}
          onBack={() => setScreen({ kind: 'restaurant', id: effectiveScreen.lastRestaurant || window.RESTAURANTS[0].id })}
          onOpenIngredient={(id) => setIngredientSheet(id)}
          allergens={allergens}
          viewport={viewport}
        />
      )}

      {ingredientSheet && (
        <window.IngredientSheet
          ingredientId={ingredientSheet}
          menu={window.DISHES}
          onClose={() => setIngredientSheet(null)}
          onOpenDish={(id) => { setIngredientSheet(null); openDish(id); }}
        />
      )}

      {filterOpen && viewport === 'phone' && (
        <window.FilterPanel
          dietary={dietary}
          allergens={allergens}
          onChange={({ dietary: d, allergens: a }) => { setDietary(d); setAllergens(a); }}
          onClose={() => setFilterOpen(false)}
          isSheet={true}
        />
      )}
    </>
  );

  // Phone: iOS device frame. Tablet/desktop: app chrome with rails.
  let stage;
  if (viewport === 'phone') {
    stage = (
      <window.IOSDevice width={390} height={844} dark={true}>
        <div style={{ ...tTokens, position: 'relative', minHeight: '100%', background: 'var(--paper)' }}>
          {screenInner}
        </div>
      </window.IOSDevice>
    );
  } else {
    const w = viewport === 'desktop' ? 1280 : 960;
    const h = viewport === 'desktop' ? 820 : 760;
    stage = (
      <div style={{ ...tTokens, width: w, height: h }}>
        <window.AppChrome width={w} height={h} viewport={viewport}>
          <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative', background: 'var(--paper)' }}>
            <window.RestaurantRail
              currentId={effectiveScreen.kind === 'restaurant' ? effectiveScreen.id
                        : effectiveScreen.kind === 'dish' ? effectiveScreen.lastRestaurant
                        : null}
              onPick={pickRestaurant}
              compact={viewport === 'tablet'}
            />
            <div style={{ flex: 1, overflow: 'auto', minWidth: 0, position: 'relative' }}>
              {screenInner}
            </div>
            {viewport === 'desktop' && (
              <div style={{ width: 320, flexShrink: 0, height: '100%' }}>
                <window.FilterPanel
                  dietary={dietary}
                  allergens={allergens}
                  onChange={({ dietary: d, allergens: a }) => { setDietary(d); setAllergens(a); }}
                  inline={true}
                />
              </div>
            )}
          </div>
        </window.AppChrome>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '24px 20px 40px', gap: 18,
      background: 'oklch(0.94 0.006 70)',
      fontFamily: 'Inter, system-ui',
      ...tTokens,
    }}>
      <style>{`
        body { margin: 0; background: oklch(0.94 0.006 70); }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 0; height: 0; }
        button { font: inherit; }
      `}</style>

      <Masthead tweaks={tweaks} viewport={viewport} updateTweak={updateTweak} />
      {stage}

      {tweaksOpen && (
        <TweaksPanel tweaks={tweaks} updateTweak={updateTweak} onClose={() => setTweaksOpen(false)}
          dietary={dietary} allergens={allergens} setDietary={setDietary} setAllergens={setAllergens} />
      )}
    </div>
  );
}

function Masthead({ tweaks, viewport, updateTweak }) {
  const vpOpts = [
    { k: 'auto', label: 'Auto' },
    { k: 'phone', label: 'Phone' },
    { k: 'tablet', label: 'Tablet' },
    { k: 'desktop', label: 'Desktop' },
  ];
  return (
    <div style={{
      width: '100%', maxWidth: 1280,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      padding: '0 4px 10px', borderBottom: '1px solid oklch(0.82 0.006 70)', flexWrap: 'wrap',
    }}>
      <div style={{
        fontFamily: 'var(--display)', fontSize: 22, fontWeight: 'var(--displayWeight)',
        color: 'oklch(0.22 0.006 70)', letterSpacing: -0.4,
      }}>
        the<span style={{ fontStyle: 'italic', color: 'var(--accent)' }}>Menu</span>
        <span style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
          color: 'oklch(0.55 0.006 70)', marginLeft: 10,
          textTransform: 'uppercase', letterSpacing: 0.1,
        }}>Diner · prototype · {viewport}</span>
      </div>
      <div style={{
        display: 'inline-flex', gap: 2, padding: 3,
        background: 'oklch(0.97 0.006 70)',
        border: '1px solid oklch(0.85 0.006 70)',
        borderRadius: 999,
        fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
        textTransform: 'uppercase', letterSpacing: 0.1,
      }}>
        {vpOpts.map(o => {
          const on = tweaks.viewport === o.k;
          return (
            <button key={o.k} onClick={() => updateTweak('viewport', o.k)} style={{
              all: 'unset', cursor: 'pointer',
              padding: '6px 12px', borderRadius: 999,
              background: on ? 'oklch(0.22 0.006 70)' : 'transparent',
              color: on ? 'oklch(0.97 0.006 70)' : 'oklch(0.4 0.006 70)',
            }}>{o.label}</button>
          );
        })}
      </div>
    </div>
  );
}

function TweaksPanel({ tweaks, updateTweak, onClose, dietary, allergens, setDietary, setAllergens }) {
  const themeOpts = Object.keys(window.THEMES).map(k => ({ k, name: window.THEMES[k].name, sub: window.THEMES[k].subtitle }));
  const cardOpts = [
    { k: 'editorial', name: 'Editorial' },
    { k: 'tile', name: 'Tile' },
    { k: 'stack', name: 'Stack' },
  ];
  return (
    <div style={{
      position: 'fixed', right: 20, bottom: 20, zIndex: 400, width: 320,
      background: 'oklch(0.18 0.006 70)', color: 'oklch(0.95 0.006 70)',
      borderRadius: 18, overflow: 'hidden',
      boxShadow: '0 24px 60px rgba(0,0,0,0.35)', fontFamily: 'Inter, system-ui',
    }}>
      <div style={{ padding: '14px 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid oklch(0.28 0.006 70)' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: 0.1, textTransform: 'uppercase', color: 'oklch(0.75 0.006 70)' }}>Tweaks</div>
        <button onClick={onClose} style={{ all: 'unset', cursor: 'pointer', fontSize: 11, color: 'oklch(0.7 0.006 70)' }}>close</button>
      </div>
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 18, maxHeight: '70vh', overflow: 'auto' }}>
        <div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.1, color: 'oklch(0.75 0.006 70)' }}>Restaurant theme</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {themeOpts.map(o => {
              const on = tweaks.theme === o.k;
              return (
                <button key={o.k} onClick={() => updateTweak('theme', o.k)} style={{
                  all: 'unset', cursor: 'pointer', display: 'block', padding: '8px 10px', borderRadius: 8,
                  background: on ? 'oklch(0.28 0.006 70)' : 'transparent',
                  border: '1px solid ' + (on ? 'oklch(0.6 0.006 70)' : 'oklch(0.28 0.006 70)'),
                }}>
                  <div style={{ fontSize: 13 }}>{o.name}</div>
                  <div style={{ fontSize: 11, color: 'oklch(0.7 0.006 70)', marginTop: 2 }}>{o.sub}</div>
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.1, color: 'oklch(0.75 0.006 70)' }}>Dish-card layout</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {cardOpts.map(o => {
              const on = tweaks.cardLayout === o.k;
              return (
                <button key={o.k} onClick={() => updateTweak('cardLayout', o.k)} style={{
                  all: 'unset', cursor: 'pointer', flex: 1, textAlign: 'center',
                  padding: '8px 6px', borderRadius: 8,
                  background: on ? 'oklch(0.28 0.006 70)' : 'transparent',
                  border: '1px solid ' + (on ? 'oklch(0.6 0.006 70)' : 'oklch(0.28 0.006 70)'),
                  fontSize: 11,
                }}>{o.name}</button>
              );
            })}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.1, color: 'oklch(0.75 0.006 70)' }}>Quick restrictions</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {[
              { k: 'wheat', kind: 'a' }, { k: 'soy', kind: 'a' }, { k: 'fish', kind: 'a' }, { k: 'sesame', kind: 'a' },
              { k: 'vegetarian', kind: 'd' }, { k: 'vegan', kind: 'd' },
            ].map(r => {
              const arr = r.kind === 'a' ? allergens : dietary;
              const set = r.kind === 'a' ? setAllergens : setDietary;
              const on = arr.includes(r.k);
              return (
                <button key={r.k} onClick={() => set(on ? arr.filter(x => x !== r.k) : [...arr, r.k])} style={{
                  all: 'unset', cursor: 'pointer', padding: '4px 10px', borderRadius: 999, fontSize: 11,
                  background: on ? 'oklch(0.55 0.17 30)' : 'transparent',
                  border: '1px solid ' + (on ? 'oklch(0.55 0.17 30)' : 'oklch(0.35 0.006 70)'),
                  color: on ? 'white' : 'oklch(0.85 0.006 70)',
                }}>{r.kind === 'd' ? '◊ ' : '⚠ '}{r.k}</button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { App });
