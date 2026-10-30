import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { registerTestUser, removeTestUsers, request, startServer, stopServer } from "./helpers.js";

const userIds = [];
let user;
let otherUser;

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

test("cooking assistant answers using saved recipe context", async () => {
  const created = await request("POST", "/recipes", { name: "Pancakes", ingredients: [{ name: "Flour", quantity: 1, unit: "cup" }], steps: [{ instruction: "Cook until golden." }] }, user.token);
  const response = await request("POST", "/recipes/assistant", { recipeId: created.body.recipe.id, question: "What does until golden mean?" }, user.token);
  assert.equal(response.status, 200);
  assert.equal(response.body.source, "offline-fallback");
  assert.match(response.body.answer.answer, /Cook until golden/i);
});

test("cooking assistant validates questions", async () => {
  const response = await request("POST", "/recipes/assistant", { recipeId: "missing", question: "?" }, user.token);
  assert.equal(response.status, 400);
  assert.match(response.body.error, /question/);
});

test("cooking assistant cannot use another user's recipe", async () => {
  const created = await request("POST", "/recipes", { name: "Private Soup" }, user.token);
  const response = await request("POST", "/recipes/assistant", { recipeId: created.body.recipe.id, question: "How do I make this?" }, otherUser.token);
  assert.equal(response.status, 404);
});

test("cooking assistant rate limits repeated requests", async () => {
  const limitedUser = await registerTestUser();
  userIds.push(limitedUser.userId);
  const created = await request("POST", "/recipes", { name: "Rate Limited Assistant" }, limitedUser.token);
  let last;
  for (let index = 0; index < 11; index += 1) last = await request("POST", "/recipes/assistant", { recipeId: created.body.recipe.id, question: "What is this step?" }, limitedUser.token);
  assert.equal(last.status, 429);
});
