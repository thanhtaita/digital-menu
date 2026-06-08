# Libraries

- `src\components\utils.ts` — function cn: (...inputs) => void
- `src\lib\api-client.ts`
  - function apiLogin: (email, password) => void
  - function apiRegister: (input) => void
  - function apiMe: () => Promise<CurrentUser | null>
  - function apiLogout: () => void
  - function apiListRestaurants: () => Promise<Restaurant[]>
  - function apiListMenus: (restaurantId) => Promise<Menu[]>
  - _...52 more_
- `src\lib\last-restaurant.ts` — function rememberRestaurantForBuilder: (restaurantId) => void, function getLastRestaurantForBuilder: () => number | null
