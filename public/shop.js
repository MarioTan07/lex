import { $, el, rp, t, leafSvg, api, mapFrame, contactButtons } from "/common.js";

let products = [];
let stalls = [];
let filterStall = "all";
let catalogLoaded = false;

// The site used to keep a basket and order codes in the browser; buyers now call or WhatsApp instead.
try { localStorage.removeItem("ks-basket"); localStorage.removeItem("ks-orders"); } catch {}

const stallById = (id) => stalls.find((s) => s.id === id);

// "Temporarily closed" label with the seller's note, shown instead of the contact buttons while a shop is paused.
const closedNotice = (stall) => el("p", { class: "closed" },
  el("strong", { text: t("pause.badge") }), stall.pauseNote ? " · " + stall.pauseNote : "");

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
  renderShop();
}

function renderShop() {
  const names = [...new Map(products.map((p) => [p.sellerId, p.stallName])).entries()];
  const chips = $("#stallChips"); chips.replaceChildren();
  chips.hidden = names.length < 2;
  if (names.length > 1) {
    const mk = (id, label) => el("button", { "aria-pressed": String(filterStall === id), onclick: () => { filterStall = id; renderShop(); } }, label);
    chips.append(mk("all", t("shop.allStalls")), ...names.map(([id, name]) => mk(id, name)));
  }
  const shown = products.filter((p) => filterStall === "all" || p.sellerId === filterStall);
  const grid = $("#productGrid"); grid.replaceChildren();
  $("#shopEmpty").hidden = shown.length > 0;
  if (catalogLoaded) {
    $("#shopEmptyTitle").textContent = t("shop.empty");
    $("#shopEmptyText").textContent = t("shop.emptyText");
  }
  for (const p of shown) {
    const stall = stallById(p.sellerId);
    grid.append(el("article", { class: "card" },
      el("div", { class: "photo" }, p.photo ? el("img", { src: p.photo, alt: p.name, loading: "lazy" }) : leafSvg()),
      el("div", { class: "body" },
        el("span", { class: "stall", text: p.stallName }),
        el("h3", { text: p.name }),
        el("p", { class: "desc", text: p.description || "" }),
        el("div", { class: "buy" },
          el("span", { class: "price" }, rp(p.price), p.unit ? el("small", { text: " / " + p.unit }) : null),
          p.available ? null : el("span", { class: "soldout", text: t("shop.soldOut") })),
        !stall ? null
          : stall.paused ? closedNotice(stall)
          : p.available ? contactButtons(stall, t("contact.waProduct", { stall: stall.stallName, product: p.name })) : null)));
  }
}

// ---------- shop locations ----------
async function loadShops() {
  try { ({ stalls } = await api("/api/stalls")); } catch { return; }
  renderShops();
  renderShop(); // product cards need each stall's phone for their buttons
}
function renderShops() {
  const grid = $("#shopGrid"); grid.replaceChildren();
  $("#shopsEmpty").hidden = stalls.length > 0;
  for (const s of stalls) {
    grid.append(el("article", { class: "shop" },
      mapFrame(s.shop, t("shops.mapOf", { name: s.stallName })) || el("div", { class: "photo" }, leafSvg()),
      el("div", { class: "body" },
        el("h3", { text: s.stallName }),
        el("p", { class: "muted", text: s.shop.address || t("shops.noAddress") }),
        el("p", {}, el("span", { class: "muted small", text: t("shops.contact") + "  " }), el("span", { class: "contact", text: s.phone })),
        s.paused ? closedNotice(s) : contactButtons(s, t("contact.waShop", { stall: s.stallName })))));
  }
}

window.addEventListener("langchange", () => {
  if (catalogLoaded) renderShop(); else loadCatalog();
  renderShops();
});

loadCatalog();
loadShops();
