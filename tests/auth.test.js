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

test("registration returns a user and token", () => {
  assert.ok(user.userId);
  assert.ok(user.token);
});

test("login returns a token for valid credentials", async () => {
  const response = await request("POST", "/auth/login", {
    email: user.email,
    password: "Password123!",
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.user.id, user.userId);
  assert.ok(response.body.token);
});

test("login rejects an incorrect password", async () => {
  const response = await request("POST", "/auth/login", {
    email: user.email,
    password: "wrong-password",
  });

  assert.equal(response.status, 401);
});

test("protected routes reject requests without a token", async () => {
  const response = await request("GET", "/me");

  assert.equal(response.status, 401);
});

test("the token identifies the current user", async () => {
  const response = await request("GET", "/me", undefined, user.token);

  assert.equal(response.status, 200);
  assert.equal(response.body.user.id, user.userId);
  assert.equal(response.body.user.email, user.email);
});
