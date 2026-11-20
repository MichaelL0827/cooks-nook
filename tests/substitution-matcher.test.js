import assert from "node:assert/strict";
import { test } from "node:test";
import { ingredientMatchesAllergen, ingredientNameMatches } from "../src/lib/substitutions.js";

test("catalog matching handles compound dairy ingredient names", () => {
  assert.equal(ingredientNameMatches("ricotta cheese", "cheese"), true);
  assert.equal(ingredientNameMatches("shredded mozzarella cheese", "cheese"), true);
  assert.equal(ingredientNameMatches("Grated Parmesan", "cheese"), true);
  assert.equal(ingredientNameMatches("almond milk", "milk"), false);
  assert.equal(ingredientMatchesAllergen("almond milk", "dairy"), false);
  assert.equal(ingredientMatchesAllergen("almond milk", "tree nuts"), true);
});

test("catalog matching handles compound gluten ingredients and exclusions", () => {
  assert.equal(ingredientNameMatches("penne pasta", "pasta"), true);
  assert.equal(ingredientNameMatches("lasagna noodles", "pasta"), true);
  assert.equal(ingredientNameMatches("corn tortillas", "flour tortillas"), false);
});

test("catalog matching avoids misleading butter matches and scans notes", () => {
  assert.equal(ingredientNameMatches("peanut butter", "butter"), false);
  assert.equal(ingredientMatchesAllergen("sauce; grated parmesan", "dairy"), true);
  assert.equal(ingredientMatchesAllergen("pasta", "gluten"), true);
});
