/**
 * types.ts — Shared types for @openjanus/utxo
 */

// ── Note types ────────────────────────────────────────────────────────────────

/** A UTXO note: the private data a holder keeps off-chain. */
export interface Note {
  /** Deposit amount in attoflow [0, 2^48). */
  amount: bigint;
  /** Spending key secret — reveals ownership of note. Keep private. */
  nullifierSecret: bigint;
  /** Random blinding factor — hides commitment contents. */
  blinding: bigint;
  /**
   * On-chain leaf index assigned when note was shielded or received
   * via transfer. Set after insertion into the Merkle tree.
   * Required for nullifier derivation and transfer proofs.
   */
  leafIndex?: number;
  /**
   * Poseidon commitment: H(amount, nullifierSecret, blinding).
   * This value appears in the Merkle tree and on-chain events.
   */
  commitment?: bigint;
}

/** A note with all fields resolved (leaf index and commitment known). */
export interface ResolvedNote extends Note {
  leafIndex: number;
  commitment: bigint;
}

// ── Nullifier ─────────────────────────────────────────────────────────────────

/** Derived nullifier: H(nullifierSecret, leafIndex). Reveals on spend. */
export interface NullifierInfo {
  nullifierHash: bigint;
  nullifierSecret: bigint;
  leafIndex: number;
}

// ── Merkle tree ───────────────────────────────────────────────────────────────

/** Merkle inclusion proof for a leaf at a given index (depth 8). */
export interface MerkleProof {
  /** Sibling hashes at each level, bottom-up. Length = TREE_DEPTH = 8. */
  pathElements: bigint[];
  /** 0 = current is left child, 1 = current is right child. Length = 8. */
  pathIndices: number[];
  /** Merkle root this proof is valid against. */
  root: bigint;
}

// ── Circuit inputs ────────────────────────────────────────────────────────────

/**
 * Shield circuit private + public inputs.
 * Proves: commitment = Poseidon(amount, nullifierSecret, blinding)
 *         public_amount === amount
 */
export interface ShieldInput {
  // Private
  amount: string;
  nullifier_secret: string;
  blinding: string;
  // Public
  commitment: string;
  public_amount: string;
}

/**
 * Transfer circuit private + public inputs.
 * Proves: old note is in tree, new commitment is valid, nullifier is correct.
 */
export interface TransferInput {
  // Private
  amount: string;
  old_nullifier_secret: string;
  old_blinding: string;
  new_nullifier_secret: string;
  new_blinding: string;
  path_elements: string[];
  path_indices: string[];
  old_leaf_index: string;
  // Public
  old_nullifier_hash: string;
  new_commitment: string;
  root: string;
}

/**
 * Unshield circuit private + public inputs.
 * Proves: note is in tree, amount is correct, nullifier is valid.
 */
export interface UnshieldInput {
  // Private
  amount: string;
  nullifier_secret: string;
  blinding: string;
  path_elements: string[];
  path_indices: string[];
  leaf_index: string;
  // Public
  nullifier_hash: string;
  public_amount: string;
  root: string;
  recipient: string;
}

// ── Proof ─────────────────────────────────────────────────────────────────────

/** Raw snarkjs proof object. */
export interface SnarkProof {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
  protocol: string;
  curve: string;
}

/** Proof formatted for Solidity Groth16 verifier. */
export interface SolidityProof {
  pA: [bigint, bigint];
  pB: [[bigint, bigint], [bigint, bigint]];
  pC: [bigint, bigint];
}

/** Shield proof + derived public signals. */
export interface ShieldProofResult {
  proof: SolidityProof;
  commitment: bigint;
  publicAmount: bigint;
  proveMs: number;
}

/** Transfer proof + derived public signals. */
export interface TransferProofResult {
  proof: SolidityProof;
  oldNullifierHash: bigint;
  newCommitment: bigint;
  root: bigint;
  proveMs: number;
}

/** Unshield proof + derived public signals. */
export interface UnshieldProofResult {
  proof: SolidityProof;
  nullifierHash: bigint;
  publicAmount: bigint;
  root: bigint;
  recipient: string;
  proveMs: number;
}

// ── Deployed contract addresses ───────────────────────────────────────────────

/** Contract address bundle for UTXOPool + verifiers + Poseidon. */
export interface UTXOAddresses {
  utxoPool: string;
  shieldVerifier: string;
  transferVerifier: string;
  unshieldVerifier: string;
  poseidonT3: string;
  poseidonT4: string;
}
