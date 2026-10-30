import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import meRoutes from "./routes/me.js";
import recipeRoutes from "./routes/recipes.js";
import suggestionRoutes from "./routes/suggestions.js";
import assistantRoutes from "./routes/assistant.js";
import substitutionRoutes from "./routes/substitutions.js";
import prisma from "./lib/prisma.js";
import { ensureSubstitutionCatalog } from "./lib/substitutions.js";

const requiredEnvVars = ["DATABASE_URL", "JWT_SECRET"];
for (const name of requiredEnvVars) {
  if (!process.env[name]) {
    console.error(`Missing required env var: ${name}. Check your .env file.`);
    process.exit(1);
  }
}

const app = express();
const frontendPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "frontend");

app.use(cors());
app.use(express.json());
app.use(express.static(frontendPath));

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/auth", authRoutes);
app.use("/me", meRoutes);
app.use("/recipes/assistant", assistantRoutes);
app.use("/recipes", substitutionRoutes);
app.use("/recipes", recipeRoutes);
app.use("/recipes/suggest", suggestionRoutes);

app.use((error, req, res, next) => {
  console.error("Unhandled request error:", error);
  if (res.headersSent) return next(error);
  res.status(500).json({ error: "An unexpected server error occurred." });
});

const PORT = process.env.PORT || 3001;
async function start() {
  await ensureSubstitutionCatalog(prisma);
  app.listen(PORT, () => {
    console.log(`Cooks Nook API listening on http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error("Cooks Nook failed to start:", error.message);
  process.exit(1);
});
