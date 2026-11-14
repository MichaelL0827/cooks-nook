import assert from "node:assert/strict";
import { test } from "node:test";
import { clearMealDbCache, fetchMealDbDraft, parseMealDbMeal } from "../src/lib/mealDb.js";

const sampleMeal = {
  strMeal: "Test Pancakes",
  strIngredient1: "Flour",
  strMeasure1: "1 1/2 cups",
  strIngredient2: "Milk",
  strMeasure2: "1 cup",
  strIngredient3: "Salt",
  strMeasure3: "to taste",
  strInstructions: "Mix the batter.\r\nCook until golden.",
  strTags: "Breakfast, Quick",
  strSource: "https://example.com/pancakes",
  strMealThumb: "https://example.com/pancakes.jpg",
};

test("TheMealDB meals become editable recipe drafts", () => {
  const draft = parseMealDbMeal(sampleMeal);
  assert.equal(draft.recipeName, "Test Pancakes");
  assert.deepEqual(draft.ingredients[0], { name: "Flour", quantity: 1.5, unit: "cups", notes: null });
  assert.deepEqual(draft.ingredients[2], { name: "Salt", quantity: null, unit: null, notes: "to taste" });
  assert.deepEqual(draft.steps.map((step) => step.instruction), ["Mix the batter.", "Cook until golden."]);
  assert.deepEqual(draft.tags, ["Breakfast", "Quick"]);
  assert.equal(draft.sourceUrl, "https://example.com/pancakes");
  assert.equal(draft.imageUrl, "https://example.com/pancakes.jpg");
});

test("TheMealDB search prefers an exact match and caches it", async () => {
  clearMealDbCache();
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: true, json: async () => ({ meals: [{ ...sampleMeal, strMeal: "Other Pancakes" }, sampleMeal] }) };
  };
  const first = await fetchMealDbDraft("Test Pancakes", { fetchImpl, baseUrl: "https://example.test" });
  const second = await fetchMealDbDraft("Test Pancakes", { fetchImpl, baseUrl: "https://example.test" });
  assert.equal(first.recipeName, "Test Pancakes");
  assert.equal(second.recipeName, "Test Pancakes");
  assert.equal(calls, 1);
});
