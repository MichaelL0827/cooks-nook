import { Router } from "express";
import prisma from "../lib/prisma.js";
import requireAuth from "../middleware/requireAuth.js";

const router = Router();

const ingredientNamePattern = /^[\p{L}]+(?:[ '-][\p{L}]+)*$/u;
const tagNamePattern = /^[\p{L}\p{N}]+(?:[ '-][\p{L}\p{N}]+)*$/u;

// Every recipe route requires a logged-in user, and every query below is
// scoped to req.userId so one user can never read/edit/delete another user's recipes.
router.use(requireAuth);

const recipeInclude = {
  steps: { orderBy: { stepNumber: "asc" } },
  ingredients: { include: { ingredient: true } },
  tags: { include: { tag: true } },
};

function validateRecipeBody(body) {
  const errors = [];
  if (typeof body.name !== "string" || body.name.trim().length === 0) {
    errors.push("name is required.");
  }
  if (body.ingredients && !Array.isArray(body.ingredients)) {
    errors.push("ingredients must be an array.");
  }
  if (Array.isArray(body.ingredients)) {
    body.ingredients.forEach((ingredient, index) => {
      const name = ingredient?.name;
      if (
        typeof name !== "string" ||
        name.trim().length === 0 ||
        !ingredientNamePattern.test(name.trim())
      ) {
        errors.push(
          `ingredients[${index}].name must contain words using letters, spaces, hyphens, or apostrophes.`,
        );
      }
    });
  }
  if (body.steps && !Array.isArray(body.steps)) {
    errors.push("steps must be an array.");
  }
  if (Array.isArray(body.steps)) {
    body.steps.forEach((step, index) => {
      if (typeof step?.instruction !== "string" || step.instruction.trim().length === 0) {
        errors.push(`steps[${index}].instruction must be a non-empty string.`);
      }
    });
  }
  if (body.tags && !Array.isArray(body.tags)) {
    errors.push("tags must be an array.");
  }
  if (Array.isArray(body.tags)) {
    body.tags.forEach((tag, index) => {
      if (typeof tag !== "string" || tag.trim().length === 0 || !tagNamePattern.test(tag.trim())) {
        errors.push(
          `tags[${index}] must contain words using letters, numbers, spaces, hyphens, or apostrophes.`,
        );
      }
    });
  }
  for (const field of ["servings", "prepMinutes", "cookMinutes"]) {
    if (body[field] !== undefined && body[field] !== null) {
      if (!Number.isInteger(body[field]) || body[field] < 0 || (field === "servings" && body[field] === 0)) {
        errors.push(`${field} must be a non-negative integer${field === "servings" ? " greater than zero" : ""}.`);
      }
    }
  }
  return errors;
}

// Ingredient names are unique in the master Ingredient table. findOrCreate
// so "Flour" typed on two different recipes reuses the same row instead of
// creating duplicates.
async function findOrCreateIngredient(tx, name) {
  const trimmed = name.trim();
  return tx.ingredient.upsert({
    where: { name: trimmed },
    update: {},
    create: { name: trimmed },
  });
}

async function findOrCreateTag(tx, name) {
  const trimmed = name.trim();
  return tx.tag.upsert({
    where: { name: trimmed },
    update: {},
    create: { name: trimmed },
  });
}

async function replaceRecipeTags(tx, recipeId, tags) {
  const uniqueTags = [...new Set(tags.map((tag) => tag.trim()))];
  for (const tagName of uniqueTags) {
    const tag = await findOrCreateTag(tx, tagName);
    await tx.recipeTag.create({ data: { recipeId, tagId: tag.id } });
  }
}

// GET /recipes — list the current user's recipes (summary fields only;
// use GET /recipes/:id for full detail with steps/ingredients/tags).
router.get("/", async (req, res) => {
  const recipes = await prisma.recipe.findMany({
    where: { userId: req.userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      servings: true,
      prepMinutes: true,
      cookMinutes: true,
      updatedAt: true,
      tags: { include: { tag: true } },
    },
  });
  res.json({ recipes });
});

// GET /recipes/:id — full detail for one of the current user's recipes.
router.get("/:id", async (req, res) => {
  const recipe = await prisma.recipe.findFirst({
    where: { id: req.params.id, userId: req.userId },
    include: recipeInclude,
  });

  if (!recipe) {
    return res.status(404).json({ error: "Recipe not found." });
  }
  res.json({ recipe });
});

// POST /recipes
// body: { name, servings?, prepMinutes?, cookMinutes?,
//         ingredients?: [{ name, quantity?, unit?, notes? }],
//         steps?: [{ instruction }] }
router.post("/", async (req, res) => {
  const errors = validateRecipeBody(req.body ?? {});
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(" ") });
  }

  const { name, servings, prepMinutes, cookMinutes, ingredients = [], steps = [], tags = [] } = req.body;

  const recipe = await prisma.$transaction(async (tx) => {
    const created = await tx.recipe.create({
      data: {
        name: name.trim(),
        servings: servings ?? null,
        prepMinutes: prepMinutes ?? null,
        cookMinutes: cookMinutes ?? null,
        userId: req.userId,
        steps: {
          create: steps.map((step, index) => ({
            stepNumber: index + 1,
            instruction: step.instruction,
          })),
        },
      },
    });

    // Ingredients are linked after creation since each one needs its own
    // findOrCreate against the shared Ingredient table.
    for (const item of ingredients) {
      const ingredient = await findOrCreateIngredient(tx, item.name);
      await tx.recipeIngredient.create({
        data: {
          recipeId: created.id,
          ingredientId: ingredient.id,
          quantity: item.quantity ?? null,
          unit: item.unit ?? null,
          notes: item.notes ?? null,
        },
      });
    }

    await replaceRecipeTags(tx, created.id, tags);

    return tx.recipe.findUnique({ where: { id: created.id }, include: recipeInclude });
  });

  res.status(201).json({ recipe });
});

// PUT /recipes/:id — full update. Replaces steps and ingredients wholesale
// (simpler and safer than diffing individual items for a v1).
router.put("/:id", async (req, res) => {
  const existing = await prisma.recipe.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!existing) {
    return res.status(404).json({ error: "Recipe not found." });
  }

  const errors = validateRecipeBody(req.body ?? {});
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(" ") });
  }

  const { name, servings, prepMinutes, cookMinutes, ingredients = [], steps = [], tags = [] } = req.body;

  const recipe = await prisma.$transaction(async (tx) => {
    await tx.step.deleteMany({ where: { recipeId: existing.id } });
    await tx.recipeIngredient.deleteMany({ where: { recipeId: existing.id } });
    await tx.recipeTag.deleteMany({ where: { recipeId: existing.id } });

    await tx.recipe.update({
      where: { id: existing.id },
      data: {
        name: name.trim(),
        servings: servings ?? null,
        prepMinutes: prepMinutes ?? null,
        cookMinutes: cookMinutes ?? null,
        steps: {
          create: steps.map((step, index) => ({
            stepNumber: index + 1,
            instruction: step.instruction,
          })),
        },
      },
    });

    for (const item of ingredients) {
      const ingredient = await findOrCreateIngredient(tx, item.name);
      await tx.recipeIngredient.create({
        data: {
          recipeId: existing.id,
          ingredientId: ingredient.id,
          quantity: item.quantity ?? null,
          unit: item.unit ?? null,
          notes: item.notes ?? null,
        },
      });
    }

    await replaceRecipeTags(tx, existing.id, tags);

    return tx.recipe.findUnique({ where: { id: existing.id }, include: recipeInclude });
  });

  res.json({ recipe });
});

// DELETE /recipes/:id
router.delete("/:id", async (req, res) => {
  const existing = await prisma.recipe.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!existing) {
    return res.status(404).json({ error: "Recipe not found." });
  }

  // onDelete: Cascade on Step/RecipeIngredient/RecipeTag (set in schema.prisma)
  // means this alone cleans up related rows.
  await prisma.recipe.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
