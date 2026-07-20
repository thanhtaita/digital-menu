# Goal: restaurant admin portal

## What this is

Everything restaurant admins use in `apps/admin-portal` to run their side of the platform day-to-day:
menu building, ingredient tagging, and the operational conveniences around a live restaurant (like getting
diners onto the menu in the first place).

## Why it matters

The project goal (see [`docs/index.md`](../../index.md)) starts with "restaurant admins build menus and
tag dishes with ingredients from a shared global dictionary." The bulk of that (menu/section/dish CRUD,
media galleries, ingredient search/tag/detach, ingredient-request flow) predates this docs system. The
feature backfilled here is a smaller, self-contained addition to that same admin-facing surface.

## Status

Ongoing - the admin portal is under active development. Only the single feature below has a task-log
entry in this system; the rest of the admin portal's existing capability is documented in `CLAUDE.md`'s
former "Features implemented" section content, now folded into [`docs/index.md`](../../index.md).

## Features

- [`features/qr-code-display/`](./features/qr-code-display/README.md) - view/download the diner-menu QR
  code the API already generates, directly from the restaurant list.

Earlier admin-portal work (menu builder, ingredient tagging UI, translations CRUD, superadmin ingredient
catalog) predates this docs system and is not backfilled here.
