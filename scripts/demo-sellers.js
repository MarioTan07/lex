// Example sellers and products for trying the site out.
//   npm run demo:add     adds them (skips any that already exist)
//   npm run demo:remove  deletes them and their products
// Every example seller signs in with an @contoh.test email; their passwords are saved in
// DATA_DIR/demo-sellers.txt. Remove them before real sellers and buyers use the site.
// Works on the local database, or on Turso when TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are set (e.g. in .env).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { connect, setupSchema, DATA_DIR } from "../db.js";

const db = connect();
await setupSchema(db);

// Shops around Jalan Kendung, Sememi. Pins are approximate.
const SELLERS = [
  {
    email: "bu.ning@contoh.test", name: "Ning Rahayu", stall: "Semanggi Bu Ning", phone: "0812 0000 0101",
    shop: ["Jl. Kendung No. 12, Sememi, Benowo, Surabaya", -7.2432, 112.6347],
    home: ["Jl. Kendung Gg. 1 No. 4, Sememi, Benowo", -7.2436, 112.6351],
    products: [
      ["Pecel semanggi", 15000, "pincuk", "Semanggi dan tauge dengan bumbu ubi dan kacang, plus krupuk puli."],
      ["Pecel semanggi porsi besar", 20000, "pincuk", "Porsi dobel semanggi, bumbu lebih banyak."],
      ["Krupuk puli", 10000, "bungkus", "Krupuk nasi renyah untuk teman pecel, isi 10."],
      ["Es teh", 4000, "gelas", "Teh manis dingin."],
    ],
  },
  {
    email: "mak.sum@contoh.test", name: "Sumiati", stall: "Pecel Semanggi Mak Sum", phone: "0812 0000 0102",
    shop: ["Jl. Kendung No. 27, Sememi, Benowo, Surabaya", -7.2441, 112.6339],
    home: ["Jl. Kendung Gg. 3 No. 9, Sememi, Benowo", -7.2445, 112.6334],
    products: [
      ["Pecel semanggi", 13000, "pincuk", "Resep turun-temurun sejak 1970-an, bumbu kental dan manis."],
      ["Semanggi instan", 25000, "pak", "Semanggi kering dan bumbu siap seduh, untuk oleh-oleh. Tahan 3 bulan."],
      ["Peyek semanggi", 15000, "bungkus", "Peyek tipis dengan daun semanggi utuh, 150 g."],
    ],
  },
  {
    email: "bu.yati@contoh.test", name: "Suryati", stall: "Dapur Semanggi Bu Yati", phone: "0812 0000 0103",
    shop: ["Jl. Sememi Jaya No. 5, Sememi, Benowo, Surabaya", -7.2424, 112.6362],
    home: ["Jl. Sememi Jaya Gg. 2 No. 11, Sememi, Benowo", -7.2420, 112.6366],
    products: [
      ["Kue kering semanggi", 35000, "toples", "Kue kering renyah dengan daun semanggi, toples 250 g."],
      ["Nastar semanggi", 60000, "toples", "Nastar isi selai nanas dengan kulit semanggi, toples 500 g.", false],
      ["Stik semanggi", 18000, "bungkus", "Stik gurih dan renyah, 200 g."],
    ],
  },
  {
    email: "pak.darto@contoh.test", name: "Sudarto", stall: "Semanggi Pak Darto", phone: "0812 0000 0104",
    shop: ["Jl. Kendung No. 40, Sememi, Benowo, Surabaya", -7.2452, 112.6355],
    home: ["Jl. Kendung Gg. 4 No. 2, Sememi, Benowo", -7.2456, 112.6359],
    products: [
      ["Pecel semanggi", 14000, "pincuk", "Semanggi segar dari sawah sendiri, dipetik pagi hari."],
      ["Jus semanggi", 8000, "gelas", "Jus daun semanggi dengan madu dan jeruk nipis."],
      ["Nugget semanggi", 22000, "pak", "Nugget ayam dan semanggi beku, isi 12 (250 g)."],
    ],
  },
  {
    email: "bu.endang@contoh.test", name: "Endang Lestari", stall: "Warung Semanggi Bu Endang", phone: "0812 0000 0105",
    shop: ["Jl. Kendung No. 8, Sememi, Benowo, Surabaya", -7.2428, 112.6340],
    home: ["Jl. Kendung Gg. 1 No. 15, Sememi, Benowo", -7.2425, 112.6337],
    paused: "Tutup sementara sampai Senin karena ada acara keluarga. Terima kasih!",
    products: [
      ["Pecel semanggi", 15000, "pincuk", "Lengkap dengan krupuk puli dan bumbu ekstra."],
      ["Tahu bakso semanggi", 20000, "porsi", "Tahu isi bakso ayam dan semanggi, isi 5."],
      ["Cilok semanggi", 10000, "porsi", "Cilok kenyal dengan saus kacang, isi 10."],
    ],
  },
  {
    email: "mbak.rina@contoh.test", name: "Rina Wulandari", stall: "Camilan Semanggi Mbak Rina", phone: "0812 0000 0106",
    shop: ["Jl. Sememi Jaya No. 18, Sememi, Benowo, Surabaya", -7.2437, 112.6370],
    home: ["Jl. Sememi Jaya Gg. 5 No. 7, Sememi, Benowo", -7.2441, 112.6374],
    products: [
      ["Peyek semanggi", 12000, "bungkus", "Peyek renyah dengan kacang dan semanggi, 150 g."],
      ["Stik semanggi", 15000, "bungkus", "Stik semanggi rasa original, 200 g."],
      ["Cireng semanggi", 10000, "porsi", "Cireng isi dengan sambal rujak, isi 8."],
      ["Kue kering semanggi", 30000, "toples", "Kue kering semanggi rasa keju, toples 250 g."],
    ],
  },
];

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return salt.toString("hex") + ":" + crypto.scryptSync(pw, salt, 64).toString("hex");
}

