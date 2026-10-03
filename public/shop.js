import { $, el, rp, t, icon, leafSvg, api, toast, mapFrame, contactButtons, hoursLine, favs, favButton, shareButton, tap } from "/common.js";
import { lang } from "/i18n.js";
import { openOrder } from "/order.js";

let products = [];
let stalls = [];
let filterStall = "all";
let filterKind = "all";  // "all" | "hot" | "fav" | a category
let hot = [];            // ids of products that are "lagi hits"
const CATEGORIES = ["pecel", "camilan", "minuman", "oleh-oleh", "lainnya"];
let catalogLoaded = false;

// The site used to keep a basket and order codes in the browser; buyers now call or WhatsApp instead.
try { localStorage.removeItem("ks-basket"); localStorage.removeItem("ks-orders"); } catch {}

const stallById = (id) => stalls.find((s) => s.id === id);
// What a shop has in stock, for the order helper; `firstId` starts the order with one of that product.
const menuOf = (stall) => products.filter((p) => p.sellerId === stall.id && p.available);
const orderFrom = (stall, firstId) => () => openOrder(stall, menuOf(stall), firstId);

// "Temporarily closed" label with the seller's note, shown instead of the contact buttons while a shop is paused.
// Sellers who also sell from home keep the address private and send it to the buyer on WhatsApp.
const hasShop = (stall) => !!(stall.shop.address || (stall.shop.lat != null && stall.shop.lng != null));
const homeNote = (stall) => stall.fromHome
  ? el("p", { class: "addr home-note" }, icon("home"), t(hasShop(stall) ? "shops.alsoHome" : "shops.homeOnly")) : null;

const closedNotice = (stall) => el("p", { class: "closed" },
  el("strong", { text: t("pause.badge") }), stall.pauseNote ? " · " + stall.pauseNote : "");

// This script runs on the catalog page (/) and the shop-locations page (/lokasi); each has only its own part.
const onCatalog = !!$("#productGrid");
const onShops = !!$("#shopGrid");
// Links from before the site had separate pages pointed at sections of the home page.
const moved = { "#shops": "/lokasi", "#story": "/cerita", "#history": "/cerita#history" };
if (moved[location.hash]) location.replace(moved[location.hash]);

// ---------- catalog ----------
async function loadCatalog() {
  try {
    ({ products, hot = [] } = await api("/api/catalog"));
    catalogLoaded = true;
    if (onCatalog) $("#notice").hidden = true;
  } catch (e) {
    if (onCatalog) { $("#notice").textContent = t("shop.loadFailed") + e.message; $("#notice").hidden = false; }
  }
  renderShop();
}

let query = "";
if (onCatalog) $("#search").addEventListener("input", (e) => { query = norm(e.target.value); renderShop(); });

