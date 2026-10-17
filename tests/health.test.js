import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { request, startServer, stopServer } from "./helpers.js";

before(startServer);
after(stopServer);

test("health endpoint reports that the API is running", async () => {
  const response = await request("GET", "/health");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: "ok" });
});
