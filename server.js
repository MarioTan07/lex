import express from "express";
import { DatabaseSync } from "node:sqlite";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const SESSION_DAYS = 30;
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- database ----------
const db = new DatabaseSync(path.join(DATA_DIR, "semanggi.db"));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('seller', 'admin')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'suspended')),
    name TEXT NOT NULL DEFAULT '',
    stall_name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    unit TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    photo TEXT NOT NULL DEFAULT '',
    available INTEGER NOT NULL DEFAULT 1,
    hidden INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  -- Orders from when the site took online orders. Buyers now call or WhatsApp the seller,
  -- so nothing writes to these tables any more; they're kept so old orders aren't lost.
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    seller_id INTEGER NOT NULL REFERENCES users(id),
    buyer_name TEXT NOT NULL,
    contact TEXT NOT NULL,
    fulfil TEXT NOT NULL CHECK (fulfil IN ('pickup', 'delivery')),
    address TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'new',
    total INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS order_items (
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER,
    name TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT '',
    price INTEGER NOT NULL,
    qty INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);
  CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
`);

// Columns added after the first release; add them to older databases.
{
  const have = new Set(db.prepare("PRAGMA table_info(users)").all().map((c) => c.name));
  const add = {
    shop_address: "TEXT NOT NULL DEFAULT ''", shop_lat: "REAL", shop_lng: "REAL",
    home_address: "TEXT NOT NULL DEFAULT ''", home_lat: "REAL", home_lng: "REAL",
    paused: "INTEGER NOT NULL DEFAULT 0", pause_note: "TEXT NOT NULL DEFAULT ''",
  };
  for (const [col, type] of Object.entries(add)) if (!have.has(col)) db.exec(`ALTER TABLE users ADD COLUMN ${col} ${type}`);
}
// Sellers used to sign themselves up and wait for approval. Admins now create sellers already
// approved, so any still waiting are suspended: hidden from buyers until an admin reactivates them.
{
  const r = db.prepare("UPDATE users SET status = 'suspended' WHERE role = 'seller' AND status = 'pending'").run();
  if (r.changes) console.log(`Moved ${r.changes} seller(s) still waiting for approval to suspended. Reactivate them under Sellers in /admin.`);
}

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

function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = Date.now() + SESSION_DAYS * 864e5;
  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(sha256(token), userId, expires);
  res.cookie("ks_session", token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 864e5, path: "/",
  });
}

// ---------- admin accounts ----------
// There are two admin accounts. Missing ones are created on start, from
// ADMIN_EMAIL/ADMIN_PASSWORD and ADMIN2_EMAIL/ADMIN2_PASSWORD, or with a
// generated password written to DATA_DIR/initial-admin.txt.
{
  const slots = [
    { email: process.env.ADMIN_EMAIL || "admin1@kampoengsemanggi.local", password: process.env.ADMIN_PASSWORD, name: "Admin 1" },
    { email: process.env.ADMIN2_EMAIL || "admin2@kampoengsemanggi.local", password: process.env.ADMIN2_PASSWORD, name: "Admin 2" },
  ];
  // The first release created admin@kampungsemanggi.local; move it to the Kampoeng spelling.
  const old = db.prepare("SELECT id FROM users WHERE email = 'admin@kampungsemanggi.local' AND role = 'admin'").get();
  if (old && !db.prepare("SELECT 1 FROM users WHERE email = ?").get(slots[0].email)) {
    db.prepare("UPDATE users SET email = ?, name = 'Admin 1' WHERE id = ?").run(slots[0].email, old.id);
    console.log(`Renamed the admin sign-in email admin@kampungsemanggi.local to ${slots[0].email}. The password is unchanged.`);
  }
  const existing = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n;
  const notes = [];
  for (const slot of slots.slice(existing)) {
    if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(slot.email)) continue;
    const password = slot.password || crypto.randomBytes(9).toString("base64url");
    db.prepare("INSERT INTO users (email, password_hash, role, status, name, created_at) VALUES (?, ?, 'admin', 'approved', ?, ?)")
      .run(slot.email, hashPassword(password), slot.name, Date.now());
    if (slot.password) console.log(`Created the admin account ${slot.email}.`);
    else notes.push(`${slot.name}\n  Email: ${slot.email}\n  Password: ${password}\n`);
  }
  if (notes.length) {
    const file = path.join(DATA_DIR, "initial-admin.txt");
    fs.appendFileSync(file, `\n${notes.join("\n")}Sign in at /admin and change these passwords under Account.\n`);
    console.log(`Created ${notes.length} admin account(s). Sign-in details are in ${file}`);
  }
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
    adminAccount: "Ini akun admin. Masuk di /admin.",
    sellerAccount: "Ini akun penjual. Masuk di /seller.",
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
    adminAccount: "This is an admin account. Sign in at /admin.",
    sellerAccount: "This is a seller account. Sign in at /seller.",
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
function savePhoto(dataUrl) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || "");
  if (!m) throw bad("photoType");
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > 1.5 * 1024 * 1024) throw bad("photoSize");
  const name = crypto.randomBytes(12).toString("hex") + "." + (m[1] === "jpeg" ? "jpg" : m[1]);
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return "/uploads/" + name;
}
function removePhoto(p) {
  if (!p || !p.startsWith("/uploads/")) return;
  fs.rm(path.join(UPLOAD_DIR, path.basename(p)), () => {});
}
function publicUser(u) {
  return u && {
    id: u.id, email: u.email, role: u.role, status: u.status, name: u.name, stallName: u.stall_name, phone: u.phone,
    shop: { address: u.shop_address || "", lat: u.shop_lat ?? null, lng: u.shop_lng ?? null },
    home: { address: u.home_address || "", lat: u.home_lat ?? null, lng: u.home_lng ?? null },
    paused: !!u.paused, pauseNote: u.pause_note || "",
  };
}
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
function sellerFields(body) {
  return {
    name: text(body.name, 60, { required: true, label: "label.sellerName" }),
    stall_name: text(body.stallName, 60, { required: true, label: "label.shopName" }),
    phone: text(body.phone, 24, { required: true, label: "label.contactNumber" }),
    ...Object.fromEntries(Object.entries(location(body.shop, "shop")).map(([k, v]) => ["shop_" + k, v])),
    ...Object.fromEntries(Object.entries(location(body.home, "home")).map(([k, v]) => ["home_" + k, v])),
  };
}
function updateUser(id, f) {
  const keys = Object.keys(f);
  db.prepare(`UPDATE users SET ${keys.map((k) => k + " = ?").join(", ")} WHERE id = ?`).run(...keys.map((k) => f[k]), id);
}
function productOut(p) {
  return {
    id: p.id, sellerId: p.seller_id, stallName: p.stall_name, name: p.name, price: p.price, unit: p.unit,
    description: p.description, photo: p.photo, available: !!p.available, hidden: !!p.hidden, createdAt: p.created_at,
  };
}
// ---------- app ----------
const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "3mb" }));

app.use((req, _res, next) => {
  const cookie = req.headers.cookie || "";
  const token = /(?:^|;\s*)ks_session=([a-f0-9]{64})/.exec(cookie)?.[1];
  if (token) {
    const row = db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`)
      .get(sha256(token), Date.now());
    if (row && row.status !== "suspended") { req.user = row; req.sessionHash = sha256(token); }
  }
  next();
});
const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new HttpError(401, "signIn"));
  if (!roles.includes(req.user.role)) return next(new HttpError(403, "forbidden"));
  next();
};

