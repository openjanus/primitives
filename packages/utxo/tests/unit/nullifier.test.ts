/**
 * nullifier.test.ts — Nullifier hash determinism and correctness.
 */

import { describe, it, expect } from "vitest";
import { deriveNullifier, deriveNullifierFromNote, isNullifierSpent } from "../../src/nullifier.js";
import { createNoteFromSecrets, resolveNote } from "../../src/note.js";

describe("deriveNullifier", () => {
  it("is deterministic: same inputs produce same hash", async () => {
    const ns = 0x1a2b3cn;
    const idx = 5;
    const h1 = await deriveNullifier(ns, idx);
    const h2 = await deriveNullifier(ns, idx);
    expect(h1).toBe(h2);
  });

  it("changes with different nullifierSecret", async () => {
    const h1 = await deriveNullifier(1n, 0);
    const h2 = await deriveNullifier(2n, 0);
    expect(h1).not.toBe(h2);
  });

  it("changes with different leafIndex", async () => {
    const ns = 0xdeadbeefn;
    const h0 = await deriveNullifier(ns, 0);
    const h1 = await deriveNullifier(ns, 1);
    expect(h0).not.toBe(h1);
  });

  it("produces a valid BN254 field element", async () => {
    const BN254_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
    const h = await deriveNullifier(0x12345678n, 42);
    expect(typeof h).toBe("bigint");
    expect(h).toBeGreaterThan(0n);
    expect(h).toBeLessThan(BN254_PRIME);
  });

  it("rejects leafIndex out of [0, 255] range", async () => {
    await expect(deriveNullifier(1n, 256)).rejects.toThrow(RangeError);
    await expect(deriveNullifier(1n, -1)).rejects.toThrow(RangeError);
  });

  it("accepts boundary leafIndex 0 and 255", async () => {
    const h0 = await deriveNullifier(1n, 0);
    const h255 = await deriveNullifier(1n, 255);
    expect(h0).toBeGreaterThan(0n);
    expect(h255).toBeGreaterThan(0n);
    expect(h0).not.toBe(h255);
  });
});

describe("deriveNullifierFromNote", () => {
  it("matches manual deriveNullifier with same inputs", async () => {
    const ns = 0xabcdef123n;
    const note = await createNoteFromSecrets(10n, ns, 0x1n);
    const resolved = resolveNote(note, 3);
    const fromNote = await deriveNullifierFromNote(resolved);
    const direct = await deriveNullifier(ns, 3);
    expect(fromNote.nullifierHash).toBe(direct);
  });

  it("returns full NullifierInfo", async () => {
    const ns = 0x9999n;
    const note = await createNoteFromSecrets(5n, ns, 0x2n);
    const resolved = resolveNote(note, 7);
    const info = await deriveNullifierFromNote(resolved);
    expect(info.nullifierSecret).toBe(ns);
    expect(info.leafIndex).toBe(7);
    expect(info.nullifierHash).toBeGreaterThan(0n);
  });
});

describe("isNullifierSpent", () => {
  it("returns false for unknown nullifier", async () => {
    const h = await deriveNullifier(42n, 0);
    const spentSet: Set<bigint> = new Set();
    expect(isNullifierSpent(h, spentSet)).toBe(false);
  });

  it("returns true for known spent nullifier", async () => {
    const h = await deriveNullifier(42n, 0);
    const spentSet: Set<bigint> = new Set([h]);
    expect(isNullifierSpent(h, spentSet)).toBe(true);
  });

  it("only matches exact hash value", async () => {
    const h = await deriveNullifier(42n, 0);
    const spentSet: Set<bigint> = new Set([h + 1n]);
    expect(isNullifierSpent(h, spentSet)).toBe(false);
  });
});
