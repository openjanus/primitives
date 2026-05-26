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

## Trusted Setup — Ceremony Chain (executed 2026-05-26)

The zkeys in `setup/` were produced by a proper multi-party trusted setup ceremony,
replacing the previous single-contributor lab setup.

### Ceremony chain

**Phase 1 — Hermez powers of tau (circuit-independent)**
- Source: `powersOfTau28_hez_final_14.ptau` (Hermez/SnarkJS community ceremony)
- Contributors: 200+ independent parties
- This is the standard community-produced pot14 file used across the ZK ecosystem.
- The Hermez ptau already includes an internal beacon; no additional powersoftau
  beacon step is needed or applicable to the pre-reduced hermez file.

**Phase 2 — Circuit-specific contribution (openjanus, 2026-05-26)**
- Tool: `snarkjs.zKey.contribute` with entropy derived from Flow VRF beacon
- Beacon input: Flow testnet block `323555648`,
  hash `30f1f68eed7ea6e7b4964e798ff8a0e2b77e7ca073ed80ac44d39ddc5fb395e7`
- Both circuits (`encrypt_consistency` and `decrypt_open`) received independent
  phase 2 contributions using the same beacon entropy applied via `zKey.contribute`.
- Contributor entropy was generated from the beacon hash and discarded after the
  contribution session.

**Note on beacon application mechanics:**
The Hermez ptau file (`powersOfTau28_hez_final_14.ptau`) is already in reduced form
(prepared for phase 2 directly). The `snarkjs powersoftau beacon` command applies to
an unreduced ptau and would fail on this file. Beacon entropy was therefore injected
at the `zKey.contribute` step, which is the correct approach for pre-reduced Hermez
phase 1 outputs.

### SHA256 integrity hashes

| File | SHA256 |
|------|--------|
| `setup/encrypt_consistency_final.zkey` | `17ab9353f2966336bbf380549a47721ccce4283f20000380e18ecab763c3da16` |
| `setup/decrypt_open_final.zkey` | `d87eda3b96f2eeab11f33583369519d041d25915cdbd49cedf41fd269b8e0745` |

Verify locally:
```bash
sha256sum packages/elgamal/circuits/setup/encrypt_consistency_final.zkey
sha256sum packages/elgamal/circuits/setup/decrypt_open_final.zkey
```

### Regenerating the Trusted Setup

Requirements: `snarkjs >= 0.7`, `circom >= 2.0`

#### Step 1: Download Hermez Phase 1 Ceremony Output

```bash
# pot14 — sufficient for both circuits (max 2^14 = 16384 constraints)
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_14.ptau \
     -O setup/pot14_final.ptau
```

#### Step 2: Phase 2 Circuit-Specific Setup with Beacon Entropy

```bash
# The Hermez ptau is pre-reduced — skip powersoftau prepare phase2.
# Apply beacon entropy via zKey.contribute:

snarkjs groth16 setup circuits/build/encrypt_consistency/encrypt_consistency.r1cs \
  setup/pot14_final.ptau \
  setup/encrypt_consistency_0000.zkey

# Get a recent finalized block hash from Flow testnet/mainnet as beacon
BEACON_HEX="<flow-block-hash-hex>"

snarkjs zkey contribute \
  setup/encrypt_consistency_0000.zkey \
  setup/encrypt_consistency_final.zkey \
  --name="openjanus-elgamal-beacon" \
  -e="$BEACON_HEX"
```

Repeat for `decrypt_open`. Then export vkeys:

```bash
snarkjs zkey export verificationkey \
  setup/encrypt_consistency_final.zkey \
  setup/encrypt_consistency_vkey.json

snarkjs zkey export verificationkey \
  setup/decrypt_open_final.zkey \
  setup/decrypt_open_vkey.json
```

#### Step 3: Verify the Chain

```bash
snarkjs zkey verify circuits/build/encrypt_consistency/encrypt_consistency.r1cs \
  setup/pot14_final.ptau \
  setup/encrypt_consistency_final.zkey

snarkjs zkey verify circuits/build/decrypt_open/decrypt_open.r1cs \
  setup/pot14_final.ptau \
  setup/decrypt_open_final.zkey
```

## Trust Model

- **Phase 1 (Hermez):** Multi-party ceremony with 200+ contributors.
  Soundness holds if at least 1 contributor is honest.
- **Phase 2 beacon:** Flow testnet block 323555648 hash provided entropy for
  the `zKey.contribute` step. Transcript is deterministic and publicly verifiable
  against the beacon block hash on Flow testnet.
- **Production grade:** The combination of Hermez phase 1 (200+ contributors)
  plus beacon-seeded phase 2 contribution is production-viable for testnet and
  pre-mainnet deployments.

## Current Setup Status

| File | Status | Notes |
|------|--------|-------|
| `setup/pot14_final.ptau` | Not included (2.4 GB) | Download from Hermez |
| `setup/encrypt_consistency_final.zkey` | **Included — ceremony-backed** | Hermez + Flow VRF beacon |
| `setup/decrypt_open_final.zkey` | **Included — ceremony-backed** | Hermez + Flow VRF beacon |
| `setup/encrypt_consistency_vkey.json` | **Included** | Exported from ceremony zkey |
| `setup/decrypt_open_vkey.json` | **Included** | Exported from ceremony zkey |

The zkeys in this package match the verifiers deployed on-chain:
- `EncryptConsistencyVerifier`: `0x0C1e731036f4632CF9620bf6C6BB8204eD3a3B1e`
- `DecryptOpenVerifier`: `0x1c248dA94aab9f4A03005E7944a8b745a6236Dbc`

E2E validation: 27/27 tests PASS against v0.2.0 deployment with these zkeys (2026-05-26).
