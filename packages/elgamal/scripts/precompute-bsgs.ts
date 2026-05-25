#!/usr/bin/env tsx
/**
 * precompute-bsgs.ts — Build and cache BSGS discrete log table to disk.
 *
 * Usage:
 *   npx tsx scripts/precompute-bsgs.ts [--bits=32] [--out=precompute/bsgs_table.bin]
 *
 * Defaults:
 *   bits = 32  (covers [0, 2^32) = up to 4,294,967,295)
 *   out  = packages/elgamal/precompute/bsgs_table.bin
 *
 * For 2^48 (full production spec):
 *   npx tsx scripts/precompute-bsgs.ts --bits=48 --out=precompute/bsgs_table_48.bin
 *
 * WARNING: bits=48 requires ~600MB disk and 16.7M table entries.
 *          Build time: ~30 minutes. RAM usage: ~1GB during build.
 *          bits=32 is recommended as default (1MB disk, <1s build).
 */

import { buildTable, saveTableToDisk } from "../src/bsgs.js";
import { getBabyJub } from "../src/babyjub.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync, statSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "..");

// ─── Parse CLI args ───────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  let bits = 32;
  let out = join(PACKAGE_ROOT, "precompute", "bsgs_table.bin");

  for (const arg of args) {
    if (arg.startsWith("--bits=")) bits = parseInt(arg.slice(7), 10);
    if (arg.startsWith("--out=")) out = arg.slice(6);
  }
  return { bits, out };
}

async function main() {
  const { bits, out } = parseArgs();

  const M = 1n << BigInt(bits >>> 1);
  const estimatedMB = Number(M) * 40 / 1_000_000;

  console.log(`[precompute-bsgs] Configuration:`);
  console.log(`  Range: [0, 2^${bits}) = [0, ${(1n << BigInt(bits)).toLocaleString()})`);
  console.log(`  Baby-step count: M = 2^${bits / 2} = ${M.toLocaleString()}`);
  console.log(`  Estimated disk size: ~${estimatedMB.toFixed(1)} MB`);
  console.log(`  Output: ${out}`);
  console.log();

  if (bits > 40) {
    console.warn(`  WARNING: bits=${bits} will use significant RAM (~${(estimatedMB * 2).toFixed(0)}MB) and take a long time.`);
    console.warn(`  For bits=48: ~600MB disk, ~1GB RAM, ~30 min build.`);
  }

  console.log(`[precompute-bsgs] Initializing BabyJubjub...`);
  const babyjub = await getBabyJub();

  console.log(`[precompute-bsgs] Building baby-steps table (${M.toLocaleString()} entries)...`);
  const t0 = Date.now();

  const state = buildTable(babyjub, bits);
  const buildMs = Date.now() - t0;

  console.log(`[precompute-bsgs] Table built in ${buildMs}ms (${(buildMs/1000).toFixed(1)}s)`);
  console.log(`[precompute-bsgs] Saving to ${out}...`);

  mkdirSync(dirname(out), { recursive: true });
  const t1 = Date.now();
  saveTableToDisk(state, out);
  const saveMs = Date.now() - t1;

  const stats = statSync(out);
  const sizeMB = stats.size / 1_000_000;

  console.log(`[precompute-bsgs] Saved in ${saveMs}ms`);
  console.log(`[precompute-bsgs] File size: ${sizeMB.toFixed(2)} MB`);
  console.log();
  console.log(`[precompute-bsgs] DONE. Use with:`);
  console.log(`  import { initFromDisk } from "@openjanus/elgamal";`);
  console.log(`  await initFromDisk(babyjub, "${out}", ${bits});`);
}

main().catch((err) => {
  console.error("[precompute-bsgs] Error:", err.message);
  process.exit(1);
});
