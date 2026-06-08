// Admin-portal seed data. Mirrors the diner app schema but adds editor state
// (draft vs published, change log, photo placeholders, ingredient library).

const RESTAURANT = {
  id: 'tsubaki',
  name: 'Tsubaki',
  subtitle: 'Izakaya & Ramen',
  neighborhood: 'Mission District, San Francisco',
  address: '2841 Valencia St, San Francisco, CA 94110',
  phone: '+1 (415) 555-0142',
  email: 'hello@tsubaki.sf',
  website: 'tsubaki.sf',
  hours: [
    { d: 'Mon', h: 'Closed' },
    { d: 'Tue', h: '17:00 — 22:00' },
    { d: 'Wed', h: '17:00 — 22:00' },
    { d: 'Thu', h: '17:00 — 22:00' },
    { d: 'Fri', h: '17:00 — 23:00' },
    { d: 'Sat', h: '12:00 — 23:00' },
    { d: 'Sun', h: '12:00 — 21:00' },
  ],
  established: 2014,
  team: [
    { name: 'Kenji Watanabe', role: 'Owner / Chef', initials: 'KW', online: true },
    { name: 'Maya Lin', role: 'GM', initials: 'ML', online: true },
    { name: 'Diego Alvarez', role: 'Sous chef', initials: 'DA', online: false },
  ],
  publishedAt: '2026-04-22T18:14:00Z',
};

// Ingredient library — what the restaurant has tagged before.
// `usage` = how many dishes use it.
const INGREDIENTS = [
  { id: 'wheat_noodle', name: 'Ramen noodle', alt: 'Chūkamen', cat: 'Grain',     allergens: ['wheat'],          usage: 3 },
  { id: 'pork_belly',   name: 'Chashu pork belly', alt: 'Chāshū', cat: 'Meat',   allergens: [],                 usage: 2 },
  { id: 'egg',          name: 'Ajitama egg',  alt: 'Ajitsuke tamago', cat: 'Egg',allergens: ['egg'],            usage: 1 },
  { id: 'scallion',     name: 'Scallion',     alt: 'Negi', cat: 'Allium',        allergens: [],                 usage: 4 },
  { id: 'nori',         name: 'Nori',         alt: 'Laver', cat: 'Sea vegetable',allergens: [],                 usage: 3 },
  { id: 'bamboo',       name: 'Menma',        alt: 'Bamboo', cat: 'Vegetable',   allergens: [],                 usage: 2 },
  { id: 'soy_sauce',    name: 'Shoyu',        alt: 'Soy sauce', cat: 'Condiment',allergens: ['soy', 'wheat'],   usage: 4 },
  { id: 'miso',         name: 'Miso (red)',   alt: 'Aka-miso', cat: 'Fermented', allergens: ['soy'],            usage: 2 },
  { id: 'tofu',         name: 'Silken tofu',  alt: 'Kinugoshi', cat: 'Soy',      allergens: ['soy'],            usage: 2 },
  { id: 'shiitake',     name: 'Shiitake',     alt: 'Donko', cat: 'Fungi',        allergens: [],                 usage: 1 },
  { id: 'kombu',        name: 'Kombu',        alt: 'Kelp', cat: 'Sea vegetable', allergens: [],                 usage: 2 },
  { id: 'bonito',       name: 'Katsuobushi',  alt: 'Bonito', cat: 'Fish',        allergens: ['fish'],           usage: 1 },
  { id: 'sesame',       name: 'Sesame seeds', alt: 'Goma', cat: 'Seed',          allergens: ['sesame'],         usage: 4 },
  { id: 'rice',         name: 'Koshihikari rice', alt: 'Short-grain', cat: 'Grain', allergens: [],              usage: 3 },
  { id: 'salmon',       name: 'Sake (salmon)', alt: 'Salmon', cat: 'Fish',       allergens: ['fish'],           usage: 1 },
  { id: 'tuna',         name: 'Maguro',       alt: 'Bluefin', cat: 'Fish',       allergens: ['fish'],           usage: 1 },
  { id: 'wasabi',       name: 'Fresh wasabi', alt: 'Yamawasabi', cat: 'Root',    allergens: [],                 usage: 2 },
  { id: 'cucumber',     name: 'Japanese cucumber', alt: 'Kyūri', cat: 'Vegetable', allergens: [],               usage: 2 },
  { id: 'avocado',      name: 'Avocado',      alt: 'Hass', cat: 'Fruit',         allergens: [],                 usage: 1 },
  { id: 'ginger',       name: 'Pickled ginger', alt: 'Gari', cat: 'Root',        allergens: [],                 usage: 1 },
];

