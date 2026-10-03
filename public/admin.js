import { $, el, rp, when, t, api, toast, confirmTap, locationEditor, mapLink } from "/common.js";

let me = null;

async function start() {
  const { user } = await api("/api/me").catch(() => ({ user: null }));
  me = user && user.role === "admin" ? user : null;
  // Tells password managers which account the change-password form is for (kept when the form resets).
  $("#pw-user").setAttribute("value", me?.email || "");
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
  if (err.status === 401 || err.status === 403) { toast(t("signedOut")); me = null; start(); return; }
  toast(err.message);
}

// ---------- tabs ----------
document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll(".tabs button").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
  ["sellers", "products", "wisata", "site", "account"].forEach((v) => ($("#view-" + v).hidden = v !== b.dataset.tab));
}));

function refreshAll() { loadOverview(); loadSellers(); loadProducts(); loadSite(); }
$("#refreshBtn").addEventListener("click", refreshAll);

// ---------- overview ----------
async function loadOverview() {
  try {
    const s = await api("/api/admin/overview");
    $("#st-approved").textContent = s.sellers.approved;
    $("#st-products").textContent = s.products;
  } catch (e) { handle(e); }
}

// ---------- sellers ----------
const shopLoc = locationEditor("n-shop", "shop", "sellerForm.shopHint");
const homeLoc = locationEditor("n-home", "home", "sellerForm.homeHint");
$("#n-shop").replaceWith(shopLoc.node);
$("#n-home").replaceWith(homeLoc.node);
// A shop without a name goes by the seller's name.
const shopName = (s) => s.stallName || s.name;

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
  labelSellerForm();
});

// Title, submit and show/hide buttons of the seller form, which depend on whether it's creating or editing.
function labelSellerForm() {
  $("#sellerFormTitle").textContent = editingSeller ? t("common.editTitle", { name: shopName(editingSeller) }) : t("sellerForm.createTitle");
  $("#sellerSubmit").textContent = t(editingSeller ? "common.saveChanges" : "sellerForm.createTitle");
  $("#sellerFormToggle").textContent = t($("#sellerFormBody").hidden ? "sellerForm.show" : "sellerForm.hide");
}

function resetSellerForm() {
  editingSeller = null;
  $("#sellerForm").reset(); shopLoc.set(null); homeLoc.set(null);
  $("#accountFields").hidden = false;
  labelSellerForm();
  $("#sellerCancel").hidden = true; $("#sellerErr").hidden = true;
}
$("#sellerCancel").addEventListener("click", resetSellerForm);

