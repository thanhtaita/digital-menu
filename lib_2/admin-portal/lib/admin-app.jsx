// Admin app shell — routes between screens, owns Tweaks state.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "pickerStyle": "autocomplete",
  "density": "comfortable",
  "showPreview": true,
  "isEmpty": false,
  "sidebarCollapsed": false
}/*EDITMODE-END*/;

function AdminApp() {
  const [tweaks, setTweak] = window.useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = React.useState('dashboard');
  const [editingDish, setEditingDish] = React.useState(null);
  const [showPreview, setShowPreview] = React.useState(tweaks.showPreview);
  React.useEffect(() => { setShowPreview(tweaks.showPreview); }, [tweaks.showPreview]);

  const restaurant = window.ADMIN_RESTAURANT;
  const navigate = (r) => { setRoute(r); setEditingDish(null); };

  let screen;
  if (editingDish) {
    screen = <window.DishEditorScreen
      dishId={editingDish}
      onBack={() => setEditingDish(null)}
      showPreview={showPreview}
      onTogglePreview={() => setShowPreview(s => !s)}
      pickerStyle={tweaks.pickerStyle}
    />;
  } else if (route === 'dashboard') {
    screen = <window.DashboardScreen onNavigate={navigate} restaurant={restaurant} isEmpty={tweaks.isEmpty} />;
  } else if (route === 'menu') {
    screen = <window.MenuEditorScreen
      onOpenDish={setEditingDish}
      onNavigate={navigate}
      showPreview={showPreview}
      onTogglePreview={() => setShowPreview(s => !s)}
      density={tweaks.density}
      isEmpty={tweaks.isEmpty}
    />;
  } else if (route === 'ingredients') {
    screen = <window.IngredientsScreen onNavigate={navigate} />;
  } else if (route === 'publish') {
    screen = <window.PublishScreen onNavigate={navigate} />;
  } else if (route === 'settings') {
    screen = <window.SettingsScreen />;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }} data-screen-label={`admin-${editingDish ? 'dish-editor' : route}`}>
      <window.Sidebar
        route={route}
        onNavigate={navigate}
        collapsed={tweaks.sidebarCollapsed}
        restaurant={restaurant}
      />
      <main style={{ flex: 1, minWidth: 0, overflow: 'hidden', position: 'relative' }}>
        {screen}
      </main>

      <window.TweaksPanel title="Tweaks">
        <window.TweakSection label="State" />
        <window.TweakRadio
          label="Data"
          value={tweaks.isEmpty ? 'empty' : 'filled'}
          onChange={v => setTweak('isEmpty', v === 'empty')}
          options={['filled', 'empty']}
        />
        <window.TweakToggle
          label="Sidebar collapsed"
          value={tweaks.sidebarCollapsed}
          onChange={v => setTweak('sidebarCollapsed', v)}
        />
        <window.TweakSection label="Menu editor" />
        <window.TweakRadio
          label="Density"
          value={tweaks.density}
          onChange={v => setTweak('density', v)}
          options={['comfortable', 'compact']}
        />
        <window.TweakToggle
          label="Preview pane"
          value={tweaks.showPreview}
          onChange={v => setTweak('showPreview', v)}
        />
        <window.TweakSection label="Ingredient picker" />
        <window.TweakRadio
          label="Style"
          value={tweaks.pickerStyle}
          onChange={v => setTweak('pickerStyle', v)}
          options={['autocomplete', 'suggested-grid', 'category-tree']}
        />
          <div style={{ fontSize: 11, color: 'var(--inkFaint)', lineHeight: 1.4, marginTop: 4 }}>
            Open any dish to see — three ingredient-tagging UX variations.
          </div>
      </window.TweaksPanel>
    </div>
  );
}

Object.assign(window, { AdminApp });
