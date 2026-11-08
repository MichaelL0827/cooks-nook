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

## 2026-11-07 - Recipe editor and local providers

- Reworked recipe step details into auto-expanding text areas so longer instructions remain readable while editing.
- Corrected the ingredient-row grid so quantity, unit, notes, and remove controls remain usable without wrapping incorrectly.
- Adjusted the editor proportions to give the Ingredients panel less space and the Steps panel more reading room, with responsive behavior on smaller screens.
- Added optional TheMealDB recipe lookup by name, including exact-match selection, measurement parsing, ten-minute caching, editable draft conversion, and fallback behavior when the provider is unavailable.
- Added local Ollama support for recipe suggestions and the cooking assistant through the `/api/chat` endpoint with structured JSON schemas.
- Added provider configuration for `LLM_PROVIDER`, `OLLAMA_API_URL`, and `OLLAMA_MODEL`, while keeping the existing OpenAI-compatible provider path available.
- Added opt-in LLM diagnostics for raw suggestion responses, latency, usage data, and provider errors; diagnostics remain disabled by default.
- Added TheMealDB and Ollama fake-provider tests and kept automated tests deterministic by disabling external recipe lookup in the test server.
- Expanded regression coverage to 40 passing tests.
