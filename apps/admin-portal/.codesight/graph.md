# Dependency Graph

## Most Imported Files (change these carefully)

- `src\lib\api-client.ts` — imported by **7** files
- `src\components\ui\button.tsx` — imported by **5** files
- `src\components\ui\input.tsx` — imported by **5** files
- `src\components\ui\card.tsx` — imported by **5** files
- `src\components\utils.ts` — imported by **3** files
- `src\routes\login.tsx` — imported by **2** files
- `src\routes\register.tsx` — imported by **2** files
- `src\routes\menu-builder.tsx` — imported by **2** files
- `src\auth-context.tsx` — imported by **2** files
- `src\components\confirm-dialog.tsx` — imported by **2** files
- `src\routes\restaurants.tsx` — imported by **1** files
- `src\routes\meta-ingredients.tsx` — imported by **1** files
- `src\App.tsx` — imported by **1** files

## Import Map (who imports what)

- `src\lib\api-client.ts` ← `src\App.tsx`, `src\auth-context.tsx`, `src\routes\login.test.tsx`, `src\routes\login.tsx`, `src\routes\register.test.tsx` +2 more
- `src\components\ui\button.tsx` ← `src\routes\login.tsx`, `src\routes\menu-builder.tsx`, `src\routes\meta-ingredients.tsx`, `src\routes\register.tsx`, `src\routes\restaurants.tsx`
- `src\components\ui\input.tsx` ← `src\routes\login.tsx`, `src\routes\menu-builder.tsx`, `src\routes\meta-ingredients.tsx`, `src\routes\register.tsx`, `src\routes\restaurants.tsx`
- `src\components\ui\card.tsx` ← `src\routes\login.tsx`, `src\routes\menu-builder.tsx`, `src\routes\meta-ingredients.tsx`, `src\routes\register.tsx`, `src\routes\restaurants.tsx`
- `src\components\utils.ts` ← `src\components\ui\button.tsx`, `src\components\ui\card.tsx`, `src\components\ui\input.tsx`
- `src\routes\login.tsx` ← `src\App.tsx`, `src\routes\login.test.tsx`
- `src\routes\register.tsx` ← `src\App.tsx`, `src\routes\register.test.tsx`
- `src\routes\menu-builder.tsx` ← `src\App.tsx`, `src\routes\menu-builder.test.tsx`
- `src\auth-context.tsx` ← `src\App.tsx`, `src\main.tsx`
- `src\components\confirm-dialog.tsx` ← `src\routes\menu-builder.tsx`, `src\routes\meta-ingredients.tsx`