function renderShop() {
  if (!onCatalog) return;
  const names = [...new Map(products.map((p) => [p.sellerId, p.stallName])).entries()];
  const chips = $("#stallChips"); chips.replaceChildren();
  chips.hidden = names.length < 2;
  if (names.length > 1) {
    const mk = (id, label) => el("button", { "aria-pressed": String(filterStall === id), onclick: () => { filterStall = id; renderShop(); } }, label);
    chips.append(mk("all", t("shop.allStalls")), ...names.map(([id, name]) => mk(id, name)));
  }
  // Lagi hits, favourites and the categories that have products.
  const kinds = $("#kindChips"); kinds.replaceChildren();
  const cats = CATEGORIES.filter((c) => products.some((p) => p.category === c));
  const hasFav = products.some((p) => favs.has("p", p.id));
  if (filterKind === "hot" && !hot.length || filterKind === "fav" && !hasFav) filterKind = "all";
  const kindChip = (k, label, ico) => el("button", { "aria-pressed": String(filterKind === k), onclick: () => { filterKind = k; renderShop(); } }, ico ? icon(ico) : null, label);
  const kindList = [hot.length ? kindChip("hot", t("hot.label"), "flame") : null, hasFav ? kindChip("fav", t("fav.mine"), "heart") : null, ...cats.map((c) => kindChip(c, t("cat." + c)))].filter(Boolean);
  kinds.hidden = !kindList.length;
  if (kindList.length) kinds.append(kindChip("all", t("cat.all")), ...kindList);
  const kindOk = (p) => filterKind === "all" || (filterKind === "hot" ? hot.includes(p.id) : filterKind === "fav" ? favs.has("p", p.id) : p.category === filterKind);
  const shown = products.filter((p) => kindOk(p) && (filterStall === "all" || p.sellerId === filterStall)
    && (!query || norm(p.name + " " + p.stallName + " " + (p.description || "")).includes(query)));
  const grid = $("#productGrid"); grid.replaceChildren();
  $("#shopEmpty").hidden = shown.length > 0;
  if (catalogLoaded) {
    const searching = query && products.length;
    $("#shopEmptyTitle").textContent = searching ? t("catalog.noMatch", { q: $("#search").value.trim() }) : t("shop.empty");
    $("#shopEmptyText").textContent = searching ? t("catalog.noMatchText") : t("shop.emptyText");
  }
  // Lagi hits first when showing everything.
  if (filterKind === "all") shown.sort((a, b) => (hot.includes(b.id) - hot.includes(a.id)) || (hot.indexOf(a.id) - hot.indexOf(b.id)));
  for (const p of shown) {
    const stall = stallById(p.sellerId);
    const open = () => openCompare(p);
    const sellers = new Set(products.filter((q) => sameProduct(p, q)).map((q) => q.sellerId)).size;
    grid.append(el("article", { class: "card", id: "produk-" + p.id },
      el("button", { type: "button", class: "photo", onclick: open, "aria-label": t("compare.view", { name: p.name }) },
        p.photo ? el("img", { src: p.photo, alt: "", loading: "lazy" }) : leafSvg()),
      hot.includes(p.id) ? el("span", { class: "hot-badge" }, icon("flame"), t("hot.label")) : null,
      el("div", { class: "tools" },
        favButton("p", p.id, p.name, renderShop),
        shareButton({ title: p.name, text: shareText(p), url: location.origin + "/?p=" + p.id, onShare: () => tap(p.id) })),
      el("div", { class: "body" },
        el("div", { class: "card-head" },
          el("div", {},
            el("h3", {}, el("button", { type: "button", class: "titlelink", onclick: open, text: p.name })),
            el("p", { class: "stall" }, icon("store"), p.stallName),
            stall && !stall.paused ? hoursLine(stall.hours) : null),
          el("span", { class: "price" }, rp(p.price), p.unit ? el("small", { text: " / " + p.unit }) : null)),
        sellers > 1 ? el("button", { type: "button", class: "comparelink", onclick: open, text: t("compare.count", { n: sellers }) }) : null,
        el("p", { class: "desc", text: p.description || "" }),
        p.available ? null : el("span", { class: "soldout", text: t("shop.soldOut") }),
        !stall ? null
          : stall.paused ? closedNotice(stall)
          : p.available ? contactButtons(stall, t("contact.waProduct", { stall: stall.stallName, product: p.name }), { directions: false, order: orderFrom(stall, p.id), onTap: () => tap(p.id) }) : null)));
  }
  renderHero();
  openLinkedProduct();
}

// ---------- hero: today's pick & seller count ----------
// One product from a shop that's open, changing once a day, so the hero shows something real.
function renderHero() {
  const open = products.filter((p) => { const s = stallById(p.sellerId); return p.available && s && !s.paused; });
  const pick = $("#pick");
  pick.hidden = !open.length;
  if (open.length) {
    const day = Math.floor(Date.now() / 864e5);
    const p = open[day % open.length];
    $("#pickName").textContent = p.name;
    $("#pickPrice").textContent = rp(p.price);
    pick.onclick = () => openCompare(p);
    pick.setAttribute("aria-label", t("compare.view", { name: p.name }));
  }
  $("#joined").hidden = !stalls.length;
  $("#joinedCount").textContent = t("hero.sellers", { n: stalls.length });
}


