// Shared helpers for the shop, seller desk and admin desk.
import { t, lang } from "/i18n.js";
export { t };
export const $ = (s, root = document) => root.querySelector(s);

export function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) n.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c);
  return n;
}

// ---------- icons ----------
// Line icons (from Lucide, ISC licence). Use icon("phone") in scripts, or <span data-icon="phone"></span> in HTML.
const ICONS = {
  "arrow-right": '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  message: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  "map-pin": '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  navigation: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  store: '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2 2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/>',
  sparkles: '<path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.14 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  "chevron-down": '<path d="m6 9 6 6 6-6"/>',
};
export function icon(name) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("class", "icon");
  s.setAttribute("aria-hidden", "true");
  s.innerHTML = ICONS[name] || "";
  return s;
}
document.querySelectorAll("[data-icon]").forEach((n) => n.replaceWith(icon(n.dataset.icon)));

// ---------- site header ----------
// A bottom border once the page scrolls.
const siteHeader = document.querySelector(".top");
if (siteHeader) {
  const onScroll = () => siteHeader.classList.toggle("scrolled", window.scrollY > 8 || siteHeader.dataset.alwaysScrolled != null);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}
// On phones the three main tabs sit in a dropdown; close it on a tap outside or Escape.
const navMenu = document.querySelector(".navmenu");
if (navMenu) {
  document.addEventListener("click", (e) => { if (navMenu.open && !navMenu.contains(e.target)) navMenu.open = false; });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && navMenu.open) { navMenu.open = false; navMenu.querySelector("summary").focus(); }
  });
}

export const rp =(n) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n || 0));
export const when = (time) =>
  new Intl.DateTimeFormat(lang === "id" ? "id-ID" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(time));


export function leafSvg() {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 200 200");
  s.setAttribute("aria-hidden", "true");
  s.innerHTML = '<use href="#leaf4" fill="var(--leaf)"/>';
  return s;
}

export async function api(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: { "X-Lang": lang, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
    });
  } catch {
    throw new Error(t("err.offline"));
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || t("err.generic"));
    err.status = res.status;
    throw err;
  }
  return data;
}

let toastTimer;
export function toast(msg) {
  let t = $("#toast");
  if (!t) { t = el("div", { id: "toast", class: "toast", role: "status" }); document.body.append(t); }
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 3500);
}

// Resize a photo in the browser so uploads stay small.
export function shrinkPhoto(file, max = 1000) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      let q = 0.82, out = c.toDataURL("image/jpeg", q);
      while (out.length > 900_000 && q > 0.35) { q -= 0.1; out = c.toDataURL("image/jpeg", q); }
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });
}

// ---------- Google Maps ----------
const hasPin = (loc) => loc && loc.lat != null && loc.lng != null;
const mapQuery = (loc) => (hasPin(loc) ? `${loc.lat},${loc.lng}` : (loc && loc.address) || "");

// Embedded Google Map for a location (pin if set, otherwise the address). Null when there's nothing to show.
export function mapFrame(loc, title = t("loc.map")) {
  const q = mapQuery(loc);
  if (!q) return null;
  return el("iframe", {
    class: "map", title, loading: "lazy", referrerpolicy: "no-referrer-when-downgrade",
    src: "https://www.google.com/maps?output=embed&z=16&q=" + encodeURIComponent(q),
  });
}
export function mapLink(loc) {
  const q = mapQuery(loc);
  return q ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q) : null;
}

// Google Maps route from wherever the buyer is to a location.
export function directionsLink(loc) {
  const q = mapQuery(loc);
  return q ? "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(q) : null;
}

