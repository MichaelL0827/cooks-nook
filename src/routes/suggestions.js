import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";

const router = Router();
router.use(requireAuth);

const ingredientNamePattern = /^[\p{L}]+(?:[ '-][\p{L}]+)*$/u;

const suggestionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    recipeName: { type: "string" },
    assumptions: { type: "array", items: { type: "string" } },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          quantity: { type: ["number", "null"] },
          unit: { type: ["string", "null"] },
          notes: { type: ["string", "null"] },
        },
        required: ["name", "quantity", "unit", "notes"],
      },
    },
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { instruction: { type: "string" } },
        required: ["instruction"],
      },
    },
    tags: { type: "array", items: { type: "string" } },
    questions: { type: "array", items: { type: "string" } },
  },
  required: ["recipeName", "assumptions", "ingredients", "steps", "tags", "questions"],
};

function validateRequest(body) {
  const errors = [];
  if (typeof body.recipeName !== "string" || body.recipeName.trim().length < 2) {
    errors.push("recipeName must be at least 2 characters.");
  }
  if (body.servings !== undefined && body.servings !== null) {
    if (!Number.isInteger(body.servings) || body.servings < 1) {
      errors.push("servings must be a positive integer.");
    }
  }
  for (const field of ["allergens", "availableIngredients"]) {
    if (body[field] !== undefined && !Array.isArray(body[field])) {
      errors.push(`${field} must be an array.`);
    }
    if (Array.isArray(body[field]) && body[field].some((item) => typeof item !== "string")) {
      errors.push(`${field} must contain only strings.`);
    }
  }
  return errors;
}

function makeFallbackSuggestion({ recipeName, servings, allergens = [], availableIngredients = [] }) {
  const name = recipeName.trim();
  const lowerName = name.toLowerCase();
  const scale = servings ? servings / 4 : 1;
  let ingredients;
  let steps;
  let tags;

  if (lowerName.includes("taco")) {
    ingredients = [
      { name: "chicken", quantity: Number((1.5 * scale).toFixed(2)), unit: "lb", notes: "or another preferred protein" },
      { name: "tortillas", quantity: Math.max(4, Math.round(8 * scale)), unit: "", notes: "corn or flour" },
      { name: "lime", quantity: 1, unit: "", notes: "juiced" },
      { name: "lettuce", quantity: 2, unit: "cup", notes: "shredded" },
    ];
    steps = [
      { instruction: "Season and cook the protein until it reaches a safe internal temperature." },
      { instruction: "Warm the tortillas until flexible." },
      { instruction: "Fill the tortillas and add the lettuce, lime, and desired toppings." },
    ];
    tags = ["dinner", "tacos"];
  } else if (lowerName.includes("pancake")) {
    ingredients = [
      { name: "flour", quantity: Number((1.5 * scale).toFixed(2)), unit: "cup", notes: "all-purpose" },
      { name: "milk", quantity: Number((1.25 * scale).toFixed(2)), unit: "cup", notes: "or a suitable alternative" },
      { name: "eggs", quantity: Math.max(1, Math.round(2 * scale)), unit: "", notes: "beaten" },
      { name: "baking powder", quantity: 2, unit: "teaspoon", notes: "" },
    ];
    steps = [
      { instruction: "Whisk the dry ingredients together." },
      { instruction: "Mix in the milk and eggs until just combined; a few lumps are acceptable." },
      { instruction: "Cook portions on a lightly greased skillet until bubbles form, then flip and finish cooking." },
    ];
    tags = ["breakfast", "quick meals"];
  } else {
    ingredients = [
      { name: "onion", quantity: 1, unit: "", notes: "chopped" },
      { name: "garlic", quantity: 2, unit: "clove", notes: "minced" },
      { name: "olive oil", quantity: 2, unit: "tablespoon", notes: "for cooking" },
      { name: "salt", quantity: null, unit: null, notes: "to taste" },
      { name: "black pepper", quantity: null, unit: null, notes: "to taste" },
    ];
    steps = [
      { instruction: "Prepare and measure the ingredients before cooking." },
      { instruction: "Cook the aromatics in the oil until softened and fragrant." },
      { instruction: `Add the main ingredients for ${name} and cook until done.` },
      { instruction: "Taste, adjust the seasoning, and serve." },
    ];
    tags = ["home cooking"];
  }

  const allergenNotes = allergens.length
    ? [`Review the suggested ingredients for the user's declared allergens: ${allergens.join(", ")}.`]
    : [];
  const availableNotes = availableIngredients.length
    ? [`The user already has: ${availableIngredients.join(", ")}.`]
    : [];

  return {
    recipeName: name,
    assumptions: ["This is a general starting point, not a finalized recipe.", ...allergenNotes, ...availableNotes],
    ingredients: ingredients.filter((item) => ingredientNamePattern.test(item.name)),
    steps,
    tags,
    questions: [],
  };
}

function extractResponseText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  const content = data.output?.flatMap((item) => item.content ?? []) ?? [];
  return content.find((item) => item.type === "output_text")?.text ?? "";
}

async function requestLlmSuggestion(input) {
  const response = await fetch(process.env.LLM_API_URL || "https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.LLM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || "gpt-4.1-mini",
      store: false,
      instructions:
        "You generate cautious, editable recipe drafts for a cookbook app. Return only the requested JSON structure. Use approximate quantities when a recipe name does not determine exact amounts. Do not claim allergen safety; identify assumptions and ask questions when the recipe name is ambiguous. Keep steps concise and include food-safety language when relevant.",
      input: `Create a general recipe draft for: ${input.recipeName}. Servings: ${input.servings ?? "unspecified"}. Declared allergens or dietary restrictions: ${(input.allergens ?? []).join(", ") || "none provided"}. Ingredients already available: ${(input.availableIngredients ?? []).join(", ") || "none provided"}.`,
      text: {
        format: {
          type: "json_schema",
          name: "recipe_suggestion",
          strict: true,
          schema: suggestionSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`LLM provider request failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  const data = await response.json();
  const text = extractResponseText(data);
  if (!text) throw new Error("LLM provider returned no suggestion.");
  return JSON.parse(text);
}

router.post("/", async (req, res) => {
  const body = req.body ?? {};
  const errors = validateRequest(body);
  if (errors.length > 0) return res.status(400).json({ error: errors.join(" ") });

  const input = {
    recipeName: body.recipeName.trim(),
    servings: body.servings ?? null,
    allergens: body.allergens ?? [],
    availableIngredients: body.availableIngredients ?? [],
  };

  try {
    const configuredKey = process.env.LLM_API_KEY?.trim();
    const placeholderKeys = new Set(["your-api-key-here", "replace-with-your-api-key"]);
    const hasConfiguredKey = Boolean(configuredKey) && !placeholderKeys.has(configuredKey);
    const useFallback = process.env.LLM_OFFLINE_MODE === "true" || !hasConfiguredKey;
    const suggestion = useFallback ? makeFallbackSuggestion(input) : await requestLlmSuggestion(input);
    return res.json({ suggestion, source: useFallback ? "offline-fallback" : "llm" });
  } catch (error) {
    console.error("Recipe suggestion failed:", error.message);
    return res.status(502).json({ error: "Recipe suggestions are temporarily unavailable." });
  }
});

export default router;
