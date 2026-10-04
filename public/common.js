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
  clover: '<path d="M16.17 7.83 2 22"/><path d="M4.02 12a2.83 2.83 0 1 1 3.81-4.17A2.83 2.83 0 1 1 12 4.02a2.83 2.83 0 1 1 4.17 3.81A2.83 2.83 0 1 1 19.98 12a2.83 2.83 0 1 1-3.81 4.17A2.83 2.83 0 1 1 12 19.98a2.83 2.83 0 1 1-4.17-3.81A1 1 0 1 1 4 12"/><path d="m7.83 7.83 8.34 8.34"/>',
  sprout: '<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
  palette: '<circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.56-2.5 5.56-5.55C21.97 6.01 17.46 2 12 2z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  instagram: '<rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>',
  calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  "chevron-left": '<path d="m15 18-6-6 6-6"/>',
  "chevron-right": '<path d="m9 18 6-6-6-6"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
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
// "About us" opens a small list: on hover with a mouse, on tap otherwise. A tap outside, Escape or picking a link closes it.
for (const drop of document.querySelectorAll(".navdrop")) {
  const summary = drop.querySelector("summary");
  let viaHover = false;
  drop.addEventListener("mouseenter", () => { if (matchMedia("(hover: hover)").matches && !drop.open) { drop.open = true; viaHover = true; } });
  drop.addEventListener("mouseleave", () => { if (viaHover) { drop.open = false; viaHover = false; } });
  summary.addEventListener("click", (e) => { if (viaHover) { e.preventDefault(); viaHover = false; } });
  document.addEventListener("click", (e) => { if (drop.open && !drop.contains(e.target)) drop.open = false; });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && drop.open) { drop.open = false; summary.focus(); } });
  const mark = () => drop.querySelectorAll("a").forEach((a) => a.classList.toggle("current", a.href === location.href || (a.pathname === location.pathname && a.hash === "")));
  drop.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => { drop.open = false; viaHover = false; setTimeout(mark); }));
  window.addEventListener("hashchange", mark);
  mark();
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

export const instagramLink = (handle) => "https://instagram.com/" + encodeURIComponent(handle);

// Call / WhatsApp / Directions / Instagram buttons for a seller (Directions only when they have a shop, Instagram only when set). `message` pre-fills the WhatsApp chat;
// with `order`, English-speaking buyers get the step-by-step order helper instead; Indonesian buyers just message the seller.
// `onTap(kind)` runs when the buyer calls ("call"), messages ("whatsapp") or orders ("order"), to count interest in a product.
export { telNumber };
export function contactButtons(stall, message, { directions = true, order = null, onTap = null } = {}) {
  const tel = telNumber(stall.phone), wa = waNumber(stall.phone), dir = directions && stall.shop ? directionsLink(stall.shop) : null;
  const name = stall.stallName;
  return el("div", { class: "reach", onclick: onTap ? (e) => {
    const b = e.target.closest("a, button");
    if (!b) return;
    const href = b.getAttribute("href") || "";
    if (href.startsWith("tel:")) onTap("call");
    else if (href.includes("wa.me")) onTap("whatsapp");
    else if (b.tagName === "BUTTON") onTap("order");
  } : null },
    tel ? el("a", { class: "btn ghost", href: "tel:" + tel, "aria-label": t("contact.callLabel", { name }) }, icon("phone"), t("contact.call")) : null,
    wa && order && lang === "en" ? el("button", { type: "button", class: "btn", onclick: order, "aria-label": t("order.buttonLabel", { name }) }, icon("message"), t("order.button"))
    : wa ? el("a", { class: "btn", href: "https://wa.me/" + wa + "?text=" + encodeURIComponent(message), target: "_blank", rel: "noopener", "aria-label": t("contact.waLabel", { name }) }, icon("message"), t("contact.whatsapp")) : null,
    dir ? el("a", { class: "btn ghost", href: dir, target: "_blank", rel: "noopener", "aria-label": t("contact.directionsLabel", { name }) }, icon("navigation"), t("contact.directions")) : null,
    stall.instagram ? el("a", { class: "btn ghost", href: instagramLink(stall.instagram), target: "_blank", rel: "noopener", "aria-label": t("contact.instagramLabel", { name }) }, icon("instagram"), "Instagram") : null);
}

