// Reusable admin UI primitives.

const Btn = ({ kind = 'secondary', size = 'md', icon, children, onClick, disabled, style }) => {
  const sizes = {
    sm: { padding: '4px 9px', fontSize: 12, h: 26, gap: 5 },
    md: { padding: '6px 12px', fontSize: 13, h: 32, gap: 6 },
    lg: { padding: '8px 16px', fontSize: 13.5, h: 38, gap: 7 },
  }[size];
  const kinds = {
    primary: { bg: 'var(--accent)', color: 'var(--accent-ink)', border: 'var(--accent)' },
    secondary: { bg: 'var(--panel)', color: 'var(--ink)', border: 'var(--rule-2)' },
    ghost: { bg: 'transparent', color: 'var(--ink-2)', border: 'transparent' },
    danger: { bg: 'var(--panel)', color: 'var(--danger)', border: 'var(--rule-2)' },
  }[kind];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      all: 'unset', cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'inline-flex', alignItems: 'center', gap: sizes.gap,
      padding: sizes.padding, height: sizes.h,
      fontSize: sizes.fontSize, fontWeight: 500, lineHeight: 1,
      background: kinds.bg, color: kinds.color,
      border: `1px solid ${kinds.border}`, borderRadius: 'var(--r)',
      boxShadow: kind === 'primary' ? '0 1px 0 rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.1)' : (kind === 'secondary' ? '0 1px 0 rgba(15,20,40,0.04)' : 'none'),
      opacity: disabled ? 0.5 : 1,
      whiteSpace: 'nowrap',
      ...style,
    }}>
      {icon}
      {children}
    </button>
  );
};

const Icon = ({ name, size = 14, color = 'currentColor' }) => {
  const paths = {
    plus: <path d="M8 3v10M3 8h10" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>,
    check: <path d="M3 8l3 3 7-7" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>,
    chevr: <path d="M5 3l5 5-5 5" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>,
    chevd: <path d="M3 5l5 5 5-5" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>,
    chevu: <path d="M3 11l5-5 5 5" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>,
    chevl: <path d="M11 3L6 8l5 5" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>,
    search: <g fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></g>,
    drag: <g fill={color}><circle cx="6" cy="4" r="1"/><circle cx="6" cy="8" r="1"/><circle cx="6" cy="12" r="1"/><circle cx="10" cy="4" r="1"/><circle cx="10" cy="8" r="1"/><circle cx="10" cy="12" r="1"/></g>,
    home: <path d="M2 7l6-4 6 4v6a1 1 0 01-1 1h-3v-4H6v4H3a1 1 0 01-1-1V7z" fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round"/>,
    menu: <g fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round"><path d="M3 4h10M3 8h10M3 12h7"/></g>,
    book: <path d="M3 3h7a3 3 0 013 3v7H6a3 3 0 01-3-3V3zM3 3v7a3 3 0 003 3" fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round"/>,
    chart: <g fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round"><path d="M3 13V3M3 13h10"/><path d="M5 11l3-3 2 2 3-4"/></g>,
    cog: <g fill="none" stroke={color} strokeWidth="1.4"><circle cx="8" cy="8" r="2"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3"/></g>,
    upload: <g fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M8 10V2M5 5l3-3 3 3"/><path d="M2 10v3a1 1 0 001 1h10a1 1 0 001-1v-3"/></g>,
    sparkle: <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5L8 1z" fill={color}/>,
    eye: <g fill="none" stroke={color} strokeWidth="1.4"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></g>,
    eyeoff: <g fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round"><path d="M2 2l12 12"/><path d="M6.5 6.5C5 7.3 4 8 4 8s2 4 6 4c.9 0 1.7-.2 2.5-.5"/><path d="M9.5 9.5A2 2 0 016.5 6.5"/></g>,
    x: <path d="M3 3l10 10M13 3L3 13" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>,
    image: <g fill="none" stroke={color} strokeWidth="1.4"><rect x="2" y="3" width="12" height="10" rx="1"/><circle cx="6" cy="7" r="1.2"/><path d="M14 11l-3-3-5 5"/></g>,
    bell: <path d="M4 11V7a4 4 0 118 0v4l1 2H3l1-2zM7 13h2" fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round"/>,
    warn: <g fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M8 1.5L14.5 13H1.5L8 1.5z"/><path d="M8 6v3"/><circle cx="8" cy="11" r="0.5" fill={color}/></g>,
    grip: <g fill={color}><circle cx="6" cy="4" r="1"/><circle cx="6" cy="8" r="1"/><circle cx="6" cy="12" r="1"/><circle cx="10" cy="4" r="1"/><circle cx="10" cy="8" r="1"/><circle cx="10" cy="12" r="1"/></g>,
    pencil: <path d="M2 14l1-3 8-8 2 2-8 8-3 1z" fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round"/>,
    trash: <g fill="none" stroke={color} strokeWidth="1.4"><path d="M3 5h10M6 5V3h4v2M5 5l1 8h4l1-8"/></g>,
    arrowR: <path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>,
    arrowU: <path d="M8 13V3M4 7l4-4 4 4" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>,
    arrowD: <path d="M8 3v10M4 9l4 4 4-4" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>,
    dot: <circle cx="8" cy="8" r="3" fill={color}/>,
    cmd: <path d="M5 5h6v6H5zM5 5V4a2 2 0 10-2 2h2zM11 5V4a2 2 0 112 2h-2zM5 11v1a2 2 0 11-2-2h2zM11 11v1a2 2 0 102-2h-2z" fill="none" stroke={color} strokeWidth="1.3"/>,
    phone: <g fill="none" stroke={color} strokeWidth="1.4"><rect x="4" y="2" width="8" height="12" rx="1.5"/><path d="M7 12h2"/></g>,
    bolt: <path d="M9 1L3 9h4l-1 6 6-8H8l1-6z" fill={color}/>,
  };
  return <svg width={size} height={size} viewBox="0 0 16 16">{paths[name]}</svg>;
};

