import { Router } from "express";
import prisma from "../lib/prisma.js";
import requireAuth from "../middleware/requireAuth.js";
import { ensureSubstitutionCatalog, ingredientNameMatches } from "../lib/substitutions.js";

const router = Router();
router.use(requireAuth);

router.get("/:id/substitutions", async (req, res) => {
  const recipe = await prisma.recipe.findFirst({
    where: { id: req.params.id, userId: req.userId },
    include: { ingredients: { include: { ingredient: true } } },
  });
  if (!recipe) return res.status(404).json({ error: "Recipe not found." });

  await ensureSubstitutionCatalog(prisma);
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
  }));
  res.json({ substitutions });
});

export default router;
