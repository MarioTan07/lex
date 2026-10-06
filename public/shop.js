import { $, el, rp, t, icon, leafSvg, api, toast, mapFrame, contactButtons, hoursLine, favs, favButton, shareButton, tap, aheadLine, deliveryLine, sizesOf, sizesOnSale, fromPrice, priceText, priceTag } from "/common.js";
import { lang, locale, tIn } from "/i18n.js";
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
// The message a WhatsApp button fills in. Sellers read Indonesian, so it's always in Indonesian.
const waText = (key, vars) => tIn("id", key, vars);

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

// On a shop's own page (/lapak?id=3) the catalog shows only that shop's products.
const shopPageId = $("#shopPage") ? Number(new URLSearchParams(location.search).get("id")) || -1 : null;
const shopLink = (id, name) => el("a", { class: "shoplink", href: "/lapak?id=" + id, text: name });

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
  // Shop cards offer the order helper only once their products are known; the shop list may have come first.
  renderShops();
  renderShopPage();
}

let query = "";
if (onCatalog) $("#search").addEventListener("input", (e) => { query = norm(e.target.value); renderShop(); });

function renderShop() {
  if (!onCatalog) return;
  const pool = shopPageId ? products.filter((p) => p.sellerId === shopPageId) : products;
  const hotHere = hot.filter((id) => pool.some((p) => p.id === id));
  const names = [...new Map(pool.map((p) => [p.sellerId, p.stallName])).entries()];
  const chips = $("#stallChips"); chips.replaceChildren();
  chips.hidden = names.length < 2;
  if (names.length > 1) {
    const mk = (id, label) => el("button", { "aria-pressed": String(filterStall === id), onclick: () => { filterStall = id; renderShop(); } }, label);
    chips.append(mk("all", t("shop.allStalls")), ...names.map(([id, name]) => mk(id, name)));
  }
  // Lagi hits, favourites and the categories that have products.
  const kinds = $("#kindChips"); kinds.replaceChildren();
  const cats = CATEGORIES.filter((c) => pool.some((p) => p.category === c));
  const hasFav = pool.some((p) => favs.has("p", p.id));
  const delivers = (p) => stallById(p.sellerId)?.delivery?.mode === "delivery";
  const hasDeliv = pool.some(delivers);
  if (filterKind === "hot" && !hotHere.length || filterKind === "fav" && !hasFav || filterKind === "deliv" && !hasDeliv) filterKind = "all";
  const kindChip = (k, label, ico) => el("button", { "aria-pressed": String(filterKind === k), onclick: () => { filterKind = k; renderShop(); } }, ico ? icon(ico) : null, label);
  const kindList = [hotHere.length ? kindChip("hot", t("hot.label"), "flame") : null, hasFav ? kindChip("fav", t("fav.mine"), "heart") : null, hasDeliv ? kindChip("deliv", t("delivery.chip"), "truck") : null, ...cats.map((c) => kindChip(c, t("cat." + c)))].filter(Boolean);
  kinds.hidden = !kindList.length;
  if (kindList.length) kinds.append(kindChip("all", t("cat.all")), ...kindList);
  const kindOk = (p) => filterKind === "all" || (filterKind === "hot" ? hot.includes(p.id) : filterKind === "fav" ? favs.has("p", p.id) : filterKind === "deliv" ? delivers(p) : p.category === filterKind);
  const shown = pool.filter((p) => kindOk(p) && (filterStall === "all" || p.sellerId === filterStall)
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
    const open = () => openProduct(p);
    const compare = () => openCompare(p);
    const sellers = new Set(products.filter((q) => sameProduct(p, q)).map((q) => q.sellerId)).size;
    grid.append(el("article", { class: "card", id: "produk-" + p.id },
      photoBox(p, open),
      hot.includes(p.id) ? el("span", { class: "hot-badge" }, icon("flame"), t("hot.label")) : null,
      el("div", { class: "tools" },
        favButton("p", p.id, p.name, renderShop),
        shareButton({ title: p.name, text: shareText(p), url: location.origin + "/?p=" + p.id, onShare: () => tap(p.id, "share") })),
      el("div", { class: "body" },
        el("div", { class: "card-head" },
          el("div", {},
            el("h3", {}, el("button", { type: "button", class: "titlelink", onclick: open, text: p.name })),
            el("p", { class: "stall" }, icon("store"), shopLink(p.sellerId, p.stallName)),
            stall && !stall.paused ? hoursLine(stall.hours) : null,
            aheadLine(stall),
            deliveryLine(stall)),
          priceTag(p)),
        perPieceLine(p),
        sellers > 1 ? el("button", { type: "button", class: "comparelink", onclick: compare, text: t("compare.count", { n: sellers }) }) : null,
        el("p", { class: "desc", text: p.description || "" }),
        p.available ? null : el("span", { class: "soldout", text: t("shop.soldOut") }),
        !stall ? null
          : stall.paused ? closedNotice(stall)
          : p.available ? contactButtons(stall, waText("contact.waProduct", { stall: stall.stallName, product: p.name }), { directions: false, order: orderFrom(stall, p.id), onTap: (kind) => tap(p.id, kind) }) : null)));
  }
  renderHero();
  openLinkedProduct();
}