const Pill = ({ tone = 'neutral', children, dot, style }) => {
  const tones = {
    neutral: { bg: 'var(--panel-2)',  fg: 'var(--ink-2)',  bd: 'var(--rule-2)' },
    accent:  { bg: 'var(--accent-soft)', fg: 'var(--accent)', bd: 'transparent' },
    ok:      { bg: 'var(--ok-soft)',  fg: 'var(--ok)',     bd: 'transparent' },
    warn:    { bg: 'var(--warn-soft)',fg: 'oklch(0.45 0.12 75)', bd: 'transparent' },
    danger:  { bg: 'var(--danger-soft)', fg: 'var(--danger)', bd: 'transparent' },
    draft:   { bg: 'oklch(0.96 0.012 80)', fg: 'oklch(0.45 0.10 75)', bd: 'transparent' },
  }[tone];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 7px',
      fontSize: 11, fontWeight: 500, lineHeight: 1.4,
      background: tones.bg, color: tones.fg,
      border: `1px solid ${tones.bd}`, borderRadius: 999,
      letterSpacing: 0.01,
      ...style,
    }}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: '50%', background: tones.fg }}/>}
      {children}
    </span>
  );
};

const Card = ({ children, style, padding = 16 }) => (
  <div style={{
    background: 'var(--panel)',
    border: '1px solid var(--rule)',
    borderRadius: 'var(--r-lg)',
    padding,
    ...style,
  }}>{children}</div>
);

const SectionHeader = ({ eyebrow, title, action, children }) => (
  <div style={{
    display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
    gap: 16, marginBottom: 12,
  }}>
    <div>
      {eyebrow && (
        <div className="mono" style={{
          fontSize: 10.5, color: 'var(--ink-faint)', letterSpacing: 0.06,
          textTransform: 'uppercase', marginBottom: 4,
        }}>{eyebrow}</div>
      )}
      <div style={{
        fontSize: 18, fontWeight: 600, color: 'var(--ink)', letterSpacing: -0.2,
      }}>{title}</div>
      {children && <div style={{ fontSize: 12.5, color: 'var(--ink-mute)', marginTop: 2 }}>{children}</div>}
    </div>
    {action}
  </div>
);

