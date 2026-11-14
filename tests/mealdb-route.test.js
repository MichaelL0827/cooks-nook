import assert from "node:assert/strict";
import http from "node:http";
import { after, before, test } from "node:test";
import { registerTestUser, removeTestUsers, request, startServer, stopServer } from "./helpers.js";

let mealDb;
let baseUrl;
let user;
let observedMethod;
const userIds = [];

before(async () => {
  mealDb = http.createServer((req, res) => {
    observedMethod = req.method;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ meals: [{
      strMeal: "Route Test Soup",
      strIngredient1: "Carrot",
      strMeasure1: "2 cups",
      strInstructions: "Chop the carrots.\nSimmer until tender.",
      strSource: "https://example.com/route-test-soup",
      strMealThumb: "https://example.com/route-test-soup.jpg",
    }] }));
  });
  await new Promise((resolve) => mealDb.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${mealDb.address().port}`;
  await startServer({ MEALDB_ENABLED: "true", MEALDB_API_URL: baseUrl, LLM_OFFLINE_MODE: "true" });
  user = await registerTestUser();
  userIds.push(user.userId);
});

after(async () => {
  await stopServer();
  await removeTestUsers(userIds);
  await new Promise((resolve) => mealDb.close(resolve));
});

test("TheMealDB attribution fields survive the suggestion route", async () => {
  const response = await request("POST", "/recipes/suggest", { recipeName: "Route Test Soup" }, user.token);

  assert.equal(response.status, 200);
  assert.equal(response.body.source, "themealdb");
  assert.equal(observedMethod, "GET");
  assert.equal(response.body.suggestion.sourceUrl, "https://example.com/route-test-soup");
  assert.equal(response.body.suggestion.imageUrl, "https://example.com/route-test-soup.jpg");
});