// ---------- opening hours ----------
// Hours are { mon: ["07:00", "15:00"], ..., sun: null } in Surabaya time (WIB), whatever the buyer's own time zone.
export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const toMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
const clock = (s) => (lang === "id" ? s.replace(":", ".") : s);
function wibNow() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type).value;
  return { day: DAYS.indexOf(get("weekday").toLowerCase().slice(0, 3)), min: Number(get("hour")) * 60 + Number(get("minute")) };
}
// { open: true/false, text } for a shop right now, or null when it has no hours set.
// A closing time earlier than the opening time means the shop is open past midnight.
export function openStatus(hours) {
  if (!hours || !DAYS.some((d) => hours[d])) return null;
  const { day, min } = wibNow();
  const on = (i) => hours[DAYS[((i % 7) + 7) % 7]];
  const today = on(day), yesterday = on(day - 1);
  if (today) {
    const o = toMin(today[0]), c = toMin(today[1]);
    if (c > o ? min >= o && min < c : min >= o) return { open: true, text: t("hours.openUntil", { time: clock(today[1]) }) };
  }
  if (yesterday && toMin(yesterday[1]) <= toMin(yesterday[0]) && min < toMin(yesterday[1])) return { open: true, text: t("hours.openUntil", { time: clock(yesterday[1]) }) };
  if (today && min < toMin(today[0])) return { open: false, text: t("hours.opensToday", { time: clock(today[0]) }) };
  for (let i = 1; i <= 7; i++) {
    const next = on(day + i);
    if (next) return { open: false, text: i === 1 ? t("hours.opensTomorrow", { time: clock(next[0]) }) : t("hours.opensDay", { day: t("day." + DAYS[(day + i) % 7]), time: clock(next[0]) }) };
  }
  return null;
}
export function hoursLine(hours) {
  const st = openStatus(hours);
  return st ? el("p", { class: "hours " + (st.open ? "is-open" : "is-closed") }, icon("clock"), st.text) : null;
}
// Weekly opening-hours editor: a row per day with an "open" tick and opening/closing times.
export function hoursEditor(prefix) {
  const rows = DAYS.map((d) => {
    const on = el("input", { type: "checkbox", id: `${prefix}-${d}` });
    const from = el("input", { type: "time", step: "900", "aria-label": "" });
    const to = el("input", { type: "time", step: "900", "aria-label": "" });
    const label = el("label", { for: on.id, class: "check" }, on, el("span"));
    const sync = () => { from.disabled = to.disabled = !on.checked; if (on.checked && !from.value) { from.value = "07:00"; to.value = "15:00"; } };
    on.addEventListener("change", sync);
    return { d, on, from, to, label, sync, node: el("div", { class: "hours-row" }, label, from, el("span", { class: "muted", text: "–" }), to) };
  });
  const legend = el("legend"), hint = el("p", { class: "muted small" });
  const copy = el("button", { type: "button", class: "btn small ghost", onclick: () => {
    const m = rows[0];
    for (const r of rows.slice(1)) { r.on.checked = m.on.checked; r.from.value = m.from.value; r.to.value = m.to.value; r.sync(); }
  } });
  const node = el("fieldset", { class: "loc hours-edit" }, legend, hint, ...rows.map((r) => r.node), el("div", {}, copy));
  const label = () => {
    legend.textContent = t("hours.legend"); hint.textContent = t("hours.hint"); copy.textContent = t("hours.copyMonday");
    for (const r of rows) {
      r.label.querySelector("span").textContent = t("day." + r.d);
      r.from.setAttribute("aria-label", t("hours.opensAt", { day: t("day." + r.d) }));
      r.to.setAttribute("aria-label", t("hours.closesAt", { day: t("day." + r.d) }));
    }
  };
  window.addEventListener("langchange", label);
  label();
  return {
    node,
    get() {
      const out = {};
      for (const r of rows) {
        if (!r.on.checked) { out[r.d] = null; continue; }
        if (!r.from.value || !r.to.value || r.from.value === r.to.value) throw new Error(t("hours.needTimes", { day: t("day." + r.d) }));
        out[r.d] = [r.from.value, r.to.value];
      }
      return DAYS.some((d) => out[d]) ? out : "";
    },
    set(h) {
      for (const r of rows) { const v = h && h[r.d]; r.on.checked = !!v; r.from.value = v ? v[0] : ""; r.to.value = v ? v[1] : ""; r.sync(); }
    },
  };
}

