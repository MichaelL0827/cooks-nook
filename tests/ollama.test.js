import assert from "node:assert/strict";
import http from "node:http";
import { after, before, test } from "node:test";
import { registerTestUser, removeTestUsers, request, startServer, stopServer } from "./helpers.js";

let provider;
let providerUrl;
let user;
const userIds = [];

before(async () => {
  provider = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const parsed = JSON.parse(body);
    assert.equal(parsed.stream, false);
    assert.equal(parsed.format.type, "object");
    assert.equal(parsed.messages[0].role, "system");
    res.writeHead(200, { "Content-Type": "application/json" });
    const isAssistant = parsed.messages?.[0]?.content?.includes("cooking assistant");
    const content = isAssistant
      ? { answer: "Use the supplied recipe context to guide the next step.", safetyNotes: ["Check safe internal temperatures."], followUpQuestions: [] }
      : { recipeName: "Local Ollama Pancakes", assumptions: [], ingredients: [{ name: "flour", quantity: 1, unit: "cup", notes: null }], steps: [{ instruction: "Mix and cook until golden." }], tags: ["breakfast"], questions: [], substitutions: [] };
    res.end(JSON.stringify({ message: { role: "assistant", content: JSON.stringify(content) }, prompt_eval_count: 42, eval_count: 18 }));
  });
  await new Promise((resolve) => provider.listen(0, "127.0.0.1", resolve));
  providerUrl = `http://127.0.0.1:${provider.address().port}/api/chat`;
  await startServer({ LLM_PROVIDER: "ollama", OLLAMA_API_URL: providerUrl, OLLAMA_MODEL: "test-model", LLM_OFFLINE_MODE: "false" });
  user = await registerTestUser();
  userIds.push(user.userId);
});

after(async () => {
  await stopServer();
  await removeTestUsers(userIds);
  await new Promise((resolve) => provider.close(resolve));
});

test("Ollama provider returns a structured recipe draft", async () => {
  const response = await request("POST", "/recipes/suggest", { recipeName: "Pancakes" }, user.token);
  assert.equal(response.status, 200);
  assert.equal(response.body.source, "ollama");
  assert.equal(response.body.suggestion.recipeName, "Local Ollama Pancakes");
  assert.equal(response.body.suggestion.ingredients[0].name, "flour");
});

test("Ollama provider returns a structured cooking assistant answer", async () => {
  const created = await request("POST", "/recipes", { name: "Local Recipe" }, user.token);
  const response = await request("POST", "/recipes/assistant", { recipeId: created.body.recipe.id, question: "How should I cook this?" }, user.token);
  assert.equal(response.status, 200);
  assert.equal(response.body.source, "ollama");
  assert.match(response.body.answer.answer, /supplied recipe context/);
});
