// Atom components for admin portal — Stripe/Linear-ish primitives.

function Btn({ children, kind = 'secondary', size = 'md', icon, onClick, style, disabled, type = 'button' }) {
  const sizes = {
    sm: { padding: '5px 10px', fontSize: 12, gap: 6 },
    md: { padding: '8px 14px', fontSize: 13, gap: 8 },
    lg: { padding: '10px 18px', fontSize: 14, gap: 8 },
  };
  const kinds = {
    primary: { background: 'var(--ink)', color: '#fff', border: '1px solid var(--ink)' },
    accent:  { background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' },
    secondary: { background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--ruleStrong)' },
    ghost: { background: 'transparent', color: 'var(--ink)', border: '1px solid transparent' },
    danger: { background: 'var(--surface)', color: 'var(--danger)', border: '1px solid var(--ruleStrong)' },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      ...sizes[size], ...kinds[kind],
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 'var(--radius-sm)',
      fontWeight: 500, lineHeight: 1, cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      transition: 'all .12s', boxShadow: kind === 'ghost' ? 'none' : 'var(--shadow-sm)',
      whiteSpace: 'nowrap',
      ...style,
    }}>
      {icon && <window.Icon name={icon} size={size === 'sm' ? 12 : 14} />}
      {children}
    </button>
  );
}

function Card({ children, padding = 16, style }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--rule)',
      borderRadius: 'var(--radius-md)',
      padding,
      ...style,
    }}>{children}</div>
  );
}

function StatusPill({ status }) {
  const map = {
    published: { label: 'Published', bg: 'var(--successSoft)', fg: 'var(--success)', dot: 'var(--success)' },
    edited:    { label: 'Edited',    bg: 'var(--warnSoft)',    fg: 'var(--warn)',    dot: 'var(--warn)' },
    draft:     { label: 'Draft',     bg: 'var(--surfaceAlt)',  fg: 'var(--inkMuted)',dot: 'var(--inkFaint)' },
    new:       { label: 'New',       bg: 'var(--infoSoft)',    fg: 'var(--info)',    dot: 'var(--info)' },
    unavailable: { label: 'Unavailable', bg: 'var(--surfaceAlt)', fg: 'var(--inkMuted)', dot: 'var(--inkSoft)' },
  };
  const s = map[status] || map.draft;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 999,
      background: s.bg, color: s.fg,
      fontSize: 11, fontWeight: 500, fontFamily: 'var(--ui)',
      letterSpacing: 0.01,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.dot }} />
      {s.label}
    </span>
  );
}

function Tag({ children, tone = 'neutral' }) {
  const tones = {
    neutral: { bg: 'var(--surfaceAlt)', fg: 'var(--inkMuted)' },
    accent:  { bg: 'var(--accentSoft)', fg: 'var(--accent)' },
    warn:    { bg: 'var(--warnSoft)', fg: 'var(--warn)' },
    success: { bg: 'var(--successSoft)', fg: 'var(--success)' },
    info:    { bg: 'var(--infoSoft)', fg: 'var(--info)' },
  };
  const t = tones[tone];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 7px', borderRadius: 4,
      background: t.bg, color: t.fg,
      fontSize: 11, fontWeight: 500,
      whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

function Field({ label, hint, children, required, style }) {
  return (
    <label style={{ display: 'block', ...style }}>
      <div style={{
        fontSize: 12, fontWeight: 500, color: 'var(--ink)',
        marginBottom: 6, display: 'flex', justifyContent: 'space-between',
      }}>
        <span>{label}{required && <span style={{ color: 'var(--accent)', marginLeft: 2 }}>*</span>}</span>
        {hint && <span style={{ color: 'var(--inkFaint)', fontWeight: 400 }}>{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function Input({ value, onChange, placeholder, prefix, suffix, mono, style, autoFocus }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      border: '1px solid var(--ruleStrong)',
      borderRadius: 'var(--radius-sm)',
      background: 'var(--surface)',
      padding: '0 10px',
      transition: 'border-color .12s, box-shadow .12s',
      ...style,
    }}>
      {prefix && <span style={{ color: 'var(--inkFaint)', fontSize: 13, paddingRight: 6, fontFamily: mono ? 'var(--mono)' : undefined }}>{prefix}</span>}
      <input
        value={value}
        onChange={e => onChange && onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        style={{
          flex: 1, border: 'none', outline: 'none', background: 'transparent',
          fontSize: 13, padding: '8px 0', color: 'var(--ink)',
          fontFamily: mono ? 'var(--mono)' : 'var(--ui)',
        }}
      />
      {suffix && <span style={{ color: 'var(--inkFaint)', fontSize: 12, paddingLeft: 6 }}>{suffix}</span>}
    </div>
  );
}

function Textarea({ value, onChange, placeholder, rows = 3, style }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange && onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: '100%', boxSizing: 'border-box',
        border: '1px solid var(--ruleStrong)', borderRadius: 'var(--radius-sm)',
        background: 'var(--surface)', padding: '10px 12px',
        fontSize: 13, color: 'var(--ink)',
        fontFamily: 'var(--ui)', resize: 'vertical', outline: 'none',
        lineHeight: 1.5,
        ...style,
      }}
    />
  );
}

