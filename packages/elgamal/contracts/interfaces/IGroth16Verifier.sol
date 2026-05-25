// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IGroth16Verifier
/// @notice Common interface for snarkjs-generated Groth16 verifiers.
interface IGroth16Verifier {
    /// @notice Verify a Groth16 proof.
    /// @param _pA  Proof element A (G1 point)
    /// @param _pB  Proof element B (G2 point)
    /// @param _pC  Proof element C (G1 point)
    /// @param _pubSignals  Public signals array
    /// @return true if proof is valid
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[] calldata _pubSignals
    ) external view returns (bool);
}