const ALLERGEN_LABELS = {
  wheat: 'Wheat / gluten', soy: 'Soy', egg: 'Egg', fish: 'Fish',
  shellfish: 'Shellfish', sesame: 'Sesame', peanut: 'Peanut', dairy: 'Dairy',
};

// Suggested ingredients (smart suggestions) keyed by dish name keyword.
const SUGGEST_BY_KEYWORD = {
  ramen: ['wheat_noodle', 'pork_belly', 'egg', 'scallion', 'nori', 'bamboo', 'soy_sauce'],
  miso: ['miso', 'tofu', 'kombu', 'scallion'],
  sushi: ['rice', 'wasabi', 'soy_sauce', 'nori'],
  nigiri: ['rice', 'wasabi', 'salmon', 'tuna'],
  maki: ['rice', 'nori', 'cucumber', 'avocado', 'sesame'],
  tofu: ['tofu', 'soy_sauce', 'scallion'],
};

// The current draft menu (Tsubaki, filled state).
const MENU_FILLED = {
  name: 'Dinner Menu',
  draft: true,
  hasUnpublishedChanges: true,
  sections: [
    {
      id: 'sec_ramen',
      name: 'Ramen',
      jp: 'ラーメン',
      dishes: [
        {
          id: 'tonkotsu',
          name: 'Tonkotsu Ramen', jp: '豚骨ラーメン',
          tagline: 'Twelve-hour pork bone broth, chashu, ajitama.',
          description: 'Pork femurs and trotters boiled at a hard roll for twelve hours until the marrow emulsifies into an opaque, collagen-heavy broth. Finished with a dark tare, a coil of thin straight noodles, and classic toppings.',
          price: 18.5, photo: true, status: 'published',
          ingredients: ['wheat_noodle', 'pork_belly', 'egg', 'scallion', 'nori', 'bamboo', 'soy_sauce'],
          chefPick: true, spice: 1,
          changed: false,
        },
        {
          id: 'miso_ramen',
          name: 'Sapporo Miso Ramen', jp: '札幌味噌ラーメン',
          tagline: 'Red miso, corn, butter, chashu, wavy noodle.',
          description: 'Chicken-pork base tightened with aged red miso, topped with sweet corn, a slow-melting pat of cultured butter, bean sprouts, and charred scallion.',
          price: 17.0, photo: true, status: 'published',
          ingredients: ['wheat_noodle', 'miso', 'pork_belly', 'scallion', 'bamboo', 'sesame'],
          changed: true,
        },
        {
          id: 'veg_ramen',
          name: 'Kinoko Shōyu Ramen', jp: '茸醤油ラーメン',
          tagline: 'Vegetable dashi, four mushrooms, silken tofu.',
          description: 'A dashi of kombu and four dried mushrooms, pulled with shoyu tare. Topped with roasted shiitake, enoki, silken tofu cubes, and sesame.',
          price: 16.0, photo: true, status: 'published',
          ingredients: ['wheat_noodle', 'shiitake', 'tofu', 'kombu', 'soy_sauce', 'scallion', 'sesame'],
          dietary: ['vegetarian'],
        },
        {
          id: 'spicy_tantan',
          name: 'Spicy Tantanmen', jp: '担々麺',
          tagline: 'Sesame paste, chili oil, ground pork.',
          description: '',
          price: 18.0, photo: false, status: 'draft',
          ingredients: ['wheat_noodle', 'sesame', 'soy_sauce'],
          spice: 3,
          changed: true,
        },
      ],
    },
    {
      id: 'sec_sushi',
      name: 'Sushi',
      jp: '寿司',
      dishes: [
        {
          id: 'salmon_nigiri', name: 'Sake Nigiri', jp: '鮭握り',
          tagline: 'Two pieces — Atlantic salmon, hand-pressed.',
          description: 'Ora King salmon from New Zealand, sliced against the grain at 6mm, hand-pressed onto koshihikari rice seasoned with our house vinegar blend.',
          price: 9.0, photo: true, status: 'published',
          ingredients: ['salmon', 'rice', 'wasabi'],
        },
        {
          id: 'tuna_nigiri', name: 'Maguro Nigiri', jp: '鮪握り',
          tagline: 'Two pieces — akami bluefin tuna.',
          description: 'Pacific bluefin akami, aged two days at 0°C to deepen color.',
          price: 11.0, photo: true, status: 'published',
          ingredients: ['tuna', 'rice', 'wasabi'],
        },
        {
          id: 'kappa', name: 'Kappa Maki', jp: '河童巻き',
          tagline: 'Cucumber, rice, nori — six pieces.',
          description: 'The simplest maki: a single stick of kyūri cucumber wrapped in rice and nori.',
          price: 7.0, photo: true, status: 'published',
          ingredients: ['cucumber', 'rice', 'nori', 'sesame'],
          dietary: ['vegan'],
        },
        {
          id: 'avo', name: 'Avocado Maki', jp: 'アボカド巻き',
          tagline: 'Hass avocado, rice, nori — six pieces.',
          description: 'Ripe Hass avocado sliced thin and rolled with rice and nori.',
          price: 8.0, photo: true, status: 'published',
          ingredients: ['avocado', 'rice', 'nori', 'sesame'],
          dietary: ['vegan'],
        },
      ],
    },
    {
      id: 'sec_small',
      name: 'Small plates',
      jp: '小皿',
      dishes: [
        {
          id: 'miso_soup', name: 'Miso Shiru', jp: '味噌汁',
          tagline: 'Dashi, red miso, tofu, scallion.',
          description: 'Kombu-bonito dashi seasoned with red miso just before serving.',
          price: 4.5, photo: true, status: 'published',
          ingredients: ['miso', 'tofu', 'kombu', 'bonito', 'scallion'],
        },
        {
          id: 'sunomono', name: 'Sunomono', jp: '酢の物',
          tagline: 'Cucumber, rice vinegar, sesame, ginger.',
          description: 'Paper-thin cucumber salted and pressed, then dressed in sweet rice vinegar.',
          price: 6.0, photo: true, status: 'published',
          ingredients: ['cucumber', 'sesame', 'ginger'], dietary: ['vegan'],
        },
      ],
    },
  ],
};

