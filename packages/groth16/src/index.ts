/**
 * @openjanus/groth16
 *
 * TypeScript SDK for Groth16 proof generation and verification on Flow EVM.
 * Wraps snarkJS with the pi_b Fp2 swap applied automatically.
 *
 * Reference circuit: ConfidentialTransfer v2
 * Reference verifier: 0x70FA331534619DBd4051b22b7fb19e647be141b0 (Flow EVM testnet)
 */

// ---------------------------------------------------------------------------
// Deployed addresses
// ---------------------------------------------------------------------------

/** ConfidentialTransferVerifier.sol on Flow EVM testnet */
export const VERIFIER_ADDRESS = "0x70FA331534619DBd4051b22b7fb19e647be141b0";

/** Flow EVM testnet RPC */
export const FLOW_EVM_TESTNET_RPC = "https://testnet.evm.nodes.onflow.org";

/** ABI selector for verifyProof(uint256[2],uint256[2][2],uint256[2],uint256[6]) */
export const VERIFY_PROOF_SELECTOR = "0xf398789b";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Raw snarkJS proof object (as returned by groth16.fullProve) */
export interface SnarkJSProof {
  pi_a: [string, string, string];           // G1 point [x, y, "1"]
  pi_b: [[string, string], [string, string], [string, string]]; // G2 point Fp2 in snarkjs order
  pi_c: [string, string, string];           // G1 point [x, y, "1"]
  protocol: string;
  curve: string;
}

/** Proof formatted for EVM verifyProof() call (pi_b Fp2 swap applied) */
export interface EVMProof {
  pA: [bigint, bigint];
  pB: [[bigint, bigint], [bigint, bigint]];   // pi_b with Fp2 swap applied
  pC: [bigint, bigint];
}

/** Public signals for the ConfidentialTransfer circuit */
export interface ConfidentialTransferPublicSignals {
  oldCommitX: bigint;
  oldCommitY: bigint;
  transferCommitX: bigint;
  transferCommitY: bigint;
  newCommitX: bigint;
  newCommitY: bigint;
}

// ---------------------------------------------------------------------------
// Core: pi_b swap
// ---------------------------------------------------------------------------

/**
 * Convert a snarkJS proof to EVM-ready format.
 *
 * The critical transformation: pi_b Fp2 coordinates are swapped.
 * snarkJS:  [[re0, im0], [re1, im1]]
 * EIP-197:  [[im0, re0], [im1, re1]]
 *
 * Without this swap, verifyProof returns false even for valid proofs.
 * See research/PIB_SWAP.md for the full explanation.
 *
 * @param proof  Raw snarkJS proof object
 * @returns      EVM-ready proof with pi_b swap applied
 */
export function proofToEVMFormat(proof: SnarkJSProof): EVMProof {
  return {
    pA: [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])],
    pB: [
      // Swap: [re, im] → [im, re] for each Fp2 element
      [BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])],
      [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])],
    ],
    pC: [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])],
  };
}

// ---------------------------------------------------------------------------
// Public signal formatting
// ---------------------------------------------------------------------------

/**
 * Convert ConfidentialTransfer public signals to the ordered array
 * expected by verifyProof().
 *
 * Signal order (per circuit declaration):
 *   [0] old_commit.x, [1] old_commit.y
 *   [2] transfer_commit.x, [3] transfer_commit.y
 *   [4] new_commit.x, [5] new_commit.y
 */
export function pubSignalsToArray(
  signals: ConfidentialTransferPublicSignals
): bigint[] {
  return [
    signals.oldCommitX,
    signals.oldCommitY,
    signals.transferCommitX,
    signals.transferCommitY,
    signals.newCommitX,
    signals.newCommitY,
  ];
}

/**
 * Parse the raw snarkJS public signals array into a typed object.
 * snarkJS returns public signals as decimal strings.
 */
