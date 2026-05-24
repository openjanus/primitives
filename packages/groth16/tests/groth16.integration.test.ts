/**
 * groth16.integration.test.ts
 *
 * Integration tests for ConfidentialTransferVerifier.sol on Flow EVM testnet.
 * Deployed at: 0x70FA331534619DBd4051b22b7fb19e647be141b0
 *
 * These tests generate a real Groth16 proof using snarkJS and verify it
 * against the live deployed contract on Flow EVM testnet.
 *
 * Requirements:
 *   - WASM: circuit/build/confidential_transfer_js/confidential_transfer.wasm
 *   - ZKEY: setup/confidential_transfer_final.zkey
 *   - VK:   setup/verification_key.json
 *
 * All files are bundled in the @openjanus/groth16 package.
 *
 * Run: RUN_INTEGRATION=1 WASM_PATH=... ZKEY_PATH=... VK_PATH=... vitest run
 *
 * NOTE: Requires live testnet + proof generation artifacts. Set RUN_INTEGRATION=1.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  proofToEVMFormat,
  parsePublicSignals,
  verifyOnChain,
  estimateVerifyGas,
  verifyLocally,
  VERIFIER_ADDRESS,
  type SnarkJSProof,
} from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKIP = !process.env.RUN_INTEGRATION;

// Allow overriding artifact paths via env
const WASM_PATH = process.env.WASM_PATH ?? join(__dirname, "../../groth16/circuit/confidential_transfer.wasm");
const ZKEY_PATH = process.env.ZKEY_PATH ?? join(__dirname, "../../groth16/setup/confidential_transfer_final.zkey");
const VK_PATH   = process.env.VK_PATH   ?? join(__dirname, "../../groth16/setup/verification_key.json");

// ---------------------------------------------------------------------------
// Pedersen commitment helper (matches circuit exactly)
// ---------------------------------------------------------------------------
async function computePedersenCommitment(value: bigint, blinding: bigint): Promise<{x: string, y: string}> {
  const { buildBabyjub, buildPedersenHash } = await import("circomlibjs");
  const pedersenHash = await buildPedersenHash();
  const babyJub = await buildBabyjub();
  const F = babyJub.F;

  // Pack: value (8 bytes LE) || blinding (16 bytes LE) = 24 bytes
  const buf = Buffer.alloc(24, 0);
  let v = value;
  for (let i = 0; i < 8; i++) { buf[i] = Number(v & 0xffn); v >>= 8n; }
  let b = blinding;
  for (let i = 8; i < 24; i++) { buf[i] = Number(b & 0xffn); b >>= 8n; }

  const hash = pedersenHash.hash(buf);
  const point = babyJub.unpackPoint(hash);
  return {
    x: F.toObject(point[0]).toString(),
    y: F.toObject(point[1]).toString(),
  };
}

// ---------------------------------------------------------------------------
// Proof generation helper
// ---------------------------------------------------------------------------
async function generateProof(
  oldValue: bigint,
  oldBlinding: bigint,
  transferValue: bigint,
  transferBlinding: bigint,
  newBlinding: bigint
): Promise<{ proof: SnarkJSProof; publicSignals: string[] }> {
  const snarkjs = await import("snarkjs");
  const newBalance = oldValue - transferValue;

  const [oldCommit, txCommit, newCommit] = await Promise.all([
    computePedersenCommitment(oldValue, oldBlinding),
    computePedersenCommitment(transferValue, transferBlinding),
    computePedersenCommitment(newBalance, newBlinding),
  ]);

  const input = {
    old_value:          oldValue.toString(),
    old_blinding:       oldBlinding.toString(),
    transfer_value:     transferValue.toString(),
    transfer_blinding:  transferBlinding.toString(),
    new_blinding:       newBlinding.toString(),
    old_commit:      [oldCommit.x, oldCommit.y],
    transfer_commit: [txCommit.x,  txCommit.y],
    new_commit:      [newCommit.x, newCommit.y],
  };

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM_PATH, ZKEY_PATH);
  return { proof: proof as SnarkJSProof, publicSignals };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(SKIP)("ConfidentialTransferVerifier integration — 0x70FA33...", () => {
  let proof: SnarkJSProof;
  let publicSignals: string[];
  let vk: object;

  beforeAll(async () => {
    // Generate a valid proof once for all tests
    console.log("Generating proof for value=100, transfer=30...");
    const t0 = Date.now();
    ({ proof, publicSignals } = await generateProof(100n, 42n, 30n, 99n, 7777n));
    console.log(`Proof generated in ${Date.now() - t0}ms`);

    const { readFileSync } = await import("fs");
    vk = JSON.parse(readFileSync(VK_PATH, "utf8"));
  }, 60_000); // allow up to 60s for proof generation

  describe("local verification (snarkjs)", () => {
    it("valid proof verifies locally", async () => {
      const valid = await verifyLocally(vk, proof, publicSignals);
      expect(valid).toBe(true);
    });

    it("tampered proof fails local verification", async () => {
      const tampered = JSON.parse(JSON.stringify(proof)) as SnarkJSProof;
      const orig = BigInt(tampered.pi_a[0]);
      tampered.pi_a[0] = ((orig + 1n) % (2n ** 254n)).toString();
      const valid = await verifyLocally(vk, tampered, publicSignals);
      expect(valid).toBe(false);
    });

    it("wrong public signals fail local verification", async () => {
      const wrongSignals = [...publicSignals];
      wrongSignals[0] = "12345678901234567890";
      const valid = await verifyLocally(vk, proof, wrongSignals);
      expect(valid).toBe(false);
    });
  });

  describe("on-chain verification — 0x70FA331534619DBd4051b22b7fb19e647be141b0", () => {
    it("valid proof returns true from live contract", async () => {
      const onChainValid = await verifyOnChain(proof, publicSignals);
      expect(onChainValid).toBe(true);
    }, 30_000);

    it("tampered proof returns false (not revert) from live contract", async () => {
      const tampered = JSON.parse(JSON.stringify(proof)) as SnarkJSProof;
      const orig = BigInt(tampered.pi_a[0]);
      tampered.pi_a[0] = ((orig + 1n) % (2n ** 254n)).toString();
      const onChainValid = await verifyOnChain(tampered, publicSignals);
      expect(onChainValid).toBe(false);
    }, 30_000);

    it("gas estimate is within expected range (200k–300k gas)", async () => {
      const gas = await estimateVerifyGas(proof, publicSignals);
      console.log(`  verifyProof gas estimate: ${gas}`);
      expect(gas).toBeGreaterThan(200_000n);
      expect(gas).toBeLessThan(300_000n);
    }, 30_000);
  });

  describe("pi_b swap — correctness", () => {
    it("proof with pi_b NOT swapped would fail (verifying SDK correctness)", async () => {
      // Build proof with un-swapped pi_b (what snarkJS gives raw)
      const { ethers } = await import("ethers");
      const provider = new ethers.JsonRpcProvider("https://testnet.evm.nodes.onflow.org");
      const abi = ["function verifyProof(uint256[2], uint256[2][2], uint256[2], uint256[6]) view returns (bool)"];
      const verifier = new ethers.Contract(VERIFIER_ADDRESS, abi, provider);

      const pA = [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])];
      // NOT swapped — raw snarkjs order
      const pB_unswapped = [
        [BigInt(proof.pi_b[0][0]), BigInt(proof.pi_b[0][1])],
        [BigInt(proof.pi_b[1][0]), BigInt(proof.pi_b[1][1])],
      ];
      const pC = [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])];
      const pub = publicSignals.slice(0, 6).map(BigInt);

      const wrongResult = await verifier.verifyProof(pA, pB_unswapped, pC, pub);
      // Without the swap, this should fail (return false)
      expect(wrongResult).toBe(false);
    }, 30_000);
  });
}, 120_000);

// Always-run
describe("verifier address constant", () => {
  it("VERIFIER_ADDRESS matches expected deployment", () => {
    expect(VERIFIER_ADDRESS).toBe("0x70FA331534619DBd4051b22b7fb19e647be141b0");
  });
});
