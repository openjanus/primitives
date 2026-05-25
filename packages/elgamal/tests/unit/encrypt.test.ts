/**
 * encrypt.test.ts — Unit tests for encryption primitives
 */

import { describe, it, expect, beforeAll } from "vitest";
import { getBabyJub } from "../../src/babyjub.js";
import { encrypt, randomScalar, ciphertextToOnChain, ciphertextFromOnChain } from "../../src/encrypt.js";
import { generateKeypair } from "../../src/keypair.js";
import type { Ciphertext } from "../../src/types.js";

let pubkey: [bigint, bigint];

beforeAll(async () => {
  const kp = await generateKeypair();
  pubkey = kp.pubkey;
});

describe("encrypt", () => {
  it("returns two BabyJubjub points", async () => {
    const r = await randomScalar();
    const ct = await encrypt(1n, r, pubkey);
    expect(ct).toHaveProperty("C1");
    expect(ct).toHaveProperty("C2");
    expect(ct.C1).toHaveLength(2);
    expect(ct.C2).toHaveLength(2);
    expect(typeof ct.C1[0]).toBe("bigint");
    expect(typeof ct.C1[1]).toBe("bigint");
  });

  it("C1 = r*G (not identity for r > 0)", async () => {
    const r = await randomScalar();
    const ct = await encrypt(0n, r, pubkey);
    // C1 = r*G; r != 0 => C1 != identity (0,1)
    expect(ct.C1[0] !== 0n || ct.C1[1] !== 1n).toBe(true);
  });

  it("produces different ciphertexts for same value with different randomness", async () => {
    const r1 = await randomScalar();
    const r2 = await randomScalar();
    const ct1 = await encrypt(42n, r1, pubkey);
    const ct2 = await encrypt(42n, r2, pubkey);
    // With overwhelming probability r1 != r2 => C1 differs
    expect(ct1.C1[0]).not.toBe(ct2.C1[0]);
  });

  it("encrypts value=0", async () => {
    const r = await randomScalar();
    const ct = await encrypt(0n, r, pubkey);
    // C2 = 0*G + r*PK = r*PK (not identity)
    expect(ct.C2[0] !== 0n || ct.C2[1] !== 1n).toBe(true);
  });

  it("rejects value >= 2^48", async () => {
    const r = await randomScalar();
    await expect(encrypt(1n << 48n, r, pubkey)).rejects.toThrow(RangeError);
    await expect(encrypt(-1n, r, pubkey)).rejects.toThrow(RangeError);
  });

  it("produces field-valid coordinates (< BabyJubjub prime)", async () => {
    const babyjub = await getBabyJub();
    const PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
    const r = await randomScalar();
    const ct = await encrypt(12345n, r, pubkey);
    expect(ct.C1[0]).toBeLessThan(PRIME);
    expect(ct.C1[1]).toBeLessThan(PRIME);
    expect(ct.C2[0]).toBeLessThan(PRIME);
    expect(ct.C2[1]).toBeLessThan(PRIME);
  });
});

describe("randomScalar", () => {
  it("returns bigint in range [1, ORDER)", async () => {
    const babyjub = await getBabyJub();
    const ORDER: bigint = babyjub.subOrder;
    const r = await randomScalar();
    expect(r).toBeGreaterThan(0n);
    expect(r).toBeLessThan(ORDER);
  });

  it("produces different values each call", async () => {
    const r1 = await randomScalar();
    const r2 = await randomScalar();
    expect(r1).not.toBe(r2);
  });
});

describe("ciphertextToOnChain / ciphertextFromOnChain", () => {
  it("roundtrips correctly", async () => {
    const r = await randomScalar();
    const ct: Ciphertext = await encrypt(99n, r, pubkey);
    const onChain = ciphertextToOnChain(ct);
    const back = ciphertextFromOnChain(onChain);
    expect(back.C1[0]).toBe(ct.C1[0]);
    expect(back.C1[1]).toBe(ct.C1[1]);
    expect(back.C2[0]).toBe(ct.C2[0]);
    expect(back.C2[1]).toBe(ct.C2[1]);
  });

  it("on-chain coords are bigints", async () => {
    const r = await randomScalar();
    const ct = await encrypt(1n, r, pubkey);
    const onChain = ciphertextToOnChain(ct);
    expect(typeof onChain.C1x).toBe("bigint");
    expect(typeof onChain.C1y).toBe("bigint");
    expect(typeof onChain.C2x).toBe("bigint");
    expect(typeof onChain.C2y).toBe("bigint");
  });
});
