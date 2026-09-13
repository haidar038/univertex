#!/usr/bin/env node
/**
 * Pre-election DB snapshot.
 *
 * Run this script 1 hour before every election as part of the H-1 checklist
 * (see docs/RUNBOOK.md). Produces a single .sql file containing the public
 * schema + data, ready to be uploaded to a secure storage bucket for the
 * required retention period (30 days normal, 1 year for election-day
 * snapshots).
 *
 * Prerequisites:
 *   - supabase CLI installed and logged in (`supabase login`)
 *   - SUPABASE_PROJECT_REF env var OR pass --project=<ref>
 *   - the project must already be linked, OR the script will run an inline
 *     `supabase link` (you'll be prompted to enter the DB password)
 *
 * Usage:
 *   node scripts/snapshot-db.mjs                  # snapshot linked project
 *   node scripts/snapshot-db.mjs --tag=election   # custom tag in filename
 *   node scripts/snapshot-db.mjs --project=abc123 # specific project
 *
 * Output: ./backups/<project-ref>-<tag>-<timestamp>.sql
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const argMap = Object.fromEntries(
  args
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, ...v] = a.slice(2).split("=");
      return [k, v.length ? v.join("=") : true];
    })
);

const projectRef = argMap.project || process.env.SUPABASE_PROJECT_REF;
const tag = argMap.tag || "manual";
const ts = new Date().toISOString().replace(/[:.]/g, "-");

if (!projectRef) {
  console.error(
    "[snapshot] ERROR: SUPABASE_PROJECT_REF env var or --project=<ref> required."
  );
  process.exit(1);
}

const outDir = join(process.cwd(), "backups");
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const outFile = join(outDir, `${projectRef}-${tag}-${ts}.sql`);

console.log(`[snapshot] project : ${projectRef}`);
console.log(`[snapshot] tag     : ${tag}`);
console.log(`[snapshot] output  : ${outFile}`);

const result = spawnSync(
  "supabase",
  ["db", "dump", "--schema", "public", "-f", outFile, "--project-ref", projectRef],
  { stdio: "inherit" }
);

if (result.status !== 0) {
  console.error(`[snapshot] supabase db dump failed (exit ${result.status})`);
  process.exit(result.status ?? 1);
}

const stat = existsSync(outFile) ? `size: ${require("node:fs").statSync(outFile).size} bytes` : "missing";
console.log(`[snapshot] OK (${stat})`);
console.log(`[snapshot] NEXT: gzip the file and upload to your secure storage bucket.`);
console.log(`[snapshot]       See docs/RUNBOOK.md §1.3 for retention rules.`);
