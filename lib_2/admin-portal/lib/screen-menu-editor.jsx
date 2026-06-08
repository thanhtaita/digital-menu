// Menu editor — drag-reorder sections + dishes, with optional preview pane.

function DishRow({ dish, onClick, density }) {
  const allergens = window.dishAllergens(dish, window.ADMIN_INGREDIENTS);
  const compact = density === 'compact';
  return (
    <button onClick={onClick} style={{
      all: 'unset', cursor: 'pointer',
      display: 'grid',
      gridTemplateColumns: '24px 56px 1fr 110px 110px 90px 24px',
      gap: 14, alignItems: 'center',
      padding: compact ? '8px 16px' : '12px 16px',
      borderBottom: '1px solid var(--rule)', background: 'var(--surface)',
      transition: 'background .1s',
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'var(--surfaceAlt)'}
    onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}>
      <div style={{ color: 'var(--inkSoft)', cursor: 'grab', display: 'flex', justifyContent: 'center' }}>
        <window.Icon name="grip" size={14} />
      </div>
      <div style={{
        width: 44, height: 44, borderRadius: 6,
        background: `linear-gradient(135deg, ${dish.id === 'tonkotsu' ? 'oklch(0.55 0.11 35), oklch(0.32 0.07 25)' : dish.id.includes('miso') ? 'oklch(0.6 0.1 50), oklch(0.4 0.09 35)' : dish.id.includes('salmon') ? 'oklch(0.7 0.15 35), oklch(0.5 0.16 25)' : dish.id.includes('tuna') || dish.id.includes('maguro') ? 'oklch(0.5 0.16 25), oklch(0.3 0.13 20)' : dish.id.includes('avocado') ? 'oklch(0.7 0.13 125), oklch(0.5 0.12 130)' : dish.id.includes('hosomaki') || dish.id.includes('kappa') ? 'oklch(0.85 0.12 140), oklch(0.6 0.14 150)' : 'oklch(0.6 0.08 60), oklch(0.4 0.06 50)'})`,
        flexShrink: 0,
      }}/>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', letterSpacing: -0.1 }}>{dish.name}</div>
          <div style={{ fontSize: 11, color: 'var(--inkFaint)', fontStyle: 'italic' }}>{dish.jp}</div>
          {dish.chefPick && <window.Tag tone="accent">Chef's pick</window.Tag>}
        </div>
        {!compact && (
          <div style={{
            fontSize: 12, color: 'var(--inkMuted)', marginTop: 2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{dish.tagline}</div>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {allergens.length === 0 ? (
          <span style={{ fontSize: 11, color: 'var(--inkFaint)' }}>—</span>
        ) : allergens.slice(0, 3).map(a => <window.AllergenChip key={a} allergen={a} />)}
      </div>
      <div><window.StatusPill status={dish.available ? dish.status : 'unavailable'} /></div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 12.5, color: 'var(--ink)', fontWeight: 500, textAlign: 'right' }}>${dish.price.toFixed(2)}</div>
      <div style={{ color: 'var(--inkSoft)' }}><window.Icon name="chevron-right" size={14}/></div>
    </button>
  );
}

function SectionBlock({ section, dishes, onAddDish, onOpenDish, density, collapsed, onToggle }) {
  const items = dishes.filter(d => d.section === section.id);
  return (
    <window.Card padding={0} style={{ marginBottom: 16, overflow: 'hidden' }}>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', background: 'var(--surfaceAlt)',
        borderBottom: collapsed ? 'none' : '1px solid var(--rule)',
      }}>
        <button onClick={() => onToggle(section.id)} style={{
          all: 'unset', cursor: 'pointer', color: 'var(--inkMuted)',
          display: 'flex', alignItems: 'center',
        }}>
          <window.Icon name={collapsed ? 'chevron-right' : 'chevron-down'} size={14} />
        </button>
        <div style={{ color: 'var(--inkSoft)', cursor: 'grab' }}>
          <window.Icon name="grip" size={14} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: -0.1 }}>{section.title}</div>
            <window.MetaLabel>{items.length} dishes</window.MetaLabel>
          </div>
          <div style={{ fontSize: 12, color: 'var(--inkFaint)' }}>{section.description}</div>
        </div>
        <window.Btn kind="ghost" size="sm" icon="plus" onClick={() => onAddDish(section.id)}>Add dish</window.Btn>
        <window.Btn kind="ghost" size="sm" icon="edit" />
      </div>

      {/* Column headers */}
      {!collapsed && (
        <>
          <div style={{
            display: 'grid', gridTemplateColumns: '24px 56px 1fr 110px 110px 90px 24px',
            gap: 14, padding: '8px 16px',
            borderBottom: '1px solid var(--rule)', background: 'var(--surface)',
          }}>
            <div/>
            <window.MetaLabel>Photo</window.MetaLabel>
            <window.MetaLabel>Name & description</window.MetaLabel>
            <window.MetaLabel>Allergens</window.MetaLabel>
            <window.MetaLabel>Status</window.MetaLabel>
            <window.MetaLabel style={{ textAlign: 'right' }}>Price</window.MetaLabel>
            <div/>
          </div>
          {items.map(d => (
            <DishRow key={d.id} dish={d} onClick={() => onOpenDish(d.id)} density={density} />
          ))}
        </>
      )}
    </window.Card>
  );
}

