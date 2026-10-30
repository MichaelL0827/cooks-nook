# Cooks Nook

An AI-assisted cookbook prototype with authenticated recipe CRUD, search and
filtering, persisted allergen settings, database-backed substitutions, an
ingredient draft generator, and a recipe-grounded cooking assistant.

## Stack

- **Runtime:** Node.js + Express
- **Database:** PostgreSQL
- **ORM:** Prisma (`prisma/schema.prisma`)
- **Auth:** JWT + bcrypt
- **Frontend:** browser prototype served by Express from `frontend/`

## Schema overview

- `User` — account + auth info
- `Recipe` — belongs to a user; has servings/prep/cook time
- `Step` — ordered instructions for a recipe
- `Ingredient` — master ingredient list, shared across all recipes
- `RecipeIngredient` — join table holding the quantity/unit of an ingredient
  *within* a specific recipe
- `Tag` / `RecipeTag` — categorization and filtering
- `Allergen` / `UserAllergen` — a user's declared dietary restrictions
- `IngredientSubstitute` — suggested swap for an ingredient, optionally tied
  to a specific allergen (e.g., butter → olive oil for a dairy restriction)

## Getting set up in VS Code

1. Install extensions: **Prisma** (by Prisma) and **ESLint**.
2. Install PostgreSQL locally (with pgAdmin 4), or use a free hosted
   instance on [Neon](https://neon.tech) or [Railway](https://railway.app).
3. In this folder:
   ```bash
   npm install
   cp .env.example .env
   # edit .env with your real DATABASE_URL and JWT_SECRET
   npx prisma migrate dev --name init
   ```
4. `npx prisma studio` opens a browser-based GUI to inspect your tables.
5. `npm run dev` starts the API on `http://localhost:3001` (auto-restarts on
   file changes). Visit `http://localhost:3001/health` to confirm it's up.

## Authentication (Task 3)

- `POST /auth/register` — body `{ email, password }`, returns `{ user, token }`.
- `POST /auth/login` — body `{ email, password }`, returns `{ user, token }`.
- `GET /me` — protected example route. Requires `Authorization: Bearer <token>`.

Passwords are hashed with bcrypt (12 salt rounds). Tokens are signed JWTs
valid for 7 days.

## Recipe CRUD (Task 4)

All routes below live under `/recipes`, require `Authorization: Bearer <token>`,
and are scoped to the logged-in user — one user can never read, edit, or
delete another user's recipes.

- `GET /recipes` — list the current user's recipes (summary fields). Optional
  query filters include `search`, `tag`, and `ingredient`, such as
  `/recipes?tag=dinner&ingredient=chicken`.
- `GET /recipes/:id` — full detail for one recipe, including its steps,
  ingredients, and tags.
- `POST /recipes` — create a recipe. Body:
  ```json
  {
    "name": "Spaghetti Carbonara",
    "servings": 4,
    "prepMinutes": 10,
    "cookMinutes": 20,
    "ingredients": [
      { "name": "Spaghetti", "quantity": 1, "unit": "lb" },
      { "name": "Eggs", "quantity": 4 },
      { "name": "Parmesan", "quantity": 1, "unit": "cup", "notes": "grated" }
    ],
    "steps": [
      { "instruction": "Boil the pasta until al dente." },
      { "instruction": "Whisk eggs and parmesan together." },
      { "instruction": "Toss hot pasta with the egg mixture off heat." }
    ],
    "tags": ["dinner", "quick meals"]
  }
  ```
  Ingredient names are matched against a shared `Ingredient` table — typing
  "Eggs" on two different recipes reuses the same ingredient row rather than
  creating duplicates.
  Tags are matched against a shared `Tag` table and can be used to organize
  recipes. Duplicate tag names in one request are ignored.
- `PUT /recipes/:id` — full update. Same body shape as `POST`; steps and
  ingredients are replaced wholesale (not merged/diffed).
- `DELETE /recipes/:id` — deletes a recipe and its steps/ingredient links.

## Dietary restrictions and substitutions

- `GET /me/allergens` — returns the authenticated user's persisted allergen settings.
- `PUT /me/allergens` — replaces the user's allergen settings. Supported values include `dairy`, `peanuts`, `tree nuts`, `eggs`, `gluten`, `soy`, `shellfish`, `fish`, and `sesame`; common synonyms are normalized.
- `GET /recipes/:id/substitutions` — returns database-backed substitutions for the saved recipe and the user's persisted allergens.
- The substitution catalog is stored in the `Allergen`, `UserAllergen`, `Ingredient`, and `IngredientSubstitute` tables. Shared aliases cover common forms such as `whole milk`, `unsalted butter`, `almonds`, `walnuts`, `pasta`, `flour tortillas`, and `soy sauce`; matching is exact against those aliases so broad substrings do not create unsafe false matches.
- Catalog synchronization removes mappings from older catalog versions so stale bases cannot continue producing suggestions.
- Saved-recipe checks return both possible allergen flags and substitutions. A missing substitution is explicitly presented as unknown rather than as evidence that the recipe is safe.

## Ingredient Maker

- `POST /recipes/suggest` — protected route that accepts a recipe name,
  servings, allergens, and available ingredients, then returns an editable
  ingredient and step draft. The draft is not saved until the user submits it
  through `POST /recipes`.
- When `LLM_API_KEY` is configured, the route uses structured JSON output from
  the configured LLM provider. When no key is configured, it uses an offline
  fallback for local development and testing.
- When allergens are provided, the response includes editable substitution
  recommendations with a reason and a caution instead of claiming that a
  substitute is automatically safe.
- Draft requests are bounded and rate-limited per authenticated user. Provider
  ingredient names are sanitized before they reach recipe CRUD validation.
- The substitution catalog is initialized once at application startup and uses
  a unique ingredient/substitute/allergen constraint to prevent duplicate rows.
- Gluten is used as a conservative starter category for wheat-containing
  ingredients; it is not a medical claim that wheat allergy and celiac disease
  are identical.

## Cooking Assistant

- `POST /recipes/assistant` — protected route that accepts `{ recipeId, question }` and returns an answer grounded in the user's saved recipe.
- The assistant explains vague cooking language, answers technique questions, and provides cautious substitution guidance with food-safety notes.
- It uses the configured LLM provider when available and an offline fallback when `LLM_OFFLINE_MODE=true` or no provider key is configured.

### Try it

```bash
# Create a recipe (replace <token> with a real one from /auth/login)
curl -X POST http://localhost:3001/recipes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"Toast","ingredients":[{"name":"Bread","quantity":2,"unit":"slices"}],"steps":[{"instruction":"Toast the bread."}]}'

# List your recipes
curl http://localhost:3001/recipes -H "Authorization: Bearer <token>"
```

(On Windows PowerShell, use `curl.exe` and escape inner quotes, or use
`Invoke-RestMethod` — see chat history for examples.)

## Development status

The local prototype is covered by automated API, ownership, validation, offline
fallback, and fake-provider tests. Live LLM behavior requires a configured
provider key; local development defaults to the offline path.
