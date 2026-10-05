// Saves a copy of the live (Turso) database as a SQLite file: backups/<date>/semanggi.db.
// Sign-in sessions, attempt counters and password-reset codes are left out. Photos stay in Vercel Blob.
//
//   npm run backup        needs TURSO_DATABASE_URL and TURSO_AUTH_TOKEN (in .env, or set by GitHub Actions)
//
// With BACKUP_PASSWORD set, the file is encrypted (semanggi.db.enc) and the plain copy deleted. The daily
// GitHub Actions backup does this, because files kept by a public repository's Actions can be downloaded
// by others. Open one with: npm run backup:open -- backups/<date>/semanggi.db.enc
//
// To put a backup back on the live site (this replaces everything there):
//   DATA_DIR=backups/<date> npm run copy-to-turso -- --replace
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

// Values pasted into GitHub secrets sometimes carry a space, line break or quotes; drop them.
for (const k of ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "BACKUP_PASSWORD"]) {
  if (process.env[k]) process.env[k] = process.env[k].trim().replace(/^(["'])(.*)\1$/, "$2");
}
if (!process.env.TURSO_DATABASE_URL) {
  console.error("TURSO_DATABASE_URL isn't set. Put it and TURSO_AUTH_TOKEN in the .env file (see .env.example).");
  process.exit(1);
}
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(ROOT, "backups", new Date().toISOString().slice(0, 10));
const file = path.join(dir, "semanggi.db");
fs.mkdirSync(dir, { recursive: true });
for (const f of [file, file + "-wal", file + "-shm", file + ".enc"]) fs.rmSync(f, { force: true });

// db.js reads DATA_DIR when it loads, so set it first: the copy is written into the backup folder.
process.env.DATA_DIR = dir;
const { connect, setupSchema } = await import("../db.js");
const remote = connect();
const local = connect({ local: true });
await setupSchema(local);

const SKIP = new Set(["sessions", "rate_limits", "password_resets"]);
const names = (await remote.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")).map((r) => r.name).filter((n) => !SKIP.has(n));
// Accounts and orders first: other tables point at them.
const tables = ["users", "orders"].filter((n) => names.includes(n)).concat(names.filter((n) => n !== "users" && n !== "orders"));
let total = 0;
for (const table of tables) {
  const cols = (await remote.all(`PRAGMA table_info(${table})`)).map((c) => c.name);
  const rows = await remote.all(`SELECT ${cols.join(", ")} FROM ${table}`);
  await local.run(`DELETE FROM ${table}`); // setupSchema may have added starting content
  const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`;
  for (let i = 0; i < rows.length; i += 200) await local.batch(rows.slice(i, i + 200).map((r) => [sql, ...cols.map((c) => r[c])]));
  console.log(`${table}: ${rows.length} row(s)`);
  total += rows.length;
}
// One self-contained file, without a separate -wal file next to it.
await local.run("PRAGMA journal_mode = DELETE");
local.close();
remote.close();

const password = process.env.BACKUP_PASSWORD;
if (password) {
  // AES-256-GCM with a key made from the password (scrypt). Layout: "KSB1" | salt 16 | iv 12 | tag 16 | data.
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(password, salt, 32);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(fs.readFileSync(file)), cipher.final()]);
  fs.writeFileSync(file + ".enc", Buffer.concat([Buffer.from("KSB1"), salt, iv, cipher.getAuthTag(), data]));
  // On Windows the database file can stay locked for a moment after closing.
  try { fs.rmSync(file, { maxRetries: 10, retryDelay: 300 }); }
  catch { console.warn(`Couldn't delete the unencrypted copy ${path.relative(ROOT, file)}; delete it yourself.`); }
  console.log(`Saved ${total} rows, encrypted, to ${path.relative(ROOT, file + ".enc")}`);
} else {
  console.log(`Saved ${total} rows to ${path.relative(ROOT, file)}`);
}
