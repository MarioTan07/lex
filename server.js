import express from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { put, del, get } from "@vercel/blob";
import { Readable } from "node:stream";
import { connect, setupSchema, ROOT, DATA_DIR } from "./db.js";
import ABOUT_SEED from "./content-seed.js";
import { COUNTRIES, PROVINCES } from "./public/places.js";

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
  await seedAbout();

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

  // Sign-ins that have expired, and rate-limit counters that ran out a day ago, are no longer needed.
  await db.run("DELETE FROM sessions WHERE expires_at < ?", Date.now());
  await db.run("DELETE FROM rate_limits WHERE reset_at < ?", Date.now() - 864e5);
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
    "label.shopName": "Nama toko",
    "label.contactNumber": "Nomor kontak",
    "label.product": "Nama produk",
    "label.unit": "Dijual per",
    "label.pauseNote": "Catatan untuk pembeli",
    "label.instagram": "Instagram",
    "label.sponsorName": "Nama kontak sponsor",
    "label.sponsorPhone": "Nomor sponsor",
    "label.homestayPhone": "Nomor homestay",
    "label.tourPhone": "Nomor tur",
    "label.listingName": "Nama",
    "label.aboutName": "Nama",
    "label.aboutText": "Teks",
    "label.years": "Tahun",
    "label.caption": "Keterangan foto",
    "label.aboutIntro": "Teks pembuka",
    noAboutItem: "Kelompok atau mitra itu tidak ada.",
    tooManyAboutPhotos: "Maksimal {max} foto.",
    "label.description": "Deskripsi",
    "label.includes": "Termasuk",
    "label.location": "Lokasi",
    listingKind: "Pilih tur, pengalaman, atau homestay.",
    listingStatus: "Status tidak dikenal.",
    listingNumber: "{label} harus berupa angka yang wajar, atau dikosongkan.",
    listingGroup: "Jumlah orang minimal tidak boleh lebih besar dari maksimal.",
    listingDates: "Tanggal tur tidak valid. Gunakan tanggal dan jam, maksimal 30 tanggal.",
    noListing: "Tur atau homestay itu tidak ada.",
    "label.price": "Harga",
    "label.duration": "Lama tur",
    "label.groupMin": "Jumlah orang minimal",
    "label.groupMax": "Jumlah orang maksimal",
    "label.noticeDays": "Pesan paling lambat",
    "label.sponsorEmail": "Email sponsor",
    tooManyPhotos: "Satu tur, pengalaman, atau homestay bisa punya maksimal 10 foto.",
    noPhoto: "Foto itu tidak ditemukan.",
    orderAhead: "Pilih berapa lama sebelumnya pembeli harus memesan.",
    bigOrder: "Untuk pesanan besar, isi jumlah 2 sampai 10000 buah dan pilih waktu yang lebih lama dari pesanan biasa.",
    deliveryInvalid: "Pilihan pengiriman tidak valid. Muat ulang halaman lalu coba lagi.",
    deliveryCountries: "Pilih minimal satu negara tujuan pengiriman.",
    deliveryRegions: "Pilih minimal satu provinsi di Indonesia yang Anda layani.",
    hoursInvalid: "Jam buka tidak valid. Isi jam buka dan tutup untuk setiap hari yang buka.",
    categoryInvalid: "Kategori tidak dikenal.",
    instagramInvalid: "Isi nama akun Instagram, misalnya @kampoengsemanggi, atau tautan profilnya.",
    "label.shopAddress": "Alamat toko",
    "label.homeAddress": "Alamat rumah",
    "place.shop": "toko",
    "place.home": "rumah",
    pinPair: "Isi lintang dan bujur untuk titik {place}, atau kosongkan keduanya.",
    pinInvalid: "Titik peta {place} bukan lokasi yang valid.",
    price: "Masukkan harga dalam Rupiah, misalnya 15000.",
    pieces: "Isi harus berupa angka bulat dari 1 sampai 100000, atau dikosongkan.",
    sizes: "Satu produk bisa punya 1 sampai 5 ukuran. Setiap ukuran perlu nama kemasan dan harga.",
    sizeOut: "Minimal satu ukuran harus masih dijual. Kalau semua habis, tandai produknya habis.",
    photoType: "Foto harus berupa gambar JPG, PNG, atau WebP.",
    photoSize: "Foto terlalu besar. Gunakan foto di bawah 1,5 MB.",
    signIn: "Silakan masuk terlebih dahulu.",
    forbidden: "Akun Anda tidak bisa melakukan itu.",
    throttle: "Terlalu banyak percobaan masuk. Tunggu 15 menit lalu coba lagi.",
    translateBusy: "Terlalu banyak catatan diterjemahkan. Coba lagi sebentar lagi.",
    translateFailed: "Catatan tidak bisa diterjemahkan sekarang.",
    emailInvalid: "Masukkan alamat email yang valid.",
    passwordShort: "Gunakan kata sandi minimal 8 karakter.",
    passwordShortAdmin: "Kata sandi admin minimal 12 karakter.",
    passwordLong: "Kata sandi maksimal 200 karakter.",
    tooMany: "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.",
    emailTaken: "Sudah ada akun dengan email ini.",
    loginWrong: "Nomor HP/email dan kata sandi tidak cocok.",
    phoneInvalid: "Masukkan nomor HP yang valid, misalnya 0812 3456 7890.",
    phoneTaken: "Sudah ada akun dengan nomor HP ini.",
    profileIncomplete: "Lengkapi data toko Anda dulu.",
    "label.loginPhone": "Nomor HP",
    "label.posterCaption": "Keterangan poster",
    maxPosters: "Satu toko bisa memasang maksimal 10 poster. Hapus yang lama dulu.",
    posterImage: "Pilih gambar untuk poster.",
    noPoster: "Poster itu tidak ditemukan.",
    resetUnavailable: "Reset lewat WhatsApp belum aktif. Hubungi admin Kampoeng Semanggi untuk mengatur ulang kata sandi.",
    resetSendFailed: "Kode tidak bisa dikirim ke WhatsApp sekarang. Coba lagi sebentar lagi, atau hubungi admin.",
    resetTooSoon: "Kode baru saja dikirim. Tunggu satu menit sebelum meminta lagi.",
    resetTooMany: "Terlalu banyak permintaan kode. Coba lagi dalam satu jam, atau hubungi admin.",
    resetCodeWrong: "Kode salah atau sudah kedaluwarsa. Periksa lagi, atau minta kode baru.",
    resetMessage: "Kode reset kata sandi Kampoeng Semanggi Anda: {code}\nBerlaku 10 menit. Jangan berikan kode ini kepada siapa pun, termasuk yang mengaku admin.",
    suspended: "Akun ini ditangguhkan. Hubungi admin Kampoeng Semanggi.",
    adminAccount: "Ini akun admin. Masuk di /pengelola.",
    sellerAccount: "Ini akun penjual. Masuk di /penjual.",
    currentWrong: "Kata sandi Anda saat ini salah.",
    notYourProduct: "Produk itu bukan milik toko Anda.",
    maxProducts: "Satu toko bisa memajang maksimal 200 produk.",
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
    "label.unit": "Sold per",
    "label.pauseNote": "Note for buyers",
    "label.instagram": "Instagram",
    "label.sponsorName": "Sponsor contact name",
    "label.sponsorPhone": "Sponsor number",
    "label.homestayPhone": "Homestay number",
    "label.tourPhone": "Tour number",
    "label.listingName": "Name",
    "label.aboutName": "Name",
    "label.aboutText": "Text",
    "label.years": "Years",
    "label.caption": "Photo caption",
    "label.aboutIntro": "Intro text",
    noAboutItem: "That group or partner doesn't exist.",
    tooManyAboutPhotos: "At most {max} photos.",
    "label.description": "Description",
    "label.includes": "Included",
    "label.location": "Location",
    listingKind: "Choose tour, experience or homestay.",
    listingStatus: "Unknown status.",
    listingNumber: "{label} must be a sensible number, or left empty.",
    listingGroup: "The minimum group size can't be larger than the maximum.",
    listingDates: "The tour dates aren't valid. Use a date and time, up to 30 dates.",
    noListing: "That tour or homestay doesn't exist.",
    "label.price": "Price",
    "label.duration": "Tour length",
    "label.groupMin": "Minimum group size",
    "label.groupMax": "Maximum group size",
    "label.noticeDays": "Book at least",
    "label.sponsorEmail": "Sponsor email",
    tooManyPhotos: "A tour, experience or homestay can have at most 10 photos.",
    noPhoto: "That photo wasn't found.",
    orderAhead: "Choose how long ahead buyers must order.",
    bigOrder: "For big orders, enter 2 to 10000 pieces and choose a longer time than for normal orders.",
    deliveryInvalid: "That delivery choice isn't valid. Reload the page and try again.",
    deliveryCountries: "Choose at least one country you deliver to.",
    deliveryRegions: "Choose at least one Indonesian province you deliver to.",
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
    pieces: "Pieces must be a whole number from 1 to 100000, or left empty.",
    sizes: "A product can have 1 to 5 sizes. Each size needs a packaging name and a price.",
    sizeOut: "At least one size must still be on sale. If they're all gone, mark the product sold out.",
    photoType: "The photo must be a JPG, PNG or WebP image.",
    photoSize: "The photo is too large. Use one under 1.5 MB.",
    signIn: "Please sign in.",
    forbidden: "Your account can't do that.",
    throttle: "Too many sign-in attempts. Wait 15 minutes and try again.",
    translateBusy: "Too many notes translated. Try again in a little while.",
    translateFailed: "The note couldn't be translated right now.",
    emailInvalid: "Enter a valid email address.",
    passwordShort: "Use a password of at least 8 characters.",
    passwordShortAdmin: "Admin passwords need at least 12 characters.",
    passwordLong: "Passwords can be at most 200 characters.",
    tooMany: "Too many attempts. Wait a little and try again.",
    emailTaken: "An account with this email already exists.",
    loginWrong: "That phone number or email and password don't match.",
    phoneInvalid: "Enter a valid phone number, for example 0812 3456 7890.",
    phoneTaken: "An account with this phone number already exists.",
    profileIncomplete: "Complete your shop details first.",
    "label.loginPhone": "Phone number",
    "label.posterCaption": "Poster caption",
    maxPosters: "A shop can show up to 10 posters. Remove an old one first.",
    posterImage: "Choose an image for the poster.",
    noPoster: "That poster wasn't found.",
    resetUnavailable: "Resetting by WhatsApp isn't switched on yet. Contact the Kampoeng Semanggi admin to reset your password.",
    resetSendFailed: "The code couldn't be sent to WhatsApp right now. Try again in a little while, or contact the admin.",
    resetTooSoon: "A code was just sent. Wait a minute before asking again.",
    resetTooMany: "Too many code requests. Try again in an hour, or contact the admin.",
    resetCodeWrong: "That code is wrong or has expired. Check it, or ask for a new one.",
    resetMessage: "Your Kampoeng Semanggi password reset code: {code}\nValid for 10 minutes. Never share this code with anyone, even someone who says they're the admin.",
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
  // The site's other languages get messages in English.
  if (asked) return "en";
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
// Ids in addresses are whole numbers; anything else ("abc") is simply not found, rather than a database error.
const wholeId = (_req, _res, next, v) => next(/^\d{1,15}$/.test(v) ? undefined : new HttpError(404, "notFound"));

