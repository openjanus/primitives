// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IElGamalAccumulator
/// @notice Interface for the ElGamal homomorphic accumulator contract.
interface IElGamalAccumulator {
    /// @dev An ElGamal ciphertext as two BabyJubjub points.
    struct Ciphertext {
        uint256 C1x;
        uint256 C1y;
        uint256 C2x;
        uint256 C2y;
    }

    event PubkeyRegistered(address indexed account, uint256 x, uint256 y);
    event Accumulated(address indexed recipient, uint256 C1x, uint256 C1y, uint256 C2x, uint256 C2y);

    /// @notice Register a BabyJubjub public key for this sender.
    function registerPubkey(uint256 x, uint256 y) external;

    /// @notice Homomorphically add a ciphertext to recipient's slot.
    function accumulate(address recipient, Ciphertext calldata ct) external;

    /// @notice View the current accumulated ciphertext for a recipient.
    function getSlot(address recipient) external view
        returns (uint256 C1x, uint256 C1y, uint256 C2x, uint256 C2y);

    /// @notice View the registered public key for an address.
    function getPubkey(address account) external view returns (uint256 x, uint256 y);

    /// @notice Check if an address has registered a pubkey.
    function hasPubkey(address account) external view returns (bool);
}
