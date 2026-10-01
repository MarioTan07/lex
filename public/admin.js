import { $, el, rp, when, STATUS, api, toast, confirmTap, locationEditor, mapLink } from "/common.js";

let me = null;

async function start() {
  const { user } = await api("/api/me").catch(() => ({ user: null }));
  me = user && user.role === "admin" ? user : null;
  $("#authView").hidden = !!me;
  $("#deskView").hidden = !me;
  $("#logoutBtn").hidden = !me;
  if (me) refreshAll();
}

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("#loginErr"); err.hidden = true;
  try { await api("/api/auth/login", { method: "POST", body: { email: $("#l-email").value, password: $("#l-pass").value, role: "admin" } }); start(); }
  catch (x) { err.textContent = x.message; err.hidden = false; }
});
$("#logoutBtn").addEventListener("click", async () => { await api("/api/auth/logout", { method: "POST" }).catch(() => {}); start(); });

function handle(err) {
  if (err.status === 401 || err.status === 403) { toast("You've been signed out. Sign in again."); me = null; start(); return; }
  toast(err.message);
}

// ---------- tabs ----------
document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll(".tabs button").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
  ["sellers", "products", "orders", "account"].forEach((v) => ($("#view-" + v).hidden = v !== b.dataset.tab));
}));

function refreshAll() { loadOverview(); loadSellers(); loadProducts(); loadOrders(); }
$("#refreshBtn").addEventListener("click", refreshAll);

// ---------- overview ----------
async function loadOverview() {
  try {
    const s = await api("/api/admin/overview");
    $("#st-pending").textContent = s.sellers.pending;
    $("#st-pending").classList.toggle("alert", s.sellers.pending > 0);
    $("#st-approved").textContent = s.sellers.approved;
    $("#st-products").textContent = s.products;
    $("#st-open").textContent = s.ordersOpen;
    $("#st-today").textContent = s.ordersToday;
    $("#st-sales").textContent = rp(s.salesDone);
    $("#pendingCount").textContent = s.sellers.pending;
    $("#pendingCount").hidden = !s.sellers.pending;
  } catch (e) { handle(e); }
}

// ---------- sellers ----------
const shopLoc = locationEditor("n-shop", "Shop", "Shown to buyers on the main page with a Google Map.");
const homeLoc = locationEditor("n-home", "Home", "Private: only the seller and admins can see this.");
$("#n-shop").replaceWith(shopLoc.node);
$("#n-home").replaceWith(homeLoc.node);

let sellers = [];
let editingSeller = null;

function randomPassword() {
  const abc = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => abc[b % abc.length]).join("");
}
$("#genPass").addEventListener("click", () => { $("#n-pass").value = randomPassword(); });
$("#sellerFormToggle").addEventListener("click", () => {
  const body = $("#sellerFormBody"); body.hidden = !body.hidden;
  $("#sellerFormToggle").textContent = body.hidden ? "Show form" : "Hide form";
});

function resetSellerForm() {
  editingSeller = null;
  $("#sellerForm").reset(); shopLoc.set(null); homeLoc.set(null);
  $("#accountFields").hidden = false;
  $("#sellerFormTitle").textContent = "Create a seller account";
  $("#sellerSubmit").textContent = "Create seller account";
  $("#sellerCancel").hidden = true; $("#sellerErr").hidden = true;
}
$("#sellerCancel").addEventListener("click", resetSellerForm);

