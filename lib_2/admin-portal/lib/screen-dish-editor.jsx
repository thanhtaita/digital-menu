// Dish editor — name, description, price, image, and the killer
// ingredient picker. Three picker variants exposed as tweaks:
// 'autocomplete' | 'suggested-grid' | 'category-tree'

function IngredientPill({ ing, onRemove }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 4px 5px 10px', borderRadius: 999,
      background: 'var(--surface)', border: '1px solid var(--ruleStrong)',
      fontSize: 12.5, color: 'var(--ink)',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: ing.color, flexShrink: 0 }}/>
      <span style={{ fontWeight: 500 }}>{ing.name}</span>
      {(ing.allergens || []).map(a => <window.AllergenChip key={a} allergen={a} />)}
      {onRemove && (
        <button onClick={onRemove} style={{
          all: 'unset', cursor: 'pointer', color: 'var(--inkFaint)',
          width: 18, height: 18, borderRadius: '50%',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <window.Icon name="x" size={11}/>
        </button>
      )}
    </span>
  );
}

function PickerAutocomplete({ selected, onAdd, onRemove }) {
  const [q, setQ] = React.useState('');
  const [focused, setFocused] = React.useState(false);
  const all = Object.values(window.ADMIN_INGREDIENTS);
  const matches = q
    ? all.filter(i =>
        i.id !== '' &&
        !selected.includes(i.id) &&
        (i.name.toLowerCase().includes(q.toLowerCase()) || i.jp.includes(q) || i.category.toLowerCase().includes(q.toLowerCase()))
      ).slice(0, 6)
    : window.SUGGESTED_INGREDIENTS.filter(id => !selected.includes(id)).map(id => window.ADMIN_INGREDIENTS[id]).slice(0, 4);

  return (
    <div style={{ position: 'relative' }}>
      {/* Selected pills */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10,
        minHeight: 32,
      }}>
        {selected.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--inkFaint)', alignSelf: 'center' }}>No ingredients yet — start typing below.</div>
        )}
        {selected.map(id => {
          const ing = window.ADMIN_INGREDIENTS[id];
          if (!ing) return null;
          return <IngredientPill key={id} ing={ing} onRemove={() => onRemove(id)} />;
        })}
      </div>

      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        border: '1px solid var(--ruleStrong)',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--surface)', padding: '0 12px',
        boxShadow: focused ? '0 0 0 3px color-mix(in srgb, var(--info) 18%, transparent)' : 'none',
        borderColor: focused ? 'var(--info)' : 'var(--ruleStrong)',
      }}>
        <window.Icon name="search" size={14} color="var(--inkFaint)" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search ingredients — type a name, kanji, or category…"
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 13, padding: '10px 0', color: 'var(--ink)',
          }}
        />
        <window.Kbd>↵</window.Kbd>
      </div>

      {/* Suggestions / matches dropdown — always visible when matches exist */}
      <div style={{
        marginTop: 8, border: '1px solid var(--rule)',
        borderRadius: 'var(--radius-sm)', overflow: 'hidden',
        background: 'var(--surface)',
      }}>
        <div style={{
          padding: '8px 12px', background: 'var(--surfaceAlt)',
          display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--rule)',
        }}>
          <window.Icon name="sparkles" size={12} color="var(--accent)" />
          <window.MetaLabel>{q ? `${matches.length} matches` : 'Suggested for this dish'}</window.MetaLabel>
        </div>
        {matches.length === 0 ? (
          <div style={{ padding: 16, fontSize: 12, color: 'var(--inkFaint)', textAlign: 'center' }}>
            No matches. <span style={{ color: 'var(--info)', cursor: 'pointer', textDecoration: 'underline' }}>Create "{q}" as new</span>
          </div>
        ) : matches.map(ing => (
          <button
            key={ing.id}
            onMouseDown={e => { e.preventDefault(); onAdd(ing.id); setQ(''); }}
            style={{
              all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', width: '100%', boxSizing: 'border-box',
              borderBottom: '1px solid var(--rule)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surfaceAlt)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{
              width: 22, height: 22, borderRadius: 4, background: ing.color, flexShrink: 0,
              border: '1px solid rgba(0,0,0,0.08)',
            }}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{ing.name}</span>
                <span style={{ fontSize: 11, color: 'var(--inkFaint)', fontStyle: 'italic' }}>{ing.jp}</span>
                {ing.isNew && <window.Tag tone="info">New</window.Tag>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--inkFaint)', marginTop: 1 }}>
                {ing.category}{ing.usedIn > 0 && ` · used in ${ing.usedIn} dish${ing.usedIn === 1 ? '' : 'es'}`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(ing.allergens || []).map(a => <window.AllergenChip key={a} allergen={a} />)}
            </div>
            <window.Icon name="plus" size={13} color="var(--inkFaint)"/>
          </button>
        ))}
      </div>
    </div>
  );
}

