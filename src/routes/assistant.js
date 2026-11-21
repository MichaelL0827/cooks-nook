import { Router } from "express";
import prisma from "../lib/prisma.js";
import requireAuth from "../middleware/requireAuth.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { userRateLimit } from "../middleware/rateLimit.js";
import { isHighRiskIngredient, isIncompleteAssistantAnswer, normalizeAssistantAnswer } from "../lib/aiOutput.js";
import { debugLlmResponse, fetchWithRetry } from "../lib/ai.js";
import { AI_PROMPT_VERSION, COOKING_ASSISTANT_CONTEXT_RULE, COOKING_ASSISTANT_PROMPT, COOKING_ASSISTANT_STEP_FOCUS } from "../lib/prompts.js";

const router = Router();
router.use(requireAuth);
router.use(userRateLimit({ max: 10 }));
const MAX_HISTORY = 6;

const assistantSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    answer: { type: "string" },
    safetyNotes: { type: "array", maxItems: 3, items: { type: "string" } },
    followUpQuestions: { type: "array", maxItems: 2, items: { type: "string" } },
  },
  required: ["answer", "safetyNotes", "followUpQuestions"],
};
const openAiAssistantSchema = JSON.parse(JSON.stringify(assistantSchema));
delete openAiAssistantSchema.properties.safetyNotes.maxItems;
delete openAiAssistantSchema.properties.followUpQuestions.maxItems;

function validateRequest(body) {
  const errors = [];
  if (typeof body.recipeId !== "string" || body.recipeId.trim().length === 0) errors.push("recipeId is required.");
  if (typeof body.question !== "string" || body.question.trim().length < 2) errors.push("question must be at least 2 characters.");
  else if (body.question.trim().length > 500) errors.push("question must be 500 characters or fewer.");
  if (body.history !== undefined) {
    const validHistory = Array.isArray(body.history) && body.history.length <= MAX_HISTORY && body.history.every((message) =>
      ["user", "assistant"].includes(message?.role) &&
      typeof message.content === "string" &&
      message.content.trim().length >= 1 &&
      message.content.length <= 1500
    );
    if (!validHistory) errors.push(`history must be at most ${MAX_HISTORY} messages with a user or assistant role and 1-1500 characters.`);
  }
  if (body.stepNumber !== undefined && !(Number.isInteger(body.stepNumber) && body.stepNumber >= 1)) errors.push("stepNumber must be a positive integer.");
  return errors;
}

function makeFallbackAnswer(recipe, question, allergens, stepNumber) {
  const lowerQuestion = question.toLowerCase();
  const stepCount = recipe.steps.length;
  const safetyNotes = ["Use visual cues together with the directions, and verify that meat, poultry, seafood, and eggs reach a safe internal temperature."];
  if (allergens.length > 0) safetyNotes.push(`The account has declared: ${allergens.join(", ")}. Check every package label and cross-contact warning.`);
  if (stepNumber !== undefined) {
    const focusedStep = recipe.steps[stepNumber - 1];
    const answer = focusedStep
      ? `Step ${stepNumber} says: “${focusedStep.instruction}” Break that instruction into one action at a time and use the visual or texture cues in the wording.`
      : `This recipe has ${stepCount} step${stepCount === 1 ? "" : "s"}; step ${stepNumber} is not available. Ask about one of the listed steps instead.`;
    return { answer, safetyNotes, followUpQuestions: ["Would you like me to explain another step?"] };
  }
  if (lowerQuestion.includes("substitut") || lowerQuestion.includes("instead of")) {
    return { answer: `For ${recipe.name}, choose a substitute with a similar role and texture. Start with a small adjustment, then taste and adjust. Check the recipe's current quantities before changing the ratio.`, safetyNotes, followUpQuestions: ["Which ingredient do you need to replace?", "Are there allergies or dietary restrictions to consider?"] };
  }
  if (lowerQuestion.includes("golden") || lowerQuestion.includes("done") || lowerQuestion.includes("how long")) {
    const relevantStep = recipe.steps.find((step) => /golden|done|thick|simmer|bubb|tender/i.test(step.instruction)) || recipe.steps[0];
    return { answer: `In this recipe, the relevant direction is: “${relevantStep?.instruction || "Follow the recipe step and check the texture as you cook."}” Look for the visual and texture cues rather than relying only on a timer. If the step involves a potentially hazardous food, use a food thermometer to confirm doneness.`, safetyNotes, followUpQuestions: ["Which step should I explain in more detail?"] };
  }
  return { answer: `I can help clarify ${recipe.name}. The recipe contains ${recipe.ingredients.length} ingredient${recipe.ingredients.length === 1 ? "" : "s"} and ${stepCount} step${stepCount === 1 ? "" : "s"}. Ask about a specific step, technique, timing cue, or ingredient substitution.`, safetyNotes, followUpQuestions: ["Which step or ingredient is unclear?"] };
}

