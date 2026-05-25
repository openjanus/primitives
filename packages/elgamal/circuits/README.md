# ElGamal Circuits

Two Groth16 circuits for proving correct encryption and decryption.

## encrypt_consistency.circom

Proves that a sender's ciphertext `(C1, C2)` is well-formed for a given recipient
public key, with value in `[0, 2^48)`. ~2,200 constraints.

**Private inputs:** `value`, `randomness`
**Public inputs:** `recipient_pubkey[2]`, `C1[2]`, `C2[2]`

## decrypt_open.circom

Proves that the holder of `privkey` correctly opens a ciphertext to a claimed
total, without revealing `privkey`. ~3,500 constraints.

**Private inputs:** `privkey`
**Public inputs:** `pubkey[2]`, `C1[2]`, `C2[2]`, `claimed_value`

## Regenerating the Trusted Setup

Requirements: `snarkjs >= 0.7`, `circom >= 2.0`

### Step 1: Download Hermez Phase 1 Ceremony Output

```bash
# pot14 — sufficient for both circuits (max 2^14 = 16384 constraints)
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_14.ptau \
     -O setup/pot14_final.ptau
```

### Step 2: Apply Beacon Contribution (for production)

```bash
# Use a Flow block hash as beacon for unbias
# Get a recent finalized block hash from Flow testnet/mainnet
BEACON_HEX="<flow-block-hash-hex>"

snarkjs powersoftau beacon \
  setup/pot14_final.ptau \
  setup/pot14_beacon.ptau \
  "$BEACON_HEX" 10 \
  -name="openjanus-elgamal-beacon-v1"

snarkjs powersoftau prepare phase2 \
  setup/pot14_beacon.ptau \
  setup/pot14_beacon_phase2.ptau
```

### Step 3: Phase 2 Circuit-Specific Setup

```bash
npm run generate-setup
```

This script:
1. Compiles both circuits with `circom`
2. Runs `snarkjs groth16 setup` with `pot14_beacon_phase2.ptau`
3. Exports `.zkey` and verification keys to `setup/`
4. Exports Solidity verifiers to `contracts/`

### Step 4: Verify the Chain

```bash
snarkjs powersoftau verify setup/pot14_beacon.ptau
snarkjs zkey verify circuits/build/encrypt_consistency/encrypt_consistency.r1cs \
  setup/pot14_beacon_phase2.ptau \
  setup/encrypt_consistency.zkey
snarkjs zkey verify circuits/build/decrypt_open/decrypt_open.r1cs \
  setup/pot14_beacon_phase2.ptau \
  setup/decrypt_open.zkey
```

## Trust Model

- **Phase 1 (Hermez):** Multi-party ceremony with ~200 contributors.
  Soundness holds if at least 1 contributor is honest.
- **Phase 2 beacon:** Flow VRF or block hash provides additional bias-resistance.
  Transcript is deterministic and publicly verifiable.
- **Phase 1 lab setup:** Single-contributor pot14 (testnet-grade only).
  DO NOT use `circuits/build/*_0000.zkey` in production.

## Current Setup Status

| File | Status | Notes |
|------|--------|-------|
| `setup/pot14_final.ptau` | Not included (2.4 GB) | Download from Hermez |
| `setup/encrypt_consistency.zkey` | Not included | Run `npm run generate-setup` |
| `setup/decrypt_open.zkey` | Not included | Run `npm run generate-setup` |
| `setup/encrypt_vkey.json` | Not included | Exported from zkey |
| `setup/decrypt_vkey.json` | Not included | Exported from zkey |

For development and integration tests, the package uses the lab build artifacts
at `/path/to/cadence-crypto-lab/modules/zk/elgamal-babyjub-spike/circuits/build/`
(see `vitest.config.ts`).
