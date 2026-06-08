// Ingredient library — restaurant's ingredient list, with usage stats.

function IngredientsScreen({ onNavigate }) {
  const [q, setQ] = React.useState('');
  const [cat, setCat] = React.useState('all');
  const all = Object.values(window.ADMIN_INGREDIENTS);
  const cats = ['all', ...Array.from(new Set(all.map(i => i.category)))];
  const filtered = all.filter(i =>
    (cat === 'all' || i.category === cat) &&
    (q === '' || i.name.toLowerCase().includes(q.toLowerCase()) || i.jp.includes(q))
  );

  return (
    <div>
      <window.PageHeader
        eyebrow="Ingredients"
        title="Ingredient library"
        subtitle="Your restaurant's ingredient knowledge — these power diner explanations and allergen filtering."
        actions={<>
          <window.Btn kind="secondary" icon="upload">Import CSV</window.Btn>
          <window.Btn kind="primary" icon="plus">Add ingredient</window.Btn>
        </>}
      />
      <div style={{ padding: 32, maxWidth: 1200 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <div style={{ flex: 1, maxWidth: 360 }}>
            <window.Input prefix={<window.Icon name="search" size={13}/>} placeholder="Search ingredients…" value={q} onChange={setQ} />
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {cats.map(c => (
              <button key={c} onClick={() => setCat(c)} style={{
                all: 'unset', cursor: 'pointer',
                padding: '6px 12px', borderRadius: 999,
                background: cat === c ? 'var(--ink)' : 'var(--surface)',
                color: cat === c ? '#fff' : 'var(--inkMuted)',
                border: '1px solid ' + (cat === c ? 'var(--ink)' : 'var(--rule)'),
                fontSize: 12, fontWeight: 500, textTransform: 'capitalize',
              }}>{c}</button>
            ))}
          </div>
        </div>

        <window.Card padding={0}>
          <div style={{
            display: 'grid', gridTemplateColumns: '40px 1.6fr 1fr 1fr 90px 24px',
            gap: 14, padding: '10px 18px',
            borderBottom: '1px solid var(--rule)', background: 'var(--surfaceAlt)',
          }}>
            <div/>
            <window.MetaLabel>Name</window.MetaLabel>
            <window.MetaLabel>Category</window.MetaLabel>
            <window.MetaLabel>Allergens</window.MetaLabel>
            <window.MetaLabel style={{ textAlign: 'right' }}>Used in</window.MetaLabel>
            <div/>
          </div>
          {filtered.map(ing => (
            <div key={ing.id} style={{
              display: 'grid', gridTemplateColumns: '40px 1.6fr 1fr 1fr 90px 24px',
              gap: 14, padding: '12px 18px', alignItems: 'center',
              borderBottom: '1px solid var(--rule)',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6,
                background: ing.color, border: '1px solid rgba(0,0,0,0.08)',
              }}/>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)' }}>{ing.name}</div>
                <div style={{ fontSize: 11, color: 'var(--inkFaint)', fontStyle: 'italic' }}>{ing.jp}</div>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--inkMuted)' }}>{ing.category}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {(ing.allergens || []).length === 0 ? <span style={{ fontSize: 11, color: 'var(--inkFaint)' }}>—</span> : ing.allergens.map(a => <window.AllergenChip key={a} allergen={a}/>)}
              </div>
              <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: ing.usedIn === 0 ? 'var(--inkFaint)' : 'var(--ink)' }}>
                {ing.usedIn === 0 ? 'unused' : `${ing.usedIn} dish${ing.usedIn === 1 ? '' : 'es'}`}
              </div>
              <window.Icon name="chevron-right" size={14} color="var(--inkSoft)" />
            </div>
          ))}
        </window.Card>
      </div>
    </div>
  );
}

Object.assign(window, { IngredientsScreen });
