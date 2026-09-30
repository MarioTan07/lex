import { $, el, rp, when, STATUS, api, toast, shrinkPhoto, confirmTap } from "/common.js";

let me = null;
let products = [];
let orders = [];
let orderFilter = "open";
let editingId = null;
let pendingPhoto = null;

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
$("#registerForm").addEventListener("submit", async (e) => {
  e.preventDefault(); showErr("#registerErr", "");
  try {
    await api("/api/auth/register", { method: "POST", body: {
      name: $("#r-name").value, stallName: $("#r-stall").value, phone: $("#r-phone").value,
      email: $("#r-email").value, password: $("#r-pass").value,
    } });
    toast("Stall created. The admin will review it soon.");
    start();
  } catch (err) { showErr("#registerErr", err.message); }
});
$("#logoutBtn").addEventListener("click", async () => { await api("/api/auth/logout", { method: "POST" }).catch(() => {}); me = null; start(); });

function renderHead() {
  $("#stallTitle").textContent = me.stallName;
  const pill = $("#statusPill");
  pill.className = "pill " + me.status;
  pill.textContent = me.status === "approved" ? "Live in catalog" : me.status === "pending" ? "Waiting for approval" : me.status;
  const b = $("#statusBanner");
  b.hidden = me.status === "approved";
  b.textContent = "The kampung admin hasn't approved your stall yet. You can add products now; buyers will see them once you're approved.";
}
function fillProfile() {
  $("#s-name").value = me.name; $("#s-stall").value = me.stallName; $("#s-phone").value = me.phone;
}

// Session expired or account suspended mid-visit.
function handle(err) {
  if (err.status === 401) { toast("You've been signed out. Sign in again."); me = null; start(); return; }
  toast(err.message);
}

// ---------- products ----------
async function loadProducts() {
  try { ({ products } = await api("/api/seller/products")); } catch (e) { return handle(e); }
  renderProducts();
}
function renderProducts() {
  const box = $("#myProducts"); box.replaceChildren();
  if (!products.length) { box.append(el("p", { class: "muted", text: "Nothing listed yet. Add your first product above." })); return; }
  for (const p of products) {
    box.append(el("div", { class: "item" },
      p.photo ? el("img", { src: p.photo, alt: "" }) : el("div", { class: "ph" }),
      el("div", {},
        el("div", { style: "font-weight:600" }, p.name, p.hidden ? el("span", { class: "pill hidden", style: "margin-left:8px", text: "Hidden by admin" }) : null),
        el("div", { class: "price", style: "font-size:.875rem" }, rp(p.price), p.unit ? el("small", { text: " / " + p.unit }) : null,
          p.available ? null : el("small", { text: " · sold out" }))),
      el("div", { class: "acts" },
        el("button", { class: "btn small ghost", onclick: () => editProduct(p) }, "Edit"),
        el("button", { class: "btn small ghost", onclick: () => setAvailable(p, !p.available) }, p.available ? "Sold out" : "Back on sale"),
        el("button", { class: "btn small warn", onclick: (ev) => confirmTap(ev.currentTarget, "Tap to confirm", () => removeProduct(p)) }, "Remove"))));
  }
}
async function setAvailable(p, available) {
  try { await api("/api/seller/products/" + p.id, { method: "PATCH", body: { available } }); toast(available ? p.name + " is back on sale" : p.name + " marked sold out"); loadProducts(); }
  catch (e) { handle(e); }
}
async function removeProduct(p) {
  try { await api("/api/seller/products/" + p.id, { method: "DELETE" }); toast("Removed " + p.name); if (editingId === p.id) resetProductForm(); loadProducts(); }
  catch (e) { handle(e); }
}
function editProduct(p) {
  editingId = p.id;
  $("#productFormTitle").textContent = "Edit " + p.name;
  $("#saveProductBtn").textContent = "Save changes";
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
  $("#productFormTitle").textContent = "Add a product";
  $("#saveProductBtn").textContent = "Add to my stall";
  $("#cancelEditBtn").hidden = true;
}
$("#cancelEditBtn").addEventListener("click", resetProductForm);

