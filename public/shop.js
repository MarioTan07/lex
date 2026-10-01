import { $, el, rp, when, t, statusLabel, leafSvg, api, toast, confirmTap, mapFrame, mapLink } from "/common.js";

let products = [];
let filterStall = "all";
let myOrders = [];
let catalogLoaded = false;
let stalls = [];

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
    catalogLoaded = true;
    $("#notice").hidden = true;
  } catch (e) {
    $("#notice").textContent = t("shop.loadFailed") + e.message;
    $("#notice").hidden = false;
  }
  renderShop(); renderBasket();
}

function renderShop() {
  const stalls = [...new Map(products.map((p) => [p.sellerId, p.stallName])).entries()];
  const chips = $("#stallChips"); chips.replaceChildren();
  if (stalls.length > 1) {
    const mk = (id, label) => el("button", { "aria-pressed": String(filterStall === id), onclick: () => { filterStall = id; renderShop(); } }, label);
    chips.append(mk("all", t("shop.allStalls")), ...stalls.map(([id, name]) => mk(id, name)));
  }
  const shown = products.filter((p) => filterStall === "all" || p.sellerId === filterStall);
  const grid = $("#productGrid"); grid.replaceChildren();
  $("#shopEmpty").hidden = shown.length > 0;
  if (catalogLoaded) {
    $("#shopEmptyTitle").textContent = t("shop.empty");
    $("#shopEmptyText").textContent = t("shop.emptyText");
  }
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
            ? el("button", { class: "btn small", onclick: () => addToBasket(p) }, t("shop.add"))
            : el("span", { class: "soldout", text: t("shop.soldOut") })))));
  }
}

// ---------- basket ----------
function addToBasket(p) {
  const line = basket.find((l) => l.productId === p.id);
  if (line) line.qty = Math.min(99, line.qty + 1); else basket.push({ productId: p.id, qty: 1 });
  store("ks-basket", basket); renderBasket(); toast(t("shop.added", { name: p.name }));
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
  const box = $("#basketList"); box.replaceChildren(el("h3", { text: t("basket.title") }));
  if (!lines.length) { box.append(el("p", { class: "muted", text: t("basket.empty") })); return; }
  let grand = 0;
  for (const ls of groupBy(lines, (l) => l.p.sellerId).values()) {
    const sub = ls.reduce((a, l) => a + l.qty * l.p.price, 0); grand += sub;
    box.append(el("div", { class: "group" },
      el("span", { class: "eyebrow", text: ls[0].p.stallName }),
      ls.map((l) => el("div", { class: "line" },
        el("span", {}, l.p.name, el("small", { class: "muted", text: " · " + rp(l.p.price) })),
        el("span", { class: "qty" },
          el("button", { type: "button", "aria-label": t("basket.less", { name: l.p.name }), onclick: () => changeQty(l.productId, -1) }, "−"),
          el("span", { text: String(l.qty) }),
          el("button", { type: "button", "aria-label": t("basket.more", { name: l.p.name }), onclick: () => changeQty(l.productId, 1) }, "+")),
        el("span", { class: "num", text: rp(l.qty * l.p.price) }))),
      el("div", { class: "total muted" }, el("span", { text: t("common.subtotal") }), el("span", { text: rp(sub) }))));
  }
  box.append(el("div", { class: "total", style: "border-top:1px solid var(--line);padding-top:12px" }, el("span", { text: t("common.total") }), el("span", { text: rp(grand) })));
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
  const btn = $("#placeBtn"); btn.disabled = true; btn.textContent = t("checkout.placing");
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
    toast(orders.length > 1 ? t("checkout.placedMany", { n: orders.length }) : t("checkout.placedOne", { code: orders[0].code }));
  } catch (err) {
    toast(err.message);
    loadCatalog();
  }
  btn.textContent = t("checkout.place"); renderBasket();
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
    box.append(el("div", { class: "empty" }, el("h3", { text: t("common.noOrders") }),
      el("p", { text: t("orders.emptyText") })));
    return;
  }
  for (const o of myOrders) {
    const statusText = o.status === "ready" ? t(o.fulfil === "delivery" ? "orders.onTheWay" : "orders.readyPickup") : statusLabel(o.status);
    box.append(el("article", { class: "order" },
      el("header", {},
        el("div", {}, el("strong", { text: o.stallName }), el("span", { class: "muted num", text: "  " + when(o.createdAt) })),
        el("span", { class: "pill " + o.status, text: statusText })),
      el("div", { class: "items" },
        o.items.map((i) => el("div", {}, el("span", { text: i.qty + " × " + i.name }), el("span", { text: rp(i.qty * i.price) }))),
        el("div", { style: "font-weight:700" }, el("span", { text: t("common.total") }), el("span", { text: rp(o.total) }))),
      el("div", { class: "meta" },
        el("span", { class: "code", text: t("common.code", { code: o.code }) }),
        el("span", { text: t(o.fulfil === "delivery" ? "orders.delivery" : "common.pickup") }),
        o.stallPhone ? el("span", { text: t("orders.sellerWa", { phone: o.stallPhone }) }) : null),
      o.status === "new" ? el("div", { class: "actions" },
        el("button", { class: "btn small warn", onclick: (ev) => confirmTap(ev.currentTarget, t("orders.cancelConfirm"), async () => {
          try { await api(`/api/orders/${o.code}/cancel`, { method: "POST" }); toast(t("orders.cancelled")); refreshOrders(); }
          catch (err) { toast(err.message); refreshOrders(); }
        }) }, t("orders.cancel"))) : null));
  }
}

$("#trackForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = $("#t-code").value.trim().toUpperCase();
  if (!/^[A-Z0-9]{8}$/.test(code)) return toast(t("track.format"));
  const { orders } = await api("/api/orders?codes=" + code).catch((err) => (toast(err.message), { orders: null }));
  if (!orders) return;
  if (!orders.length) return toast(t("track.none"));
  if (!codes.includes(code)) { codes = [code, ...codes].slice(0, 50); store("ks-orders", codes); }
  $("#t-code").value = "";
  refreshOrders();
});

// Keep order statuses fresh while the tab is open.
setInterval(() => { if (!$("#view-orders").hidden && !document.hidden) refreshOrders(); }, 20000);

// ---------- shop locations ----------
async function loadShops() {
  try { ({ stalls } = await api("/api/stalls")); } catch { return; }
  renderShops();
}
function renderShops() {
  const grid = $("#shopGrid"); grid.replaceChildren();
  $("#shopsEmpty").hidden = stalls.length > 0;
  for (const s of stalls) {
    const link = mapLink(s.shop);
    grid.append(el("article", { class: "shop" },
      mapFrame(s.shop, t("shops.mapOf", { name: s.stallName })) || el("div", { class: "photo" }, leafSvg()),
      el("div", { class: "body" },
        el("h3", { text: s.stallName }),
        el("p", { class: "muted", text: s.shop.address || t("shops.noAddress") }),
        el("p", {}, el("span", { class: "muted small", text: t("shops.contact") + "  " }), el("span", { class: "contact", text: s.phone })),
        link ? el("a", { href: link, target: "_blank", rel: "noopener", class: "small", text: t("shops.openMaps") }) : null)));
  }
}

window.addEventListener("langchange", () => {
  if (catalogLoaded) { renderShop(); renderBasket(); } else loadCatalog();
  renderOrders(); renderShops();
});

loadCatalog();
loadShops();
