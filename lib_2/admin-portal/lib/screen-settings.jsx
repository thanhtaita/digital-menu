// Settings — restaurant profile, hours, theme, integrations.

function SettingsScreen() {
  const r = window.ADMIN_RESTAURANT;
  return (
    <div>
      <window.PageHeader
        eyebrow="Settings"
        title="Restaurant profile"
        subtitle="What diners see at the top of your menu — and how the app connects to your tables."
        actions={<window.Btn kind="primary" icon="check">Save changes</window.Btn>}
      />
      <div style={{ padding: 32, maxWidth: 920, display: 'grid', gap: 24 }}>

        <section style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 32 }}>
          <div>
            <window.MetaLabel>Identity</window.MetaLabel>
            <div style={{ fontSize: 12, color: 'var(--inkFaint)', marginTop: 4, lineHeight: 1.5 }}>
              Name, neighborhood, and the cover image diners see first.
            </div>
          </div>
          <window.Card padding={20} style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{
                width: 80, height: 80, borderRadius: 8, flexShrink: 0,
                background: `radial-gradient(120% 100% at 30% 30%, ${r.cover[0]}, ${r.cover[1]})`,
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--display)', fontSize: 44, color: 'rgba(255,255,255,0.92)',
                }}>{r.name[0]}</div>
              </div>
              <div style={{ flex: 1, display: 'grid', gap: 10 }}>
                <window.Field label="Restaurant name" required>
                  <window.Input value={r.name} />
                </window.Field>
                <window.Field label="Subtitle" hint="e.g. cuisine + concept">
                  <window.Input value={r.subtitle} />
                </window.Field>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <window.Field label="Neighborhood"><window.Input value={r.neighborhood} /></window.Field>
              <window.Field label="Cuisine"><window.Input value={r.cuisine} /></window.Field>
            </div>
            <window.Field label="Address"><window.Input value={r.address} /></window.Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <window.Field label="Phone"><window.Input value={r.phone} /></window.Field>
              <window.Field label="Website"><window.Input prefix="https://" value={r.website} /></window.Field>
            </div>
          </window.Card>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 32 }}>
          <div>
            <window.MetaLabel>Theme</window.MetaLabel>
            <div style={{ fontSize: 12, color: 'var(--inkFaint)', marginTop: 4, lineHeight: 1.5 }}>
              How your menu looks to diners. Three styles to choose from.
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              { id: 'editorial', name: 'Editorial', sub: 'Serif, paper, vermilion', bg: 'oklch(0.97 0.008 80)', ink: 'oklch(0.18 0.01 60)', accent: 'oklch(0.52 0.18 25)' },
              { id: 'utility', name: 'Utility', sub: 'Sans, neutral grid, cobalt', bg: 'oklch(0.98 0.002 240)', ink: 'oklch(0.2 0.008 240)', accent: 'oklch(0.45 0.17 260)' },
              { id: 'soft', name: 'Soft', sub: 'Rounded, cream, peach', bg: 'oklch(0.97 0.018 75)', ink: 'oklch(0.28 0.03 40)', accent: 'oklch(0.68 0.14 40)' },
            ].map(t => {
              const active = t.id === r.theme;
              return (
                <button key={t.id} style={{
                  all: 'unset', cursor: 'pointer', padding: 0,
                  borderRadius: 'var(--radius-md)',
                  border: '2px solid ' + (active ? 'var(--ink)' : 'var(--rule)'),
                  background: 'var(--surface)', overflow: 'hidden',
                }}>
                  <div style={{ background: t.bg, padding: '20px 16px', borderBottom: '1px solid var(--rule)' }}>
                    <div style={{ fontFamily: t.id === 'editorial' ? '"Instrument Serif", serif' : t.id === 'soft' ? '"Fraunces", serif' : 'Inter', fontSize: 22, color: t.ink, fontWeight: t.id === 'utility' ? 600 : 400, letterSpacing: -0.3 }}>Tsubaki</div>
                    <div style={{ height: 4, width: 32, background: t.accent, borderRadius: 2, marginTop: 8 }}/>
                  </div>
                  <div style={{ padding: '10px 14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {t.name}
                      {active && <window.Tag tone="success">Active</window.Tag>}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--inkFaint)', marginTop: 2 }}>{t.sub}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 32 }}>
          <div>
            <window.MetaLabel>Hours</window.MetaLabel>
            <div style={{ fontSize: 12, color: 'var(--inkFaint)', marginTop: 4, lineHeight: 1.5 }}>
              When you're open. Used to show "Open now" on diner menus.
            </div>
          </div>
          <window.Card padding={0}>
            {['Mon (closed)', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
              <div key={d} style={{
                display: 'grid', gridTemplateColumns: '120px 1fr 80px',
                gap: 12, alignItems: 'center', padding: '12px 18px',
                borderBottom: i === 6 ? 'none' : '1px solid var(--rule)',
              }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: i === 0 ? 'var(--inkFaint)' : 'var(--ink)' }}>{d}</div>
                <div style={{ fontSize: 12.5, color: 'var(--inkMuted)', fontFamily: 'var(--mono)' }}>
                  {i === 0 ? '—' : '5:00 PM – 10:00 PM'}
                </div>
                <window.Toggle checked={i !== 0} size="sm" />
              </div>
            ))}
          </window.Card>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 32 }}>
          <div>
            <window.MetaLabel>Integrations</window.MetaLabel>
            <div style={{ fontSize: 12, color: 'var(--inkFaint)', marginTop: 4, lineHeight: 1.5 }}>
              Connect tools — POS, table QR, analytics.
            </div>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {[
              { name: 'Table QR codes', sub: '12 tables connected · last scan 4m ago', state: 'on' },
              { name: 'Square POS', sub: 'Sync menu prices automatically', state: 'off' },
              { name: 'Google Analytics', sub: 'Track menu views with your GA property', state: 'off' },
            ].map(it => (
              <window.Card key={it.name} padding={16} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                  background: 'var(--surfaceSunken)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <window.Icon name="globe" size={16} color="var(--inkMuted)" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{it.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--inkFaint)' }}>{it.sub}</div>
                </div>
                {it.state === 'on'
                  ? <window.Tag tone="success">Connected</window.Tag>
                  : <window.Btn kind="secondary" size="sm">Connect</window.Btn>}
              </window.Card>
            ))}
          </div>
        </section>

        <div style={{ height: 40 }}/>
      </div>
    </div>
  );
}

Object.assign(window, { SettingsScreen });
