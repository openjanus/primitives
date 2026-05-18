# Architecture

## Overview

`openjanus/primitives` is designed around Flow's cross-VM execution model. Each primitive exploits the EVM side for expensive cryptographic operations (field inverses, pairings) while keeping Cadence-side logic minimal.

## The cross-VM cost model

Flow Cadence transactions have a 9,999 Computation Unit (CU) ceiling. Native Cadence field arithmetic is expensive: a single modular inverse via Fermat's little theorem costs ~47,800 CU — exceeding the entire budget five times over.

Flow EVM, running as a sub-execution environment, has no CU constraint. EVM gas is paid separately from Cadence CU. The `coa.call()` dispatch from Cadence costs ~16 CU regardless of EVM gas consumed.

This asymmetry drives all design decisions in this repo:

| Operation | Pure Cadence | Via EVM (cross-VM) |
|-----------|-------------|---------------------|
| Modular inverse | ~47,800 CU (not viable) | ~450 gas, ~16 CU dispatch |
| BabyAdd (2 inverses) | ~95,600 CU (not viable) | ~35k gas, ~16 CU dispatch |
| Groth16 verify (pairing) | Impossible | ~253k gas, ~2,785 CU dispatch |

## Primitive stack

```
ConfidentialTransfer (ZK proof system)
          │
          ▼
@openjanus/groth16 — ConfidentialTransferVerifier.sol
          │
          │ uses BabyJubJub Pedersen commitments
          ▼
@openjanus/pedersen — PedersenBabyJub.cdc (Cadence)
          │
          │ cross-VM calls for point arithmetic
          ▼
@openjanus/babyjub — BabyJub.sol (Flow EVM)
          │
          │ uses EVM precompiles
          ▼
EVM precompiles: modexp (0x05), ecAdd (0x06), ecMul (0x07), bn128pairing (0x08)
```

## BabyJub package

`BabyJub.sol` is a stateless, pure-view contract. All functions are either `pure` (no reads) or `view` (reads only constants). It can be called from:
- EVM transactions directly (standard Solidity call)
- Cadence transactions via `coa.call()`
- Cadence scripts via `EVM.dryCall()` (read-only)

The contract uses `mulmod`, `addmod`, and the modexp precompile at address `0x05` for all field arithmetic. No custom big-number library is needed.

## Pedersen package

`PedersenBabyJub.cdc` is a Cadence contract that provides homomorphic point operations without exposing plaintext values. Commitments are always computed off-chain using `@iden3/circomlibjs`. The contract only handles:
- `addCommits(c1, c2, coa)` — point addition, dispatched to BabyJub.sol via cross-VM
- `subCommits(c1, c2, coa)` — negation (pure Cadence) + add (cross-VM)
- `negate(point)` — pure Cadence (trivially `-x mod p`)
- `identity()` — returns `(0, 1)`, pure Cadence
- `isIdentity(point)` — pure Cadence equality check

## Groth16 package

`Groth16Verifier.sol` is an abstract base (snarkJS-generated template). The `ConfidentialTransferVerifier.sol` is the concrete implementation for the confidential transfer circuit. It uses:
- BN254 `ecAdd` precompile (0x06) for G1 linear combination
- BN254 `ecMul` precompile (0x07) for scalar multiplication
- BN254 `bn128pairing` precompile (0x08) for the final pairing check

The critical implementation detail is the **pi_b Fp2 swap**: snarkJS emits `pi_b` in `(real, imaginary)` order, but EIP-197 expects `(imaginary, real)`. Callers must swap before submitting.

## Flow testnet addresses

See [DEPLOYMENTS.md](./DEPLOYMENTS.md).
