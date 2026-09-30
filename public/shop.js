import { $, el, rp, when, STATUS, leafSvg, api, toast, confirmTap } from "/common.js";

let products = [];
let filterStall = "all";
let myOrders = [];

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
let basket = load("ks-basket", []);          // [{ productId, qty }]
let codes = load("ks-orders", []);           // order codes this browser placed or tracked

// ---------- tabs ----------
function showTab(name) {
  document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === name)));
  ["shop", "basket", "orders"].forEach((v) => ($("#view-" + v).hidden = v !== name));
  if (name === "orders") refreshOrders();
}
document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));

// ---------- catalog ----------
async function loadCatalog() {
  try {
    ({ products } = await api("/api/catalog"));
    $("#notice").hidden = true;
  } catch (e) {
    $("#notice").textContent = "The catalog couldn't load. " + e.message;
    $("#notice").hidden = false;
  }
  renderShop(); renderBasket();
}

function renderShop() {
  const stalls = [...new Map(products.map((p) => [p.sellerId, p.stallName])).entries()];
  const chips = $("#stallChips"); chips.replaceChildren();
  if (stalls.length > 1) {
    const mk = (id, label) => el("button", { "aria-pressed": String(filterStall === id), onclick: () => { filterStall = id; renderShop(); } }, label);
    chips.append(mk("all", "All stalls"), ...stalls.map(([id, name]) => mk(id, name)));
  }
  const shown = products.filter((p) => filterStall === "all" || p.sellerId === filterStall);
  const grid = $("#productGrid"); grid.replaceChildren();
  $("#shopEmpty").hidden = shown.length > 0;
  $("#shopEmptyTitle").textContent = "No products yet";
  $("#shopEmptyText").textContent = "When the kampung's sellers list their pecel semanggi, snacks and drinks, they appear here with prices.";
  for (const p of shown) {
    grid.append(el("article", { class: "card" },
      el("div", { class: "photo" }, p.photo ? el("img", { src: p.photo, alt: p.name, loading: "lazy" }) : leafSvg()),
      el("div", { class: "body" },
        el("span", { class: "stall", text: p.stallName }),
        el("h3", { text: p.name }),
        el("p", { class: "desc", text: p.description || "" }),
        el("div", { class: "buy" },
          el("span", { class: "price" }, rp(p.price), p.unit ? el("small", { text: " / " + p.unit }) : null),
          p.available
            ? el("button", { class: "btn small", onclick: () => addToBasket(p) }, "Add")
            : el("span", { class: "soldout", text: "Sold out" })))));
  }
}

