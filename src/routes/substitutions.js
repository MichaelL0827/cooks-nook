import { Router } from "express";
import prisma from "../lib/prisma.js";
import requireAuth from "../middleware/requireAuth.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { catalog, ingredientNameMatches } from "../lib/substitutions.js";

const router = Router();
router.use(requireAuth);

router.get("/:id/substitutions", asyncHandler(async (req, res) => {
  const recipe = await prisma.recipe.findFirst({
    where: { id: req.params.id, userId: req.userId },
    include: { ingredients: { include: { ingredient: true } } },
  });
  if (!recipe) return res.status(404).json({ error: "Recipe not found." });

  const userAllergens = await prisma.userAllergen.findMany({ include: { allergen: true }, where: { userId: req.userId } });
  const allergenIds = userAllergens.map((item) => item.allergenId);
  const rows = await prisma.ingredientSubstitute.findMany({
    where: { allergenId: { in: allergenIds } },
    include: { ingredient: true, substitute: true, allergen: true },
  });

  const substitutions = rows.filter((row) => recipe.ingredients.some((item) => ingredientNameMatches(item.ingredient.name, row.ingredient.name))).map((row) => ({
    ingredient: row.ingredient.name,
    substitute: row.substitute.name,
    allergen: row.allergen?.name,
    notes: row.notes,
    source: "database-catalog",
  }));
  const flags = recipe.ingredients.flatMap((item) => userAllergens.flatMap((userAllergen) => catalog.filter((entry) => entry.allergen === userAllergen.allergen.name && ingredientNameMatches(item.ingredient.name, entry.base)).map((entry) => ({ ingredient: item.ingredient.name, allergen: entry.allergen }))));
  res.json({ substitutions, flags, warning: userAllergens.length > 0 && substitutions.length === 0 ? "No known substitutions found. This does not mean the recipe is free of your allergens." : null });
}));

export default router;
