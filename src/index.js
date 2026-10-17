import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import meRoutes from "./routes/me.js";
import recipeRoutes from "./routes/recipes.js";

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
app.use("/recipes", recipeRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Cooks Nook API listening on http://localhost:${PORT}`);
});
