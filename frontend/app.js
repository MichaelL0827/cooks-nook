const state = { token: localStorage.getItem("cooks-nook-token"), email: localStorage.getItem("cooks-nook-email"), recipes: [], selectedId: null, authMode: "login", editingId: null };
const $ = (selector) => document.querySelector(selector);

async function api(path, options = {}) {
  const headers = { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}) };
  const response = await fetch(path, { ...options, headers });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(body?.error || "Something went wrong.");
  return body;
}

function showApp() { $("#auth-view").classList.add("hidden"); $("#app-view").classList.remove("hidden"); $("#user-email").textContent = state.email; loadRecipes(); }
function showAuth() { $("#app-view").classList.add("hidden"); $("#auth-view").classList.remove("hidden"); }
function setMessage(selector, message = "") { $(selector).textContent = message; }

async function loadRecipes() {
  try { state.recipes = (await api("/recipes")).recipes; renderRecipeList(); if (state.selectedId) await selectRecipe(state.selectedId); else if (state.recipes[0]) await selectRecipe(state.recipes[0].id); else showEmpty(); }
  catch (error) { logout(error.message); }
}

function renderRecipeList() {
  const query = $("#recipe-search").value.trim().toLowerCase();
  const recipes = state.recipes.filter((recipe) => recipe.name.toLowerCase().includes(query));
  $("#recipe-list").innerHTML = recipes.length ? recipes.map((recipe) => `<button class="recipe-card ${recipe.id === state.selectedId ? "selected" : ""}" data-recipe-id="${recipe.id}"><strong>${escapeHtml(recipe.name)}</strong><small>${recipe.servings ? `${recipe.servings} servings` : "Recipe"}</small></button>`).join("") : `<p class="muted">No recipes found.</p>`;
  document.querySelectorAll("[data-recipe-id]").forEach((button) => button.addEventListener("click", () => selectRecipe(button.dataset.recipeId)));
}

async function selectRecipe(id) {
  const data = await api(`/recipes/${id}`); state.selectedId = id; renderRecipeList(); $("#empty-state").classList.add("hidden"); $("#recipe-form").classList.add("hidden"); $("#recipe-detail").classList.remove("hidden");
  const recipe = data.recipe; const tags = recipe.tags.map(({ tag }) => `<span class="tag">${escapeHtml(tag.name)}</span>`).join("");
  $("#recipe-detail").innerHTML = `<div class="detail-heading"><div><p class="eyebrow">Saved recipe</p><h1>${escapeHtml(recipe.name)}</h1><div class="detail-meta">${recipe.servings ? `${recipe.servings} servings` : ""}${recipe.prepMinutes !== null ? ` · ${recipe.prepMinutes} min prep` : ""}${recipe.cookMinutes !== null ? ` · ${recipe.cookMinutes} min cook` : ""}</div><div>${tags}</div></div><div class="detail-actions"><button class="button ghost" id="edit-recipe">Edit</button><button class="button ghost" id="delete-recipe">Delete</button></div></div><div class="detail-columns"><section><h3>Ingredients</h3><ul class="ingredient-list">${recipe.ingredients.map((item) => `<li>${item.quantity ?? ""} ${escapeHtml(item.unit || "")} ${escapeHtml(item.ingredient.name)}${item.notes ? `, ${escapeHtml(item.notes)}` : ""}</li>`).join("")}</ul></section><section><h3>Steps</h3><ol class="step-list">${recipe.steps.map((step) => `<li>${escapeHtml(step.instruction)}</li>`).join("")}</ol></section></div><section class="assistant"><h3>Cooking assistant</h3><p class="muted">The AI assistant will be connected here next. It will use this recipe to clarify vague instructions and suggest techniques or substitutions.</p></section>`;
  $("#edit-recipe").addEventListener("click", () => openEditor(recipe)); $("#delete-recipe").addEventListener("click", () => deleteRecipe(recipe.id));
}

