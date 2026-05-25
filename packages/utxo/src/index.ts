/**
 * @openjanus/utxo — Privacy UTXO primitive for Flow EVM.
 *
 * Merkle tree + nullifiers + ZK shield/transfer/unshield.
 * Foundation for AurumFlow-class RAILGUN-style privacy apps on Flow.
 *
 * IMPORTANT CAVEATS (read before using):
 *   - Testnet-grade trusted setup (single-contributor pot14, NOT production)
 *   - Depth-8 Merkle tree (256 leaves max — not production scale)
 *   - No relayer (centralization risk for production)
 *   - Amount is revealed on unshield (privacy limitation)
 *   - No POI/compliance layer
 *
 * See docs/PRIVACY_PROPERTIES.md for an honest assessment.
 * See docs/ROADMAP_AURUMFLOW.md for the path to production.
 *
 * @example
 * ```ts
 * import {
 *   createNote, proveShield, proveTransfer, proveUnshield,
 *   PoseidonMerkleTree, UTXOPoolClient
 * } from "@openjanus/utxo";
 *
 * // Alice creates a note and shields 10 FLOW
 * const aliceNote = await createNote(10n);
 * const shieldResult = await proveShield(aliceNote);
 *
 * // Get calldata for shield() via Cadence COA
 * const client = UTXOPoolClient.testnet();
 * const calldata = client.encodeShield(
 *   shieldResult.proof,
 *   shieldResult.commitment,
 *   shieldResult.publicAmount
 * );
 *
 * // After on-chain confirmation, resolve the note with its leaf index
 * const resolvedAlice = { ...aliceNote, commitment: shieldResult.commitment, leafIndex: 0 };
 *
 * // Build local Merkle tree to generate transfer proof
 * const tree = await PoseidonMerkleTree.create();
 * await tree.insertLeaf(shieldResult.commitment);
 * const path = await tree.getProof(0);
 *
 * // Bob receives note — Alice generates transfer proof
 * const bobNote = await createNote(10n);
 * const transferResult = await proveTransfer(resolvedAlice, bobNote, path);
 * ```
 */

// ── Poseidon (canonical — always from circomlibjs) ────────────────────────────
export {
  getPoseidon,
  poseidon2,
  poseidon3,
  assertCanonicalPoseidon,
  POSEIDON_CANONICAL_HASH_0_0,
} from "./poseidon.js";

// ── Note ──────────────────────────────────────────────────────────────────────
export {
  createNote,
  createNoteFromSecrets,
  deriveCommitment,
  resolveNote,
  verifyNoteCommitment,
  randomFieldElement,
} from "./note.js";

// ── Nullifier ─────────────────────────────────────────────────────────────────
export {
  deriveNullifier,
  deriveNullifierFromNote,
  isNullifierSpent,
} from "./nullifier.js";

// ── Merkle tree ───────────────────────────────────────────────────────────────
export {
  PoseidonMerkleTree,
  rebuildTreeFromLeaves,
  TREE_DEPTH,
  MAX_LEAVES,
} from "./merkle.js";

// ── Proof generation ──────────────────────────────────────────────────────────
export { proveShield, formatProofForSolidity } from "./prove-shield.js";
export { proveTransfer } from "./prove-transfer.js";
export { proveUnshield } from "./prove-unshield.js";

// ── Pool client ───────────────────────────────────────────────────────────────
export {
  UTXOPoolClient,
  TESTNET_ADDRESSES,
  FLOW_EVM_TESTNET_RPC,
  FLOW_EVM_TESTNET_CHAIN_ID,
} from "./pool-client.js";

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  Note,
  ResolvedNote,
  NullifierInfo,
  MerkleProof,
  ShieldInput,
  TransferInput,
  UnshieldInput,
  SnarkProof,
  SolidityProof,
  ShieldProofResult,
  TransferProofResult,
  UnshieldProofResult,
  UTXOAddresses,
} from "./types.js";
