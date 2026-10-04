# Cooks Nook — Backend Scaffold

Covers Task 1 (tech stack setup) and Task 2 (database schema design) from the
project proposal.

## Stack

- **Runtime:** Node.js + Express
- **Database:** PostgreSQL
- **ORM:** Prisma (`prisma/schema.prisma`)
- **Auth:** JWT + bcrypt (to be implemented in Task 3)
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
2. Install [PostgreSQL](https://www.postgresql.org/download/) locally, or spin
   up a free instance on [Neon](https://neon.tech) or [Railway](https://railway.app)
   (recommended — saves you a local install and matches what you'll deploy to).
3. In this folder:
   ```bash
   npm install
   cp .env.example .env
   # edit .env with your real DATABASE_URL and JWT_SECRET
   npx prisma migrate dev --name init
   ```
4. `npx prisma studio` opens a browser-based GUI to inspect your tables —
   useful for sanity-checking the schema before you build the API routes.
5. `npm run dev` starts the API on `http://localhost:3001` (auto-restarts on
   file changes). Visit `http://localhost:3001/health` to confirm it's up.

## Authentication (Task 3)

Implemented in `src/routes/auth.js`:

- `POST /auth/register` — body `{ email, password }`, returns `{ user, token }`.
  Rejects duplicate emails and passwords under 8 characters.
- `POST /auth/login` — body `{ email, password }`, returns `{ user, token }`.
  Returns the same error for a wrong password and a nonexistent email, so
  login can't be used to check which emails have accounts.
- `GET /me` — protected example route. Requires `Authorization: Bearer <token>`
  and returns the authenticated user.

Passwords are hashed with bcrypt (12 salt rounds) before being stored — the
plaintext password is never saved. Tokens are signed JWTs valid for 7 days.

### Try it once the server is running

```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# copy the "token" from the response, then:
curl http://localhost:3001/me \
  -H "Authorization: Bearer <paste token here>"
```

## Next step (Task 4)

Core recipe CRUD — create/read/update/delete endpoints for a user's own
recipes, scoped by the authenticated user's id.
