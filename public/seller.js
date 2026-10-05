import { $, el, rp, t, api, toast, shrinkPhoto, confirmBox, locationEditor, hoursEditor } from "/common.js";
import { locale } from "/i18n.js";
import { PROVINCES, sortedCountries } from "/places.js";

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


// ---------- pickup only or delivery: countries (Indonesia first), then provinces when Indonesia is ticked ----------
const deliv = { countries: new Set(), regions: new Set() };
const delivMode = () => document.querySelector('input[name="s-deliv"]:checked')?.value || "";
function tickList(box, items, chosen, onChange) {
  box.replaceChildren(...items.map(({ value, name }) => {
    const c = el("input", { type: "checkbox", value });
    c.checked = chosen.has(value);
    c.addEventListener("change", () => { c.checked ? chosen.add(value) : chosen.delete(value); onChange(); });
    return el("label", { class: "check", "data-name": name.toLowerCase() }, c, el("span", { text: name }));
  }));
}
function drawCountries() {
  tickList($("#s-countries"), sortedCountries(locale()).map((c) => ({ value: c.code, name: c.name })), deliv.countries, syncDeliv);
  filterCountries();
}
function drawRegions() {
  tickList($("#s-regions"), PROVINCES.map((p) => ({ value: p, name: p })), deliv.regions, syncDeliv);
  filterRegions();
}
// Show only the countries / provinces whose name contains what's typed in the search box above the list.
function filterList(find, list) {
  const q = $(find).value.trim().toLowerCase();
  for (const l of $(list).children) l.hidden = !!q && !l.dataset.name.includes(q);
}
const filterCountries = () => filterList("#s-country-find", "#s-countries");
const filterRegions = () => filterList("#s-region-find", "#s-regions");
function syncDeliv() {
  $("#s-deliv-fields").hidden = delivMode() !== "delivery";
  $("#s-regions-field").hidden = !deliv.countries.has("ID");
  const names = [...$("#s-countries").querySelectorAll("input:checked")].map((c) => c.nextSibling.textContent);
  $("#s-countries-chosen").textContent = names.length ? t("deliv.chosen", { list: names.join(", ") }) : t("deliv.noneChosen");
  const n = deliv.regions.size;
  $("#s-regions-chosen").textContent = n === PROVINCES.length ? t("deliv.allRegions") : n ? t("deliv.chosen", { list: PROVINCES.filter((p) => deliv.regions.has(p)).join(", ") }) : t("deliv.noneChosen");
}
function setDeliv(d) {
  document.querySelectorAll('input[name="s-deliv"]').forEach((r) => { r.checked = r.value === d?.mode; });
  deliv.countries = new Set(d?.countries || []); deliv.regions = new Set(d?.regions || []);
  // A seller starting to deliver most likely delivers in Indonesia, around Surabaya.
  if (!d || d.mode !== "delivery") { deliv.countries.add("ID"); deliv.regions.add("Jawa Timur"); }
  drawCountries(); drawRegions(); syncDeliv();
}
function getDeliv() {
  const mode = delivMode();
  if (!mode) return null;
  if (mode === "pickup") return { mode };
  return { mode, countries: [...deliv.countries], regions: deliv.countries.has("ID") ? [...deliv.regions] : [] };
}
document.querySelectorAll('input[name="s-deliv"]').forEach((r) => r.addEventListener("change", syncDeliv));
$("#s-country-find").addEventListener("input", filterCountries);
$("#s-region-find").addEventListener("input", filterRegions);
$("#s-regions-all").addEventListener("click", () => { PROVINCES.forEach((p) => deliv.regions.add(p)); drawRegions(); syncDeliv(); });
$("#s-regions-none").addEventListener("click", () => { deliv.regions.clear(); drawRegions(); syncDeliv(); });
window.addEventListener("langchange", () => { drawCountries(); syncDeliv(); });