// A product's photo, or a swipeable strip with dots and arrows when it has several. On a card, tapping a photo
// opens the product; in the product window (`open` is null) the photos are just shown.
function photoBox(p, open) {
  const pics = p.photos && p.photos.length ? p.photos : p.photo ? [p.photo] : [];
  const img = (src, i) => el("img", { src, alt: open ? "" : t("photos.alt", { name: p.name, n: i + 1, total: pics.length }), loading: "lazy" });
  if (pics.length < 2) {
    const inner = pics[0] ? img(pics[0], 0) : leafSvg();
    return open ? el("button", { type: "button", class: "photo", onclick: open, "aria-label": t("detail.view", { name: p.name }) }, inner)
      : el("div", { class: "photo" }, inner);
  }
  const track = el("div", { class: "pics" }, ...pics.map((src, i) => open
    ? el("button", { type: "button", onclick: open, "aria-label": t("photos.open", { name: p.name, n: i + 1, total: pics.length }) }, img(src, i))
    : el("div", {}, img(src, i))));
  const dots = el("div", { class: "pic-dots", "aria-hidden": "true" }, ...pics.map((_, i) => el("span", { class: i ? "" : "on" })));
  let at = 0;
  const go = (i) => { at = Math.max(0, Math.min(pics.length - 1, i)); track.scrollTo({ left: at * track.clientWidth, behavior: "smooth" }); };
  track.addEventListener("scroll", () => {
    at = Math.round(track.scrollLeft / track.clientWidth);
    [...dots.children].forEach((d, i) => (d.className = i === at ? "on" : ""));
  }, { passive: true });
  return el("div", { class: "photo multi" }, track, dots,
    el("button", { type: "button", class: "pic-nav prev", "aria-label": t("photos.prev"), onclick: (e) => { e.stopPropagation(); go(at - 1); } }, icon("chevron-left")),
    el("button", { type: "button", class: "pic-nav next", "aria-label": t("photos.next"), onclick: (e) => { e.stopPropagation(); go(at + 1); } }, icon("chevron-right")));
}

// ---------- hero: today's pick & seller count ----------
// One product from a shop that's open, changing once a day, so the hero shows something real.
function renderHero() {
  if (!$("#pick")) return;
  const open = products.filter((p) => { const s = stallById(p.sellerId); return p.available && s && !s.paused; });
  const pick = $("#pick");
  pick.hidden = !open.length;
  if (open.length) {
    // One dish a day, not one product: a dish sold by four shops would otherwise fill four days.
    // When the dish comes round again, it shows another shop's product.
    const day = Math.floor(Date.now() / 864e5);
    const dishes = dishGroups(open);
    const dish = dishes[day % dishes.length];
    const p = dish[Math.floor(day / dishes.length) % dish.length];
    const shops = new Set(dish.map((q) => q.sellerId)).size;
    const name = shops > 1 ? dishName(dish) : p.name;
    $("#pickName").textContent = name;
    // Sold by several shops: the lowest price, and a tap opens the comparison of every shop.
    $("#pickPrice").textContent = shops > 1 ? t("size.from", { price: rp(Math.min(...dish.map(fromPrice))) }) : priceText(p);
    pick.onclick = () => (shops > 1 ? openCompare(p) : openProduct(p));
    pick.setAttribute("aria-label", t("detail.view", { name }));
  }
  $("#joined").hidden = !stalls.length;
  $("#joinedCount").textContent = t("hero.sellers", { n: stalls.length });
  // Three shops as initials in circles, and "+4" for the rest. Hovering shows every shop's name.
  const shown = stalls.slice(0, 3);
  const faces = $("#joinedFaces");
  faces.replaceChildren(...shown.map((s) => el("span", { text: initials(s.stallName) })),
    ...(stalls.length > shown.length ? [el("span", { class: "more", text: "+" + (stalls.length - shown.length) })] : []));
  $("#joined").title = stalls.map((s) => s.stallName).join(", ");
}
// "Semanggi Bu Ning" → "BN", "Pecel Semanggi Mak Sum" → "MS": words every shop shares are skipped.
const COMMON_WORDS = new Set(["semanggi", "pecel", "dapur", "camilan", "toko", "warung", "kedai", "lapak", "kampoeng", "kampung", "olahan", "jajanan", "kue"]);
function initials(name) {
  const words = String(name || "").split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const own = words.filter((w) => !COMMON_WORDS.has(w.toLowerCase()));
  return (own.length ? own : words).slice(0, 2).map((w) => [...w][0]).join("").toUpperCase() || "?";
}


