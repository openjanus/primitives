// shield.circom — UTXO Spike: Shield circuit
//
// Proves valid commitment creation for a deposit (shield).
//
// The commitment scheme:
//   commitment = Poseidon(amount, nullifier_secret, blinding)
//
// The nullifier hash (revealed only on spend):
//   nullifier_hash = Poseidon(nullifier_secret, leaf_index)
//   leaf_index is NOT known at shield time, so this circuit only proves
//   the commitment is well-formed and amount is in range.
//
// PRIVATE inputs:
//   amount          — deposit amount in attoflow [0, 2^48)
//   nullifier_secret — spending key secret (known only to note owner)
//   blinding         — randomness to hide commitment
//
// PUBLIC inputs:
//   commitment      — Poseidon(amount, nullifier_secret, blinding)
//   public_amount   — same as amount (for on-chain deposit validation)
//
// Constraints:
//   1. amount in [0, 2^48)
//   2. commitment = Poseidon(amount, nullifier_secret, blinding)
//   3. public_amount === amount (enforce consistent public disclosure)
//
// Constraint count estimate: ~270 (Poseidon(3) ~ 240 + range check ~48)
//
// Compatible with circomlib Poseidon and pot14_lab_final.ptau

pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/bitify.circom";

template Shield() {
    // ── Private inputs ─────────────────────────────────────────────────────
    signal input amount;           // deposit amount in attoflow [0, 2^48)
    signal input nullifier_secret; // spending key secret
    signal input blinding;         // randomness

    // ── Public inputs ──────────────────────────────────────────────────────
    signal input commitment;       // claimed commitment = Poseidon(amount, ns, blinding)
    signal input public_amount;    // public disclosure of amount for on-chain

    // ── Step 1: Range check amount in [0, 2^48) ────────────────────────────
    component amountBits = Num2Bits(48);
    amountBits.in <== amount;

    // ── Step 2: Compute commitment = Poseidon(amount, nullifier_secret, blinding)
    component hasher = Poseidon(3);
    hasher.inputs[0] <== amount;
    hasher.inputs[1] <== nullifier_secret;
    hasher.inputs[2] <== blinding;

    // Enforce: computed commitment == public commitment input
    hasher.out === commitment;

    // ── Step 3: Enforce public_amount matches private amount ───────────────
    public_amount === amount;
}

component main {public [commitment, public_amount]} = Shield();
