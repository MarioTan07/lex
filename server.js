import express from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { put, del, get } from "@vercel/blob";
import { Readable } from "node:stream";
import { connect, setupSchema, ROOT, DATA_DIR } from "./db.js";

const PORT = Number(process.env.PORT) || 3000;
const ON_VERCEL = !!process.env.VERCEL;
// Photos go to Vercel Blob when a Blob store is connected; otherwise to DATA_DIR/uploads.
// A connected store gives either BLOB_STORE_ID (Vercel signs in for us) or BLOB_READ_WRITE_TOKEN.
const USE_BLOB = !!(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const SESSION_DAYS = 30;

// ---------- passwords & sessions ----------
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return salt.toString("hex") + ":" + hash.toString("hex");
}
function checkPassword(pw, stored) {
  const [salt, hash] = stored.split(":");
  const test = crypto.scryptSync(pw, Buffer.from(salt, "hex"), 64);
  return crypto.timingSafeEqual(test, Buffer.from(hash, "hex"));
}
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

// ---------- database ----------
let db;

async function setup() {
  db = connect();
  await setupSchema(db);

  // Sellers used to sign themselves up and wait for approval. Admins now create sellers already
  // approved, so any still waiting are suspended: hidden from buyers until an admin reactivates them.
  const moved = await db.run("UPDATE users SET status = 'suspended' WHERE role = 'seller' AND status = 'pending'");
  if (moved.changes) console.log(`Moved ${moved.changes} seller(s) still waiting for approval to suspended. Reactivate them under Sellers in /pengelola.`);

  // There are two admin accounts. Missing ones are created from ADMIN_EMAIL/ADMIN_PASSWORD and
  // ADMIN2_EMAIL/ADMIN2_PASSWORD. On your own computer, a missing password is generated and
  // written to DATA_DIR/initial-admin.txt; on Vercel the passwords must be set.
  const slots = [
    { email: process.env.ADMIN_EMAIL || "admin1semanggi@gmail.com", password: process.env.ADMIN_PASSWORD, name: "Admin 1", placeholder: "admin1@kampoengsemanggi.local" },
    { email: process.env.ADMIN2_EMAIL || "admin2semanggi@gmail.com", password: process.env.ADMIN2_PASSWORD, name: "Admin 2", placeholder: "admin2@kampoengsemanggi.local" },
  ];
  // The first release created admin@kampungsemanggi.local; move it to the Kampoeng spelling.
  const old = await db.one("SELECT id FROM users WHERE email = 'admin@kampungsemanggi.local' AND role = 'admin'");
  if (old && !(await db.one("SELECT 1 AS x FROM users WHERE email = ?", slots[0].email))) {
    await db.run("UPDATE users SET email = ?, name = 'Admin 1' WHERE id = ?", slots[0].email, old.id);
    console.log(`Renamed the admin sign-in email admin@kampungsemanggi.local to ${slots[0].email}. The password is unchanged.`);
  }
  // Admins used to sign in with made-up addresses; move them to the real Gmail addresses (only the sign-in email changes).
  for (const slot of slots) {
    const was = await db.one("SELECT id FROM users WHERE email = ? AND role = 'admin'", slot.placeholder);
    if (was && slot.email !== slot.placeholder && !(await db.one("SELECT 1 AS x FROM users WHERE email = ?", slot.email))) {
      await db.run("UPDATE users SET email = ? WHERE id = ?", slot.email, was.id);
      console.log(`Renamed the admin sign-in email ${slot.placeholder} to ${slot.email}. The password is unchanged.`);
    }
  }
  const existing = (await db.one("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'")).n;
  const notes = [];
  for (const slot of slots.slice(existing)) {
    if (await db.one("SELECT 1 AS x FROM users WHERE email = ?", slot.email)) continue;
    if (!slot.password && ON_VERCEL) {
      console.error(`Admin account ${slot.name} is missing. Set ${slot === slots[0] ? "ADMIN_EMAIL and ADMIN_PASSWORD" : "ADMIN2_EMAIL and ADMIN2_PASSWORD"} in the Vercel project's environment variables and redeploy.`);
      continue;
    }
    const password = slot.password || crypto.randomBytes(9).toString("base64url");
    await db.run("INSERT INTO users (email, password_hash, role, status, name, created_at) VALUES (?, ?, 'admin', 'approved', ?, ?)",
      slot.email, hashPassword(password), slot.name, Date.now());
    if (slot.password) console.log(`Created the admin account ${slot.email}.`);
    else notes.push(`${slot.name}\n  Email: ${slot.email}\n  Password: ${password}\n`);
  }
  if (notes.length) {
    const file = path.join(DATA_DIR, "initial-admin.txt");
    fs.appendFileSync(file, `\n${notes.join("\n")}Sign in at /pengelola and change these passwords under Account.\n`);
    console.log(`Created ${notes.length} admin account(s). Sign-in details are in ${file}`);
  }

  // Sign-ins that have expired are no longer needed.
  await db.run("DELETE FROM sessions WHERE expires_at < ?", Date.now());
}

