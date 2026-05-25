/**
 * note.ts — UTXO Note class: commitment derivation and creation.
 *
 * A "note" is the off-chain private data that proves ownership of a shielded
 * balance. It consists of (amount, nullifierSecret, blinding). The on-chain
 * representation is only the commitment = Poseidon(amount, ns, blinding),
 * which is a random-looking field element that reveals nothing about the note.
 *
 * Commitment scheme:
 *   commitment = Poseidon(amount, nullifierSecret, blinding)  [3-input]
 *
 * Nullifier (derived separately at spend time):
 *   nullifierHash = Poseidon(nullifierSecret, leafIndex)      [2-input]
 *
 * The nullifier is NOT derivable without knowing (nullifierSecret, leafIndex),
 * so an observer cannot link a commitment to its future nullifier without the
 * spending key.
 */

import { randomBytes } from "crypto";
import { poseidon3 } from "./poseidon.js";
import type { Note, ResolvedNote } from "./types.js";

/** BN254 scalar field size (Poseidon field prime). */
const BN254_FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/** Maximum amount: 2^48 - 1 attoflow. */
const MAX_AMOUNT = (1n << 48n) - 1n;

/**
 * Generate a random BN254 field element suitable as a nullifierSecret or blinding.
 * Uses 31 bytes of randomness to stay below the field prime.
 */
export function randomFieldElement(): bigint {
  // 248 bits of randomness — always below BN254 field prime
  const bytes = randomBytes(31);
  return BigInt("0x" + Buffer.from(bytes).toString("hex"));
}

/**
 * Compute the Poseidon commitment for a note.
 *   commitment = Poseidon(amount, nullifierSecret, blinding)
 */
export async function deriveCommitment(
  amount: bigint,
  nullifierSecret: bigint,
  blinding: bigint
): Promise<bigint> {
  if (amount < 0n || amount > MAX_AMOUNT) {
    throw new RangeError(`amount must be in [0, 2^48): got ${amount}`);
  }
  if (nullifierSecret >= BN254_FIELD_SIZE || nullifierSecret < 0n) {
    throw new RangeError(`nullifierSecret must be a valid BN254 field element`);
  }
  if (blinding >= BN254_FIELD_SIZE || blinding < 0n) {
    throw new RangeError(`blinding must be a valid BN254 field element`);
  }
  return poseidon3(amount, nullifierSecret, blinding);
}

/**
 * Create a new Note with random nullifierSecret and blinding.
 * The commitment is pre-computed and stored in the note.
 *
 * The returned note does NOT have a leafIndex yet — that is assigned
 * after the shield or transfer transaction is confirmed on-chain.
 */
export async function createNote(amount: bigint): Promise<Note & { commitment: bigint }> {
  if (amount < 0n || amount > MAX_AMOUNT) {
    throw new RangeError(`amount must be in [0, 2^48): got ${amount}`);
  }
  const nullifierSecret = randomFieldElement();
  const blinding = randomFieldElement();
  const commitment = await deriveCommitment(amount, nullifierSecret, blinding);
  return { amount, nullifierSecret, blinding, commitment };
}

/**
 * Create a Note with explicit (deterministic) nullifierSecret and blinding.
 * Used for test vectors and protocol compatibility checks.
 */
export async function createNoteFromSecrets(
  amount: bigint,
  nullifierSecret: bigint,
  blinding: bigint
): Promise<Note & { commitment: bigint }> {
  const commitment = await deriveCommitment(amount, nullifierSecret, blinding);
  return { amount, nullifierSecret, blinding, commitment };
}

/**
 * Resolve a Note by adding its on-chain leafIndex.
 * Call this after a shield or transfer transaction is confirmed.
 */
export function resolveNote(note: Note & { commitment: bigint }, leafIndex: number): ResolvedNote {
  return { ...note, leafIndex };
}

/**
 * Verify a commitment matches the note contents.
 * Use to validate a received note before accepting a transfer.
 */
export async function verifyNoteCommitment(note: Note, expectedCommitment: bigint): Promise<boolean> {
  const computed = await deriveCommitment(note.amount, note.nullifierSecret, note.blinding);
  return computed === expectedCommitment;
}