function editSeller(s) {
  editingSeller = s;
  $("#sellerFormBody").hidden = false;
  $("#accountFields").hidden = true;
  $("#n-name").value = s.name; $("#n-stall").value = s.stallName; $("#n-phone").value = s.phone;
  $("#n-ig").value = s.instagram ? "@" + s.instagram : ""; $("#n-fromhome").checked = s.fromHome;
  shopLoc.set(s.shop); homeLoc.set(s.home);
  labelSellerForm();
  $("#sellerCancel").hidden = false; $("#sellerErr").hidden = true;
  $("#sellerForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

$("#sellerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errBox = $("#sellerErr"); errBox.hidden = true;
  const btn = $("#sellerSubmit"); btn.disabled = true;
  try {
    const body = { name: $("#n-name").value, stallName: $("#n-stall").value, phone: $("#n-phone").value, instagram: $("#n-ig").value, fromHome: $("#n-fromhome").checked, shop: shopLoc.get(), home: homeLoc.get() };
    if (editingSeller) {
      await api("/api/admin/sellers/" + editingSeller.id, { method: "PUT", body });
      toast(t("sellerForm.saved", { name: body.stallName || body.name }));
    } else {
      body.email = $("#n-email").value; body.password = $("#n-pass").value;
      if (!body.email) throw new Error(t("sellerForm.needEmail"));
      await api("/api/admin/sellers", { method: "POST", body });
      showPassword(body.stallName || body.name, body.email, body.password);
      toast(t("sellerForm.created"));
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
    el("strong", { text: stall + ": " }), t("pw.email"), el("strong", { text: email }), t("pw.password"),
    el("strong", { class: "num", style: "font-family:ui-monospace,Consolas,monospace", text: password }),
    t("pw.note"),
    el("button", { class: "linkish", type: "button", onclick: () => (n.hidden = true) }, t("pw.dismiss")));
  n.hidden = false;
  n.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function resetPassword(s) {
  const password = randomPassword();
  try {
    await api(`/api/admin/sellers/${s.id}/password`, { method: "POST", body: { password } });
    showPassword(shopName(s), s.email, password);
  } catch (e) { handle(e); }
}

function locCell(loc, fromHome = false) {
  const link = mapLink(loc);
  return el("td", { class: "loc-cell" },
    el("div", { class: "small", text: loc.address || t("admin.notAdded") }),
    link ? el("a", { href: link, target: "_blank", rel: "noopener", text: t("admin.viewMaps") }) : null,
    fromHome ? el("div", { class: "small muted", text: t("admin.alsoFromHome") }) : null);
}

async function loadSellers() {
  try { ({ sellers } = await api("/api/admin/sellers")); } catch (e) { return handle(e); }
  renderSellers();
}
function renderSellers() {
  const body = $("#sellerRows"); body.replaceChildren();
  if (!sellers.length) body.append(el("tr", {}, el("td", { colspan: "7", class: "muted", text: t("admin.noSellers") })));
  for (const s of sellers) {
    body.append(el("tr", {},
      el("td", {}, el("strong", { text: shopName(s) }), el("div", { class: "muted small", text: t("admin.joined", { date: when(s.createdAt) }) }),
        s.instagram ? el("a", { class: "small", href: "https://instagram.com/" + s.instagram, target: "_blank", rel: "noopener", text: "@" + s.instagram }) : null),
      el("td", {}, el("div", { text: s.name }), el("div", { class: "num", text: s.phone }), el("div", { class: "muted small", text: s.email })),
      locCell(s.shop, s.fromHome),
      locCell(s.home),
      el("td", { class: "num", text: String(s.products) }),
      el("td", {},
        el("span", { class: "pill " + s.status, text: t("sellerStatus." + s.status) }),
        s.paused ? el("div", { class: "small", style: "margin-top:6px" },
          el("span", { class: "pill paused", text: t("pause.badge") }), el("div", { class: "muted", text: s.pauseNote })) : null),
      el("td", {}, el("div", { class: "acts" },
        el("button", { class: "btn small ghost", onclick: () => editSeller(s) }, t("common.edit")),
        el("button", { class: "btn small ghost", onclick: (ev) => confirmTap(ev.currentTarget, t("admin.resetConfirm"), () => resetPassword(s)) }, t("admin.resetPassword")),
        s.status === "suspended" ? el("button", { class: "btn small", onclick: () => setSeller(s, "approved") }, t("admin.reactivate")) : null,
        s.status !== "suspended" ? el("button", { class: "btn small warn", onclick: (ev) => confirmTap(ev.currentTarget, t("admin.suspendConfirm"), () => setSeller(s, "suspended")) }, t("admin.suspend")) : null,
        el("button", { class: "btn small warn", onclick: (ev) => confirmTap(ev.currentTarget, t("admin.deleteShopConfirm"), () => deleteSeller(s)) }, t("admin.deleteShop"))))));
  }
}
// Permanent: removes the seller's account, products and photos. Suspend is the reversible option.
async function deleteSeller(s) {
  try {
    await api("/api/admin/sellers/" + s.id, { method: "DELETE" });
    if (editingSeller && editingSeller.id === s.id) resetSellerForm();
    toast(t("admin.shopDeleted", { stall: shopName(s) }));
    loadSellers(); loadOverview(); loadProducts();
  } catch (e) { handle(e); }
}
async function setSeller(s, status) {
  try { await api("/api/admin/sellers/" + s.id, { method: "PATCH", body: { status } }); toast(t("admin.sellerNow", { stall: shopName(s), status: t("sellerStatus." + status).toLowerCase() })); loadSellers(); loadOverview(); loadProducts(); }
  catch (e) { handle(e); }
}

// ---------- products ----------
async function loadProducts() {
  let products;
  try { ({ products } = await api("/api/admin/products")); } catch (e) { return handle(e); }
  const body = $("#productRows"); body.replaceChildren();
  if (!products.length) body.append(el("tr", {}, el("td", { colspan: "6", class: "muted", text: t("admin.noProducts") })));
  for (const p of products) {
    const state = p.hidden ? ["hidden", t("admin.stateHidden")] : p.available ? ["live", t("admin.stateLive")] : ["done", t("admin.stateSoldOut")];
    body.append(el("tr", {},
      el("td", {}, p.photo ? el("img", { src: p.photo, alt: "" }) : el("img", { alt: "" })),
      el("td", {}, el("strong", { text: p.name }), p.description ? el("div", { class: "muted small", text: p.description }) : null),
      el("td", { text: p.stallName }),
      el("td", { class: "num" }, rp(p.price), p.unit ? el("div", { class: "muted small", text: t("admin.perUnit", { unit: p.unit }) }) : null),
      el("td", {}, el("span", { class: "pill " + state[0], text: state[1] })),
      el("td", {}, el("div", { class: "acts" },
        el("button", { class: "btn small ghost", onclick: () => setHidden(p, !p.hidden) }, t(p.hidden ? "admin.showProduct" : "admin.hideProduct")),
        el("button", { class: "btn small warn", onclick: (ev) => confirmTap(ev.currentTarget, t("admin.deleteConfirm"), () => deleteProduct(p)) }, t("admin.delete"))))));
  }
}
async function setHidden(p, hidden) {
  try { await api("/api/admin/products/" + p.id, { method: "PATCH", body: { hidden } }); toast(t(hidden ? "admin.hidden" : "admin.shown", { name: p.name })); loadProducts(); }
  catch (e) { handle(e); }
}
async function deleteProduct(p) {
  try { await api("/api/admin/products/" + p.id, { method: "DELETE" }); toast(t("admin.deleted", { name: p.name })); loadProducts(); loadOverview(); }
  catch (e) { handle(e); }
}

// ---------- site settings ----------
async function loadSite() {
  try {
    const { site } = await api("/api/site");
    $("#site-ig").value = site.instagram ? "@" + site.instagram : "";
    $("#site-sponsor-name").value = site.sponsorName;
    $("#site-sponsor-phone").value = site.sponsorPhone;
    $("#site-sponsor-email").value = site.sponsorEmail;
    $("#site-homestay-phone").value = site.homestayPhone;
    $("#site-tour-phone").value = site.tourPhone;
  } catch (e) { handle(e); }
}
$("#siteForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("#siteErr"); err.hidden = true;
  try {
    await api("/api/admin/site", { method: "PUT", body: {
      instagram: $("#site-ig").value, sponsorName: $("#site-sponsor-name").value,
      sponsorPhone: $("#site-sponsor-phone").value, sponsorEmail: $("#site-sponsor-email").value, homestayPhone: $("#site-homestay-phone").value, tourPhone: $("#site-tour-phone").value,
    } });
    toast(t("site.saved")); loadSite();
  } catch (x) {
    if (x.status === 401 || x.status === 403) return handle(x);
    err.textContent = x.message; err.hidden = false;
  }
});

// ---------- account ----------
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
  labelSellerForm();
  if (me) { renderSellers(); loadProducts(); }
});

labelSellerForm();
start();
