const STORAGE_KEY = "admin:lastRestaurantId";

export function rememberRestaurantForBuilder(restaurantId: number): void {
  if (Number.isFinite(restaurantId) && restaurantId > 0) {
    sessionStorage.setItem(STORAGE_KEY, String(restaurantId));
  }
}

export function getLastRestaurantForBuilder(): number | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}