// ---------- compare: every shop selling a product ----------
// Sellers type product names themselves, so "Pecel Semanggi", "pecel semanggi" and "pecel semanggi Suroboyo"
// count as the same dish: case, accents, punctuation and extra spaces are ignored, and a name matches when
// it contains the other one as whole words ("pecel semanggi!" and "Pecel-Semanggi" too).
const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const sameProduct = (a, b) => { const x = " " + norm(a.name) + " ", y = " " + norm(b.name) + " "; return x.includes(y) || y.includes(x); };
// Products grouped into dishes, shortest name first in each group ("Pecel semanggi" before "Pecel semanggi
// porsi besar"), groups in alphabetical order, so the order is the same every day.
function dishGroups(list) {
  const groups = [];
  for (const p of [...list].sort((a, b) => norm(a.name).length - norm(b.name).length || a.id - b.id)) {
    const g = groups.find((g) => sameProduct(g[0], p));
    if (g) g.push(p); else groups.push([p]);
  }
  return groups.sort((a, b) => norm(a[0].name).localeCompare(norm(b[0].name)));
}
// A dish's name as most of its sellers write it ("Pecel semanggi" over "pecel SEMANGGI"), from its shortest names.
function dishName(dish) {
  const base = norm(dish[0].name), count = new Map();
  for (const p of dish) if (norm(p.name) === base) { const n = p.name.trim().replace(/\s+/g, " "); count.set(n, (count.get(n) || 0) + 1); }
  const looks = (n) => (n[0] === n[0].toUpperCase() ? 1 : 0) - (n === n.toUpperCase() ? 1 : 0); // capitalised, not ALL CAPS
  return [...count].sort((a, b) => b[1] - a[1] || looks(b[0]) - looks(a[0]))[0][0];
}

let comparing = null;          // the product whose panel is open
let sortBy = "cheapest";       // "cheapest" | "perPiece" | "closest"

// Pieces in one packaging's price: the seller's number, or a "Dijual per" that is just a count
// ("65", "isi 12", "10 buah"); otherwise one. "250 g" isn't a count, so it stays one.
const piecesOf = (s) => s.pieces || Number((/^\s*(?:isi\s*)?(\d+)\s*(?:buah|biji|pcs?|potong|butir)?\s*$/i.exec(s.unit || "") || [])[1]) || 1;
// Price per piece; with several packagings, the lowest among those on sale.
const perPiece = (p) => Math.min(...(sizesOnSale(p).length ? sizesOnSale(p) : sizesOf(p)).map((s) => s.price / piecesOf(s)));
// "≈ Rp 2.462 / buah" under a price that covers several pieces.
const perPieceLine = (p) => sizesOf(p).some((s) => piecesOf(s) > 1) ? el("p", { class: "perpiece small", text: t("compare.perPieceValue", { price: rp(perPiece(p)) }) }) : null;
// Every packaging and its price, in the product window of a product that has several.
const sizeList = (p) => sizesOf(p).length < 2 ? null : el("ul", { class: "size-list" }, ...sizesOf(p).map((s) => el("li", { class: s.out ? "out" : "" },
  el("span", { text: s.unit }),
  piecesOf(s) > 1 ? el("span", { class: "perpiece small", text: t("compare.perPieceValue", { price: rp(s.price / piecesOf(s)) }) }) : null,
  el("strong", { text: rp(s.price) }), s.out ? el("span", { class: "soldout", text: t("shop.soldOut") }) : null)));
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

