// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * IUTXOPool — Interface for the UTXO privacy pool.
 *
 * Deployed at: 0x6c1c172068f8325bd1f6564bc2fBa5B0A9BB1725 (Flow EVM testnet)
 *
 * Three operations:
 *   shield()   — deposit FLOW via Cadence COA (COA-only)
 *   transfer() — replace old note with new note (permissionless)
 *   unshield() — withdraw FLOW via Cadence COA (COA-only)
 */
interface IUTXOPool {
    // ── Events ────────────────────────────────────────────────────────────────

    event Shielded(
        uint256 indexed commitment,
        uint256 leafIndex,
        uint256 newRoot
    );

    event Transferred(
        uint256 indexed oldNullifierHash,
        uint256 indexed newCommitment,
        uint256 newLeafIndex,
        uint256 newRoot
    );

    event Unshielded(
        uint256 indexed nullifierHash,
        uint256 amount,
        address indexed recipient
    );

    // ── Errors ────────────────────────────────────────────────────────────────

    error TreeFull();
    error NullifierAlreadyUsed(uint256 nullifier);
    error InvalidRoot(uint256 root);
    error ProofInvalid();
    error Unauthorized();

    // ── Write (shield/unshield via Cadence COA only) ──────────────────────────

    /**
     * Shield: insert a UTXO note commitment into the Merkle tree.
     * Called by the Cadence COA after locking FLOW in the Cadence vault.
     *
     * Public signals for shield circuit: [commitment, public_amount]
     */
    function shield(
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256 commitment,
        uint256 publicAmount
    ) external;

    /**
     * Transfer: replace an old note with a new note.
     * Permissionless — no FLOW moves. Purely EVM-side note replacement.
     *
     * Public signals for transfer circuit: [old_nullifier_hash, new_commitment, root]
     */
    function transfer(
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256 oldNullifierHash,
        uint256 newCommitment,
        uint256 root
    ) external;

    /**
     * Unshield: mark a note as spent to authorize FLOW release.
     * Called by the Cadence COA; FLOW is released in Cadence after this returns.
     *
     * Public signals for unshield circuit: [nullifier_hash, public_amount, root, recipient]
     */
    function unshield(
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256 nullifierHash,
        uint256 publicAmount,
        uint256 root,
        address recipient
    ) external;

    // ── Read ─────────────────────────────────────────────────────────────────

    function getCurrentRoot() external view returns (uint256);
    function getNextLeafIndex() external view returns (uint256);
    function isNullifierUsed(uint256 nullifierHash) external view returns (bool);
    function isHistoricalRoot(uint256 root) external view returns (bool);
    function getMerkleZero(uint8 level) external view returns (uint256);
    function getFilledSubtree(uint8 level) external view returns (uint256);
}
