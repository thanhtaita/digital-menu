// Publish review — diff list of pending changes, ready-to-ship summary.

function PublishScreen({ onNavigate }) {
  const changes = window.PENDING_CHANGES;
  const kindLabel = {
    new: 'New dish', description: 'Description', price: 'Price',
    ingredient: 'Ingredients', availability: 'Availability',
  };
  const kindTone = {
    new: 'info', description: 'neutral', price: 'warn',
    ingredient: 'accent', availability: 'neutral',
  };

  return (
    <div>
      <window.PageHeader
        eyebrow="Publish"
        title="Review changes"
        subtitle={`${changes.length} unpublished changes since last publish · 2 days ago`}
        actions={<>
          <window.Btn kind="ghost">Discard all</window.Btn>
          <window.Btn kind="secondary" icon="eye">Preview menu</window.Btn>
          <window.Btn kind="accent" icon="send">Publish all changes</window.Btn>
        </>}
      />
      <div style={{ padding: 32, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, maxWidth: 1200 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <window.MetaLabel>Pending changes · {changes.length}</window.MetaLabel>
            <window.Btn kind="ghost" size="sm">Group by dish</window.Btn>
          </div>

          <window.Card padding={0}>
            {changes.map((c, i) => (
              <div key={c.id} style={{
                display: 'flex', gap: 14, padding: '14px 18px',
                borderBottom: i === changes.length - 1 ? 'none' : '1px solid var(--rule)',
                alignItems: 'flex-start',
              }}>
                <input type="checkbox" defaultChecked style={{ marginTop: 4, accentColor: 'var(--ink)' }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <window.Tag tone={kindTone[c.kind]}>{kindLabel[c.kind]}</window.Tag>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{c.dish}</span>
                  </div>
                  {c.kind === 'new' ? (
                    <div style={{ fontSize: 12.5, color: 'var(--inkMuted)', lineHeight: 1.5 }}>
                      <span style={{ color: 'var(--success)', fontWeight: 500 }}>+ New dish added.</span> {c.to}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, fontSize: 12.5, lineHeight: 1.5 }}>
                      <div style={{ padding: '6px 10px', background: 'color-mix(in srgb, var(--danger) 8%, transparent)', borderRadius: '4px 0 0 4px', color: 'var(--inkMuted)', textDecoration: 'line-through', textDecorationColor: 'var(--danger)' }}>
                        {c.from}
                      </div>
                      <div style={{ padding: '6px 10px', background: 'color-mix(in srgb, var(--success) 10%, transparent)', borderRadius: '0 4px 4px 0', color: 'var(--ink)' }}>
                        {c.to}
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: 'var(--inkFaint)' }}>
                    <span>by {c.who}</span>
                    <span>·</span>
                    <span>{c.when}</span>
                  </div>
                </div>
                <window.Btn kind="ghost" size="sm">Revert</window.Btn>
              </div>
            ))}
          </window.Card>
        </div>

        <aside style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <window.Card padding={18}>
            <window.MetaLabel style={{ marginBottom: 10 }}>Summary</window.MetaLabel>
            {[
              { l: 'New dishes', v: '1' },
              { l: 'Edited dishes', v: '3' },
              { l: 'Availability changes', v: '1' },
              { l: 'Total changes', v: changes.length, bold: true },
            ].map(r => (
              <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: r.bold ? '1px solid var(--rule)' : 'none', marginTop: r.bold ? 6 : 0, paddingTop: r.bold ? 10 : 6 }}>
                <span style={{ fontSize: 12.5, color: 'var(--inkMuted)' }}>{r.l}</span>
                <span style={{ fontSize: 13, fontWeight: r.bold ? 600 : 500, color: 'var(--ink)', fontFamily: 'var(--mono)' }}>{r.v}</span>
              </div>
            ))}
          </window.Card>

          <window.Card padding={18} style={{ background: 'var(--accentSoft)', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <window.Icon name="globe" size={13} color="var(--accent)"/>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.04 }}>Goes live to</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', marginBottom: 4 }}>tsubaki-sf.com/menu</div>
            <div style={{ fontSize: 12, color: 'var(--inkMuted)' }}>QR codes on tables update automatically. ~12k diners viewed last week.</div>
          </window.Card>

          <window.Card padding={18}>
            <window.MetaLabel style={{ marginBottom: 8 }}>Schedule</window.MetaLabel>
            <div style={{ display: 'grid', gap: 8 }}>
              <button style={{
                all: 'unset', cursor: 'pointer', padding: '10px 12px',
                border: '1px solid var(--ink)', borderRadius: 'var(--radius-sm)',
                background: 'var(--ink)', color: '#fff', fontSize: 12.5, fontWeight: 500,
              }}>Publish now</button>
              <button style={{
                all: 'unset', cursor: 'pointer', padding: '10px 12px',
                border: '1px solid var(--ruleStrong)', borderRadius: 'var(--radius-sm)',
                background: 'var(--surface)', color: 'var(--ink)', fontSize: 12.5, fontWeight: 500,
              }}>Schedule for tonight, 5pm</button>
            </div>
          </window.Card>
        </aside>
      </div>
    </div>
  );
}

Object.assign(window, { PublishScreen });
