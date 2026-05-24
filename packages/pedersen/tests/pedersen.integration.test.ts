/**
 * pedersen.integration.test.ts
 *
 * Integration tests for PedersenBabyJub.cdc against live Flow testnet.
 *
 * Tests the deployed contract at 0x28fef3d1d6a12800 via FCL scripts (openjanus canonical).
 * The contract wraps BabyJub.sol at 0x2c40513b343B70f2A0B7e6Ad6F997DDa819D6f07.
 *
 * Run: RUN_INTEGRATION=1 vitest run tests/pedersen.integration.test.ts
 *
 * NOTE: Requires live testnet access. Set RUN_INTEGRATION=1 to enable.
 */

import { describe, it, expect } from "vitest";
import {
  PEDERSEN_CADENCE_ADDRESS,
  SCRIPT_IDENTITY,
  SCRIPT_NEGATE,
  SCRIPT_IS_IDENTITY,
  computeCommitment,
  addCommitmentsLocal,
  subCommitmentsLocal,
  negatePoint,
  CURVE_P,
  type PedersenCommitment,
} from "../src/index.js";

const SKIP = !process.env.RUN_INTEGRATION;

// ---------------------------------------------------------------------------
// FCL script execution helper (minimal, no full FCL setup needed for scripts)
// ---------------------------------------------------------------------------

async function executeScript(
  script: string,
  args: unknown[] = []
): Promise<unknown> {
  const fcl = await import("@onflow/fcl");
  fcl.config({
    "accessNode.api": "https://rest-testnet.onflow.org",
  });

  return fcl.query({
    cadence: script,
    args: (_arg: unknown, _t: unknown) => args,
  });
}

// ---------------------------------------------------------------------------
// Reference test vectors (from PedersenBabyJub_test.cdc)
// BASE8 generator used by circomlib Pedersen
// ---------------------------------------------------------------------------
const G_X = 5299619240641551281634865583518297030282874472190772894086521144482721001553n;
const G_Y = 16950150798460657717958625567821834550301663161624707787222815936182638968203n;

describe.skipIf(SKIP)("PedersenBabyJub.cdc integration — 0x28fef3d1d6a12800 (openjanus canonical)", () => {
  describe("identity()", () => {
    it("returns {x: 0, y: 1} from live contract", async () => {
      const result = await executeScript(SCRIPT_IDENTITY) as {x: string, y: string};
      expect(BigInt(result.x)).toBe(0n);
      expect(BigInt(result.y)).toBe(1n);
    });
  });

  describe("isIdentity()", () => {
    it("returns true for (0, 1)", async () => {
      const { default: fcl } = await import("@onflow/fcl");
      fcl.config({ "accessNode.api": "https://rest-testnet.onflow.org" });
      const result = await fcl.query({
        cadence: SCRIPT_IS_IDENTITY,
        args: (arg: Function, t: { UInt256: Function }) => [
          arg("0", t.UInt256),
          arg("1", t.UInt256),
        ],
      });
      expect(result).toBe(true);
    });

    it("returns false for BASE8 generator", async () => {
      const { default: fcl } = await import("@onflow/fcl");
      fcl.config({ "accessNode.api": "https://rest-testnet.onflow.org" });
      const result = await fcl.query({
        cadence: SCRIPT_IS_IDENTITY,
        args: (arg: Function, t: { UInt256: Function }) => [
          arg(G_X.toString(), t.UInt256),
          arg(G_Y.toString(), t.UInt256),
        ],
      });
      expect(result).toBe(false);
    });
  });

  describe("negate()", () => {
    it("negate(0, 1) = (0, 1) — identity is self-inverse", async () => {
      const { default: fcl } = await import("@onflow/fcl");
      fcl.config({ "accessNode.api": "https://rest-testnet.onflow.org" });
      const result = await fcl.query({
        cadence: SCRIPT_NEGATE,
        args: (arg: Function, t: { UInt256: Function }) => [
          arg("0", t.UInt256),
          arg("1", t.UInt256),
        ],
      }) as {x: string, y: string};
      expect(BigInt(result.x)).toBe(0n);
      expect(BigInt(result.y)).toBe(1n);
    });

    it("negate(G).x = P - G.x, y unchanged", async () => {
      const { default: fcl } = await import("@onflow/fcl");
      fcl.config({ "accessNode.api": "https://rest-testnet.onflow.org" });
      const result = await fcl.query({
        cadence: SCRIPT_NEGATE,
        args: (arg: Function, t: { UInt256: Function }) => [
          arg(G_X.toString(), t.UInt256),
          arg(G_Y.toString(), t.UInt256),
        ],
      }) as {x: string, y: string};
      expect(BigInt(result.x)).toBe(CURVE_P - G_X);
      expect(BigInt(result.y)).toBe(G_Y);
    });

    it("on-chain negate matches local negatePoint()", async () => {
      const { default: fcl } = await import("@onflow/fcl");
      fcl.config({ "accessNode.api": "https://rest-testnet.onflow.org" });
      const c = await computeCommitment(100n, 42n);
      const onChain = await fcl.query({
        cadence: SCRIPT_NEGATE,
        args: (arg: Function, t: { UInt256: Function }) => [
          arg(c.x.toString(), t.UInt256),
          arg(c.y.toString(), t.UInt256),
        ],
      }) as {x: string, y: string};
      const local = negatePoint(c.x, c.y);
      expect(BigInt(onChain.x)).toBe(local.x);
      expect(BigInt(onChain.y)).toBe(local.y);
    });
  });

  describe("homomorphism property (local only, network validation above)", () => {
    it("add(commit(a,r1), commit(b,r2)) = add round-trip", async () => {
      const c1 = await computeCommitment(1000n, 12345n);
      const c2 = await computeCommitment(250n, 67890n);
      const sum = await addCommitmentsLocal(c1, c2);
      const diff = await subCommitmentsLocal(sum, c2);
      // (c1 + c2) - c2 should equal c1
      expect(diff.x).toBe(c1.x);
      expect(diff.y).toBe(c1.y);
    });
  });
});

// Always-run checks
describe("pedersen deployed address format", () => {
  it("PEDERSEN_CADENCE_ADDRESS matches expected testnet address", () => {
    expect(PEDERSEN_CADENCE_ADDRESS).toBe("0x28fef3d1d6a12800");
  });
});
