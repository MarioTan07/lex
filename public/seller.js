import { $, el, rp, t, api, toast, shrinkPhoto, confirmTap, locationEditor, hoursEditor } from "/common.js";

let me = null;
let products = [];
let editingId = null;
let editingName = "";
let pendingPhoto = null;

const shopLoc = locationEditor("s-shop", "shop", "seller.shopHint");
const homeLoc = locationEditor("s-home", "home", "seller.homeHint");
$("#s-shop").replaceWith(shopLoc.node);
$("#s-home").replaceWith(homeLoc.node);
const hoursEd = hoursEditor("s-hours");
$("#s-hours").replaceWith(hoursEd.node);

// ---------- session ----------
async function start() {
  const { user } = await api("/api/me").catch(() => ({ user: null }));
  if (user && user.role === "admin") { location.href = "/pengelola"; return; }
  me = user;
  // Tells password managers which account the change-password form is for (kept when the form resets).
  $("#pw-user").setAttribute("value", me?.email || "");
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

// Suspended sellers can't sign in, so a signed-in seller's shop is either live or paused by the seller.
function renderHead() {
  $("#stallTitle").textContent = me.stallName || me.name;
  const pill = $("#statusPill");
  pill.className = "pill " + (me.paused ? "paused" : "live");
  pill.textContent = t(me.paused ? "seller.paused" : "seller.live");
  renderPause();
}

// ---------- pause / reopen ----------
function renderPause() {
  $("#pauseState").textContent = me.paused ? t("pause.closedState", { note: me.pauseNote }) : t("pause.openState");
  $("#pauseNoteField").hidden = me.paused;
  const btn = $("#pauseBtn");
  btn.className = "btn" + (me.paused ? "" : " warn");
  btn.textContent = t(me.paused ? "pause.reopen" : "pause.close");
}
$("#pauseForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  showErr("#pauseErr", "");
  const note = $("#pause-note").value.trim();
  if (!me.paused && !note) { showErr("#pauseErr", t("pause.needNote")); $("#pause-note").focus(); return; }
  const btn = $("#pauseBtn"); btn.disabled = true;
  try {
    ({ user: me } = await api("/api/seller/pause", { method: "PUT", body: me.paused ? { paused: false } : { paused: true, note } }));
    $("#pause-note").value = "";
    renderHead();
    toast(t(me.paused ? "pause.closedToast" : "pause.reopenedToast"));
  } catch (err) {
    if (err.status === 401) handle(err); else showErr("#pauseErr", err.message);
  }
  btn.disabled = false;
});
function fillProfile() {
  $("#s-name").value = me.name; $("#s-stall").value = me.stallName; $("#s-phone").value = me.phone;
  $("#s-ig").value = me.instagram ? "@" + me.instagram : ""; $("#s-fromhome").checked = me.fromHome;
  shopLoc.set(me.shop); homeLoc.set(me.home); hoursEd.set(me.hours);
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
  $("#p-name").value = p.name; $("#p-price").value = p.price; $("#p-unit").value = p.unit; $("#p-pieces").value = p.pieces ?? ""; $("#p-desc").value = p.description; $("#p-category").value = p.category || "";
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
  const body = { name: $("#p-name").value, price: $("#p-price").value, unit: $("#p-unit").value, pieces: $("#p-pieces").value, description: $("#p-desc").value, category: $("#p-category").value };
  if (pendingPhoto) body.photo = pendingPhoto;
  try {
    if (editingId) await api("/api/seller/products/" + editingId, { method: "PATCH", body });
    else await api("/api/seller/products", { method: "POST", body });
    toast(t(editingId ? "product.saved" : "product.addedLive"));
    resetProductForm(); loadProducts();
  } catch (err) { handle(err); }
  btn.disabled = false; labelProductForm();
});

// ---------- profile & password ----------
$("#profileForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errBox = $("#profileErr"); errBox.hidden = true;
  try {
    const body = { name: $("#s-name").value, stallName: $("#s-stall").value, phone: $("#s-phone").value, instagram: $("#s-ig").value, fromHome: $("#s-fromhome").checked, hours: hoursEd.get(), shop: shopLoc.get(), home: homeLoc.get() };
    ({ user: me } = await api("/api/seller/profile", { method: "PATCH", body }));
    renderHead(); fillProfile(); toast(t("profile.saved"));
  } catch (err) {
    if (err.status) return handle(err);
    errBox.textContent = err.message; errBox.hidden = false;
  }
});
$("#passwordForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("#pw-err"); err.hidden = true;
  if ($("#pw-new").value !== $("#pw-confirm").value) {
    err.textContent = t("common.passwordMismatch"); err.hidden = false; $("#pw-confirm").focus();
    return;
  }
  try { await api("/api/auth/password", { method: "POST", body: { current: $("#pw-cur").value, next: $("#pw-new").value } }); e.target.reset(); toast(t("common.passwordChanged")); }
  catch (x) {
    if (x.status === 401 || x.status === 403) return handle(x);
    err.textContent = x.message; err.hidden = false;
  }
});

window.addEventListener("langchange", () => {
  labelProductForm();
  if (me) { renderHead(); renderProducts(); }
});

labelProductForm();
start();