function PickerSuggestedGrid({ selected, onAdd, onRemove }) {
  const all = Object.values(window.ADMIN_INGREDIENTS);
  const suggested = window.SUGGESTED_INGREDIENTS.filter(id => !selected.includes(id));
  const others = all.filter(i => !selected.includes(i.id) && !suggested.includes(i.id) && i.usedIn > 0).slice(0, 12);

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {selected.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--inkFaint)' }}>Tap an ingredient below to add it.</div>
        )}
        {selected.map(id => {
          const ing = window.ADMIN_INGREDIENTS[id];
          if (!ing) return null;
          return <IngredientPill key={id} ing={ing} onRemove={() => onRemove(id)} />;
        })}
      </div>

      <div style={{
        padding: 14, borderRadius: 'var(--radius-sm)',
        background: 'linear-gradient(135deg, var(--accentSoft), var(--surface))',
        border: '1px solid color-mix(in srgb, var(--accent) 25%, var(--rule))',
        marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <window.Icon name="sparkles" size={13} color="var(--accent)" />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', letterSpacing: 0.02 }}>AI suggestions for "Sapporo Miso Ramen"</span>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--inkMuted)', marginBottom: 10 }}>
          Based on your dish name and similar recipes in your menu.
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {suggested.map(id => {
            const ing = window.ADMIN_INGREDIENTS[id];
            if (!ing) return null;
            return (
              <button key={id} onClick={() => onAdd(id)} style={{
                all: 'unset', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 999,
                background: 'var(--surface)', border: '1px dashed var(--accent)',
                color: 'var(--ink)', fontSize: 12.5, fontWeight: 500,
              }}>
                <window.Icon name="plus" size={11} color="var(--accent)" />
                {ing.name}
              </button>
            );
          })}
        </div>
      </div>

      <window.MetaLabel style={{ marginBottom: 8 }}>From your library</window.MetaLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {others.map(ing => (
          <button key={ing.id} onClick={() => onAdd(ing.id)} style={{
            all: 'unset', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', borderRadius: 999,
            background: 'var(--surfaceAlt)', border: '1px solid var(--rule)',
            color: 'var(--inkMuted)', fontSize: 12,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: ing.color }}/>
            {ing.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function PickerCategoryTree({ selected, onAdd, onRemove }) {
  const grouped = {};
  for (const ing of Object.values(window.ADMIN_INGREDIENTS)) {
    (grouped[ing.category] = grouped[ing.category] || []).push(ing);
  }
  const cats = Object.keys(grouped).sort();
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14, minHeight: 32 }}>
        {selected.map(id => {
          const ing = window.ADMIN_INGREDIENTS[id];
          if (!ing) return null;
          return <IngredientPill key={id} ing={ing} onRemove={() => onRemove(id)} />;
        })}
      </div>
      <div style={{
        border: '1px solid var(--rule)', borderRadius: 'var(--radius-sm)',
        maxHeight: 360, overflow: 'auto', background: 'var(--surface)',
      }}>
        {cats.map(cat => (
          <div key={cat}>
            <div style={{
              padding: '8px 12px', background: 'var(--surfaceAlt)',
              borderBottom: '1px solid var(--rule)',
              fontSize: 11, fontWeight: 600, color: 'var(--inkMuted)',
              letterSpacing: 0.04, textTransform: 'uppercase',
              position: 'sticky', top: 0,
            }}>{cat}</div>
            <div style={{ padding: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {grouped[cat].map(ing => {
                const active = selected.includes(ing.id);
                return (
                  <button key={ing.id}
                    onClick={() => active ? onRemove(ing.id) : onAdd(ing.id)}
                    style={{
                      all: 'unset', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '5px 10px', borderRadius: 6,
                      background: active ? 'var(--ink)' : 'var(--surface)',
                      color: active ? '#fff' : 'var(--ink)',
                      border: '1px solid ' + (active ? 'var(--ink)' : 'var(--rule)'),
                      fontSize: 12,
                    }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: ing.color }}/>
                    {ing.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DishEditorScreen({ dishId, onBack, showPreview, onTogglePreview, pickerStyle = 'autocomplete' }) {
  const initial = window.ADMIN_DISHES.find(d => d.id === dishId) || {
    id: 'new', name: '', jp: '', tagline: '', description: '', price: 0,
    ingredients: [], section: 'ramen', status: 'draft', available: true,
    nutrition: { cal: 0, fat: 0, protein: 0, carbs: 0 },
  };
  const [dish, setDish] = React.useState(initial);
  React.useEffect(() => { setDish(initial); }, [dishId]);
  const update = (patch) => setDish(d => ({ ...d, ...patch }));
  const addIng = (id) => setDish(d => ({ ...d, ingredients: [...d.ingredients, id] }));
  const rmIng = (id) => setDish(d => ({ ...d, ingredients: d.ingredients.filter(x => x !== id) }));

  const allergens = window.dishAllergens(dish, window.ADMIN_INGREDIENTS);

  let Picker = PickerAutocomplete;
  if (pickerStyle === 'suggested-grid') Picker = PickerSuggestedGrid;
  if (pickerStyle === 'category-tree') Picker = PickerCategoryTree;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <window.PageHeader
        eyebrow={<button onClick={onBack} style={{ all: 'unset', cursor: 'pointer', color: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}>← Menu / Ramen</button>}
        title={dish.name || 'New dish'}
        subtitle={dish.id !== 'new' ? `Last edited ${dish.edited || 'just now'} by ${dish.editedBy || 'you'}` : 'Untitled draft'}
        actions={<>
          <window.Btn kind="ghost" icon={showPreview ? 'eye-off' : 'eye'} onClick={onTogglePreview}>
            {showPreview ? 'Hide preview' : 'Preview'}
          </window.Btn>
          <window.Btn kind="ghost">Discard</window.Btn>
          <window.Btn kind="secondary">Save draft</window.Btn>
          <window.Btn kind="primary" icon="check">Save & continue</window.Btn>
        </>}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Form */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
          <div style={{ maxWidth: 720, display: 'grid', gap: 24 }}>

            {/* Basics */}
            <section>
              <window.MetaLabel style={{ marginBottom: 12 }}>01 · Basics</window.MetaLabel>
              <div style={{ display: 'grid', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                  <window.Field label="Dish name" required>
                    <window.Input value={dish.name} onChange={v => update({ name: v })} placeholder="e.g. Tonkotsu Ramen" />
                  </window.Field>
                  <window.Field label="Original (kanji / native)" hint="optional">
                    <window.Input value={dish.jp} onChange={v => update({ jp: v })} placeholder="豚骨ラーメン" />
                  </window.Field>
                </div>
                <window.Field label="Section" required>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {window.ADMIN_SECTIONS.map(s => (
                      <button key={s.id} onClick={() => update({ section: s.id })} style={{
                        all: 'unset', cursor: 'pointer',
                        padding: '7px 12px', borderRadius: 'var(--radius-sm)',
                        border: '1px solid ' + (dish.section === s.id ? 'var(--ink)' : 'var(--ruleStrong)'),
                        background: dish.section === s.id ? 'var(--ink)' : 'var(--surface)',
                        color: dish.section === s.id ? '#fff' : 'var(--ink)',
                        fontSize: 12.5, fontWeight: 500,
                      }}>{s.title}</button>
                    ))}
                    <button style={{
                      all: 'unset', cursor: 'pointer',
                      padding: '7px 12px', borderRadius: 'var(--radius-sm)',
                      border: '1px dashed var(--ruleStrong)', color: 'var(--inkMuted)',
                      fontSize: 12.5,
                    }}>+ New section</button>
                  </div>
                </window.Field>
                <window.Field label="One-line description" hint={`${(dish.tagline || '').length}/80`}>
                  <window.Input value={dish.tagline} onChange={v => update({ tagline: v })} placeholder="What's special about this dish? (shown on the menu list)" />
                </window.Field>
                <window.Field label="Full description" hint="Paragraph shown on dish detail">
                  <window.Textarea value={dish.description} onChange={v => update({ description: v })} rows={4} placeholder="Describe origin, technique, what makes it yours…" />
                </window.Field>
              </div>
            </section>

            {/* Photo + price */}
            <section>
              <window.MetaLabel style={{ marginBottom: 12 }}>02 · Photo & Price</window.MetaLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16 }}>
                <div>
                  <div style={{
                    aspectRatio: '1/1', borderRadius: 'var(--radius-md)',
                    background: dish.id === 'tonkotsu' ? 'linear-gradient(135deg, oklch(0.55 0.11 35), oklch(0.32 0.07 25))' : 'var(--surfaceSunken)',
                    border: '1px dashed var(--ruleStrong)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--inkFaint)', position: 'relative', overflow: 'hidden',
                  }}>
                    {dish.id === 'tonkotsu' ? (
                      <div style={{
                        fontFamily: 'var(--display)', fontSize: 96,
                        color: 'rgba(255,255,255,0.85)',
                      }}>T</div>
                    ) : (
                      <window.Icon name="image" size={28} color="var(--inkSoft)" />
                    )}
                    <button style={{
                      position: 'absolute', bottom: 8, right: 8,
                      padding: '4px 8px', borderRadius: 4,
                      background: 'rgba(0,0,0,0.6)', color: '#fff',
                      border: 'none', fontSize: 11, cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}>
                      <window.Icon name="edit" size={11} color="#fff"/>
                      Crop
                    </button>
                  </div>
                  <window.Btn kind="ghost" size="sm" icon="upload" style={{ marginTop: 8, width: '100%' }}>Replace photo</window.Btn>
                </div>
                <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <window.Field label="Price" required>
                      <window.Input prefix="$" mono value={dish.price?.toFixed?.(2) || dish.price} onChange={v => update({ price: parseFloat(v) || 0 })} />
                    </window.Field>
                    <window.Field label="Spice level" hint="0–3">
                      <div style={{ display: 'flex', gap: 4 }}>
                        {[0,1,2,3].map(n => (
                          <button key={n} onClick={() => update({ spice: n })} style={{
                            all: 'unset', cursor: 'pointer', flex: 1, textAlign: 'center',
                            padding: '8px 0', borderRadius: 'var(--radius-sm)',
                            border: '1px solid ' + ((dish.spice || 0) === n ? 'var(--ink)' : 'var(--ruleStrong)'),
                            background: (dish.spice || 0) === n ? 'var(--ink)' : 'var(--surface)',
                            color: (dish.spice || 0) === n ? '#fff' : 'var(--ink)',
                            fontSize: 12, fontWeight: 500,
                          }}>{n === 0 ? 'None' : '🌶'.repeat(n)}</button>
                        ))}
                      </div>
                    </window.Field>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: 12, background: 'var(--surfaceAlt)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>Available now</div>
                      <div style={{ fontSize: 11.5, color: 'var(--inkFaint)' }}>Diners can see and order this dish</div>
                    </div>
                    <window.Toggle checked={dish.available !== false} onChange={v => update({ available: v })} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: 12, background: 'var(--surfaceAlt)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>Chef's pick</div>
                      <div style={{ fontSize: 11.5, color: 'var(--inkFaint)' }}>Highlight this dish on the menu</div>
                    </div>
                    <window.Toggle checked={!!dish.chefPick} onChange={v => update({ chefPick: v })} />
                  </div>
                </div>
              </div>
            </section>

            {/* Ingredients */}
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <window.MetaLabel>03 · Ingredients · {dish.ingredients.length}</window.MetaLabel>
                <div style={{ fontSize: 11, color: 'var(--inkFaint)' }}>
                  Tagging powers diner allergen filtering & ingredient explanations
                </div>
              </div>
              {allergens.length > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', marginBottom: 12,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--warnSoft)',
                  border: '1px solid color-mix(in srgb, var(--warn) 30%, transparent)',
                }}>
                  <window.Icon name="warn" size={14} color="var(--warn)" />
                  <div style={{ flex: 1, fontSize: 12.5, color: 'var(--warn)' }}>
                    <strong>Auto-detected allergens:</strong>{' '}
                    {allergens.join(', ')} — diners with these restrictions will see a warning.
                  </div>
                </div>
              )}
              <Picker selected={dish.ingredients} onAdd={addIng} onRemove={rmIng} />
            </section>

            {/* Nutrition */}
            <section>
              <window.MetaLabel style={{ marginBottom: 12 }}>04 · Nutrition (optional)</window.MetaLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {['cal', 'fat', 'protein', 'carbs'].map(k => (
                  <window.Field key={k} label={k === 'cal' ? 'Calories' : `${k[0].toUpperCase()}${k.slice(1)} (g)`}>
                    <window.Input mono value={dish.nutrition?.[k] || ''} onChange={v => update({ nutrition: { ...dish.nutrition, [k]: parseFloat(v) || 0 }})} />
                  </window.Field>
                ))}
              </div>
            </section>

            <div style={{ height: 40 }}/>
          </div>
        </div>

        {/* Preview */}
        {showPreview && (
          <div style={{
            width: 280, flexShrink: 0,
            borderLeft: '1px solid var(--rule)',
            background: 'linear-gradient(180deg, var(--surfaceAlt), var(--bg))',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '12px 16px', borderBottom: '1px solid var(--rule)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--surface)',
            }}>
              <window.MetaLabel>Live Preview</window.MetaLabel>
              <window.Btn kind="ghost" size="sm" icon="x" onClick={onTogglePreview}/>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', justifyContent: 'center', paddingTop: 16 }}>
              <window.PreviewPhone dish={dish} mode="dish" scale={0.6} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { DishEditorScreen });