export function parsePublicSignals(
  raw: string[]
): ConfidentialTransferPublicSignals {
  if (raw.length !== 6) {
    throw new Error(`Expected 6 public signals, got ${raw.length}`);
  }
  return {
    oldCommitX: BigInt(raw[0]),
    oldCommitY: BigInt(raw[1]),
    transferCommitX: BigInt(raw[2]),
    transferCommitY: BigInt(raw[3]),
    newCommitX: BigInt(raw[4]),
    newCommitY: BigInt(raw[5]),
  };
}

// ---------------------------------------------------------------------------
// On-chain verification
// ---------------------------------------------------------------------------

export interface VerifyOnChainOptions {
  rpc?: string;
  address?: string;
}

/**
 * Call the deployed ConfidentialTransferVerifier on Flow EVM testnet.
 *
 * Automatically applies the pi_b Fp2 swap before calling the contract.
 *
 * @param proof         Raw snarkJS proof
 * @param publicSignals Raw snarkJS public signals (6 decimal strings)
 * @param opts          RPC and address overrides
 * @returns             true if the proof is valid on-chain
 */
export async function verifyOnChain(
  proof: SnarkJSProof,
  publicSignals: string[],
  opts: VerifyOnChainOptions = {}
): Promise<boolean> {
  const { ethers } = await import("ethers");
  const rpc = opts.rpc ?? FLOW_EVM_TESTNET_RPC;
  const address = opts.address ?? VERIFIER_ADDRESS;

  const provider = new ethers.JsonRpcProvider(rpc);
  const abi = [
    "function verifyProof(uint256[2] calldata _pA, uint256[2][2] calldata _pB, uint256[2] calldata _pC, uint256[6] calldata _pubSignals) public view returns (bool)",
  ];
  const verifier = new ethers.Contract(address, abi, provider);

  const { pA, pB, pC } = proofToEVMFormat(proof);
  const pub = publicSignals.slice(0, 6).map((s) => BigInt(s));

  return verifier.verifyProof(pA, pB, pC, pub);
}

/**
 * Estimate gas for verifyProof on the deployed contract.
 */
export async function estimateVerifyGas(
  proof: SnarkJSProof,
  publicSignals: string[],
  opts: VerifyOnChainOptions = {}
): Promise<bigint> {
  const { ethers } = await import("ethers");
  const rpc = opts.rpc ?? FLOW_EVM_TESTNET_RPC;
  const address = opts.address ?? VERIFIER_ADDRESS;

  const provider = new ethers.JsonRpcProvider(rpc);
  const abi = [
    "function verifyProof(uint256[2] calldata _pA, uint256[2][2] calldata _pB, uint256[2] calldata _pC, uint256[6] calldata _pubSignals) public view returns (bool)",
  ];
  const verifier = new ethers.Contract(address, abi, provider);

  const { pA, pB, pC } = proofToEVMFormat(proof);
  const pub = publicSignals.slice(0, 6).map((s) => BigInt(s));

  return verifier.verifyProof.estimateGas(pA, pB, pC, pub);
}

// ---------------------------------------------------------------------------
// Local verification (snarkjs)
// ---------------------------------------------------------------------------

/**
 * Verify a proof locally using snarkjs (no network required).
 * Requires the verification key JSON.
 */
export async function verifyLocally(
  vk: object,
  proof: SnarkJSProof,
  publicSignals: string[]
): Promise<boolean> {
  const snarkjs = await import("snarkjs");
  return snarkjs.groth16.verify(vk, publicSignals, proof);
}

// ---------------------------------------------------------------------------
// Proof generation helper
// ---------------------------------------------------------------------------

export interface ProveOptions {
  wasmPath: string;
  zkeyPath: string;
}

/**
 * Generate a Groth16 proof for the ConfidentialTransfer circuit.
 *
 * @param input    Circuit inputs (private + public)
 * @param opts     Paths to WASM and zkey files
 * @returns        Raw snarkJS proof and public signals
 */
export async function prove(
  input: Record<string, unknown>,
  opts: ProveOptions
): Promise<{ proof: SnarkJSProof; publicSignals: string[] }> {
  const snarkjs = await import("snarkjs");
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    opts.wasmPath,
    opts.zkeyPath
  );
  return { proof: proof as SnarkJSProof, publicSignals };
}
