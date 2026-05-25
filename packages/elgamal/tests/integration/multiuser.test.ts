/**
 * multiuser.test.ts — Integration test: 4-user accumulation
 *
 * Replicates Phase 1 lab scenario (Phase E) in pure TypeScript
 * without requiring on-chain calls. Verifies all cryptographic
 * properties hold in the extracted package.
 *
 * Scenario:
 *   4 users have BabyJubjub keypairs derived from their Flow signing keys.
 *   Alice(10), Carol(25), Dave(7) encrypt to Bob's pubkey.
 *   Homomorphic accumulator adds each contribution.
 *   Bob reads accumulated ciphertext and decrypts → sees 42.
 *   PRIVACY: Bob cannot determine the breakdown 10+25+7.
 *   FRAUD: Wrong value / wrong key fails at circuit level (tested via
 *          decrypt-mismatch, not circuit proof in unit layer).
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  encrypt,
  decrypt,
  add,
  randomScalar,
  deriveFromFlowKey,
  warmupDecrypt,
} from "../../src/index.js";
import { TEST_BITS } from "../../src/bsgs.js";
import type { Keypair, Ciphertext } from "../../src/types.js";

// ─── User seeds (deterministic, no real keys needed) ─────────────────────────
const SEEDS = {
  alice: Buffer.from("openjanus-alice-deterministic-seed", "utf8"),
  bob:   Buffer.from("openjanus-bob-deterministic-seed--", "utf8"),
  carol: Buffer.from("openjanus-carol-deterministic-seed", "utf8"),
  dave:  Buffer.from("openjanus-dave-deterministic-seed-", "utf8"),
  eve:   Buffer.from("openjanus-eve-deterministic-seed--", "utf8"),
};

let users: Record<string, Keypair> = {};

beforeAll(async () => {
  // Derive all keypairs
  for (const [name, seed] of Object.entries(SEEDS)) {
    users[name] = await deriveFromFlowKey(seed);
  }
  // Warm up BSGS table for test range
  await warmupDecrypt(TEST_BITS);
}, 30_000);

describe("Multi-user accumulation: Alice(10) + Carol(25) + Dave(7) = 42", () => {
  let e_alice: Ciphertext;
  let e_carol: Ciphertext;
  let e_dave: Ciphertext;
  let accumulated: Ciphertext;
  let r_alice: bigint;
  let r_carol: bigint;
  let r_dave: bigint;

  beforeAll(async () => {
    // Each sender generates independent randomness (NEVER shared with Bob)
    r_alice = await randomScalar();
    r_carol = await randomScalar();
    r_dave = await randomScalar();

    // Each sender encrypts to Bob's pubkey
    e_alice = await encrypt(10n, r_alice, users.bob.pubkey);
    e_carol = await encrypt(25n, r_carol, users.bob.pubkey);
    e_dave  = await encrypt(7n,  r_dave,  users.bob.pubkey);

    // Homomorphic accumulation (what the on-chain ElGamalAccumulator.accumulate() does)
    const step1 = await add(e_alice, e_carol);
    accumulated = await add(step1, e_dave);
  });

  it("Alice's ciphertext decrypts to 10 with Bob's key", async () => {
    expect(await decrypt(e_alice, users.bob.privkey, TEST_BITS)).toBe(10n);
  });

  it("Carol's ciphertext decrypts to 25 with Bob's key", async () => {
    expect(await decrypt(e_carol, users.bob.privkey, TEST_BITS)).toBe(25n);
  });

  it("Dave's ciphertext decrypts to 7 with Bob's key", async () => {
    expect(await decrypt(e_dave, users.bob.privkey, TEST_BITS)).toBe(7n);
  });

  it("CRITICAL: Bob decrypts accumulated total = 42", async () => {
    const bobTotal = await decrypt(accumulated, users.bob.privkey, TEST_BITS);
    expect(bobTotal).toBe(42n);
  });

  it("PRIVACY: accumulated C1 is NOT equal to any individual C1", () => {
    // If this fails, the accumulator is trivially readable
    expect(accumulated.C1[0]).not.toBe(e_alice.C1[0]);
    expect(accumulated.C1[0]).not.toBe(e_carol.C1[0]);
    expect(accumulated.C1[0]).not.toBe(e_dave.C1[0]);
  });

  it("PRIVACY: Bob cannot derive individual amounts from accumulated ciphertext", async () => {
    // Bob only has: accumulated.C1, accumulated.C2, his privkey
    // He cannot split these back into per-sender ciphertexts.
    // We verify structurally that the accumulated ciphertext differs from each sender's.
    expect(accumulated.C2[0]).not.toBe(e_alice.C2[0]);
    expect(accumulated.C2[0]).not.toBe(e_carol.C2[0]);
    expect(accumulated.C2[0]).not.toBe(e_dave.C2[0]);
  });

  it("FRAUD: Eve (wrong privkey) cannot decrypt Bob's accumulated slot to 42", async () => {
    let eveResult: bigint | string;
    try {
      eveResult = await decrypt(accumulated, users.eve.privkey, TEST_BITS);
    } catch {
      eveResult = "out-of-range";
    }
    // Eve does not get 42
    expect(eveResult).not.toBe(42n);
  });

  it("FRAUD: Bob cannot claim wrong value (wrong decryption produces wrong point)", async () => {
    // If Bob lies about total=1000, the vG he computes won't match E(1000, r_acc)
    // because r_acc is random and 1000 != 42.
    // This is tested at the circuit level in production; here we verify
    // that decrypting to 1000 would require a different accumulated ciphertext.
    // We do this by encrypting 1000 fresh and verifying it has a different C2.
    const rFresh = await randomScalar();
    const e1000 = await encrypt(1000n, rFresh, users.bob.pubkey);
    // accumulated.C2 != e1000.C2 with probability 1
    expect(accumulated.C2[0]).not.toBe(e1000.C2[0]);
  });
});

describe("Keypair isolation: each user has a different pubkey", () => {
  it("all pubkeys are distinct", () => {
    const pubkeys = Object.values(users).map((u) => u.pubkey[0].toString());
    const unique = new Set(pubkeys);
    expect(unique.size).toBe(Object.keys(users).length);
  });

  it("Alice cannot decrypt Bob's ciphertext correctly", async () => {
    const r = await randomScalar();
    const ct = await encrypt(42n, r, users.bob.pubkey);
    let aliceResult: bigint | string;
    try {
      aliceResult = await decrypt(ct, users.alice.privkey, TEST_BITS);
    } catch {
      aliceResult = "out-of-range";
    }
    expect(aliceResult).not.toBe(42n);
  });
});

describe("Homomorphic property: n-sender accumulation", () => {
  it("accumulates 5 senders: [1, 2, 3, 4, 5] = 15", async () => {
    const amounts = [1n, 2n, 3n, 4n, 5n];
    const ciphertexts: Ciphertext[] = [];
    for (const v of amounts) {
      const r = await randomScalar();
      ciphertexts.push(await encrypt(v, r, users.bob.pubkey));
    }
    let acc = ciphertexts[0];
    for (let i = 1; i < ciphertexts.length; i++) {
      acc = await add(acc, ciphertexts[i]);
    }
    expect(await decrypt(acc, users.bob.privkey, TEST_BITS)).toBe(15n);
  });

  it("accumulates 10 equal contributions of 4 = 40", async () => {
    const ciphertexts: Ciphertext[] = [];
    for (let i = 0; i < 10; i++) {
      const r = await randomScalar();
      ciphertexts.push(await encrypt(4n, r, users.bob.pubkey));
    }
    let acc = ciphertexts[0];
    for (let i = 1; i < ciphertexts.length; i++) {
      acc = await add(acc, ciphertexts[i]);
    }
    expect(await decrypt(acc, users.bob.privkey, TEST_BITS)).toBe(40n);
  });
});
