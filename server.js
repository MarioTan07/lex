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

function tx(fn) {
  db.exec("BEGIN");
  try { const r = fn(); db.exec("COMMIT"); return r; }
  catch (e) { db.exec("ROLLBACK"); throw e; }
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

// ---------- first admin ----------
if (!db.prepare("SELECT 1 FROM users WHERE role = 'admin'").get()) {
  const email = process.env.ADMIN_EMAIL || "admin@kampungsemanggi.local";
  const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString("base64url");
  db.prepare("INSERT INTO users (email, password_hash, role, status, name, created_at) VALUES (?, ?, 'admin', 'approved', 'Admin', ?)")
    .run(email, hashPassword(password), Date.now());
  if (!process.env.ADMIN_PASSWORD) {
    const file = path.join(DATA_DIR, "initial-admin.txt");
    fs.writeFileSync(file, `Admin email: ${email}\nAdmin password: ${password}\nSign in at /admin and change this password.\n`);
    console.log(`Created the admin account. Its sign-in details are in ${file}`);
  } else {
    console.log(`Created the admin account ${email}.`);
  }
}

// ---------- messages ----------
// Error messages in Indonesian (default) and English. A var whose value is itself a key here
// (a field label or an order status) is translated too.
const MESSAGES = {
  id: {
    required: "{label} wajib diisi.",
    tooLong: "{label} maksimal {max} karakter.",
    "label.field": "Kolom ini",
    "label.email": "Email",
    "label.name": "Nama Anda",
    "label.stall": "Nama lapak",
    "label.whatsapp": "Nomor WhatsApp",
    "label.contact": "WhatsApp atau telepon",
    "label.address": "Alamat pengiriman",
    "label.product": "Nama produk",
    price: "Masukkan harga dalam Rupiah, misalnya 15000.",
    photoType: "Foto harus berupa gambar JPG, PNG, atau WebP.",
    photoSize: "Foto terlalu besar. Gunakan foto di bawah 1,5 MB.",
    signIn: "Silakan masuk terlebih dahulu.",
    forbidden: "Akun Anda tidak bisa melakukan itu.",
    throttle: "Terlalu banyak percobaan masuk. Tunggu 15 menit lalu coba lagi.",
    emailInvalid: "Masukkan alamat email yang valid.",
    passwordShort: "Gunakan kata sandi minimal 8 karakter.",
    emailTaken: "Sudah ada akun dengan email ini. Silakan masuk.",
    loginWrong: "Email dan kata sandi tidak cocok.",
    suspended: "Akun ini ditangguhkan. Hubungi admin Kampoeng Semanggi.",
    adminAccount: "Ini akun admin. Masuk di /admin.",
    sellerAccount: "Ini akun penjual. Masuk di /seller.",
    currentWrong: "Kata sandi Anda saat ini salah.",
    newShort: "Gunakan kata sandi baru minimal 8 karakter.",
    basketEmpty: "Keranjang Anda kosong.",
    qty: "Jumlah setiap barang harus antara 1 dan 99.",
    unavailable: "Ada barang di keranjang Anda yang sudah tidak tersedia. Hapus barang itu lalu coba lagi.",
    noOrderCode: "Tidak ada pesanan dengan kode itu.",
    alreadyAccepted: "Penjual sudah menerima pesanan ini. Hubungi penjual untuk mengubahnya.",
    notYourProduct: "Produk itu bukan milik lapak Anda.",
    maxProducts: "Satu lapak bisa memajang maksimal 200 produk.",
    notYourOrder: "Pesanan itu bukan untuk lapak Anda.",
    badTransition: "Pesanan berstatus {from} tidak bisa diubah menjadi {to}.",
    unknownSellerStatus: "Status penjual tidak dikenal.",
    noSeller: "Tidak ada penjual dengan id itu.",
    noProduct: "Tidak ada produk dengan id itu.",
    unknownOrderStatus: "Status pesanan tidak dikenal.",
    noOrder: "Tidak ada pesanan dengan id itu.",
    notFound: "Tidak ditemukan.",
    tooLarge: "Unggahan itu terlalu besar.",
    badRequest: "Permintaan tidak bisa dibaca. Coba lagi.",
    server: "Terjadi kesalahan di server. Coba lagi.",
    new: "baru", accepted: "diterima", ready: "siap", done: "selesai", declined: "ditolak", cancelled: "dibatalkan",
  },
  en: {
    required: "{label} is required.",
    tooLong: "{label} must be {max} characters or fewer.",
    "label.field": "This field",
    "label.email": "Email",
    "label.name": "Your name",
    "label.stall": "Stall name",
    "label.whatsapp": "WhatsApp number",
    "label.contact": "WhatsApp or phone",
    "label.address": "Delivery address",
    "label.product": "Product name",
    price: "Enter a price in Rupiah, for example 15000.",
    photoType: "The photo must be a JPG, PNG or WebP image.",
    photoSize: "The photo is too large. Use one under 1.5 MB.",
    signIn: "Please sign in.",
    forbidden: "Your account can't do that.",
    throttle: "Too many sign-in attempts. Wait 15 minutes and try again.",
    emailInvalid: "Enter a valid email address.",
    passwordShort: "Use a password of at least 8 characters.",
    emailTaken: "An account with this email already exists. Sign in instead.",
    loginWrong: "That email and password don't match.",
    suspended: "This account is suspended. Contact the Kampoeng Semanggi admin.",
    adminAccount: "This is an admin account. Sign in at /admin.",
    sellerAccount: "This is a seller account. Sign in at /seller.",
    currentWrong: "Your current password is wrong.",
    newShort: "Use a new password of at least 8 characters.",
    basketEmpty: "Your basket is empty.",
    qty: "Each quantity must be between 1 and 99.",
    unavailable: "Something in your basket is no longer available. Remove it and try again.",
    noOrderCode: "No order with that code.",
    alreadyAccepted: "The seller has already accepted this order. Contact them to change it.",
    notYourProduct: "That product isn't in your stall.",
    maxProducts: "A stall can list up to 200 products.",
    notYourOrder: "That order isn't for your stall.",
    badTransition: "An order that is {from} can't be changed to {to}.",
    unknownSellerStatus: "Unknown seller status.",
    noSeller: "No seller with that id.",
    noProduct: "No product with that id.",
    unknownOrderStatus: "Unknown order status.",
    noOrder: "No order with that id.",
    notFound: "Not found.",
    tooLarge: "That upload is too large.",
    badRequest: "The request couldn't be read. Try again.",
    server: "Something went wrong on the server. Try again.",
    new: "new", accepted: "accepted", ready: "ready", done: "completed", declined: "declined", cancelled: "cancelled",
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
function makeCode() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for (const b of crypto.randomBytes(8)) c += abc[b % abc.length];
  return c;
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
  return u && { id: u.id, email: u.email, role: u.role, status: u.status, name: u.name, stallName: u.stall_name, phone: u.phone };
}
function productOut(p) {
  return {
    id: p.id, sellerId: p.seller_id, stallName: p.stall_name, name: p.name, price: p.price, unit: p.unit,
    description: p.description, photo: p.photo, available: !!p.available, hidden: !!p.hidden, createdAt: p.created_at,
  };
}
const itemsFor = db.prepare("SELECT product_id AS productId, name, unit, price, qty FROM order_items WHERE order_id = ?");
function orderOut(o, { withContact = false } = {}) {
  const out = {
    id: o.id, code: o.code, sellerId: o.seller_id, stallName: o.stall_name, stallPhone: o.stall_phone,
    fulfil: o.fulfil, status: o.status, total: o.total, note: o.note, createdAt: o.created_at, updatedAt: o.updated_at,
    items: itemsFor.all(o.id),
  };
  if (withContact) Object.assign(out, { buyerName: o.buyer_name, contact: o.contact, address: o.address });
  else out.buyerName = o.buyer_name;
  return out;
}
const ORDER_SELECT = `SELECT o.*, u.stall_name, u.phone AS stall_phone FROM orders o JOIN users u ON u.id = o.seller_id`;
const STATUSES = ["new", "accepted", "ready", "done", "declined", "cancelled"];
const SELLER_NEXT = { new: ["accepted", "declined"], accepted: ["ready", "declined"], ready: ["done"] };

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
app.post("/api/auth/register", (req, res) => {
  const email = text(req.body.email, 120, { required: true, label: "label.email" }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad("emailInvalid");
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (password.length < 8) throw bad("passwordShort");
  const name = text(req.body.name, 60, { required: true, label: "label.name" });
  const stallName = text(req.body.stallName, 60, { required: true, label: "label.stall" });
  const phone = text(req.body.phone, 24, { required: true, label: "label.whatsapp" });
  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) throw bad("emailTaken");
  const r = db.prepare("INSERT INTO users (email, password_hash, role, status, name, stall_name, phone, created_at) VALUES (?, ?, 'seller', 'pending', ?, ?, ?, ?)")
    .run(email, hashPassword(password), name, stallName, phone, Date.now());
  createSession(res, Number(r.lastInsertRowid));
  res.status(201).json({ user: publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(r.lastInsertRowid)) });
});

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
  if (typeof next !== "string" || next.length < 8) throw bad("newShort");
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(next), req.user.id);
  db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").run(req.user.id, req.sessionHash);
  res.json({ ok: true });
});

