/**
 * nullifier.ts — Nullifier derivation from (nullifierSecret, leafIndex).
 *
 * The nullifier is the on-chain "receipt" produced when spending a note.
 * It is derived deterministically from the spending key and the leaf's
 * position in the Merkle tree:
 *
 *   nullifierHash = Poseidon(nullifierSecret, leafIndex)   [2-input]
 *
 * Properties:
 *   - Deterministic: same (secret, index) always produces the same hash.
 *   - Unlinkable: without knowing nullifierSecret, an observer cannot link
 *     nullifierHash to a commitment in the tree.
 *   - Double-spend prevention: UTXOPool.nullifiers[nullifierHash] = true once spent.
 *
 * Spike note:
 *   The leafIndex must be known at spend time (transfer or unshield).
 *   For shield, the nullifier is NOT computed — it is derived only at spend time.
 *   The note holder tracks their leafIndex from on-chain Shielded/Transferred events.
 */

import { poseidon2 } from "./poseidon.js";
import type { NullifierInfo, ResolvedNote } from "./types.js";

/**
 * Derive the nullifier hash for a note at a given leaf index.
 *   nullifierHash = Poseidon(nullifierSecret, leafIndex)
 */
export async function deriveNullifier(
  nullifierSecret: bigint,
  leafIndex: number
): Promise<bigint> {
  if (leafIndex < 0 || leafIndex > 255) {
    throw new RangeError(`leafIndex must be in [0, 255] for depth-8 tree: got ${leafIndex}`);
  }
  return poseidon2(nullifierSecret, BigInt(leafIndex));
}

/**
 * Derive the full NullifierInfo for a resolved note.
 * Convenience wrapper that reads from the ResolvedNote.
 */
export async function deriveNullifierFromNote(note: ResolvedNote): Promise<NullifierInfo> {
  const nullifierHash = await deriveNullifier(note.nullifierSecret, note.leafIndex);
  return {
    nullifierHash,
    nullifierSecret: note.nullifierSecret,
    leafIndex: note.leafIndex,
  };
}

/**
 * Check if a note has already been spent by querying the pool client.
 * Returns true if the nullifier is recorded as spent on-chain.
 *
 * Note: this is a read-only check. For live status, poll isNullifierUsed()
 * on the UTXOPool contract. See pool-client.ts for the contract client.
 */
export function isNullifierSpent(
  nullifierHash: bigint,
  spentSet: Set<bigint>
): boolean {
  return spentSet.has(nullifierHash);
}
