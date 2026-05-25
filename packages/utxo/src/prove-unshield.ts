/**
 * prove-unshield.ts — Generate Groth16 unshield proof.
 *
 * Unshield: withdraw FLOW from the privacy pool.
 *   Private inputs: amount, nullifier_secret, blinding,
 *                   path_elements[8], path_indices[8], leaf_index
 *   Public signals: nullifier_hash, public_amount, root, recipient
 *
 * The proof binds to a specific recipient address to prevent front-running
 * (recipient is encoded as a uint256 field element = uint160(address)).
 *
 * After proof generation, call UTXOPool.unshield() via Cadence COA.
 * The Cadence layer releases FLOW from its vault after the EVM call succeeds.
 *
 * IMPORTANT: public_amount is revealed on unshield. This is a privacy
 * limitation of the current spike design. Production systems should use
 * fixed denomination (like Tornado Cash) to hide amounts.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — snarkjs has no types
import * as snarkjs from "snarkjs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type {
  ResolvedNote,
  MerkleProof,
  UnshieldInput,
  UnshieldProofResult,
  SnarkProof,
} from "./types.js";
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
 * Generate a Groth16 unshield proof.
 *
 * @param note - The resolved note being consumed (must have leafIndex).
 * @param merklePath - Merkle inclusion proof for the note.
 * @param recipient - EVM address that will receive the FLOW (hex with 0x).
 *
 * @returns Proof + public signals ready for UTXOPool.unshield() via COA.
 */
export async function proveUnshield(
  note: ResolvedNote,
  merklePath: MerkleProof,
  recipient: string
): Promise<UnshieldProofResult> {
  const nullifierHash = await deriveNullifier(note.nullifierSecret, note.leafIndex);

  // Encode recipient as field element: uint256(uint160(recipient))
  const recipientBigInt = BigInt(recipient);

  const input: UnshieldInput = {
    amount: note.amount.toString(),
    nullifier_secret: note.nullifierSecret.toString(),
    blinding: note.blinding.toString(),
    path_elements: merklePath.pathElements.map(e => e.toString()),
    path_indices: merklePath.pathIndices.map(i => i.toString()),
    leaf_index: note.leafIndex.toString(),
    nullifier_hash: nullifierHash.toString(),
    public_amount: note.amount.toString(),
    root: merklePath.root.toString(),
    recipient: recipientBigInt.toString(),
  };

  const t0 = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const { proof, publicSignals } = await (snarkjs as { groth16: { fullProve: (...args: unknown[]) => Promise<{ proof: SnarkProof; publicSignals: string[] }> } }).groth16.fullProve(
    input,
    wasmPath("unshield"),
    zkeyPath("unshield")
  );

  const proveMs = Date.now() - t0;

  return {
    proof: formatProofForSolidity(proof as SnarkProof),
    nullifierHash,
    publicAmount: note.amount,
    root: merklePath.root,
    recipient,
    proveMs,
  };
}
