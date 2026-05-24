/**
 * groth16.unit.test.ts
 *
 * Unit tests for the Groth16 SDK utilities (no network required).
 *
 * Tests:
 *  - proofToEVMFormat: pi_b swap is correctly applied
 *  - parsePublicSignals: correct field mapping
 *  - pubSignalsToArray: correct ordering
 *  - Format validation
 */

import { describe, it, expect } from "vitest";
import {
  proofToEVMFormat,
  parsePublicSignals,
  pubSignalsToArray,
  VERIFIER_ADDRESS,
  VERIFY_PROOF_SELECTOR,
  type SnarkJSProof,
} from "../src/index.js";

// ---------------------------------------------------------------------------
// Sample snarkJS proof (fabricated structure — real values not needed for unit tests)
// ---------------------------------------------------------------------------
const SAMPLE_PROOF: SnarkJSProof = {
  pi_a: [
    "11111111111111111111111111111111111111111111111111111111111111111",
    "22222222222222222222222222222222222222222222222222222222222222222",
    "1",
  ],
  pi_b: [
    ["33333333333333333333333333333333333333333333333333333333333333333", "44444444444444444444444444444444444444444444444444444444444444444"],
    ["55555555555555555555555555555555555555555555555555555555555555555", "66666666666666666666666666666666666666666666666666666666666666666"],
    ["1", "0"],
  ],
  pi_c: [
    "77777777777777777777777777777777777777777777777777777777777777777",
    "88888888888888888888888888888888888888888888888888888888888888888",
    "1",
  ],
  protocol: "groth16",
  curve: "bn128",
};

// 6 sample public signals (decimal strings)
const SAMPLE_PUB_SIGNALS = [
  "1000000000000000000000000000000000000000000000000000000000000001",
  "2000000000000000000000000000000000000000000000000000000000000002",
  "3000000000000000000000000000000000000000000000000000000000000003",
  "4000000000000000000000000000000000000000000000000000000000000004",
  "5000000000000000000000000000000000000000000000000000000000000005",
  "6000000000000000000000000000000000000000000000000000000000000006",
];

describe("proofToEVMFormat", () => {
  it("pA matches pi_a[0] and pi_a[1]", () => {
    const { pA } = proofToEVMFormat(SAMPLE_PROOF);
    expect(pA[0]).toBe(BigInt(SAMPLE_PROOF.pi_a[0]));
    expect(pA[1]).toBe(BigInt(SAMPLE_PROOF.pi_a[1]));
  });

  it("pC matches pi_c[0] and pi_c[1]", () => {
    const { pC } = proofToEVMFormat(SAMPLE_PROOF);
    expect(pC[0]).toBe(BigInt(SAMPLE_PROOF.pi_c[0]));
    expect(pC[1]).toBe(BigInt(SAMPLE_PROOF.pi_c[1]));
  });

  it("pB applies Fp2 swap: pB[0] = [im, re] not [re, im]", () => {
    const { pB } = proofToEVMFormat(SAMPLE_PROOF);
    // snarkjs pi_b[0] = [re0, im0] = ["333...", "444..."]
    // After swap: [im0, re0] = ["444...", "333..."]
    expect(pB[0][0]).toBe(BigInt(SAMPLE_PROOF.pi_b[0][1]));  // im0 (was index 1)
    expect(pB[0][1]).toBe(BigInt(SAMPLE_PROOF.pi_b[0][0]));  // re0 (was index 0)
  });

  it("pB[1] also applies Fp2 swap", () => {
    const { pB } = proofToEVMFormat(SAMPLE_PROOF);
    // snarkjs pi_b[1] = [re1, im1] = ["555...", "666..."]
    // After swap: [im1, re1] = ["666...", "555..."]
    expect(pB[1][0]).toBe(BigInt(SAMPLE_PROOF.pi_b[1][1]));  // im1
    expect(pB[1][1]).toBe(BigInt(SAMPLE_PROOF.pi_b[1][0]));  // re1
  });

  it("swap is idempotent: applying swap twice returns original", () => {
    const { pB: swapped } = proofToEVMFormat(SAMPLE_PROOF);
    // Manually reverse the swap
    const doubleSwapped = [
      [swapped[0][1], swapped[0][0]],
      [swapped[1][1], swapped[1][0]],
    ];
    expect(doubleSwapped[0][0]).toBe(BigInt(SAMPLE_PROOF.pi_b[0][0]));
    expect(doubleSwapped[0][1]).toBe(BigInt(SAMPLE_PROOF.pi_b[0][1]));
  });
});

describe("parsePublicSignals", () => {
  it("parses 6 signals into typed object", () => {
    const parsed = parsePublicSignals(SAMPLE_PUB_SIGNALS);
    expect(parsed.oldCommitX).toBe(BigInt(SAMPLE_PUB_SIGNALS[0]));
    expect(parsed.oldCommitY).toBe(BigInt(SAMPLE_PUB_SIGNALS[1]));
    expect(parsed.transferCommitX).toBe(BigInt(SAMPLE_PUB_SIGNALS[2]));
    expect(parsed.transferCommitY).toBe(BigInt(SAMPLE_PUB_SIGNALS[3]));
    expect(parsed.newCommitX).toBe(BigInt(SAMPLE_PUB_SIGNALS[4]));
    expect(parsed.newCommitY).toBe(BigInt(SAMPLE_PUB_SIGNALS[5]));
  });

  it("throws for wrong signal count", () => {
    expect(() => parsePublicSignals(["1", "2", "3"])).toThrow(
      "Expected 6 public signals, got 3"
    );
  });
});

describe("pubSignalsToArray", () => {
  it("returns signals in circuit order", () => {
    const signals = parsePublicSignals(SAMPLE_PUB_SIGNALS);
    const arr = pubSignalsToArray(signals);
    expect(arr).toHaveLength(6);
    expect(arr[0]).toBe(signals.oldCommitX);
    expect(arr[1]).toBe(signals.oldCommitY);
    expect(arr[2]).toBe(signals.transferCommitX);
    expect(arr[3]).toBe(signals.transferCommitY);
    expect(arr[4]).toBe(signals.newCommitX);
    expect(arr[5]).toBe(signals.newCommitY);
  });
});

describe("deployed address constants", () => {
  it("VERIFIER_ADDRESS is a 0x-prefixed 40-char hex string", () => {
    expect(VERIFIER_ADDRESS).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(VERIFIER_ADDRESS).toBe("0x0085F286d89af79EC59E27CD0c5CcD1c55f42Cf5");
  });

  it("VERIFY_PROOF_SELECTOR is 0xf398789b", () => {
    expect(VERIFY_PROOF_SELECTOR).toBe("0xf398789b");
  });
});
