const catalog = [
  { allergen: "dairy", base: "milk", substitute: "oat milk", notes: "Check the label and choose an unsweetened product when the recipe is savory." },
  { allergen: "dairy", base: "butter", substitute: "plant-based butter", notes: "Plant-based products vary in water and salt content." },
  { allergen: "dairy", base: "cheese", substitute: "nutritional yeast", notes: "Nut-based cheese alternatives may introduce another allergen." },
  { allergen: "peanuts", base: "peanut butter", substitute: "sunflower seed butter", notes: "Check the label for shared-equipment warnings." },
  { allergen: "tree nuts", base: "almond flour", substitute: "oat flour", notes: "Use a certified product when cross-contact must be avoided." },
  { allergen: "eggs", base: "eggs", substitute: "commercial egg replacer", notes: "Egg replacers do not work the same way in every recipe." },
  { allergen: "eggs", base: "egg", substitute: "commercial egg replacer", notes: "Egg replacers do not work the same way in every recipe." },
  { allergen: "gluten", base: "all-purpose flour", substitute: "certified gluten-free flour blend", notes: "Some blends require an added binder." },
  { allergen: "gluten", base: "bread", substitute: "certified gluten-free bread", notes: "Certification matters when cross-contact must be avoided." },
];

export const supportedAllergens = [...new Set(catalog.map((item) => item.allergen))];

export async function ensureSubstitutionCatalog(prisma) {
  for (const item of catalog) {
    const allergen = await prisma.allergen.upsert({ where: { name: item.allergen }, update: {}, create: { name: item.allergen } });
    const ingredient = await prisma.ingredient.upsert({ where: { name: item.base }, update: {}, create: { name: item.base } });
    const substitute = await prisma.ingredient.upsert({ where: { name: item.substitute }, update: {}, create: { name: item.substitute } });
    const existing = await prisma.ingredientSubstitute.findFirst({ where: { ingredientId: ingredient.id, substituteId: substitute.id, allergenId: allergen.id } });
    if (!existing) await prisma.ingredientSubstitute.create({ data: { ingredientId: ingredient.id, substituteId: substitute.id, allergenId: allergen.id, notes: item.notes } });
  }
}

export function normalizeAllergenName(value) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function ingredientNameMatches(name, target) {
  return normalizeAllergenName(name) === normalizeAllergenName(target);
}
