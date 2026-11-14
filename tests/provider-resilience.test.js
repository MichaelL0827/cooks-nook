import assert from "node:assert/strict";
import http from "node:http";
import { after, before, test } from "node:test";
import { registerTestUser, removeTestUsers, request, startServer, stopServer } from "./helpers.js";

let provider;
let providerUrl;
let mode = "success";
let user;
const userIds = [];

function providerDraft() {
  return { recipeName: "Provider Draft", assumptions: [], ingredients: [{ name: "flour", quantity: 1, unit: "cup", notes: null }], steps: [{ instruction: "Mix the ingredients." }], tags: [], questions: [], substitutions: [] };
}

before(async () => {
  provider = http.createServer((req, res) => {
    if (mode === "hang") {
      return;
    }
    if (mode === "fail") {
      res.writeHead(500);
      res.end("temporary failure");
      return;
    }
    if (mode === "retry" && !provider.retried) {
      provider.retried = true;
      res.writeHead(500);
      res.end("retry once");
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: { role: "assistant", content: JSON.stringify(providerDraft()) } }));
  });
  await new Promise((resolve) => provider.listen(0, "127.0.0.1", resolve));
  providerUrl = `http://127.0.0.1:${provider.address().port}/api/chat`;
  await startServer({ LLM_PROVIDER: "ollama", OLLAMA_API_URL: providerUrl, LLM_OFFLINE_MODE: "false", LLM_TIMEOUT_MS: "150" });
  user = await registerTestUser();
  userIds.push(user.userId);
});

after(async () => {
  await stopServer();
  await removeTestUsers(userIds);
  provider.closeAllConnections?.();
  await new Promise((resolve) => provider.close(resolve));
});

test("provider 500 falls back to an offline draft", async () => {
  mode = "fail";
  const response = await request("POST", "/recipes/suggest", { recipeName: "Fallback Recipe" }, user.token);
  assert.equal(response.status, 200);
  assert.equal(response.body.source, "offline-fallback");
  assert.equal(response.body.fallbackReason, "provider_error");
  assert.equal(response.body.promptVersion, undefined);
});

test("provider retry succeeds after one 500 response", async () => {
  mode = "retry";
  provider.retried = false;
  const response = await request("POST", "/recipes/suggest", { recipeName: "Retry Recipe" }, user.token);
  assert.equal(response.status, 200);
  assert.equal(response.body.source, "ollama");
  assert.ok(response.body.promptVersion);
});

test("provider timeout falls back without a second long wait", async () => {
  mode = "hang";
  const startedAt = Date.now();
  const response = await request("POST", "/recipes/suggest", { recipeName: "Timeout Recipe" }, user.token);
  assert.equal(response.status, 200);
  assert.equal(response.body.source, "offline-fallback");
  assert.ok(Date.now() - startedAt < 1000);
});

test("assistant provider failure also returns a labeled fallback", async () => {
  mode = "fail";
  const created = await request("POST", "/recipes", { name: "Assistant Fallback Recipe" }, user.token);
  const response = await request("POST", "/recipes/assistant", { recipeId: created.body.recipe.id, question: "What should I do?" }, user.token);
  assert.equal(response.status, 200);
  assert.equal(response.body.source, "offline-fallback");
  assert.equal(response.body.fallbackReason, "provider_error");
});
