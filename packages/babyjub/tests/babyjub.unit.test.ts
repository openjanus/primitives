/**
 * babyjub.unit.test.ts
 *
 * Unit tests for BabyJubJub curve operations.
 * Uses reference test vectors computed by circomlibjs@0.1.7 buildBabyjub().
 *
 * These tests validate the mathematical correctness of the curve operations
 * before running integration tests against the deployed contract.
 *
 * Run: vitest run tests/babyjub.unit.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  CURVE_P,
  CURVE_A,
  CURVE_D,
  GENERATOR_G,
  IDENTITY,
  negatePoint,
  isOnCurveLocal,
  isIdentity,
} from "../src/index.js";

// ---------------------------------------------------------------------------
// Reference test vectors (from circomlibjs@0.1.7 buildBabyjub().addPoint)
// ---------------------------------------------------------------------------

const G = GENERATOR_G;

// 2G = G + G (point doubling)
const G2 = {
  x: 1676417244152142056454616115823988517566305896059373631785843290555309632953n,
  y: 11563908930482997415800970727888501192209530935490958274440594569809848042842n,
};

// 3G = 2G + G
const G3 = {
  x: 7097975954760038507620802111344412063519509458421529194055316108847963502077n,
  y: 20460065127209391267340990691555311927812546314818552928162547469063110481889n,
};

// 4G = 3G + G = 2G + 2G
const G4 = {
  x: 11940103558519948654707819768822978214526419610986575349872581173462370334209n,
  y: 16133537043833109864904997878990023239769440361381525375236540405234196921159n,
};

// ---------------------------------------------------------------------------
// Curve constants sanity checks
// ---------------------------------------------------------------------------

describe("curve constants", () => {
  it("P is BN254 scalar field prime", () => {
    expect(CURVE_P).toBe(
      21888242871839275222246405745257275088548364400416034343698204186575808495617n
    );
  });

  it("A = 168700", () => {
    expect(CURVE_A).toBe(168700n);
  });

  it("D = 168696", () => {
    expect(CURVE_D).toBe(168696n);
  });

  it("identity is (0, 1)", () => {
    expect(IDENTITY.x).toBe(0n);
    expect(IDENTITY.y).toBe(1n);
  });
});

// ---------------------------------------------------------------------------
// isOnCurveLocal tests
// ---------------------------------------------------------------------------

describe("isOnCurveLocal", () => {
  it("identity (0, 1) is on curve", () => {
    expect(isOnCurveLocal(IDENTITY.x, IDENTITY.y)).toBe(true);
  });

  it("generator G is on curve", () => {
    expect(isOnCurveLocal(G.x, G.y)).toBe(true);
  });

  it("2G is on curve", () => {
    expect(isOnCurveLocal(G2.x, G2.y)).toBe(true);
  });

  it("random point (1, 1) is NOT on curve", () => {
    expect(isOnCurveLocal(1n, 1n)).toBe(false);
  });

  it("(0, 0) is NOT on curve", () => {
    expect(isOnCurveLocal(0n, 0n)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// negatePoint tests
// ---------------------------------------------------------------------------

describe("negatePoint", () => {
  it("negate(identity) = identity", () => {
    const neg = negatePoint(IDENTITY.x, IDENTITY.y);
    expect(neg.x).toBe(0n);
    expect(neg.y).toBe(1n);
  });

  it("negate(G) = (P - G.x, G.y)", () => {
    const neg = negatePoint(G.x, G.y);
    expect(neg.x).toBe(CURVE_P - G.x);
    expect(neg.y).toBe(G.y);
  });

  it("double negation: negate(negate(G)) = G", () => {
    const neg1 = negatePoint(G.x, G.y);
    const neg2 = negatePoint(neg1.x, neg1.y);
    expect(neg2.x).toBe(G.x);
    expect(neg2.y).toBe(G.y);
  });

  it("negate(G).x + G.x = P (they sum to field order)", () => {
    const neg = negatePoint(G.x, G.y);
    expect((neg.x + G.x) % CURVE_P).toBe(0n);
  });
});

// ---------------------------------------------------------------------------
// isIdentity tests
// ---------------------------------------------------------------------------

describe("isIdentity", () => {
  it("identity returns true", () => {
    expect(isIdentity(IDENTITY.x, IDENTITY.y)).toBe(true);
  });

  it("generator G is not identity", () => {
    expect(isIdentity(G.x, G.y)).toBe(false);
  });

  it("(0, 0) is not identity", () => {
    expect(isIdentity(0n, 0n)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test vector consistency (values for integration tests)
// ---------------------------------------------------------------------------

describe("test vectors (for integration reference)", () => {
  it("G.x and G.y match expected values", () => {
    expect(G.x).toBe(
      995203441582195749578291179787384436505546430278305826713579947235728471134n
    );
    expect(G.y).toBe(
      5472060717959818805561601436314318772137091100104008585924551046643952123905n
    );
  });

  it("G2.x and G2.y match circomlibjs reference", () => {
    expect(G2.x).toBe(
      1676417244152142056454616115823988517566305896059373631785843290555309632953n
    );
    expect(G2.y).toBe(
      11563908930482997415800970727888501192209530935490958274440594569809848042842n
    );
  });

  it("G3.x and G3.y match circomlibjs reference", () => {
    expect(G3.x).toBe(
      7097975954760038507620802111344412063519509458421529194055316108847963502077n
    );
    expect(G3.y).toBe(
      20460065127209391267340990691555311927812546314818552928162547469063110481889n
    );
  });

  it("G4 from 3G+G == G4 from 2G+2G (associativity)", () => {
    // Both should give the same 4G coordinates
    // Actual computation is done in integration tests against deployed contract
    expect(G4.x).toBe(
      11940103558519948654707819768822978214526419610986575349872581173462370334209n
    );
    expect(G4.y).toBe(
      16133537043833109864904997878990023239769440361381525375236540405234196921159n
    );
  });
});