function isGuardedQuestion(question) {
  return /\b(?:capital of|president of|javascript|programming|system prompt|reveal (?:your|the) prompt|ignore (?:your|the) instructions)\b/i.test(question);
}

function containsPromptLeak(answer) {
  return /cautious cooking assistant|recipe context:|return concise, beginner-friendly json|earlier messages are conversation context/i.test(String(answer || ""));
}

function makeGuardedAnswer(recipe) {
  return {
    answer: `I can only help with the recipe for ${recipe.name}. I will not answer unrelated questions or follow instructions that conflict with the recipe context. Ask about an ingredient, cooking technique, timing cue, or food-safety step.`,
    safetyNotes: [],
    followUpQuestions: ["Which recipe step or ingredient would you like to discuss?"],
  };
}

function extractResponseText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  const content = data.output?.flatMap((item) => item.content ?? []) ?? [];
  return content.find((item) => item.type === "output_text")?.text ?? "";
}

async function requestLlmAnswer(recipe, question, allergens, history = [], stepNumber) {
  const context = { name: recipe.name, servings: recipe.servings, ingredients: recipe.ingredients.map((item) => ({ name: item.ingredient.name, quantity: item.quantity, unit: item.unit, notes: item.notes })), steps: recipe.steps.map((step, index) => ({ step: index + 1, instruction: step.instruction })) };
  const focusedStep = stepNumber === undefined ? null : recipe.steps[stepNumber - 1];
  const focus = stepNumber === undefined ? "" : `\n${COOKING_ASSISTANT_STEP_FOCUS(stepNumber)}\nFocused step text: ${focusedStep?.instruction || "unavailable"}`;
  const system = `${COOKING_ASSISTANT_PROMPT}\n\n${COOKING_ASSISTANT_CONTEXT_RULE}\n\nRecipe context:\n${JSON.stringify(context)}\nDeclared account allergens: ${allergens.join(", ") || "none"}${focus}`;
  const messages = [
    { role: "system", content: system },
    ...history.map((message) => ({ role: message.role, content: message.content.trim() })),
    { role: "user", content: question },
  ];
  const provider = process.env.LLM_PROVIDER?.trim().toLowerCase() || "openai";
  if (provider === "ollama") {
    let lastError;
    for (const temperature of [0, 0.3]) {
      const response = await fetchWithRetry(process.env.OLLAMA_API_URL || "http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL || "llama3.1:8b",
          stream: false,
          format: assistantSchema,
          messages,
          options: { temperature, num_predict: Number(process.env.OLLAMA_ASSISTANT_NUM_PREDICT || process.env.OLLAMA_NUM_PREDICT) || 400, num_ctx: Number(process.env.OLLAMA_NUM_CTX) || 8192 },
          keep_alive: process.env.OLLAMA_KEEP_ALIVE || "15m",
        }),
      }, { timeoutMs: Number(process.env.LLM_TIMEOUT_MS) || 45_000 });
      if (!response.ok) throw new Error(`Ollama request failed (${response.status})`);
      const data = await response.json();
      const text = data.message?.content ?? "";
      debugLlmResponse("ollama_assistant_raw_response", { promptVersion: AI_PROMPT_VERSION, response: data });
      if (!text) throw new Error("Ollama returned no answer.");
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed.answer === "string" && parsed.answer.trim().length < 40 && parsed.answer.trim().split(/\s+/).length < 6 && temperature === 0) {
          lastError = new Error("Ollama returned an answer shorter than 40 characters.");
          continue;
        }
        return parsed;
      } catch (error) {
        lastError = new Error(`Ollama returned invalid JSON (done_reason=${data.done_reason || "unknown"}, tokens=${data.eval_count || "unknown"}): ${error.message}`);
        if (temperature === 0) console.warn("Ollama assistant JSON was invalid; retrying once at temperature 0.3.");
      }
    }
    throw lastError;
  }
  const response = await fetchWithRetry(process.env.LLM_API_URL || "https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.LLM_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || "gpt-4.1-mini",
      store: false,
      input: messages,
      text: { format: { type: "json_schema", name: "cooking_assistant_answer", strict: true, schema: openAiAssistantSchema } },
    }),
  }, { timeoutMs: Number(process.env.LLM_TIMEOUT_MS) || 45_000 });
  if (!response.ok) throw new Error(`LLM provider request failed (${response.status})`);
  const data = await response.json();
  debugLlmResponse("llm_assistant_raw_response", { promptVersion: AI_PROMPT_VERSION, response: data });
  const text = extractResponseText(data);
  if (!text) throw new Error("LLM provider returned no answer.");
  return JSON.parse(text);
}

