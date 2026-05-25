// SPDX-License-Identifier: MIT
// ElGamalAccumulator.sol — Homomorphic ElGamal accumulator on BabyJubJub
//
// Storage model: single accumulator slot per address.
//   slot = (C1, C2) where C1, C2 are BabyJubJub points
//   C1 = sum_i(r_i * G)         — cumulative randomness commitment
//   C2 = sum_i(v_i * G + r_i * PK) — cumulative value commitment
//
// Homomorphic: adding E(v1,r1,pk) and E(v2,r2,pk) gives E(v1+v2, r1+r2, pk)
// so the accumulator can accumulate any number of sender contributions.
//
// Decrypt off-chain: vG = C2 - privkey * C1, then solve DL in [0, 2^48).
//
// Security note: This contract holds no ZK proofs for Phase B.
// Phase C adds encrypt_consistency.circom verifier on add().
// Phase D wraps this in a Cadence resource.
//
// BabyJub deployed at: 0x27139AFda7425f51F68D32e0A38b7D43BcB0f870 (Flow EVM testnet)

pragma solidity ^0.8.20;

interface IBabyJub {
    function babyAdd(
        uint256 x1, uint256 y1,
        uint256 x2, uint256 y2
    ) external view returns (uint256 x3, uint256 y3);

    function isOnCurve(uint256 x, uint256 y) external pure returns (bool);
    function negate(uint256 x, uint256 y) external pure returns (uint256 nx, uint256 ny);
    function identity() external pure returns (uint256 x, uint256 y);
}

contract ElGamalAccumulator {

    // ─── Constants ────────────────────────────────────────────────────────────
    uint256 constant P = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

    // ─── Types ────────────────────────────────────────────────────────────────

    /// @dev An ElGamal ciphertext as two BabyJubJub points
    struct Ciphertext {
        uint256 C1x;
        uint256 C1y;
        uint256 C2x;
        uint256 C2y;
    }

    /// @dev A BabyJubJub public key point
    struct PubKey {
        uint256 x;
        uint256 y;
    }

    // ─── State ────────────────────────────────────────────────────────────────

    /// @dev BabyJub helper contract
    IBabyJub public immutable babyjub;

    /// @dev Accumulated ciphertext per recipient
    mapping(address => Ciphertext) public slot;

    /// @dev Whether an address has registered their public key
    mapping(address => bool) public hasPubkey;

    /// @dev Registered BabyJubJub public keys
    mapping(address => PubKey) public pubkey;

    // ─── Events ───────────────────────────────────────────────────────────────

    event PubkeyRegistered(address indexed account, uint256 x, uint256 y);
    event Accumulated(address indexed recipient, uint256 C1x, uint256 C1y, uint256 C2x, uint256 C2y);

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _babyjub) {
        babyjub = IBabyJub(_babyjub);
    }

    // ─── Public functions ─────────────────────────────────────────────────────

    /**
     * @notice Register a BabyJubJub public key for this address.
     * @dev Can only be called once. Pubkey must be a valid BabyJubJub point.
     * @param x  x-coordinate of the public key point
     * @param y  y-coordinate of the public key point
     */
    function registerPubkey(uint256 x, uint256 y) external {
        require(!hasPubkey[msg.sender], "ElGamalAccumulator: pubkey already registered");
        require(babyjub.isOnCurve(x, y), "ElGamalAccumulator: pubkey not on BabyJubJub curve");
        require(x != 0 || y != 1, "ElGamalAccumulator: pubkey cannot be identity");

        pubkey[msg.sender] = PubKey(x, y);
        hasPubkey[msg.sender] = true;

        // Initialize slot to identity (0, 1) in both C1 and C2
        slot[msg.sender] = Ciphertext(0, 1, 0, 1);

        emit PubkeyRegistered(msg.sender, x, y);
    }

    /**
     * @notice Homomorphically add a ciphertext to recipient's slot.
     * @dev Anyone can call this to add to a registered recipient's slot.
     *      Ciphertext must be valid BabyJubJub points.
     *      Phase C will add ZK proof verification here.
     *
     * @param recipient  Address of the recipient (must have registered pubkey)
     * @param ct         Ciphertext to add: (C1x, C1y, C2x, C2y)
     */
    function accumulate(address recipient, Ciphertext calldata ct) external {
        require(hasPubkey[recipient], "ElGamalAccumulator: recipient has no registered pubkey");
        require(ct.C1x < P && ct.C1y < P && ct.C2x < P && ct.C2y < P,
            "ElGamalAccumulator: coordinates out of field");
        require(babyjub.isOnCurve(ct.C1x, ct.C1y), "ElGamalAccumulator: C1 not on curve");
        require(babyjub.isOnCurve(ct.C2x, ct.C2y), "ElGamalAccumulator: C2 not on curve");

        Ciphertext storage current = slot[recipient];

        // Homomorphic addition: (C1_new, C2_new) = (C1_old + C1_ct, C2_old + C2_ct)
        (uint256 newC1x, uint256 newC1y) = babyjub.babyAdd(
            current.C1x, current.C1y,
            ct.C1x, ct.C1y
        );
        (uint256 newC2x, uint256 newC2y) = babyjub.babyAdd(
            current.C2x, current.C2y,
            ct.C2x, ct.C2y
        );

        slot[recipient] = Ciphertext(newC1x, newC1y, newC2x, newC2y);

        emit Accumulated(recipient, newC1x, newC1y, newC2x, newC2y);
    }

    /**
     * @notice View the current accumulated ciphertext for a recipient.
     */
    function getSlot(address recipient) external view
        returns (uint256 C1x, uint256 C1y, uint256 C2x, uint256 C2y)
    {
        Ciphertext storage ct = slot[recipient];
        return (ct.C1x, ct.C1y, ct.C2x, ct.C2y);
    }

    /**
     * @notice View the registered public key for an address.
     */
    function getPubkey(address account) external view returns (uint256 x, uint256 y) {
        require(hasPubkey[account], "ElGamalAccumulator: no pubkey registered");
        return (pubkey[account].x, pubkey[account].y);
    }

    /**
     * @notice Reset slot to identity (for testing only — remove in production).
     * @dev Only callable by the recipient themselves.
     */
    function resetSlot() external {
        require(hasPubkey[msg.sender], "ElGamalAccumulator: not registered");
        slot[msg.sender] = Ciphertext(0, 1, 0, 1);
    }
}
