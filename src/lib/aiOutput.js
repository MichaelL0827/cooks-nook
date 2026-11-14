const DEFAULT_SAFETY_NOTE = "Follow the recipe and use a food thermometer for meat, poultry, seafood, and eggs when appropriate.";

function text(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string").join(" ").trim();
  return typeof value === "string" ? value.trim() : "";
}

function isHighRiskIngredient(value) {
  return /\b(beef|chicken|turkey|pork|lamb|meat|fish|salmon|tuna|cod|bacon|sausage|ham|veal|duck|shrimp|prawn|prawns|seafood|shellfish|crab|lobster|clam|clams|oyster|oysters|egg|eggs|poultry)\b/i.test(value);
}

function safeUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function uniqueTextList(value, limit = 8) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .map(text)
    .filter((item) => item && !seen.has(item.toLowerCase()) && seen.add(item.toLowerCase()))
    .slice(0, limit);
}

export function normalizeAssistantAnswer(raw, { hasHighRiskIngredient = false } = {}) {
  const answer = text(raw?.answer);
  const safetyNotes = uniqueTextList(raw?.safetyNotes, 3);
  return {
    answer: answer || "I could not produce a clear answer from this recipe. Please ask about a specific step or ingredient.",
    safetyNotes: safetyNotes.length
      ? safetyNotes
      : (!answer || hasHighRiskIngredient ? [DEFAULT_SAFETY_NOTE] : []),
    followUpQuestions: uniqueTextList(raw?.followUpQuestions, 2),
  };
}

export function normalizeSuggestionShape(raw, recipeName, { preserveAttribution = false } = {}) {
  const ingredients = Array.isArray(raw?.ingredients)
    ? raw.ingredients.map((item) => typeof item === "string" ? { name: item } : item).filter(Boolean)
    : [];
  const normalizeStepText = (value, inline = false) => text(value)
    .split(inline ? /\r?\n+|(?<=[.!?])\s+(?=\d+[.)]\s)/ : /\r?\n+/)
    .map((line) => line.replace(/^\s*(?:\d+[.)]|[-*])\s+/, "").trim())
    .filter(Boolean)
    .map((instruction) => ({ instruction }));
  const steps = typeof raw?.steps === "string"
    ? normalizeStepText(raw.steps, true)
    : Array.isArray(raw?.steps)
      ? raw.steps.flatMap((step) => normalizeStepText(typeof step === "string" ? step : step?.instruction ?? step?.text ?? step?.step ?? step?.description ?? ""))
      : [];
  const normalized = {
    recipeName: text(raw?.recipeName) || text(recipeName) || "Recipe draft",
    assumptions: uniqueTextList(raw?.assumptions, 8),
    ingredients,
    steps,
    tags: uniqueTextList(raw?.tags, 8),
    questions: uniqueTextList(raw?.questions, 5),
    substitutions: Array.isArray(raw?.substitutions) ? raw.substitutions : [],
  };
  if (preserveAttribution) {
    const sourceUrl = safeUrl(raw?.sourceUrl);
    const imageUrl = safeUrl(raw?.imageUrl);
    if (sourceUrl) normalized.sourceUrl = sourceUrl;
    if (imageUrl) normalized.imageUrl = imageUrl;
  }
  return normalized;
}

export { isHighRiskIngredient };
