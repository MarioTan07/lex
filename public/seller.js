import { $, el, rp, when, t, statusLabel, api, toast, shrinkPhoto, confirmTap, locationEditor } from "/common.js";

let me = null;
let products = [];
let orders = [];
let orderFilter = "open";
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
  if (me) { renderHead(); fillProfile(); loadProducts(); loadOrders(); }
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

// ---------- orders ----------
async function loadOrders() {
  try { ({ orders } = await api("/api/seller/orders")); } catch (e) { return handle(e); }
  renderOrders();
}
document.querySelectorAll("#orderFilter button").forEach((b) => b.addEventListener("click", () => {
  orderFilter = b.dataset.f;
  document.querySelectorAll("#orderFilter button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  renderOrders();
}));

const NEXT = {
  new: [["accepted", "sellerOrders.accept", ""], ["declined", "sellerOrders.decline", "warn"]],
  accepted: [["ready", null, ""], ["declined", "sellerOrders.decline", "warn"]],
  ready: [["done", "sellerOrders.markDone", ""]],
};
function renderOrders() {
  const box = $("#orders"); box.replaceChildren();
  const rank = { new: 0, accepted: 1, ready: 2, done: 3, declined: 4, cancelled: 4 };
  const list = orders
    .filter((o) => orderFilter === "all" || ["new", "accepted", "ready"].includes(o.status))
    .sort((a, b) => rank[a.status] - rank[b.status] || b.createdAt - a.createdAt);
  if (!list.length) {
    box.append(el("div", { class: "empty" }, el("h3", { text: orderFilter === "open" ? t("sellerOrders.noOpen") : t("common.noOrders") }),
      el("p", { text: t("sellerOrders.emptyText") })));
    return;
  }
  for (const o of list) {
    const acts = (NEXT[o.status] || []).map(([status, label, cls]) =>
      el("button", { class: "btn small " + cls, onclick: (ev) => setStatus(o, status, ev.currentTarget) },
        t(label || (o.fulfil === "delivery" ? "sellerOrders.outForDelivery" : "sellerOrders.readyForPickup"))));
    box.append(el("article", { class: "order" },
      el("header", {},
        el("div", {}, el("strong", { text: o.buyerName }), el("span", { class: "muted num", text: "  " + when(o.createdAt) })),
        el("span", { class: "pill " + o.status, text: statusLabel(o.status) })),
      el("div", { class: "items" },
        o.items.map((i) => el("div", {}, el("span", { text: i.qty + " × " + i.name }), el("span", { text: rp(i.qty * i.price) }))),
        el("div", { style: "font-weight:700" }, el("span", { text: t("common.total") }), el("span", { text: rp(o.total) }))),
      el("div", { class: "meta" },
        el("span", { class: "code", text: t("common.code", { code: o.code }) }),
        el("span", { text: t("sellerOrders.contact", { contact: o.contact }) }),
        el("span", { text: o.fulfil === "delivery" ? t("sellerOrders.deliverTo", { address: o.address }) : t("common.pickup") }),
        o.note ? el("span", { text: t("sellerOrders.note", { note: o.note }) }) : null),
      acts.length ? el("div", { class: "actions" }, acts) : null));
  }
}
async function setStatus(o, status, btn) {
  btn.disabled = true;
  try { await api("/api/seller/orders/" + o.id, { method: "PATCH", body: { status } }); toast(t("sellerOrders.updated", { status: statusLabel(status).toLowerCase() })); }
  catch (err) { handle(err); }
  loadOrders();
}

// Check for new orders every 20 seconds while the page is visible.
setInterval(() => { if (me && !document.hidden) loadOrders(); }, 20000);

window.addEventListener("langchange", () => {
  labelProductForm();
  if (me) { renderHead(); renderProducts(); renderOrders(); }
});

labelProductForm();
start();