// ---------- basket ----------
function addToBasket(p) {
  const line = basket.find((l) => l.productId === p.id);
  if (line) line.qty = Math.min(99, line.qty + 1); else basket.push({ productId: p.id, qty: 1 });
  store("ks-basket", basket); renderBasket(); toast(p.name + " added to your basket");
}
function basketLines() {
  return basket.map((l) => ({ ...l, p: products.find((p) => p.id === l.productId) })).filter((l) => l.p && l.p.available);
}
function groupBy(arr, fn) { const m = new Map(); for (const x of arr) { const k = fn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; }

function renderBasket() {
  const lines = basketLines();
  const n = lines.reduce((a, l) => a + l.qty, 0);
  $("#basketCount").textContent = n; $("#basketCount").hidden = !n;
  $("#placeBtn").disabled = !lines.length;
  const box = $("#basketList"); box.replaceChildren(el("h3", { text: "Basket" }));
  if (!lines.length) { box.append(el("p", { class: "muted", text: "Your basket is empty. Add something from the Catalog tab." })); return; }
  let grand = 0;
  for (const ls of groupBy(lines, (l) => l.p.sellerId).values()) {
    const sub = ls.reduce((a, l) => a + l.qty * l.p.price, 0); grand += sub;
    box.append(el("div", { class: "group" },
      el("span", { class: "eyebrow", text: ls[0].p.stallName }),
      ls.map((l) => el("div", { class: "line" },
        el("span", {}, l.p.name, el("small", { class: "muted", text: " · " + rp(l.p.price) })),
        el("span", { class: "qty" },
          el("button", { type: "button", "aria-label": "One less " + l.p.name, onclick: () => changeQty(l.productId, -1) }, "−"),
          el("span", { text: String(l.qty) }),
          el("button", { type: "button", "aria-label": "One more " + l.p.name, onclick: () => changeQty(l.productId, 1) }, "+")),
        el("span", { class: "num", text: rp(l.qty * l.p.price) }))),
      el("div", { class: "total muted" }, el("span", { text: "Subtotal" }), el("span", { text: rp(sub) }))));
  }
  box.append(el("div", { class: "total", style: "border-top:1px solid var(--line);padding-top:12px" }, el("span", { text: "Total" }), el("span", { text: rp(grand) })));
}
function changeQty(id, d) {
  const line = basket.find((x) => x.productId === id);
  if (!line) return;
  line.qty = Math.min(99, line.qty + d);
  if (line.qty <= 0) basket = basket.filter((x) => x !== line);
  store("ks-basket", basket); renderBasket();
}

document.querySelectorAll('input[name="fulfil"]').forEach((r) => r.addEventListener("change", () => { $("#addrField").hidden = !$("#c-delivery").checked; }));

$("#checkout").addEventListener("submit", async (e) => {
  e.preventDefault();
  const lines = basketLines();
  if (!lines.length) return;
  const btn = $("#placeBtn"); btn.disabled = true; btn.textContent = "Placing order…";
  try {
    const delivery = $("#c-delivery").checked;
    const { orders } = await api("/api/orders", { method: "POST", body: {
      buyerName: $("#c-name").value, contact: $("#c-phone").value,
      fulfil: delivery ? "delivery" : "pickup", address: $("#c-addr").value, note: $("#c-note").value,
      items: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
    } });
    codes = [...orders.map((o) => o.code), ...codes].slice(0, 50); store("ks-orders", codes);
    basket = []; store("ks-basket", basket);
    $("#c-note").value = "";
    renderBasket(); showTab("orders");
    toast(orders.length > 1 ? `${orders.length} orders placed. Keep the codes to track them.` : `Order ${orders[0].code} placed. The seller can see it now.`);
  } catch (err) {
    toast(err.message);
    loadCatalog();
  }
  btn.textContent = "Place order"; renderBasket();
});

// ---------- my orders ----------
async function refreshOrders() {
  if (!codes.length) { myOrders = []; return renderOrders(); }
  try { ({ orders: myOrders } = await api("/api/orders?codes=" + codes.join(","))); }
  catch (e) { toast(e.message); }
  renderOrders();
}
function renderOrders() {
  const box = $("#myOrders"); box.replaceChildren();
  if (!myOrders.length) {
    box.append(el("div", { class: "empty" }, el("h3", { text: "No orders yet" }),
      el("p", { text: "Orders you place on this device appear here, with their status as the seller updates it. On another device, track an order with its code." })));
    return;
  }
  for (const o of myOrders) {
    const statusText = o.status === "ready" ? (o.fulfil === "delivery" ? "On the way" : "Ready to pick up") : STATUS[o.status] || o.status;
    box.append(el("article", { class: "order" },
      el("header", {},
        el("div", {}, el("strong", { text: o.stallName }), el("span", { class: "muted num", text: "  " + when(o.createdAt) })),
        el("span", { class: "pill " + o.status, text: statusText })),
      el("div", { class: "items" },
        o.items.map((i) => el("div", {}, el("span", { text: i.qty + " × " + i.name }), el("span", { text: rp(i.qty * i.price) }))),
        el("div", { style: "font-weight:700" }, el("span", { text: "Total" }), el("span", { text: rp(o.total) }))),
      el("div", { class: "meta" },
        el("span", { class: "code", text: "Code " + o.code }),
        el("span", { text: o.fulfil === "delivery" ? "Delivery" : "Pick up in the kampung" }),
        o.stallPhone ? el("span", { text: "Seller WhatsApp: " + o.stallPhone }) : null),
      o.status === "new" ? el("div", { class: "actions" },
        el("button", { class: "btn small warn", onclick: (ev) => confirmTap(ev.currentTarget, "Tap again to cancel", async () => {
          try { await api(`/api/orders/${o.code}/cancel`, { method: "POST" }); toast("Order cancelled"); refreshOrders(); }
          catch (err) { toast(err.message); refreshOrders(); }
        }) }, "Cancel order")) : null));
  }
}

$("#trackForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = $("#t-code").value.trim().toUpperCase();
  if (!/^[A-Z0-9]{8}$/.test(code)) return toast("Order codes are 8 letters and numbers.");
  const { orders } = await api("/api/orders?codes=" + code).catch((err) => (toast(err.message), { orders: null }));
  if (!orders) return;
  if (!orders.length) return toast("No order with that code.");
  if (!codes.includes(code)) { codes = [code, ...codes].slice(0, 50); store("ks-orders", codes); }
  $("#t-code").value = "";
  refreshOrders();
});

// Keep order statuses fresh while the tab is open.
setInterval(() => { if (!$("#view-orders").hidden && !document.hidden) refreshOrders(); }, 20000);

loadCatalog();
