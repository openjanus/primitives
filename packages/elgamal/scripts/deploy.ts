#!/usr/bin/env tsx
/**
 * deploy.ts — Deploy ElGamal verifiers and accumulator to Flow EVM.
 *
 * Usage:
 *   npx tsx scripts/deploy.ts [--network=testnet|mainnet] [--babyjub=0x...]
 *
 * Flow EVM testnet ChainId: 545
 * Flow EVM mainnet ChainId: 747
 *
 * The BabyJub helper contract is already deployed at:
 *   Testnet: 0x27139AFda7425f51F68D32e0A38b7D43BcB0f870
 *   Mainnet: (update after mainnet deployment)
 *
 * Requires env:
 *   PRIVATE_KEY  — deployer EOA private key (hex, no 0x prefix)
 *   RPC_URL      — optional override for RPC endpoint
 */

import { JsonRpcProvider, Wallet, ContractFactory, parseUnits } from "ethers";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(__dirname, "..");

const BABYJUB_ADDRESSES: Record<string, string> = {
  testnet: "0x27139AFda7425f51F68D32e0A38b7D43BcB0f870",
  mainnet: "0x0000000000000000000000000000000000000000", // update before mainnet deploy
};

const RPC_URLS: Record<string, string> = {
  testnet: "https://testnet.evm.nodes.onflow.org",
  mainnet: "https://mainnet.evm.nodes.onflow.org",
};

const CHAIN_IDS: Record<string, number> = {
  testnet: 545,
  mainnet: 747,
};

function parseArgs() {
  const args = process.argv.slice(2);
  let network = "testnet";
  let babyjubOverride: string | undefined;
  for (const a of args) {
    if (a.startsWith("--network=")) network = a.slice(10);
    if (a.startsWith("--babyjub=")) babyjubOverride = a.slice(10);
  }
  return { network, babyjubOverride };
}

async function deployContract(
  wallet: Wallet,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  artifact: any,
  constructorArgs: unknown[] = [],
  name = "Contract"
): Promise<string> {
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, wallet);
  console.log(`  Deploying ${name}...`);
  const contract = await factory.deploy(...constructorArgs);
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log(`  ${name} deployed at: ${addr}`);
  return addr;
}

async function main() {
  const { network, babyjubOverride } = parseArgs();
  const babyjubAddr = babyjubOverride ?? BABYJUB_ADDRESSES[network];
  const rpcUrl = process.env.RPC_URL ?? RPC_URLS[network];
  const chainId = CHAIN_IDS[network];

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("ERROR: PRIVATE_KEY env var required");
    process.exit(1);
  }

  console.log(`[deploy] Network: ${network} (chainId ${chainId})`);
  console.log(`[deploy] RPC: ${rpcUrl}`);
  console.log(`[deploy] BabyJub: ${babyjubAddr}`);
  console.log();

  const provider = new JsonRpcProvider(rpcUrl, { chainId, name: `flow-evm-${network}` });
  const wallet = new Wallet(privateKey, provider);
  const deployer = await wallet.getAddress();
  console.log(`[deploy] Deployer: ${deployer}`);

  // Load artifacts from hardhat build
  const artifactsDir = join(PKG_ROOT, "hardhat", "artifacts", "contracts");

  const deployments: Record<string, string> = {
    network,
    babyjub: babyjubAddr,
    deployedAt: new Date().toISOString(),
  } as unknown as Record<string, string>;

  try {
    const encArtifact = JSON.parse(
      readFileSync(join(artifactsDir, "EncryptConsistencyVerifier.sol", "Groth16Verifier.json"), "utf8")
    );
    deployments.EncryptConsistencyVerifier = await deployContract(wallet, encArtifact, [], "EncryptConsistencyVerifier");
  } catch (e) {
    console.warn("  WARNING: EncryptConsistencyVerifier artifact not found — run hardhat compile first");
  }

  try {
    const decArtifact = JSON.parse(
      readFileSync(join(artifactsDir, "DecryptOpenVerifier.sol", "Groth16Verifier.json"), "utf8")
    );
    deployments.DecryptOpenVerifier = await deployContract(wallet, decArtifact, [], "DecryptOpenVerifier");
  } catch (e) {
    console.warn("  WARNING: DecryptOpenVerifier artifact not found — run hardhat compile first");
  }

  try {
    const accArtifact = JSON.parse(
      readFileSync(join(artifactsDir, "ElGamalAccumulator.sol", "ElGamalAccumulator.json"), "utf8")
    );
    deployments.ElGamalAccumulator = await deployContract(wallet, accArtifact, [babyjubAddr], "ElGamalAccumulator");
  } catch (e) {
    console.warn("  WARNING: ElGamalAccumulator artifact not found — run hardhat compile first");
  }

  const outPath = join(PKG_ROOT, "deployments", `${network}.json`);
  writeFileSync(outPath, JSON.stringify(deployments, null, 2));
  console.log(`\n[deploy] Deployments saved to ${outPath}`);
  console.log(JSON.stringify(deployments, null, 2));
}

main().catch((err) => {
  console.error("[deploy] Error:", err.message);
  process.exit(1);
});
