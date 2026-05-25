/**
 * poseidon.test.ts — Canonical Poseidon implementation check.
 *
 * CRITICAL: This test validates the canonical Poseidon hash.
 * If Poseidon([0, 0]) does not equal the expected value, something is broken.
 * See vuln #012 — hand-written Yul Poseidon produced wrong hashes.
 */

import { describe, it, expect } from "vitest";
import {
  poseidon2,
  poseidon3,
  assertCanonicalPoseidon,
  POSEIDON_CANONICAL_HASH_0_0,
} from "../../src/poseidon.js";

describe("canonical Poseidon check (vuln #012)", () => {
  it("Poseidon([0, 0]) equals the canonical BN254 value", async () => {
    const result = await poseidon2(0n, 0n);
    // Canonical value from circomlibjs reference: 0x2098f5fb9e239eab...
    expect(result).toBe(POSEIDON_CANONICAL_HASH_0_0);
    expect(result.toString(16)).toMatch(/^2098f5/);
  });

  it("assertCanonicalPoseidon() does not throw", async () => {
    await expect(assertCanonicalPoseidon()).resolves.toBeUndefined();
  });

  it("Poseidon([0, 0]) matches the exact reference value", async () => {
    const result = await poseidon2(0n, 0n);
    // Full canonical value for cross-implementation compatibility
    expect(result).toBe(0x2098f5fb9e239eab3ceac3f27b81e481dc3124d55ffed523a839ee8446b64864n);
  });
});

describe("poseidon2 — 2-input hash properties", () => {
  it("produces a bigint in the BN254 field", async () => {
    const BN254_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
    const result = await poseidon2(1n, 2n);
    expect(typeof result).toBe("bigint");
    expect(result).toBeGreaterThan(0n);
    expect(result).toBeLessThan(BN254_PRIME);
  });

  it("is deterministic (same inputs produce same output)", async () => {
    const a = 12345n;
    const b = 67890n;
    const r1 = await poseidon2(a, b);
    const r2 = await poseidon2(a, b);
    expect(r1).toBe(r2);
  });

  it("is not symmetric (Poseidon(a,b) != Poseidon(b,a) in general)", async () => {
    const a = 1n;
    const b = 2n;
    const ab = await poseidon2(a, b);
    const ba = await poseidon2(b, a);
    // With overwhelming probability these differ
    expect(ab).not.toBe(ba);
  });

  it("distinct inputs produce distinct outputs", async () => {
    const h1 = await poseidon2(1n, 0n);
    const h2 = await poseidon2(0n, 1n);
    const h3 = await poseidon2(1n, 1n);
    expect(new Set([h1, h2, h3]).size).toBe(3);
  });
});

describe("poseidon3 — 3-input hash properties", () => {
  it("produces a bigint in the BN254 field", async () => {
    const BN254_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
    const result = await poseidon3(1n, 2n, 3n);
    expect(typeof result).toBe("bigint");
    expect(result).toBeGreaterThan(0n);
    expect(result).toBeLessThan(BN254_PRIME);
  });

  it("is deterministic", async () => {
    const r1 = await poseidon3(10n, 20n, 30n);
    const r2 = await poseidon3(10n, 20n, 30n);
    expect(r1).toBe(r2);
  });

  it("is distinct from poseidon2 for same inputs", async () => {
    const p2 = await poseidon2(1n, 2n);
    const p3 = await poseidon3(1n, 2n, 0n);
    // Different arity uses different internal state — outputs should differ
    expect(p2).not.toBe(p3);
  });

  it("all three inputs affect the output", async () => {
    const base = await poseidon3(1n, 2n, 3n);
    const varyA = await poseidon3(9n, 2n, 3n);
    const varyB = await poseidon3(1n, 9n, 3n);
    const varyC = await poseidon3(1n, 2n, 9n);
    expect(base).not.toBe(varyA);
    expect(base).not.toBe(varyB);
    expect(base).not.toBe(varyC);
  });
});
