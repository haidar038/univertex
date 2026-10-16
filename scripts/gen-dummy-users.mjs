#!/usr/bin/env node
/**
 * Generator CSV user dummy untuk uji import staging (P-C).
 *
 * Usage:
 *   node scripts/gen-dummy-users.mjs --count=100 --out=backups/dummy100.csv
 *   node scripts/gen-dummy-users.mjs --count=10 --prefix=uji --start=1
 *
 * Kolom: full_name,student_id,email,password,roles
 * (class_name dikosongkan — pakai dropdown override kelas di UI import.)
 * Password seragam memenuhi syarat min 8 karakter. GANTI password bila
 * file ini dipakai di luar staging.
 */
import { writeFileSync } from "node:fs";

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, ...v] = a.slice(2).split("=");
      return [k, v.length ? v.join("=") : true];
    })
);

const count = Math.min(parseInt(args.count || "100", 10) || 100, 1000);
const prefix = String(args.prefix || "dummy");
const start = parseInt(args.start || "1", 10) || 1;
const out = String(args.out || `backups/${prefix}${count}.csv`);
const password = String(args.password || "Password123");

if (password.length < 8) {
  console.error("[dummy] ERROR: password minimal 8 karakter.");
  process.exit(1);
}

const pad = String(start + count - 1).length;
const lines = ["full_name,student_id,email,password,roles"];
for (let i = 0; i < count; i++) {
  const n = start + i;
  const id = String(n).padStart(pad, "0");
  lines.push(
    `Dummy ${prefix} ${id},${prefix.toUpperCase()}${id},${prefix}${id}@test.local,${password},voter`
  );
}

writeFileSync(out, lines.join("\n") + "\n");
console.log(`[dummy] OK: ${count} baris -> ${out}`);
