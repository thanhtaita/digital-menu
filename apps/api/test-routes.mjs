/**
 * Run all api-tests.http flows in sequence. Uses fetch + cookie jar.
 * Usage: node test-routes.mjs   (API must be running on http://localhost:3002)
 */
const BASE = "http://localhost:3002";

let cookie = "";
const ids = { restaurantId: null, menuId: null, sectionId: null, dishId: null, ingredientId: null };

function headers(includeJson = true, extra = {}) {
  const h = { ...extra };
  if (includeJson) h["Content-Type"] = "application/json";
  if (cookie) h["Cookie"] = cookie;
  return h;
}

function setCookieFromResponse(res) {
  const set = res.headers.get("set-cookie");
  if (set) cookie = set.split(",")[0].split(";")[0].trim();
}

async function req(method, path, body = null) {
  const hasBody = body != null && (method === "POST" || method === "PATCH");
  const opt = { method, headers: headers(hasBody) };
  if (hasBody) opt.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opt);
  setCookieFromResponse(res);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {}
  return { ok: res.ok, status: res.status, data, text };
}

function expect(name, { status, data }, wantStatus = 200, acceptStatuses = null) {
  const okStatuses = acceptStatuses ?? [wantStatus];
  const pass = okStatuses.includes(status);
  const label = Array.isArray(okStatuses) && okStatuses.length > 1 ? okStatuses.join("/") : wantStatus;
  console.log(pass ? `  ✓ ${name}` : `  ✗ ${name} (got ${status}, wanted ${label})`);
  if (!pass && data) console.log("    ", JSON.stringify(data).slice(0, 200));
  return pass;
}

async function main() {
  console.log("Testing API routes...\n");

  // Health
  let r = await req("GET", "/api/v1/health");
  expect("GET /health", r);
  if (!r.ok) {
    console.log("\nAPI not responding. Start with: pnpm --filter @digital-menu/api dev");
    process.exit(1);
  }

  // Auth: register (account only) — 409 if already registered
  r = await req("POST", "/api/v1/auth/register", {
    email: "owner@test.com",
    password: "password123",
    displayName: "Jane Owner"
  });
  expect("POST /auth/register (account only)", r, 201, [201, 409]);

  // Login to get cookie (in case register was already done)
  r = await req("POST", "/api/v1/auth/login", {
    email: "owner@test.com",
    password: "password123"
  });
  expect("POST /auth/login", r);
  if (!r.ok) {
    console.log("Login failed; cannot test protected routes.");
    process.exit(1);
  }

  // Me
  r = await req("GET", "/api/v1/auth/me");
  expect("GET /auth/me", r);

  // Ingredients (no auth)
  r = await req("GET", "/api/v1/ingredients");
  expect("GET /ingredients", r);
  if (r.data && Array.isArray(r.data) && r.data.length > 0) ids.ingredientId = r.data[0].id;

  r = await req("GET", "/api/v1/ingredients?q=garlic");
  expect("GET /ingredients?q=garlic", r);

  // Restaurants
  r = await req("GET", "/api/v1/restaurants");
  expect("GET /restaurants", r);

  r = await req("POST", "/api/v1/restaurants", {
    name: "My Restaurant",
    slug: "my-restaurant",
    description: "Optional description"
  });
  expect("POST /restaurants", r, 201, [201, 409]);
  if (r.data && r.data.id) ids.restaurantId = r.data.id;

  if (!ids.restaurantId) {
    r = await req("GET", "/api/v1/restaurants");
    if (r.data && r.data.length) ids.restaurantId = r.data[0].id;
  }

  r = await req("GET", `/api/v1/restaurants/${ids.restaurantId}`);
  expect("GET /restaurants/:id", r);

  r = await req("PATCH", `/api/v1/restaurants/${ids.restaurantId}`, {
    name: "Updated Name",
    description: "New description"
  });
  expect("PATCH /restaurants/:id", r);

  // Menus
  r = await req("GET", `/api/v1/restaurants/${ids.restaurantId}/menus`);
  expect("GET /restaurants/:id/menus", r);

  r = await req("POST", `/api/v1/restaurants/${ids.restaurantId}/menus`, {
    name: "Lunch Menu",
    displayOrder: 0
  });
  expect("POST /restaurants/:id/menus", r, 201);
  if (r.data && r.data.id) ids.menuId = r.data.id;

  r = await req("GET", `/api/v1/restaurants/${ids.restaurantId}/menus/${ids.menuId}`);
  expect("GET /restaurants/:id/menus/:menuId", r);

  r = await req("PATCH", `/api/v1/restaurants/${ids.restaurantId}/menus/${ids.menuId}`, {
    name: "Main Menu",
    isPublished: true,
    displayOrder: 0
  });
  expect("PATCH /restaurants/:id/menus/:menuId", r);

  // Sections
  r = await req("GET", `/api/v1/restaurants/${ids.restaurantId}/menus/${ids.menuId}/sections`);
  expect("GET .../sections", r);

  r = await req("POST", `/api/v1/restaurants/${ids.restaurantId}/menus/${ids.menuId}/sections`, {
    name: "Starters",
    displayOrder: 0
  });
  expect("POST .../sections", r, 201);
  if (r.data && r.data.id) ids.sectionId = r.data.id;

  r = await req("PATCH", `/api/v1/restaurants/${ids.restaurantId}/menus/${ids.menuId}/sections/${ids.sectionId}`, {
    name: "Appetizers",
    displayOrder: 0
  });
  expect("PATCH .../sections/:sectionId", r);

  // Dishes
  r = await req("GET", `/api/v1/restaurants/${ids.restaurantId}/menus/${ids.menuId}/sections/${ids.sectionId}/dishes`);
  expect("GET .../dishes", r);

  r = await req("POST", `/api/v1/restaurants/${ids.restaurantId}/menus/${ids.menuId}/sections/${ids.sectionId}/dishes`, {
    name: "Caesar Salad",
    description: "Romaine, parmesan, croutons",
    price: "9.99",
    isAvailable: true,
    displayOrder: 0
  });
  expect("POST .../dishes", r, 201);
  if (r.data && r.data.id) ids.dishId = r.data.id;

  r = await req("GET", `/api/v1/restaurants/${ids.restaurantId}/menus/${ids.menuId}/sections/${ids.sectionId}/dishes/${ids.dishId}`);
  expect("GET .../dishes/:dishId", r);

  r = await req("PATCH", `/api/v1/restaurants/${ids.restaurantId}/menus/${ids.menuId}/sections/${ids.sectionId}/dishes/${ids.dishId}`, {
    name: "Classic Caesar",
    price: "10.50",
    isAvailable: true
  });
  expect("PATCH .../dishes/:dishId", r);

  // Dish ingredients
  r = await req("GET", `/api/v1/dishes/${ids.dishId}/ingredients`);
  expect("GET /dishes/:dishId/ingredients", r);

  const ingId = ids.ingredientId ?? 1;
  r = await req("POST", `/api/v1/dishes/${ids.dishId}/ingredients`, {
    ingredientId: ingId,
    isOptional: false,
    isHidden: false,
    displayOrder: 0
  });
  expect("POST /dishes/:dishId/ingredients", r, 201);

  r = await req("GET", `/api/v1/dishes/${ids.dishId}/ingredients`);
  expect("GET /dishes/:dishId/ingredients (after add)", r);

  // Logout
  r = await req("POST", "/api/v1/auth/logout");
  expect("POST /auth/logout", r, 204);

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
