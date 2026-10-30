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
