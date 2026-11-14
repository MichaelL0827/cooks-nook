import { createHash } from "node:crypto";

export function promptVersion(...prompts) {
  return createHash("sha256").update(prompts.join("\n")).digest("hex").slice(0, 8);
}

export function debugLlmResponse(event, payload) {
  if (process.env.LLM_DEBUG_LOG?.trim().toLowerCase() === "true") console.log(JSON.stringify({ event, ...payload }));
}

export async function fetchWithRetry(url, options = {}, { timeoutMs = 45_000 } = {}) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
      if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const delayMs = Number.isFinite(retryAfter) ? Math.min(Math.max(retryAfter * 1000, 1000), 3000) : 1000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      return response;
    } catch (error) {
      if (attempt === 1 || error.name === "AbortError" || error.name === "TimeoutError") throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}
