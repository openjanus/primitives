// SPDX-License-Identifier: MIT
// UTXOPool.sol — UTXO-model privacy pool (AurumFlow spike)
//
// Implements a Poseidon-based depth-8 incremental Merkle tree.
// Supports shield/transfer/unshield operations with Groth16 proof verification.
//
// Architecture:
//   - Commitments committed to incremental Merkle tree (depth 8, 256 leaves)
//   - Nullifiers prevent double-spend
//   - Historical roots prevent stale-root attacks
//   - FLOW custody handled by Cadence-side UTXOWrapper contract
//   - This contract handles: Merkle tree, nullifiers, proof verification
//
// Privacy model:
//   - Shield: deposits FLOW via Cadence → creates note commitment in tree
//   - Transfer: consumes note + creates new note (purely EVM-side)
//   - Unshield: consumes note → releases FLOW from Cadence vault
//
// Spike limitations (not production):
//   - Depth 8 (256 leaves max)
//   - Single signer model (no access control beyond proof validity)
//   - No gas optimization
//   - Poseidon called via precomputed constants (embedded in contract)
//
// Poseidon(2) implementation: inline Yul, same constants as PoseidonHelper.sol

pragma solidity ^0.8.24;

// Shield circuit has 2 public signals: [commitment, public_amount]
interface IShieldVerifier {
    function verifyProof(
        uint[2] calldata pA,
        uint[2][2] calldata pB,
        uint[2] calldata pC,
        uint[2] calldata pubSignals
    ) external view returns (bool);
}

// Transfer circuit has 3 public signals: [old_nullifier_hash, new_commitment, root]
interface ITransferVerifier {
    function verifyProof(
        uint[2] calldata pA,
        uint[2][2] calldata pB,
        uint[2] calldata pC,
        uint[3] calldata pubSignals
    ) external view returns (bool);
}

// Unshield circuit has 4 public signals: [nullifier_hash, public_amount, root, recipient]
interface IUnshieldVerifier {
    function verifyProof(
        uint[2] calldata pA,
        uint[2][2] calldata pB,
        uint[2] calldata pC,
        uint[4] calldata pubSignals
    ) external view returns (bool);
}

interface IPoseidon2 {
    function poseidon(uint256[2] calldata inputs) external pure returns (uint256);
}

interface IPoseidon3 {
    function poseidon(uint256[3] calldata inputs) external pure returns (uint256);
}

