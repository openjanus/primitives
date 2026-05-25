/**
 * prove-transfer.ts — Generate Groth16 transfer proof with Merkle inclusion.
 *
 * Transfer: replace an old note with a new note (same amount, new owner).
 *   Private inputs: amount, old_ns, old_blinding, new_ns, new_blinding,
 *                   path_elements[8], path_indices[8], old_leaf_index
 *   Public signals: old_nullifier_hash, new_commitment, root
 *
 * The transfer is purely EVM-side — no FLOW moves. It proves:
 *   1. Old commitment is in the Merkle tree at the given root
 *   2. Old nullifier is correctly derived (prevents double-spend)
 *   3. New commitment is correctly formed
 *
 * After proof generation, call UTXOPool.transfer() directly (no COA needed).
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — snarkjs has no types
import * as snarkjs from "snarkjs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type {
  ResolvedNote,
  MerkleProof,
  TransferInput,
  TransferProofResult,
  SnarkProof,
} from "./types.js";
import { deriveCommitment } from "./note.js";
import { deriveNullifier } from "./nullifier.js";
import { formatProofForSolidity } from "./prove-shield.js";

const _dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(_dirname, "..");

function wasmPath(circuit: string): string {
  return join(PKG_ROOT, "circuits", "build", `${circuit}_js`, `${circuit}.wasm`);
}
function zkeyPath(circuit: string): string {
  return join(PKG_ROOT, "circuits", "setup", `${circuit}_final.zkey`);
}

/**
 * Generate a Groth16 transfer proof.
 *
 * @param oldNote - The resolved note being consumed (must have leafIndex).
 * @param newNote - The new note being created (recipient's secrets).
 * @param merklePath - Merkle inclusion proof for oldNote.
 *   Obtain via PoseidonMerkleTree.getProof(oldNote.leafIndex).
 *
 * @returns Proof + public signals ready for UTXOPool.transfer().
 */
export async function proveTransfer(
  oldNote: ResolvedNote,
  newNote: Pick<ResolvedNote, "amount" | "nullifierSecret" | "blinding"> & { commitment?: bigint },
  merklePath: MerkleProof
): Promise<TransferProofResult> {
  if (oldNote.amount !== newNote.amount) {
    throw new Error(
      `Transfer amount mismatch: old=${oldNote.amount}, new=${newNote.amount}. ` +
      `Transfer circuit enforces amount conservation (full note spend).`
    );
  }

  const oldNullifierHash = await deriveNullifier(oldNote.nullifierSecret, oldNote.leafIndex);
  const newCommitment = newNote.commitment
    ?? await deriveCommitment(newNote.amount, newNote.nullifierSecret, newNote.blinding);

  const input: TransferInput = {
    amount: oldNote.amount.toString(),
    old_nullifier_secret: oldNote.nullifierSecret.toString(),
    old_blinding: oldNote.blinding.toString(),
    new_nullifier_secret: newNote.nullifierSecret.toString(),
    new_blinding: newNote.blinding.toString(),
    path_elements: merklePath.pathElements.map(e => e.toString()),
    path_indices: merklePath.pathIndices.map(i => i.toString()),
    old_leaf_index: oldNote.leafIndex.toString(),
    old_nullifier_hash: oldNullifierHash.toString(),
    new_commitment: newCommitment.toString(),
    root: merklePath.root.toString(),
  };

  const t0 = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const { proof, publicSignals } = await (snarkjs as { groth16: { fullProve: (...args: unknown[]) => Promise<{ proof: SnarkProof; publicSignals: string[] }> } }).groth16.fullProve(
    input,
    wasmPath("transfer"),
    zkeyPath("transfer")
  );

  const proveMs = Date.now() - t0;

  return {
    proof: formatProofForSolidity(proof as SnarkProof),
    oldNullifierHash,
    newCommitment,
    root: merklePath.root,
    proveMs,
  };
}
