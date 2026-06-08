// Admin sample data — Tsubaki is "logged in", editing its real menu.
// Same dish/ingredient ids as diner-app for cross-product consistency.

const ADMIN_RESTAURANT = {
  id: 'tsubaki',
  name: 'Tsubaki',
  subtitle: 'Izakaya & Ramen',
  neighborhood: 'Mission District',
  address: '2841 Valencia St, San Francisco, CA 94110',
  phone: '(415) 555-0182',
  website: 'tsubaki-sf.com',
  hours: 'Tue–Sun · 5pm – 10pm',
  established: 2014,
  cuisine: 'Japanese',
  cover: ['oklch(0.94 0.03 60)', 'oklch(0.78 0.08 40)'],
  accent: 'oklch(0.52 0.18 25)',
  theme: 'editorial',
  status: 'published',
  lastPublished: '2 days ago',
  pendingChanges: 5,
};

// Menu sections in order
const ADMIN_SECTIONS = [
  { id: 'ramen', title: 'Ramen', description: 'Bowls, broth-first', dishCount: 3 },
  { id: 'sushi', title: 'Sushi', description: 'Nigiri & maki', dishCount: 4 },
  { id: 'small', title: 'Small plates', description: 'Snacks, sides, vegetables', dishCount: 3 },
];

