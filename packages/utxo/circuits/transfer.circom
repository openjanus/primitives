// transfer.circom — UTXO Spike: Transfer circuit
//
// Proves a UTXO note spend and new note creation:
//   - Prover knows the spending key for a note committed in the Merkle tree
//   - The old nullifier is correctly derived (preventing double-spend)
//   - A new commitment is created for the recipient
//
// This spike uses a depth-8 Merkle tree (256 leaves max).
// Poseidon is used for both the commitment and the Merkle tree hash.
//
// PRIVATE inputs:
//   amount              — note value (unchanged in transfer; full note spend)
//   old_nullifier_secret — spending key for the note being consumed
//   old_blinding         — blinding factor of the note being consumed
//   new_nullifier_secret — spending key for the new note (recipient's)
//   new_blinding         — blinding for the new note
//   path_elements[8]    — Merkle sibling hashes (depth 8)
//   path_indices[8]     — 0/1 per level (0 = current is left child)
//   old_leaf_index      — leaf index of the consumed note (for nullifier)
//
// PUBLIC inputs:
//   old_nullifier_hash  — Poseidon(old_nullifier_secret, old_leaf_index)
//   new_commitment      — Poseidon(amount, new_nullifier_secret, new_blinding)
//   root                — Merkle root at proof time (must be a historical root)
//
// Constraints:
//   1. old_commitment = Poseidon(amount, old_ns, old_blinding)
//   2. Merkle path: old_commitment at path_indices with root
//   3. old_nullifier_hash = Poseidon(old_ns, old_leaf_index)
//   4. new_commitment = Poseidon(amount, new_ns, new_blinding)
//   Note: amount is private — no public disclosure in transfer
//
// Depth-8 Merkle tree Poseidon-based: each level H(left, right) = Poseidon(2)
// Binary constraint on each path_indices[i]: s*(1-s) === 0

pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/bitify.circom";

// ─── MerklePathDepth8 ──────────────────────────────────────────────────────
// Verifies a Merkle path of depth 8 using Poseidon hash.
// Signals are hoisted out of loops (circom2 requires this).
template MerklePathDepth8() {
    signal input leaf;
    signal input pathElements[8];
    signal input pathIndices[8];
    signal output root;

    // Hoist all signals outside the loop (circom2 requirement)
    component hashers[8];
    signal left[8];
    signal right[8];
    signal current[9];
    signal s_cur[8];    // s * current[i]
    signal s_sib[8];    // s * pathElements[i]

    current[0] <== leaf;

    for (var i = 0; i < 8; i++) {
        hashers[i] = Poseidon(2);

        // Binary constraint: pathIndices[i] in {0, 1}
        pathIndices[i] * (1 - pathIndices[i]) === 0;

        // Selector:
        // If s=0: left = current, right = sibling
        // If s=1: left = sibling, right = current
        s_cur[i] <== pathIndices[i] * current[i];
        s_sib[i] <== pathIndices[i] * pathElements[i];

        left[i]  <== current[i]        - s_cur[i] + s_sib[i];
        right[i] <== s_cur[i]          + pathElements[i] - s_sib[i];

        hashers[i].inputs[0] <== left[i];
        hashers[i].inputs[1] <== right[i];
        current[i+1] <== hashers[i].out;
    }

    root <== current[8];
}

// ─── Transfer ──────────────────────────────────────────────────────────────
template Transfer() {
    // ── Private inputs ───────────────────────────────────────────────────────
    signal input amount;
    signal input old_nullifier_secret;
    signal input old_blinding;
    signal input new_nullifier_secret;
    signal input new_blinding;
    signal input path_elements[8];
    signal input path_indices[8];
    signal input old_leaf_index;

    // ── Public inputs ────────────────────────────────────────────────────────
    signal input old_nullifier_hash; // Poseidon(old_ns, old_leaf_index)
    signal input new_commitment;     // Poseidon(amount, new_ns, new_blinding)
    signal input root;               // Merkle root

    // ── Step 1: Compute old_commitment = Poseidon(amount, old_ns, old_blinding)
    component oldCommitHasher = Poseidon(3);
    oldCommitHasher.inputs[0] <== amount;
    oldCommitHasher.inputs[1] <== old_nullifier_secret;
    oldCommitHasher.inputs[2] <== old_blinding;
    signal old_commitment;
    old_commitment <== oldCommitHasher.out;

    // ── Step 2: Verify Merkle path: old_commitment is in tree under root ──────
    component merkleProof = MerklePathDepth8();
    merkleProof.leaf <== old_commitment;
    for (var i = 0; i < 8; i++) {
        merkleProof.pathElements[i] <== path_elements[i];
        merkleProof.pathIndices[i]  <== path_indices[i];
    }
    merkleProof.root === root;

    // ── Step 3: Verify nullifier hash = Poseidon(old_ns, old_leaf_index) ──────
    component nullHasher = Poseidon(2);
    nullHasher.inputs[0] <== old_nullifier_secret;
    nullHasher.inputs[1] <== old_leaf_index;
    nullHasher.out === old_nullifier_hash;

    // ── Step 4: Verify new_commitment = Poseidon(amount, new_ns, new_blinding)
    component newCommitHasher = Poseidon(3);
    newCommitHasher.inputs[0] <== amount;
    newCommitHasher.inputs[1] <== new_nullifier_secret;
    newCommitHasher.inputs[2] <== new_blinding;
    newCommitHasher.out === new_commitment;
}

component main {public [old_nullifier_hash, new_commitment, root]} = Transfer();
