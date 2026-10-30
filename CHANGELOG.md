# Changelog

## 2026-10-30

### Week 6 Cooking Assistant

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
