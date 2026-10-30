export const catalog = [
  { allergen: "dairy", base: "milk", aliases: ["milk", "whole milk", "2% milk", "1% milk", "skim milk"], substitute: "oat milk", notes: "Check the label and choose an unsweetened product when the recipe is savory." },
  { allergen: "dairy", base: "butter", aliases: ["butter", "unsalted butter", "salted butter"], substitute: "plant-based butter", notes: "Plant-based products vary in water and salt content." },
  { allergen: "dairy", base: "cheese", aliases: ["cheese", "parmesan", "parmesan cheese", "cheddar"], substitute: "nutritional yeast", notes: "Nut-based cheese alternatives may introduce another allergen." },
  { allergen: "peanuts", base: "peanut butter", aliases: ["peanut butter", "peanuts", "peanut"], substitute: "sunflower seed butter", notes: "Check the label for shared-equipment warnings." },
  { allergen: "tree nuts", base: "almond flour", aliases: ["almond flour", "almonds", "almond", "walnuts", "walnut"], substitute: "oat flour", notes: "Use a certified product when cross-contact must be avoided." },
  { allergen: "eggs", base: "eggs", aliases: ["egg", "eggs"], substitute: "commercial egg replacer", notes: "Egg replacers do not work the same way in every recipe." },
  { allergen: "gluten", base: "flour", aliases: ["flour", "all-purpose flour", "wheat flour", "bread flour"], substitute: "certified gluten-free flour blend", notes: "Some blends require an added binder." },
  { allergen: "gluten", base: "pasta", aliases: ["pasta", "wheat pasta"], substitute: "certified gluten-free pasta", notes: "Check the package for certification and shared-equipment warnings." },
  { allergen: "gluten", base: "flour tortillas", aliases: ["flour tortilla", "flour tortillas"], substitute: "certified gluten-free corn tortillas", notes: "Corn tortillas are not interchangeable in every recipe." },
  { allergen: "gluten", base: "soy sauce", aliases: ["soy sauce", "soya sauce"], substitute: "certified gluten-free tamari", notes: "Not all tamari is gluten-free; check the label." },
  { allergen: "gluten", base: "bread", aliases: ["bread", "wheat bread"], substitute: "certified gluten-free bread", notes: "Certification matters when cross-contact must be avoided." },
];

export const supportedAllergens = [...new Set(catalog.map((item) => item.allergen))];

const allergenAliases = new Map([
  ["dairy", "dairy"], ["milk", "dairy"], ["lactose", "dairy"],
  ["peanut", "peanuts"], ["peanuts", "peanuts"],
  ["nut", "tree nuts"], ["nuts", "tree nuts"], ["tree nut", "tree nuts"], ["tree nuts", "tree nuts"], ["almond", "tree nuts"], ["walnut", "tree nuts"],
  ["egg", "eggs"], ["eggs", "eggs"],
  ["wheat", "gluten"], ["gluten", "gluten"],
]);

export async function ensureSubstitutionCatalog(prisma) {
  for (const item of catalog) {
    const allergen = await prisma.allergen.upsert({ where: { name: item.allergen }, update: {}, create: { name: item.allergen } });
    const ingredient = await prisma.ingredient.upsert({ where: { name: item.base }, update: {}, create: { name: item.base } });
    const substitute = await prisma.ingredient.upsert({ where: { name: item.substitute }, update: {}, create: { name: item.substitute } });
    await prisma.ingredientSubstitute.upsert({
      where: { ingredientId_substituteId_allergenId: { ingredientId: ingredient.id, substituteId: substitute.id, allergenId: allergen.id } },
      update: { notes: item.notes },
      create: { ingredientId: ingredient.id, substituteId: substitute.id, allergenId: allergen.id, notes: item.notes },
    });
  }
}

export function normalizeAllergenName(value) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  return allergenAliases.get(normalized) || normalized;
}

export function ingredientNameMatches(name, target) {
  const item = catalog.find((entry) => entry.base === target);
  const aliases = item?.aliases || [target];
  const normalized = name.trim().toLowerCase().replace(/\s+/g, " ");
  return aliases.some((alias) => normalized === alias);
}