// ---------- compare: every shop selling a product ----------
// Sellers type product names themselves, so "Pecel Semanggi" and "pecel semanggi Suroboyo" count as the same dish:
// case and extra spaces are ignored, and a name matches when one contains the other.
const norm = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
const sameProduct = (a, b) => { const x = norm(a.name), y = norm(b.name); return x.includes(y) || y.includes(x); };

let comparing = null;          // the product whose panel is open
let sortBy = "cheapest";       // "cheapest" | "closest"
let hideUnavailable = false;
let here = null;               // buyer's position, once they allow it: { lat, lng }

// Straight-line distance in km.
function km(a, b) {
  const rad = (d) => (d * Math.PI) / 180, R = 6371;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const pinOf = (stall) => (stall && stall.shop.lat != null && stall.shop.lng != null ? stall.shop : null);

function openCompare(p) {
  tap(p.id);
  comparing = p;
  renderCompare();
  const d = $("#compare");
  if (!d.open) d.showModal();
}
$("#compareClose").addEventListener("click", () => $("#compare").close());
$("#compare").addEventListener("click", (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }); // tap outside the box
$("#compare").addEventListener("close", () => { comparing = null; });
$("#compareHide").addEventListener("change", (e) => { hideUnavailable = e.target.checked; renderCompare(); });
document.querySelectorAll("#compareSort button").forEach((b) => b.addEventListener("click", () => setSort(b.dataset.sort)));

function setSort(next) {
  if (next === "closest" && !here) {
    if (!navigator.geolocation) return toast(t("loc.noGeo"));
    $("#compareNote").textContent = t("compare.locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => { here = { lat: pos.coords.latitude, lng: pos.coords.longitude }; sortBy = "closest"; renderCompare(); },
      () => { toast(t("compare.geoFailed")); sortBy = "cheapest"; renderCompare(); },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
    return;
  }
  sortBy = next;
  renderCompare();
}

function renderCompare() {
  if (!comparing) return;
  $("#compareTitle").textContent = t("compare.title", { name: comparing.name });
  document.querySelectorAll("#compareSort button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.sort === sortBy)));
  $("#compareNote").textContent = sortBy === "closest" ? t("compare.distanceNote") : "";

  let rows = products.filter((q) => sameProduct(comparing, q)).map((q) => {
    const stall = stallById(q.sellerId);
    const pin = pinOf(stall);
    const usable = q.available && stall && !stall.paused;
    return { q, stall, usable, dist: here && pin ? km(here, pin) : null };
  });
  const total = rows.length;
  if (hideUnavailable) rows = rows.filter((r) => r.usable);
  // Shops you can order from first; then by price, or by distance with unknown distances last.
  rows.sort((a, b) => (b.usable - a.usable)
    || (sortBy === "closest" ? (a.dist ?? Infinity) - (b.dist ?? Infinity) : 0)
    || a.q.price - b.q.price
    || a.q.stallName.localeCompare(b.q.stallName));

  const kmFmt = new Intl.NumberFormat(lang === "id" ? "id-ID" : "en-GB", { maximumFractionDigits: 1 });
  // Under 1 km, show metres rounded to 50 m; otherwise km with one decimal.
  const distText = (d) => d < 1 ? t("compare.distanceM", { m: Math.max(50, Math.round(d * 20) * 50) }) : t("compare.distance", { km: kmFmt.format(d) });
  const list = $("#compareList"); list.replaceChildren();
  if (!rows.length) list.append(el("p", { class: "muted", text: total ? t("compare.empty") : t("shop.empty") }));
  for (const { q, stall, dist } of rows) {
    list.append(el("article", { class: "offer" },
      stall ? mapFrame(stall.shop, t("shops.mapOf", { name: q.stallName })) : null,
      el("div", { class: "body" },
        el("div", { class: "offer-head" },
          el("h3", { text: q.stallName }),
          el("span", { class: "price" }, rp(q.price), q.unit ? el("small", { text: " / " + q.unit }) : null)),
        norm(q.name) !== norm(comparing.name) ? el("p", { class: "small", text: q.name }) : null,
        stall && stall.shop.address ? el("p", { class: "muted small", text: stall.shop.address }) : null,
        stall ? homeNote(stall) : null,
        stall && !stall.paused ? hoursLine(stall.hours) : null,
        sortBy === "closest" ? el("p", { class: "small dist", text: dist != null ? distText(dist) : t("compare.noDistance") }) : null,
        !q.available ? el("span", { class: "soldout", text: t("shop.soldOut") }) : null,
        !stall ? null
          : stall.paused ? closedNotice(stall)
          : q.available ? contactButtons(stall, t("contact.waProduct", { stall: stall.stallName, product: q.name }), { order: orderFrom(stall, q.id), onTap: () => tap(q.id) }) : null)));
  }
}

// ---------- shop locations ----------
async function loadShops() {
  try { ({ stalls } = await api("/api/stalls")); } catch { return; }
  renderShops();
  renderShop(); // product cards need each stall's phone for their buttons
  renderCompare();
  showLinkedShop();
}
function renderShops() {
  if (!onShops) return;
  const grid = $("#shopGrid"); grid.replaceChildren();
  $("#shopsEmpty").hidden = stalls.length > 0;
  // Favourite shops first.
  const list = [...stalls].sort((a, b) => favs.has("s", b.id) - favs.has("s", a.id));
  for (const s of list) {
    grid.append(el("article", { class: "shop", id: "lapak-" + s.id },
      mapFrame(s.shop, t("shops.mapOf", { name: s.stallName })) || el("div", { class: "photo" }, leafSvg()),
      el("div", { class: "tools" },
        favButton("s", s.id, s.stallName, renderShops),
        shareButton({ title: s.stallName, text: t("share.shopText", { stall: s.stallName }), url: location.origin + "/lokasi#lapak-" + s.id })),
      el("div", { class: "body" },
        el("h3", { text: s.stallName }),
        s.paused ? null : hoursLine(s.hours),
        hasShop(s) || !s.fromHome ? el("p", { class: "addr" }, icon("map-pin"), s.shop.address || t("shops.noAddress")) : null,
        homeNote(s),
        el("p", {}, el("span", { class: "muted small", text: t("shops.contact") + "  " }), el("span", { class: "contact", text: s.phone })),
        s.paused ? closedNotice(s) : contactButtons(s, t("contact.waShop", { stall: s.stallName }), { order: menuOf(s).length ? orderFrom(s) : null }))));
  }
}

// Links shared from a product (/?p=12) open it; links to a shop (/lokasi#lapak-3) scroll to it.
const shareText = (p) => t("share.productText", { name: p.name, stall: p.stallName, price: rp(p.price) });
let linkedProduct = new URLSearchParams(location.search).get("p");
function openLinkedProduct() {
  if (!linkedProduct || !stalls.length) return;
  const p = products.find((x) => String(x.id) === linkedProduct);
  linkedProduct = null;
  if (p) openCompare(p);
}
let linkedShop = /^#lapak-\d+$/.test(location.hash) ? location.hash : null;
function showLinkedShop() {
  const card = linkedShop && document.querySelector(linkedShop);
  if (!card) return;
  linkedShop = null;
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.classList.add("flash");
}

window.addEventListener("langchange", () => {
  if (catalogLoaded) renderShop(); else loadCatalog();
  renderShops();
  renderCompare();
});

loadCatalog();
loadShops();