// ---------- session ----------
async function start() {
  const { user } = await api("/api/me").catch(() => ({ user: null }));
  if (user && user.role === "admin") { location.href = "/pengelola"; return; }
  me = user;
  // Tells password managers which account the change-password form is for (kept when the form resets).
  $("#pw-user").setAttribute("value", me?.loginPhone || me?.email || "");
  const setup = !!me && !me.profileDone;
  $("#bootNote")?.remove();
  $("#authView").hidden = !!me;
  $("#setupView").hidden = !setup;
  $("#deskView").hidden = !me || setup;
  $("#logoutBtn").hidden = !me;
  placeProfileForm(setup);
  if (setup) { fillProfile(); return; }
  if (me) { renderHead(); fillProfile(); loadProducts(); loadStats(); loadPosters(); }
}

// On the first sign-in the shop-details form is shown on its own; afterwards it sits in the desk as usual.
const profileHome = document.createComment("profile form");
$("#profileForm").before(profileHome);
function placeProfileForm(setup) {
  const form = $("#profileForm");
  if (setup) $("#setupSlot").append(form); else profileHome.after(form);
  form.querySelector('button[type="submit"]').textContent = t(setup ? "setup.save" : "profile.save");
}

function showErr(id, msg) { const p = $(id); p.textContent = msg; p.hidden = !msg; }

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault(); showErr("#loginErr", "");
  try { await api("/api/auth/login", { method: "POST", body: { email: $("#l-email").value, password: $("#l-pass").value, role: "seller" } }); start(); }
  catch (err) { showErr("#loginErr", err.message); }
});
// ---------- forgotten password: a code on WhatsApp ----------
function showReset(on) {
  $("#loginForm").hidden = on;
  $("#resetForm").hidden = !on;
  showErr("#resetErr", "");
  if (!on) return;
  $("#resetStep1").hidden = false; $("#resetStep2").hidden = true;
  const typed = $("#l-email").value.trim();
  $("#r-phone").value = typed.includes("@") ? "" : typed;
  $("#r-phone").focus();
}
$("#forgotBtn").addEventListener("click", () => showReset(true));
$("#resetBack").addEventListener("click", () => showReset(false));
async function sendCode() {
  showErr("#resetErr", "");
  const btns = [$("#resetSend"), $("#resetResend")];
  btns.forEach((b) => (b.disabled = true));
  try {
    await api("/api/auth/reset/start", { method: "POST", body: { phone: $("#r-phone").value } });
    $("#resetSent").textContent = t("reset.sent", { phone: $("#r-phone").value.trim() });
    $("#resetStep1").hidden = true; $("#resetStep2").hidden = false;
    $("#r-code").focus();
  } catch (err) { showErr("#resetErr", err.message); }
  btns.forEach((b) => (b.disabled = false));
}
$("#resetSend").addEventListener("click", sendCode);
$("#resetResend").addEventListener("click", sendCode);
$("#resetForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if ($("#resetStep2").hidden) return sendCode(); // Enter in the phone field sends the code
  showErr("#resetErr", "");
  if ($("#r-new").value !== $("#r-confirm").value) { showErr("#resetErr", t("common.passwordMismatch")); return; }
  try {
    await api("/api/auth/reset/finish", { method: "POST", body: { phone: $("#r-phone").value, code: $("#r-code").value, password: $("#r-new").value } });
    e.target.reset();
    showReset(false);
    toast(t("reset.done"));
    start();
  } catch (err) { showErr("#resetErr", err.message); }
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
  $("#s-ahead").value = String(me.orderAhead || 0);
  setDeliv(me.delivery);
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
        el("button", { class: "btn small warn", onclick: async () => {
          if (await confirmBox({ title: t("del.title", { name: p.name }), text: t("del.productText"), confirm: t("mine.remove") })) removeProduct(p);
        } }, t("mine.remove")))));
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

