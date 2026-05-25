/**
 * decrypt.test.ts — Unit tests for decryption
 *
 * Uses BSGS range 2^20 for speed (covers [0, 1,048,576)).
 */

import { describe, it, expect, beforeAll } from "vitest";
import { encrypt, randomScalar } from "../../src/encrypt.js";
import { decrypt, warmupDecrypt } from "../../src/decrypt.js";
import { generateKeypair, deriveFromFlowKey } from "../../src/keypair.js";
import { TEST_BITS } from "../../src/bsgs.js";
import type { Keypair } from "../../src/types.js";

let kp: Keypair;

beforeAll(async () => {
  // Use test seed for determinism
  kp = await deriveFromFlowKey(
    Buffer.from("test-flow-signing-key-deterministic-32b", "utf8")
  );
  // Warm up BSGS table once for all tests in this file
  await warmupDecrypt(TEST_BITS);
}, 30_000);

describe("decrypt", () => {
  it("roundtrips value=0", async () => {
    const r = await randomScalar();
    const ct = await encrypt(0n, r, kp.pubkey);
    expect(await decrypt(ct, kp.privkey, TEST_BITS)).toBe(0n);
  });

  it("roundtrips value=1", async () => {
    const r = await randomScalar();
    const ct = await encrypt(1n, r, kp.pubkey);
    expect(await decrypt(ct, kp.privkey, TEST_BITS)).toBe(1n);
  });

  it("roundtrips value=42", async () => {
    const r = await randomScalar();
    const ct = await encrypt(42n, r, kp.pubkey);
    expect(await decrypt(ct, kp.privkey, TEST_BITS)).toBe(42n);
  });

  it("roundtrips value=255", async () => {
    const r = await randomScalar();
    const ct = await encrypt(255n, r, kp.pubkey);
    expect(await decrypt(ct, kp.privkey, TEST_BITS)).toBe(255n);
  });

  it("roundtrips value=1000", async () => {
    const r = await randomScalar();
    const ct = await encrypt(1000n, r, kp.pubkey);
    expect(await decrypt(ct, kp.privkey, TEST_BITS)).toBe(1000n);
  });

  it("roundtrips value=65535", async () => {
    const r = await randomScalar();
    const ct = await encrypt(65535n, r, kp.pubkey);
    expect(await decrypt(ct, kp.privkey, TEST_BITS)).toBe(65535n);
  });

  it("roundtrips value=500000 (near 2^20 limit)", async () => {
    const r = await randomScalar();
    const ct = await encrypt(500000n, r, kp.pubkey);
    expect(await decrypt(ct, kp.privkey, TEST_BITS)).toBe(500000n);
  });

  it("roundtrips max value in test range (2^20 - 1)", async () => {
    const maxVal = (1n << BigInt(TEST_BITS)) - 1n;
    const r = await randomScalar();
    const ct = await encrypt(maxVal, r, kp.pubkey);
    expect(await decrypt(ct, kp.privkey, TEST_BITS)).toBe(maxVal);
  });

  it("wrong private key produces wrong result", async () => {
    const r = await randomScalar();
    const ct = await encrypt(42n, r, kp.pubkey);
    const wrongKp = await generateKeypair();
    let result: bigint | string;
    try {
      result = await decrypt(ct, wrongKp.privkey, TEST_BITS);
    } catch {
      result = "out-of-range";
    }
    expect(result).not.toBe(42n);
  });

  it("value > test range throws BSGS error", async () => {
    const overRange = 1n << BigInt(TEST_BITS); // exactly 2^20
    const r = await randomScalar();
    const ct = await encrypt(overRange, r, kp.pubkey);
    await expect(decrypt(ct, kp.privkey, TEST_BITS)).rejects.toThrow(/BSGS|Discrete log not found/);
  });
});

describe("warmupDecrypt", () => {
  it("returns BsgsInfo with expected fields", async () => {
    const info = await warmupDecrypt(TEST_BITS);
    expect(info).toHaveProperty("M");
    expect(info).toHaveProperty("bits", TEST_BITS);
    expect(info).toHaveProperty("buildTimeMs");
    expect(info).toHaveProperty("entries");
    expect(info).toHaveProperty("mode");
    expect(info.mode).toBe("memory");
  });

  it("M = 2^(bits/2)", async () => {
    const info = await warmupDecrypt(TEST_BITS);
    expect(info.M).toBe(1n << BigInt(TEST_BITS / 2));
  });
});