contract UTXOPool {

    // ── Configuration ─────────────────────────────────────────────────────────
    uint8  public constant TREE_DEPTH = 8;
    uint256 public constant MAX_LEAVES = 256; // 2^8

    // ── Verifier addresses ────────────────────────────────────────────────────
    address public immutable shieldVerifier;
    address public immutable transferVerifier;
    address public immutable unshieldVerifier;

    // ── Poseidon addresses ────────────────────────────────────────────────────
    address public immutable poseidon2Addr; // Poseidon(2 inputs)
    address public immutable poseidon3Addr; // Poseidon(3 inputs)

    // ── Merkle tree state (incremental) ───────────────────────────────────────
    // filledSubtrees[i] = last known hash at level i (Tornado-style incremental)
    uint256[TREE_DEPTH] public filledSubtrees;
    uint256[TREE_DEPTH+1] public zeros; // zeros[i] = Poseidon-zero hash at level i

    uint256 public nextLeafIndex;
    uint256 public currentRoot;

    // ── Security state ────────────────────────────────────────────────────────
    mapping(uint256 => bool) public nullifiers;
    mapping(uint256 => bool) public historicalRoots;

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

    // ── Cadence wrapper address (set at construction) ─────────────────────────
    // Only the Cadence COA address can call shield() and unshield()
    // to enforce FLOW custody at the Cadence layer.
    // Transfer() is permissionless (purely EVM-side, no FLOW moves).
    address public immutable cadenceCOAAddress;

    // ── Constructor ───────────────────────────────────────────────────────────
    constructor(
        address _shieldVerifier,
        address _transferVerifier,
        address _unshieldVerifier,
        address _poseidon2,
        address _poseidon3,
        address _cadenceCOAAddress
    ) {
        shieldVerifier    = _shieldVerifier;
        transferVerifier  = _transferVerifier;
        unshieldVerifier  = _unshieldVerifier;
        poseidon2Addr     = _poseidon2;
        poseidon3Addr     = _poseidon3;
        cadenceCOAAddress = _cadenceCOAAddress;

        // Initialize Merkle tree zeros using Poseidon
        // zeros[0] = Poseidon(0, 0) — but we use 0 as the zero leaf
        // Actually: zeros[i] = Poseidon(zeros[i-1], zeros[i-1])
        // We hardcode them for depth 8 using the standard Poseidon empty tree
        // These are the standard empty Merkle tree values (Poseidon t=3, BN254 field)
        // Precomputed: zeros[0] = 0 (empty leaf), zeros[i] = Poseidon(z[i-1], z[i-1])
        zeros[0] = 0;
        for (uint8 i = 1; i <= TREE_DEPTH; i++) {
            zeros[i] = _poseidon2Call(zeros[i-1], zeros[i-1]);
        }

        // Initialize filledSubtrees to zero hashes
        for (uint8 i = 0; i < TREE_DEPTH; i++) {
            filledSubtrees[i] = zeros[i];
        }

        // Initial root (empty tree)
        currentRoot = zeros[TREE_DEPTH];
        historicalRoots[currentRoot] = true;
    }

    // ── shield() ──────────────────────────────────────────────────────────────
    // Called by Cadence UTXOWrapper (via COA) after locking FLOW in Cadence vault.
    // proof: commitment is correctly formed from amount and private inputs.
    //
    // Public signals for shield circuit: [commitment, public_amount]
    function shield(
        uint[2] calldata pA,
        uint[2][2] calldata pB,
        uint[2] calldata pC,
        uint256 commitment,
        uint256 publicAmount    // for verification only; FLOW is already locked
    ) external {
        // Only Cadence COA can call shield (enforces Cadence-side FLOW custody)
        if (msg.sender != cadenceCOAAddress) revert Unauthorized();

        if (nextLeafIndex >= MAX_LEAVES) revert TreeFull();

        // Verify Groth16 shield proof
        uint[2] memory pubSignals;
        pubSignals[0] = commitment;
        pubSignals[1] = publicAmount;

        bool valid = IShieldVerifier(shieldVerifier).verifyProof(pA, pB, pC, pubSignals);
        if (!valid) revert ProofInvalid();

        // Insert commitment into Merkle tree
        uint256 leafIndex = nextLeafIndex;
        uint256 newRoot = _insertLeaf(commitment);

        emit Shielded(commitment, leafIndex, newRoot);
    }

    // ── transfer() ────────────────────────────────────────────────────────────
    // Permissionless — no FLOW moves, purely EVM-side note replacement.
    // Consumes old note (via nullifier), creates new note in tree.
    //
    // Public signals for transfer circuit: [old_nullifier_hash, new_commitment, root]
    function transfer(
        uint[2] calldata pA,
        uint[2][2] calldata pB,
        uint[2] calldata pC,
        uint256 oldNullifierHash,
        uint256 newCommitment,
        uint256 root
    ) external {
        // Root must be a known historical root (anti-fabrication)
        if (!historicalRoots[root]) revert InvalidRoot(root);

        // Nullifier must not be spent
        if (nullifiers[oldNullifierHash]) revert NullifierAlreadyUsed(oldNullifierHash);

        if (nextLeafIndex >= MAX_LEAVES) revert TreeFull();

        // Verify Groth16 transfer proof
        uint[3] memory pubSignals;
        pubSignals[0] = oldNullifierHash;
        pubSignals[1] = newCommitment;
        pubSignals[2] = root;

        bool valid = ITransferVerifier(transferVerifier).verifyProof(pA, pB, pC, pubSignals);
        if (!valid) revert ProofInvalid();

        // Mark old nullifier as spent
        nullifiers[oldNullifierHash] = true;

        // Insert new commitment into tree
        uint256 newLeafIndex = nextLeafIndex;
        uint256 newRoot = _insertLeaf(newCommitment);

        emit Transferred(oldNullifierHash, newCommitment, newLeafIndex, newRoot);
    }

    // ── unshield() ────────────────────────────────────────────────────────────
    // Called by Cadence UTXOWrapper (via COA) to authorize FLOW release.
    // After this returns successfully, Cadence releases FLOW from its vault.
    //
    // Public signals for unshield circuit: [nullifier_hash, public_amount, root, recipient_as_field]
    function unshield(
        uint[2] calldata pA,
        uint[2][2] calldata pB,
        uint[2] calldata pC,
        uint256 nullifierHash,
        uint256 publicAmount,
        uint256 root,
        address recipient          // FLOW recipient (also encoded in proof as field element)
    ) external {
        // Only Cadence COA can call unshield (enforces Cadence-side FLOW release)
        if (msg.sender != cadenceCOAAddress) revert Unauthorized();

        // Root must be a known historical root
        if (!historicalRoots[root]) revert InvalidRoot(root);

        // Nullifier must not be spent
        if (nullifiers[nullifierHash]) revert NullifierAlreadyUsed(nullifierHash);

        // Verify Groth16 unshield proof
        // Note: recipient is encoded as uint256 (address cast)
        uint[4] memory pubSignals;
        pubSignals[0] = nullifierHash;
        pubSignals[1] = publicAmount;
        pubSignals[2] = root;
        pubSignals[3] = uint256(uint160(recipient));

        bool valid = IUnshieldVerifier(unshieldVerifier).verifyProof(pA, pB, pC, pubSignals);
        if (!valid) revert ProofInvalid();

        // Mark nullifier as spent
        nullifiers[nullifierHash] = true;

        // No FLOW moves here — Cadence releases from its vault after this call returns
        emit Unshielded(nullifierHash, publicAmount, recipient);
    }

    // ── _insertLeaf() — incremental Merkle tree (Tornado-style) ──────────────
    function _insertLeaf(uint256 leaf) internal returns (uint256 newRoot) {
        uint256 currentIndex = nextLeafIndex;
        uint256 currentLevelHash = leaf;
        uint256 left;
        uint256 right;

        for (uint8 i = 0; i < TREE_DEPTH; i++) {
            if (currentIndex % 2 == 0) {
                // Current is left child
                left = currentLevelHash;
                right = zeros[i];
                filledSubtrees[i] = currentLevelHash;
            } else {
                // Current is right child
                left = filledSubtrees[i];
                right = currentLevelHash;
            }
            currentLevelHash = _poseidon2Call(left, right);
            currentIndex /= 2;
        }

        newRoot = currentLevelHash;
        currentRoot = newRoot;
        historicalRoots[newRoot] = true;
        nextLeafIndex++;
    }

    // ── _poseidon2Call() — call external Poseidon2 contract ──────────────────
    function _poseidon2Call(uint256 a, uint256 b) internal view returns (uint256) {
        return IPoseidon2(poseidon2Addr).poseidon([a, b]);
    }

    // ── View functions ────────────────────────────────────────────────────────

    function getCurrentRoot() external view returns (uint256) {
        return currentRoot;
    }

    function getNextLeafIndex() external view returns (uint256) {
        return nextLeafIndex;
    }

    function isNullifierUsed(uint256 nullifierHash) external view returns (bool) {
        return nullifiers[nullifierHash];
    }

    function isHistoricalRoot(uint256 root) external view returns (bool) {
        return historicalRoots[root];
    }

    // ── getMerklePath() — compute Merkle path for a given leaf index ──────────
    // Used off-chain to generate proofs for transfer/unshield.
    // Returns pathElements and pathIndices arrays for depth-8 tree.
    //
    // Note: This is a read-only helper — it reconstructs the path from
    // filledSubtrees and zeros. For spike purposes this is sufficient.
    // Production would store full tree or use indexed events.
    //
    // This function is approximate for intermediate nodes: for fully correct
    // path elements, off-chain code must track inserted leaves separately.
    // We return what we can from contract state: left-side subtrees and zeros.
    function getMerkleZero(uint8 level) external view returns (uint256) {
        return zeros[level];
    }

    function getFilledSubtree(uint8 level) external view returns (uint256) {
        return filledSubtrees[level];
    }
}
