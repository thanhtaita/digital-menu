# Dependency Graph

## Most Imported Files (change these carefully)

- `src\lib\db.ts` — imported by **13** files
- `src\middleware\auth.ts` — imported by **9** files
- `src\lib\restaurant-access.ts` — imported by **7** files
- `src\lib\uploads.ts` — imported by **2** files
- `src\lib\auth.ts` — imported by **2** files
- `src\routes\health.ts` — imported by **1** files
- `src\routes\ingredients.ts` — imported by **1** files
- `src\routes\auth.ts` — imported by **1** files
- `src\routes\restaurants.ts` — imported by **1** files
- `src\routes\menus.ts` — imported by **1** files
- `src\routes\sections.ts` — imported by **1** files
- `src\routes\dishes.ts` — imported by **1** files
- `src\routes\dish-ingredients.ts` — imported by **1** files
- `src\routes\public-menu.ts` — imported by **1** files
- `src\routes\restrictions.ts` — imported by **1** files
- `src\routes\qr.ts` — imported by **1** files
- `src\routes\ai-suggestions.ts` — imported by **1** files
- `src\app.ts` — imported by **1** files
- `src\services\ai-ingredient-suggestion.ts` — imported by **1** files

## Import Map (who imports what)

- `src\lib\db.ts` ← `src\lib\auth.ts`, `src\lib\restaurant-access.ts`, `src\routes\auth.ts`, `src\routes\dish-ingredients.ts`, `src\routes\dishes.ts` +8 more
- `src\middleware\auth.ts` ← `src\routes\ai-suggestions.ts`, `src\routes\dish-ingredients.ts`, `src\routes\dishes.ts`, `src\routes\ingredients.ts`, `src\routes\menus.ts` +4 more
- `src\lib\restaurant-access.ts` ← `src\routes\ai-suggestions.ts`, `src\routes\dish-ingredients.ts`, `src\routes\dishes.ts`, `src\routes\menus.ts`, `src\routes\qr.ts` +2 more
- `src\lib\uploads.ts` ← `src\app.ts`, `src\routes\dishes.ts`
- `src\lib\auth.ts` ← `src\middleware\auth.ts`, `src\routes\ingredients.ts`
- `src\routes\health.ts` ← `src\app.ts`
- `src\routes\ingredients.ts` ← `src\app.ts`
- `src\routes\auth.ts` ← `src\app.ts`
- `src\routes\restaurants.ts` ← `src\app.ts`
- `src\routes\menus.ts` ← `src\app.ts`
