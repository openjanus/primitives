/**
 * bsgs.ts — Baby-step Giant-step discrete log solver for BabyJubjub
 *
 * Solves: find v in [0, 2^BITS) such that v * G = P
 *
 * Algorithm (BSGS):
 *   m = ceil(sqrt(2^BITS)) = 2^(BITS/2)
 *   Baby steps: precompute table[j] = j*G for j in [0, m)
 *   Giant steps: for i in [0, m): test P - i*(m*G), look up in table
 *   Solution: v = i*m + j
 *
 * Two modes:
 *   MEMORY (default, BITS=32): ~268M entries in a Uint32Array hash table.
 *     Fast lookup <1ms. Build time ~30s. Memory ~500MB.
 *     Too large for BITS=48 in RAM.
 *
 *   DISK (production, BITS=48): build once, cache to binary file.
 *     Table has 2^24 = 16.7M entries (each: 32B key + 4B index = 36B → ~600MB).
 *     Alternative with BITS=32 on disk: 2^16 = 65536 entries, tiny.
 *
 * Default for this package: BITS=32 in-memory. Covers values up to ~4 billion.
 * For financial use (e.g., USDC with 6 decimals), 2^32 = 4,294,967,296 units
 * = $4,294,967 maximum per recipient accumulation. Sufficient for most use cases.
 *
 * For BITS=48 (full spec), use buildBsgsTable(48) + disk cache via precompute.ts.
 *
 * Memory layout for in-memory hash table (open addressing, load factor 0.5):
 *   Slot: [key_lo32: u32, key_hi32: u32, value_lo32: u32, value_hi32: u32] = 16 bytes
 *   For m=2^16: 65536 entries * 16 bytes = 1MB (trivial)
 *   For m=2^24: 16M entries * 16 bytes = 256MB (feasible)
 *
 * For the default BITS=32: m=2^16=65536, table has 65536 entries, ~1MB. Fast.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import type { BabyJub } from "./babyjub.js";
import type { BsgsInfo, Point } from "./types.js";

// ─── Configuration ────────────────────────────────────────────────────────────

/** Default BSGS range: 2^32 covers up to ~4 billion (suitable for token amounts). */
export const DEFAULT_BITS = 32;

/** For testing, use a smaller range. */
export const TEST_BITS = 20;

// ─── In-memory table state ─────────────────────────────────────────────────

interface TableState {
  table: Map<string, bigint>;
  mG: [unknown, unknown]; // BabyJub Fr elements
  M: bigint;
  bits: number;
  buildTimeMs: number;
  babyjub: BabyJub;
}

let _state: TableState | null = null;

// ─── Core helpers ──────────────────────────────────────────────────────────

function pointKey(Fr: BabyJub["F"], p: unknown[]): string {
  // Use x-coordinate as map key (truncated to 32 hex chars for speed)
  return (Fr.toObject(p[0]) as bigint).toString(16);
}

/**
 * Build baby-steps table for BITS in [16, 40].
 * For BITS > 32 this will require significant memory — consider disk mode.
 *
 * @param babyjub  BabyJub instance
 * @param bits     Range 2^bits (default: DEFAULT_BITS=32)
 */
export function buildTable(babyjub: BabyJub, bits: number = DEFAULT_BITS): TableState {
  const HALF = bits >>> 1;
  const M = 1n << BigInt(HALF);
  const Fr = babyjub.F;

  const start = Date.now();
  const table = new Map<string, bigint>();

  // Baby steps: j = 0..M-1, store j*G -> j
  let point: unknown[] = [Fr.e(0n), Fr.e(1n)]; // identity

  for (let j = 0n; j < M; j++) {
    const key = pointKey(Fr, point);
    table.set(key, j);
    point = babyjub.addPoint(point, babyjub.Base8);
  }

  const mG = babyjub.mulPointEscalar(babyjub.Base8, M);
  const buildTimeMs = Date.now() - start;

  return {
    table,
    mG: mG as [unknown, unknown],
    M,
    bits,
    buildTimeMs,
    babyjub,
  };
}

/**
 * Initialize the global BSGS table (lazy, built once per process).
 *
 * @param babyjub  BabyJub instance
 * @param bits     BSGS range bits (default DEFAULT_BITS)
 * @param force    Force rebuild even if already initialized
 */
export function initTable(
  babyjub: BabyJub,
  bits: number = DEFAULT_BITS,
  force = false
): void {
  if (_state && _state.babyjub === babyjub && _state.bits === bits && !force) return;
  _state = buildTable(babyjub, bits);
}

/**
 * Solve: find v in [0, 2^bits) such that v*G = targetPoint.
 *
 * @param babyjub      BabyJub instance
 * @param targetPoint  Point in bigint form [x, y]
 * @param bits         Range bits (default DEFAULT_BITS). Must match initialized table.
 * @returns v as bigint
 * @throws if v not found in range (value > 2^bits or invalid point)
 */