function showEmpty() { $("#empty-state").classList.remove("hidden"); $("#recipe-form").classList.add("hidden"); $("#recipe-detail").classList.add("hidden"); state.selectedId = null; renderRecipeList(); }
function openNewEditor() { state.editingId = null; $("#editor-eyebrow").textContent = "New recipe"; $("#recipe-form").reset(); renderIngredientFields([{}]); renderStepFields([{}]); openEditorView(); }
function openEditor(recipe) { state.editingId = recipe.id; $("#editor-eyebrow").textContent = "Edit recipe"; $("#recipe-name").value = recipe.name; $("#recipe-servings").value = recipe.servings ?? ""; $("#recipe-prep").value = recipe.prepMinutes ?? ""; $("#recipe-cook").value = recipe.cookMinutes ?? ""; $("#recipe-tags").value = recipe.tags.map(({ tag }) => tag.name).join(", "); renderIngredientFields(recipe.ingredients); renderStepFields(recipe.steps); openEditorView(); }
function openEditorView() { $("#empty-state").classList.add("hidden"); $("#recipe-detail").classList.add("hidden"); $("#recipe-form").classList.remove("hidden"); }
function renderIngredientFields(items) { $("#ingredient-fields").innerHTML = items.map((item, index) => `<div class="field-row ingredient-row"><input data-field="name" value="${escapeAttr(item.ingredient?.name || item.name || "")}" placeholder="Ingredient" required /><input data-field="quantity" value="${item.quantity ?? ""}" type="number" min="0" step="any" placeholder="Qty" /><input data-field="unit" value="${escapeAttr(item.unit || "")}" placeholder="Unit" /><button type="button" class="remove-button" data-remove="ingredient" aria-label="Remove ingredient">×</button></div>`).join(""); }
function renderStepFields(items) { $("#step-fields").innerHTML = items.map((item, index) => `<div class="field-row step"><span class="step-number">${index + 1}</span><input data-field="instruction" value="${escapeAttr(item.instruction || "")}" placeholder="Describe this step" required /><button type="button" class="remove-button" data-remove="step" aria-label="Remove step">×</button></div>`).join(""); }
function collectRecipe() { const ingredients = [...document.querySelectorAll(".ingredient-row")].map((row) => ({ name: row.querySelector('[data-field="name"]').value, quantity: row.querySelector('[data-field="quantity"]').value ? Number(row.querySelector('[data-field="quantity"]').value) : undefined, unit: row.querySelector('[data-field="unit"]').value || undefined })).filter((item) => item.name.trim()); const steps = [...document.querySelectorAll(".field-row.step")].map((row) => ({ instruction: row.querySelector('[data-field="instruction"]').value })).filter((step) => step.instruction.trim()); const body = { name: $("#recipe-name").value, ingredients, steps, tags: $("#recipe-tags").value.split(",").map((tag) => tag.trim()).filter(Boolean) }; for (const [key, id] of [["servings", "recipe-servings"], ["prepMinutes", "recipe-prep"], ["cookMinutes", "recipe-cook"]]) if ($("#" + id).value) body[key] = Number($("#" + id).value); return body; }

async function saveRecipe(event) { event.preventDefault(); try { const body = collectRecipe(); const result = await api(state.editingId ? `/recipes/${state.editingId}` : "/recipes", { method: state.editingId ? "PUT" : "POST", body: JSON.stringify(body) }); state.selectedId = result.recipe.id; await loadRecipes(); } catch (error) { setMessage("#recipe-message", error.message); } }
async function deleteRecipe(id) { if (!confirm("Delete this recipe?")) return; try { await api(`/recipes/${id}`, { method: "DELETE" }); state.selectedId = null; await loadRecipes(); } catch (error) { alert(error.message); } }
function logout(message = "") { localStorage.removeItem("cooks-nook-token"); localStorage.removeItem("cooks-nook-email"); state.token = null; state.email = null; setMessage("#auth-message", message); showAuth(); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[char]); }
function escapeAttr(value) { return escapeHtml(value); }

document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => { state.authMode = button.dataset.mode; document.querySelectorAll("[data-mode]").forEach((item) => item.classList.toggle("active", item === button)); $("#auth-submit").textContent = state.authMode === "login" ? "Log in" : "Create account"; $("#auth-password").setAttribute("autocomplete", state.authMode === "login" ? "current-password" : "new-password"); setMessage("#auth-message"); }));
$("#auth-form").addEventListener("submit", async (event) => { event.preventDefault(); setMessage("#auth-message", ""); try { const response = await api(`/auth/${state.authMode === "login" ? "login" : "register"}`, { method: "POST", body: JSON.stringify({ email: $("#auth-email").value, password: $("#auth-password").value }) }); state.token = response.token; state.email = response.user.email; localStorage.setItem("cooks-nook-token", state.token); localStorage.setItem("cooks-nook-email", state.email); showApp(); } catch (error) { setMessage("#auth-message", error.message); } });
$("#logout-button").addEventListener("click", () => logout()); $("#new-recipe-button").addEventListener("click", openNewEditor); $("#empty-new-button").addEventListener("click", openNewEditor); $("#cancel-button").addEventListener("click", () => state.selectedId ? selectRecipe(state.selectedId) : showEmpty()); $("#recipe-form").addEventListener("submit", saveRecipe); $("#recipe-search").addEventListener("input", renderRecipeList);
$("#add-ingredient").addEventListener("click", () => { const rows = [...document.querySelectorAll(".ingredient-row")].map((row) => ({ name: row.querySelector('[data-field="name"]').value, quantity: row.querySelector('[data-field="quantity"]').value, unit: row.querySelector('[data-field="unit"]').value })); rows.push({}); renderIngredientFields(rows); });
$("#add-step").addEventListener("click", () => { const rows = [...document.querySelectorAll(".field-row.step")].map((row) => ({ instruction: row.querySelector('[data-field="instruction"]').value })); rows.push({}); renderStepFields(rows); });
document.addEventListener("click", (event) => { const button = event.target.closest("[data-remove]"); if (!button) return; const row = button.closest(".field-row"); row.remove(); document.querySelectorAll(".field-row.step .step-number").forEach((item, index) => { item.textContent = index + 1; }); });
if (state.token) showApp();
