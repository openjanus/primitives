# @openjanus/elgamal

**Homomorphic ElGamal encryption on BabyJubjub** — additive privacy primitives for Flow EVM. Part of the openjanus/primitives monorepo.

## What it is

Exponential ElGamal encryption over the BabyJubjub elliptic curve, with additive homomorphism and Groth16 zero-knowledge proofs. A recipient can register a public key on-chain; senders can encrypt individual values to that key; the on-chain accumulator homomorphically adds all contributions; the recipient decrypts the total using only their private key — without learning any individual sender amount.

The "recipient knows total only" privacy property was validated end-to-end on Flow EVM testnet (Phase 1, 2026-05-25): 3 senders submitted E(10), E(25), E(7) — Bob decrypted the accumulated ciphertext to 42 without access to per-sender randomness.

## When to use

Use this package when you need:
- **Additive privacy**: multiple parties contribute encrypted amounts; the recipient learns only the total
- **On-chain accumulation**: homomorphic addition without decrypting in the contract
- **ZK-verified decryption**: recipient proves correct opening without revealing private key
- **Flow EVM integration**: works with the deployed BabyJub.sol precompile

Do NOT use for:
- General-purpose public-key encryption (use ElGamal on secp256k1 or NaCl box instead)
- Amounts requiring more than 2^32 range (needs BSGS precompute with `--bits=48`)
- Post-quantum security (based on DDH — see Trust Assumptions)

## Quick Install and Usage

```bash
npm install @openjanus/elgamal
```

```typescript
import { encrypt, decrypt, add, deriveFromFlowKey, warmupDecrypt, randomScalar } from "@openjanus/elgamal";

// One-time startup: build BSGS table (covers [0, 2^32))
await warmupDecrypt();

// Keypair derivation from a Flow signing key
const bob = await deriveFromFlowKey(myFlowSigningKeyBuffer);

// Alice encrypts 42 to Bob's pubkey
const r = await randomScalar();
const ct = await encrypt(42n, r, bob.pubkey);

// Multiple senders: homomorphic accumulation
const ct_alice = await encrypt(10n, await randomScalar(), bob.pubkey);
const ct_carol = await encrypt(25n, await randomScalar(), bob.pubkey);
const ct_dave  = await encrypt(7n,  await randomScalar(), bob.pubkey);
const accumulated = await add(await add(ct_alice, ct_carol), ct_dave);

// Bob decrypts with his private key — sees 42, not 10+25+7
const total = await decrypt(accumulated, bob.privkey);
console.log(total); // 42n
```

## Cryptographic Guarantees

| Property | Status | Notes |
|----------|--------|-------|
| IND-CPA | YES | Under DDH assumption on BabyJubjub |
| Additive homomorphism | YES | `add(E(a), E(b)) = E(a+b)` |
| Sender privacy | YES | Accumulated ciphertext is indistinguishable from fresh `E(sum)` |
| ZK-verified decryption | YES | Groth16 circuit proves correct opening |
| Post-quantum | NO | Based on elliptic curve DL — broken by Shor's algorithm |

## Trust Assumptions

1. **DDH hardness** on BabyJubjub: no efficient algorithm exists to distinguish `g^a, g^b, g^(ab)` from random.
2. **Trusted setup** for Groth16 circuits: `encrypt_consistency.zkey` and `decrypt_open.zkey`. For production, use the Hermez ceremony output + Flow block hash beacon (see `circuits/README.md`). For development, the lab setup (single-contributor pot14) is testnet-grade only.
3. **BSGS range**: values must be in `[0, 2^32)` with default settings, or `[0, 2^48)` with the precomputed disk table.

## Performance

| Operation | Time | Notes |
|-----------|------|-------|
| Encrypt | ~5ms | Point scalar multiplications |
| BSGS warmup (2^32) | ~500ms | Builds 65536-entry table, once per process |
| BSGS warmup (2^48) | ~30s | 16.7M entries — use disk cache |
| Decrypt | <5ms | After warmup |
| Prove (decrypt_open) | ~1.4s | snarkjs Groth16, WASM witness |
| Verify off-chain | ~50ms | snarkjs |
| Verify on-chain | ~45k gas | EVM Groth16 pairing check |
| Accumulate on-chain (Flow EVM) | ~110k gas | Two BabyJub point additions |
| Register pubkey (Flow EVM) | ~100k gas | One curve check + store |

Gas figures from Phase 1 testnet results (2026-05-25).

## Deployed Contracts — v0.2.0 (Flow EVM Testnet, ceremony-backed)

Trusted setup: Hermez pot14 (200+ contributors) + Flow VRF beacon
(testnet block 323555648). E2E: 27/27 PASS (2026-05-26).

| Contract | Address |
|----------|---------|
| BabyJub.sol | `0x27139AFda7425f51F68D32e0A38b7D43BcB0f870` |
| JanusToken (ElGamal accumulator) | `0xb12E600fFcde967210cFD81CF9f32bBB6e68a499` |
| EncryptConsistencyVerifier | `0x0C1e731036f4632CF9620bf6C6BB8204eD3a3B1e` |
| DecryptOpenVerifier | `0x1c248dA94aab9f4A03005E7944a8b745a6236Dbc` |

> **DEPRECATED — v0.1.0 addresses (single-contributor lab setup — DO NOT USE):**
> EncryptConsistencyVerifier `0x6F8Cc93dd6aA7B3ED0a3DaA75271815558ad9b5C`,
> DecryptOpenVerifier `0x3bB139B5404fD6b152813bC3532367AAa096638b`

## BSGS Precompute (Production 2^48)

```bash
# Build and cache a 2^32 table (~1MB, <1s)
npm run precompute-bsgs

# Build a 2^48 table (~600MB, ~30min) — full production spec
npm run precompute-bsgs:48

# Use disk-cached table at runtime
import { getBabyJub, initFromDisk, decrypt } from "@openjanus/elgamal";
const babyjub = await getBabyJub();
initFromDisk(babyjub, "./precompute/bsgs_table_48.bin", 48);
const value = await decrypt(ct, privkey, 48);
```

## Open Issues for Phase 3 (Contracts)

1. **Per-user COA pattern**: Phase 1 used a single shared COA as the on-chain recipient. Phase 3 must give each user their own Cadence Owned Account (COA) so `msg.sender` maps correctly per user.
2. **Pubkey rotation**: The accumulator currently prevents re-registration (`hasPubkey` guard). Phase 3 needs a rotation mechanism (timelock + ZK proof of old key ownership).
3. **Nonce/replay protection**: The `accumulate()` function accepts any ciphertext from any caller. Phase 3 must add nonce or commitment-reveal to prevent replay attacks.
4. **ZK-gated accumulate**: Phase 1 deferred `encrypt_consistency` proof verification on `accumulate()`. Phase 3 should add `verifyProof` call in `accumulate()` to enforce well-formed inputs.
5. **Production trusted setup**: Deploy new verifier contracts after running Hermez + beacon ceremony (see `circuits/README.md`).

See [ARCHITECTURE.md](../../ARCHITECTURE.md) for deeper cryptographic design notes.
