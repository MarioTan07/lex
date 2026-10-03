// Database access for the server and the scripts.
// On Vercel the data lives in a Turso database (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN).
// On your own computer, without those set, it uses the file DATA_DIR/semanggi.db.
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");

const SCHEMA = `
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
  -- How many different visitors showed interest in a product each day (opened it, called, messaged or shared).
  -- Only counts are kept, nothing about the visitor. Used for the "lagi hits" (trending) label.
  CREATE TABLE IF NOT EXISTS product_taps (
    product_id INTEGER NOT NULL,
    day TEXT NOT NULL,
    n INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (product_id, day)
  );
  -- Site-wide settings the admins edit, such as the sponsor contact number. One row per setting.
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);
  CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
`;

// Columns added after the first release; added to older databases.
const ADDED_USER_COLUMNS = {
  shop_address: "TEXT NOT NULL DEFAULT ''", shop_lat: "REAL", shop_lng: "REAL",
  home_address: "TEXT NOT NULL DEFAULT ''", home_lat: "REAL", home_lng: "REAL",
  paused: "INTEGER NOT NULL DEFAULT 0", pause_note: "TEXT NOT NULL DEFAULT ''",
  instagram: "TEXT NOT NULL DEFAULT ''", from_home: "INTEGER NOT NULL DEFAULT 0",
  hours: "TEXT NOT NULL DEFAULT ''",
};
const ADDED_PRODUCT_COLUMNS = { category: "TEXT NOT NULL DEFAULT ''" };

const isNetworkError = (e) => /fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|network/i.test(`${e?.message} ${e?.cause?.message ?? ""} ${e?.cause?.code ?? ""}`);
const arg = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);
const plainRows = (r) => r.rows.map((row) => Object.fromEntries(r.columns.map((c, i) => [c, row[i]])));

// Returns { all, one, run, batch, remote, close }. Queries use ? placeholders.
export function connect({ local = false } = {}) {
  const url = local ? null : process.env.TURSO_DATABASE_URL;
  if (!url && process.env.VERCEL) {
    throw new Error("TURSO_DATABASE_URL isn't set. Connect a Turso database to this Vercel project, then redeploy.");
  }
  if (!url) fs.mkdirSync(DATA_DIR, { recursive: true });
  const client = createClient(url
    ? { url, authToken: process.env.TURSO_AUTH_TOKEN }
    : { url: pathToFileURL(path.join(DATA_DIR, "semanggi.db")).href });
  // Reads are retried when the network to the database drops for a moment ("fetch failed").
  // Writes aren't, so a write that did reach the database is never applied twice.
  const exec = async (sql, args) => {
    const read = /^\s*(SELECT|PRAGMA)\b/i.test(sql);
    for (let attempt = 1; ; attempt++) {
      try { return await client.execute({ sql, args: args.map(arg) }); }
      catch (e) {
        if (!read || attempt === 3 || !isNetworkError(e)) throw e;
        await new Promise((r) => setTimeout(r, 200 * attempt));
      }
    }
  };
  return {
    remote: !!url,
    all: async (sql, ...args) => plainRows(await exec(sql, args)),
    one: async (sql, ...args) => plainRows(await exec(sql, args))[0],
    run: async (sql, ...args) => {
      const r = await exec(sql, args);
      return { changes: r.rowsAffected, id: r.lastInsertRowid == null ? null : Number(r.lastInsertRowid) };
    },
    // Several writes that succeed or fail together: [[sql, ...args], ...]
    batch: (stmts) => client.batch(stmts.map(([sql, ...args]) => ({ sql, args: args.map(arg) })), "write"),
    close: () => client.close(),
    client,
  };
}

// Create tables and bring older databases up to date. Safe to run on every start.
export async function setupSchema(db) {
  if (!db.remote) await db.client.execute("PRAGMA journal_mode = WAL");
  await db.client.executeMultiple(SCHEMA);
  const have = new Set((await db.all("PRAGMA table_info(users)")).map((c) => c.name));
  for (const [col, type] of Object.entries(ADDED_USER_COLUMNS)) {
    if (!have.has(col)) await db.run(`ALTER TABLE users ADD COLUMN ${col} ${type}`);
  }
  const haveP = new Set((await db.all("PRAGMA table_info(products)")).map((c) => c.name));
  for (const [col, type] of Object.entries(ADDED_PRODUCT_COLUMNS)) {
    if (!haveP.has(col)) await db.run(`ALTER TABLE products ADD COLUMN ${col} ${type}`);
  }
}
