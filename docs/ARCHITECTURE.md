# OpenJanus Primitives — Architecture

## Overview

OpenJanus implements additive privacy for on-chain financial applications using
exponential ElGamal encryption on the BabyJubjub elliptic curve.

## Cryptographic Design

### Exponential ElGamal on BabyJubjub

BabyJubjub is a twisted Edwards curve embedded in the BN254 scalar field,
making it natively supported by Groth16 circuits (circomlib) and EVM precompiles.

**Encryption:**
```
C1 = r * G          (randomness commitment)
C2 = v*G + r*PK     (masked value)
```
where G is the BabyJubjub generator (Base8 in circomlib), r is fresh randomness,
v is the plaintext value, and PK is the recipient's public key.

**Homomorphism:**
```
E(v1,r1) + E(v2,r2) = (C1a+C1b, C2a+C2b) = E(v1+v2, r1+r2)
```
Addition is BabyJubjub point addition. No interaction required between senders.

**Decryption:**
```
vG = C2 - sk*C1 = v*G + r*PK - sk*(r*G) = v*G  (since PK = sk*G)
v  = BSGS(vG)   (solve discrete log in [0, 2^32))
```

### BSGS Discrete Log Solver

Baby-step Giant-step with M = sqrt(2^BITS) baby steps:
- Baby steps: precompute table[j*G] = j for j in [0, M)
- Giant steps: for i in [0, M): test P - i*(M*G), look up in table
- Solution: v = i*M + j

Default: BITS=32, M=2^16=65536 baby steps, O(1MB) table, <1s build.

For 2^48: M=2^24=16.7M baby steps, ~600MB disk table, ~30 min build (once).

### ZK Circuits

**encrypt_consistency**: Sender proves ciphertext is well-formed.
- Private: value, randomness
- Public: recipient_pubkey, C1, C2
- Constraints: ~2,200 (fits in pot11)

**decrypt_open**: Recipient proves correct decryption without revealing privkey.
- Private: privkey
- Public: pubkey, C1, C2, claimed_value
- Constraints: ~3,500 (fits in pot12)

### Key Derivation

From a Flow signing key using HKDF-SHA256:
```
PRK = HMAC-SHA256(salt="openjanus-privacy-v1", IKM=flowKey)
OKM = HMAC-SHA256(PRK, info="babyjub-privkey" || 0x01)
privkey = OKM mod BabyJubjub.subOrder
```

This allows each Flow user to derive a deterministic BabyJubjub keypair from
their existing Flow signing key without managing a separate seed.

## Contract Architecture

```
ElGamalAccumulator.sol
  ├── registerPubkey(x, y)          — one-time, stores BabyJubjub pubkey
  ├── accumulate(recipient, ct)     — homomorphic add to slot
  └── getSlot(recipient)            — read accumulated ciphertext

EncryptConsistencyVerifier.sol      — Groth16, 6 public signals
DecryptOpenVerifier.sol             — Groth16, 7 public signals
BabyJub.sol (external)             — curve ops: babyAdd, isOnCurve, negate
```

## Phase Roadmap

| Phase | Status | Focus |
|-------|--------|-------|
| L1 (lab spike) | DONE (2026-05-25) | ElGamal on BabyJubjub, 17/17 tests PASS |
| L2 (this) | IN PROGRESS | Extract to @openjanus/elgamal, production BSGS, CI |
| L3 (contracts) | PLANNED | Per-user COA, ZK-gated accumulate, replay protection |
| L4 (integration) | PLANNED | Cadence CrossVM, key management, SDK |

## Security Notes

- IND-CPA security under DDH on BabyJubjub (standard assumption)
- NOT post-quantum secure
- Trusted setup required for Groth16 (see circuits/README.md for ceremony chain)
- The `resetSlot()` function in Phase 1 contracts must be REMOVED in production
- Nonce/replay protection must be added before production use