function MetaLabel({ children, style }) {
  return (
    <div style={{
      fontFamily: 'var(--mono)', fontSize: 10.5, fontWeight: 500,
      letterSpacing: 0.08, textTransform: 'uppercase',
      color: 'var(--inkFaint)',
      ...style,
    }}>{children}</div>
  );
}

function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div style={{
      padding: '24px 32px 20px', borderBottom: '1px solid var(--rule)',
      background: 'var(--surface)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24,
    }}>
      <div style={{ minWidth: 0 }}>
        {eyebrow && <window.MetaLabel style={{ marginBottom: 6 }}>{eyebrow}</window.MetaLabel>}
        <h1 style={{
          margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: -0.4,
          color: 'var(--ink)', lineHeight: 1.2,
        }}>{title}</h1>
        {subtitle && (
          <div style={{ marginTop: 4, fontSize: 13, color: 'var(--inkMuted)', lineHeight: 1.45 }}>{subtitle}</div>
        )}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}

function Toggle({ checked, onChange, size = 'md' }) {
  const dims = size === 'sm' ? { w: 28, h: 16, k: 12 } : { w: 34, h: 20, k: 16 };
  return (
    <button
      onClick={() => onChange && onChange(!checked)}
      style={{
        width: dims.w, height: dims.h, borderRadius: 999,
        background: checked ? 'var(--ink)' : 'var(--ruleStrong)',
        border: 'none', cursor: 'pointer', padding: 0,
        position: 'relative', transition: 'background .15s',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: checked ? dims.w - dims.k - 2 : 2,
        width: dims.k, height: dims.k, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        transition: 'left .15s',
      }}/>
    </button>
  );
}

function Kbd({ children }) {
  return (
    <span style={{
      fontFamily: 'var(--mono)', fontSize: 10.5, fontWeight: 500,
      padding: '2px 5px', minWidth: 16, textAlign: 'center',
      border: '1px solid var(--ruleStrong)', borderBottom: '1.5px solid var(--ruleStrong)',
      borderRadius: 4, background: 'var(--surface)', color: 'var(--inkMuted)',
      display: 'inline-block', lineHeight: 1.2,
    }}>{children}</span>
  );
}

// Allergen chip — tiny tag matching diner-app's allergen taxonomy
function AllergenChip({ allergen }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '1px 6px', borderRadius: 3,
      background: 'var(--warnSoft)', color: 'var(--warn)',
      fontSize: 10, fontWeight: 500, textTransform: 'capitalize',
      letterSpacing: 0.02,
    }}>{allergen}</span>
  );
}

// Compute allergens for a dish from ingredient list
function dishAllergens(dish, ingredients) {
  const set = new Set();
  for (const id of dish.ingredients) {
    const ing = ingredients[id];
    if (!ing) continue;
    for (const a of ing.allergens || []) set.add(a);
  }
  return Array.from(set);
}

Object.assign(window, {
  Btn, Card, StatusPill, Tag, Field, Input, Textarea, MetaLabel,
  PageHeader, Toggle, Kbd, AllergenChip, dishAllergens,
});
