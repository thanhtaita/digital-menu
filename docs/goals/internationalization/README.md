# Goal: internationalization

## What this is

Making diner-facing dish/ingredient content available in the diner's own language, without requiring a
restaurant admin to manually type a translation for every locale before it's usable. Distinct from the
other goals - it's not dietary safety, admin tooling, discovery, or cross-cutting hardening; it's about
who can *read* the menu at all.

## Why it matters

The platform already had a fully-built manual-translation system (`dish_translations`/
`ingredient_translations` tables, admin-portal CRUD) that the diner-facing public menu endpoint never
actually read - restaurants could type translations that no diner would ever see. Requiring every
restaurant to hand-translate every dish into every supported language before it's usable is also an
unrealistic bar for a small restaurant to clear on day one.

## Status

One feature shipped: AI auto-translation, layered on top of the pre-existing manual system (which stays
untouched and still wins whenever a human has translated something).

## Features

- [`features/ai-auto-translation/`](./features/ai-auto-translation/README.md) - lazy, cached,
  AI-generated translations for dish/ingredient content, with the manual system taking precedence
  whenever a human translation exists.
