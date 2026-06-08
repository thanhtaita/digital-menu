# Libraries

- `src\lib\api-client.ts`
  - function apiMe: () => Promise<CurrentUser | null>
  - function apiLogin: (email, password) => Promise<
  - function apiRegister: (input) => Promise<
  - function apiLogout: () => Promise<void>
  - function apiGetRestrictions: () => Promise<RestrictionResponse[]>
  - function apiAddRestriction: (input) => Promise<RestrictionResponse>
  - _...3 more_
- `src\lib\image-url.ts` — function getApiOrigin: () => string, function resolvePublicImageUrl: (url) => string | undefined
- `src\lib\restriction-engine.ts`
  - function getDishStatus: (restrictions, dishIngredients) => DishStatus
  - function getMatchingRestrictions: (restrictions, dishIngredients) => RestrictionResponse[]
  - type DishStatus
