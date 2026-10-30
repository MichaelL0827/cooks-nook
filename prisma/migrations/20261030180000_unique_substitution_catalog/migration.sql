-- Prevent concurrent catalog initialization from creating duplicate mappings.
CREATE UNIQUE INDEX "IngredientSubstitute_ingredientId_substituteId_allergenId_key"
ON "IngredientSubstitute"("ingredientId", "substituteId", "allergenId");