// Simple login throttle: 10 attempts per 15 minutes per IP.
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

app.post("/api/auth/login", (req, res) => {
  throttle(req);
  const email = text(req.body.email, 120).toLowerCase();
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const u = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!u || !checkPassword(password, u.password_hash)) throw new HttpError(401, "loginWrong");
  if (u.status === "suspended") throw new HttpError(403, "suspended");
  if (req.body.role && req.body.role !== u.role) throw new HttpError(403, u.role === "admin" ? "adminAccount" : "sellerAccount");
  attempts.delete(req.ip);
  createSession(res, u.id);
  res.json({ user: publicUser(u) });
});

app.post("/api/auth/logout", (req, res) => {
  if (req.sessionHash) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(req.sessionHash);
  res.clearCookie("ks_session", { path: "/" });
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => res.json({ user: publicUser(req.user) || null }));

app.post("/api/auth/password", requireRole("seller", "admin"), (req, res) => {
  const { current, next } = req.body;
  if (typeof current !== "string" || !checkPassword(current, req.user.password_hash)) throw bad("currentWrong");
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(newPassword(next)), req.user.id);
  db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").run(req.user.id, req.sessionHash);
  res.json({ ok: true });
});

// ----- public catalog -----
// Buyers order by calling or messaging the seller, so the public API only lists products and shops.
app.get("/api/catalog", (_req, res) => {
  const rows = db.prepare(`
    SELECT p.*, u.stall_name FROM products p JOIN users u ON u.id = p.seller_id
    WHERE u.role = 'seller' AND u.status = 'approved' AND p.hidden = 0
    ORDER BY u.stall_name COLLATE NOCASE, p.created_at`).all();
  res.json({ products: rows.map(productOut) });
});

