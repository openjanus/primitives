#!/usr/bin/env tsx
/**
 * precompute-tree-zeros.ts — Compute Merkle tree zero leaves for a given depth.
 *
 * Outputs the zero hash at each level:
 *   zeros[0] = 0n (empty leaf)
 *   zeros[i] = Poseidon(zeros[i-1], zeros[i-1])
 *
 * These values are embedded in UTXOPool.sol constructor and in the
 * off-chain PoseidonMerkleTree class.
 *
 * Usage:
 *   npx tsx scripts/precompute-tree-zeros.ts [--depth=8]
 *
 * Output format: TypeScript constants + JSON for Solidity hardcoding.
 */

import { buildPoseidon } from "circomlibjs";

const depth = parseInt(
  process.argv.find(a => a.startsWith("--depth="))?.slice(8) ?? "8"
);

async function main() {
  console.log(`\n=== Poseidon Merkle Tree Zeros (depth=${depth}) ===\n`);

  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  const zeros: bigint[] = [0n];
  for (let i = 1; i <= depth; i++) {
    zeros.push(F.toObject(poseidon([zeros[i - 1]!, zeros[i - 1]!])));
  }

  console.log("// TypeScript constants:");
  for (let i = 0; i <= depth; i++) {
    console.log(`// zeros[${i}] = 0x${zeros[i]!.toString(16)}`);
  }

  console.log("\n// JSON:");
  console.log(JSON.stringify(zeros.map(z => z.toString()), null, 2));

  console.log("\n// Solidity hardcode (uint256 array):");
  for (let i = 0; i <= depth; i++) {
    console.log(`zeros[${i}] = ${zeros[i]};`);
  }

  console.log(`\n// Initial root (empty tree): 0x${zeros[depth]!.toString(16)}`);
  console.log(`// This is zeros[${depth}] and is registered as a historicalRoot at construction.`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
