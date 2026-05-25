/**
 * keypair.test.ts — Unit tests for keypair generation and derivation
 */

import { describe, it, expect, beforeAll } from "vitest";
import { getBabyJub } from "../../src/babyjub.js";
import {
  generateKeypair,
  deriveFromFlowKey,
  verifyKeypair,
  pubkeyToHex,
  pubkeyFromHex,
} from "../../src/keypair.js";

beforeAll(async () => {
  await getBabyJub(); // warm up singleton
}, 15_000);

describe("generateKeypair", () => {
  it("returns privkey and pubkey", async () => {
    const kp = await generateKeypair();
    expect(typeof kp.privkey).toBe("bigint");
    expect(kp.pubkey).toHaveLength(2);
  });

  it("privkey is in valid scalar range", async () => {
    const babyjub = await getBabyJub();
    const ORDER: bigint = babyjub.subOrder;
    const kp = await generateKeypair();
    expect(kp.privkey).toBeGreaterThan(0n);
    expect(kp.privkey).toBeLessThan(ORDER);
  });

  it("different calls produce different keypairs", async () => {
    const kp1 = await generateKeypair();
    const kp2 = await generateKeypair();
    expect(kp1.privkey).not.toBe(kp2.privkey);
  });

  it("pubkey is valid BabyJubjub point", async () => {
    const babyjub = await getBabyJub();
    const Fr = babyjub.F;
    const kp = await generateKeypair();
    const point = [Fr.e(kp.pubkey[0]), Fr.e(kp.pubkey[1])];
    expect(babyjub.inCurve(point)).toBe(true);
  });
});

describe("deriveFromFlowKey", () => {
  const SEED = Buffer.from("test-flow-signing-key-deterministic-32b", "utf8");

  it("produces deterministic keypair from same seed", async () => {
    const kp1 = await deriveFromFlowKey(SEED);
    const kp2 = await deriveFromFlowKey(SEED);
    expect(kp1.privkey.toString()).toBe(kp2.privkey.toString());
    expect(kp1.pubkey[0].toString()).toBe(kp2.pubkey[0].toString());
    expect(kp1.pubkey[1].toString()).toBe(kp2.pubkey[1].toString());
  });

  it("different seeds produce different keypairs", async () => {
    const kp1 = await deriveFromFlowKey(Buffer.from("seed-alpha", "utf8"));
    const kp2 = await deriveFromFlowKey(Buffer.from("seed-beta", "utf8"));
    expect(kp1.privkey).not.toBe(kp2.privkey);
  });

  it("accepts hex string input", async () => {
    const hexSeed = SEED.toString("hex");
    const kp1 = await deriveFromFlowKey(SEED);
    const kp2 = await deriveFromFlowKey(hexSeed);
    expect(kp1.privkey.toString()).toBe(kp2.privkey.toString());
  });

  it("accepts hex string with 0x prefix", async () => {
    const hexSeed = "0x" + SEED.toString("hex");
    const kp1 = await deriveFromFlowKey(SEED);
    const kp2 = await deriveFromFlowKey(hexSeed);
    expect(kp1.privkey.toString()).toBe(kp2.privkey.toString());
  });

  it("privkey is non-zero", async () => {
    const kp = await deriveFromFlowKey(SEED);
    expect(kp.privkey).toBeGreaterThan(0n);
  });

  it("pubkey is on BabyJubjub curve", async () => {
    const babyjub = await getBabyJub();
    const Fr = babyjub.F;
    const kp = await deriveFromFlowKey(SEED);
    const point = [Fr.e(kp.pubkey[0]), Fr.e(kp.pubkey[1])];
    expect(babyjub.inCurve(point)).toBe(true);
  });
});

describe("verifyKeypair", () => {
  it("returns true for valid keypair", async () => {
    const kp = await generateKeypair();
    expect(await verifyKeypair(kp.privkey, kp.pubkey)).toBe(true);
  });

  it("returns false for mismatched keypair", async () => {
    const kp1 = await generateKeypair();
    const kp2 = await generateKeypair();
    expect(await verifyKeypair(kp1.privkey, kp2.pubkey)).toBe(false);
  });
});

describe("pubkeyToHex / pubkeyFromHex", () => {
  it("roundtrips correctly", async () => {
    const kp = await generateKeypair();
    const hex = pubkeyToHex(kp.pubkey);
    const back = pubkeyFromHex(hex);
    expect(back[0]).toBe(kp.pubkey[0]);
    expect(back[1]).toBe(kp.pubkey[1]);
  });

  it("hex is 128 chars (64 bytes)", async () => {
    const kp = await generateKeypair();
    expect(pubkeyToHex(kp.pubkey)).toHaveLength(128);
  });

  it("throws on invalid hex length", () => {
    expect(() => pubkeyFromHex("deadbeef")).toThrow();
  });
});
