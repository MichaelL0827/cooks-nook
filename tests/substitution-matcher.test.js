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
  for (const name of ["plant-based butter", "dairy-free sour cream", "coconut yogurt", "coconut cream", "rice milk", "cream of tartar", "butter beans", "sunflower seed butter"]) {
    assert.equal(ingredientMatchesAllergen(name, "dairy"), false, name);
  }
});

test("catalog matching handles compound gluten ingredients and exclusions", () => {
  assert.equal(ingredientNameMatches("penne pasta", "pasta"), true);
  assert.equal(ingredientNameMatches("lasagna noodles", "pasta"), true);
  assert.equal(ingredientNameMatches("corn tortillas", "flour tortillas"), false);
  for (const name of ["gluten-free pasta", "gluten-free flour blend", "gluten-free bread", "rice flour", "rice noodles", "zucchini noodles"]) {
    assert.equal(ingredientMatchesAllergen(name, "gluten"), false, name);
  }
});

test("catalog matching avoids misleading butter matches and scans notes", () => {
  assert.equal(ingredientNameMatches("peanut butter", "butter"), false);
  assert.equal(ingredientMatchesAllergen("sauce", "dairy", "grated parmesan"), true);
  assert.equal(ingredientMatchesAllergen("pasta", "gluten"), true);
  assert.equal(ingredientMatchesAllergen("commercial egg replacer", "eggs"), false);
  assert.equal(ingredientMatchesAllergen("vanilla", "tree nuts", "almond extract"), false);
});
