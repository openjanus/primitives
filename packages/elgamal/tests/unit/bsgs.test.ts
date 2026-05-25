/**
 * bsgs.test.ts — Unit tests for BSGS discrete log solver
 */

import { describe, it, expect, beforeAll } from "vitest";
import { getBabyJub } from "../../src/babyjub.js";
import {
  buildTable,
  solveDL,
  warmup,
  saveTableToDisk,
  loadTableFromDisk,
  TEST_BITS,
} from "../../src/bsgs.js";
import type { BabyJub } from "../../src/babyjub.js";
import type { Point } from "../../src/types.js";
import { tmpdir } from "os";
import { join } from "path";
import { unlinkSync, existsSync } from "fs";

let babyjub: BabyJub;

beforeAll(async () => {
  babyjub = await getBabyJub();
  warmup(babyjub, TEST_BITS);
}, 30_000);

function scalarToPoint(babyjub: BabyJub, v: bigint): Point {
  const Fr = babyjub.F;
  if (v === 0n) return [0n, 1n]; // identity
  const p = babyjub.mulPointEscalar(babyjub.Base8, v);
  return [Fr.toObject(p[0]) as bigint, Fr.toObject(p[1]) as bigint];
}

describe("solveDL", () => {
  it("solves v=0 (identity point)", () => {
    const vG = scalarToPoint(babyjub, 0n);
    expect(solveDL(babyjub, vG, TEST_BITS)).toBe(0n);
  });

  it("solves v=1", () => {
    const vG = scalarToPoint(babyjub, 1n);
    expect(solveDL(babyjub, vG, TEST_BITS)).toBe(1n);
  });

  it("solves v=42", () => {
    const vG = scalarToPoint(babyjub, 42n);
    expect(solveDL(babyjub, vG, TEST_BITS)).toBe(42n);
  });

  it("solves v=1023 (= M-1 for BITS=20)", () => {
    const vG = scalarToPoint(babyjub, 1023n);
    expect(solveDL(babyjub, vG, TEST_BITS)).toBe(1023n);
  });

  it("solves v=1024 (= M for BITS=20, boundary)", () => {
    const vG = scalarToPoint(babyjub, 1024n);
    expect(solveDL(babyjub, vG, TEST_BITS)).toBe(1024n);
  });

  it("solves v=65535", () => {
    const vG = scalarToPoint(babyjub, 65535n);
    expect(solveDL(babyjub, vG, TEST_BITS)).toBe(65535n);
  });

  it("solves v = 2^20 - 1 (max in test range)", () => {
    const maxVal = (1n << BigInt(TEST_BITS)) - 1n;
    const vG = scalarToPoint(babyjub, maxVal);
    expect(solveDL(babyjub, vG, TEST_BITS)).toBe(maxVal);
  });

  it("throws for value at 2^20 (outside range)", () => {
    const overRange = scalarToPoint(babyjub, 1n << BigInt(TEST_BITS));
    expect(() => solveDL(babyjub, overRange, TEST_BITS)).toThrow(/BSGS|Discrete log not found/);
  });
});

describe("warmup", () => {
  it("returns BsgsInfo", () => {
    const info = warmup(babyjub, TEST_BITS);
    expect(info.bits).toBe(TEST_BITS);
    expect(info.M).toBe(1n << BigInt(TEST_BITS / 2));
    expect(typeof info.buildTimeMs).toBe("number");
    expect(info.entries).toBeGreaterThan(0);
    expect(info.mode).toBe("memory");
  });
});

describe("disk table roundtrip", () => {
  const tablePath = join(tmpdir(), `bsgs_test_${process.pid}.bin`);

  it("saves and loads table, metadata is correct", () => {
    const state = buildTable(babyjub, TEST_BITS);
    saveTableToDisk(state, tablePath);

    expect(existsSync(tablePath)).toBe(true);

    const loaded = loadTableFromDisk(tablePath, babyjub);
    expect(loaded.bits).toBe(TEST_BITS);
    expect(loaded.M).toBe(state.M);
    // Table has the same number of entries
    expect(loaded.table.size).toBe(state.table.size);
  });

  it("loaded table solves DL correctly via solveDL override", () => {
    // Load table into a state object and use its .table + .mG to resolve DL
    const loaded = loadTableFromDisk(tablePath, babyjub);
    const Fr = babyjub.F;
    const neg_mG = [Fr.neg(loaded.mG[0]), loaded.mG[1]];

    // Manually run BSGS with the loaded table for v=42
    const target = babyjub.mulPointEscalar(babyjub.Base8, 42n);
    let current: unknown[] = [target[0], target[1]];

    let found: bigint | undefined;
    for (let i = 0n; i < loaded.M; i++) {
      const key = (Fr.toObject(current[0]) as bigint).toString(16);
      if (loaded.table.has(key)) {
        const j = loaded.table.get(key)!;
        found = i * loaded.M + j;
        break;
      }
      current = babyjub.addPoint(current, neg_mG);
    }

    expect(found).toBe(42n);

    // Cleanup
    if (existsSync(tablePath)) unlinkSync(tablePath);
  });
});