function MenuEditorScreen({ onOpenDish, onNavigate, showPreview, onTogglePreview, density, isEmpty }) {
  const [collapsed, setCollapsed] = React.useState({});
  const toggle = (id) => setCollapsed(c => ({ ...c, [id]: !c[id] }));

  if (isEmpty) {
    return (
      <div>
        <window.PageHeader
          eyebrow="Menu"
          title="Your menu is empty"
          subtitle="Add a section to start grouping dishes — Ramen, Sushi, Small plates."
          actions={<window.Btn kind="primary" icon="plus">Add section</window.Btn>}
        />
        <div style={{ padding: 32 }}>
          <window.Card padding={40} style={{ textAlign: 'center', maxWidth: 560, margin: '40px auto' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 12, margin: '0 auto 16px',
              background: 'var(--surfaceSunken)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <window.Icon name="menu" size={26} color="var(--inkFaint)" />
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>No sections yet</div>
            <div style={{ fontSize: 13, color: 'var(--inkMuted)', marginBottom: 20, lineHeight: 1.5 }}>
              Sections group your dishes. You can drag to reorder them, and diners see them in this order on the menu.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <window.Btn kind="primary" icon="plus">Add first section</window.Btn>
              <window.Btn kind="secondary" icon="sparkles">Import from photo</window.Btn>
            </div>
          </window.Card>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <window.PageHeader
        eyebrow="Menu / Dinner"
        title="Tsubaki Dinner Menu"
        subtitle="Drag sections and dishes to reorder. Click any dish to edit."
        actions={<>
          <window.Btn kind="ghost" icon={showPreview ? 'eye-off' : 'eye'} onClick={onTogglePreview}>
            {showPreview ? 'Hide preview' : 'Show preview'}
          </window.Btn>
          <window.Btn kind="secondary" icon="sparkles">Bulk import</window.Btn>
          <window.Btn kind="primary" icon="plus">Add dish</window.Btn>
        </>}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Editor pane */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          <div style={{ maxWidth: 1100 }}>
            {/* Toolbar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--rule)',
            }}>
              <div style={{ flex: 1, maxWidth: 320 }}>
                <window.Input prefix={<window.Icon name="search" size={13} />} placeholder="Search dishes…" />
              </div>
              <window.Btn kind="ghost" size="sm" icon="filter">All sections</window.Btn>
              <window.Btn kind="ghost" size="sm">All status</window.Btn>
              <div style={{ flex: 1 }}/>
              <window.MetaLabel>10 dishes · 3 sections</window.MetaLabel>
            </div>

            {window.ADMIN_SECTIONS.map(sec => (
              <SectionBlock
                key={sec.id}
                section={sec}
                dishes={window.ADMIN_DISHES}
                onAddDish={() => onOpenDish('new')}
                onOpenDish={onOpenDish}
                density={density}
                collapsed={!!collapsed[sec.id]}
                onToggle={toggle}
              />
            ))}

            <button style={{
              all: 'unset', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', boxSizing: 'border-box',
              padding: '14px', borderRadius: 'var(--radius-md)',
              border: '1.5px dashed var(--ruleStrong)',
              color: 'var(--inkMuted)', fontSize: 13, fontWeight: 500,
            }}>
              <window.Icon name="plus" size={14} />
              Add new section
            </button>
          </div>
        </div>

        {/* Preview pane */}
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
              <window.MetaLabel>Diner Preview · iPhone</window.MetaLabel>
              <window.Btn kind="ghost" size="sm" icon="x" onClick={onTogglePreview}/>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', justifyContent: 'center', paddingTop: 16 }}>
              <window.PreviewPhone
                dishes={window.ADMIN_DISHES}
                sections={window.ADMIN_SECTIONS}
                scale={0.6}
                mode="menu"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { MenuEditorScreen });