$("#p-photo").addEventListener("change", async (e) => {
  const f = e.target.files[0]; pendingPhoto = null;
  if (!f) return;
  try { pendingPhoto = await shrinkPhoto(f); $("#p-preview").src = pendingPhoto; $("#p-preview").hidden = false; }
  catch { toast("That file couldn't be read as a photo. Try a JPG or PNG."); e.target.value = ""; }
});

$("#productForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#saveProductBtn"); const label = btn.textContent;
  btn.disabled = true; btn.textContent = "Saving…";
  const body = { name: $("#p-name").value, price: $("#p-price").value, unit: $("#p-unit").value, description: $("#p-desc").value };
  if (pendingPhoto) body.photo = pendingPhoto;
  try {
    if (editingId) await api("/api/seller/products/" + editingId, { method: "PATCH", body });
    else await api("/api/seller/products", { method: "POST", body });
    toast(editingId ? "Changes saved" : me.status === "approved" ? "Added. Buyers can order it now." : "Added. It will show once your stall is approved.");
    resetProductForm(); loadProducts();
  } catch (err) { handle(err); }
  btn.disabled = false; if (btn.textContent === "Saving…") btn.textContent = label;
});

// ---------- profile & password ----------
$("#profileForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    ({ user: me } = await api("/api/seller/profile", { method: "PATCH", body: { name: $("#s-name").value, stallName: $("#s-stall").value, phone: $("#s-phone").value } }));
    renderHead(); toast("Stall details saved");
  } catch (err) { handle(err); }
});
$("#passwordForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try { await api("/api/auth/password", { method: "POST", body: { current: $("#pw-cur").value, next: $("#pw-new").value } }); e.target.reset(); toast("Password changed"); }
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
  new: [["accepted", "Accept", ""], ["declined", "Decline", "warn"]],
  accepted: [["ready", null, ""], ["declined", "Decline", "warn"]],
  ready: [["done", "Mark completed", ""]],
};
function renderOrders() {
  const box = $("#orders"); box.replaceChildren();
  const rank = { new: 0, accepted: 1, ready: 2, done: 3, declined: 4, cancelled: 4 };
  const list = orders
    .filter((o) => orderFilter === "all" || ["new", "accepted", "ready"].includes(o.status))
    .sort((a, b) => rank[a.status] - rank[b.status] || b.createdAt - a.createdAt);
  if (!list.length) {
    box.append(el("div", { class: "empty" }, el("h3", { text: orderFilter === "open" ? "No open orders" : "No orders yet" }),
      el("p", { text: "When someone orders from your stall it shows up here. Accept it, mark it ready, then completed." })));
    return;
  }
  for (const o of list) {
    const acts = (NEXT[o.status] || []).map(([status, label, cls]) =>
      el("button", { class: "btn small " + cls, onclick: (ev) => setStatus(o, status, ev.currentTarget) },
        label || (o.fulfil === "delivery" ? "Out for delivery" : "Ready for pick-up")));
    box.append(el("article", { class: "order" },
      el("header", {},
        el("div", {}, el("strong", { text: o.buyerName }), el("span", { class: "muted num", text: "  " + when(o.createdAt) })),
        el("span", { class: "pill " + o.status, text: STATUS[o.status] || o.status })),
      el("div", { class: "items" },
        o.items.map((i) => el("div", {}, el("span", { text: i.qty + " × " + i.name }), el("span", { text: rp(i.qty * i.price) }))),
        el("div", { style: "font-weight:700" }, el("span", { text: "Total" }), el("span", { text: rp(o.total) }))),
      el("div", { class: "meta" },
        el("span", { class: "code", text: "Code " + o.code }),
        el("span", { text: "Contact: " + o.contact }),
        el("span", { text: o.fulfil === "delivery" ? "Deliver to: " + o.address : "Pick up in the kampung" }),
        o.note ? el("span", { text: "Note: " + o.note }) : null),
      acts.length ? el("div", { class: "actions" }, acts) : null));
  }
}
async function setStatus(o, status, btn) {
  btn.disabled = true;
  try { await api("/api/seller/orders/" + o.id, { method: "PATCH", body: { status } }); toast("Order " + (STATUS[status] || status).toLowerCase()); }
  catch (err) { handle(err); }
  loadOrders();
}

// Check for new orders every 20 seconds while the page is visible.
setInterval(() => { if (me && !document.hidden) loadOrders(); }, 20000);

start();
