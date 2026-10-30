# Changelog

## 2026-10-30

### Week 7 Cooking Assistant

- Added the protected `POST /recipes/assistant` endpoint.
- Grounded assistant responses in the authenticated user's saved recipe.
- Added an offline fallback for local development and an optional LLM provider path.
- Added safety notes and follow-up questions to assistant responses.
- Added a cooking assistant panel to the recipe detail view.
- Added tests for authentication, recipe ownership, validation, and offline answers.

### Week 7 Ingredient Maker Improvements

- Added structured allergen-aware substitution recommendations for common dairy, nut, egg, and gluten restrictions.
- Added a reason and caution to each substitution recommendation.
- Displayed substitution recommendations in the generated recipe draft message.
- Verified that generated drafts can be edited and saved through the existing recipe CRUD system.
- Expanded the automated test suite to 27 passing tests.

### Review Fixes

- Relabeled the cooking assistant work as Week 7 so the changelog agrees with the Week 6 status report.
- Connected persisted allergens and ingredient substitutions to the existing Prisma tables.
- Added saved-recipe substitution lookup and account-level allergen settings.
- Replaced broad substring matching with normalized exact ingredient matching.
- Added input limits, per-user suggestion rate limiting, provider-name sanitization, and ingredient-note preservation in the editor.
- Expanded regression coverage to 29 passing tests.

### Review Follow-up

- Added shared allergen synonym normalization, including peanut, milk, lactose, wheat, egg, and nut aliases.
- Expanded substitution aliases and added potential-allergen flags plus an explicit no-known-substitution warning.
- Moved catalog synchronization to application startup and added a unique compound database constraint.
- Added the same prunable per-user rate limiter to the cooking assistant and ingredient maker.
- Added async error forwarding for the assistant, suggestions, substitutions, and account-preference routes.
- Added fake-provider tests for both live LLM paths, including ingredient repair and parenthetical notes.
- Expanded regression coverage to 35 passing tests.
