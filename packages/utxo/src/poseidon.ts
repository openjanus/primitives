/**
 * poseidon.ts — Canonical Poseidon hash re-export from circomlibjs.
 *
 * CRITICAL: Always use this module for Poseidon hashing in @openjanus/utxo.
 *
 * vuln #012 lesson: Hand-written Yul Poseidon contracts are BROKEN.
 * The on-chain PoseidonT3/T4 contracts used in UTXOPool were hand-written Yul
 * and produced incorrect hashes for some inputs. The circuits use circomlib's
 * Poseidon template which is the canonical reference implementation.
 *
 * For off-chain computation, always use circomlibjs buildPoseidon():
 *   - buildPoseidon() returns a function f([a, b]) for 2-input (t=3)
 *   - buildPoseidon() returns a function f([a, b, c]) for 3-input (t=4)
 *   - The same function handles any arity up to t-1 inputs
 *
 * Canonical check: Poseidon([0, 0]) MUST equal 0x2098f5...
 *   If this check fails, your Poseidon implementation is wrong.
 *
 * Usage:
 *   import { getPoseidon, poseidon2, poseidon3, POSEIDON_ZERO_LEAF } from "@openjanus/utxo";
 *
 *   const h = await poseidon2(a, b);          // 2-input (Merkle tree)
 *   const c = await poseidon3(a, b, blinding); // 3-input (commitment)
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — circomlibjs has no types
import { buildPoseidon } from "circomlibjs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PoseidonFn = any;

// Module-level singleton to avoid rebuilding on every call
let _poseidon: PoseidonFn | null = null;

/**
 * Initialize and return the circomlibjs Poseidon hasher (cached singleton).
 * The returned function accepts an array of bigints and returns a field element.
 */
export async function getPoseidon(): Promise<PoseidonFn> {
  if (_poseidon === null) {
    _poseidon = await buildPoseidon();
  }
  return _poseidon;
}

/**
 * 2-input Poseidon hash: H(a, b).
 * Used for: Merkle tree nodes, nullifier hash.
 *
 * Canonical: poseidon2(0n, 0n) === POSEIDON_ZERO_LEAF_HASH
 */
export async function poseidon2(a: bigint, b: bigint): Promise<bigint> {
  const poseidon = await getPoseidon();
  return poseidon.F.toObject(poseidon([a, b]));
}

/**
 * 3-input Poseidon hash: H(a, b, c).
 * Used for: note commitment = H(amount, nullifierSecret, blinding).
 */
export async function poseidon3(a: bigint, b: bigint, c: bigint): Promise<bigint> {
  const poseidon = await getPoseidon();
  return poseidon.F.toObject(poseidon([a, b, c]));
}

/**
 * The canonical Poseidon zero-leaf hash: Poseidon([0, 0]).
 *
 * Value: 0x2098f5fb9e239eab3ceac3f27b81e481dc3124d55ffed523a839ee8446b64864
 *
 * This is the standard circomlibjs BN254 Poseidon output for inputs [0, 0].
 * Used to initialize zero-subtrees in the Merkle tree.
 *
 * NOTE: This value is NOT used as zeros[0] in the UTXOPool (which uses 0n as the
 * empty leaf value). It is provided as a sanity-check canonical constant.
 * The tree zeros are computed as zeros[i] = Poseidon(zeros[i-1], zeros[i-1])
 * starting from zeros[0] = 0n.
 */
export const POSEIDON_CANONICAL_HASH_0_0 = 0x2098f5fb9e239eab3ceac3f27b81e481dc3124d55ffed523a839ee8446b64864n;

/**
 * Verify the canonical Poseidon implementation at runtime.
 * Throws if the implementation produces a wrong hash.
 *
 * Call this once at startup in production to catch bad implementations.
 */
export async function assertCanonicalPoseidon(): Promise<void> {
  const result = await poseidon2(0n, 0n);
  if (result !== POSEIDON_CANONICAL_HASH_0_0) {
    throw new Error(
      `CRITICAL: Poseidon implementation is not canonical.\n` +
      `Expected: ${POSEIDON_CANONICAL_HASH_0_0.toString(16)}\n` +
      `Got:      ${result.toString(16)}\n` +
      `Only use circomlibjs buildPoseidon() — never hand-written Yul.`
    );
  }
}
