// Shared helpers for the shop, seller desk and admin desk.
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

export const rp = (n) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n || 0));
export const when = (t) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(t));

export const STATUS = { new: "New", accepted: "Accepted", ready: "Ready", done: "Completed", declined: "Declined", cancelled: "Cancelled" };

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
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
    });
  } catch {
    throw new Error("Can't reach the server. Check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Something went wrong. Try again.");
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
export function mapFrame(loc, title = "Map") {
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
  if (/goo\.gl|maps\.app/i.test(s)) throw new Error("Short links can't be read. Open the link, then copy the full address from the browser's address bar, or right-click the place in Google Maps and copy its coordinates.");
  throw new Error("Paste a full Google Maps link or coordinates like -7.2431, 112.6345.");
}

// Address + map pin editor with a live map preview. `label` is e.g. "Shop" or "Home".
export function locationEditor(prefix, label, hint) {
  const addr = el("textarea", { id: prefix + "-addr", maxlength: "300", rows: "2", placeholder: "Street, RT/RW, kelurahan, kecamatan" });
  const pin = el("input", { type: "text", id: prefix + "-pin", placeholder: "Paste a Google Maps link or -7.2431, 112.6345" });
  const err = el("p", { class: "formerr", hidden: true });
  const box = el("div", { class: "mapbox" });
  let cur = { address: "", lat: null, lng: null };
  const draw = () => {
    const f = mapFrame(cur, label + " location");
    box.replaceChildren(f || el("p", { class: "muted small", text: "Add an address or a pin to see it on the map." }));
  };
  const readPin = () => {
    try { Object.assign(cur, parsePin(pin.value)); err.hidden = true; return true; }
    catch (e) { err.textContent = e.message; err.hidden = false; return false; }
  };
  let t;
  addr.addEventListener("input", () => { cur.address = addr.value.trim(); clearTimeout(t); t = setTimeout(draw, 700); });
  pin.addEventListener("change", () => { if (readPin()) draw(); });
  const here = el("button", { type: "button", class: "btn small ghost", onclick: () => {
    if (!navigator.geolocation) return toast("This browser can't share its location.");
    here.disabled = true; here.textContent = "Finding you…";
    navigator.geolocation.getCurrentPosition((p) => {
      cur.lat = +p.coords.latitude.toFixed(6); cur.lng = +p.coords.longitude.toFixed(6);
      pin.value = cur.lat + ", " + cur.lng; err.hidden = true; draw();
      here.disabled = false; here.textContent = "Use my current location";
    }, () => { toast("Couldn't get your location. Allow location access, or paste a Google Maps link."); here.disabled = false; here.textContent = "Use my current location"; },
    { enableHighAccuracy: true, timeout: 15000 });
  } }, "Use my current location");

  const node = el("fieldset", { class: "loc" },
    el("legend", { text: label + " location" }),
    hint ? el("p", { class: "muted small", text: hint }) : null,
    el("div", { class: "field" }, el("label", { for: addr.id, text: label + " address" }), addr),
    el("div", { class: "field" }, el("label", { for: pin.id, text: "Map pin" }), pin,
      el("span", { class: "hint", text: "In Google Maps, find the place, then copy the link from the address bar and paste it here." })),
    el("div", {}, here), err, box);
  draw();
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