// If starting up fails (for example the database can't be reached for a moment), the next
// request tries again instead of this server copy failing until Vercel replaces it.
let ready = null;
function whenReady() {
  if (!ready) {
    ready = setup().catch((e) => {
      console.error("Startup failed:", e.message);
      ready = null;
      throw e;
    });
  }
  return ready;
}
whenReady().catch(() => {});

async function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = Date.now() + SESSION_DAYS * 864e5;
  await db.run("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)", sha256(token), userId, expires);
  res.cookie("ks_session", token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" || ON_VERCEL,
    maxAge: SESSION_DAYS * 864e5, path: "/",
  });
}

// ---------- messages ----------
// Error messages in Indonesian (default) and English. A var whose value is itself a key here
// (a field label or a place) is translated too.
const MESSAGES = {
  id: {
    required: "{label} wajib diisi.",
    tooLong: "{label} maksimal {max} karakter.",
    "label.field": "Kolom ini",
    "label.email": "Email",
    "label.sellerName": "Nama penjual",
    "label.shopName": "Nama lapak",
    "label.contactNumber": "Nomor kontak",
    "label.product": "Nama produk",
    "label.pauseNote": "Catatan untuk pembeli",
    "label.instagram": "Instagram",
    "label.sponsorName": "Nama kontak sponsor",
    "label.sponsorPhone": "Nomor sponsor",
    "label.homestayPhone": "Nomor homestay",
    "label.sponsorEmail": "Email sponsor",
    hoursInvalid: "Jam buka tidak valid. Isi jam buka dan tutup untuk setiap hari yang buka.",
    categoryInvalid: "Kategori tidak dikenal.",
    instagramInvalid: "Isi nama akun Instagram, misalnya @kampoengsemanggi, atau tautan profilnya.",
    "label.shopAddress": "Alamat lapak",
    "label.homeAddress": "Alamat rumah",
    "place.shop": "lapak",
    "place.home": "rumah",
    pinPair: "Isi lintang dan bujur untuk titik {place}, atau kosongkan keduanya.",
    pinInvalid: "Titik peta {place} bukan lokasi yang valid.",
    price: "Masukkan harga dalam Rupiah, misalnya 15000.",
    photoType: "Foto harus berupa gambar JPG, PNG, atau WebP.",
    photoSize: "Foto terlalu besar. Gunakan foto di bawah 1,5 MB.",
    signIn: "Silakan masuk terlebih dahulu.",
    forbidden: "Akun Anda tidak bisa melakukan itu.",
    throttle: "Terlalu banyak percobaan masuk. Tunggu 15 menit lalu coba lagi.",
    translateBusy: "Terlalu banyak catatan diterjemahkan. Coba lagi sebentar lagi.",
    translateFailed: "Catatan tidak bisa diterjemahkan sekarang.",
    emailInvalid: "Masukkan alamat email yang valid.",
    passwordShort: "Gunakan kata sandi minimal 8 karakter.",
    emailTaken: "Sudah ada akun dengan email ini.",
    loginWrong: "Email dan kata sandi tidak cocok.",
    suspended: "Akun ini ditangguhkan. Hubungi admin Kampoeng Semanggi.",
    adminAccount: "Ini akun admin. Masuk di /pengelola.",
    sellerAccount: "Ini akun penjual. Masuk di /penjual.",
    currentWrong: "Kata sandi Anda saat ini salah.",
    notYourProduct: "Produk itu bukan milik lapak Anda.",
    maxProducts: "Satu lapak bisa memajang maksimal 200 produk.",
    unknownSellerStatus: "Status penjual tidak dikenal.",
    noSeller: "Tidak ada penjual dengan id itu.",
    noProduct: "Tidak ada produk dengan id itu.",
    notFound: "Tidak ditemukan.",
    tooLarge: "Unggahan itu terlalu besar.",
    badRequest: "Permintaan tidak bisa dibaca. Coba lagi.",
    server: "Terjadi kesalahan di server. Coba lagi.",
    photoStorage: "Penyimpanan foto belum disiapkan. Hubungi admin.",
    photoUpload: "Foto tidak bisa diunggah sekarang. Coba lagi, atau simpan tanpa foto dulu.",
  },
  en: {
    required: "{label} is required.",
    tooLong: "{label} must be {max} characters or fewer.",
    "label.field": "This field",
    "label.email": "Email",
    "label.sellerName": "Seller name",
    "label.shopName": "Shop name",
    "label.contactNumber": "Contact number",
    "label.product": "Product name",
    "label.pauseNote": "Note for buyers",
    "label.instagram": "Instagram",
    "label.sponsorName": "Sponsor contact name",
    "label.sponsorPhone": "Sponsor number",
    "label.homestayPhone": "Homestay number",
    "label.sponsorEmail": "Sponsor email",
    hoursInvalid: "The opening hours aren't valid. Give an opening and closing time for each day the shop is open.",
    categoryInvalid: "Unknown category.",
    instagramInvalid: "Enter an Instagram username, like @kampoengsemanggi, or a link to the profile.",
    "label.shopAddress": "Shop address",
    "label.homeAddress": "Home address",
    "place.shop": "shop",
    "place.home": "home",
    pinPair: "Give both latitude and longitude for the {place} pin, or neither.",
    pinInvalid: "The {place} map pin isn't a valid location.",
    price: "Enter a price in Rupiah, for example 15000.",
    photoType: "The photo must be a JPG, PNG or WebP image.",
    photoSize: "The photo is too large. Use one under 1.5 MB.",
    signIn: "Please sign in.",
    forbidden: "Your account can't do that.",
    throttle: "Too many sign-in attempts. Wait 15 minutes and try again.",
    translateBusy: "Too many notes translated. Try again in a little while.",
    translateFailed: "The note couldn't be translated right now.",
    emailInvalid: "Enter a valid email address.",
    passwordShort: "Use a password of at least 8 characters.",
    emailTaken: "An account with this email already exists.",
    loginWrong: "That email and password don't match.",
    suspended: "This account is suspended. Contact the Kampoeng Semanggi admin.",
    adminAccount: "This is an admin account. Sign in at /pengelola.",
    sellerAccount: "This is a seller account. Sign in at /penjual.",
    currentWrong: "Your current password is wrong.",
    notYourProduct: "That product isn't in your shop.",
    maxProducts: "A shop can list up to 200 products.",
    unknownSellerStatus: "Unknown seller status.",
    noSeller: "No seller with that id.",
    noProduct: "No product with that id.",
    notFound: "Not found.",
    tooLarge: "That upload is too large.",
    badRequest: "The request couldn't be read. Try again.",
    server: "Something went wrong on the server. Try again.",
    photoStorage: "Photo storage isn't set up yet. Contact the admin.",
    photoUpload: "The photo couldn't be uploaded right now. Try again, or save without a photo for now.",
  },
};
function requestLang(req) {
  const asked = req.get("x-lang");
  if (asked in MESSAGES) return asked;
  return req.acceptsLanguages("id", "en") === "en" ? "en" : "id";
}
function translate(lang, key, vars = {}) {
  const m = MESSAGES[lang];
  return (m[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => {
    const v = String(vars[k] ?? "");
    return Object.hasOwn(m, v) ? m[v] : v;
  });
}

// ---------- helpers ----------
class HttpError extends Error {
  constructor(status, key, vars = {}) { super(key); this.status = status; this.key = key; this.vars = vars; }
}
const bad = (key, vars) => new HttpError(400, key, vars);

function text(v, max, { required = false, label = "label.field" } = {}) {
  const s = typeof v === "string" ? v.trim() : "";
  if (required && !s) throw bad("required", { label });
  if (s.length > max) throw bad("tooLong", { label, max });
  return s;
}
function money(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100_000_000) throw bad("price");
  return Math.round(n);
}
// Credentials for Vercel Blob. With a store connected by BLOB_STORE_ID, Vercel signs each request
// with a short-lived token in the x-vercel-oidc-token header; pass it along explicitly.
function blobAuth(req) {
  if (process.env.BLOB_READ_WRITE_TOKEN) return {};
  const oidcToken = req?.get("x-vercel-oidc-token") || process.env.VERCEL_OIDC_TOKEN;
  return oidcToken ? { oidcToken, storeId: process.env.BLOB_STORE_ID } : {};
}
// A public Blob store gives each photo its own public address. A private store doesn't, so private
// photos are served by this app at /photo/<name> (see the route below) and cached by Vercel's CDN.
// The store's type is found on the first upload: a public upload to a private store is refused.
let blobAccess = process.env.BLOB_ACCESS === "private" ? "private" : "public";
async function putBlobPhoto(name, buf, contentType, req) {
  const opts = { contentType, addRandomSuffix: false, ...blobAuth(req) };
  if (blobAccess === "public") {
    try {
      return (await put("products/" + name, buf, { ...opts, access: "public" })).url;
    } catch (e) {
      if (!/private store/i.test(e.message)) throw e;
      blobAccess = "private";
    }
  }
  await put("products/" + name, buf, { ...opts, access: "private" });
  return "/photo/" + name;
}
async function savePhoto(dataUrl, req) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || "");
  if (!m) throw bad("photoType");
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > 1.5 * 1024 * 1024) throw bad("photoSize");
  const name = crypto.randomBytes(12).toString("hex") + "." + (m[1] === "jpeg" ? "jpg" : m[1]);
  if (USE_BLOB) {
    try {
      return await putBlobPhoto(name, buf, "image/" + m[1], req);
    } catch (e) {
      console.error("Photo upload to Vercel Blob failed:", e.message);
      throw new HttpError(503, "photoUpload");
    }
  }
  if (ON_VERCEL) throw new HttpError(503, "photoStorage");
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return "/uploads/" + name;
}
function removePhoto(p, req) {
  if (!p) return;
  if (/^https:\/\/[^/]+\.blob\.vercel-storage\.com\//.test(p)) {
    if (USE_BLOB) del(p, blobAuth(req)).catch((e) => console.error("Couldn't delete photo", p, e.message));
    return;
  }
  if (p.startsWith("/photo/")) {
    if (USE_BLOB) del("products/" + path.basename(p), blobAuth(req)).catch((e) => console.error("Couldn't delete photo", p, e.message));
    return;
  }
  if (p.startsWith("/uploads/") && !ON_VERCEL) fs.rm(path.join(UPLOAD_DIR, path.basename(p)), () => {});
}
function publicUser(u) {
  return u && {
    id: u.id, email: u.email, role: u.role, status: u.status, name: u.name, stallName: u.stall_name, phone: u.phone,
    shop: { address: u.shop_address || "", lat: u.shop_lat ?? null, lng: u.shop_lng ?? null },
    home: { address: u.home_address || "", lat: u.home_lat ?? null, lng: u.home_lng ?? null },
    paused: !!u.paused, pauseNote: u.pause_note || "", instagram: u.instagram || "", fromHome: !!u.from_home, hours: hoursOut(u),
  };
}
// Accepts "@name", "name" or an instagram.com profile link, and keeps just the username.
function instagram(v) {
  let s = text(v, 120, { label: "label.instagram" });
  if (!s) return "";
  s = s.replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "");
  if (!/^[A-Za-z0-9._]{1,30}$/.test(s)) throw bad("instagramInvalid");
  return s;
}
// Opening hours per weekday, e.g. { mon: ["07:00", "15:00"], sun: null }. null = closed that day; no hours at all = not set.
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
function hours(v) {
  if (v == null || v === "") return "";
  if (typeof v !== "object") throw bad("hoursInvalid");
  const out = {};
  for (const d of DAYS) {
    const day = v[d];
    if (!day) { out[d] = null; continue; }
    const ok = Array.isArray(day) && day.length === 2 && day.every((x) => /^([01]\d|2[0-3]):[0-5]\d$/.test(x)) && day[0] !== day[1];
    if (!ok) throw bad("hoursInvalid");
    out[d] = [day[0], day[1]];
  }
  return DAYS.some((d) => out[d]) ? JSON.stringify(out) : "";
}
const hoursOut = (u) => { try { return u.hours ? JSON.parse(u.hours) : null; } catch { return null; } };
// A shop without a name goes by the seller's name.
const shopName = (u) => u.stall_name || u.name;
// A location is an address plus an optional map pin. `kind` is "shop" or "home".
function location(v, kind) {
  const o = v && typeof v === "object" ? v : {};
  const label = kind === "shop" ? "label.shopAddress" : "label.homeAddress";
  const address = text(o.address, 300, { label });
  const has = (x) => x !== null && x !== undefined && x !== "";
  if (has(o.lat) !== has(o.lng)) throw bad("pinPair", { place: "place." + kind });
  let lat = null, lng = null;
  if (has(o.lat)) {
    lat = Number(o.lat); lng = Number(o.lng);
    if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) throw bad("pinInvalid", { place: "place." + kind });
  }
  return { address, lat, lng };
}
// The shop name, shop location and Instagram are optional. Sellers who also (or only) sell from home tick
// "from home": buyers are told the seller sends the home address on WhatsApp, and the address itself stays private.
function sellerFields(body) {
  return {
    name: text(body.name, 60, { required: true, label: "label.sellerName" }),
    stall_name: text(body.stallName, 60, { label: "label.shopName" }),
    phone: text(body.phone, 24, { required: true, label: "label.contactNumber" }),
    instagram: instagram(body.instagram),
    from_home: body.fromHome ? 1 : 0,
    // The admin form doesn't edit hours, so they only change when sent.
    ...(body.hours !== undefined ? { hours: hours(body.hours) } : {}),
    ...Object.fromEntries(Object.entries(location(body.shop, "shop")).map(([k, v]) => ["shop_" + k, v])),
    ...Object.fromEntries(Object.entries(location(body.home, "home")).map(([k, v]) => ["home_" + k, v])),
  };
}
function updateUser(id, f) {
  const keys = Object.keys(f);
  return db.run(`UPDATE users SET ${keys.map((k) => k + " = ?").join(", ")} WHERE id = ?`, ...keys.map((k) => f[k]), id);
}
const userById = (id) => db.one("SELECT * FROM users WHERE id = ?", id);
function productOut(p) {
  return {
    id: p.id, sellerId: p.seller_id, stallName: p.stall_name, name: p.name, price: p.price, unit: p.unit, category: p.category || "",
    description: p.description, photo: p.photo, available: !!p.available, hidden: !!p.hidden, createdAt: p.created_at,
  };
}
// ---------- app ----------
const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "3mb" }));

