// Copies everything in the local database (data/semanggi.db) to the Turso database, and uploads
// product photos from data/uploads to Vercel Blob. Sign-in sessions aren't copied.
//
//   npm run copy-to-turso              stops if the Turso database already has accounts or products
//   npm run copy-to-turso -- --replace  first deletes everything in the Turso database
//
// Needs TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in a .env file. Photos are uploaded only when Blob
// credentials are there too: BLOB_READ_WRITE_TOKEN, or BLOB_STORE_ID with VERCEL_OIDC_TOKEN.
import fs from "node:fs";
import path from "node:path";
import { put } from "@vercel/blob";
import { connect, setupSchema, DATA_DIR } from "../db.js";

if (!process.env.TURSO_DATABASE_URL) {
  console.error("TURSO_DATABASE_URL isn't set. Put it and TURSO_AUTH_TOKEN in the .env file (see .env.example).");
  process.exit(1);
}
const replace = process.argv.includes("--replace");
const local = connect({ local: true });
const remote = connect();
await setupSchema(local);
await setupSchema(remote);

// Children before parents when deleting; parents before children when inserting.
const TABLES = ["users", "products", "orders", "order_items"];

const existing = (await remote.one("SELECT (SELECT COUNT(*) FROM users) + (SELECT COUNT(*) FROM products) AS n")).n;
if (existing && !replace) {
  console.error(`The Turso database already has ${existing} accounts and products, so nothing was copied. To overwrite it with your local data, run: npm run copy-to-turso -- --replace`);
  // Close the connections before stopping; exiting with them open crashes Node on Windows.
  local.close();
  remote.close();
  process.exitCode = 1;
} else {
if (existing) {
  await remote.batch([...TABLES].reverse().map((t) => [`DELETE FROM ${t}`]).concat([["DELETE FROM sessions"]]));
  console.log("Cleared the Turso database.");
}

// Upload local photos and point products at their new addresses.
const products = await local.all("SELECT id, photo FROM products WHERE photo LIKE '/uploads/%'");
const newPhoto = new Map();
const BLOB_OK = !!(process.env.BLOB_READ_WRITE_TOKEN || (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN));
if (products.length && !BLOB_OK) {
  console.warn(`No Blob credentials in .env, so ${products.length} product photo(s) won't be copied. Those products will show without a photo; sellers can add it again on the live site.`);
}
for (const p of products) {
  if (!BLOB_OK) { newPhoto.set(p.id, ""); continue; }
  const file = path.join(DATA_DIR, "uploads", path.basename(p.photo));
  if (!fs.existsSync(file)) { newPhoto.set(p.id, ""); continue; }
  const ext = path.extname(file).slice(1).toLowerCase();
  const blob = await put("products/" + path.basename(file), fs.readFileSync(file), {
    access: "public", contentType: "image/" + (ext === "jpg" ? "jpeg" : ext), addRandomSuffix: false, allowOverwrite: true,
  });
  newPhoto.set(p.id, blob.url);
}
if (BLOB_OK && newPhoto.size) console.log(`Uploaded ${[...newPhoto.values()].filter(Boolean).length} photo(s) to Vercel Blob.`);

for (const table of TABLES) {
  const cols = (await local.all(`PRAGMA table_info(${table})`)).map((c) => c.name);
  const rows = await local.all(`SELECT ${cols.join(", ")} FROM ${table}`);
  if (table === "products") for (const r of rows) if (newPhoto.has(r.id)) r.photo = newPhoto.get(r.id);
  const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`;
  for (let i = 0; i < rows.length; i += 100) {
    await remote.batch(rows.slice(i, i + 100).map((r) => [sql, ...cols.map((c) => r[c])]));
  }
  console.log(`Copied ${rows.length} row(s) of ${table}.`);
}
console.log("Done. Your Vercel site now has the same admins, sellers and products as your computer.");
local.close();
remote.close();
}
