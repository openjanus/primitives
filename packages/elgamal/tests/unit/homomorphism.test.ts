/**
 * homomorphism.test.ts — Unit tests for homomorphic operations
 */

import { describe, it, expect, beforeAll } from "vitest";
import { encrypt, randomScalar } from "../../src/encrypt.js";
import { decrypt } from "../../src/decrypt.js";
import { add, negate, scalarMul, sum } from "../../src/homomorphic.js";
import { deriveFromFlowKey } from "../../src/keypair.js";
import { warmup } from "../../src/bsgs.js";
import { getBabyJub } from "../../src/babyjub.js";
import { TEST_BITS } from "../../src/bsgs.js";
import type { Keypair } from "../../src/types.js";

let kp: Keypair;

beforeAll(async () => {
  kp = await deriveFromFlowKey(
    Buffer.from("test-flow-signing-key-deterministic-32b", "utf8")
  );
  const babyjub = await getBabyJub();
  warmup(babyjub, TEST_BITS);
}, 30_000);

describe("add", () => {
  it("E(a) + E(b) = E(a+b)", async () => {
    const r1 = await randomScalar();
    const r2 = await randomScalar();
    const ct1 = await encrypt(10n, r1, kp.pubkey);
    const ct2 = await encrypt(25n, r2, kp.pubkey);
    const ctSum = await add(ct1, ct2);
    expect(await decrypt(ctSum, kp.privkey, TEST_BITS)).toBe(35n);
  });

  it("E(0) + E(0) = E(0)", async () => {
    const r1 = await randomScalar();
    const r2 = await randomScalar();
    const ct1 = await encrypt(0n, r1, kp.pubkey);
    const ct2 = await encrypt(0n, r2, kp.pubkey);
    const ctSum = await add(ct1, ct2);
    expect(await decrypt(ctSum, kp.privkey, TEST_BITS)).toBe(0n);
  });

  it("E(v) + E(0) = E(v)", async () => {
    const r1 = await randomScalar();
    const r2 = await randomScalar();
    const ct1 = await encrypt(42n, r1, kp.pubkey);
    const ct2 = await encrypt(0n, r2, kp.pubkey);
    const ctSum = await add(ct1, ct2);
    expect(await decrypt(ctSum, kp.privkey, TEST_BITS)).toBe(42n);
  });

  it("THE CRITICAL 42 TEST: Alice(10) + Carol(25) + Dave(7) = 42", async () => {
    const r_alice = await randomScalar();
    const r_carol = await randomScalar();
    const r_dave = await randomScalar();

    const e_alice = await encrypt(10n, r_alice, kp.pubkey);
    const e_carol = await encrypt(25n, r_carol, kp.pubkey);
    const e_dave = await encrypt(7n, r_dave, kp.pubkey);

    const acc = await add(await add(e_alice, e_carol), e_dave);
    expect(await decrypt(acc, kp.privkey, TEST_BITS)).toBe(42n);

    // Privacy: accumulated ciphertext is different from individual ciphertexts
    expect(acc.C1[0]).not.toBe(e_alice.C1[0]);
    expect(acc.C1[0]).not.toBe(e_carol.C1[0]);
    expect(acc.C1[0]).not.toBe(e_dave.C1[0]);
  });

  it("accumulates multiple values correctly: [100, 250, 7]", async () => {
    const amounts = [100n, 250n, 7n];
    const ciphertexts = await Promise.all(
      amounts.map(async (v) => encrypt(v, await randomScalar(), kp.pubkey))
    );
    const acc = await add(await add(ciphertexts[0], ciphertexts[1]), ciphertexts[2]);
    expect(await decrypt(acc, kp.privkey, TEST_BITS)).toBe(357n);
  });

  it("[333, 444, 123] = 900", async () => {
    const amounts = [333n, 444n, 123n];
    const ciphertexts = await Promise.all(
      amounts.map(async (v) => encrypt(v, await randomScalar(), kp.pubkey))
    );
    const acc = await add(await add(ciphertexts[0], ciphertexts[1]), ciphertexts[2]);
    expect(await decrypt(acc, kp.privkey, TEST_BITS)).toBe(900n);
  });

  it("add is commutative: E(a)+E(b) = E(b)+E(a)", async () => {
    const r1 = await randomScalar();
    const r2 = await randomScalar();
    const ct1 = await encrypt(13n, r1, kp.pubkey);
    const ct2 = await encrypt(29n, r2, kp.pubkey);
    const ab = await add(ct1, ct2);
    const ba = await add(ct2, ct1);
    expect(await decrypt(ab, kp.privkey, TEST_BITS)).toBe(42n);
    expect(await decrypt(ba, kp.privkey, TEST_BITS)).toBe(42n);
  });
});