async function add() {
  const notes = [];
  let added = 0, items = 0;
  for (const s of SELLERS) {
    if (await db.one("SELECT 1 AS x FROM users WHERE email = ?", s.email)) continue;
    const password = crypto.randomBytes(6).toString("base64url");
    const now = Date.now();
    const r = await db.run(`INSERT INTO users (email, password_hash, role, status, name, stall_name, phone,
        shop_address, shop_lat, shop_lng, home_address, home_lat, home_lng, paused, pause_note, created_at)
      VALUES (?, ?, 'seller', 'approved', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      s.email, hashPassword(password), s.name, s.stall, s.phone, ...s.shop, ...s.home, s.paused ? 1 : 0, s.paused || "", now);
    await db.batch(s.products.map(([name, price, unit, desc, available = true], i) =>
      ["INSERT INTO products (seller_id, name, price, unit, description, available, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        r.id, name, price, unit, desc, available ? 1 : 0, now + i]));
    items += s.products.length;
    notes.push(`${s.stall}
  Email: ${s.email}
  Password: ${password}`);
    added++;
  }
  if (notes.length) {
    const file = path.join(DATA_DIR, "demo-sellers.txt");
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(file, notes.join("\n\n") + "\n\n");
    console.log(`Added ${added} example sellers with ${items} products${db.remote ? " to the online database" : ""}. Their sign-in details are in ${file}`);
  } else {
    console.log("The example sellers are already there.");
  }
}

async function remove() {
  const ids = (await db.all("SELECT id FROM users WHERE role = 'seller' AND email LIKE '%@contoh.test'")).map((r) => r.id);
  if (!ids.length) return console.log("No example sellers to remove.");
  const marks = ids.map(() => "?").join(",");
  await db.batch([
    // Old orders and sign-ins reference sellers, so clear those first.
    [`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE seller_id IN (${marks}))`, ...ids],
    [`DELETE FROM orders WHERE seller_id IN (${marks})`, ...ids],
    [`DELETE FROM sessions WHERE user_id IN (${marks})`, ...ids],
    [`DELETE FROM products WHERE seller_id IN (${marks})`, ...ids],
    [`DELETE FROM users WHERE id IN (${marks})`, ...ids],
  ]);
  fs.rmSync(path.join(DATA_DIR, "demo-sellers.txt"), { force: true });
  console.log(`Removed ${ids.length} example sellers and their products.`);
}

const cmd = process.argv[2];
if (cmd === "add") await add();
else if (cmd === "remove") await remove();
else console.log("Use: node scripts/demo-sellers.js add | remove");
db.close();
