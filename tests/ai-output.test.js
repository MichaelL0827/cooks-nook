import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeAssistantAnswer, normalizeSuggestionShape } from "../src/lib/aiOutput.js";

test("assistant output is trimmed, deduplicated, and given safety guidance", () => {
  const answer = normalizeAssistantAnswer({
    answer: "  Explain the cue.  ",
    safetyNotes: [" Check the label. ", "check the label."],
    followUpQuestions: [" What step? ", "what step?", ""],
  });

  assert.deepEqual(answer, {
    answer: "Explain the cue.",
    safetyNotes: ["Check the label."],
    followUpQuestions: ["What step?"],
  });
});

test("assistant output supplies a safe default for an incomplete provider response", () => {
  const answer = normalizeAssistantAnswer({ answer: " " });

  assert.match(answer.answer, /could not produce a clear answer/i);
  assert.equal(answer.safetyNotes.length, 1);
  assert.deepEqual(answer.followUpQuestions, []);
});

test("assistant output does not add boilerplate safety notes to harmless answers", () => {
  const answer = normalizeAssistantAnswer({ answer: "Simmering means cooking gently below a full boil.", safetyNotes: [] });

  assert.deepEqual(answer.safetyNotes, []);
});

test("assistant output keeps a safety note for recipes with high-risk ingredients", () => {
  const answer = normalizeAssistantAnswer({ answer: "Cook the chicken until done.", safetyNotes: [] }, { hasHighRiskIngredient: true });

  assert.equal(answer.safetyNotes.length, 1);
});

test("suggestion shape keeps the editable collections predictable", () => {
  const suggestion = normalizeSuggestionShape({
    recipeName: "  Pancakes ",
    assumptions: [" uncertain ", "UNCERTAIN"],
    tags: [" breakfast ", "BREAKFAST"],
    ingredients: null,
    steps: [{ instruction: "Mix." }],
    questions: undefined,
    substitutions: null,
  }, "Fallback name");

  assert.deepEqual(suggestion, {
    recipeName: "Pancakes",
    assumptions: ["uncertain"],
    ingredients: [],
    steps: [{ instruction: "Mix." }],
    tags: ["breakfast"],
    questions: [],
    substitutions: [],
  });
});

test("suggestion shape repairs numbered and alternate step formats", () => {
  const suggestion = normalizeSuggestionShape({
    recipeName: "Soup",
    ingredients: [],
    steps: [
      { text: "1. Chop the vegetables." },
      { description: "2) Simmer until tender." },
      "3. Serve warm.",
      { step: "" },
    ],
  }, "Soup");

  assert.deepEqual(suggestion.steps, [
    { instruction: "Chop the vegetables." },
    { instruction: "Simmer until tender." },
    { instruction: "Serve warm." },
  ]);
});

test("step cleanup preserves temperatures and decimal quantities", () => {
  const suggestion = normalizeSuggestionShape({
    recipeName: "Soup",
    steps: [
      { instruction: "Bake at 350. Cool for 10 minutes." },
      { instruction: "1.5 cups milk should be measured first." },
    ],
  }, "Soup");

  assert.deepEqual(suggestion.steps, [
    { instruction: "Bake at 350. Cool for 10 minutes." },
    { instruction: "1.5 cups milk should be measured first." },
  ]);
});

test("suggestion shape preserves TheMealDB attribution fields", () => {
  const suggestion = normalizeSuggestionShape({
    recipeName: "Imported Soup",
    sourceUrl: "https://example.com/source",
    imageUrl: "https://example.com/image.jpg",
  }, "Soup", { preserveAttribution: true });

  assert.equal(suggestion.sourceUrl, "https://example.com/source");
  assert.equal(suggestion.imageUrl, "https://example.com/image.jpg");
});

test("suggestion shape rejects unsafe attribution URLs", () => {
  const suggestion = normalizeSuggestionShape({
    recipeName: "Untrusted Soup",
    sourceUrl: "javascript:alert(1)",
    imageUrl: "data:text/html,bad",
  }, "Soup", { preserveAttribution: true });

  assert.equal(suggestion.sourceUrl, undefined);
  assert.equal(suggestion.imageUrl, undefined);
});
