#!/usr/bin/env tsx
/**
 * generate-setup.ts — Regenerate Groth16 trusted setup for ElGamal circuits.
 *
 * Prerequisites:
 *   - circom >= 2.0 installed: npm install -g circom
 *   - snarkjs >= 0.7 installed: npm install -g snarkjs
 *   - Hermez pot14 beacon output at circuits/setup/pot14_final.ptau
 *
 * What this does:
 *   1. Compile both circuits (.circom -> .r1cs + .wasm)
 *   2. Phase 2 setup with pot14 (groth16 setup)
 *   3. Apply beacon contribution (Flow block hash for unbias)
 *   4. Export verification keys as JSON
 *   5. Export Solidity verifier contracts
 *
 * Usage:
 *   npx tsx scripts/generate-setup.ts [--beacon=<hex>] [--network=testnet|mainnet]
 *
 * For production: provide a Flow mainnet finalized block hash as beacon.
 * For testnet: use any recent Flow testnet block hash.
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(__dirname, "..");
const CIRCUITS_DIR = join(PKG_ROOT, "circuits");
const SETUP_DIR = join(CIRCUITS_DIR, "setup");
const BUILD_DIR = join(CIRCUITS_DIR, "build");
const CONTRACTS_DIR = join(PKG_ROOT, "contracts");

const PTAU = join(SETUP_DIR, "pot14_final.ptau");
const CIRCUITS = ["encrypt_consistency", "decrypt_open"];

function run(cmd: string, cwd = PKG_ROOT) {
  console.log(`  $ ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

function parseArgs() {
  const args = process.argv.slice(2);
  let beacon = "0000000000000000000000000000000000000000000000000000000000000000";
  let network = "testnet";
  for (const a of args) {
    if (a.startsWith("--beacon=")) beacon = a.slice(9);
    if (a.startsWith("--network=")) network = a.slice(10);
  }
  return { beacon, network };
}

async function main() {
  const { beacon, network } = parseArgs();

  console.log("[generate-setup] Starting trusted setup generation");
  console.log(`  network: ${network}`);
  console.log(`  beacon:  ${beacon.slice(0, 16)}...`);
  console.log();

  if (!existsSync(PTAU)) {
    console.error(`[generate-setup] ERROR: pot14_final.ptau not found at ${PTAU}`);
    console.error(`  Download from: https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_14.ptau`);
    console.error(`  Then run this script again.`);
    process.exit(1);
  }

  mkdirSync(BUILD_DIR, { recursive: true });
  mkdirSync(SETUP_DIR, { recursive: true });

  // Step 1: Apply beacon and prepare phase 2
  console.log("[1/5] Applying beacon contribution...");
  const ptauBeacon = join(SETUP_DIR, "pot14_beacon.ptau");
  const ptauPhase2 = join(SETUP_DIR, "pot14_phase2.ptau");

  if (!existsSync(ptauBeacon)) {
    run(`snarkjs powersoftau beacon ${PTAU} ${ptauBeacon} ${beacon} 10 -name="openjanus-elgamal-beacon-v1"`);
  }

  if (!existsSync(ptauPhase2)) {
    run(`snarkjs powersoftau prepare phase2 ${ptauBeacon} ${ptauPhase2}`);
  }

  for (const circuit of CIRCUITS) {
    console.log(`\n[generate-setup] Processing circuit: ${circuit}`);
    const circuitDir = join(BUILD_DIR, circuit);
    mkdirSync(circuitDir, { recursive: true });

    const circomFile = join(CIRCUITS_DIR, `${circuit}.circom`);
    const r1csFile = join(circuitDir, `${circuit}.r1cs`);
    const zkeyInit = join(SETUP_DIR, `${circuit}_0000.zkey`);
    const zkeyFinal = join(SETUP_DIR, `${circuit}.zkey`);
    const vkeyFile = join(SETUP_DIR, `${circuit}_vkey.json`);
    const solidityFile = join(CONTRACTS_DIR, `${circuit === "encrypt_consistency" ? "EncryptConsistencyVerifier" : "DecryptOpenVerifier"}.sol`);

    // Step 2: Compile circuit
    console.log(`[2/5] Compiling ${circuit}.circom...`);
    run(`circom ${circomFile} --r1cs --wasm --sym -o ${circuitDir} -l node_modules`, CIRCUITS_DIR);

    // Step 3: Initial phase 2 setup
    console.log(`[3/5] Phase 2 setup...`);
    run(`snarkjs groth16 setup ${r1csFile} ${ptauPhase2} ${zkeyInit}`);
    run(`snarkjs zkey contribute ${zkeyInit} ${zkeyFinal} --name="openjanus-elgamal-${circuit}" -e="${Math.random()}"`);

    // Step 4: Export verification key
    console.log(`[4/5] Exporting vkey...`);
    run(`snarkjs zkey export verificationkey ${zkeyFinal} ${vkeyFile}`);

    // Step 5: Export Solidity verifier
    console.log(`[5/5] Exporting Solidity verifier...`);
    run(`snarkjs zkey export solidityverifier ${zkeyFinal} ${solidityFile}`);

    console.log(`  Done: ${circuit}`);
  }

  console.log("\n[generate-setup] All circuits processed.");
  console.log("  Next: deploy updated verifiers with `npm run deploy`");
}

main().catch((err) => {
  console.error("[generate-setup] Error:", err.message);
  process.exit(1);
});
