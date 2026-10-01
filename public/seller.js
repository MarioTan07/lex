import { $, el, rp, t, api, toast, shrinkPhoto, confirmTap, locationEditor } from "/common.js";

let me = null;
let products = [];
let editingId = null;
let editingName = "";
let pendingPhoto = null;

const shopLoc = locationEditor("s-shop", "shop", "seller.shopHint");
const homeLoc = locationEditor("s-home", "home", "seller.homeHint");
$("#s-shop").replaceWith(shopLoc.node);
$("#s-home").replaceWith(homeLoc.node);

// ---------- session ----------
async function start() {
  const { user } = await api("/api/me").catch(() => ({ user: null }));
  if (user && user.role === "admin") { location.href = "/admin"; return; }
  me = user;
  $("#authView").hidden = !!me;
  $("#deskView").hidden = !me;
  $("#logoutBtn").hidden = !me;
  if (me) { renderHead(); fillProfile(); loadProducts(); }
}

function showErr(id, msg) { const p = $(id); p.textContent = msg; p.hidden = !msg; }

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault(); showErr("#loginErr", "");
  try { await api("/api/auth/login", { method: "POST", body: { email: $("#l-email").value, password: $("#l-pass").value, role: "seller" } }); start(); }
  catch (err) { showErr("#loginErr", err.message); }
});
$("#logoutBtn").addEventListener("click", async () => { await api("/api/auth/logout", { method: "POST" }).catch(() => {}); me = null; start(); });

function renderHead() {
  $("#stallTitle").textContent = me.stallName;
  const pill = $("#statusPill");
  pill.className = "pill " + me.status;
  pill.textContent = me.status === "approved" ? t("seller.live") : me.status === "pending" ? t("seller.waiting") : t("sellerStatus." + me.status);
  const b = $("#statusBanner");
  b.hidden = me.status === "approved";
  b.textContent = t("seller.pendingBanner");
}
function fillProfile() {
  $("#s-name").value = me.name; $("#s-stall").value = me.stallName; $("#s-phone").value = me.phone;
  shopLoc.set(me.shop); homeLoc.set(me.home);
}

// Session expired or account suspended mid-visit.
function handle(err) {
  if (err.status === 401) { toast(t("signedOut")); me = null; start(); return; }
  toast(err.message);
}

// ---------- products ----------
async function loadProducts() {
  try { ({ products } = await api("/api/seller/products")); } catch (e) { return handle(e); }
  renderProducts();
}
function renderProducts() {
  const box = $("#myProducts"); box.replaceChildren();
  if (!products.length) { box.append(el("p", { class: "muted", text: t("mine.empty") })); return; }
  for (const p of products) {
    box.append(el("div", { class: "item" },
      p.photo ? el("img", { src: p.photo, alt: "" }) : el("div", { class: "ph" }),
      el("div", {},
        el("div", { style: "font-weight:600" }, p.name, p.hidden ? el("span", { class: "pill hidden", style: "margin-left:8px", text: t("mine.hiddenByAdmin") }) : null),
        el("div", { class: "price", style: "font-size:.875rem" }, rp(p.price), p.unit ? el("small", { text: " / " + p.unit }) : null,
          p.available ? null : el("small", { text: t("mine.soldOut") }))),
      el("div", { class: "acts" },
        el("button", { class: "btn small ghost", onclick: () => editProduct(p) }, t("common.edit")),
        el("button", { class: "btn small ghost", onclick: () => setAvailable(p, !p.available) }, p.available ? t("mine.markSoldOut") : t("mine.backOnSale")),
        el("button", { class: "btn small warn", onclick: (ev) => confirmTap(ev.currentTarget, t("mine.confirm"), () => removeProduct(p)) }, t("mine.remove")))));
  }
}
async function setAvailable(p, available) {
  try { await api("/api/seller/products/" + p.id, { method: "PATCH", body: { available } }); toast(t(available ? "mine.backOnSaleToast" : "mine.soldOutToast", { name: p.name })); loadProducts(); }
  catch (e) { handle(e); }
}
async function removeProduct(p) {
  try { await api("/api/seller/products/" + p.id, { method: "DELETE" }); toast(t("mine.removed", { name: p.name })); if (editingId === p.id) resetProductForm(); loadProducts(); }
  catch (e) { handle(e); }
}
// Title and button of the product form, which say "add" or "edit <name>".
function labelProductForm() {
  $("#productFormTitle").textContent = editingId ? t("common.editTitle", { name: editingName }) : t("product.addTitle");
  $("#saveProductBtn").textContent = t(editingId ? "common.saveChanges" : "product.addButton");
}
function editProduct(p) {
  editingId = p.id; editingName = p.name;
  labelProductForm();
  $("#cancelEditBtn").hidden = false;
  $("#p-name").value = p.name; $("#p-price").value = p.price; $("#p-unit").value = p.unit; $("#p-desc").value = p.description;
  pendingPhoto = null; $("#p-photo").value = "";
  $("#p-preview").src = p.photo || ""; $("#p-preview").hidden = !p.photo;
  $("#productForm").scrollIntoView({ behavior: "smooth", block: "start" });
}
function resetProductForm() {
  editingId = null; pendingPhoto = null;
  $("#productForm").reset();
  $("#p-preview").hidden = true;
  labelProductForm();
  $("#cancelEditBtn").hidden = true;
}
$("#cancelEditBtn").addEventListener("click", resetProductForm);

$("#p-photo").addEventListener("change", async (e) => {
  const f = e.target.files[0]; pendingPhoto = null;
  if (!f) return;
  try { pendingPhoto = await shrinkPhoto(f); $("#p-preview").src = pendingPhoto; $("#p-preview").hidden = false; }
  catch { toast(t("product.badPhoto")); e.target.value = ""; }
});

$("#productForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#saveProductBtn");
  btn.disabled = true; btn.textContent = t("product.saving");
  const body = { name: $("#p-name").value, price: $("#p-price").value, unit: $("#p-unit").value, description: $("#p-desc").value };
  if (pendingPhoto) body.photo = pendingPhoto;
  try {
    if (editingId) await api("/api/seller/products/" + editingId, { method: "PATCH", body });
    else await api("/api/seller/products", { method: "POST", body });
    toast(t(editingId ? "product.saved" : me.status === "approved" ? "product.addedLive" : "product.addedPending"));
    resetProductForm(); loadProducts();
  } catch (err) { handle(err); }
  btn.disabled = false; labelProductForm();
});

// ---------- profile & password ----------
$("#profileForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errBox = $("#profileErr"); errBox.hidden = true;
  try {
    const body = { name: $("#s-name").value, stallName: $("#s-stall").value, phone: $("#s-phone").value, shop: shopLoc.get(), home: homeLoc.get() };
    ({ user: me } = await api("/api/seller/profile", { method: "PATCH", body }));
    renderHead(); fillProfile(); toast(t("profile.saved"));
  } catch (err) {
    if (err.status) return handle(err);
    errBox.textContent = err.message; errBox.hidden = false;
  }
});
$("#passwordForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try { await api("/api/auth/password", { method: "POST", body: { current: $("#pw-cur").value, next: $("#pw-new").value } }); e.target.reset(); toast(t("common.passwordChanged")); }
  catch (err) { handle(err); }
});

window.addEventListener("langchange", () => {
  labelProductForm();
  if (me) { renderHead(); renderProducts(); }
});

labelProductForm();
start();
