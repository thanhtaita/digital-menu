// Theme tokens — three directions restaurant admins can pick.
// Core features (ingredient sheet, nutrition pills, filters, warnings)
// render identically across themes; only the surface styling changes.

const THEMES = {
  editorial: {
    name: 'Editorial',
    subtitle: 'Serif headlines, paper, vermilion accent',
    paper: 'oklch(0.97 0.008 80)',
    paperAlt: 'oklch(0.94 0.012 75)',
    ink: 'oklch(0.18 0.01 60)',
    inkMuted: 'oklch(0.45 0.01 60)',
    inkFaint: 'oklch(0.62 0.008 60)',
    rule: 'oklch(0.85 0.01 70)',
    accent: 'oklch(0.52 0.18 25)',   // shu-iro
    accentInk: 'oklch(0.99 0.005 80)',
    warn: 'oklch(0.58 0.19 30)',
    displayFont: '"Instrument Serif", "Times New Roman", Georgia, serif',
    uiFont: 'Inter, -apple-system, system-ui, sans-serif',
    monoFont: '"JetBrains Mono", ui-monospace, monospace',
    displayWeight: 400,
    radius: 4,
    cardRadius: 8,
    caps: 'normal',
  },
  utility: {
    name: 'Utility',
    subtitle: 'Geometric sans, neutral grid, cobalt accent',
    paper: 'oklch(0.98 0.002 240)',
    paperAlt: 'oklch(0.95 0.003 240)',
    ink: 'oklch(0.2 0.008 240)',
    inkMuted: 'oklch(0.5 0.006 240)',
    inkFaint: 'oklch(0.68 0.005 240)',
    rule: 'oklch(0.88 0.004 240)',
    accent: 'oklch(0.45 0.17 260)',
    accentInk: 'oklch(0.99 0.002 240)',
    warn: 'oklch(0.58 0.19 30)',
    displayFont: 'Inter, -apple-system, system-ui, sans-serif',
    uiFont: 'Inter, -apple-system, system-ui, sans-serif',
    monoFont: '"JetBrains Mono", ui-monospace, monospace',
    displayWeight: 600,
    radius: 10,
    cardRadius: 14,
    caps: 'normal',
  },
  soft: {
    name: 'Soft',
    subtitle: 'Rounded, warm cream, peach accent',
    paper: 'oklch(0.97 0.018 75)',
    paperAlt: 'oklch(0.94 0.025 70)',
    ink: 'oklch(0.28 0.03 40)',
    inkMuted: 'oklch(0.52 0.02 40)',
    inkFaint: 'oklch(0.7 0.015 40)',
    rule: 'oklch(0.88 0.02 65)',
    accent: 'oklch(0.68 0.14 40)',
    accentInk: 'oklch(0.99 0.005 80)',
    warn: 'oklch(0.58 0.19 30)',
    displayFont: '"Fraunces", "Playfair Display", Georgia, serif',
    uiFont: '"Nunito", -apple-system, system-ui, sans-serif',
    monoFont: '"JetBrains Mono", ui-monospace, monospace',
    displayWeight: 500,
    radius: 16,
    cardRadius: 22,
    caps: 'normal',
  },
};

function themeStyles(theme) {
  const t = THEMES[theme] || THEMES.editorial;
  return {
    '--paper': t.paper,
    '--paperAlt': t.paperAlt,
    '--ink': t.ink,
    '--inkMuted': t.inkMuted,
    '--inkFaint': t.inkFaint,
    '--rule': t.rule,
    '--accent': t.accent,
    '--accentInk': t.accentInk,
    '--warn': t.warn,
    '--display': t.displayFont,
    '--ui': t.uiFont,
    '--mono': t.monoFont,
    '--displayWeight': t.displayWeight,
    '--radius': `${t.radius}px`,
    '--cardRadius': `${t.cardRadius}px`,
  };
}

Object.assign(window, { THEMES, themeStyles });