// Wait for the database to be ready before handling anything.
app.use(async (_req, _res, next) => { await whenReady(); next(); });

app.use(async (req, _res, next) => {
  const cookie = req.headers.cookie || "";
  const token = /(?:^|;\s*)ks_session=([a-f0-9]{64})/.exec(cookie)?.[1];
  if (token) {
    const row = await db.one(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`,
      sha256(token), Date.now());
    if (row && row.status !== "suspended") { req.user = row; req.sessionHash = sha256(token); }
  }
  next();
});
const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new HttpError(401, "signIn"));
  if (!roles.includes(req.user.role)) return next(new HttpError(403, "forbidden"));
  next();
};

// Simple login throttle: 10 attempts per 15 minutes per IP (per server instance).
const attempts = new Map();
function throttle(req) {
  const now = Date.now(), key = req.ip;
  const a = attempts.get(key);
  if (!a || a.reset < now) { attempts.set(key, { n: 1, reset: now + 15 * 6e4 }); return; }
  if (++a.n > 10) throw new HttpError(429, "throttle");
}

// ----- auth -----
// Seller accounts are created by an admin (POST /api/admin/sellers); there is no public sign-up.
function newPassword(v) {
  if (typeof v !== "string" || v.length < 8) throw bad("passwordShort");
  return v;
}

app.post("/api/auth/login", async (req, res) => {
  throttle(req);
  const email = text(req.body.email, 120).toLowerCase();
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const u = await db.one("SELECT * FROM users WHERE email = ?", email);
  if (!u || !checkPassword(password, u.password_hash)) throw new HttpError(401, "loginWrong");
  if (u.status === "suspended") throw new HttpError(403, "suspended");
  if (req.body.role && req.body.role !== u.role) throw new HttpError(403, u.role === "admin" ? "adminAccount" : "sellerAccount");
  attempts.delete(req.ip);
  await createSession(res, u.id);
  res.json({ user: publicUser(u) });
});

app.post("/api/auth/logout", async (req, res) => {
  if (req.sessionHash) await db.run("DELETE FROM sessions WHERE token_hash = ?", req.sessionHash);
  res.clearCookie("ks_session", { path: "/" });
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => res.json({ user: publicUser(req.user) || null }));

app.post("/api/auth/password", requireRole("seller", "admin"), async (req, res) => {
  const { current, next } = req.body;
  if (typeof current !== "string" || !checkPassword(current, req.user.password_hash)) throw bad("currentWrong");
  await db.run("UPDATE users SET password_hash = ? WHERE id = ?", hashPassword(newPassword(next)), req.user.id);
  await db.run("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?", req.user.id, req.sessionHash);
  res.json({ ok: true });
});

// ----- public catalog -----
// Buyers order by calling or messaging the seller, so the public API only lists products and shops.
app.get("/api/catalog", async (_req, res) => {
  const rows = await db.all(`
    SELECT p.*, COALESCE(NULLIF(u.stall_name, ''), u.name) AS stall_name FROM products p JOIN users u ON u.id = p.seller_id
    WHERE u.role = 'seller' AND u.status = 'approved' AND p.hidden = 0
    ORDER BY 2 COLLATE NOCASE, p.created_at`);
  res.json({ products: rows.map(productOut), hot: await hotProducts() });
});

// ----- lagi hits (trending) -----
// The catalog counts a visitor's interest in a product once a day: opening it, calling, messaging, ordering or sharing.
// Only the daily count is stored. The products with the most interest over the last 7 days are "lagi hits".
const wibDay = (t = Date.now()) => new Date(t).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
const seenTaps = new Map(); // "ip|product|day" → 1, so refreshing or tapping twice counts once
const tapUse = new Map();   // at most 120 counted taps per IP per hour
app.post("/api/tap", async (req, res) => {
  const id = Number(req.body.productId);
  if (!Number.isInteger(id) || id <= 0) return res.json({ ok: true });
  const day = wibDay(), key = `${req.ip}|${id}|${day}`;
  if (seenTaps.has(key)) return res.json({ ok: true });
  const now = Date.now(), use = tapUse.get(req.ip);
  if (!use || use.reset < now) tapUse.set(req.ip, { n: 1, reset: now + 36e5 });
  else if (++use.n > 120) return res.json({ ok: true });
  if (seenTaps.size > 50_000) seenTaps.clear();
  seenTaps.set(key, 1);
  if (await db.one("SELECT 1 AS x FROM products WHERE id = ? AND hidden = 0", id)) {
    await db.run("INSERT INTO product_taps (product_id, day, n) VALUES (?, ?, 1) ON CONFLICT(product_id, day) DO UPDATE SET n = n + 1", id, day);
  }
  res.json({ ok: true });
});
// Up to 4 product ids, most interest first; a product needs at least 3 visitors in the week to count.
async function hotProducts() {
  const since = wibDay(Date.now() - 6 * 864e5);
  const rows = await db.all(`SELECT t.product_id AS id, SUM(t.n) AS n FROM product_taps t
    JOIN products p ON p.id = t.product_id JOIN users u ON u.id = p.seller_id
    WHERE t.day >= ? AND p.hidden = 0 AND p.available = 1 AND u.status = 'approved'
    GROUP BY t.product_id HAVING SUM(t.n) >= 3 ORDER BY n DESC LIMIT 4`, since);
  return rows.map((r) => r.id);
}

// Shop name, shop location, contact number and open/paused state of every approved seller. Home addresses stay private.
app.get("/api/stalls", async (_req, res) => {
  const rows = await db.all("SELECT * FROM users WHERE role = 'seller' AND status = 'approved' ORDER BY COALESCE(NULLIF(stall_name, ''), name) COLLATE NOCASE");
  res.json({ stalls: rows.map((u) => {
    const p = publicUser(u);
    return { id: u.id, stallName: shopName(u), phone: u.phone, shop: p.shop, fromHome: p.fromHome, instagram: p.instagram, hours: p.hours, paused: p.paused, pauseNote: p.pauseNote };
  }) });
});

// ----- site settings -----
// Contact details shown on the site. Numbers stay empty until an admin fills them in under Admin → Situs.
const SETTING_DEFAULTS = { instagram: "kampoeng_semanggi", sponsorEmail: "admin1semanggi@gmail.com" };
const SETTINGS = {
  instagram: (v) => instagram(v),
  sponsorName: (v) => text(v, 60, { label: "label.sponsorName" }),
  sponsorPhone: (v) => text(v, 24, { label: "label.sponsorPhone" }),
  sponsorEmail: (v) => {
    const e = text(v, 120, { label: "label.sponsorEmail" });
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw bad("emailInvalid");
    return e;
  },
  homestayPhone: (v) => text(v, 24, { label: "label.homestayPhone" }),
};
async function readSettings() {
  const rows = await db.all("SELECT key, value FROM settings");
  const saved = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return Object.fromEntries(Object.keys(SETTINGS).map((k) => [k, k in saved ? saved[k] : SETTING_DEFAULTS[k] || ""]));
}
app.get("/api/site", async (_req, res) => res.json({ site: await readSettings() }));

// Buyers writing in English can add a note to their WhatsApp order; it's translated to Indonesian for the seller,
// and back to English so the buyer can check the meaning survived.
// Uses the free MyMemory service (no account). Set TRANSLATE_EMAIL to raise its daily limit from 5,000 to 50,000 characters.
const translations = new Map(); // small cache so the same note isn't translated twice
const translateUse = new Map();  // 30 notes per hour per IP
app.post("/api/translate", async (req, res) => {
  const note = text(req.body.text, 200, { required: true, label: "label.field" });
  const from = req.body.from, to = req.body.to;
  if (!(from === "en" && to === "id") && !(from === "id" && to === "en")) return res.json({ text: note });
  const cacheKey = from + to + "|" + note;
  if (translations.has(cacheKey)) return res.json({ text: translations.get(cacheKey) });
  const now = Date.now(), use = translateUse.get(req.ip);
  if (!use || use.reset < now) translateUse.set(req.ip, { n: 1, reset: now + 36e5 });
  else if (++use.n > 30) throw new HttpError(429, "translateBusy");
  const url = new URL("https://api.mymemory.translated.net/get");
  url.searchParams.set("q", note);
  url.searchParams.set("langpair", from + "|" + to);
  if (process.env.TRANSLATE_EMAIL) url.searchParams.set("de", process.env.TRANSLATE_EMAIL);
  let out;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await r.json();
    out = data.responseStatus == 200 && !data.quotaFinished ? String(data.responseData?.translatedText || "").trim() : "";
  } catch { out = ""; }
  // The free service sometimes hands the text back untranslated; treat that as a failure too.
  if (!out || out.toLowerCase() === note.toLowerCase()) throw new HttpError(502, "translateFailed");
  if (translations.size > 500) translations.clear();
  translations.set(cacheKey, out);
  res.json({ text: out });
});

// ----- seller -----
const seller = express.Router();
seller.use(requireRole("seller"));

seller.patch("/profile", async (req, res) => {
  await updateUser(req.user.id, sellerFields(req.body));
  res.json({ user: publicUser(await userById(req.user.id)) });
});

// Temporarily close the shop (with a note for buyers, like "Closed for Lebaran, back 15 Oct") or reopen it.
seller.put("/pause", async (req, res) => {
  const paused = !!req.body.paused;
  const note = paused ? text(req.body.note, 120, { required: true, label: "label.pauseNote" }) : "";
  await db.run("UPDATE users SET paused = ?, pause_note = ? WHERE id = ?", paused ? 1 : 0, note, req.user.id);
  res.json({ user: publicUser(await userById(req.user.id)) });
});

seller.get("/products", async (req, res) => {
  const rows = await db.all("SELECT p.*, u.stall_name FROM products p JOIN users u ON u.id = p.seller_id WHERE p.seller_id = ? ORDER BY p.created_at", req.user.id);
  res.json({ products: rows.map(productOut) });
});

// Fixed list so the catalog filter stays tidy; "" = not chosen.
const CATEGORIES = ["", "pecel", "camilan", "minuman", "oleh-oleh", "lainnya"];
function productFields(body, partial) {
  const f = {};
  if (!partial || body.name !== undefined) f.name = text(body.name, 60, { required: true, label: "label.product" });
  if (!partial || body.price !== undefined) f.price = money(body.price);
  if (!partial || body.unit !== undefined) f.unit = text(body.unit, 30);
  if (!partial || body.description !== undefined) f.description = text(body.description, 240);
  if (!partial || body.category !== undefined) {
    f.category = typeof body.category === "string" ? body.category : "";
    if (!CATEGORIES.includes(f.category)) throw bad("categoryInvalid");
  }
  if (body.available !== undefined) f.available = body.available ? 1 : 0;
  return f;
}
async function ownProduct(req) {
  const p = await db.one("SELECT * FROM products WHERE id = ? AND seller_id = ?", Number(req.params.id), req.user.id);
  if (!p) throw new HttpError(404, "notYourProduct");
  return p;
}

seller.post("/products", async (req, res) => {
  const f = productFields(req.body, false);
  if ((await db.one("SELECT COUNT(*) AS n FROM products WHERE seller_id = ?", req.user.id)).n >= 200) throw bad("maxProducts");
  const photo = req.body.photo ? await savePhoto(req.body.photo, req) : "";
  const r = await db.run("INSERT INTO products (seller_id, name, price, unit, description, category, photo, available, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)",
    req.user.id, f.name, f.price, f.unit, f.description, f.category, photo, Date.now());
  res.status(201).json({ id: r.id });
});

seller.patch("/products/:id", async (req, res) => {
  const p = await ownProduct(req);
  const f = productFields(req.body, true);
  if (req.body.photo) { f.photo = await savePhoto(req.body.photo, req); removePhoto(p.photo, req); }
  const keys = Object.keys(f);
  if (keys.length) await db.run(`UPDATE products SET ${keys.map((k) => k + " = ?").join(", ")} WHERE id = ?`, ...keys.map((k) => f[k]), p.id);
  res.json({ ok: true });
});

seller.delete("/products/:id", async (req, res) => {
  const p = await ownProduct(req);
  await db.batch([["DELETE FROM product_taps WHERE product_id = ?", p.id], ["DELETE FROM products WHERE id = ?", p.id]]);
  removePhoto(p.photo, req);
  res.json({ ok: true });
});

app.use("/api/seller", seller);

// ----- admin -----
const admin = express.Router();
admin.use(requireRole("admin"));

admin.get("/overview", async (_req, res) => {
  const count = async (sql) => (await db.one(sql)).n;
  res.json({
    sellers: {
      approved: await count("SELECT COUNT(*) AS n FROM users WHERE role = 'seller' AND status = 'approved'"),
      suspended: await count("SELECT COUNT(*) AS n FROM users WHERE role = 'seller' AND status = 'suspended'"),
    },
    products: await count("SELECT COUNT(*) AS n FROM products"),
  });
});

admin.put("/site", async (req, res) => {
  const values = Object.entries(SETTINGS).map(([k, check]) => [k, check(req.body[k])]);
  await db.batch(values.map(([k, v]) => ["INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", k, v]));
  res.json({ site: await readSettings() });
});

admin.get("/sellers", async (_req, res) => {
  const rows = await db.all(`SELECT u.*, (SELECT COUNT(*) FROM products p WHERE p.seller_id = u.id) AS products
    FROM users u WHERE u.role = 'seller' ORDER BY u.status = 'suspended', u.created_at DESC`);
  res.json({ sellers: rows.map((u) => ({ ...publicUser(u), products: u.products, createdAt: u.created_at })) });
});

admin.post("/sellers", async (req, res) => {
  const email = text(req.body.email, 120, { required: true, label: "label.email" }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad("emailInvalid");
  const password = newPassword(req.body.password);
  const f = sellerFields(req.body);
  if (await db.one("SELECT 1 AS x FROM users WHERE email = ?", email)) throw bad("emailTaken");
  const r = await db.run("INSERT INTO users (email, password_hash, role, status, created_at) VALUES (?, ?, 'seller', 'approved', ?)",
    email, hashPassword(password), Date.now());
  await updateUser(r.id, f);
  res.status(201).json({ id: r.id });
});

async function sellerById(id) {
  const u = await db.one("SELECT * FROM users WHERE id = ? AND role = 'seller'", Number(id));
  if (!u) throw new HttpError(404, "noSeller");
  return u;
}

admin.put("/sellers/:id", async (req, res) => {
  const u = await sellerById(req.params.id);
  await updateUser(u.id, sellerFields(req.body));
  res.json({ ok: true });
});

admin.post("/sellers/:id/password", async (req, res) => {
  const u = await sellerById(req.params.id);
  await db.run("UPDATE users SET password_hash = ? WHERE id = ?", hashPassword(newPassword(req.body.password)), u.id);
  await db.run("DELETE FROM sessions WHERE user_id = ?", u.id);
  res.json({ ok: true });
});

admin.patch("/sellers/:id", async (req, res) => {
  const status = req.body.status;
  if (!["approved", "suspended"].includes(status)) throw bad("unknownSellerStatus");
  const r = await db.run("UPDATE users SET status = ? WHERE id = ? AND role = 'seller'", status, Number(req.params.id));
  if (!r.changes) throw new HttpError(404, "noSeller");
  if (status === "suspended") await db.run("DELETE FROM sessions WHERE user_id = ?", Number(req.params.id));
  res.json({ ok: true });
});

// Permanently delete a shop: the seller's account, sign-ins, products, photos and any old orders.
admin.delete("/sellers/:id", async (req, res) => {
  const u = await sellerById(req.params.id);
  const photos = (await db.all("SELECT photo FROM products WHERE seller_id = ? AND photo != ''", u.id)).map((p) => p.photo);
  await db.batch([
    ["DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE seller_id = ?)", u.id],
    ["DELETE FROM orders WHERE seller_id = ?", u.id],
    ["DELETE FROM sessions WHERE user_id = ?", u.id],
    ["DELETE FROM product_taps WHERE product_id IN (SELECT id FROM products WHERE seller_id = ?)", u.id],
    ["DELETE FROM products WHERE seller_id = ?", u.id],
    ["DELETE FROM users WHERE id = ?", u.id],
  ]);
  photos.forEach((p) => removePhoto(p, req));
  res.json({ ok: true });
});

admin.get("/products", async (_req, res) => {
  const rows = await db.all("SELECT p.*, COALESCE(NULLIF(u.stall_name, ''), u.name) AS stall_name FROM products p JOIN users u ON u.id = p.seller_id ORDER BY p.created_at DESC");
  res.json({ products: rows.map(productOut) });
});

admin.patch("/products/:id", async (req, res) => {
  const r = await db.run("UPDATE products SET hidden = ? WHERE id = ?", req.body.hidden ? 1 : 0, Number(req.params.id));
  if (!r.changes) throw new HttpError(404, "noProduct");
  res.json({ ok: true });
});

admin.delete("/products/:id", async (req, res) => {
  const p = await db.one("SELECT * FROM products WHERE id = ?", Number(req.params.id));
  if (!p) throw new HttpError(404, "noProduct");
  await db.batch([["DELETE FROM product_taps WHERE product_id = ?", p.id], ["DELETE FROM products WHERE id = ?", p.id]]);
  removePhoto(p.photo, req);
  res.json({ ok: true });
});

app.use("/api/admin", admin);

// ----- static files -----
// On Vercel, files in public/ are served directly and never reach this app, except the home
// page "/", which Vercel routes here. Reading it via import.meta.url makes Vercel bundle the file.
let homePage = null;
try { homePage = fs.readFileSync(new URL("./public/index.html", import.meta.url), "utf8"); } catch {}
app.get("/", (_req, res, next) => (homePage ? res.type("html").send(homePage) : next()));
// Product photos kept in a private Blob store. Names are random and never reused, so they can be cached for good.
app.get("/photo/:name", async (req, res, next) => {
  if (!USE_BLOB || !/^[a-f0-9]{24}\.(jpg|png|webp)$/.test(req.params.name)) return next();
  const r = await get("products/" + req.params.name, { access: "private", ...blobAuth(req) }).catch((e) => {
    console.error("Couldn't read photo", req.params.name, e.message);
    return null;
  });
  if (!r || r.statusCode !== 200) return next();
  res.set({ "Content-Type": r.blob.contentType, "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable" });
  Readable.fromWeb(r.stream).pipe(res);
});

// The seller and admin pages moved to Indonesian addresses; old links still work.
app.get(["/seller", "/seller.html"], (_req, res) => res.redirect(302, "/penjual"));
app.get(["/admin", "/admin.html"], (_req, res) => res.redirect(302, "/pengelola"));
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "30d", immutable: true }));
app.use(express.static(path.join(ROOT, "public"), { extensions: ["html"] }));

app.use("/api", (_req, _res, next) => next(new HttpError(404, "notFound")));
app.use((err, req, res, _next) => {
  const status = err.status || (err.type === "entity.too.large" ? 413 : 500);
  if (status >= 500) console.error(err);
  const key = err instanceof HttpError ? err.key : status === 413 ? "tooLarge" : status >= 500 ? "server" : "badRequest";
  res.status(status).json({ error: translate(requestLang(req), key, err.vars) });
});

export default app;

if (!ON_VERCEL) app.listen(PORT, () => console.log(`Kampoeng Semanggi running at http://localhost:${PORT}`));