// Admin dish records — denormalized with status & meta
const ADMIN_DISHES = [
  {
    id: 'tonkotsu', section: 'ramen',
    name: 'Tonkotsu Ramen', jp: '豚骨ラーメン',
    tagline: 'Twelve-hour pork bone broth, chashu, ajitama.',
    description: 'Our signature. Pork femurs and trotters boiled at a hard roll for twelve hours until the marrow emulsifies into an opaque, collagen-heavy broth. Finished with a dark tare, a coil of thin straight noodles, and classic toppings.',
    price: 18.5,
    ingredients: ['wheat_noodle', 'pork_belly', 'egg', 'scallion', 'nori', 'bamboo', 'soy_sauce'],
    nutrition: { cal: 720, fat: 32, protein: 38, carbs: 64 },
    status: 'published', chefPick: true, available: true,
    edited: '2d ago', editedBy: 'Mika',
  },
  {
    id: 'miso_ramen', section: 'ramen',
    name: 'Sapporo Miso Ramen', jp: '札幌味噌ラーメン',
    tagline: 'Red miso, corn, butter, chashu, wavy noodle.',
    description: 'A bowl in the Hokkaidō tradition. Chicken-pork base tightened with aged red miso, topped with sweet corn, a slow-melting pat of cultured butter, bean sprouts, and charred scallion.',
    price: 17.0,
    ingredients: ['wheat_noodle', 'miso', 'pork_belly', 'scallion', 'bamboo', 'sesame'],
    nutrition: { cal: 680, fat: 28, protein: 34, carbs: 72 },
    status: 'edited', available: true,
    edited: '34m ago', editedBy: 'Mika',
  },
  {
    id: 'veg_ramen', section: 'ramen',
    name: 'Kinoko Shōyu Ramen', jp: '茸醤油ラーメン',
    tagline: 'Vegetable dashi, four mushrooms, silken tofu.',
    description: 'Vegetarian. A dashi of kombu and four dried mushrooms, pulled with shoyu tare. Topped with roasted shiitake, enoki, silken tofu cubes, and sesame.',
    price: 16.0,
    ingredients: ['wheat_noodle', 'shiitake', 'tofu', 'kombu', 'soy_sauce', 'scallion', 'sesame'],
    nutrition: { cal: 520, fat: 18, protein: 22, carbs: 68 },
    status: 'published', available: true,
    dietary: ['vegetarian'],
    edited: '6d ago', editedBy: 'Yuki',
  },
  {
    id: 'salmon_nigiri', section: 'sushi',
    name: 'Sake Nigiri', jp: '鮭握り',
    tagline: 'Two pieces — Atlantic salmon, hand-pressed.',
    description: 'Two pieces. Ora King salmon from New Zealand, sliced against the grain at 6mm, hand-pressed onto koshihikari rice seasoned with our house vinegar blend.',
    price: 9.0,
    ingredients: ['salmon', 'rice', 'wasabi'],
    nutrition: { cal: 180, fat: 6, protein: 14, carbs: 22 },
    status: 'published', available: true,
    edited: '6d ago', editedBy: 'Yuki',
  },
  {
    id: 'tuna_nigiri', section: 'sushi',
    name: 'Maguro Nigiri', jp: '鮪握り',
    tagline: 'Two pieces — akami bluefin tuna.',
    description: 'Two pieces. Pacific bluefin akami, aged two days at 0°C to deepen color and break down sinew. A dab of wasabi between fish and rice.',
    price: 11.0,
    ingredients: ['tuna', 'rice', 'wasabi'],
    nutrition: { cal: 170, fat: 3, protein: 18, carbs: 22 },
    status: 'edited', available: true,
    edited: '1h ago', editedBy: 'Mika',
  },
  {
    id: 'hosomaki', section: 'sushi',
    name: 'Kappa Maki', jp: '河童巻き',
    tagline: 'Cucumber, rice, nori — six pieces.',
    description: 'Six pieces. The simplest maki: a single stick of kyūri cucumber wrapped in rice and nori, cut into bite-sized rounds.',
    price: 7.0,
    ingredients: ['cucumber', 'rice', 'nori', 'sesame'],
    nutrition: { cal: 220, fat: 2, protein: 4, carbs: 46 },
    status: 'published', available: true,
    dietary: ['vegan'],
    edited: '6d ago', editedBy: 'Yuki',
  },
  {
    id: 'avocado_maki', section: 'sushi',
    name: 'Avocado Maki', jp: 'アボカド巻き',
    tagline: 'Hass avocado, rice, nori — six pieces.',
    description: 'Six pieces. Ripe Hass avocado sliced thin and rolled with rice and nori.',
    price: 8.0,
    ingredients: ['avocado', 'rice', 'nori', 'sesame'],
    nutrition: { cal: 260, fat: 11, protein: 4, carbs: 38 },
    status: 'draft', available: false,
    dietary: ['vegan'],
    edited: '12m ago', editedBy: 'Mika',
  },
  {
    id: 'miso_soup', section: 'small',
    name: 'Miso Shiru', jp: '味噌汁',
    tagline: 'Dashi, red miso, tofu, scallion.',
    description: 'Kombu-bonito dashi seasoned with red miso just before serving. Silken tofu, wakame, and a shower of scallion.',
    price: 4.5,
    ingredients: ['miso', 'tofu', 'kombu', 'bonito', 'scallion'],
    nutrition: { cal: 85, fat: 3, protein: 6, carbs: 7 },
    status: 'published', available: true,
    edited: '6d ago', editedBy: 'Yuki',
  },
  {
    id: 'sunomono', section: 'small',
    name: 'Sunomono', jp: '酢の物',
    tagline: 'Cucumber, rice vinegar, sesame, ginger.',
    description: 'Paper-thin cucumber salted and pressed, then dressed in sweet rice vinegar.',
    price: 6.0,
    ingredients: ['cucumber', 'sesame', 'ginger'],
    nutrition: { cal: 60, fat: 2, protein: 2, carbs: 10 },
    status: 'published', available: true,
    dietary: ['vegan'],
    edited: '3w ago', editedBy: 'Yuki',
  },
  {
    id: 'gomae', section: 'small',
    name: 'Horenso Gomaae', jp: '胡麻和え',
    tagline: 'Blanched spinach, black sesame paste.',
    description: 'Spinach blanched, shocked, and wrung dry, then dressed with a black sesame paste loosened with shoyu, mirin and a whisper of sugar.',
    price: 7.5,
    ingredients: ['sesame', 'soy_sauce'],
    nutrition: { cal: 140, fat: 8, protein: 5, carbs: 12 },
    status: 'published', available: false,
    dietary: ['vegan'],
    edited: '3w ago', editedBy: 'Yuki',
  },
];

