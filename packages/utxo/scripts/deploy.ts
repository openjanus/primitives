#!/usr/bin/env tsx
/**
 * deploy.ts — Deploy UTXOPool + verifiers + Poseidon to Flow EVM.
 *
 * IMPORTANT: The canonical testnet deployment already exists and is REUSED.
 * Only run this script if you need a fresh deployment (e.g., for a fork).
 *
 * Canonical testnet addresses (DO NOT redeploy these):
 *   UTXOPool:                0x6c1c172068f8325bd1f6564bc2fBa5B0A9BB1725
 *   ShieldGroth16Verifier:   0xCDfc8496C28a6d7e931C2A4FC95709381A43365D
 *   TransferGroth16Verifier: 0x25bd550F8fE81A0A9f5bf43a0BCf40152F9C4674
 *   UnshieldGroth16Verifier: 0xbe5449F55D1edb695aA08a5cee34885AcD60DC50
 *   PoseidonT3:              0xAA31b4EE06282d2580550C25dC32B5EAF0712F1E
 *   PoseidonT4:              0xda71Ba9ecAb56dAa64fEc9CD6fC2a8782862CF25
 *
 * Usage:
 *   PRIVATE_KEY=<hex> COA_ADDRESS=<hex> npx tsx scripts/deploy.ts
 *
 * Requires:
 *   PRIVATE_KEY  — deployer EOA private key (hex, no 0x)
 *   COA_ADDRESS  — Cadence COA address that will control shield/unshield
 *   RPC_URL      — optional override (default: Flow EVM testnet)
 */

import { JsonRpcProvider, Wallet, ContractFactory } from "ethers";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const _dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(_dirname, "..");

const RPC_URL = process.env["RPC_URL"] ?? "https://testnet.evm.nodes.onflow.org";
const CHAIN_ID = 545;

async function main() {
  const privateKey = process.env["PRIVATE_KEY"];
  const coaAddress = process.env["COA_ADDRESS"];

  if (!privateKey) {
    console.error("ERROR: PRIVATE_KEY env var required");
    process.exit(1);
  }
  if (!coaAddress) {
    console.error("ERROR: COA_ADDRESS env var required (Cadence COA that will call shield/unshield)");
    process.exit(1);
  }

  console.log("[deploy] Flow EVM UTXO Package — Fresh Deployment");
  console.log("[deploy] WARNING: Canonical testnet contracts already exist. Only proceed if you need a fresh instance.");
  console.log(`[deploy] RPC: ${RPC_URL}`);
  console.log(`[deploy] COA: ${coaAddress}`);
  console.log();

  const provider = new JsonRpcProvider(RPC_URL, { chainId: CHAIN_ID, name: "flow-evm" });
  const wallet = new Wallet(privateKey, provider);
  const deployer = await wallet.getAddress();
  console.log(`[deploy] Deployer: ${deployer}`);

  const artifactsDir = join(PKG_ROOT, "hardhat", "artifacts", "contracts");

  // Helper: load artifact and deploy
  async function deploy(contractPath: string, contractName: string, args: unknown[] = []): Promise<string> {
    const artifact = JSON.parse(readFileSync(join(artifactsDir, contractPath), "utf8"));
    const factory = new ContractFactory(artifact.abi, artifact.bytecode, wallet);
    console.log(`  Deploying ${contractName}...`);
    const contract = await factory.deploy(...args);
    await contract.waitForDeployment();
    const addr = await contract.getAddress();
    console.log(`  ${contractName}: ${addr}`);
    return addr;
  }

  const deployments: Record<string, unknown> = {
    network: "flow-evm-testnet",
    chainId: CHAIN_ID,
    deployedAt: new Date().toISOString(),
    deployer,
    coaAddress,
  };

  // 1. Deploy Poseidon contracts
  const poseidonT3 = await deploy("poseidon/PoseidonT3.sol/PoseidonT3.json", "PoseidonT3");
  const poseidonT4 = await deploy("poseidon/PoseidonT4.sol/PoseidonT4.json", "PoseidonT4");

  // 2. Deploy Groth16 verifiers
  const shieldVerifier   = await deploy("verifiers/ShieldGroth16Verifier.sol/ShieldGroth16Verifier.json", "ShieldGroth16Verifier");
  const transferVerifier = await deploy("verifiers/TransferGroth16Verifier.sol/TransferGroth16Verifier.json", "TransferGroth16Verifier");
  const unshieldVerifier = await deploy("verifiers/UnshieldGroth16Verifier.sol/UnshieldGroth16Verifier.json", "UnshieldGroth16Verifier");

  // 3. Deploy UTXOPool
  const utxoPool = await deploy("UTXOPool.sol/UTXOPool.json", "UTXOPool", [
    shieldVerifier,
    transferVerifier,
    unshieldVerifier,
    poseidonT3,
    poseidonT4,
    coaAddress,
  ]);

  Object.assign(deployments, {
    contracts: { PoseidonT3: poseidonT3, PoseidonT4: poseidonT4, ShieldGroth16Verifier: shieldVerifier, TransferGroth16Verifier: transferVerifier, UnshieldGroth16Verifier: unshieldVerifier, UTXOPool: utxoPool },
  });

  const outPath = join(PKG_ROOT, "deployments", "fresh_deployment.json");
  writeFileSync(outPath, JSON.stringify(deployments, null, 2));
  console.log(`\n[deploy] Saved to ${outPath}`);
  console.log(JSON.stringify(deployments, null, 2));
}

main().catch(e => { console.error("[deploy]", e.message); process.exit(1); });