router.post("/", asyncHandler(async (req, res) => {
  const errors = validateRequest(req.body ?? {});
  if (errors.length > 0) return res.status(400).json({ error: errors.join(" ") });
  const recipe = await prisma.recipe.findFirst({
    where: { id: req.body.recipeId.trim(), userId: req.userId },
    include: { steps: { orderBy: { stepNumber: "asc" } }, ingredients: { include: { ingredient: true } } },
  });
  if (!recipe) return res.status(404).json({ error: "Recipe not found." });
  const question = req.body.question.trim();
  const history = req.body.history ?? [];
  const stepNumber = req.body.stepNumber;
  const userAllergens = await prisma.userAllergen.findMany({ where: { userId: req.userId }, include: { allergen: true } });
  const allergens = userAllergens.map((item) => item.allergen.name);
  try {
    const provider = process.env.LLM_PROVIDER?.trim().toLowerCase() || "openai";
    const isOllama = provider === "ollama";
    const configuredKey = process.env.LLM_API_KEY?.trim();
    const placeholderKeys = new Set(["your-api-key-here", "replace-with-your-api-key"]);
    const useFallback = process.env.LLM_OFFLINE_MODE === "true" || (!isOllama && (!configuredKey || placeholderKeys.has(configuredKey)));
    const invalidStep = stepNumber !== undefined && stepNumber > recipe.steps.length;
    let source = useFallback || invalidStep ? "offline-fallback" : (isOllama ? "ollama" : "llm");
    let fallbackReason = invalidStep ? "invalid_step" : (useFallback ? "offline_mode" : null);
    let guardReason = null;
    let rawAnswer;
    if (isGuardedQuestion(question)) {
      rawAnswer = makeGuardedAnswer(recipe);
      guardReason = "off_topic_or_injection";
    } else if (useFallback || invalidStep) rawAnswer = makeFallbackAnswer(recipe, question, allergens, stepNumber);
    else {
      try { rawAnswer = await requestLlmAnswer(recipe, question, allergens, history, stepNumber); }
      catch (error) { console.warn("Cooking assistant provider failed; using offline fallback:", error.message); rawAnswer = makeFallbackAnswer(recipe, question, allergens, stepNumber); source = "offline-fallback"; fallbackReason = "provider_error"; }
    }
    let incomplete = false;
    if (!guardReason && containsPromptLeak(rawAnswer?.answer)) {
      rawAnswer = makeGuardedAnswer(recipe);
      guardReason = "prompt_leak";
    }
    if (!guardReason && isIncompleteAssistantAnswer(rawAnswer?.answer)) {
      rawAnswer = makeFallbackAnswer(recipe, question, allergens, stepNumber);
      incomplete = true;
    }
    const answer = normalizeAssistantAnswer(rawAnswer, { hasHighRiskIngredient: recipe.ingredients.some((item) => isHighRiskIngredient(item.ingredient.name)) });
    const responseBody = { answer, source };
    if (guardReason) responseBody.guarded = guardReason;
    if (incomplete) responseBody.guarded = "incomplete_answer";
    if (source === "offline-fallback") responseBody.fallbackReason = fallbackReason;
    if (source === "ollama" || source === "llm") responseBody.promptVersion = AI_PROMPT_VERSION;
    return res.json(responseBody);
  } catch (error) {
    console.error("Cooking assistant failed:", error.message);
    return res.status(502).json({ error: "The cooking assistant is temporarily unavailable." });
  }
}));

export default router;