describe("negate", () => {
  it("E(v) + negate(E(v)) = E(0)", async () => {
    for (const v of [1n, 42n, 1000n]) {
      const r = await randomScalar();
      const ct = await encrypt(v, r, kp.pubkey);
      const neg = await negate(ct);
      const ctSum = await add(ct, neg);
      expect(await decrypt(ctSum, kp.privkey, TEST_BITS)).toBe(0n);
    }
  });

  it("negate(negate(ct)) = ct (double negation)", async () => {
    const r = await randomScalar();
    const ct = await encrypt(42n, r, kp.pubkey);
    const neg = await negate(ct);
    const negNeg = await negate(neg);
    expect(negNeg.C1[0]).toBe(ct.C1[0]);
    expect(negNeg.C1[1]).toBe(ct.C1[1]);
    expect(negNeg.C2[0]).toBe(ct.C2[0]);
    expect(negNeg.C2[1]).toBe(ct.C2[1]);
  });
});

describe("scalarMul", () => {
  it("scalarMul(E(v), 1) = E(v)", async () => {
    const r = await randomScalar();
    const ct = await encrypt(7n, r, kp.pubkey);
    const scaled = await scalarMul(ct, 1n);
    expect(await decrypt(scaled, kp.privkey, TEST_BITS)).toBe(7n);
  });

  it("scalarMul(E(v), 2) = E(2v)", async () => {
    const r = await randomScalar();
    const ct = await encrypt(21n, r, kp.pubkey);
    const scaled = await scalarMul(ct, 2n);
    expect(await decrypt(scaled, kp.privkey, TEST_BITS)).toBe(42n);
  });

  it("scalarMul(E(v), 0) = E(0)", async () => {
    const r = await randomScalar();
    const ct = await encrypt(100n, r, kp.pubkey);
    const scaled = await scalarMul(ct, 0n);
    // Identity ciphertext (0,1), (0,1) decrypts to 0
    expect(await decrypt(scaled, kp.privkey, TEST_BITS)).toBe(0n);
  });

  it("scalarMul(E(v), 3) = E(3v)", async () => {
    const r = await randomScalar();
    const ct = await encrypt(14n, r, kp.pubkey);
    const scaled = await scalarMul(ct, 3n);
    expect(await decrypt(scaled, kp.privkey, TEST_BITS)).toBe(42n);
  });

  it("throws for negative k", async () => {
    const r = await randomScalar();
    const ct = await encrypt(1n, r, kp.pubkey);
    await expect(scalarMul(ct, -1n)).rejects.toThrow(RangeError);
  });
});

describe("sum", () => {
  it("sums an array of ciphertexts", async () => {
    const amounts = [10n, 25n, 7n];
    const ciphertexts = await Promise.all(
      amounts.map(async (v) => encrypt(v, await randomScalar(), kp.pubkey))
    );
    const total = await sum(ciphertexts);
    expect(await decrypt(total, kp.privkey, TEST_BITS)).toBe(42n);
  });

  it("single-element sum equals original", async () => {
    const r = await randomScalar();
    const ct = await encrypt(99n, r, kp.pubkey);
    const result = await sum([ct]);
    expect(await decrypt(result, kp.privkey, TEST_BITS)).toBe(99n);
  });

  it("throws for empty array", async () => {
    await expect(sum([])).rejects.toThrow();
  });
});
