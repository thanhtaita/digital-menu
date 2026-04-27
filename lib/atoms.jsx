// Shared atoms used across all three themes. Read tokens from CSS vars
// so a single component renders correctly in every theme.

// Nutrition pills — compact row: cal · fat · protein · carbs
function NutritionPills({ n, compact = false }) {
  if (!n) return null;
  const items = [
    { k: 'cal', v: n.cal, u: 'cal' },
    { k: 'fat', v: n.fat, u: 'g fat' },
    { k: 'protein', v: n.protein, u: 'g protein' },
    { k: 'carbs', v: n.carbs, u: 'g carbs' },
  ];
  return (
    <div style={{
      display: 'flex', gap: compact ? 6 : 8, flexWrap: 'wrap',
      fontFamily: 'var(--mono)', fontSize: compact ? 10.5 : 11.5,
      letterSpacing: 0.04, textTransform: 'uppercase',
    }}>
      {items.map((it, i) => (
        <div key={it.k} style={{
          display: 'flex', alignItems: 'baseline', gap: 4,
          padding: compact ? '3px 7px' : '5px 9px',
          border: '1px solid var(--rule)',
          borderRadius: 999,
          color: 'var(--ink)',
          background: 'color-mix(in oklch, var(--paper) 70%, transparent)',
        }}>
          <span style={{ fontWeight: 600 }}>{it.v}</span>
          <span style={{ color: 'var(--inkFaint)', fontSize: compact ? 9.5 : 10 }}>{it.u}</span>
        </div>
      ))}
    </div>
  );
}

// Small metric (used in dish detail big header)
function Metric({ value, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{
        fontFamily: 'var(--display)', fontWeight: 'var(--displayWeight)',
        fontSize: 28, lineHeight: 1, color: 'var(--ink)',
        letterSpacing: -0.5,
      }}>{value}</div>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase',
        letterSpacing: 0.06, color: 'var(--inkFaint)',
      }}>{label}</div>
    </div>
  );
}

// Restriction flag — shown inline next to a dish when user restrictions match
function RestrictionFlag({ conflicts }) {
  if (!conflicts || !conflicts.length) return null;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 8px',
      fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase',
      letterSpacing: 0.08,
      color: 'var(--warn)',
      border: '1px solid color-mix(in oklch, var(--warn) 35%, transparent)',
      background: 'color-mix(in oklch, var(--warn) 8%, var(--paper))',
      borderRadius: 999,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%', background: 'var(--warn)',
        display: 'inline-block',
      }} />
      Contains {conflicts.join(', ')}
    </div>
  );
}

function SectionTitle({ number, title, subtitle }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 12,
      padding: '28px 20px 14px',
      borderBottom: '1px solid var(--rule)',
      marginBottom: 4,
    }}>
      {number !== undefined && (
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: 0.1,
          color: 'var(--inkFaint)', textTransform: 'uppercase',
          minWidth: 24,
        }}>{String(number).padStart(2, '0')}</div>
      )}
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: 'var(--display)', fontWeight: 'var(--displayWeight)',
          fontSize: 26, lineHeight: 1.05, color: 'var(--ink)',
          letterSpacing: -0.3,
        }}>{title}</div>
        {subtitle && (
          <div style={{
            fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--inkMuted)',
            marginTop: 4,
          }}>{subtitle}</div>
        )}
      </div>
    </div>
  );
}

// Monospace label — editorial "plate 01 / ramen" style
function MetaLine({ children, color }) {
  return (
    <div style={{
      fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: 0.12,
      textTransform: 'uppercase', color: color || 'var(--inkFaint)',
    }}>{children}</div>
  );
}

// Compute restriction conflicts for a dish given user restrictions
function dishConflicts(dish, restrictions) {
  if (!restrictions || !restrictions.length) return [];
  const set = new Set();
  for (const ingId of dish.ingredients) {
    const ing = window.INGREDIENTS[ingId];
    if (!ing) continue;
    for (const a of ing.allergens || []) {
      if (restrictions.includes(a)) set.add(a);
    }
  }
  return Array.from(set);
}

// Dietary match — returns true if dish satisfies all active dietary filters
function dishMatchesDietary(dish, dietary) {
  if (!dietary || !dietary.length) return true;
  const d = dish.dietary || [];
  for (const f of dietary) {
    if (f === 'vegan' && !d.includes('vegan')) return false;
    if (f === 'vegetarian' && !(d.includes('vegan') || d.includes('vegetarian'))) return false;
    if (f === 'pescatarian') {
      // no red meat / poultry; fish ok
      if (dish.ingredients.includes('pork_belly')) return false;
    }
    if (f === 'gluten-free') {
      if (dish.ingredients.some(id => {
        const i = window.INGREDIENTS[id];
        return i && (i.allergens || []).includes('wheat');
      })) return false;
    }
  }
  return true;
}

Object.assign(window, {
  NutritionPills, Metric, RestrictionFlag, SectionTitle, MetaLine,
  dishConflicts, dishMatchesDietary,
});