// ---------- favourites, sharing, interest ----------
// Favourite products and shops live in this browser only: { p: [ids], s: [ids] }.
function readFavs() { try { const f = JSON.parse(localStorage.getItem("ks-fav")); return { p: f?.p || [], s: f?.s || [] }; } catch { return { p: [], s: [] }; } }
export const favs = {
  has: (kind, id) => readFavs()[kind].includes(id),
  count: () => { const f = readFavs(); return f.p.length + f.s.length; },
  toggle(kind, id) {
    const f = readFavs();
    f[kind] = f[kind].includes(id) ? f[kind].filter((x) => x !== id) : [...f[kind], id];
    try { localStorage.setItem("ks-fav", JSON.stringify(f)); } catch {}
    return f[kind].includes(id);
  },
};
export function favButton(kind, id, name, onChange) {
  const b = el("button", { type: "button", class: "tool fav" }, icon("heart"));
  const draw = () => {
    const on = favs.has(kind, id);
    b.setAttribute("aria-pressed", String(on));
    b.setAttribute("aria-label", t(on ? "fav.remove" : "fav.add", { name }));
  };
  b.addEventListener("click", (e) => { e.stopPropagation(); const on = favs.toggle(kind, id); draw(); toast(t(on ? "fav.added" : "fav.removed", { name })); onChange && onChange(); });
  draw();
  return b;
}
// Count a visitor's interest in a product (at most once a day per visitor; only the count is stored).
// `kind` is view, call, whatsapp, order or share; it goes into the seller's statistics.
export function tap(productId, kind = "view") {
  fetch("/api/tap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, kind }), keepalive: true }).catch(() => {});
}
// "Takes large orders · order 2 days ahead · min. 50 portions" for sellers who take them.
export function bigOrderLine(stall) {
  const b = stall && stall.bigOrders;
  if (!b) return null;
  return el("p", { class: "big-order" }, icon("calendar"), t(b.days === 1 ? "big.label1" : "big.labelN", { days: b.days }) + (b.note ? " · " + b.note : ""));
}
// Share a link with the phone's share sheet, or on WhatsApp where that isn't available.
export function shareButton({ title, text, url, onShare }) {
  return el("button", { type: "button", class: "tool share", "aria-label": t("share.label", { name: title }), onclick: async (e) => {
    e.stopPropagation();
    onShare && onShare();
    if (navigator.share) { try { await navigator.share({ title, text, url }); } catch {} return; }
    window.open("https://wa.me/?text=" + encodeURIComponent(text + " " + url), "_blank", "noopener");
  } }, icon("share"));
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
// A confirmation window for actions that can't be undone. Stays open until the person chooses;
// resolves true only when they press the confirm button. Cancel has the focus, so Enter doesn't delete by accident.
export function confirmBox({ title, text, confirm, cancel = t("confirm.cancel") }) {
  return new Promise((resolve) => {
    const yes = el("button", { type: "button", class: "btn danger" }, confirm);
    const no = el("button", { type: "button", class: "btn ghost" }, cancel);
    const d = el("dialog", { class: "confirm", "aria-labelledby": "confirmTitle", "aria-describedby": "confirmText" },
      el("h2", { id: "confirmTitle", text: title }),
      el("p", { id: "confirmText", text }),
      el("div", { class: "confirm-actions" }, no, yes));
    // Every way out ends here once: the buttons, tapping outside the box, Escape, or the window closing.
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      if (d.open) d.close();
      d.remove();
      resolve(ok);
    };
    yes.addEventListener("click", () => finish(true));
    no.addEventListener("click", () => finish(false));
    d.addEventListener("click", (e) => { if (e.target === d) finish(false); }); // tap outside the box = cancel
    d.addEventListener("cancel", (e) => { e.preventDefault(); finish(false); }); // Escape = cancel
    d.addEventListener("close", () => finish(false));
    document.body.append(d);
    d.showModal();
    no.focus();
  });
}

export function confirmTap(btn, label, action) {
  if (btn.dataset.armed) { delete btn.dataset.armed; return action(); }
  btn.dataset.armed = "1";
  const orig = btn.textContent;
  btn.textContent = label;
  setTimeout(() => { if (btn.isConnected && btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = orig; } }, 3000);
}

// ---------- site contacts ----------
// Kampoeng Semanggi's Instagram (in every footer), and the sponsor contact on /cerita.
// An admin sets them under Admin → Situs; a contact without a number shows "coming soon" instead of buttons.
const siteSpots = { ig: document.querySelector(".site-ig"), sponsor: document.querySelector("#sponsorContact") };
let site = null;
function siteContact(box, label, phone, message, email = "") {
  if (!box) return;
  const name = label || "Kampoeng Semanggi";
  const mail = email ? el("a", { class: "btn ghost", href: "mailto:" + email + "?subject=" + encodeURIComponent(t("contact.emailSubject")), "aria-label": t("contact.emailLabel", { name }) }, icon("mail"), t("contact.email")) : null;
  const buttons = phone ? contactButtons({ stallName: name, phone }, message, { directions: false }) : el("div", { class: "reach" });
  if (mail) buttons.append(mail);
  box.replaceChildren(phone || email
    ? el("div", {}, label ? el("p", { class: "small" }, el("span", { class: "muted", text: t("site.contactPerson") + " " }), el("strong", { text: label })) : null,
        buttons, email ? el("p", { class: "small muted", text: email }) : null)
    : el("p", { class: "muted small", text: t("site.soon") }));
}
function renderSite() {
  if (!site) return;
  siteContact(siteSpots.sponsor, site.sponsorName, site.sponsorPhone, t("contact.waSponsor"), site.sponsorEmail);
  if (siteSpots.ig) {
    siteSpots.ig.hidden = !site.instagram;
    if (site.instagram) siteSpots.ig.replaceChildren(el("a", { href: instagramLink(site.instagram), target: "_blank", rel: "noopener" }, icon("instagram"), " @" + site.instagram));
  }
}
if (Object.values(siteSpots).some(Boolean)) {
  api("/api/site").then((r) => { site = r.site; renderSite(); }).catch(() => {});
  window.addEventListener("langchange", renderSite);
}
