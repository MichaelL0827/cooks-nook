import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

const router = Router();

const SALT_ROUNDS = 12;
const TOKEN_EXPIRY = "7d";

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// POST /auth/register
// body: { email, password }
router.post("/register", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "A valid email is required." });
  }
  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: { email, passwordHash },
    select: { id: true, email: true, createdAt: true },
  });

  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

  res.status(201).json({ user, token });
});

// POST /auth/login
// body: { email, password }
router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!isValidEmail(email) || typeof password !== "string") {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Same error for "no such user" and "wrong password" so login can't be
  // used to probe which emails have accounts.
  const invalidCredentials = () => res.status(401).json({ error: "Invalid email or password." });

  if (!user) return invalidCredentials();

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) return invalidCredentials();

  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

  res.json({
    user: { id: user.id, email: user.email, createdAt: user.createdAt },
    token,
  });
});

export default router;