// ----- public catalog & orders -----
app.get("/api/catalog", (_req, res) => {
  const rows = db.prepare(`
    SELECT p.*, u.stall_name FROM products p JOIN users u ON u.id = p.seller_id
    WHERE u.role = 'seller' AND u.status = 'approved' AND p.hidden = 0
    ORDER BY u.stall_name COLLATE NOCASE, p.created_at`).all();
  res.json({ products: rows.map(productOut) });
});

app.post("/api/orders", (req, res) => {
  const buyerName = text(req.body.buyerName, 60, { required: true, label: "label.name" });
  const contact = text(req.body.contact, 24, { required: true, label: "label.contact" });
  const fulfil = req.body.fulfil === "delivery" ? "delivery" : "pickup";
  const address = fulfil === "delivery" ? text(req.body.address, 300, { required: true, label: "label.address" }) : "";
  const note = text(req.body.note, 300);
  const items = Array.isArray(req.body.items) ? req.body.items.slice(0, 50) : [];
  if (!items.length) throw bad("basketEmpty");

  const getProduct = db.prepare(`SELECT p.* FROM products p JOIN users u ON u.id = p.seller_id
    WHERE p.id = ? AND p.hidden = 0 AND p.available = 1 AND u.status = 'approved' AND u.role = 'seller'`);
  const bySeller = new Map();
  for (const it of items) {
    const qty = Math.floor(Number(it.qty));
    if (!(qty >= 1 && qty <= 99)) throw bad("qty");
    const p = getProduct.get(Number(it.productId));
    if (!p) throw bad("unavailable");
    if (!bySeller.has(p.seller_id)) bySeller.set(p.seller_id, []);
    bySeller.get(p.seller_id).push({ p, qty });
  }

  const created = tx(() => {
    const out = [];
    const now = Date.now();
    for (const [sellerId, lines] of bySeller) {
      const total = lines.reduce((a, l) => a + l.p.price * l.qty, 0);
      let code; do { code = makeCode(); } while (db.prepare("SELECT 1 FROM orders WHERE code = ?").get(code));
      const r = db.prepare(`INSERT INTO orders (code, seller_id, buyer_name, contact, fulfil, address, note, status, total, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)`).run(code, sellerId, buyerName, contact, fulfil, address, note, total, now, now);
      const ins = db.prepare("INSERT INTO order_items (order_id, product_id, name, unit, price, qty) VALUES (?, ?, ?, ?, ?, ?)");
      for (const l of lines) ins.run(r.lastInsertRowid, l.p.id, l.p.name, l.p.unit, l.p.price, l.qty);
      out.push(code);
    }
    return out;
  });
  const orders = created.map((c) => orderOut(db.prepare(ORDER_SELECT + " WHERE o.code = ?").get(c)));
  res.status(201).json({ orders });
});

