import { Router } from "express";
import prisma from "../lib/prisma.js";
import requireAuth from "../middleware/requireAuth.js";
import { normalizeAllergenNames, supportedAllergens } from "../lib/substitutions.js";
import asyncHandler from "../middleware/asyncHandler.js";

const router = Router();

// GET /me — returns the currently authenticated user.
// Proves the token issued by /auth/login or /auth/register actually works.
router.get("/", requireAuth, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, createdAt: true },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  res.json({ user });
}));

router.get("/allergens", requireAuth, asyncHandler(async (req, res) => {
  const allergens = await prisma.userAllergen.findMany({ where: { userId: req.userId }, include: { allergen: true } });
  res.json({ allergens: allergens.map((item) => item.allergen.name) });
}));

router.put("/allergens", requireAuth, asyncHandler(async (req, res) => {
  if (!Array.isArray(req.body?.allergens) || req.body.allergens.length > 20 || req.body.allergens.some((item) => typeof item !== "string" || item.trim().length < 2 || item.length > 40)) {
    return res.status(400).json({ error: "allergens must be an array of up to 20 short strings." });
  }
  const names = [...new Set(req.body.allergens.flatMap(normalizeAllergenNames))];
  const unsupported = names.filter((name) => !supportedAllergens.includes(name));
  if (unsupported.length > 0) return res.status(400).json({ error: `Unsupported allergens: ${unsupported.join(", ")}. Supported values: ${supportedAllergens.join(", ")}.` });
  const allergens = await prisma.$transaction(async (tx) => {
    await tx.userAllergen.deleteMany({ where: { userId: req.userId } });
    for (const name of names) {
      const allergen = await tx.allergen.upsert({ where: { name }, update: {}, create: { name } });
      await tx.userAllergen.create({ data: { userId: req.userId, allergenId: allergen.id } });
    }
    return tx.userAllergen.findMany({ where: { userId: req.userId }, include: { allergen: true } });
  });
  res.json({ allergens: allergens.map((item) => item.allergen.name) });
}));

export default router;