// ---------- statistics ----------
let stats = null, statsRange = "week";
async function loadStats() {
  try { stats = await api("/api/seller/stats"); } catch (e) { return; }
  renderStats();
}
function renderStats() {
  if (!stats) return;
  document.querySelectorAll("#statsRange button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.range === statsRange)));
  const tot = stats.total[statsRange];
  $("#statTiles").replaceChildren(...[["view", "sstats.views"], ["contact", "sstats.contacts"], ["share", "sstats.shares"]].map(([k, key]) =>
    el("div", {}, el("dt", { text: t(key) }), el("dd", { text: String(tot[k]) }))));
  const rows = [...stats.products].sort((a, b) => (b[statsRange].view + b[statsRange].contact) - (a[statsRange].view + a[statsRange].contact));
  $("#statRows").replaceChildren(...(rows.length ? rows.map((p) => el("tr", {},
    el("td", { text: p.name }), el("td", { class: "num", text: String(p[statsRange].view) }),
    el("td", { class: "num", text: String(p[statsRange].contact) }), el("td", { class: "num", text: String(p[statsRange].share) })))
    : [el("tr", {}, el("td", { colspan: "4", class: "muted", text: t("sstats.empty") }))]));
}
document.querySelectorAll("#statsRange button").forEach((b) => b.addEventListener("click", () => { statsRange = b.dataset.range; renderStats(); }));
window.addEventListener("langchange", renderStats);

// ---------- profile & password ----------
$("#profileForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errBox = $("#profileErr"); errBox.hidden = true;
  try {
    const body = { name: $("#s-name").value, stallName: $("#s-stall").value, phone: $("#s-phone").value, instagram: $("#s-ig").value, fromHome: $("#s-fromhome").checked, hours: hoursEd.get(),
      orderAhead: Number($("#s-ahead").value), delivery: getDeliv(), shop: shopLoc.get(), home: homeLoc.get() };
    const firstTime = !me.profileDone;
    ({ user: me } = await api("/api/seller/profile", { method: "PATCH", body }));
    if (firstTime) { toast(t("setup.done")); start(); window.scrollTo(0, 0); return; }
    renderHead(); fillProfile(); toast(t("profile.saved"));
  } catch (err) {
    if (err.status === 401 || err.status === 403) return handle(err);
    errBox.textContent = err.message; errBox.hidden = false;
    errBox.scrollIntoView({ behavior: "smooth", block: "center" });
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

// ---------- posters & ads, shown on the shop's page ----------
let posterPending = null;
$("#po-image").addEventListener("change", async (e) => {
  const f = e.target.files[0]; posterPending = null; $("#po-preview").hidden = true;
  if (!f) return;
  try { posterPending = await shrinkPhoto(f, 1400); $("#po-preview").src = posterPending; $("#po-preview").hidden = false; }
  catch { toast(t("product.badPhoto")); e.target.value = ""; }
});
async function loadPosters() {
  let posters = [];
  try { ({ posters } = await api("/api/seller/posters")); } catch (e) { return handle(e); }
  $("#myShopLink").href = "/lapak?id=" + me.id;
  const box = $("#myPosters"); box.replaceChildren();
  if (!posters.length) { box.append(el("p", { class: "muted small", text: t("posters.none") })); return; }
  for (const p of posters) {
    box.append(el("div", { class: "poster-item" },
      el("img", { src: p.image, alt: "" }),
      el("span", { class: "small", text: p.caption || "—" }),
      el("button", { type: "button", class: "btn small warn", onclick: async () => {
        if (await confirmBox({ title: t("del.posterTitle"), text: t("del.posterText"), confirm: t("admin.delete") })) removePoster(p);
      } }, t("admin.delete"))));
  }
}
async function removePoster(p) {
  try { await api("/api/seller/posters/" + p.id, { method: "DELETE" }); toast(t("posters.removed")); loadPosters(); }
  catch (e) { handle(e); }
}
$("#posterForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  showErr("#posterErr", "");
  if (!posterPending) { showErr("#posterErr", t("posters.needImage")); return; }
  const btn = $("#posterBtn"); btn.disabled = true;
  try {
    await api("/api/seller/posters", { method: "POST", body: { image: posterPending, caption: $("#po-caption").value } });
    e.target.reset(); posterPending = null; $("#po-preview").hidden = true;
    toast(t("posters.added"));
    loadPosters();
  } catch (err) {
    if (err.status === 401) handle(err); else showErr("#posterErr", err.message);
  }
  btn.disabled = false;
});

window.addEventListener("langchange", () => {
  labelProductForm();
  if (me) { renderHead(); renderProducts(); }
});

labelProductForm();
start();
