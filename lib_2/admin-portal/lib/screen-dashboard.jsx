// Dashboard — overview cards, today's stats, activity feed.

function StatCard({ label, value, delta, deltaTone = 'success', sublabel, icon }) {
  const arrow = delta && delta.startsWith('+') ? 'arrow-up' : delta && delta.startsWith('-') ? 'arrow-down' : null;
  const tone = deltaTone === 'success' ? 'var(--success)' : 'var(--danger)';
  return (
    <window.Card padding={18} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <window.MetaLabel>{label}</window.MetaLabel>
        {icon && <window.Icon name={icon} size={14} color="var(--inkFaint)" />}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: -0.5, color: 'var(--ink)', lineHeight: 1 }}>{value}</div>
        {delta && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 12, fontWeight: 500, color: tone }}>
            {arrow && <window.Icon name={arrow} size={11} color={tone} />}
            {delta}
          </div>
        )}
      </div>
      {sublabel && <div style={{ fontSize: 12, color: 'var(--inkFaint)' }}>{sublabel}</div>}
    </window.Card>
  );
}

function DashboardScreen({ onNavigate, restaurant, isEmpty }) {
  if (isEmpty) {
    return (
      <div>
        <window.PageHeader
          eyebrow="Dashboard"
          title={`Welcome, ${restaurant.name}`}
          subtitle="Let's get your digital menu live. Three steps."
        />
        <div style={{ padding: 32, display: 'grid', gap: 16, maxWidth: 720 }}>
          {[
            { n: 1, title: 'Add your first menu section', body: 'Group dishes the way you serve them — Ramen, Sushi, Small plates.', cta: 'Create section', icon: 'menu', go: 'menu' },
            { n: 2, title: 'Add dishes with ingredients', body: 'Use ingredient tagging to power allergen filtering for diners.', cta: 'Add a dish', icon: 'plus', go: 'menu' },
            { n: 3, title: 'Publish to diners', body: 'Review your changes and push the menu live.', cta: 'Open publish', icon: 'send', go: 'publish' },
          ].map(s => (
            <window.Card key={s.n} padding={20} style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                background: 'var(--surfaceSunken)', color: 'var(--ink)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--display)', fontSize: 22,
              }}>{s.n}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{s.title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--inkMuted)' }}>{s.body}</div>
              </div>
              <window.Btn icon={s.icon} onClick={() => onNavigate(s.go)}>{s.cta}</window.Btn>
            </window.Card>
          ))}
        </div>
      </div>
    );
  }

  const stats = window.TODAY_STATS;
  return (
    <div>
      <window.PageHeader
        eyebrow="Dashboard"
        title={`Good afternoon, Mika`}
        subtitle={`${restaurant.name} — last published ${restaurant.lastPublished}. ${restaurant.pendingChanges} changes pending review.`}
        actions={<>
          <window.Btn kind="ghost" icon="eye" onClick={() => window.open('../theMenu.html', '_blank')}>View live menu</window.Btn>
          <window.Btn kind="accent" icon="send" onClick={() => onNavigate('publish')}>Publish ({restaurant.pendingChanges})</window.Btn>
        </>}
      />
      <div style={{ padding: 32, display: 'grid', gap: 20, maxWidth: 1280 }}>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <StatCard label="Menu views today" value={stats.views.toLocaleString()} delta={`+${stats.viewsTrend}%`} icon="eye" />
          <StatCard label="Live dishes" value="9" sublabel="of 10 — 1 hidden" icon="menu" />
          <StatCard label="Ingredients tagged" value="20" sublabel="4 suggestions to review" icon="leaf" />
          <StatCard label="Avg. dwell" value="2:14" delta="+8s" icon="clock" />
        </div>

        {/* Two-column main */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
          {/* Top dishes */}
          <window.Card padding={0}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--rule)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Top dishes today</div>
                <div style={{ fontSize: 12, color: 'var(--inkFaint)', marginTop: 2 }}>Views by diners in the last 24h</div>
              </div>
              <window.Btn kind="ghost" size="sm">Last 7 days</window.Btn>
            </div>
            <div style={{ padding: '6px 0' }}>
              {stats.topDishes.map((d, i) => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 18px' }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--inkFaint)', width: 20 }}>{String(i + 1).padStart(2, '0')}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', marginBottom: 4 }}>{d.name}</div>
                    <div style={{ height: 4, borderRadius: 999, background: 'var(--surfaceSunken)', overflow: 'hidden' }}>
                      <div style={{ width: `${d.share * 2}%`, height: '100%', background: 'var(--accent)', borderRadius: 999 }}/>
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink)', fontWeight: 500, minWidth: 50, textAlign: 'right' }}>{d.views}</div>
                </div>
              ))}
            </div>
          </window.Card>

          {/* Activity */}
          <window.Card padding={0}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--rule)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Recent activity</div>
              <window.MetaLabel>Today</window.MetaLabel>
            </div>
            <div>
              {window.ACTIVITY.map(a => (
                <div key={a.id} style={{ display: 'flex', gap: 12, padding: '10px 18px', borderBottom: '1px solid var(--rule)' }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    background: a.kind === 'warn' ? 'var(--warnSoft)' : 'var(--surfaceAlt)',
                    color: a.kind === 'warn' ? 'var(--warn)' : 'var(--inkMuted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 600,
                  }}>{a.kind === 'warn' ? '!' : a.who[0]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.4 }}>
                      <span style={{ fontWeight: 600 }}>{a.who}</span> {a.what}{' '}
                      <span style={{ color: a.kind === 'warn' ? 'var(--warn)' : 'var(--ink)', fontWeight: a.kind === 'warn' ? 500 : 400 }}>{a.target}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--inkFaint)', marginTop: 1 }}>{a.when}</div>
                  </div>
                </div>
              ))}
            </div>
          </window.Card>
        </div>

        {/* Diner insight strip */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <window.Card padding={0}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--rule)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Diner filter usage</div>
              <div style={{ fontSize: 12, color: 'var(--inkFaint)', marginTop: 2 }}>What restrictions diners filtered for</div>
            </div>
            <div style={{ padding: '10px 18px' }}>
              {stats.filterUsage.map(f => (
                <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
                  <div style={{ fontSize: 12.5, width: 130, color: 'var(--ink)' }}>{f.label}</div>
                  <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--surfaceSunken)' }}>
                    <div style={{ width: `${f.pct * 4}%`, height: '100%', background: 'var(--ink)', borderRadius: 999 }}/>
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--inkMuted)', width: 60, textAlign: 'right' }}>{f.count} · {f.pct}%</div>
                </div>
              ))}
            </div>
          </window.Card>

          <window.Card padding={0}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--rule)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Most-clicked ingredients</div>
              <div style={{ fontSize: 12, color: 'var(--inkFaint)', marginTop: 2 }}>Diners want to learn about these</div>
            </div>
            <div style={{ padding: '12px 18px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {stats.ingredientClicks.map(c => {
                const ing = window.ADMIN_INGREDIENTS[c.id];
                if (!ing) return null;
                return (
                  <div key={c.id} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px', borderRadius: 999,
                    border: '1px solid var(--rule)', background: 'var(--surfaceAlt)',
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: ing.color }}/>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)' }}>{ing.name}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--inkFaint)' }}>{c.clicks}</span>
                  </div>
                );
              })}
            </div>
          </window.Card>
        </div>

      </div>
    </div>
  );
}

Object.assign(window, { DashboardScreen });