// Shop name, shop location, contact number and open/paused state of every approved seller. Home addresses stay private.
app.get("/api/stalls", (_req, res) => {
  const rows = db.prepare("SELECT * FROM users WHERE role = 'seller' AND status = 'approved' ORDER BY stall_name COLLATE NOCASE").all();
  res.json({ stalls: rows.map((u) => {
    const p = publicUser(u);
    return { id: u.id, stallName: u.stall_name, phone: u.phone, shop: p.shop, paused: p.paused, pauseNote: p.pauseNote };
  }) });
});

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

seller.patch("/profile", (req, res) => {
  updateUser(req.user.id, sellerFields(req.body));
  res.json({ user: publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id)) });
});

// Temporarily close the shop (with a note for buyers, like "Closed for Lebaran, back 15 Oct") or reopen it.
seller.put("/pause", (req, res) => {
  const paused = !!req.body.paused;
  const note = paused ? text(req.body.note, 120, { required: true, label: "label.pauseNote" }) : "";
  db.prepare("UPDATE users SET paused = ?, pause_note = ? WHERE id = ?").run(paused ? 1 : 0, note, req.user.id);
  res.json({ user: publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id)) });
});

seller.get("/products", (req, res) => {
  const rows = db.prepare("SELECT p.*, u.stall_name FROM products p JOIN users u ON u.id = p.seller_id WHERE p.seller_id = ? ORDER BY p.created_at").all(req.user.id);
  res.json({ products: rows.map(productOut) });
});

function productFields(body, partial) {
  const f = {};
  if (!partial || body.name !== undefined) f.name = text(body.name, 60, { required: true, label: "label.product" });
  if (!partial || body.price !== undefined) f.price = money(body.price);
  if (!partial || body.unit !== undefined) f.unit = text(body.unit, 30);
  if (!partial || body.description !== undefined) f.description = text(body.description, 240);
  if (body.available !== undefined) f.available = body.available ? 1 : 0;
  return f;
}
const ownProduct = (req) => {
  const p = db.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").get(Number(req.params.id), req.user.id);
  if (!p) throw new HttpError(404, "notYourProduct");
  return p;
};