// Buyers track orders by their order codes (kept in their browser).
app.get("/api/orders", (req, res) => {
  const codes = String(req.query.codes || "").toUpperCase().split(",").map((s) => s.trim()).filter((s) => /^[A-Z0-9]{8}$/.test(s)).slice(0, 50);
  if (!codes.length) return res.json({ orders: [] });
  const rows = db.prepare(ORDER_SELECT + ` WHERE o.code IN (${codes.map(() => "?").join(",")}) ORDER BY o.created_at DESC`).all(...codes);
  res.json({ orders: rows.map((o) => orderOut(o)) });
});

app.post("/api/orders/:code/cancel", (req, res) => {
  const o = db.prepare("SELECT * FROM orders WHERE code = ?").get(String(req.params.code).toUpperCase());
  if (!o) throw new HttpError(404, "noOrderCode");
  if (o.status !== "new") throw bad("alreadyAccepted");
  db.prepare("UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ?").run(Date.now(), o.id);
  res.json({ ok: true });
});

// ----- seller -----
const seller = express.Router();
seller.use(requireRole("seller"));

seller.patch("/profile", (req, res) => {
  const stallName = text(req.body.stallName, 60, { required: true, label: "label.stall" });
  const phone = text(req.body.phone, 24, { required: true, label: "label.whatsapp" });
  const name = text(req.body.name, 60, { required: true, label: "label.name" });
  db.prepare("UPDATE users SET stall_name = ?, phone = ?, name = ? WHERE id = ?").run(stallName, phone, name, req.user.id);
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

seller.get("/orders", (req, res) => {
  const rows = db.prepare(ORDER_SELECT + " WHERE o.seller_id = ? ORDER BY o.created_at DESC LIMIT 300").all(req.user.id);
  res.json({ orders: rows.map((o) => orderOut(o, { withContact: true })) });
});

seller.patch("/orders/:id", (req, res) => {
  const o = db.prepare("SELECT * FROM orders WHERE id = ? AND seller_id = ?").get(Number(req.params.id), req.user.id);
  if (!o) throw new HttpError(404, "notYourOrder");
  const status = req.body.status;
  if (!(SELLER_NEXT[o.status] || []).includes(status)) throw bad("badTransition", { from: o.status, to: status });
  db.prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?").run(status, Date.now(), o.id);
  res.json({ ok: true });
});
app.use("/api/seller", seller);

// ----- admin -----
const admin = express.Router();
admin.use(requireRole("admin"));

admin.get("/overview", (_req, res) => {
  const count = (sql, ...a) => db.prepare(sql).get(...a).n;
  const dayAgo = Date.now() - 864e5;
  res.json({
    sellers: {
      approved: count("SELECT COUNT(*) AS n FROM users WHERE role = 'seller' AND status = 'approved'"),
      pending: count("SELECT COUNT(*) AS n FROM users WHERE role = 'seller' AND status = 'pending'"),
      suspended: count("SELECT COUNT(*) AS n FROM users WHERE role = 'seller' AND status = 'suspended'"),
    },
    products: count("SELECT COUNT(*) AS n FROM products"),
    ordersOpen: count("SELECT COUNT(*) AS n FROM orders WHERE status IN ('new', 'accepted', 'ready')"),
    ordersToday: count("SELECT COUNT(*) AS n FROM orders WHERE created_at > ?", dayAgo),
    salesDone: db.prepare("SELECT COALESCE(SUM(total), 0) AS n FROM orders WHERE status = 'done'").get().n,
  });
});

admin.get("/sellers", (_req, res) => {
  const rows = db.prepare(`SELECT u.*, (SELECT COUNT(*) FROM products p WHERE p.seller_id = u.id) AS products,
      (SELECT COUNT(*) FROM orders o WHERE o.seller_id = u.id) AS orders
    FROM users u WHERE u.role = 'seller' ORDER BY CASE u.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, u.created_at DESC`).all();
  res.json({ sellers: rows.map((u) => ({ ...publicUser(u), products: u.products, orders: u.orders, createdAt: u.created_at })) });
});

admin.patch("/sellers/:id", (req, res) => {
  const status = req.body.status;
  if (!["approved", "suspended", "pending"].includes(status)) throw bad("unknownSellerStatus");
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

admin.get("/orders", (req, res) => {
  const status = STATUSES.includes(req.query.status) ? req.query.status : null;
  const rows = status
    ? db.prepare(ORDER_SELECT + " WHERE o.status = ? ORDER BY o.created_at DESC LIMIT 500").all(status)
    : db.prepare(ORDER_SELECT + " ORDER BY o.created_at DESC LIMIT 500").all();
  res.json({ orders: rows.map((o) => orderOut(o, { withContact: true })) });
});

admin.patch("/orders/:id", (req, res) => {
  if (!STATUSES.includes(req.body.status)) throw bad("unknownOrderStatus");
  const r = db.prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?").run(req.body.status, Date.now(), Number(req.params.id));
  if (!r.changes) throw new HttpError(404, "noOrder");
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