// Ingredient library — denormalized for the picker. ID-aligned with diner-app.
const ADMIN_INGREDIENTS = {
  shiitake:    { id:'shiitake',    name:'Shiitake',         jp:'椎茸',   category:'Fungi',         allergens:[], usedIn:1, color:'#5b4a32' },
  nori:        { id:'nori',        name:'Nori',             jp:'海苔',   category:'Sea vegetable', allergens:[], usedIn:3, color:'#2d3a32' },
  miso:        { id:'miso',        name:'Miso (red)',       jp:'赤味噌', category:'Fermented',     allergens:['soy'], usedIn:2, color:'#7a4a2a' },
  tofu:        { id:'tofu',        name:'Silken tofu',      jp:'絹ごし豆腐', category:'Soy',       allergens:['soy'], usedIn:2, color:'#e8e2cc' },
  scallion:    { id:'scallion',    name:'Scallion',         jp:'葱',     category:'Allium',        allergens:[], usedIn:4, color:'#7aa84a' },
  pork_belly:  { id:'pork_belly',  name:'Chashu pork belly',jp:'チャーシュー', category:'Meat',    allergens:[], usedIn:2, color:'#a05a3a' },
  egg:         { id:'egg',         name:'Ajitama egg',      jp:'味付け玉子', category:'Egg',      allergens:['egg'], usedIn:1, color:'#e8b440' },
  wheat_noodle:{ id:'wheat_noodle',name:'Ramen noodle',     jp:'中華麺', category:'Grain',         allergens:['wheat'], usedIn:3, color:'#dcc060' },
  rice:        { id:'rice',        name:'Koshihikari rice', jp:'コシヒカリ', category:'Grain',     allergens:[], usedIn:4, color:'#f0eadc' },
  salmon:      { id:'salmon',      name:'Sake (salmon)',    jp:'鮭',     category:'Fish',          allergens:['fish'], usedIn:1, color:'#d97a4a' },
  tuna:        { id:'tuna',        name:'Maguro (bluefin)', jp:'鮪',     category:'Fish',          allergens:['fish'], usedIn:1, color:'#7a2828' },
  wasabi:      { id:'wasabi',      name:'Fresh wasabi',     jp:'山葵',   category:'Root',          allergens:[], usedIn:2, color:'#7aa852' },
  ginger:      { id:'ginger',      name:'Pickled ginger',   jp:'ガリ',   category:'Root',          allergens:[], usedIn:1, color:'#e8c4a0' },
  bonito:      { id:'bonito',      name:'Katsuobushi',      jp:'鰹節',   category:'Fish',          allergens:['fish'], usedIn:1, color:'#a07246' },
  kombu:       { id:'kombu',       name:'Kombu',            jp:'昆布',   category:'Sea vegetable', allergens:[], usedIn:2, color:'#2c4438' },
  sesame:      { id:'sesame',      name:'Sesame seeds',     jp:'胡麻',   category:'Seed',          allergens:['sesame'], usedIn:5, color:'#a08454' },
  cucumber:    { id:'cucumber',    name:'Japanese cucumber',jp:'胡瓜',   category:'Vegetable',     allergens:[], usedIn:2, color:'#88b85a' },
  avocado:     { id:'avocado',     name:'Avocado',          jp:'アボカド', category:'Fruit',       allergens:[], usedIn:1, color:'#7a9a44' },
  soy_sauce:   { id:'soy_sauce',   name:'Shoyu',            jp:'醤油',   category:'Condiment',     allergens:['soy','wheat'], usedIn:3, color:'#3a2418' },
  bamboo:      { id:'bamboo',      name:'Menma',            jp:'メンマ', category:'Vegetable',     allergens:[], usedIn:2, color:'#b89858' },
  // Suggested but not yet in any dish
  enoki:       { id:'enoki',       name:'Enoki mushroom',   jp:'榎茸',   category:'Fungi',         allergens:[], usedIn:0, color:'#e0d8b8', isNew:true },
  yuzu:        { id:'yuzu',        name:'Yuzu',             jp:'柚子',   category:'Fruit',         allergens:[], usedIn:0, color:'#e8c648', isNew:true },
  shiso:       { id:'shiso',       name:'Shiso leaf',       jp:'紫蘇',   category:'Herb',          allergens:[], usedIn:0, color:'#5a7a44', isNew:true },
  mirin:       { id:'mirin',       name:'Mirin',            jp:'味醂',   category:'Condiment',     allergens:[], usedIn:0, color:'#d4b070', isNew:true },
};