function text(v, max, { required = false, label = "label.field" } = {}) {
  const s = typeof v === "string" ? v.trim() : "";
  if (required && !s) throw bad("required", { label });
  if (s.length > max) throw bad("tooLong", { label, max });
  return s;
}
function money(v) {
  // An empty price is missing, not Rp 0.
  const n = v === null || v === undefined || String(v).trim() === "" ? NaN : Number(v);
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
  // Check the file itself, not just its label: JPG starts FF D8 FF, PNG 89 "PNG", WebP "RIFF"…"WEBP".
  const real = m[1] === "jpeg" ? buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
    : m[1] === "png" ? buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    : buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP";
  if (!real) throw bad("photoType");
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
// Sellers sign in with a phone number; admins (and sellers made before phone sign-in) with an email.
// A phone number is kept in one form, digits starting with 62, so "0812-3456-7890", "+62 812 3456 7890"
// and "6281234567890" are the same account. It's stored in the email column, which holds the sign-in name.
function phoneKey(v) {
  const d = String(v || "").replace(/\D/g, "");
  const k = d.startsWith("62") ? d : d.startsWith("0") ? "62" + d.slice(1) : d.startsWith("8") ? "62" + d : d;
  return /^62\d{8,13}$/.test(k) ? k : null;
}
const loginKey = (v) => { const s = String(v || "").trim(); return s.includes("@") ? s.toLowerCase() : phoneKey(s); };
const isPhoneKey = (k) => /^62\d{8,13}$/.test(k || "");

function publicUser(u) {
  return u && {
    // loginPhone: the phone number a seller signs in with, written the local way (0812…); null for email sign-ins.
    loginPhone: isPhoneKey(u.email) ? "0" + u.email.slice(2) : null,
    profileDone: u.role !== "seller" || !!u.profile_done,
    id: u.id, email: u.email, role: u.role, status: u.status, name: u.name, stallName: u.stall_name, phone: u.phone,
    shop: { address: u.shop_address || "", lat: u.shop_lat ?? null, lng: u.shop_lng ?? null },
    home: { address: u.home_address || "", lat: u.home_lat ?? null, lng: u.home_lng ?? null },
    paused: !!u.paused, pauseNote: u.pause_note || "", instagram: u.instagram || "", fromHome: !!u.from_home, hours: hoursOut(u),
    orderAhead: u.order_ahead || 0,
    bigOrder: u.big_items ? { items: u.big_items, ahead: u.big_ahead } : null,
    delivery: deliveryOut(u),
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
// How long before pickup buyers must order, in minutes (0 = any time): 1 to 12 hours, days, weeks or
// months (30 days), as chosen on the seller page.
const AHEAD_UNITS = [60, 1440, 10080, 43200];
const aheadOk = (n) => Number.isInteger(n) && AHEAD_UNITS.some((u) => n % u === 0 && n / u >= 1 && n / u <= 12);
function orderAhead(v) {
  const n = Number(v || 0);
  if (n !== 0 && !aheadOk(n)) throw bad("orderAhead");
  return n;
}
// Big orders, or null: from `items` pieces in one order, buyers must order `ahead` minutes ahead,
// which must be longer than the notice for normal orders.
function bigOrder(v, normal) {
  if (!v) return { big_items: 0, big_ahead: 0 };
  const items = Number(v.items), ahead = Number(v.ahead);
  if (!Number.isInteger(items) || items < 2 || items > 10000 || !aheadOk(ahead) || ahead <= normal) throw bad("bigOrder");
  return { big_items: items, big_ahead: ahead };
}
// Pickup only, or delivery to chosen countries (and Indonesian provinces when Indonesia is one of them).
const COUNTRY_SET = new Set(COUNTRIES), PROVINCE_SET = new Set(PROVINCES);
function delivery(v) {
  if (!v) return "";
  if (typeof v !== "object") throw bad("deliveryInvalid");
  if (v.mode === "pickup") return JSON.stringify({ mode: "pickup" });
  if (v.mode !== "delivery" || !Array.isArray(v.countries) || (v.regions != null && !Array.isArray(v.regions))) throw bad("deliveryInvalid");
  const countries = [...new Set(v.countries)];
  if (!countries.every((c) => COUNTRY_SET.has(c))) throw bad("deliveryInvalid");
  if (!countries.length) throw bad("deliveryCountries");
  let regions = [];
  if (countries.includes("ID")) {
    regions = [...new Set(v.regions || [])];
    if (!regions.every((r) => PROVINCE_SET.has(r))) throw bad("deliveryInvalid");
    if (!regions.length) throw bad("deliveryRegions");
    regions = PROVINCES.filter((p) => regions.includes(p));
  }
  // Indonesia first, then in code order; the pages sort the names in the reader's language.
  countries.sort((a, b) => (a === "ID" ? -1 : b === "ID" ? 1 : a.localeCompare(b)));
  return JSON.stringify({ mode: "delivery", countries, regions });
}
const deliveryOut = (u) => { try { return u.delivery ? JSON.parse(u.delivery) : null; } catch { return null; } };
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
    // The admin form doesn't edit hours, order-ahead time or delivery, so they only change when sent.
    ...(body.hours !== undefined ? { hours: hours(body.hours) } : {}),
    ...(body.orderAhead !== undefined ? { order_ahead: orderAhead(body.orderAhead) } : {}),
    ...(body.bigOrder !== undefined ? bigOrder(body.bigOrder, body.orderAhead !== undefined ? orderAhead(body.orderAhead) : 0) : {}),
    ...(body.delivery !== undefined ? { delivery: delivery(body.delivery) } : {}),
    ...Object.fromEntries(Object.entries(location(body.shop, "shop")).map(([k, v]) => ["shop_" + k, v])),
    ...Object.fromEntries(Object.entries(location(body.home, "home")).map(([k, v]) => ["home_" + k, v])),
  };
}
function updateUser(id, f) {
  const keys = Object.keys(f);
  return db.run(`UPDATE users SET ${keys.map((k) => k + " = ?").join(", ")} WHERE id = ?`, ...keys.map((k) => f[k]), id);
}
const userById = (id) => db.one("SELECT * FROM users WHERE id = ?", id);
// Products have one photo. Extra photos from before that change are no longer shown, but are still
// deleted from storage together with their product.
const extraPhotos = (p) => { try { return p.extra_photos ? JSON.parse(p.extra_photos) : []; } catch { return []; } };
// Every packaging a product comes in; a product with one packaging gives a list of one.
function sizesOf(p) {
  try { const list = p.sizes ? JSON.parse(p.sizes) : null; if (Array.isArray(list) && list.length) return list; } catch {}
  return [{ unit: p.unit, price: p.price, pieces: p.pieces ?? null, out: false }];
}
function productOut(p) {
  return {
    sizes: sizesOf(p),
    photos: [p.photo].filter(Boolean),
    id: p.id, sellerId: p.seller_id, stallName: p.stall_name, name: p.name, price: p.price, unit: p.unit, pieces: p.pieces ?? null, category: p.category || "",
    description: p.description, photo: p.photo, available: !!p.available, hidden: !!p.hidden, createdAt: p.created_at,
  };
}
// ---------- app ----------
const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

// The visitor's address. On Vercel it comes from Vercel's own header (visitors can't fake it);
// on your own computer, from the connection itself.
const clientIp = (req) => (ON_VERCEL && (req.get("x-vercel-forwarded-for") || req.get("x-real-ip"))) || req.socket.remoteAddress || "unknown";

// Security headers. On Vercel they're set for every file in vercel.json; here they cover running locally.
const SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com", "img-src 'self' data: blob: https://*.blob.vercel-storage.com",
    "frame-src https://www.google.com https://maps.google.com", "connect-src 'self'",
    "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
  ].join("; "),
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)",
  "Cross-Origin-Opener-Policy": "same-origin",
};
if (!ON_VERCEL) app.use((_req, res, next) => { res.set(SECURITY_HEADERS); next(); });