// ---------- calling & WhatsApp ----------
// Indonesian numbers are written like 0812 3456 7890; WhatsApp needs them as 62812...
export function waNumber(phone) {
  let d = String(phone || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "62" + d.slice(1);
  else if (d.startsWith("8")) d = "62" + d;
  return d.length >= 8 ? d : null;
}
function telNumber(phone) {
  const d = String(phone || "").replace(/[^\d+]/g, "");
  return d.replace(/\D/g, "").length >= 5 ? d : null;
}

// Call / WhatsApp / Directions buttons for a seller. `message` pre-fills the WhatsApp chat;
// with `order`, English-speaking buyers get the step-by-step order helper instead; Indonesian buyers just message the seller.
export function contactButtons(stall, message, { directions = true, order = null } = {}) {
  const tel = telNumber(stall.phone), wa = waNumber(stall.phone), dir = directions && stall.shop ? directionsLink(stall.shop) : null;
  const name = stall.stallName;
  return el("div", { class: "reach" },
    tel ? el("a", { class: "btn ghost", href: "tel:" + tel, "aria-label": t("contact.callLabel", { name }) }, icon("phone"), t("contact.call")) : null,
    wa && order && lang === "en" ? el("button", { type: "button", class: "btn", onclick: order, "aria-label": t("order.buttonLabel", { name }) }, icon("message"), t("order.button"))
    : wa ? el("a", { class: "btn", href: "https://wa.me/" + wa + "?text=" + encodeURIComponent(message), target: "_blank", rel: "noopener", "aria-label": t("contact.waLabel", { name }) }, icon("message"), t("contact.whatsapp")) : null,
    dir ? el("a", { class: "btn ghost", href: dir, target: "_blank", rel: "noopener", "aria-label": t("contact.directionsLabel", { name }) }, icon("navigation"), t("contact.directions")) : null);
}

// Read a pin from "lat, lng" or a full Google Maps link.
export function parsePin(s) {
  s = (s || "").trim();
  if (!s) return { lat: null, lng: null };
  const pats = [/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/, /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /@(-?\d+\.\d+),(-?\d+\.\d+)/, /[?&](?:q|query|ll|destination)=(-?\d+\.\d+)(?:,|%2C)\s*(-?\d+\.\d+)/i];
  for (const p of pats) {
    const m = p.exec(s);
    if (m) {
      const lat = Number(m[1]), lng = Number(m[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
    }
  }
  if (/goo\.gl|maps\.app/i.test(s)) throw new Error(t("loc.shortLink"));
  throw new Error(t("loc.badPin"));
}

// Address + map pin editor with a live map preview. `kind` is "shop" or "home"; `hintKey` is the text key of the note under the title.
export function locationEditor(prefix, kind, hintKey) {
  const addr = el("textarea", { id: prefix + "-addr", maxlength: "300", rows: "2" });
  const pin = el("input", { type: "text", id: prefix + "-pin" });
  const err = el("p", { class: "formerr", hidden: true });
  const box = el("div", { class: "mapbox" });
  let cur = { address: "", lat: null, lng: null };
  const draw = () => {
    const f = mapFrame(cur, t(`loc.${kind}.legend`));
    box.replaceChildren(f || el("p", { class: "muted small", text: t("loc.empty") }));
  };
  const readPin = () => {
    try { Object.assign(cur, parsePin(pin.value)); err.hidden = true; return true; }
    catch (e) { err.textContent = e.message; err.hidden = false; return false; }
  };
  let timer;
  addr.addEventListener("input", () => { cur.address = addr.value.trim(); clearTimeout(timer); timer = setTimeout(draw, 700); });
  pin.addEventListener("change", () => { if (readPin()) draw(); });
  const here = el("button", { type: "button", class: "btn small ghost", onclick: () => {
    if (!navigator.geolocation) return toast(t("loc.noGeo"));
    here.disabled = true; here.textContent = t("loc.finding");
    navigator.geolocation.getCurrentPosition((p) => {
      cur.lat = +p.coords.latitude.toFixed(6); cur.lng = +p.coords.longitude.toFixed(6);
      pin.value = cur.lat + ", " + cur.lng; err.hidden = true; draw();
      here.disabled = false; here.textContent = t("loc.useHere");
    }, () => { toast(t("loc.geoFailed")); here.disabled = false; here.textContent = t("loc.useHere"); },
    { enableHighAccuracy: true, timeout: 15000 });
  } });

  const legend = el("legend");
  const hint = hintKey ? el("p", { class: "muted small" }) : null;
  const addrLabel = el("label", { for: addr.id });
  const pinLabel = el("label", { for: pin.id });
  const pinHint = el("span", { class: "hint" });
  const node = el("fieldset", { class: "loc" },
    legend, hint,
    el("div", { class: "field" }, addrLabel, addr),
    el("div", { class: "field" }, pinLabel, pin, pinHint),
    el("div", {}, here), err, box);
  const label = () => {
    legend.textContent = t(`loc.${kind}.legend`);
    if (hint) hint.textContent = t(hintKey);
    addrLabel.textContent = t(`loc.${kind}.address`);
    addr.placeholder = t("loc.addressPlaceholder");
    pinLabel.textContent = t("loc.pin");
    pin.placeholder = t("loc.pinPlaceholder");
    pinHint.textContent = t("loc.pinHint");
    if (!here.disabled) here.textContent = t("loc.useHere");
    draw();
  };
  window.addEventListener("langchange", label);
  label();
  return {
    node,
    get() { cur.address = addr.value.trim(); if (!readPin()) throw new Error(err.textContent); return { ...cur }; },
    set(loc) {
      cur = { address: (loc && loc.address) || "", lat: loc?.lat ?? null, lng: loc?.lng ?? null };
      addr.value = cur.address; pin.value = hasPin(cur) ? cur.lat + ", " + cur.lng : ""; err.hidden = true; draw();
    },
  };
}

// Two-tap confirm for destructive buttons.
export function confirmTap(btn, label, action) {
  if (btn.dataset.armed) { delete btn.dataset.armed; return action(); }
  btn.dataset.armed = "1";
  const orig = btn.textContent;
  btn.textContent = label;
  setTimeout(() => { if (btn.isConnected && btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = orig; } }, 3000);
}
