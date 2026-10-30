export const catalog = [
  { allergen: "dairy", base: "milk", aliases: ["milk", "whole milk", "2% milk", "1% milk", "skim milk"], substitute: "oat milk", notes: "Check the label and choose an unsweetened product when the recipe is savory." },
  { allergen: "dairy", base: "butter", aliases: ["butter", "unsalted butter", "salted butter"], substitute: "plant-based butter", notes: "Plant-based products vary in water and salt content." },
  { allergen: "dairy", base: "cream", aliases: ["cream", "heavy cream", "whipping cream"], substitute: "coconut cream", notes: "Coconut is a separate allergen for some people and changes the flavor." },
  { allergen: "dairy", base: "yogurt", aliases: ["yogurt", "greek yogurt"], substitute: "unsweetened coconut yogurt", notes: "Coconut is a separate allergen for some people; check the label." },
  { allergen: "dairy", base: "sour cream", aliases: ["sour cream"], substitute: "dairy-free sour cream", notes: "Check the label for soy or nut ingredients." },
  { allergen: "dairy", base: "buttermilk", aliases: ["buttermilk"], substitute: "oat milk with lemon juice", notes: "Let the mixture stand briefly to mimic buttermilk acidity." },
  { allergen: "dairy", base: "whey", aliases: ["whey", "whey protein"], substitute: "pea protein", notes: "Protein powders vary in behavior; check the label and recipe ratios." },
  { allergen: "dairy", base: "cheese", aliases: ["cheese", "parmesan", "parmesan cheese", "cheddar", "mozzarella"], substitute: "nutritional yeast", notes: "Nut-based cheese alternatives may introduce another allergen." },
  { allergen: "peanuts", base: "peanut butter", aliases: ["peanut butter", "peanuts", "peanut"], substitute: "sunflower seed butter", notes: "Check the label for shared-equipment warnings." },
  { allergen: "tree nuts", base: "whole tree nuts", aliases: ["almonds", "almond", "walnuts", "walnut", "cashews", "cashew", "pecans", "pecan", "hazelnuts", "hazelnut", "pistachios", "pistachio"], substitute: "sunflower seeds", notes: "Use a certified product when cross-contact must be avoided." },
  { allergen: "tree nuts", base: "almond flour", aliases: ["almond flour"], substitute: "oat flour", notes: "Use a certified product when cross-contact must be avoided." },
  { allergen: "eggs", base: "eggs", aliases: ["egg", "eggs", "egg white", "egg whites"], substitute: "commercial egg replacer", notes: "Egg replacers do not work the same way in every recipe." },
  { allergen: "eggs", base: "mayonnaise", aliases: ["mayonnaise", "mayo"], substitute: "egg-free mayonnaise", notes: "Check the label for dairy, soy, or other allergens." },
  { allergen: "gluten", base: "flour", aliases: ["flour", "all-purpose flour", "whole-wheat flour", "wheat flour", "bread flour"], substitute: "certified gluten-free flour blend", notes: "Some blends require an added binder." },
  { allergen: "gluten", base: "barley", aliases: ["barley"], substitute: "certified gluten-free grains", notes: "Check the replacement grain's cooking time and label." },
  { allergen: "gluten", base: "rye", aliases: ["rye"], substitute: "certified gluten-free grains", notes: "Check the replacement grain's cooking time and label." },
  { allergen: "gluten", base: "couscous", aliases: ["couscous"], substitute: "certified gluten-free quinoa", notes: "Quinoa changes the texture and cooking time." },
  { allergen: "gluten", base: "breadcrumbs", aliases: ["breadcrumbs", "bread crumbs"], substitute: "certified gluten-free breadcrumbs", notes: "Check the label for wheat and cross-contact." },
  { allergen: "gluten", base: "pasta", aliases: ["pasta", "wheat pasta"], substitute: "certified gluten-free pasta", notes: "Check the package for certification and shared-equipment warnings." },
  { allergen: "gluten", base: "flour tortillas", aliases: ["flour tortilla", "flour tortillas", "tortilla", "tortillas"], substitute: "certified gluten-free corn tortillas", notes: "Plain tortillas vary; verify whether they contain wheat before substituting." },
  { allergen: "gluten", base: "soy sauce", aliases: ["soy sauce", "soya sauce"], substitute: "certified gluten-free tamari", notes: "Not all tamari is gluten-free; check the label." },
  { allergen: "gluten", base: "bread", aliases: ["bread", "wheat bread"], substitute: "certified gluten-free bread", notes: "Certification matters when cross-contact must be avoided." },
  { allergen: "soy", base: "soy sauce", aliases: ["soy sauce", "soya sauce"], substitute: "coconut aminos", notes: "Coconut is a separate allergen for some people; check the label." },
];

export const supportedAllergens = [...new Set([...catalog.map((item) => item.allergen), "shellfish", "fish", "sesame"])]

const allergenAliases = new Map([
  ["dairy", "dairy"], ["milk", "dairy"], ["lactose", "dairy"],
  ["peanut", "peanuts"], ["peanuts", "peanuts"], ["soy", "soy"], ["soya", "soy"], ["soybeans", "soy"],
  ["shellfish", "shellfish"], ["shrimp", "shellfish"], ["prawns", "shellfish"], ["crab", "shellfish"], ["lobster", "shellfish"],
  ["fish", "fish"], ["seafood", ["fish", "shellfish"]],
  ["sesame", "sesame"],
  ["nut", ["peanuts", "tree nuts"]], ["nuts", ["peanuts", "tree nuts"]], ["tree nut", "tree nuts"], ["tree nuts", "tree nuts"], ["almond", "tree nuts"], ["walnut", "tree nuts"],
  ["egg", "eggs"], ["eggs", "eggs"],
  ["wheat", "gluten"], ["gluten", "gluten"],
]);

export async function ensureSubstitutionCatalog(prisma) {
  const currentKeys = new Set(catalog.map((item) => `${item.allergen}|${item.base}|${item.substitute}`));
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
  const existing = await prisma.ingredientSubstitute.findMany({ include: { ingredient: true, substitute: true, allergen: true } });
  const staleIds = existing.filter((row) => !currentKeys.has(`${row.allergen.name}|${row.ingredient.name}|${row.substitute.name}`)).map((row) => row.id);
  if (staleIds.length > 0) await prisma.ingredientSubstitute.deleteMany({ where: { id: { in: staleIds } } });
}

export function normalizeAllergenName(value) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  const result = allergenAliases.get(normalized) || normalized;
  return Array.isArray(result) ? result[0] : result;
}

export function normalizeAllergenNames(value) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  const result = allergenAliases.get(normalized) || normalized;
  return Array.isArray(result) ? result : [result];
}

export function ingredientNameMatches(name, target) {
  const item = catalog.find((entry) => entry.base === target);
  const aliases = item?.aliases || [target];
  const normalized = name.trim().toLowerCase().replace(/\s+/g, " ");
  return aliases.some((alias) => normalized === alias);
}