export function solveDL(
  babyjub: BabyJub,
  targetPoint: Point,
  bits: number = DEFAULT_BITS
): bigint {
  initTable(babyjub, bits);
  const state = _state!;

  if (state.bits !== bits) {
    throw new Error(`BSGS: table built for ${state.bits} bits but solving for ${bits}`);
  }

  const Fr = babyjub.F;
  const neg_mG = [Fr.neg(state.mG[0]), state.mG[1]];

  // Convert target to Fr elements
  let current: unknown[] = [Fr.e(targetPoint[0]), Fr.e(targetPoint[1])];

  for (let i = 0n; i < state.M; i++) {
    const key = pointKey(Fr, current);
    if (state.table.has(key)) {
      const j = state.table.get(key)!;
      return i * state.M + j;
    }
    // Giant step: subtract M*G
    current = babyjub.addPoint(current, neg_mG);
  }

  throw new Error(
    `[BSGS] Discrete log not found in [0, 2^${bits}). ` +
    `Value exceeds range or point is not on curve.`
  );
}

/**
 * Warm up the BSGS table and return metadata.
 * Call this at application startup to avoid first-decrypt latency.
 *
 * @param babyjub BabyJub instance
 * @param bits    Range bits (default DEFAULT_BITS)
 * @returns BsgsInfo with size and build timing
 */
export function warmup(babyjub: BabyJub, bits: number = DEFAULT_BITS): BsgsInfo {
  initTable(babyjub, bits);
  const state = _state!;
  return {
    M: state.M,
    bits: state.bits,
    buildTimeMs: state.buildTimeMs,
    entries: Number(state.M),
    mode: "memory",
  };
}

// ─── Disk-cached table (production 2^48) ─────────────────────────────────

/**
 * Save BSGS baby-steps to disk as a binary file for reuse across processes.
 *
 * Format:
 *   Header: 16 bytes
 *     [0..3]   magic: 0x42534753 ("BSGS")
 *     [4..7]   bits: uint32
 *     [8..15]  entries: uint64
 *   Data: entries * (key_bytes + 8) bytes
 *     key: 32 bytes (x-coordinate, big-endian)
 *     value: 8 bytes uint64 (baby-step index j)
 *
 * @param state  Table state from buildTable()
 * @param path   Output file path
 */
export function saveTableToDisk(state: TableState, path: string): void {
  const entries = Number(state.M);
  // Header: 16 bytes. Each entry: 32 + 8 = 40 bytes.
  const buf = Buffer.allocUnsafe(16 + entries * 40);

  // Header
  buf.writeUInt32BE(0x42534753, 0); // "BSGS"
  buf.writeUInt32BE(state.bits, 4);
  buf.writeBigUInt64BE(BigInt(entries), 8);

  let offset = 16;
  for (const [keyHex, j] of state.table.entries()) {
    // key: 32 bytes (pad hex to 64 chars for fixed-width binary storage)
    const keyPadded = keyHex.padStart(64, "0");
    Buffer.from(keyPadded, "hex").copy(buf, offset, 0, 32);
    offset += 32;
    // value: 8 bytes
    buf.writeBigUInt64BE(j, offset);
    offset += 8;
  }


  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, buf);
}

/**
 * Load BSGS table from disk.
 *
 * @param path    Path to .bin file saved by saveTableToDisk()
 * @param babyjub BabyJub instance
 * @returns TableState ready for solveDL
 */
export function loadTableFromDisk(path: string, babyjub: BabyJub): TableState {
  if (!existsSync(path)) {
    throw new Error(`BSGS: table file not found at ${path}. Run precompute-bsgs first.`);
  }

  const buf = readFileSync(path);
  const magic = buf.readUInt32BE(0);
  if (magic !== 0x42534753) throw new Error("BSGS: invalid table file (bad magic)");

  const bits = buf.readUInt32BE(4);
  const entries = Number(buf.readBigUInt64BE(8));
  const M = 1n << BigInt(bits >>> 1);

  const table = new Map<string, bigint>();
  let offset = 16;

  for (let i = 0; i < entries; i++) {
    // Load 32-byte key and strip leading zeros to match in-memory format
    // (pointKey uses bigint.toString(16) which is variable-length)
    const keyHexPadded = buf.subarray(offset, offset + 32).toString("hex");
    const keyHex = BigInt("0x" + keyHexPadded).toString(16); // strips leading zeros
    offset += 32;
    const j = buf.readBigUInt64BE(offset);
    offset += 8;
    table.set(keyHex, j);
  }

  const mG = babyjub.mulPointEscalar(babyjub.Base8, M);

  return {
    table,
    mG: mG as [unknown, unknown],
    M,
    bits,
    buildTimeMs: 0,
    babyjub,
  };
}

/**
 * Initialize BSGS from a disk-cached table file.
 * Falls back to in-memory build if file not found.
 *
 * @param babyjub   BabyJub instance
 * @param tablePath Path to precomputed table file
 * @param bits      Fallback range if file not found
 */
export function initFromDisk(
  babyjub: BabyJub,
  tablePath: string,
  bits: number = DEFAULT_BITS
): BsgsInfo {
  if (existsSync(tablePath)) {
    const start = Date.now();
    _state = loadTableFromDisk(tablePath, babyjub);
    const loadTime = Date.now() - start;
    return {
      M: _state.M,
      bits: _state.bits,
      buildTimeMs: loadTime,
      entries: Number(_state.M),
      mode: "disk",
    };
  } else {
    // Fall back to in-memory build
    console.warn(
      `[BSGS] Table file not found at ${tablePath}. Building in memory (bits=${bits}).`
    );
    return warmup(babyjub, bits);
  }
}

export { DEFAULT_BITS as BSGS_BITS };
