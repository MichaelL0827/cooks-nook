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

## 2026-11-14 - AI reliability, evaluation, and attribution

- Split the reviewed work into structured commits:
  - `4b7fb1a` Normalize repository line endings.
  - `78667ed` Standardize AI helper output.
  - `afaa2c2` Preserve TheMealDB attribution.
  - `ddfdde1` Harden provider retries and fallback behavior.
- Pushed commits `4b7fb1a` through `ddfdde1` to `origin/main`.
- Added the 20-case evaluation script with source validation, rate-limit spacing, allergen conflict and acknowledgement metrics, safety checks, latency reporting, and summary output.
- Added generated evaluation-result exclusion to `.gitignore`.
- The evaluation script is ready to run against Ollama with `MEALDB_ENABLED=false` and an explicit `EVAL_LABEL`.
- Documented the evaluation workflow, provider configuration, timeout setting, fallback reasons, and evaluation-specific environment variables in the README and `.env.example`.

## 2026-11-19 - Week 10 assistant experience

- Added stateless multi-turn assistant requests with validated conversation history limited to six messages.
- Added optional recipe-step focus so users can ask directly about a specific instruction.
- Added a chat transcript, follow-up question chips, and “Ask about this step” controls to the recipe detail view.
- Added `scripts/evaluate-assistant.js` for a 15-case assistant baseline covering vague instructions, follow-ups, substitutions, safety, and prompt-injection resistance.
- Added an allergen-aware recipe-list filter that hides recipes containing ingredients matching the user’s saved restrictions.
- Added regression tests for assistant history validation, provider message ordering, step focus, and allergen filtering.
- Expanded automated regression coverage to 59 passing tests.

## 2026-11-19 - Week 10 regression fixes and evaluation hardening

- Fixed the recipe-detail Delete button so it sends the selected recipe ID.
- Hardened assistant evaluation cleanup for empty `204` responses and restored saved allergens after evaluation.
- Added behavior checks for safety, allergen handling, off-topic requests, prompt injection, substitutions, and step explanations; results now preserve answer text and notes for manual review.
- Centralized assistant conversation-context and step-focus prompt text so prompt-version logging reflects the complete setup.
- Added offline step-focused fallback responses and expanded OpenAI-compatible provider history tests.
- Added allergen-filter caveat text, assistant live-region accessibility, step-button labels, and request locking to prevent overlapping chat requests.
- Updated README documentation for assistant evaluation, conversation fields, and allergen filtering.
- Expanded automated regression coverage to 61 passing tests.

## 2026-11-19 - Final assistant evaluation polish

- Added cleanup protection so evaluation results remain available when restoration or deletion encounters a server failure.
- Hardened the manual-review CSV with UTF-8 compatibility, formula-injection protection, source and fallback metadata, and review columns.
- Tightened the technique and follow-up behavior heuristics while retaining manual accuracy and helpfulness scoring as the evaluation evidence.
- Improved assistant transcript scrolling, focus restoration, and empty-state spacing.

## 2026-11-19 - Evaluation review improvements

- Tightened assistant evaluation behavior checks so responses must demonstrate relevant explanations and use conversation context.
- Improved allergen acknowledgement scoring to avoid counting ingredient names alone as model acknowledgement.
- Added cleanup warnings when evaluation allergen restoration or temporary recipe deletion fails.
- Added `evaluation/assistant-review.csv` output with answer text and blank accuracy/helpfulness columns for manual 1–3 scoring.
- Improved assistant keyboard focus after requests and changed transcript updates to append new messages for better screen-reader behavior.
