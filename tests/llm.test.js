import assert from "node:assert/strict";
import http from "node:http";
import { after, before, test } from "node:test";
import { registerTestUser, removeTestUsers, request, startServer, stopServer } from "./helpers.js";

let provider;
let providerUrl;
let user;
const userIds = [];

function responseFor(input) {
  if (input.includes("Create a general recipe draft")) {
    return {
      recipeName: "Provider Pancakes",
      assumptions: [],
      ingredients: [
        { name: "Parmesan (grated)", quantity: 1, unit: "cup", notes: null },
        { name: "1% milk", quantity: 1, unit: "cup", notes: null },
        { name: "bad, ingredient", quantity: 1, unit: null, notes: null },
        { name: "***", quantity: 1, unit: null, notes: null },
      ],
      steps: [{ instruction: "Mix and cook until done." }],
      tags: ["breakfast"],
      questions: [],
      substitutions: [],
    };
  }
  return { answer: "The supplied recipe step is the context for this answer.", safetyNotes: [], followUpQuestions: [] };
}

before(async () => {
  provider = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const parsed = JSON.parse(body);
    const input = typeof parsed.input === "string" ? parsed.input : JSON.stringify(parsed.input);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ output_text: JSON.stringify(responseFor(input)) }));
  });
  await new Promise((resolve) => provider.listen(0, "127.0.0.1", resolve));
  providerUrl = `http://127.0.0.1:${provider.address().port}`;
  await startServer({ LLM_OFFLINE_MODE: "false", LLM_API_KEY: "test-key", LLM_API_URL: providerUrl });
  user = await registerTestUser();
  userIds.push(user.userId);
});

after(async () => {
  await stopServer();
  await removeTestUsers(userIds);
  await new Promise((resolve) => provider.close(resolve));
});

test("live provider suggestion path sanitizes names and preserves parenthetical notes", async () => {
  const response = await request("POST", "/recipes/suggest", { recipeName: "Provider Pancakes" }, user.token);
  assert.equal(response.status, 200);
  assert.equal(response.body.source, "llm");
  assert.deepEqual(response.body.suggestion.ingredients.map((item) => item.name), ["Parmesan", "milk", "bad ingredient"]);
  assert.equal(response.body.suggestion.ingredients[0].notes, "grated");
  assert.match(response.body.suggestion.assumptions[0], /removed/);
});

test("live provider assistant path returns the structured answer", async () => {
  const created = await request("POST", "/recipes", { name: "Provider Recipe" }, user.token);
  const response = await request("POST", "/recipes/assistant", { recipeId: created.body.recipe.id, question: "Please clarify this step." }, user.token);
  assert.equal(response.status, 200);
  assert.equal(response.body.source, "llm");
  assert.match(response.body.answer.answer, /supplied recipe/);
});
