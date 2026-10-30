import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  registerTestUser,
  removeTestUsers,
  request,
  startServer,
  stopServer,
} from "./helpers.js";

const userIds = [];
let user;

before(async () => {
  await startServer();
  user = await registerTestUser();
  userIds.push(user.userId);
});

after(async () => {
  await stopServer();
  await removeTestUsers(userIds);
});

test("ingredient maker returns an editable offline draft", async () => {
  const response = await request(
    "POST",
    "/recipes/suggest",
    {
      recipeName: "Chicken Tacos",
      servings: 4,
      allergens: ["peanuts"],
      availableIngredients: ["chicken"],
    },
    user.token,
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.source, "offline-fallback");
  assert.equal(response.body.suggestion.recipeName, "Chicken Tacos");
  assert.ok(response.body.suggestion.ingredients.length > 0);
  assert.ok(response.body.suggestion.steps.length > 0);
  assert.ok(response.body.suggestion.assumptions.length > 0);
  assert.ok(Array.isArray(response.body.suggestion.substitutions));
});

test("ingredient maker returns allergen-aware substitution recommendations", async () => {
  const response = await request(
    "POST",
    "/recipes/suggest",
    { recipeName: "Pancakes", allergens: ["dairy"] },
    user.token,
  );

  assert.equal(response.status, 200);
  assert.ok(response.body.suggestion.substitutions.some((item) => /milk/i.test(item.ingredient)));
});

test("saved recipe substitutions use persisted allergens and exact ingredient names", async () => {
  const preferences = await request("PUT", "/me/allergens", { allergens: ["dairy", "tree nuts", "eggs"] }, user.token);
  assert.equal(preferences.status, 200);
  assert.deepEqual(preferences.body.allergens.sort(), ["dairy", "tree nuts", "eggs"].sort());

  const created = await request("POST", "/recipes", {
    name: "Exact Match Test",
    ingredients: [{ name: "milk" }, { name: "coconut milk" }, { name: "eggplant" }, { name: "walnuts" }, { name: "mayonnaise" }],
  }, user.token);
  const response = await request("GET", `/recipes/${created.body.recipe.id}/substitutions`, undefined, user.token);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.substitutions.map((item) => item.matchedIngredient).sort(), ["mayonnaise", "milk", "walnuts"].sort());
});

test("ingredient maker rejects oversized input", async () => {
  const response = await request("POST", "/recipes/suggest", { recipeName: "x".repeat(121) }, user.token);
  assert.equal(response.status, 400);
  assert.match(response.body.error, /120 characters/);
});

test("allergen settings reject unsupported values", async () => {
  const response = await request("PUT", "/me/allergens", { allergens: ["mystery allergen"] }, user.token);
  assert.equal(response.status, 400);
  assert.match(response.body.error, /Unsupported allergens/);
});

test("generic nut and synonym allergen values normalize consistently", async () => {
  const isolatedUser = await registerTestUser();
  userIds.push(isolatedUser.userId);
  const preferences = await request("PUT", "/me/allergens", { allergens: ["nut", "wheat", "egg"] }, isolatedUser.token);
  assert.equal(preferences.status, 200);
  assert.deepEqual(preferences.body.allergens.sort(), ["eggs", "gluten", "peanuts", "tree nuts"].sort());
  const suggestion = await request("POST", "/recipes/suggest", { recipeName: "Pasta", allergens: ["soy"] }, isolatedUser.token);
  assert.equal(suggestion.status, 200);
  const unsupported = await request("POST", "/recipes/suggest", { recipeName: "Pasta", allergens: ["mystery allergen"] }, isolatedUser.token);
  assert.equal(unsupported.status, 400);
});

test("ingredient maker rate limits repeated requests", async () => {
  const limitedUser = await registerTestUser();
  userIds.push(limitedUser.userId);
  let last;
  for (let index = 0; index < 11; index += 1) last = await request("POST", "/recipes/suggest", { recipeName: "Rate Limit Test" }, limitedUser.token);
  assert.equal(last.status, 429);
});

test("saved substitutions enforce recipe ownership", async () => {
  const otherUser = await registerTestUser();
  userIds.push(otherUser.userId);
  const created = await request("POST", "/recipes", { name: "Owner Only Recipe", ingredients: [{ name: "milk" }] }, user.token);
  const response = await request("GET", `/recipes/${created.body.recipe.id}/substitutions`, undefined, otherUser.token);
  assert.equal(response.status, 404);
});

test("generated drafts can be edited and saved through recipe CRUD", async () => {
  const draft = await request(
    "POST",
    "/recipes/suggest",
    { recipeName: "Chicken Tacos", servings: 4 },
    user.token,
  );
  const suggestion = draft.body.suggestion;
  suggestion.ingredients[0].notes = "edited before saving";
  const saved = await request(
    "POST",
    "/recipes",
    {
      name: suggestion.recipeName,
      ingredients: suggestion.ingredients,
      steps: suggestion.steps,
      tags: suggestion.tags,
    },
    user.token,
  );

  assert.equal(saved.status, 201);
  assert.equal(saved.body.recipe.name, "Chicken Tacos");
  assert.equal(saved.body.recipe.ingredients[0].notes, "edited before saving");
  assert.ok(saved.body.recipe.steps.length > 0);
});

test("ingredient maker validates the recipe name", async () => {
  const response = await request(
    "POST",
    "/recipes/suggest",
    { recipeName: "" },
    user.token,
  );

  assert.equal(response.status, 400);
  assert.match(response.body.error, /recipeName/);
});

test("ingredient maker requires authentication", async () => {
  const response = await request("POST", "/recipes/suggest", { recipeName: "Pasta" });

  assert.equal(response.status, 401);
});