// Field
const Field = ({ label, hint, error, children, optional, style }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-2)' }}>{label}</div>
      {optional && <div className="mono" style={{ fontSize: 10, color: 'var(--ink-faint)' }}>optional</div>}
    </div>
    {children}
    {hint && !error && <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>{hint}</div>}
    {error && <div style={{ fontSize: 11.5, color: 'var(--danger)' }}>{error}</div>}
  </label>
);

const Input = ({ value, onChange, placeholder, prefix, suffix, mono, style }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'var(--panel)', border: '1px solid var(--rule-2)',
    borderRadius: 'var(--r)', padding: '0 10px', height: 32,
    fontSize: 13,
    ...style,
  }}>
    {prefix && <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>{prefix}</span>}
    <input
      value={value}
      onChange={e => onChange && onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        all: 'unset', flex: 1, fontSize: 13,
        fontFamily: mono ? "'JetBrains Mono', ui-monospace, monospace" : 'inherit',
      }}
    />
    {suffix && <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>{suffix}</span>}
  </div>
);

const TextArea = ({ value, onChange, placeholder, rows = 4, style }) => (
  <textarea
    value={value}
    onChange={e => onChange && onChange(e.target.value)}
    placeholder={placeholder}
    rows={rows}
    style={{
      width: '100%', resize: 'vertical',
      background: 'var(--panel)', border: '1px solid var(--rule-2)',
      borderRadius: 'var(--r)', padding: '8px 10px',
      fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)',
      lineHeight: 1.5, outline: 'none',
      ...style,
    }}
  />
);

const Kbd = ({ children }) => (
  <span className="mono" style={{
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 18, height: 18, padding: '0 4px',
    fontSize: 10.5, color: 'var(--ink-2)',
    background: 'var(--panel)', border: '1px solid var(--rule-2)',
    borderRadius: 4, boxShadow: '0 1px 0 var(--rule-2)',
  }}>{children}</span>
);

// Dish thumbnail — placeholder gradient OR uploaded "photo" stripe pattern
const DishThumb = ({ dish, size = 40, radius = 6 }) => {
  if (!dish.photo) {
    return (
      <div style={{
        width: size, height: size, borderRadius: radius,
        background: 'repeating-linear-gradient(135deg, var(--panel-2) 0 6px, var(--hover) 6px 12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--ink-faint)',
        border: '1px dashed var(--rule-2)',
      }}>
        <Icon name="image" size={Math.max(12, size * 0.3)} />
      </div>
    );
  }
  // Deterministic gradient based on id
  const seed = (dish.id || dish.name || 'x').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const h1 = (seed * 23) % 360;
  const h2 = (h1 + 30) % 360;
  return (
    <div style={{
      width: size, height: size, borderRadius: radius,
      background: `linear-gradient(135deg, oklch(0.78 0.10 ${h1}), oklch(0.55 0.14 ${h2}))`,
    }}/>
  );
};

// Spark line
const Spark = ({ data, w = 120, h = 32, color = 'var(--accent)' }) => {
  const max = Math.max(...data), min = Math.min(...data);
  const dx = w / (data.length - 1);
  const pts = data.map((v, i) => `${i * dx},${h - ((v - min) / (max - min)) * (h - 4) - 2}`).join(' ');
  const area = `0,${h} ${pts} ${w},${h}`;
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polygon points={area} fill={color} opacity="0.10"/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  );
};

// Avatar
const Avatar = ({ initials, size = 24, online }) => (
  <div style={{ position: 'relative', display: 'inline-block' }}>
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'oklch(0.88 0.02 260)', color: 'oklch(0.30 0.04 260)',
      fontSize: size * 0.4, fontWeight: 600,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{initials}</div>
    {online !== undefined && (
      <div style={{
        position: 'absolute', right: -1, bottom: -1,
        width: 7, height: 7, borderRadius: '50%',
        background: online ? 'var(--ok)' : 'oklch(0.78 0.01 260)',
        border: '1.5px solid var(--panel)',
      }}/>
    )}
  </div>
);

Object.assign(window, {
  Btn, Icon, Pill, Card, SectionHeader, Field, Input, TextArea, Kbd,
  DishThumb, Spark, Avatar,
});