seller.post("/products", (req, res) => {
  const f = productFields(req.body, false);
  if (db.prepare("SELECT COUNT(*) AS n FROM products WHERE seller_id = ?").get(req.user.id).n >= 200) throw bad("maxProducts");
  const photo = req.body.photo ? savePhoto(req.body.photo) : "";
  const r = db.prepare("INSERT INTO products (seller_id, name, price, unit, description, photo, available, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)")
    .run(req.user.id, f.name, f.price, f.unit, f.description, photo, Date.now());
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

seller.patch("/products/:id", (req, res) => {
  const p = ownProduct(req);
  const f = productFields(req.body, true);
  if (req.body.photo) { f.photo = savePhoto(req.body.photo); removePhoto(p.photo); }
  const keys = Object.keys(f);
  if (keys.length) db.prepare(`UPDATE products SET ${keys.map((k) => k + " = ?").join(", ")} WHERE id = ?`).run(...keys.map((k) => f[k]), p.id);
  res.json({ ok: true });
});

seller.delete("/products/:id", (req, res) => {
  const p = ownProduct(req);
  db.prepare("DELETE FROM products WHERE id = ?").run(p.id);
  removePhoto(p.photo);
  res.json({ ok: true });
});

app.use("/api/seller", seller);

// ----- admin -----
const admin = express.Router();
admin.use(requireRole("admin"));

admin.get("/overview", (_req, res) => {
  const count = (sql) => db.prepare(sql).get().n;
  res.json({
    sellers: {
      approved: count("SELECT COUNT(*) AS n FROM users WHERE role = 'seller' AND status = 'approved'"),
      suspended: count("SELECT COUNT(*) AS n FROM users WHERE role = 'seller' AND status = 'suspended'"),
    },
    products: count("SELECT COUNT(*) AS n FROM products"),
  });
});

admin.get("/sellers", (_req, res) => {
  const rows = db.prepare(`SELECT u.*, (SELECT COUNT(*) FROM products p WHERE p.seller_id = u.id) AS products
    FROM users u WHERE u.role = 'seller' ORDER BY u.status = 'suspended', u.created_at DESC`).all();
  res.json({ sellers: rows.map((u) => ({ ...publicUser(u), products: u.products, createdAt: u.created_at })) });
});

admin.post("/sellers", (req, res) => {
  const email = text(req.body.email, 120, { required: true, label: "label.email" }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad("emailInvalid");
  const password = newPassword(req.body.password);
  const f = sellerFields(req.body);
  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) throw bad("emailTaken");
  const r = db.prepare("INSERT INTO users (email, password_hash, role, status, created_at) VALUES (?, ?, 'seller', 'approved', ?)")
    .run(email, hashPassword(password), Date.now());
  updateUser(Number(r.lastInsertRowid), f);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

const sellerById = (id) => {
  const u = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'seller'").get(Number(id));
  if (!u) throw new HttpError(404, "noSeller");
  return u;
};

admin.put("/sellers/:id", (req, res) => {
  const u = sellerById(req.params.id);
  updateUser(u.id, sellerFields(req.body));
  res.json({ ok: true });
});

admin.post("/sellers/:id/password", (req, res) => {
  const u = sellerById(req.params.id);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(newPassword(req.body.password)), u.id);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(u.id);
  res.json({ ok: true });
});

admin.patch("/sellers/:id", (req, res) => {
  const status = req.body.status;
  if (!["approved", "suspended"].includes(status)) throw bad("unknownSellerStatus");
  const r = db.prepare("UPDATE users SET status = ? WHERE id = ? AND role = 'seller'").run(status, Number(req.params.id));
  if (!r.changes) throw new HttpError(404, "noSeller");
  if (status === "suspended") db.prepare("DELETE FROM sessions WHERE user_id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

admin.get("/products", (_req, res) => {
  const rows = db.prepare("SELECT p.*, u.stall_name FROM products p JOIN users u ON u.id = p.seller_id ORDER BY p.created_at DESC").all();
  res.json({ products: rows.map(productOut) });
});

admin.patch("/products/:id", (req, res) => {
  const r = db.prepare("UPDATE products SET hidden = ? WHERE id = ?").run(req.body.hidden ? 1 : 0, Number(req.params.id));
  if (!r.changes) throw new HttpError(404, "noProduct");
  res.json({ ok: true });
});

admin.delete("/products/:id", (req, res) => {
  const p = db.prepare("SELECT * FROM products WHERE id = ?").get(Number(req.params.id));
  if (!p) throw new HttpError(404, "noProduct");
  db.prepare("DELETE FROM products WHERE id = ?").run(p.id);
  removePhoto(p.photo);
  res.json({ ok: true });
});

app.use("/api/admin", admin);

// ----- static files -----
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "30d", immutable: true }));
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

app.use("/api", (_req, _res, next) => next(new HttpError(404, "notFound")));
app.use((err, req, res, _next) => {
  const status = err.status || (err.type === "entity.too.large" ? 413 : 500);
  if (status >= 500) console.error(err);
  const key = err instanceof HttpError ? err.key : status === 413 ? "tooLarge" : status >= 500 ? "server" : "badRequest";
  res.status(status).json({ error: translate(requestLang(req), key, err.vars) });
});

app.listen(PORT, () => console.log(`Kampoeng Semanggi running at http://localhost:${PORT}`));