app.use("/api", (req, res, next) => {
  // Answers can hold private details (who's signed in, shop data); browsers and proxies shouldn't keep them.
  res.set("Cache-Control", "no-store");
  // Changes may only come from this site's own pages: refuse requests another website makes a visitor's browser send.
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    if (origin && origin !== `${req.protocol}://${req.get("host")}`) return next(new HttpError(403, "forbidden"));
  }
  next();
});
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

// Rate limits, counted in the database: allow `max` attempts per `windowMs` for a key (like "login-ip:1.2.3.4").
// Returns false once the limit is used up. Atomic, so parallel requests can't slip past it.
async function allow(key, max, windowMs) {
  const now = Date.now();
  const r = await db.one(`INSERT INTO rate_limits (key, n, reset_at) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET n = CASE WHEN reset_at <= ? THEN 1 ELSE n + 1 END,
      reset_at = CASE WHEN reset_at <= ? THEN ? ELSE reset_at END
    RETURNING n`, key, now + windowMs, now, now, now + windowMs);
  return r.n <= max;
}
async function limit(key, max, windowMs, message = "tooMany") {
  if (!(await allow(key, max, windowMs))) throw new HttpError(429, message);
}
const MIN = 6e4, HOUR = 36e5;
// Checking a password against this when the account doesn't exist takes as long as a real check,
// so response times don't reveal which emails or phone numbers have accounts.
const DUMMY_HASH = hashPassword(crypto.randomBytes(16).toString("hex"));

// ----- auth -----
// Seller accounts are created by an admin (POST /api/admin/sellers); there is no public sign-up.
function newPassword(v, { admin = false } = {}) {
  if (typeof v !== "string" || v.length < 8) throw bad("passwordShort");
  if (v.length > 200) throw bad("passwordLong");
  if (admin && v.length < 12) throw bad("passwordShortAdmin");
  return v;
}

app.post("/api/auth/login", async (req, res) => {
  // The form field is still called "email" but takes a phone number or an email.
  const key = loginKey(text(req.body.email, 120));
  const ip = clientIp(req);
  // 20 tries per address and 10 per account every 15 minutes; the second stops slow guessing from many addresses.
  await limit("login-ip:" + ip, 20, 15 * MIN, "throttle");
  if (key) await limit("login-acct:" + key, 10, 15 * MIN, "throttle");
  const password = typeof req.body.password === "string" && req.body.password.length <= 200 ? req.body.password : "";
  const u = key ? await db.one("SELECT * FROM users WHERE email = ?", key) : null;
  const ok = checkPassword(password, u ? u.password_hash : DUMMY_HASH) && !!u;
  if (!ok) throw new HttpError(401, "loginWrong");
  if (u.status === "suspended") throw new HttpError(403, "suspended");
  if (req.body.role && req.body.role !== u.role) throw new HttpError(403, u.role === "admin" ? "adminAccount" : "sellerAccount");
  await db.run("DELETE FROM rate_limits WHERE key IN (?, ?)", "login-ip:" + ip, "login-acct:" + key);
  await createSession(res, u.id);
  res.json({ user: publicUser(u) });
});

// ----- forgotten password: a code on WhatsApp -----
// A seller enters their phone number and gets a 6-digit code on WhatsApp, sent through Fonnte
// (an Indonesian WhatsApp gateway; set FONNTE_TOKEN). The code lasts 10 minutes and allows 5 tries;
// a number gets at most one code a minute and three an hour. Whether a number is registered is never revealed.
const RESET_MINUTES = 10, RESET_TRIES = 5;
async function sendWhatsApp(target, message) {
  const r = await fetch(process.env.FONNTE_URL || "https://api.fonnte.com/send", { // FONNTE_URL: only for testing
    method: "POST",
    headers: { Authorization: process.env.FONNTE_TOKEN },
    body: new URLSearchParams({ target, message, countryCode: "62" }),
    signal: AbortSignal.timeout(10000),
  }).catch((e) => ({ ok: false, error: e }));
  const data = r.json ? await r.json().catch(() => ({})) : {};
  if (!r.ok || data.status === false) {
    console.error("WhatsApp code not sent (Fonnte):", r.status || "", data.reason || data.detail || r.error?.message || "");
    throw new HttpError(502, "resetSendFailed");
  }
}
// The seller an entered number belongs to: their sign-in number, or for older email sign-ins their contact number.
async function sellerByPhone(typed) {
  const key = phoneKey(typed);
  if (!key) return null;
  const byLogin = await db.one("SELECT * FROM users WHERE role = 'seller' AND email = ?", key);
  if (byLogin) return { u: byLogin, key };
  const sellers = await db.all("SELECT * FROM users WHERE role = 'seller' AND email LIKE '%@%' AND phone != ''");
  const u = sellers.find((s) => phoneKey(s.phone) === key);
  return u ? { u, key } : null;
}
const resetHash = (id, code) => sha256(`${id}:${code}`);

