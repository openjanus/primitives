# UTXO Circuits

Three Groth16 circuits for the UTXO privacy pool. All circuits use circomlib's
Poseidon hash and are compiled for BN254 (compatible with Flow EVM).

## Circuits

### shield.circom
Proves a deposit commitment is correctly formed.
- Private: `amount`, `nullifier_secret`, `blinding`
- Public: `commitment` (on-chain), `public_amount`
- Commitment = `Poseidon(amount, nullifier_secret, blinding)` [3-input]
- ~270 constraints

### transfer.circom
Proves a note is in the Merkle tree and creates a new note.
- Private: old note secrets + path, new note secrets, `old_leaf_index`
- Public: `old_nullifier_hash`, `new_commitment`, `root`
- Includes depth-8 Merkle path verification (Poseidon at each level)
- ~2400 constraints

### unshield.circom
Proves a note is in the Merkle tree and reveals amount for withdrawal.
- Private: note secrets + path, `leaf_index`
- Public: `nullifier_hash`, `public_amount`, `root`, `recipient`
- Same Merkle path structure as transfer, but no new commitment
- ~2200 constraints

## Trusted Setup

The `setup/` directory contains the Phase 2 keys used for the testnet deployment.

**WARNING: TESTNET-GRADE SETUP**

```
pot14_final.ptau: Single-contributor powers of tau (pot14)
                  NOT the Hermez multi-party ceremony
                  NOT suitable for production funds
```

For production:
1. Use the Hermez ceremony pot28_final.ptau (or larger)
2. Run a multi-party Phase 2 ceremony with `snarkjs zkey contribute`
3. Add Flow block beacon contribution: `snarkjs zkey beacon`
4. Redeploy all three verifier contracts
5. Redeploy UTXOPool with new verifier addresses

To regenerate (creates INCOMPATIBLE keys with testnet):
```bash
npm run generate-setup
```

## Build Artifacts

The `build/` directory contains pre-compiled WASM witnesses for proof generation:
- `shield_js/shield.wasm` — shield witness calculator
- `transfer_js/transfer.wasm` — transfer witness calculator
- `unshield_js/unshield.wasm` — unshield witness calculator

These are required at runtime by `proveShield()`, `proveTransfer()`, `proveUnshield()`.
They match the `_final.zkey` files in `setup/`.
