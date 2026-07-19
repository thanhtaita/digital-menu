# Goal: diner discovery

## What this is

Diner-facing capability for finding food across the whole platform, not just within one restaurant's menu
that a diner already navigated to. Distinct from the other goals - it's neither dietary safety
([`dietary-safety-and-nutrition`](../dietary-safety-and-nutrition/README.md)) nor restaurant-admin tooling
([`restaurant-admin-portal`](../restaurant-admin-portal/README.md)) nor cross-cutting hardening
([`platform-hardening`](../platform-hardening/README.md)) - it's a new diner-visible way to reach content.

## Why it matters

Before this goal, a diner could only browse dishes by first picking a restaurant from the homepage list and
opening its menu - there was no way to ask "does anyone on this platform serve X" across the whole catalog.

## Status

One feature shipped: platform-wide search.

## Features

- [`features/platform-wide-search/`](./features/platform-wide-search/README.md) - search dishes,
  ingredients, and restaurants across the whole catalog from anywhere in the diner app.
