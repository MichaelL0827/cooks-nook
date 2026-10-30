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

  const recipes = [
    {
      name: "Chicken Tacos",
      ingredients: [{ name: "Chicken" }, { name: "Lime" }],
      steps: [{ instruction: "Cook the chicken." }],
      tags: ["dinner", "quick meals"],
    },
    {
      name: "Lime Cake",
      ingredients: [{ name: "Flour" }, { name: "Lime" }],
      steps: [{ instruction: "Bake the cake." }],
      tags: ["dessert"],
    },
    {
      name: "Tomato Soup",
      ingredients: [{ name: "Tomato" }],
      steps: [{ instruction: "Simmer the soup." }],
      tags: ["dinner"],
    },
  ];

  for (const recipe of recipes) {
    const response = await request("POST", "/recipes", recipe, user.token);
    assert.equal(response.status, 201);
  }
});

after(async () => {
  await stopServer();
  await removeTestUsers(userIds);
});

test("tag filtering returns recipes with a matching tag", async () => {
  const response = await request("GET", "/recipes?tag=dinner", undefined, user.token);
  const names = response.body.recipes.map((recipe) => recipe.name).sort();

  assert.equal(response.status, 200);
  assert.deepEqual(names, ["Chicken Tacos", "Tomato Soup"]);
});

test("ingredient filtering is case-insensitive", async () => {
  const response = await request("GET", "/recipes?ingredient=LIME", undefined, user.token);
  const names = response.body.recipes.map((recipe) => recipe.name).sort();

  assert.equal(response.status, 200);
  assert.deepEqual(names, ["Chicken Tacos", "Lime Cake"]);
});

test("name, tag, and ingredient filters can be combined", async () => {
  const response = await request(
    "GET",
    "/recipes?search=chicken&tag=quick&ingredient=lime",
    undefined,
    user.token,
  );

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.recipes.map((recipe) => recipe.name), ["Chicken Tacos"]);
});

test("filters return an empty list when there is no match", async () => {
  const response = await request("GET", "/recipes?tag=breakfast", undefined, user.token);

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.recipes, []);
});
