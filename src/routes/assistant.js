import { Router } from "express";
import prisma from "../lib/prisma.js";
import requireAuth from "../middleware/requireAuth.js";

const router = Router();
router.use(requireAuth);

const assistantSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    answer: { type: "string" },
    safetyNotes: { type: "array", items: { type: "string" } },
    followUpQuestions: { type: "array", items: { type: "string" } },
  },
  required: ["answer", "safetyNotes", "followUpQuestions"],
};

function validateRequest(body) {
  const errors = [];
  if (typeof body.recipeId !== "string" || body.recipeId.trim().length === 0) errors.push("recipeId is required.");
  if (typeof body.question !== "string" || body.question.trim().length < 2) errors.push("question must be at least 2 characters.");
  else if (body.question.trim().length > 500) errors.push("question must be 500 characters or fewer.");
  return errors;
}

function makeFallbackAnswer(recipe, question) {
  const lowerQuestion = question.toLowerCase();
  const stepCount = recipe.steps.length;
  const safetyNotes = ["Use visual cues together with the directions, and verify that meat, poultry, seafood, and eggs reach a safe internal temperature."];
  if (lowerQuestion.includes("substitut") || lowerQuestion.includes("instead of")) {
    return { answer: `For ${recipe.name}, choose a substitute with a similar role and texture. Start with a small adjustment, then taste and adjust. Check the recipe's current quantities before changing the ratio.`, safetyNotes, followUpQuestions: ["Which ingredient do you need to replace?", "Are there allergies or dietary restrictions to consider?"] };
  }
  if (lowerQuestion.includes("golden") || lowerQuestion.includes("done") || lowerQuestion.includes("how long")) {
    return { answer: `The recipe has ${stepCount} step${stepCount === 1 ? "" : "s"}. Look for the visual and texture cues in the step rather than relying only on a timer. If the step involves a potentially hazardous food, use a food thermometer to confirm doneness.`, safetyNotes, followUpQuestions: ["Which step should I explain in more detail?"] };
  }
  return { answer: `I can help clarify ${recipe.name}. The recipe contains ${recipe.ingredients.length} ingredient${recipe.ingredients.length === 1 ? "" : "s"} and ${stepCount} step${stepCount === 1 ? "" : "s"}. Ask about a specific step, technique, timing cue, or ingredient substitution.`, safetyNotes, followUpQuestions: ["Which step or ingredient is unclear?"] };
}

function extractResponseText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  const content = data.output?.flatMap((item) => item.content ?? []) ?? [];
  return content.find((item) => item.type === "output_text")?.text ?? "";
}

async function requestLlmAnswer(recipe, question) {
  const context = { name: recipe.name, servings: recipe.servings, ingredients: recipe.ingredients.map((item) => ({ name: item.ingredient.name, quantity: item.quantity, unit: item.unit, notes: item.notes })), steps: recipe.steps.map((step) => step.instruction) };
  const response = await fetch(process.env.LLM_API_URL || "https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.LLM_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || "gpt-4.1-mini",
      store: false,
      instructions: "You are a cautious cooking assistant. Answer only from the supplied recipe context. Explain vague cooking language for beginners, identify uncertainty, suggest substitutions with caveats, and never claim an allergen-free result.",
      input: `Recipe context:\n${JSON.stringify(context)}\n\nUser question: ${question}`,
      text: { format: { type: "json_schema", name: "cooking_assistant_answer", strict: true, schema: assistantSchema } },
    }),
  });
  if (!response.ok) throw new Error(`LLM provider request failed (${response.status})`);
  const text = extractResponseText(await response.json());
  if (!text) throw new Error("LLM provider returned no answer.");
  return JSON.parse(text);
}

router.post("/", async (req, res) => {
  const errors = validateRequest(req.body ?? {});
  if (errors.length > 0) return res.status(400).json({ error: errors.join(" ") });
  const recipe = await prisma.recipe.findFirst({
    where: { id: req.body.recipeId.trim(), userId: req.userId },
    include: { steps: { orderBy: { stepNumber: "asc" } }, ingredients: { include: { ingredient: true } } },
  });
  if (!recipe) return res.status(404).json({ error: "Recipe not found." });
  const question = req.body.question.trim();
  try {
    const configuredKey = process.env.LLM_API_KEY?.trim();
    const placeholderKeys = new Set(["your-api-key-here", "replace-with-your-api-key"]);
    const useFallback = process.env.LLM_OFFLINE_MODE === "true" || !configuredKey || placeholderKeys.has(configuredKey);
    const answer = useFallback ? makeFallbackAnswer(recipe, question) : await requestLlmAnswer(recipe, question);
    return res.json({ answer, source: useFallback ? "offline-fallback" : "llm" });
  } catch (error) {
    console.error("Cooking assistant failed:", error.message);
    return res.status(502).json({ error: "The cooking assistant is temporarily unavailable." });
  }
});

export default router;
