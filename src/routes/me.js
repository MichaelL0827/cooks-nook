import { Router } from "express";
import prisma from "../lib/prisma.js";
import requireAuth from "../middleware/requireAuth.js";

const router = Router();

// GET /me — returns the currently authenticated user.
// Proves the token issued by /auth/login or /auth/register actually works.
router.get("/", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, createdAt: true },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  res.json({ user });
});

export default router;
