import { $, el, rp, when, STATUS, api, toast, confirmTap } from "/common.js";

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
async function loadSellers() {
  let sellers;
  try { ({ sellers } = await api("/api/admin/sellers")); } catch (e) { return handle(e); }
  const body = $("#sellerRows"); body.replaceChildren();
  if (!sellers.length) body.append(el("tr", {}, el("td", { colspan: "8", class: "muted", text: "No sellers yet. They sign up at /seller and show up here for approval." })));
  for (const s of sellers) {
    const act = (status, label, cls = "ghost") => el("button", { class: "btn small " + cls, onclick: () => setSeller(s, status) }, label);
    body.append(el("tr", {},
      el("td", {}, el("strong", { text: s.stallName })),
      el("td", { text: s.name }),
      el("td", {}, el("div", { text: s.phone }), el("div", { class: "muted small", text: s.email })),
      el("td", { class: "num", text: String(s.products) }),
      el("td", { class: "num", text: String(s.orders) }),
      el("td", { class: "num small", text: when(s.createdAt) }),
      el("td", {}, el("span", { class: "pill " + s.status, text: s.status })),
      el("td", {}, el("div", { class: "acts" },
        s.status !== "approved" ? act("approved", "Approve", "") : null,
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