app.post("/api/auth/reset/start", async (req, res) => {
  if (!process.env.FONNTE_TOKEN) throw new HttpError(503, "resetUnavailable");
  await limit("reset-start-ip:" + clientIp(req), 10, HOUR, "resetTooMany");
  const typed = text(req.body.phone, 24, { required: true, label: "label.loginPhone" });
  if (!phoneKey(typed)) throw bad("phoneInvalid");
  const found = await sellerByPhone(typed);
  if (found && found.u.status !== "suspended") {
    const now = Date.now();
    const recent = await db.all("SELECT created_at FROM password_resets WHERE user_id = ? AND created_at > ?", found.u.id, now - 36e5);
    if (recent.some((r) => r.created_at > now - 6e4)) throw new HttpError(429, "resetTooSoon");
    if (recent.length >= 3) throw new HttpError(429, "resetTooMany");
    const code = String(crypto.randomInt(0, 1e6)).padStart(6, "0");
    await sendWhatsApp(found.key, translate("id", "resetMessage", { code }));
    await db.run("DELETE FROM password_resets WHERE user_id = ? AND created_at <= ?", found.u.id, now - 36e5);
    await db.run("INSERT INTO password_resets (user_id, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?)",
      found.u.id, resetHash(found.u.id, code), now + RESET_MINUTES * 6e4, now);
  }
  res.json({ ok: true });
});

app.post("/api/auth/reset/finish", async (req, res) => {
  await limit("reset-finish-ip:" + clientIp(req), 30, HOUR);
  const found = await sellerByPhone(text(req.body.phone, 24));
  const code = String(req.body.code || "").replace(/\D/g, "");
  const password = newPassword(req.body.password);
  const row = found && await db.one("SELECT * FROM password_resets WHERE user_id = ? AND expires_at > ? ORDER BY created_at DESC LIMIT 1", found.u.id, Date.now());
  if (!row || row.attempts >= RESET_TRIES) throw bad("resetCodeWrong");
  if (code.length !== 6 || resetHash(found.u.id, code) !== row.code_hash) {
    await db.run("UPDATE password_resets SET attempts = attempts + 1 WHERE id = ?", row.id);
    throw bad("resetCodeWrong");
  }
  if (found.u.status === "suspended") throw new HttpError(403, "suspended");
  await db.run("UPDATE users SET password_hash = ? WHERE id = ?", hashPassword(password), found.u.id);
  await db.run("DELETE FROM sessions WHERE user_id = ?", found.u.id);
  await db.run("DELETE FROM password_resets WHERE user_id = ?", found.u.id);
  await createSession(res, found.u.id);
  res.json({ user: publicUser(await userById(found.u.id)) });
});