function openCompare(p, { counted = false } = {}) {
  if (!counted) tap(p.id);
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
  // Shops you can order from first; then by price, price per piece, or distance (unknown distances last).
  rows.sort((a, b) => (b.usable - a.usable)
    || (sortBy === "closest" ? (a.dist ?? Infinity) - (b.dist ?? Infinity) : 0)
    || (sortBy === "perPiece" ? perPiece(a.q) - perPiece(b.q) : 0)
    || fromPrice(a.q) - fromPrice(b.q)
    || a.q.stallName.localeCompare(b.q.stallName));

  const kmFmt = new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 });
  // Under 1 km, show metres rounded to 50 m; otherwise km with one decimal.
  const distText = (d) => d < 1 ? t("compare.distanceM", { m: Math.max(50, Math.round(d * 20) * 50) }) : t("compare.distance", { km: kmFmt.format(d) });
  const list = $("#compareList"); list.replaceChildren();
  if (!rows.length) list.append(el("p", { class: "muted", text: total ? t("compare.empty") : t("shop.empty") }));
  for (const { q, stall, dist } of rows) {
    list.append(el("article", { class: "offer" },
      stall ? mapFrame(stall.shop, t("shops.mapOf", { name: q.stallName })) : null,
      el("div", { class: "body" },
        el("div", { class: "offer-head" },
          el("h3", {}, shopLink(q.sellerId, q.stallName)),
          priceTag(q)),
        perPieceLine(q),
        norm(q.name) !== norm(comparing.name) ? el("p", { class: "small", text: q.name }) : null,
        stall && stall.shop.address ? el("p", { class: "muted small", text: stall.shop.address }) : null,
        stall ? homeNote(stall) : null,
        stall && !stall.paused ? hoursLine(stall.hours) : null,
        aheadLine(stall),
        deliveryLine(stall),
        sortBy === "closest" ? el("p", { class: "small dist", text: dist != null ? distText(dist) : t("compare.noDistance") }) : null,
        !q.available ? el("span", { class: "soldout", text: t("shop.soldOut") }) : null,
        !stall ? null
          : stall.paused ? closedNotice(stall)
          : q.available ? contactButtons(stall, waText("contact.waProduct", { stall: stall.stallName, product: q.name }), { order: orderFrom(stall, q.id), onTap: (kind) => tap(q.id, kind) }) : null)));
  }
}

// ---------- shop locations ----------
async function loadShops() {
  try { ({ stalls } = await api("/api/stalls")); } catch { return; }
  renderShops();
  renderShopPage();
  renderShop(); // product cards need each stall's phone for their buttons
  renderCompare();
  renderProduct();
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
        el("h3", {}, shopLink(s.id, s.stallName)),
        s.paused ? null : hoursLine(s.hours),
        aheadLine(s),
        deliveryLine(s),
        hasShop(s) || !s.fromHome ? el("p", { class: "addr" }, icon("map-pin"), s.shop.address || t("shops.noAddress")) : null,
        homeNote(s),
        el("p", {}, el("span", { class: "muted small", text: t("shops.contact") + "  " }), el("span", { class: "contact", text: s.phone })),
        el("a", { class: "btn ghost small shop-open", href: "/lapak?id=" + s.id }, icon("store"), t("shopPage.view")),
        s.paused ? closedNotice(s) : contactButtons(s, waText("contact.waShop", { stall: s.stallName }), { order: menuOf(s).length ? orderFrom(s) : null }))));
  }
}

// ---------- a shop's own page: details, posters, then its products (the catalog below) ----------
function renderShopPage() {
  if (!shopPageId || !stalls.length) return;
  const s = stallById(shopPageId);
  const head = $("#shopHead");
  if (!s) {
    head.replaceChildren(el("div", { class: "empty" }, el("h3", { text: t("shopPage.notFound") }), el("p", { text: t("shopPage.notFoundText") })));
    return;
  }
  document.title = s.stallName + " · Kampoeng Semanggi";
  head.replaceChildren(
    el("div", { class: "shop-head-main" },
      el("p", { class: "eyebrow", text: t("shopPage.eyebrow") }),
      el("h1", { text: s.stallName }),
      s.paused ? closedNotice(s) : hoursLine(s.hours),
      aheadLine(s),
      deliveryLine(s, { full: true }),
      hasShop(s) || !s.fromHome ? el("p", { class: "addr" }, icon("map-pin"), s.shop.address || t("shops.noAddress")) : null,
      homeNote(s),
      el("p", {}, el("span", { class: "muted small", text: t("shops.contact") + "  " }), el("span", { class: "contact", text: s.phone })),
      el("div", { class: "detail-tools" },
        favButton("s", s.id, s.stallName, renderShopPage),
        shareButton({ title: s.stallName, text: t("share.shopText", { stall: s.stallName }), url: location.origin + "/lapak?id=" + s.id })),
      s.paused ? null : contactButtons(s, waText("contact.waShop", { stall: s.stallName }), { order: menuOf(s).length ? orderFrom(s) : null })),
    mapFrame(s.shop, t("shops.mapOf", { name: s.stallName })));
  renderPosters();
}
let posters = null;
async function loadPosters() {
  if (!shopPageId || shopPageId < 0) return;
  try { ({ posters } = await api(`/api/stalls/${shopPageId}/posters`)); } catch { posters = []; }
  renderPosters();
}
function renderPosters() {
  const wrap = $("#posterWrap");
  if (!wrap || !posters) return;
  const s = stallById(shopPageId);
  wrap.hidden = !posters.length || !s;
  $("#posterList").replaceChildren(...posters.map((p, i) => el("figure", { class: "poster" },
    el("a", { href: p.image, target: "_blank", rel: "noopener", "aria-label": t("posters.open", { n: i + 1 }) },
      el("img", { src: p.image, alt: p.caption || t("posters.alt", { stall: s ? s.stallName : "" }), loading: "lazy" })),
    p.caption ? el("figcaption", { text: p.caption }) : null)));
}

