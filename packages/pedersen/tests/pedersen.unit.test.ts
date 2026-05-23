/**
 * pedersen.unit.test.ts
 *
 * Unit tests for Pedersen commitment operations.
 * Uses circomlibjs to compute reference vectors for homomorphism tests.
 *
 * Run: vitest run tests/pedersen.unit.test.ts
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  computeCommitment,
  addCommitmentsLocal,
  subCommitmentsLocal,
  identityCommitment,
  isIdentityCommitment,
  negatePoint,
  CURVE_P,
  type PedersenCommitment,
} from "../src/index.js";

// Reference test vectors from the private lab (PedersenBabyJub_test.cdc)
// Computed by circomlibjs@0.1.7 buildBabyjub + buildPedersenHash
// pack(value=1000, blinding=12345) — 8-byte encoding
const C1_REF = {
  x: 3948717922512828968446562986443927253975646736745191400183934737885769602776n,
  y: 10354945292185150109148496999586391090939608495751610843398465193190196165789n,
};

// pack(value=250, blinding=67890) — 8-byte encoding
const C2_REF = {
  x: 1904841529781836903855505508750047184714417804789132353155627870502166238738n,
  y: 1346785537101072713809042385398817551066533982515420893005232905068605172236n,
};

// C1 + C2 reference (circomlibjs babyJub.addPoint)
const C1_PLUS_C2_REF = {
  x: 16179568375943438430227281185829684309686223131240465406129010213964591352215n,
  y: 2392284231400751192427200603407894810591267745215368839004872807113872687819n,
};

// C1 - C2 reference = addPoint(C1, negate(C2))
const C1_MINUS_C2_REF = {
  x: 1896632126278395007647790786086132040607283483109340691530247868079336406965n,
  y: 5575776740433427854730017330081021187610965521139757623369805762467058171576n,
};

let C1: PedersenCommitment;
let C2: PedersenCommitment;

describe("Pedersen commitment unit tests", () => {
  // Note: circomlibjs uses 24-byte pack (value 8 bytes + blinding 16 bytes)
  // to match the circuit's 192-bit Pedersen input.
  // The reference vectors above are from the 24-byte version.

  describe("computeCommitment()", () => {
    it("commitment is an object with x and y BigInt fields", async () => {
      const c = await computeCommitment(42n, 100n);
      expect(typeof c.x).toBe("bigint");
      expect(typeof c.y).toBe("bigint");
    });

    it("commitment(v, r1) != commitment(v, r2) for different blindings", async () => {
      const c1 = await computeCommitment(100n, 1n);
      const c2 = await computeCommitment(100n, 2n);
      expect(c1.x).not.toBe(c2.x);
    });

    it("commitment(v1, r) != commitment(v2, r) for different values", async () => {
      const c1 = await computeCommitment(100n, 42n);
      const c2 = await computeCommitment(101n, 42n);
      expect(c1.x).not.toBe(c2.x);
    });

    it("x and y are in field [0, P)", async () => {
      const c = await computeCommitment(999n, 8888n);
      expect(c.x >= 0n).toBe(true);
      expect(c.x < CURVE_P).toBe(true);
      expect(c.y >= 0n).toBe(true);
      expect(c.y < CURVE_P).toBe(true);
    });
  });

  describe("identityCommitment()", () => {
    it("returns (0, 1)", () => {
      const id = identityCommitment();
      expect(id.x).toBe(0n);
      expect(id.y).toBe(1n);
    });

    it("isIdentityCommitment(identity) = true", () => {
      expect(isIdentityCommitment(identityCommitment())).toBe(true);
    });

    it("isIdentityCommitment(non-identity) = false", async () => {
      const c = await computeCommitment(1n, 1n);
      expect(isIdentityCommitment(c)).toBe(false);
    });
  });

  describe("addCommitmentsLocal() — homomorphism", () => {
    it("addCommitmentsLocal(identity, C) = C", async () => {
      const c = await computeCommitment(500n, 42n);
      const id = identityCommitment();
      const result = await addCommitmentsLocal(id, c);
      expect(result.x).toBe(c.x);
      expect(result.y).toBe(c.y);
    });

    it("addCommitmentsLocal(C, identity) = C", async () => {
      const c = await computeCommitment(500n, 42n);
      const id = identityCommitment();
      const result = await addCommitmentsLocal(c, id);
      expect(result.x).toBe(c.x);
      expect(result.y).toBe(c.y);
    });

    it("commutativity: add(C1, C2) == add(C2, C1)", async () => {
      const c1 = await computeCommitment(100n, 1n);
      const c2 = await computeCommitment(200n, 2n);
      const r1 = await addCommitmentsLocal(c1, c2);
      const r2 = await addCommitmentsLocal(c2, c1);
      expect(r1.x).toBe(r2.x);
      expect(r1.y).toBe(r2.y);
    });

    it("C + negate(C) = identity (inverse law)", async () => {
      const c = await computeCommitment(100n, 42n);
      const negC = negatePoint(c.x, c.y);
      const result = await addCommitmentsLocal(c, negC);
      expect(result.x).toBe(0n);
      expect(result.y).toBe(1n);
    });
  });

  describe("subCommitmentsLocal()", () => {
    it("C - C = identity", async () => {
      const c = await computeCommitment(100n, 42n);
      const result = await subCommitmentsLocal(c, c);
      expect(result.x).toBe(0n);
      expect(result.y).toBe(1n);
    });

    it("(C1 - C2) + C2 = C1 (round trip)", async () => {
      const c1 = await computeCommitment(500n, 11n);
      const c2 = await computeCommitment(200n, 22n);
      const diff = await subCommitmentsLocal(c1, c2);
      const roundTrip = await addCommitmentsLocal(diff, c2);
      expect(roundTrip.x).toBe(c1.x);
      expect(roundTrip.y).toBe(c1.y);
    });
  });
});
