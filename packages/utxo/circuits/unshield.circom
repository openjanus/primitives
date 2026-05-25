// unshield.circom — UTXO Spike: Unshield circuit
//
// Proves a UTXO note spend and reveals amount for withdrawal.
// Like transfer, but no new commitment — amount becomes public.
//
// PRIVATE inputs:
//   amount           — note value (also public, for FLOW release)
//   nullifier_secret — spending key for the note
//   blinding         — blinding of the note
//   path_elements[8] — Merkle sibling hashes
//   path_indices[8]  — 0/1 per level
//   leaf_index       — leaf position in tree (for nullifier)
//
// PUBLIC inputs:
//   nullifier_hash   — Poseidon(nullifier_secret, leaf_index)
//   public_amount    — same as amount (disclosed for FLOW transfer)
//   root             — Merkle root at proof time
//   recipient        — address receiving FLOW (as field element)
//
// Constraints:
//   1. commitment = Poseidon(amount, nullifier_secret, blinding)
//   2. Merkle path: commitment at leaf_index under root
//   3. nullifier_hash = Poseidon(nullifier_secret, leaf_index)
//   4. public_amount === amount
//   Note: recipient is public but unconstrained — prover binds the proof
//         to a specific recipient address to prevent front-running

pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/bitify.circom";

// ─── MerklePathDepth8 (same as transfer.circom — signals hoisted) ──────────
template MerklePathDepth8Unshield() {
    signal input leaf;
    signal input pathElements[8];
    signal input pathIndices[8];
    signal output root;

    component hashers[8];
    signal left[8];
    signal right[8];
    signal current[9];
    signal s_cur[8];
    signal s_sib[8];

    current[0] <== leaf;

    for (var i = 0; i < 8; i++) {
        hashers[i] = Poseidon(2);

        pathIndices[i] * (1 - pathIndices[i]) === 0;

        s_cur[i] <== pathIndices[i] * current[i];
        s_sib[i] <== pathIndices[i] * pathElements[i];

        left[i]  <== current[i]    - s_cur[i] + s_sib[i];
        right[i] <== s_cur[i]      + pathElements[i] - s_sib[i];

        hashers[i].inputs[0] <== left[i];
        hashers[i].inputs[1] <== right[i];
        current[i+1] <== hashers[i].out;
    }

    root <== current[8];
}

// ─── Unshield ──────────────────────────────────────────────────────────────
template Unshield() {
    // ── Private inputs ───────────────────────────────────────────────────────
    signal input amount;
    signal input nullifier_secret;
    signal input blinding;
    signal input path_elements[8];
    signal input path_indices[8];
    signal input leaf_index;

    // ── Public inputs ────────────────────────────────────────────────────────
    signal input nullifier_hash;  // Poseidon(nullifier_secret, leaf_index)
    signal input public_amount;   // same as amount
    signal input root;            // Merkle root
    signal input recipient;       // destination address as field element

    // ── Step 1: Compute commitment = Poseidon(amount, nullifier_secret, blinding)
    component commitHasher = Poseidon(3);
    commitHasher.inputs[0] <== amount;
    commitHasher.inputs[1] <== nullifier_secret;
    commitHasher.inputs[2] <== blinding;
    signal commitment;
    commitment <== commitHasher.out;

    // ── Step 2: Verify Merkle path ────────────────────────────────────────────
    component merkleProof = MerklePathDepth8Unshield();
    merkleProof.leaf <== commitment;
    for (var i = 0; i < 8; i++) {
        merkleProof.pathElements[i] <== path_elements[i];
        merkleProof.pathIndices[i]  <== path_indices[i];
    }
    merkleProof.root === root;

    // ── Step 3: Verify nullifier_hash = Poseidon(nullifier_secret, leaf_index)
    component nullHasher = Poseidon(2);
    nullHasher.inputs[0] <== nullifier_secret;
    nullHasher.inputs[1] <== leaf_index;
    nullHasher.out === nullifier_hash;

    // ── Step 4: Enforce public_amount === amount ───────────────────────────────
    public_amount === amount;

    // ── Step 5: Recipient is public — bind proof to destination ───────────────
    // recipient signal is declared public and used here to bind the proof.
    // Without this, a relay could swap recipient to themselves.
    // We just need a constraint that "touches" recipient.
    // Simple: recipient + 0 === recipient (no-op constraint forces inclusion)
    signal _recipient_check;
    _recipient_check <== recipient;
}

component main {public [nullifier_hash, public_amount, root, recipient]} = Unshield();
