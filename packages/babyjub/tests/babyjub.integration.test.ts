/**
 * babyjub.integration.test.ts
 *
 * Integration tests against the deployed BabyJub.sol contract on Flow EVM testnet.
 * Requires live network access to: https://testnet.evm.nodes.onflow.org
 *
 * Contract: 0x2c40513b343B70f2A0B7e6Ad6F997DDa819D6f07 (Flow EVM testnet — openjanus canonical)
 * Deploy tx: 1d79ef1240b26d4a9982b995f1cdb49f5f9963154f679bfed4bd2c28a1a8cd45
 *
 * Run: RUN_INTEGRATION=1 vitest run tests/babyjub.integration.test.ts
 *
 * NOTE: These tests hit the live testnet. Set RUN_INTEGRATION=1 to enable.
 * They will SKIP automatically in CI unless that env var is set.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  GENERATOR_G,
  IDENTITY,
  CURVE_P,
  DEPLOYED_ADDRESS,
  babyAddOnChain,
  isOnCurveOnChain,
  identityOnChain,
  negateOnChain,
  negatePoint,
} from "../src/index.js";

const SKIP = !process.env.RUN_INTEGRATION;

// Reference vectors (from circomlibjs@0.1.7 buildBabyjub().addPoint)
const G = GENERATOR_G;
const G2 = {
  x: 1676417244152142056454616115823988517566305896059373631785843290555309632953n,
  y: 11563908930482997415800970727888501192209530935490958274440594569809848042842n,
};
const G3 = {
  x: 7097975954760038507620802111344412063519509458421529194055316108847963502077n,
  y: 20460065127209391267340990691555311927812546314818552928162547469063110481889n,
};

describe.skipIf(SKIP)("BabyJub.sol integration — 0x27139AFda...0f870", () => {
  describe("identity()", () => {
    it("returns (0, 1) from live contract", async () => {
      const id = await identityOnChain();
      expect(id.x).toBe(0n);
      expect(id.y).toBe(1n);
    });
  });

  describe("isOnCurve()", () => {
    it("returns true for generator G", async () => {
      const result = await isOnCurveOnChain(G.x, G.y);
      expect(result).toBe(true);
    });

    it("returns true for identity (0, 1)", async () => {
      const result = await isOnCurveOnChain(0n, 1n);
      expect(result).toBe(true);
    });

    it("returns false for off-curve point (1, 1)", async () => {
      const result = await isOnCurveOnChain(1n, 1n);
      expect(result).toBe(false);
    });
  });

  describe("negate()", () => {
    it("negate(identity) = identity", async () => {
      const neg = await negateOnChain(0n, 1n);
      expect(neg.x).toBe(0n);
      expect(neg.y).toBe(1n);
    });

    it("negate(G) = (P - G.x, G.y)", async () => {
      const neg = await negateOnChain(G.x, G.y);
      expect(neg.x).toBe(CURVE_P - G.x);
      expect(neg.y).toBe(G.y);
    });

    it("negate result matches local computation", async () => {
      const onChain = await negateOnChain(G.x, G.y);
      const local = negatePoint(G.x, G.y);
      expect(onChain.x).toBe(local.x);
      expect(onChain.y).toBe(local.y);
    });
  });

  describe("babyAdd()", () => {
    it("G + identity = G (left identity law)", async () => {
      const result = await babyAddOnChain(G, IDENTITY);
      expect(result.x).toBe(G.x);
      expect(result.y).toBe(G.y);
    });

    it("identity + G = G (right identity law)", async () => {
      const result = await babyAddOnChain(IDENTITY, G);
      expect(result.x).toBe(G.x);
      expect(result.y).toBe(G.y);
    });

    it("identity + identity = identity", async () => {
      const result = await babyAddOnChain(IDENTITY, IDENTITY);
      expect(result.x).toBe(0n);
      expect(result.y).toBe(1n);
    });

    it("G + G = 2G (matches circomlibjs reference)", async () => {
      const result = await babyAddOnChain(G, G);
      expect(result.x).toBe(G2.x);
      expect(result.y).toBe(G2.y);
    });

    it("2G + G = 3G (sequential addition)", async () => {
      const result = await babyAddOnChain(G2, G);
      expect(result.x).toBe(G3.x);
      expect(result.y).toBe(G3.y);
    });

    it("G + 2G == 2G + G (commutativity)", async () => {
      const r1 = await babyAddOnChain(G, G2);
      const r2 = await babyAddOnChain(G2, G);
      expect(r1.x).toBe(r2.x);
      expect(r1.y).toBe(r2.y);
    });

    it("G + (-G) = identity (inverse law)", async () => {
      const negG = negatePoint(G.x, G.y);
      const result = await babyAddOnChain(G, negG);
      expect(result.x).toBe(0n);
      expect(result.y).toBe(1n);
    });

    it("result of G+G is on curve", async () => {
      const result = await babyAddOnChain(G, G);
      const onCurve = await isOnCurveOnChain(result.x, result.y);
      expect(onCurve).toBe(true);
    });
  });
});

// Always-run sanity checks (no network needed)
describe("deployed address format sanity", () => {
  it("DEPLOYED_ADDRESS is a valid 0x-prefixed 40-char hex address", () => {
    expect(DEPLOYED_ADDRESS).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(DEPLOYED_ADDRESS).toBe("0x2c40513b343B70f2A0B7e6Ad6F997DDa819D6f07");
  });
});
