# Changelog

## 2026-10-03 — Project setup

- Added the initial project configuration and environment-template updates.

## 2026-10-17 — Cookbook prototype

- Added the browser cookbook prototype and authenticated recipe CRUD.
- Added user-scoped recipe ownership checks and validation for recipe data.
- Added the initial automated tests for authentication, health checks, and recipes.

## 2026-10-21 — Recipe organization

- Added recipe tags, name search, tag filtering, and ingredient filtering.
- Added regression tests for the recipe filters.

## 2026-10-30 — Ingredient maker and cooking assistant

- Added `POST /recipes/suggest` with an offline fallback and optional structured LLM output.
- Added editable ingredient, step, tag, assumption, and substitution drafts.
- Added provider-output repair for parenthetical notes, comma notes, quantities, units, and unsupported ingredient characters.
- Added input limits and per-user rate limiting.
- Added the protected, recipe-grounded `POST /recipes/assistant` endpoint.
- Added offline explanations, safety notes, follow-up questions, optional LLM responses, and the cooking assistant panel.

## 2026-10-30 — Allergens and substitutions

- Added persisted account allergen settings through `/me/allergens`.
- Added database-backed substitution lookup for saved recipes.
- Added normalized allergen synonyms, including generic nuts, soy, shrimp, and seafood.
- Added food-form-specific catalog entries and matched-recipe-ingredient reporting.
- Added potential-allergen flags and explicit no-catalog-data assumptions for allergens without substitution data.
- Added startup catalog synchronization that removes stale mappings while preserving general-purpose substitutions.
- Restored the original applied unique-index migration and removed the temporary cleanup migration from the repository.

## 2026-10-30 — Reliability and tests

- Moved Express error handling after all routes and preserved 400/413 statuses.
- Wrapped asynchronous route handlers with centralized rejection forwarding.
- Added fake-provider tests for both live LLM paths without requiring an API key.
- Expanded regression coverage to 36 passing tests.
