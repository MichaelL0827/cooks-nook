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
let otherUser;
let recipeId;

before(async () => {
  await startServer();
  user = await registerTestUser();
  otherUser = await registerTestUser();
  userIds.push(user.userId, otherUser.userId);
});

after(async () => {
  await stopServer();
  await removeTestUsers(userIds);
});

test("a user can create a recipe with ingredients and steps", async () => {
  const response = await request(
    "POST",
    "/recipes",
    {
      name: "Test Toast",
      servings: 2,
      ingredients: [{ name: "Bread", quantity: 2, unit: "slices" }],
      steps: [{ instruction: "Toast the bread." }],
      tags: ["breakfast", "quick meals"],
    },
    user.token,
  );

  assert.equal(response.status, 201);
  assert.equal(response.body.recipe.name, "Test Toast");
  assert.equal(response.body.recipe.ingredients[0].ingredient.name, "Bread");
  assert.equal(response.body.recipe.steps[0].instruction, "Toast the bread.");
    assert.deepEqual(
      response.body.recipe.tags.map(({ tag }) => tag.name).sort(),
      ["breakfast", "quick meals"],
    );
  recipeId = response.body.recipe.id;
});

test("recipe creation rejects ingredient names that are not words", async () => {
  const invalidNames = [123, "flour123", "flour, sugar"];

  for (const name of invalidNames) {
    const response = await request(
      "POST",
      "/recipes",
      {
        name: "Invalid Ingredient Test",
        ingredients: [{ name }],
      },
      user.token,
    );

    assert.equal(response.status, 400);
    assert.match(response.body.error, /ingredients\[0\]\.name/);
  }
});

test("recipe creation accepts normal multi-word ingredient names", async () => {
  const response = await request(
    "POST",
    "/recipes",
    {
      name: "Valid Ingredient Test",
      ingredients: [
        { name: "olive oil" },
        { name: "all-purpose flour" },
        { name: "baker's yeast" },
      ],
    },
    user.token,
  );

  assert.equal(response.status, 201);
});

test("a user can list and retrieve their recipes", async () => {
  const list = await request("GET", "/recipes", undefined, user.token);
  const detail = await request("GET", `/recipes/${recipeId}`, undefined, user.token);

  assert.equal(list.status, 200);
  const listedRecipe = list.body.recipes.find((recipe) => recipe.id === recipeId);
  assert.ok(listedRecipe);
  assert.deepEqual(
    listedRecipe.tags.map(({ tag }) => tag.name).sort(),
    ["breakfast", "quick meals"],
  );
  assert.equal(detail.status, 200);
  assert.equal(detail.body.recipe.id, recipeId);
});

test("recipe lists can be filtered by name, tag, and ingredient", async () => {
  const byName = await request("GET", "/recipes?search=test toast", undefined, user.token);
  const byTag = await request("GET", "/recipes?tag=breakfast", undefined, user.token);
  const byIngredient = await request("GET", "/recipes?ingredient=bread", undefined, user.token);
  const noMatch = await request("GET", "/recipes?ingredient=tomato", undefined, user.token);

  assert.equal(byName.status, 200);
  assert.equal(byName.body.recipes.length, 1);
  assert.equal(byName.body.recipes[0].id, recipeId);
  assert.equal(byTag.body.recipes.length, 1);
  assert.equal(byTag.body.recipes[0].id, recipeId);
  assert.equal(byIngredient.body.recipes.length, 1);
  assert.equal(byIngredient.body.recipes[0].id, recipeId);
  assert.equal(noMatch.body.recipes.length, 0);
});

test("a user can update a recipe", async () => {
  const response = await request(
    "PUT",
    `/recipes/${recipeId}`,
    {
      name: "Updated Test Toast",
      servings: 4,
      ingredients: [{ name: "Bread", quantity: 4, unit: "slices" }],
      steps: [{ instruction: "Toast four slices." }],
      tags: ["updated"],
    },
    user.token,
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.recipe.name, "Updated Test Toast");
  assert.equal(response.body.recipe.servings, 4);
  assert.deepEqual(response.body.recipe.tags.map(({ tag }) => tag.name), ["updated"]);
});

test("recipe creation rejects malformed steps, tags, and numeric fields", async () => {
  const response = await request(
    "POST",
    "/recipes",
    {
      name: "Invalid Recipe",
      servings: 0,
      steps: [{ instruction: 42 }],
      tags: ["not,a-tag"],
    },
    user.token,
  );

  assert.equal(response.status, 400);
  assert.match(response.body.error, /steps\[0\]\.instruction/);
  assert.match(response.body.error, /tags\[0\]/);
  assert.match(response.body.error, /servings/);
});

test("users cannot access another user's recipe", async () => {
  const response = await request("GET", `/recipes/${recipeId}`, undefined, otherUser.token);

  assert.equal(response.status, 404);
});

test("a user can delete a recipe", async () => {
  const deleted = await request("DELETE", `/recipes/${recipeId}`, undefined, user.token);
  const missing = await request("GET", `/recipes/${recipeId}`, undefined, user.token);

  assert.equal(deleted.status, 204);
  assert.equal(missing.status, 404);
});