app.post("/api/auth/logout", async (req, res) => {
  if (req.sessionHash) await db.run("DELETE FROM sessions WHERE token_hash = ?", req.sessionHash);
  res.clearCookie("ks_session", { path: "/" });
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => res.json({ user: publicUser(req.user) || null }));

app.post("/api/auth/password", requireRole("seller", "admin"), async (req, res) => {
  const { current, next } = req.body;
  await limit("pw:" + req.user.id, 10, 15 * MIN);
  if (typeof current !== "string" || current.length > 200 || !checkPassword(current, req.user.password_hash)) throw bad("currentWrong");
  await db.run("UPDATE users SET password_hash = ? WHERE id = ?", hashPassword(newPassword(next, { admin: req.user.role === "admin" })), req.user.id);
  await db.run("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?", req.user.id, req.sessionHash);
  res.json({ ok: true });
});

// ----- public catalog -----
// Buyers order by calling or messaging the seller, so the public API only lists products and shops.
app.get("/api/catalog", async (_req, res) => {
  const rows = await db.all(`
    SELECT p.*, COALESCE(NULLIF(u.stall_name, ''), u.name) AS stall_name FROM products p JOIN users u ON u.id = p.seller_id
    WHERE u.role = 'seller' AND u.status = 'approved' AND u.profile_done = 1 AND p.hidden = 0
    ORDER BY 2 COLLATE NOCASE, p.created_at`);
  res.json({ products: rows.map(productOut), hot: await hotProducts() });
});

// ----- lagi hits (trending) -----
// The catalog counts a visitor's interest in a product once a day: opening it, calling, messaging, ordering or sharing.
// Only the daily count is stored. The products with the most interest over the last 7 days are "lagi hits".
const wibDay = (t = Date.now()) => new Date(t).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
const seenTaps = new Map(); // "ip|product|day" → 1, so refreshing or tapping twice counts once
// `kind` (view, call, whatsapp, order, share) also goes into the seller's statistics, once per visitor, product, kind and day.
const TAP_KINDS = ["view", "call", "whatsapp", "order", "share"];
app.post("/api/tap", async (req, res) => {
  const id = Number(req.body.productId);
  const kind = TAP_KINDS.includes(req.body.kind) ? req.body.kind : "view";
  if (!Number.isInteger(id) || id <= 0) return res.json({ ok: true });
  const ip = clientIp(req);
  const day = wibDay(), key = `${ip}|${id}|${day}`, kindKey = key + "|" + kind;
  const newVisitor = !seenTaps.has(key), newKind = !seenTaps.has(kindKey);
  if (!newVisitor && !newKind) return res.json({ ok: true });
  if (!(await allow("tap:" + ip, 120, HOUR))) return res.json({ ok: true });
  if (seenTaps.size > 50_000) seenTaps.clear();
  seenTaps.set(key, 1); seenTaps.set(kindKey, 1);
  if (await db.one("SELECT 1 AS x FROM products WHERE id = ? AND hidden = 0", id)) {
    const writes = [["INSERT INTO product_events (product_id, day, kind, n) VALUES (?, ?, ?, 1) ON CONFLICT(product_id, day, kind) DO UPDATE SET n = n + 1", id, day, kind]];
    if (newVisitor) writes.push(["INSERT INTO product_taps (product_id, day, n) VALUES (?, ?, 1) ON CONFLICT(product_id, day) DO UPDATE SET n = n + 1", id, day]);
    await db.batch(writes);
  }
  res.json({ ok: true });
});
// Up to 4 product ids, most interest first; a product needs at least 3 visitors in the week to count.
async function hotProducts() {
  const since = wibDay(Date.now() - 6 * 864e5);
  const rows = await db.all(`SELECT t.product_id AS id, SUM(t.n) AS n FROM product_taps t
    JOIN products p ON p.id = t.product_id JOIN users u ON u.id = p.seller_id
    WHERE t.day >= ? AND p.hidden = 0 AND p.available = 1 AND u.status = 'approved' AND u.profile_done = 1
    GROUP BY t.product_id HAVING SUM(t.n) >= 3 ORDER BY n DESC LIMIT 4`, since);
  return rows.map((r) => r.id);
}

// Shop name, shop location, contact number and open/paused state of every approved seller. Home addresses stay private.
app.get("/api/stalls", async (_req, res) => {
  const rows = await db.all("SELECT * FROM users WHERE role = 'seller' AND status = 'approved' AND profile_done = 1 ORDER BY COALESCE(NULLIF(stall_name, ''), name) COLLATE NOCASE");
  res.json({ stalls: rows.map((u) => {
    const p = publicUser(u);
    return { id: u.id, stallName: shopName(u), phone: u.phone, shop: p.shop, fromHome: p.fromHome, instagram: p.instagram, hours: p.hours, orderAhead: p.orderAhead, bigOrder: p.bigOrder, delivery: p.delivery, paused: p.paused, pauseNote: p.pauseNote };
  }) });
});

// ----- posters & ads on a shop's page -----
const MAX_POSTERS = 10;
const POSTER_SELECT = `SELECT p.*, COALESCE(NULLIF(u.stall_name, ''), u.name) AS stall_name FROM posters p JOIN users u ON u.id = p.seller_id`;
const posterOut = (r) => ({ id: r.id, sellerId: r.seller_id, stallName: r.stall_name, image: r.image, caption: r.caption, createdAt: r.created_at });

app.param("id", wholeId);
app.get("/api/stalls/:id/posters", async (req, res) => {
  const rows = await db.all(POSTER_SELECT + " WHERE p.seller_id = ? AND u.role = 'seller' AND u.status = 'approved' AND u.profile_done = 1 ORDER BY p.created_at DESC",
    Number(req.params.id));
  res.json({ posters: rows.map(posterOut) });
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
  tourPhone: (v) => text(v, 24, { label: "label.tourPhone" }),
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
// One piece of text (up to ~450 characters) through MyMemory. Returns "" when it fails or comes back untranslated.
async function machineTranslate(piece, from, to) {
  const cacheKey = from + to + "|" + piece;
  if (translations.has(cacheKey)) return translations.get(cacheKey);
  const url = new URL("https://api.mymemory.translated.net/get");
  url.searchParams.set("q", piece);
  url.searchParams.set("langpair", from + "|" + to);
  if (process.env.TRANSLATE_EMAIL) url.searchParams.set("de", process.env.TRANSLATE_EMAIL);
  let out;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await r.json();
    out = data.responseStatus == 200 && !data.quotaFinished ? String(data.responseData?.translatedText || "").trim() : "";
  } catch { out = ""; }
  // The free service sometimes hands the text back untranslated; treat that as a failure too.
  if (!out || out.toLowerCase() === piece.toLowerCase()) return "";
  if (translations.size > 500) translations.clear();
  translations.set(cacheKey, out);
  return out;
}
// Longer text, translated line by line and sentence by sentence. Returns "" if any part fails.
async function translateLong(textIn, from, to) {
  const out = [];
  for (const line of textIn.split("\n")) {
    if (!line.trim()) { out.push(""); continue; }
    const parts = line.length <= 450 ? [line] : line.match(/[^.!?]+[.!?]*\s*/g) || [line];
    const done = [];
    for (const part of parts) {
      const t = await machineTranslate(part.trim().slice(0, 450), from, to);
      if (!t) return "";
      done.push(t);
    }
    out.push(done.join(" "));
  }
  return out.join("\n");
}
app.post("/api/translate", async (req, res) => {
  const from = req.body.from, to = req.body.to;
  // A buyer's note is at most 200 characters; its Indonesian translation, sent back to check it, can be longer.
  const note = text(req.body.text, from === "id" ? 600 : 200, { required: true, label: "label.field" });
  // Buyers' notes go from the buyer's language into Indonesian, and back again so they can check them.
  const TRANSLATE_LANGS = ["ar", "my", "zh-CN", "en", "tl", "fr", "hi", "ja", "km", "ko", "lo", "ms", "es", "th", "vi"];
  if (!(TRANSLATE_LANGS.includes(from) && to === "id") && !(from === "id" && TRANSLATE_LANGS.includes(to))) return res.json({ text: note });
  if (translations.has(from + to + "|" + note)) return res.json({ text: translations.get(from + to + "|" + note) });
  await limit("translate:" + clientIp(req), 30, HOUR, "translateBusy");
  const out = await translateLong(note, from, to);
  if (!out) throw new HttpError(502, "translateFailed");
  res.json({ text: out });
});

// ----- tours, experiences & homestays (Packages page, /wisata) -----
// A tour is the full package and can include several experiences; an experience is one activity on its own.
const listingExperienceIds = (l) => { try { return l.experience_ids ? JSON.parse(l.experience_ids) : []; } catch { return []; } };
const listingPhotos = (l) => { try { return l.photos ? JSON.parse(l.photos) : []; } catch { return []; } };
const listingSchedule = (l) => { try { return l.schedule ? JSON.parse(l.schedule) : null; } catch { return null; } };
// "2026-10-18T08:00" in Surabaya time, for hiding tour dates that have passed.
const wibNowStamp = () => new Date().toLocaleString("sv-SE", { timeZone: "Asia/Jakarta" }).replace(" ", "T").slice(0, 16);
function listingOut(l, { forAdmin = false } = {}) {
  const sched = listingSchedule(l);
  if (sched && sched.mode === "dates" && !forAdmin) { const now = wibNowStamp(); sched.dates = sched.dates.filter((d) => d > now); }
  return {
    id: l.id, kind: l.kind, status: l.status, name: l.name, nameEn: l.name_en, description: l.description, descriptionEn: l.description_en,
    includes: l.includes, includesEn: l.includes_en, enAuto: !!l.en_auto, price: l.price ?? null, durationHours: l.duration_hours ?? null,
    groupMin: l.group_min ?? null, groupMax: l.group_max ?? null, location: l.location, schedule: sched, photos: listingPhotos(l),
    experienceIds: listingExperienceIds(l),
  };
}
function optNumber(v, label, { min, max, integer = true }) {
  if (v === undefined || v === null || String(v).trim() === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) throw bad("listingNumber", { label });
  return n;
}
async function listingFields(body) {
  if (!["tour", "experience", "homestay"].includes(body.kind)) throw bad("listingKind");
  if (!["shown", "hidden", "full", ...(body.kind === "experience" ? ["tours_only"] : [])].includes(body.status)) throw bad("listingStatus");
  // Tours and experiences have a length, a group size and a schedule; homestays don't.
  const tour = body.kind !== "homestay";
  const f = {
    kind: body.kind, status: body.status,
    name: text(body.name, 80, { required: true, label: "label.listingName" }),
    description: text(body.description, 1500, { label: "label.description" }),
    includes: text(body.includes, 600, { label: "label.includes" }),
    price: optNumber(body.price, "label.price", { min: 0, max: 100_000_000 }),
    location: text(body.location, 200, { label: "label.location" }),
    duration_hours: tour ? optNumber(body.durationHours, "label.duration", { min: 0.5, max: 240, integer: false }) : null,
    group_min: optNumber(body.groupMin, "label.groupMin", { min: 1, max: 1000 }),
    group_max: optNumber(body.groupMax, "label.groupMax", { min: 1, max: 1000 }),
    schedule: "",
    experience_ids: "",
  };
  if (f.group_min && f.group_max && f.group_min > f.group_max) throw bad("listingGroup");
  if (tour) {
    const sc = body.schedule || {};
    if (sc.mode === "dates") {
      const dates = Array.isArray(sc.dates) ? [...new Set(sc.dates)].sort() : [];
      if (dates.length > 30 || dates.some((d) => !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(d))) throw bad("listingDates");
      f.schedule = JSON.stringify({ mode: "dates", dates });
    } else {
      f.schedule = JSON.stringify({ mode: "request", noticeDays: optNumber(sc.noticeDays, "label.noticeDays", { min: 0, max: 60 }) ?? 0 });
    }
  }
  if (body.kind === "tour") {
    // The experiences in this tour, in the order given; only ones that exist.
    const wanted = Array.isArray(body.experienceIds) ? [...new Set(body.experienceIds.map(Number).filter(Number.isInteger))] : [];
    const have = new Set((await db.all("SELECT id FROM listings WHERE kind = 'experience'")).map((r) => r.id));
    f.experience_ids = JSON.stringify(wanted.filter((id) => have.has(id)).slice(0, 12));
  }
  // English: what the admin typed, or a machine translation of whatever they left empty.
  const typed = { name_en: text(body.nameEn, 80), description_en: text(body.descriptionEn, 1500), includes_en: text(body.includesEn, 600) };
  let auto = false;
  for (const [en, idKey] of [["name_en", "name"], ["description_en", "description"], ["includes_en", "includes"]]) {
    if (typed[en] || !f[idKey]) { f[en] = typed[en]; continue; }
    f[en] = await translateLong(f[idKey], "id", "en");
    auto = true;
  }
  f.en_auto = auto ? 1 : 0;
  return f;
}
async function listingById(id) {
  const l = await db.one("SELECT * FROM listings WHERE id = ?", Number(id));
  if (!l) throw new HttpError(404, "noListing");
  return l;
}
app.get("/api/listings", async (_req, res) => {
  const rows = await db.all("SELECT * FROM listings WHERE status != 'hidden' ORDER BY kind, created_at");
  const listed = rows.filter((l) => l.status !== "tours_only");
  const experiences = new Map(rows.filter((l) => l.kind === "experience").map((l) => [l.id, l]));
  res.json({ listings: listed.map((l) => {
    const out = listingOut(l);
    // Tours name their experiences (linked when the experience can also be booked on its own);
    // experiences name the tours they are part of.
    if (l.kind === "tour") {
      out.experiences = out.experienceIds.map((id) => experiences.get(id)).filter(Boolean)
        .map((e) => ({ id: e.id, name: e.name, nameEn: e.name_en, durationHours: e.duration_hours ?? null, linked: e.status !== "tours_only" }));
    }
    if (l.kind === "experience") {
      out.inTours = listed.filter((x) => x.kind === "tour" && listingExperienceIds(x).includes(l.id)).map((x) => ({ id: x.id, name: x.name, nameEn: x.name_en }));
    }
    delete out.experienceIds;
    return out;
  }) });
});

// ----- Our People and Collaborations (About and Collaborations pages) -----
// Groups of residents and partners, each with a name, a text and photos with captions, in both languages.
// English left empty is machine-translated; those fields are listed in auto (en_auto, or auto on a photo)
// so the admin form can show them as suggestions and they're translated again when the Indonesian changes.
const ABOUT = { groups: { table: "people_groups", maxPhotos: 20 }, partners: { table: "partners", maxPhotos: 30 } };
const GROUP_ICONS = ["store", "sprout", "palette", "users", "home", "sparkles", "leaf", "heart"];
const ABOUT_TEXTS = ["peopleIntro", "collabIntro", "sponsorText"];
const jsonList = (v) => { try { const x = v ? JSON.parse(v) : []; return Array.isArray(x) ? x : []; } catch { return []; } };
function aboutOut(kind, r) {
  const out = { id: r.id, name: r.name, nameEn: r.name_en, body: r.body, bodyEn: r.body_en, photos: jsonList(r.photos), auto: jsonList(r.en_auto) };
  return kind === "groups" ? { ...out, icon: r.icon, showSellers: !!r.show_sellers } : { ...out, years: r.years };
}
// The English for one field: what the admin typed, the earlier machine translation if the Indonesian didn't
// change, or a new machine translation. Returns [english, wasMachineTranslated].
async function english(idText, typed, old) {
  if (typed) return [typed, false];
  if (!idText) return ["", false];
  if (old && old.auto && old.id === idText && old.en) return [old.en, true];
  return [await translateLong(idText, "id", "en"), true];
}
async function aboutFields(kind, body, old) {
  const f = {
    name: text(body.name, 100, { required: true, label: "label.aboutName" }),
    body: text(body.body, 1200, { label: "label.aboutText" }),
  };
  if (kind === "groups") {
    f.icon = GROUP_ICONS.includes(body.icon) ? body.icon : "users";
    f.show_sellers = body.showSellers ? 1 : 0;
  } else f.years = text(body.years, 30, { label: "label.years" });
  const wasAuto = old ? jsonList(old.en_auto) : [];
  const auto = [];
  for (const [col, idKey, typedKey, max] of [["name_en", "name", "nameEn", 100], ["body_en", "body", "bodyEn", 1200]]) {
    const [en, machine] = await english(f[idKey], text(body[typedKey], max), old && { id: old[idKey], en: old[col], auto: wasAuto.includes(col) });
    f[col] = en;
    if (machine) auto.push(col);
  }
  f.en_auto = JSON.stringify(auto);
  // Photos already saved: the admin can reorder them, change captions and leave some out (removed).
  if (old) {
    const had = jsonList(old.photos);
    const wanted = Array.isArray(body.photos) ? body.photos : had;
    const photos = [];
    for (const p of wanted) {
      const was = had.find((h) => h.src === p?.src);
      if (!was || photos.some((x) => x.src === was.src)) continue;
      photos.push(await photoCaption(was, p));
    }
    f.photos = JSON.stringify(photos);
    f.removed = had.filter((h) => !photos.some((p) => p.src === h.src)).map((h) => h.src);
  }
  return f;
}
async function photoCaption(was, p) {
  const caption = text(p.caption, 200, { label: "label.caption" });
  const [captionEn, machine] = await english(caption, text(p.captionEn, 200, { label: "label.caption" }), was && { id: was.caption, en: was.captionEn, auto: was.auto });
  return { src: was.src, w: was.w ?? null, h: was.h ?? null, caption, captionEn, auto: machine };
}
async function aboutById(kind, id) {
  const r = await db.one(`SELECT * FROM ${ABOUT[kind].table} WHERE id = ?`, Number(id));
  if (!r) throw new HttpError(404, "noAboutItem");
  return r;
}
async function aboutList(kind) {
  return (await db.all(`SELECT * FROM ${ABOUT[kind].table} ORDER BY position, id`)).map((r) => aboutOut(kind, r));
}
async function aboutTexts() {
  const rows = await db.all("SELECT key, value FROM settings WHERE key LIKE 'about.%'");
  const saved = Object.fromEntries(rows.map((r) => [r.key.slice(6), (() => { try { return JSON.parse(r.value); } catch { return null; } })()]));
  return Object.fromEntries(ABOUT_TEXTS.map((k) => [k, saved[k] || { ...ABOUT_SEED.texts[k], auto: false }]));
}
// The starting content goes in once (fixed ids, so two servers starting together don't add it twice).
async function seedAbout() {
  if (!(await db.one("SELECT 1 AS x FROM settings WHERE key = 'seeded.about'"))) await seedAboutFirst();
  await renameStallCaptions();
  await addGroupPhotos();
  // Partners added to the starting content later go in once each, at the end of the list, unless one with
  // that name is already there (an admin may have added it, or another server instance just did).
  for (const p of ABOUT_SEED.partners.filter((x) => x.addedLater)) {
    const flag = "seeded.partner." + p.addedLater;
    if (await db.one("SELECT 1 AS x FROM settings WHERE key = ?", flag)) continue;
    await db.batch([
      [`INSERT INTO partners (position, years, name, name_en, body, body_en, photos, created_at)
        SELECT pos, ?, ?, ?, ?, ?, ?, ? FROM (SELECT COALESCE(MAX(position), 0) + 1 AS pos FROM partners) WHERE NOT EXISTS (SELECT 1 FROM partners WHERE name = ?)`,
        p.years, p.name, p.nameEn, p.body, p.bodyEn, JSON.stringify(p.photos.map((x) => ({ ...x, auto: false }))), Date.now(), p.name],
      ["INSERT OR IGNORE INTO settings (key, value) VALUES (?, '1')", flag],
    ]);
  }
}
// "Lapak" became "toko" across the site. Two starting photo captions already in the database are updated once,
// only if an admin hasn't changed them.
async function renameStallCaptions() {
  if (await db.one("SELECT 1 AS x FROM settings WHERE key = 'seeded.fix.toko'")) return;
  const renamed = { "Penjual semanggi menyambut pembeli di lapaknya.": "Penjual semanggi menyambut pembeli di tokonya.", "Lapak pecel semanggi dengan kerupuk puli yang besar.": "Toko pecel semanggi dengan kerupuk puli yang besar." };
  const writes = [];
  for (const g of await db.all("SELECT id, photos FROM people_groups")) {
    const photos = jsonList(g.photos);
    if (!photos.some((p) => renamed[p.caption])) continue;
    writes.push(["UPDATE people_groups SET photos = ? WHERE id = ?", JSON.stringify(photos.map((p) => (renamed[p.caption] ? { ...p, caption: renamed[p.caption] } : p))), g.id]);
  }
  writes.push(["INSERT OR IGNORE INTO settings (key, value) VALUES ('seeded.fix.toko', '1')"]);
  await db.batch(writes);
}
// Photos added to starting groups after the first release. Each set goes in once (flag), skipping photos the
// group already has; the batik photos only go in if that group still has no photos (an admin may have added their own).
const ADDED_GROUP_PHOTOS = [
  { flag: "seeded.fix.batik", group: "Pembatik", onlyIfEmpty: true },
  // The wide field photo goes first, so it is the big one at the top of the group.
  { flag: "seeded.fix.fields", group: "Petani", srcs: ["/warga-foto/petani-3.jpg", "/warga-foto/petani-4.jpg"], first: ["/warga-foto/petani-3.jpg"] },
];
async function addGroupPhotos() {
  for (const fix of ADDED_GROUP_PHOTOS) {
    if (await db.one("SELECT 1 AS x FROM settings WHERE key = ?", fix.flag)) continue;
    const writes = [];
    const row = await db.one("SELECT id, photos FROM people_groups WHERE name = ?", fix.group);
    const have = row ? jsonList(row.photos) : [];
    if (row && !(fix.onlyIfEmpty && have.length)) {
      const add = ABOUT_SEED.groups.find((g) => g.name === fix.group).photos
        .filter((p) => (!fix.srcs || fix.srcs.includes(p.src)) && !have.some((h) => h.src === p.src)).map((p) => ({ ...p, auto: false }));
      const front = add.filter((p) => fix.first?.includes(p.src));
      if (add.length) writes.push(["UPDATE people_groups SET photos = ? WHERE id = ?", JSON.stringify([...front, ...have, ...add.filter((p) => !front.includes(p))]), row.id]);
    }
    writes.push(["INSERT OR IGNORE INTO settings (key, value) VALUES (?, '1')", fix.flag]);
    await db.batch(writes);
  }
}
async function seedAboutFirst() {
  const now = Date.now(), writes = [];
  ABOUT_SEED.groups.forEach((g, i) => writes.push(["INSERT OR IGNORE INTO people_groups (id, position, name, name_en, body, body_en, icon, show_sellers, photos, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    i + 1, i + 1, g.name, g.nameEn, g.body, g.bodyEn, g.icon, g.showSellers ? 1 : 0, JSON.stringify(g.photos.map((p) => ({ ...p, auto: false }))), now]));
  ABOUT_SEED.partners.filter((p) => !p.addedLater).forEach((p, i) => writes.push(["INSERT OR IGNORE INTO partners (id, position, years, name, name_en, body, body_en, photos, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    i + 1, i + 1, p.years, p.name, p.nameEn, p.body, p.bodyEn, JSON.stringify(p.photos.map((x) => ({ ...x, auto: false }))), now]));
  writes.push(["INSERT OR IGNORE INTO settings (key, value) VALUES ('seeded.about', '1')"]);
  await db.batch(writes);
}
app.get("/api/about", async (_req, res) => {
  const [groups, partners, texts] = await Promise.all([aboutList("groups"), aboutList("partners"), aboutTexts()]);
  const clean = (x) => { const { auto, ...rest } = x; return { ...rest, photos: rest.photos.map(({ auto: _a, ...p }) => p) }; };
  res.json({ groups: groups.map(clean), partners: partners.map(clean), texts: Object.fromEntries(Object.entries(texts).map(([k, v]) => [k, { id: v.id, en: v.en }])) });
});

// ----- seller -----
const seller = express.Router();
seller.param("id", wholeId);
seller.use(requireRole("seller"));
// Until a new seller has filled in their details, the profile is the only thing they can change.
seller.use((req, _res, next) => next(req.user.profile_done || req.path === "/profile" ? undefined : new HttpError(403, "profileIncomplete")));

seller.patch("/profile", async (req, res) => {
  const f = sellerFields(req.body);
  if (!req.user.profile_done) {
    // First sign-in: the home address is needed, and a shop address unless they only sell from home.
    if (!f.home_address) throw bad("required", { label: "label.homeAddress" });
    if (!f.shop_address && !f.from_home) throw bad("required", { label: "label.shopAddress" });
    f.profile_done = 1;
  }
  await updateUser(req.user.id, f);
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

// Optional number of pieces in one listed price: a whole number from 1 to 100000, or empty.
function pieces(v) {
  if (v === undefined || v === null || String(v).trim() === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 100000) throw bad("pieces");
  return n;
}
// Fixed list so the catalog filter stays tidy; "" = not chosen.
const CATEGORIES = ["", "pecel", "camilan", "minuman", "oleh-oleh", "lainnya"];
// What buyers did with this seller's products over the last 7 and 30 days.
seller.get("/stats", async (req, res) => {
  const since30 = wibDay(Date.now() - 29 * 864e5), since7 = wibDay(Date.now() - 6 * 864e5);
  const rows = await db.all(`SELECT p.id, p.name, e.kind, e.day, e.n FROM products p
    LEFT JOIN product_events e ON e.product_id = p.id AND e.day >= ?
    WHERE p.seller_id = ? ORDER BY p.created_at`, since30, req.user.id);
  const blank = () => ({ view: 0, contact: 0, share: 0 });
  const total = { week: blank(), month: blank() };
  const byId = new Map();
  for (const r of rows) {
    if (!byId.has(r.id)) byId.set(r.id, { id: r.id, name: r.name, week: blank(), month: blank() });
    if (!r.kind) continue;
    const bucket = r.kind === "view" ? "view" : r.kind === "share" ? "share" : "contact";
    const item = byId.get(r.id);
    item.month[bucket] += r.n; total.month[bucket] += r.n;
    if (r.day >= since7) { item.week[bucket] += r.n; total.week[bucket] += r.n; }
  }
  res.json({ total, products: [...byId.values()] });
});

function productFields(body, partial) {
  const f = {};
  if (!partial || body.name !== undefined) f.name = text(body.name, 60, { required: true, label: "label.product" });
  if (Array.isArray(body.sizes)) Object.assign(f, sizeFields(body.sizes));
  else {
    if (!partial || body.price !== undefined) f.price = money(body.price);
    if (!partial || body.unit !== undefined) f.unit = text(body.unit, 30);
    if (!partial || body.pieces !== undefined) f.pieces = pieces(body.pieces);
    if (!partial) f.sizes = "";
  }
  if (!partial || body.description !== undefined) f.description = text(body.description, 240);
  if (!partial || body.category !== undefined) {
    f.category = typeof body.category === "string" ? body.category : "";
    if (!CATEGORIES.includes(f.category)) throw bad("categoryInvalid");
  }
  if (body.available !== undefined) f.available = body.available ? 1 : 0;
  return f;
}
// 1 to 5 packagings, each with a name and a price. The first also fills price, unit and pieces,
// which is what a product with one packaging uses on its own.
function sizeFields(list) {
  if (list.length < 1 || list.length > 5) throw bad("sizes");
  const sizes = list.map((s) => {
    const unit = text(s?.unit, 30, { label: "label.unit" });
    if (list.length > 1 && !unit) throw bad("sizes");
    return { unit, price: money(s?.price), pieces: pieces(s?.pieces), out: list.length > 1 && !!s?.out };
  });
  if (sizes.every((s) => s.out)) throw bad("sizeOut");
  const [first] = sizes;
  return { price: first.price, unit: first.unit, pieces: first.pieces, sizes: sizes.length > 1 ? JSON.stringify(sizes) : "" };
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
  const r = await db.run("INSERT INTO products (seller_id, name, price, unit, pieces, sizes, description, category, photo, available, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)",
    req.user.id, f.name, f.price, f.unit, f.pieces, f.sizes, f.description, f.category, photo, Date.now());
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

const productEventsDelete = (sql, id) => [["DELETE FROM product_events WHERE product_id " + sql, id], ["DELETE FROM product_taps WHERE product_id " + sql, id]];
seller.delete("/products/:id", async (req, res) => {
  const p = await ownProduct(req);
  await db.batch([...productEventsDelete("= ?", p.id), ["DELETE FROM products WHERE id = ?", p.id]]);
  removePhoto(p.photo, req); extraPhotos(p).forEach((x) => removePhoto(x, req));
  res.json({ ok: true });
});

seller.get("/posters", async (req, res) => {
  const rows = await db.all(POSTER_SELECT + " WHERE p.seller_id = ? ORDER BY p.created_at DESC", req.user.id);
  res.json({ posters: rows.map(posterOut) });
});
seller.post("/posters", async (req, res) => {
  if (!req.body.image) throw bad("posterImage");
  const caption = text(req.body.caption, 140, { label: "label.posterCaption" });
  if ((await db.one("SELECT COUNT(*) AS n FROM posters WHERE seller_id = ?", req.user.id)).n >= MAX_POSTERS) throw bad("maxPosters");
  const image = await savePhoto(req.body.image, req);
  const r = await db.run("INSERT INTO posters (seller_id, image, caption, created_at) VALUES (?, ?, ?, ?)", req.user.id, image, caption, Date.now());
  res.status(201).json({ id: r.id });
});
seller.delete("/posters/:id", async (req, res) => {
  const p = await db.one("SELECT * FROM posters WHERE id = ? AND seller_id = ?", Number(req.params.id), req.user.id);
  if (!p) throw new HttpError(404, "noPoster");
  await db.run("DELETE FROM posters WHERE id = ?", p.id);
  removePhoto(p.image, req);
  res.json({ ok: true });
});

app.use("/api/seller", seller);

// ----- admin -----
const admin = express.Router();
admin.param("id", wholeId);
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

// Admins create a seller with just a phone number and a starting password. The seller fills in the rest
// (name, shop, addresses) the first time they sign in.
admin.post("/sellers", async (req, res) => {
  const typed = text(req.body.phone, 24, { required: true, label: "label.loginPhone" });
  const key = phoneKey(typed);
  if (!key) throw bad("phoneInvalid");
  const password = newPassword(req.body.password);
  if (await db.one("SELECT 1 AS x FROM users WHERE email = ?", key)) throw bad("phoneTaken");
  const r = await db.run("INSERT INTO users (email, password_hash, role, status, phone, profile_done, created_at) VALUES (?, ?, 'seller', 'approved', ?, 0, ?)",
    key, hashPassword(password), typed, Date.now());
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
  const photos = (await db.all("SELECT photo, extra_photos FROM products WHERE seller_id = ?", u.id)).flatMap((p) => [p.photo, ...extraPhotos(p)]).filter(Boolean)
    .concat((await db.all("SELECT image FROM posters WHERE seller_id = ?", u.id)).map((p) => p.image));
  await db.batch([
    ["DELETE FROM posters WHERE seller_id = ?", u.id],
    ["DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE seller_id = ?)", u.id],
    ["DELETE FROM orders WHERE seller_id = ?", u.id],
    ["DELETE FROM sessions WHERE user_id = ?", u.id],
    ...productEventsDelete("IN (SELECT id FROM products WHERE seller_id = ?)", u.id),
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
  await db.batch([...productEventsDelete("= ?", p.id), ["DELETE FROM products WHERE id = ?", p.id]]);
  removePhoto(p.photo, req); extraPhotos(p).forEach((x) => removePhoto(x, req));
  res.json({ ok: true });
});

admin.get("/posters", async (_req, res) => {
  const rows = await db.all(POSTER_SELECT + " ORDER BY p.created_at DESC");
  res.json({ posters: rows.map(posterOut) });
});
admin.delete("/posters/:id", async (req, res) => {
  const p = await db.one("SELECT * FROM posters WHERE id = ?", Number(req.params.id));
  if (!p) throw new HttpError(404, "noPoster");
  await db.run("DELETE FROM posters WHERE id = ?", p.id);
  removePhoto(p.image, req);
  res.json({ ok: true });
});

admin.get("/listings", async (_req, res) => {
  const rows = await db.all("SELECT * FROM listings ORDER BY kind, created_at DESC");
  res.json({ listings: rows.map((l) => listingOut(l, { forAdmin: true })) });
});
admin.post("/listings", async (req, res) => {
  const f = await listingFields(req.body);
  const keys = Object.keys(f);
  const r = await db.run(`INSERT INTO listings (${keys.join(", ")}, created_at) VALUES (${keys.map(() => "?").join(", ")}, ?)`, ...keys.map((k) => f[k]), Date.now());
  res.status(201).json({ listing: listingOut(await listingById(r.id), { forAdmin: true }) });
});
admin.put("/listings/:id", async (req, res) => {
  const l = await listingById(req.params.id);
  const f = await listingFields(req.body);
  const keys = Object.keys(f);
  await db.run(`UPDATE listings SET ${keys.map((k) => k + " = ?").join(", ")} WHERE id = ?`, ...keys.map((k) => f[k]), l.id);
  res.json({ listing: listingOut(await listingById(l.id), { forAdmin: true }) });
});
admin.delete("/listings/:id", async (req, res) => {
  const l = await listingById(req.params.id);
  await db.run("DELETE FROM listings WHERE id = ?", l.id);
  // A deleted experience is taken out of the tours that included it.
  if (l.kind === "experience") {
    for (const tour of await db.all("SELECT id, experience_ids FROM listings WHERE kind = 'tour'")) {
      const ids = listingExperienceIds(tour);
      if (ids.includes(l.id)) await db.run("UPDATE listings SET experience_ids = ? WHERE id = ?", JSON.stringify(ids.filter((x) => x !== l.id)), tour.id);
    }
  }
  listingPhotos(l).forEach((p) => removePhoto(p, req));
  res.json({ ok: true });
});
// Up to 10 photos, added and removed one at a time.
admin.post("/listings/:id/photos", async (req, res) => {
  const l = await listingById(req.params.id);
  const photos = listingPhotos(l);
  if (photos.length >= 10) throw bad("tooManyPhotos");
  photos.push(await savePhoto(req.body.photo, req));
  await db.run("UPDATE listings SET photos = ? WHERE id = ?", JSON.stringify(photos), l.id);
  res.status(201).json({ photos });
});
admin.delete("/listings/:id/photos", async (req, res) => {
  const l = await listingById(req.params.id);
  const photos = listingPhotos(l);
  const i = photos.indexOf(req.body.photo);
  if (i < 0) throw new HttpError(404, "noPhoto");
  const [gone] = photos.splice(i, 1);
  await db.run("UPDATE listings SET photos = ? WHERE id = ?", JSON.stringify(photos), l.id);
  removePhoto(gone, req);
  res.json({ photos });
});

// Our People groups and Collaborations partners.
for (const kind of Object.keys(ABOUT)) {
  const { table, maxPhotos } = ABOUT[kind];
  admin.get("/" + kind, async (_req, res) => res.json({ items: await aboutList(kind) }));
  admin.post("/" + kind, async (req, res) => {
    const { removed, photos, ...f } = await aboutFields(kind, req.body, null);
    const last = await db.one(`SELECT MAX(position) AS p FROM ${table}`);
    const keys = Object.keys(f);
    const r = await db.run(`INSERT INTO ${table} (${keys.join(", ")}, position, created_at) VALUES (${keys.map(() => "?").join(", ")}, ?, ?)`, ...keys.map((k) => f[k]), (last?.p || 0) + 1, Date.now());
    res.status(201).json({ item: aboutOut(kind, await aboutById(kind, r.id)) });
  });
  admin.put("/" + kind + "/:id", async (req, res) => {
    const old = await aboutById(kind, req.params.id);
    const { removed, ...f } = await aboutFields(kind, req.body, old);
    const keys = Object.keys(f);
    await db.run(`UPDATE ${table} SET ${keys.map((k) => k + " = ?").join(", ")} WHERE id = ?`, ...keys.map((k) => f[k]), old.id);
    removed.forEach((p) => removePhoto(p, req));
    res.json({ item: aboutOut(kind, await aboutById(kind, old.id)) });
  });
  admin.delete("/" + kind + "/:id", async (req, res) => {
    const old = await aboutById(kind, req.params.id);
    await db.run(`DELETE FROM ${table} WHERE id = ?`, old.id);
    jsonList(old.photos).forEach((p) => removePhoto(p.src, req));
    res.json({ ok: true });
  });
  // Move one place up (-1) or down (1) by swapping with its neighbour.
  admin.post("/" + kind + "/:id/move", async (req, res) => {
    const list = await db.all(`SELECT id, position FROM ${table} ORDER BY position, id`);
    const i = list.findIndex((r) => r.id === Number(req.params.id));
    if (i < 0) throw new HttpError(404, "noAboutItem");
    const j = i + (req.body.dir < 0 ? -1 : 1);
    if (j >= 0 && j < list.length) {
      [list[i], list[j]] = [list[j], list[i]];
      await db.batch(list.map((r, k) => [`UPDATE ${table} SET position = ? WHERE id = ?`, k + 1, r.id]));
    }
    res.json({ items: await aboutList(kind) });
  });
  // One photo at a time, with its caption, so each upload stays small.
  admin.post("/" + kind + "/:id/photos", async (req, res) => {
    const old = await aboutById(kind, req.params.id);
    const photos = jsonList(old.photos);
    if (photos.length >= maxPhotos) throw bad("tooManyAboutPhotos", { max: maxPhotos });
    const src = await savePhoto(req.body.photo, req);
    const size = (v) => (Number.isInteger(v) && v > 0 && v < 10000 ? v : null);
    photos.push(await photoCaption({ src, w: size(req.body.w), h: size(req.body.h) }, req.body));
    await db.run(`UPDATE ${table} SET photos = ? WHERE id = ?`, JSON.stringify(photos), old.id);
    res.status(201).json({ item: aboutOut(kind, await aboutById(kind, old.id)) });
  });
}
admin.get("/about-texts", async (_req, res) => res.json({ texts: await aboutTexts() }));
admin.put("/about-texts", async (req, res) => {
  const now = await aboutTexts(), writes = [];
  for (const k of ABOUT_TEXTS) {
    const v = req.body[k];
    if (!v) continue;
    const id = text(v.id, 1500, { required: true, label: "label.aboutIntro" });
    const [en, auto] = await english(id, text(v.en, 1500, { label: "label.aboutIntro" }), now[k]);
    writes.push(["INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", "about." + k, JSON.stringify({ id, en, auto })]);
  }
  if (writes.length) await db.batch(writes);
  res.json({ texts: await aboutTexts() });
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
app.get("/katalog", (req, res) => res.redirect(302, "/" + (req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "")));
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
