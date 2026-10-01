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

export const rp = (n) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n || 0));
export const when = (time) =>
  new Intl.DateTimeFormat(lang === "id" ? "id-ID" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(time));

export const STATUSES = ["new", "accepted", "ready", "done", "declined", "cancelled"];
export const statusLabel = (s) => (STATUSES.includes(s) ? t("status." + s) : s);

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

// Two-tap confirm for destructive buttons.
export function confirmTap(btn, label, action) {
  if (btn.dataset.armed) { delete btn.dataset.armed; return action(); }
  btn.dataset.armed = "1";
  const orig = btn.textContent;
  btn.textContent = label;
  setTimeout(() => { if (btn.isConnected && btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = orig; } }, 3000);
}
