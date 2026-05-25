// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * IGroth16VerifierFixed — Per-verifier interfaces with FIXED-SIZE public signal arrays.
 *
 * vuln #013 lesson: NEVER use a generic `uint[] calldata pubSignals` interface.
 *
 * Background:
 *   snarkjs generates Groth16 verifiers with fixed-size calldata arrays:
 *     - Shield circuit:   verifyProof(..., uint[2] calldata pubSignals)
 *     - Transfer circuit: verifyProof(..., uint[3] calldata pubSignals)
 *     - Unshield circuit: verifyProof(..., uint[4] calldata pubSignals)
 *
 *   If you use a generic `uint[] calldata pubSignals`, the ABI encoding differs:
 *   dynamic arrays are encoded with an offset pointer + length prefix, which
 *   does NOT match the fixed-array ABI encoding in the generated contract.
 *
 *   The call will succeed (no revert) but verifyProof() will always return false
 *   because the pairing check reads wrong memory offsets.
 *
 *   This is a SILENT failure — not an error, just wrong data.
 *
 * Solution:
 *   Each circuit gets its own interface with the EXACT fixed array size.
 *   UTXOPool.sol uses IShieldVerifier, ITransferVerifier, IUnshieldVerifier
 *   with uint[2], uint[3], uint[4] respectively.
 *
 * See also:
 *   contracts/UTXOPool.sol — uses these interfaces directly
 */

// Shield circuit: 2 public signals [commitment, public_amount]
interface IShieldVerifierFixed {
    function verifyProof(
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256[2] calldata pubSignals
    ) external view returns (bool);
}

// Transfer circuit: 3 public signals [old_nullifier_hash, new_commitment, root]
interface ITransferVerifierFixed {
    function verifyProof(
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256[3] calldata pubSignals
    ) external view returns (bool);
}

// Unshield circuit: 4 public signals [nullifier_hash, public_amount, root, recipient]
interface IUnshieldVerifierFixed {
    function verifyProof(
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256[4] calldata pubSignals
    ) external view returns (bool);
}

// ── DO NOT USE THIS — for documentation only ──────────────────────────────────
// This broken interface silently fails verifyProof() due to ABI encoding mismatch.
// uint[] is a dynamic array with offset+length prefix; the generated verifier
// expects fixed calldata layout. The call returns false for all valid proofs.
//
// interface IBrokenGroth16Verifier_DoNotUse {
//     function verifyProof(
//         uint256[2] calldata pA,
//         uint256[2][2] calldata pB,
//         uint256[2] calldata pC,
//         uint256[] calldata pubSignals   // WRONG — do not use dynamic array
//     ) external view returns (bool);
// }
