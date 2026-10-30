-- Prevent concurrent catalog initialization from creating duplicate mappings.
WITH duplicates AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "ingredientId", "substituteId", "allergenId"
    ORDER BY "id"
  ) AS row_number
  FROM "IngredientSubstitute"
)
DELETE FROM "IngredientSubstitute"
WHERE "id" IN (SELECT "id" FROM duplicates WHERE row_number > 1);

CREATE UNIQUE INDEX "IngredientSubstitute_ingredientId_substituteId_allergenId_key"
ON "IngredientSubstitute"("ingredientId", "substituteId", "allergenId");