// Links shared from a product (/?p=12) open it; links to a shop (/lokasi#lapak-3) scroll to it.
const shareText = (p) => t("share.productText", { name: p.name, stall: p.stallName, price: priceText(p) });
let linkedProduct = new URLSearchParams(location.search).get("p");
function openLinkedProduct() {
  if (!linkedProduct || !stalls.length) return;
  const p = products.find((x) => String(x.id) === linkedProduct);
  linkedProduct = null;
  if (p) openProduct(p);
}
let linkedShop = /^#lapak-\d+$/.test(location.hash) ? location.hash : null;
function showLinkedShop() {
  const card = linkedShop && document.querySelector(linkedShop);
  if (!card) return;
  linkedShop = null;
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.classList.add("flash");
}

// ---------- product window: a product's photos, description, price and seller ----------
let viewing = null;  // the product whose window is open
function openProduct(p) {
  const d = $("#product");
  if (!d) return openCompare(p);
  tap(p.id);
  viewing = p;
  renderProduct();
  if (!d.open) d.showModal();
  d.scrollTop = 0;
}
if ($("#product")) {
  $("#productClose").addEventListener("click", () => $("#product").close());
  $("#product").addEventListener("click", (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }); // tap outside the box
  $("#product").addEventListener("close", () => { viewing = null; });
}
function renderProduct() {
  if (!viewing) return;
  const p = products.find((x) => x.id === viewing.id) || viewing;
  viewing = p;
  const stall = stallById(p.sellerId);
  const sellers = new Set(products.filter((q) => sameProduct(p, q)).map((q) => q.sellerId)).size;
  $("#productTitle").textContent = p.name;
  $("#productBody").replaceChildren(
    el("div", { class: "detail-photo" }, photoBox(p, null)),
    el("div", { class: "detail-main" },
      el("div", { class: "detail-price" },
        priceTag(p),
        el("div", { class: "detail-tools" },
          favButton("p", p.id, p.name, () => { renderShop(); renderProduct(); }),
          shareButton({ title: p.name, text: shareText(p), url: location.origin + "/?p=" + p.id, onShare: () => tap(p.id, "share") }))),
      sizesOf(p).length > 1 ? sizeList(p) : perPieceLine(p),
      p.category ? el("p", {}, el("span", { class: "cat-tag", text: t("cat." + p.category) })) : null,
      p.available ? null : el("span", { class: "soldout", text: t("shop.soldOut") }),
      el("p", { class: "detail-desc", text: p.description || t("detail.noDescription") }),
      sellers > 1 ? el("button", { type: "button", class: "btn ghost small detail-compare", onclick: () => { $("#product").close(); openCompare(p, { counted: true }); } },
        icon("store"), t("detail.compare", { n: sellers })) : null),
    stall ? el("section", { class: "offer detail-seller" },
      mapFrame(stall.shop, t("shops.mapOf", { name: stall.stallName })),
      el("div", { class: "body" },
        el("p", { class: "eyebrow", text: t("detail.seller") }),
        el("h3", {}, shopLink(stall.id, stall.stallName)),
        stall.shop.address ? el("p", { class: "addr" }, icon("map-pin"), stall.shop.address) : null,
        homeNote(stall),
        stall.paused ? null : hoursLine(stall.hours),
        aheadLine(stall),
        deliveryLine(stall, { full: true }),
        stall.paused ? closedNotice(stall)
          : p.available ? contactButtons(stall, waText("contact.waProduct", { stall: stall.stallName, product: p.name }), { order: orderFrom(stall, p.id), onTap: (kind) => tap(p.id, kind) })
          : null)) : null);
}

window.addEventListener("langchange", () => {
  if (catalogLoaded) renderShop(); else loadCatalog();
  renderShops();
  renderShopPage();
  renderCompare();
  renderProduct();
});

loadCatalog();
loadShops();
loadPosters();
