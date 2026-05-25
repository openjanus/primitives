#!/usr/bin/env tsx
/**
 * generate-setup.ts — Regenerate trusted setup for shield/transfer/unshield circuits.
 *
 * WARNING: This regenerates the trusted setup. The existing setup in
 * circuits/setup/ was used to deploy the canonical testnet contracts.
 * Regenerating creates INCOMPATIBLE keys — only do this for a fresh deployment.
 *
 * This script uses pot14_final.ptau from the Hermez trusted setup ceremony
 * (or a local test ptau for development). For production, use a larger ptau
 * and perform a proper multi-party ceremony.
 *
 * Usage:
 *   npx tsx scripts/generate-setup.ts [--ptau=path/to/pot.ptau]
 *
 * Requires: circom, snarkjs installed in PATH.
 *   npm install -g circom snarkjs
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const _dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(_dirname, "..");
const CIRCUITS_DIR = join(PKG_ROOT, "circuits");
const SETUP_DIR = join(CIRCUITS_DIR, "setup");
const BUILD_DIR = join(CIRCUITS_DIR, "build");

const PTAU = process.argv.find(a => a.startsWith("--ptau="))?.slice(7)
  ?? join(SETUP_DIR, "pot14_final.ptau");

function run(cmd: string): void {
  console.log(`  $ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

async function main() {
  console.log("\n=== UTXOPool Trusted Setup Regeneration ===\n");
  console.log("WARNING: This creates INCOMPATIBLE zkeys with the canonical testnet deployment.");
  console.log("Only continue if you are deploying a fresh UTXOPool instance.");
  console.log("");

  if (!existsSync(PTAU)) {
    console.error(`ERROR: ptau file not found: ${PTAU}`);
    console.error("Download from: https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_14.ptau");
    process.exit(1);
  }

  mkdirSync(BUILD_DIR, { recursive: true });

  for (const circuit of ["shield", "transfer", "unshield"]) {
    console.log(`\n--- Processing ${circuit} circuit ---`);

    // 1. Compile circom
    run(`circom ${CIRCUITS_DIR}/${circuit}.circom --r1cs --wasm --sym --output ${BUILD_DIR} -l node_modules`);

    // 2. Phase 2 setup
    run(`snarkjs groth16 setup ${BUILD_DIR}/${circuit}.r1cs ${PTAU} ${SETUP_DIR}/${circuit}_0000.zkey`);

    // 3. Contribute randomness (single contributor — NOT production)
    run(`echo "test contribution" | snarkjs zkey contribute ${SETUP_DIR}/${circuit}_0000.zkey ${SETUP_DIR}/${circuit}_final.zkey --name="testnet-setup" -v`);

    // 4. Export verification key
    run(`snarkjs zkey export verificationkey ${SETUP_DIR}/${circuit}_final.zkey ${SETUP_DIR}/${circuit}_vkey.json`);

    // 5. Export Solidity verifier
    run(`snarkjs zkey export solidityverifier ${SETUP_DIR}/${circuit}_final.zkey ${PKG_ROOT}/contracts/verifiers/${circuit.charAt(0).toUpperCase() + circuit.slice(1)}Groth16Verifier_new.sol`);

    console.log(`  ${circuit}: done`);
  }

  console.log("\n=== Setup Complete ===");
  console.log("Next steps:");
  console.log("  1. Deploy fresh Poseidon contracts (circomlibjs.poseidonContract)");
  console.log("  2. Deploy new Groth16 verifiers (from _new.sol files)");
  console.log("  3. Deploy UTXOPool with new verifier + Poseidon addresses");
  console.log("  4. Run: RUN_INTEGRATION=1 npm test");
}

main().catch(e => { console.error(e.message); process.exit(1); });
