# Cooks Nook — Backend Scaffold

Covers Tasks 1–4 from the project proposal: tech stack setup, database
schema design, user authentication, and core recipe CRUD.

## Stack

- **Runtime:** Node.js + Express
- **Database:** PostgreSQL
- **ORM:** Prisma (`prisma/schema.prisma`)
- **Auth:** JWT + bcrypt
- **Frontend (separate project):** React (Vite)

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

- `GET /recipes` — list the current user's recipes (summary fields).
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

## Next step (Task 5)

Recipe organization and search — tags, categories, and filtering across a
user's saved recipes.
