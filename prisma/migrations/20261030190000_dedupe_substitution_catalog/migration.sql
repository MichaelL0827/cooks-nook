-- Remove duplicate mappings before relying on the unique compound index.
WITH duplicates AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "ingredientId", "substituteId", "allergenId"
    ORDER BY "id"
  ) AS row_number
  FROM "IngredientSubstitute"
)
DELETE FROM "IngredientSubstitute"
WHERE "id" IN (SELECT "id" FROM duplicates WHERE row_number > 1);
