import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import prisma from "../src/lib/prisma.js";

const port = process.env.TEST_PORT ?? "3101";
export const baseUrl = `http://localhost:${port}`;

let serverProcess;

export async function startServer() {
  serverProcess = spawn(process.execPath, ["src/index.js"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: port },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  const onOutput = (chunk) => {
    output += chunk.toString();
  };
  serverProcess.stdout.on("data", onOutput);
  serverProcess.stderr.on("data", onOutput);

  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (output.includes("Cooks Nook API listening")) return;
    if (serverProcess.exitCode !== null) {
      throw new Error(`Test server exited early:\n${output}`);
    }
    await delay(100);
  }

  throw new Error(`Timed out waiting for test server:\n${output}`);
}

export async function stopServer() {
  if (!serverProcess) return;
  serverProcess.kill();
  serverProcess = undefined;
}

export async function request(method, path, body, token) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
}

export async function registerTestUser() {
  const email = `test-${randomUUID()}@example.com`;
  const response = await request("POST", "/auth/register", {
    email,
    password: "Password123!",
  });

  if (response.status !== 201) {
    throw new Error(`Could not create test user: ${JSON.stringify(response.body)}`);
  }

  return { email, token: response.body.token, userId: response.body.user.id };
}

export async function removeTestUsers(userIds) {
  if (userIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
}
