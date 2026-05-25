/**
 * prove-shield.ts — Generate Groth16 shield proof.
 *
 * Shield: deposit FLOW into the privacy pool.
 *   Private inputs: amount, nullifierSecret, blinding
 *   Public signals: commitment, public_amount
 *
 * The generated proof + commitment is passed to UTXOPool.shield() via Cadence COA.
 * The Cadence layer handles FLOW custody; this circuit only proves the commitment
 * is correctly formed.
 *
 * NOTE: The shield circuit does NOT include a leaf_index. The nullifier is
 * derived separately at spend time using (nullifierSecret, leafIndex).
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — snarkjs has no types
import * as snarkjs from "snarkjs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { Note, ShieldInput, ShieldProofResult, SolidityProof, SnarkProof } from "./types.js";
import { deriveCommitment } from "./note.js";

const _dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(_dirname, "..");

function wasmPath(circuit: string): string {
  return join(PKG_ROOT, "circuits", "build", `${circuit}_js`, `${circuit}.wasm`);
}
function zkeyPath(circuit: string): string {
  return join(PKG_ROOT, "circuits", "setup", `${circuit}_final.zkey`);
}

/**
 * Format a snarkjs proof for Solidity Groth16 verifier.
 * pB components are swapped for EVM pairing convention.
 */
export function formatProofForSolidity(proof: SnarkProof): SolidityProof {
  return {
    pA: [BigInt(proof.pi_a[0]!), BigInt(proof.pi_a[1]!)],
    pB: [
      [BigInt(proof.pi_b[0]![1]!), BigInt(proof.pi_b[0]![0]!)],
      [BigInt(proof.pi_b[1]![1]!), BigInt(proof.pi_b[1]![0]!)],
    ],
    pC: [BigInt(proof.pi_c[0]!), BigInt(proof.pi_c[1]!)],
  };
}

/**
 * Generate a Groth16 shield proof.
 *
 * @param note - Note containing amount, nullifierSecret, blinding.
 *   The commitment will be derived if not present on the note.
 * @returns Proof + public signals ready for UTXOPool.shield().
 */
export async function proveShield(
  note: Pick<Note, "amount" | "nullifierSecret" | "blinding"> & { commitment?: bigint }
): Promise<ShieldProofResult> {
  const { amount, nullifierSecret, blinding } = note;

  const commitment = note.commitment ?? await deriveCommitment(amount, nullifierSecret, blinding);

  const input: ShieldInput = {
    amount: amount.toString(),
    nullifier_secret: nullifierSecret.toString(),
    blinding: blinding.toString(),
    commitment: commitment.toString(),
    public_amount: amount.toString(),
  };

  const t0 = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const { proof, publicSignals } = await (snarkjs as { groth16: { fullProve: (...args: unknown[]) => Promise<{ proof: SnarkProof; publicSignals: string[] }> } }).groth16.fullProve(
    input,
    wasmPath("shield"),
    zkeyPath("shield")
  );

  const proveMs = Date.now() - t0;

  return {
    proof: formatProofForSolidity(proof as SnarkProof),
    commitment,
    publicAmount: BigInt(publicSignals[1]!),
    proveMs,
  };
}
