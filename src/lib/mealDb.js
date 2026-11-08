const defaultBaseUrl = "https://www.themealdb.com/api/json/v1/1";
const cache = new Map();
const cacheTtlMs = 10 * 60 * 1000;

function fractionToNumber(value) {
  if (!value.includes("/")) return Number(value);
  const mixed = value.trim().split(/\s+/);
  if (mixed.length === 2) return Number(mixed[0]) + fractionToNumber(mixed[1]);
  const [numerator, denominator] = value.split("/").map(Number);
  return denominator ? numerator / denominator : null;
}

function parseMeasure(measure) {
  const text = String(measure || "").trim();
  const match = text.match(/^(\d+\s+\d+\s*\/\s*\d+|\d+(?:\.\d+)?|\d+\s*\/\s*\d+)\s+(.+)$/);
  if (!match) return { quantity: null, unit: null, notes: text || null };
  const quantity = fractionToNumber(match[1].trim());
  const unitParts = match[2].split(/\s+/);
  const unit = unitParts.shift() || null;
  const notes = unitParts.join(" ") || null;
  return { quantity, unit, notes };
}

export function parseMealDbMeal(meal) {
  if (!meal || typeof meal.strMeal !== "string") return null;
  const ingredients = [];
  for (let index = 1; index <= 20; index += 1) {
    const name = meal[`strIngredient${index}`]?.trim();
    if (!name) continue;
    ingredients.push({ name, ...parseMeasure(meal[`strMeasure${index}`]) });
  }

  const instructionText = String(meal.strInstructions || "").trim();
  const instructions = instructionText.split(/\r?\n+/).map((step) => step.trim()).filter(Boolean);
  const steps = (instructions.length ? instructions : [instructionText]).filter(Boolean).map((instruction) => ({ instruction }));
  const tags = String(meal.strTags || "").split(",").map((tag) => tag.trim()).filter(Boolean);

  return {
    recipeName: meal.strMeal.trim(),
    assumptions: ["Draft imported from TheMealDB. Review measurements and instructions before saving."],
    ingredients,
    steps,
    tags,
    questions: [],
    substitutions: [],
    sourceUrl: meal.strSource || meal.strYoutube || null,
    imageUrl: meal.strMealThumb || null,
  };
}

export async function fetchMealDbDraft(recipeName, { fetchImpl = fetch, baseUrl = process.env.MEALDB_API_URL || defaultBaseUrl } = {}) {
  const key = recipeName.trim().toLowerCase();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const url = `${baseUrl.replace(/\/$/, "")}/search.php?s=${encodeURIComponent(recipeName.trim())}`;
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`TheMealDB request failed (${response.status}).`);
  const data = await response.json();
  const meals = Array.isArray(data.meals) ? data.meals : [];
  const exact = meals.find((meal) => meal.strMeal?.trim().toLowerCase() === key);
  const result = parseMealDbMeal(exact || meals[0]);
  cache.set(key, { value: result, expiresAt: Date.now() + cacheTtlMs });
  return result;
}

export function clearMealDbCache() {
  cache.clear();
}
