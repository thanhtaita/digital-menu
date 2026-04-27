// DishGradient — deterministic abstract gradient cards for each dish.
// No photos. Uses the ingredient palette + a simple shape language to hint
// at the dish without illustrating it.

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function DishGradient({ dish, theme = 'editorial', size = 'md', style = {} }) {
  const h = hashStr(dish.id);
  const firstIngs = (dish.ingredients || []).slice(0, 3)
    .map(id => window.INGREDIENTS[id])
    .filter(Boolean);

  // Pick dominant colors from ingredients; fall back to paper.
  const c1 = firstIngs[0]?.gradient[0] || 'oklch(0.9 0.04 60)';
  const c2 = firstIngs[1]?.gradient[0] || firstIngs[0]?.gradient[1] || 'oklch(0.75 0.06 50)';
  const c3 = firstIngs[2]?.gradient[0] || 'oklch(0.65 0.08 30)';

  // Shape choice based on dish section
  const shape = dish.section === 'Ramen' ? 'ramen'
              : dish.section === 'Sushi' ? 'sushi'
              : 'plate';

  const rotation = (h % 40) - 20;
  const offsetX = (h % 30);
  const offsetY = ((h >> 3) % 30);

  // Noise overlay via SVG fractal — gives that editorial, printed quality
  const noiseId = `noise-${dish.id}`;

  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      background: `radial-gradient(120% 90% at ${20+offsetX}% ${30+offsetY}%, ${c2}, ${c1} 55%, ${c3} 120%)`,
      ...style,
    }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, mixBlendMode: 'soft-light', opacity: 0.8 }}>
        <defs>
          <filter id={noiseId}>
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed={h % 10} />
            <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0"/>
          </filter>
        </defs>
        <rect width="100%" height="100%" filter={`url(#${noiseId})`} />
      </svg>

      {/* Editorial shape gestures — never illustrate, just hint */}
      {shape === 'ramen' && (
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"
             style={{ position: 'absolute', inset: 0, transform: `rotate(${rotation}deg)` }}>
          <g stroke={c3} strokeWidth="0.4" fill="none" opacity="0.55">
            <circle cx="50" cy="60" r="38" />
            <circle cx="50" cy="60" r="28" />
            <circle cx="50" cy="60" r="18" />
          </g>
          {/* noodle squiggles */}
          <g stroke={c1} strokeWidth="0.6" fill="none" opacity="0.7" strokeLinecap="round">
            {[...Array(4)].map((_, i) => (
              <path key={i} d={`M ${20+i*5} ${45+i*3} Q ${50} ${35+i*2}, ${80-i*3} ${55+i*2}`} />
            ))}
          </g>
        </svg>
      )}
      {shape === 'sushi' && (
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"
             style={{ position: 'absolute', inset: 0 }}>
          {/* two blocky ovals suggesting nigiri */}
          <g opacity="0.7">
            <ellipse cx={35} cy={62} rx="18" ry="7" fill={c3} opacity="0.5" />
            <ellipse cx={35} cy={58} rx="18" ry="5" fill={c2} opacity="0.8" />
            <ellipse cx={68} cy={48} rx="16" ry="6" fill={c3} opacity="0.4" />
            <ellipse cx={68} cy={44} rx="16" ry="4.5" fill={c1} opacity="0.8" />
          </g>
        </svg>
      )}
      {shape === 'plate' && (
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"
             style={{ position: 'absolute', inset: 0 }}>
          <g fill="none" stroke={c3} strokeWidth="0.3" opacity="0.5">
            <circle cx="50" cy="55" r="32" />
            <circle cx="50" cy="55" r="22" />
          </g>
          <circle cx="50" cy="55" r="18" fill={c2} opacity="0.5" />
        </svg>
      )}

      {/* subtle vignette */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(120% 80% at 50% 50%, transparent 50%, rgba(0,0,0,0.12))',
      }} />
    </div>
  );
}

function IngredientGradient({ ingredient, style = {} }) {
  const g = ingredient?.gradient || ['oklch(0.85 0.04 60)', 'oklch(0.6 0.06 50)'];
  const h = hashStr(ingredient?.id || 'x');
  const noiseId = `ning-${ingredient?.id || 'x'}`;
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      background: `radial-gradient(120% 100% at 30% 30%, ${g[0]}, ${g[1]})`,
      ...style,
    }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, mixBlendMode: 'soft-light', opacity: 0.7 }}>
        <defs>
          <filter id={noiseId}>
            <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed={h % 10}/>
            <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0"/>
          </filter>
        </defs>
        <rect width="100%" height="100%" filter={`url(#${noiseId})`} />
      </svg>
    </div>
  );
}

Object.assign(window, { DishGradient, IngredientGradient, hashStr });
