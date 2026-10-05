// Decrypts a backup made with BACKUP_PASSWORD (see scripts/backup.js), next to the encrypted file:
//   npm run backup:open -- backups/2026-10-05/semanggi.db.enc
// The password is read from BACKUP_PASSWORD (put it in .env).
import fs from "node:fs";
import crypto from "node:crypto";

const src = process.argv[2];
// Trimmed the same way as when the backup was made.
const password = process.env.BACKUP_PASSWORD?.trim().replace(/^(["'])(.*)$/, "$2");
if (!src || !src.endsWith(".enc")) { console.error("Give the .enc file: npm run backup:open -- backups/<date>/semanggi.db.enc"); process.exit(1); }
if (!password) { console.error("BACKUP_PASSWORD isn't set. Put it in the .env file."); process.exit(1); }
const buf = fs.readFileSync(src);
if (buf.subarray(0, 4).toString() !== "KSB1") { console.error("That isn't a Kampoeng Semanggi backup file."); process.exit(1); }
const salt = buf.subarray(4, 20), iv = buf.subarray(20, 32), tag = buf.subarray(32, 48);
const decipher = crypto.createDecipheriv("aes-256-gcm", crypto.scryptSync(password, salt, 32), iv);
decipher.setAuthTag(tag);
let data;
try { data = Buffer.concat([decipher.update(buf.subarray(48)), decipher.final()]); }
catch { console.error("Wrong password, or the file is damaged."); process.exit(1); }
const out = src.slice(0, -4);
fs.writeFileSync(out, data);
console.log(`Opened: ${out}`);
