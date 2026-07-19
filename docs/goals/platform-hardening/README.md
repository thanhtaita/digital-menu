# Goal: platform hardening

## What this is

Non-feature, cross-cutting work that makes the platform safer or more robust to operate without changing
what it does for users - abuse/cost protection, reliability, security posture. Distinct from the
product-facing goals ([`dietary-safety-and-nutrition`](../dietary-safety-and-nutrition/README.md),
[`restaurant-admin-portal`](../restaurant-admin-portal/README.md)) because nothing here is a diner- or
admin-visible capability; it's infrastructure protecting the capabilities that already exist.

## Why it matters

The AI chat and ingredient-search endpoints call paid LLM providers and run fuzzy-match queries with no
cost or abuse ceiling before the feature below shipped - any authenticated (or even unauthenticated, via
IP fallback) caller could drive unbounded LLM spend or scrape the ingredient dictionary via repeated fuzzy
search.

## Status

One hardening pass shipped (rate limiting on the highest-risk routes); most of the API surface remains
unthrottled by design scope, not oversight - see
[`docs/architecture/known-gaps.md`](../../architecture/known-gaps.md).

## Features

- [`features/llm-and-search-rate-limiting/`](./features/llm-and-search-rate-limiting/README.md) -
  per-session (falling back to per-IP) rate limits on `/chat`, `/chat/stream`,
  `/dishes/suggest-ingredients`, and `GET /ingredients`.