function editSeller(s) {
  editingSeller = s;
  $("#sellerFormBody").hidden = false; $("#sellerFormToggle").textContent = "Hide form";
  $("#accountFields").hidden = true;
  $("#n-name").value = s.name; $("#n-stall").value = s.stallName; $("#n-phone").value = s.phone;
  shopLoc.set(s.shop); homeLoc.set(s.home);
  $("#sellerFormTitle").textContent = "Edit " + s.stallName;
  $("#sellerSubmit").textContent = "Save changes";
  $("#sellerCancel").hidden = false; $("#sellerErr").hidden = true;
  $("#sellerForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

$("#sellerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errBox = $("#sellerErr"); errBox.hidden = true;
  const btn = $("#sellerSubmit"); btn.disabled = true;
  try {
    const body = { name: $("#n-name").value, stallName: $("#n-stall").value, phone: $("#n-phone").value, shop: shopLoc.get(), home: homeLoc.get() };
    if (editingSeller) {
      await api("/api/admin/sellers/" + editingSeller.id, { method: "PUT", body });
      toast(body.stallName + " saved");
    } else {
      body.email = $("#n-email").value; body.password = $("#n-pass").value;
      if (!body.email) throw new Error("Enter the email the seller will sign in with.");
      await api("/api/admin/sellers", { method: "POST", body });
      showPassword(body.stallName, body.email, body.password);
      toast("Seller account created");
    }
    resetSellerForm(); loadSellers(); loadOverview();
  } catch (err) {
    if (err.status === 401 || err.status === 403) handle(err);
    else { errBox.textContent = err.message; errBox.hidden = false; }
  }
  btn.disabled = false;
});

// Show a new password once so the admin can pass it on to the seller.
function showPassword(stall, email, password) {
  const n = $("#pwNotice");
  n.replaceChildren(
    el("strong", { text: stall + ": " }), "sign-in email ", el("strong", { text: email }), ", password ",
    el("strong", { class: "num", style: "font-family:ui-monospace,Consolas,monospace", text: password }),
    ". Give these to the seller now; the password won't be shown again. ",
    el("button", { class: "linkish", type: "button", onclick: () => (n.hidden = true) }, "Dismiss"));
  n.hidden = false;
  n.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function resetPassword(s) {
  const password = randomPassword();
  try {
    await api(`/api/admin/sellers/${s.id}/password`, { method: "POST", body: { password } });
    showPassword(s.stallName, s.email, password);
  } catch (e) { handle(e); }
}

function locCell(loc) {
  const link = mapLink(loc);
  return el("td", { class: "loc-cell" },
    el("div", { class: "small", text: loc.address || "Not added" }),
    link ? el("a", { href: link, target: "_blank", rel: "noopener", text: "View on Google Maps" }) : null);
}

async function loadSellers() {
  try { ({ sellers } = await api("/api/admin/sellers")); } catch (e) { return handle(e); }
  const body = $("#sellerRows"); body.replaceChildren();
  if (!sellers.length) body.append(el("tr", {}, el("td", { colspan: "8", class: "muted", text: "No sellers yet. Create the first account with the form above." })));
  for (const s of sellers) {
    body.append(el("tr", {},
      el("td", {}, el("strong", { text: s.stallName }), el("div", { class: "muted small", text: "Joined " + when(s.createdAt) })),
      el("td", {}, el("div", { text: s.name }), el("div", { class: "num", text: s.phone }), el("div", { class: "muted small", text: s.email })),
      locCell(s.shop),
      locCell(s.home),
      el("td", { class: "num", text: String(s.products) }),
      el("td", { class: "num", text: String(s.orders) }),
      el("td", {}, el("span", { class: "pill " + s.status, text: s.status })),
      el("td", {}, el("div", { class: "acts" },
        el("button", { class: "btn small ghost", onclick: () => editSeller(s) }, "Edit"),
        el("button", { class: "btn small ghost", onclick: (ev) => confirmTap(ev.currentTarget, "Tap to reset", () => resetPassword(s)) }, "Reset password"),
        s.status !== "approved" ? el("button", { class: "btn small", onclick: () => setSeller(s, "approved") }, s.status === "suspended" ? "Reactivate" : "Approve") : null,
        s.status !== "suspended" ? el("button", { class: "btn small warn", onclick: (ev) => confirmTap(ev.currentTarget, "Tap to suspend", () => setSeller(s, "suspended")) }, "Suspend") : null))));
  }
}
async function setSeller(s, status) {
  try { await api("/api/admin/sellers/" + s.id, { method: "PATCH", body: { status } }); toast(`${s.stallName} is now ${status}`); loadSellers(); loadOverview(); loadProducts(); }
  catch (e) { handle(e); }
}

// ---------- products ----------
async function loadProducts() {
  let products;
  try { ({ products } = await api("/api/admin/products")); } catch (e) { return handle(e); }
  const body = $("#productRows"); body.replaceChildren();
  if (!products.length) body.append(el("tr", {}, el("td", { colspan: "6", class: "muted", text: "No products yet." })));
  for (const p of products) {
    const state = p.hidden ? ["hidden", "Hidden"] : p.available ? ["live", "On sale"] : ["done", "Sold out"];
    body.append(el("tr", {},
      el("td", {}, p.photo ? el("img", { src: p.photo, alt: "" }) : el("img", { alt: "" })),
      el("td", {}, el("strong", { text: p.name }), p.description ? el("div", { class: "muted small", text: p.description }) : null),
      el("td", { text: p.stallName }),
      el("td", { class: "num" }, rp(p.price), p.unit ? el("div", { class: "muted small", text: "per " + p.unit }) : null),
      el("td", {}, el("span", { class: "pill " + state[0], text: state[1] })),
      el("td", {}, el("div", { class: "acts" },
        el("button", { class: "btn small ghost", onclick: () => setHidden(p, !p.hidden) }, p.hidden ? "Show" : "Hide"),
        el("button", { class: "btn small warn", onclick: (ev) => confirmTap(ev.currentTarget, "Tap to delete", () => deleteProduct(p)) }, "Delete")))));
  }
}
async function setHidden(p, hidden) {
  try { await api("/api/admin/products/" + p.id, { method: "PATCH", body: { hidden } }); toast(hidden ? p.name + " hidden from the catalog" : p.name + " is back in the catalog"); loadProducts(); }
  catch (e) { handle(e); }
}
async function deleteProduct(p) {
  try { await api("/api/admin/products/" + p.id, { method: "DELETE" }); toast("Deleted " + p.name); loadProducts(); loadOverview(); }
  catch (e) { handle(e); }
}

// ---------- orders ----------
$("#orderStatus").addEventListener("change", loadOrders);
async function loadOrders() {
  let orders;
  const f = $("#orderStatus").value;
  try { ({ orders } = await api("/api/admin/orders" + (f ? "?status=" + f : ""))); } catch (e) { return handle(e); }
  const body = $("#orderRows"); body.replaceChildren();
  if (!orders.length) body.append(el("tr", {}, el("td", { colspan: "7", class: "muted", text: f ? "No orders with this status." : "No orders yet." })));
  for (const o of orders) {
    const sel = el("select", { "aria-label": "Status of order " + o.code, onchange: async (ev) => {
      try { await api("/api/admin/orders/" + o.id, { method: "PATCH", body: { status: ev.target.value } }); toast(`Order ${o.code} set to ${STATUS[ev.target.value].toLowerCase()}`); loadOverview(); }
      catch (e) { handle(e); ev.target.value = o.status; }
    } }, Object.entries(STATUS).map(([v, l]) => el("option", { value: v, selected: v === o.status }, l)));
    body.append(el("tr", {},
      el("td", { class: "num small", text: when(o.createdAt) }),
      el("td", { class: "small", style: "font-family:ui-monospace,Consolas,monospace", text: o.code }),
      el("td", { text: o.stallName }),
      el("td", {}, el("div", { text: o.buyerName }), el("div", { class: "muted small", text: o.contact + (o.fulfil === "delivery" ? " · delivery" : " · pick up") })),
      el("td", { class: "small", text: o.items.map((i) => i.qty + "× " + i.name).join(", ") }),
      el("td", { class: "num", text: rp(o.total) }),
      el("td", {}, sel)));
  }
}

// ---------- account ----------
$("#passwordForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try { await api("/api/auth/password", { method: "POST", body: { current: $("#pw-cur").value, next: $("#pw-new").value } }); e.target.reset(); toast("Password changed"); }
  catch (err) { handle(err); }
});

start();
