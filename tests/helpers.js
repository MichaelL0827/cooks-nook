import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import prisma from "../src/lib/prisma.js";

let baseUrl = "";

let serverProcess;

async function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

export async function startServer() {
  const port = process.env.TEST_PORT ?? (await findAvailablePort());
  baseUrl = `http://localhost:${port}`;
  serverProcess = spawn(process.execPath, ["src/index.js"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: port, LLM_OFFLINE_MODE: "true" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  const onOutput = (chunk) => {
    output += chunk.toString();
  };
  serverProcess.stdout.on("data", onOutput);
  serverProcess.stderr.on("data", onOutput);

  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (output.includes("Cooks Nook API listening")) return;
    if (serverProcess.exitCode !== null) {
      throw new Error(`Test server exited early:\n${output}`);
    }
    await delay(100);
  }

  const timedOutProcess = serverProcess;
  serverProcess = undefined;
  timedOutProcess.kill();
  throw new Error(`Timed out waiting for test server:\n${output}`);
}

export async function stopServer() {
  if (!serverProcess) return;
  const processToStop = serverProcess;
  serverProcess = undefined;
  processToStop.kill();
  await new Promise((resolve) => processToStop.once("exit", resolve));
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