// AI suggestions for "Sapporo Miso Ramen" — for the autocomplete demo
const SUGGESTED_INGREDIENTS = ['enoki', 'mirin', 'rice', 'kombu'];

// Activity feed
const ACTIVITY = [
  { id: 1, who: 'Mika', what: 'edited', target: 'Sapporo Miso Ramen', when: '34m ago', kind: 'edit' },
  { id: 2, who: 'Mika', what: 'added', target: 'Avocado Maki', when: '12m ago', kind: 'add' },
  { id: 3, who: 'Yuki', what: 'set unavailable', target: 'Horenso Gomaae', when: '2h ago', kind: 'unavailable' },
  { id: 4, who: 'Mika', what: 'updated price on', target: 'Maguro Nigiri', when: '1h ago', kind: 'edit' },
  { id: 5, who: 'System', what: 'flagged', target: '2 dishes contain new allergen: sesame', when: '1d ago', kind: 'warn' },
];

// Pending changes for publish flow
const PENDING_CHANGES = [
  { id: 1, dish: 'Sapporo Miso Ramen', kind: 'description', from: 'Aged red miso, corn, butter.', to: 'A bowl in the Hokkaidō tradition…', who: 'Mika', when: '34m ago' },
  { id: 2, dish: 'Maguro Nigiri', kind: 'price', from: '$10.50', to: '$11.00', who: 'Mika', when: '1h ago' },
  { id: 3, dish: 'Avocado Maki', kind: 'new', from: null, to: 'Hass avocado, rice, nori — six pieces.', who: 'Mika', when: '12m ago' },
  { id: 4, dish: 'Tonkotsu Ramen', kind: 'ingredient', from: 'Removed: white pepper', to: 'Added: bamboo (menma)', who: 'Mika', when: '2d ago' },
  { id: 5, dish: 'Horenso Gomaae', kind: 'availability', from: 'Available', to: 'Unavailable', who: 'Yuki', when: '2h ago' },
];

// Today stats for dashboard
const TODAY_STATS = {
  views: 1284,
  viewsTrend: +12,
  topDishes: [
    { id: 'tonkotsu', name: 'Tonkotsu Ramen', views: 412, share: 32 },
    { id: 'miso_ramen', name: 'Sapporo Miso Ramen', views: 287, share: 22 },
    { id: 'salmon_nigiri', name: 'Sake Nigiri', views: 198, share: 15 },
    { id: 'tuna_nigiri', name: 'Maguro Nigiri', views: 156, share: 12 },
  ],
  filterUsage: [
    { label: 'Vegetarian', count: 184, pct: 14 },
    { label: 'Gluten-free', count: 142, pct: 11 },
    { label: 'Soy allergen', count: 98, pct: 8 },
    { label: 'Sesame allergen', count: 64, pct: 5 },
  ],
  ingredientClicks: [
    { id: 'pork_belly', clicks: 84 },
    { id: 'kombu', clicks: 62 },
    { id: 'miso', clicks: 51 },
    { id: 'shiitake', clicks: 47 },
    { id: 'wasabi', clicks: 39 },
  ],
};

Object.assign(window, {
  ADMIN_RESTAURANT, ADMIN_SECTIONS, ADMIN_DISHES, ADMIN_INGREDIENTS,
  SUGGESTED_INGREDIENTS, ACTIVITY, PENDING_CHANGES, TODAY_STATS,
});
