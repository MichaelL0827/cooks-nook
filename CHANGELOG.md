# Changelog

## 2026-10-30

### Recipe management and search

- Added authenticated recipe CRUD with user-scoped ownership checks.
- Added recipe tags, name search, tag filtering, and ingredient filtering.
- Added validation for recipe names, ingredients, steps, tags, and numeric fields.
- Preserved ingredient notes in the browser editor.

### Ingredient maker

- Added `POST /recipes/suggest` with offline fallback and optional structured LLM output.
- Added editable ingredient, step, tag, assumption, and substitution drafts.
- Added provider-output repair for parenthetical notes, comma notes, quantities, units, and unsupported ingredient characters.
- Added input limits and per-user rate limiting.
- Added a limited-catalog safety caveat when allergen checks are relevant.

### Allergens and substitutions

- Added persisted account allergen settings through `/me/allergens`.
- Added database-backed substitution lookup for saved recipes.
- Added normalized allergen synonyms, including generic nuts, soy, shrimp, and seafood.
- Added food-form-specific catalog entries and matched-recipe-ingredient reporting.
- Added potential-allergen flags and explicit no-catalog-data assumptions for allergens without substitution data.
- Added startup catalog synchronization that removes stale mappings and uses a unique compound constraint.

### Cooking assistant

- Added the protected, recipe-grounded `POST /recipes/assistant` endpoint.
- Added offline explanations, safety notes, follow-up questions, and optional LLM responses.
- Added the cooking assistant panel to the recipe detail view.
- Added the same per-user rate limiting and async error handling used by the ingredient maker.

### Reliability, migrations, and tests

- Moved Express error handling after all routes and preserved 400/413 statuses.
- Wrapped all asynchronous route handlers with centralized rejection forwarding.
- Kept the applied unique-index migration byte-stable and moved cleanup into a separate migration.
- Added fake-provider tests for both live LLM paths without requiring an API key.
- Expanded regression coverage to 36 passing tests.