const MENU_EMPTY = {
  name: 'Dinner Menu',
  draft: true,
  hasUnpublishedChanges: false,
  sections: [],
};

// Recent activity for dashboard
const ACTIVITY = [
  { ts: '12 min ago',  who: 'Kenji', action: 'edited price on', target: 'Sapporo Miso Ramen', kind: 'edit' },
  { ts: '1 hr ago',    who: 'Maya',  action: 'added',           target: 'Spicy Tantanmen',      kind: 'add'  },
  { ts: '3 hr ago',    who: 'Kenji', action: 'tagged ingredient on', target: 'Tonkotsu Ramen', kind: 'edit' },
  { ts: 'Yesterday',   who: 'Diego', action: 'uploaded photo for',   target: 'Kinoko Shōyu Ramen', kind: 'photo' },
  { ts: '2 days ago',  who: 'Kenji', action: 'published menu',       target: 'Dinner Menu v0.43', kind: 'publish' },
];

// Pending changes (publish queue)
const PENDING = [
  { id: 'c1', kind: 'price',    dish: 'Sapporo Miso Ramen', from: '$16.50', to: '$17.00',  by: 'Kenji', at: '12 min ago' },
  { id: 'c2', kind: 'new',      dish: 'Spicy Tantanmen',    detail: '3 ingredients, no photo, no description', by: 'Maya', at: '1 hr ago' },
  { id: 'c3', kind: 'tag',      dish: 'Tonkotsu Ramen',     detail: 'added “bamboo (menma)”', by: 'Kenji', at: '3 hr ago' },
  { id: 'c4', kind: 'photo',    dish: 'Kinoko Shōyu Ramen', detail: 'new hero photo', by: 'Diego', at: 'Yesterday' },
];

// Stats
const STATS = {
  views7d: 4218, views7dDelta: 12,
  topDish: 'Tonkotsu Ramen',
  topDishViews: 612,
  filterHits7d: 348,
  topAllergen: 'wheat',
  ingredientCoverage: 0.94, // % of dishes with ingredients tagged
  photoCoverage: 0.88,
  descriptionCoverage: 0.90,
};

// Sparkline data (last 14 days of menu views)
const VIEWS_14D = [180, 210, 240, 220, 260, 310, 340, 290, 350, 380, 410, 460, 520, 540];

Object.assign(window, {
  RESTAURANT, INGREDIENTS, ALLERGEN_LABELS, SUGGEST_BY_KEYWORD,
  MENU_FILLED, MENU_EMPTY, ACTIVITY, PENDING, STATS, VIEWS_14D,
});
