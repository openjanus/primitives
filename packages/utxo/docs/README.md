# @openjanus/utxo

**Privacy UTXO primitive for Flow** — Merkle tree + nullifiers + ZK shield/transfer/unshield.

This package is the foundation for building AurumFlow-class RAILGUN-style privacy
applications on Flow EVM. It is a **primitive**, not a complete privacy app.

## What it is

A UTXO-model privacy pool on Flow EVM:
- Users deposit FLOW by creating a **note** (commitment in a Merkle tree)
- Notes can be **transferred** to new owners without revealing the link
- Notes can be **unshielded** (withdrawn) by proving Merkle inclusion
- All operations are proven with Groth16 zero-knowledge proofs
- The on-chain contract only sees commitments and nullifiers — never private keys

Validated on Flow EVM testnet (2026-05-25): 4/4 scenarios passed.

## What it is NOT

- A production privacy system (see [PRIVACY_PROPERTIES.md](PRIVACY_PROPERTIES.md))
- A complete RAILGUN/Tornado implementation
- An audit-grade codebase
- A deployment with a production-grade trusted setup

## When to use

Use this package when you need:
- **Unlinkable transfers**: Alice sends to Bob without on-chain link
- **Shielded balances**: hold FLOW privately, spend selectively
- **ZK-gated state transitions**: Merkle inclusion proofs on Flow EVM
- **Building blocks**: extend this into a full privacy wallet (see [ROADMAP_AURUMFLOW.md](ROADMAP_AURUMFLOW.md))

Do NOT use for:
- Accumulating encrypted balances without spending (use `@openjanus/elgamal`)
- Production systems with real funds (testnet-grade setup)
- Privacy without a relayer (unshield reveals recipient)

## Install

```bash
npm install @openjanus/utxo
```

## Quick Start

```typescript
import {
  createNote,
  proveShield,
  proveTransfer,
  proveUnshield,
  PoseidonMerkleTree,
  UTXOPoolClient,
  assertCanonicalPoseidon,
} from "@openjanus/utxo";

// 1. Sanity check: canonical Poseidon (fails fast if implementation is broken)
await assertCanonicalPoseidon();

// 2. Alice creates a note and shields 10 FLOW
const aliceNote = await createNote(10n);
const shieldResult = await proveShield(aliceNote);

// 3. Get calldata for UTXOPool.shield() via Cadence COA
const client = UTXOPoolClient.testnet();
const shieldCalldata = client.encodeShield(
  shieldResult.proof,
  shieldResult.commitment,
  shieldResult.publicAmount
);
// Pass shieldCalldata to a Cadence transaction: coa.call(poolAddress, shieldCalldata, ...)

// 4. After on-chain confirmation, resolve the note with its leaf index
//    (get leafIndex from the Shielded event emitted by UTXOPool)
const resolvedAlice = { ...aliceNote, commitment: shieldResult.commitment, leafIndex: 0 };

// 5. Build off-chain Merkle tree (sync from on-chain Shielded events)
const tree = await PoseidonMerkleTree.create();
await tree.insertLeaf(shieldResult.commitment);

// 6. Alice transfers to Bob
const bobNote = await createNote(10n);
const path = await tree.getProof(0);
const transferResult = await proveTransfer(resolvedAlice, bobNote, path);
const transferCalldata = client.encodeTransfer(
  transferResult.proof,
  transferResult.oldNullifierHash,
  transferResult.newCommitment,
  transferResult.root
);
// Call UTXOPool.transfer() from any EOA (no COA needed for transfer)

// 7. Bob unshields (withdraws FLOW)
const resolvedBob = { ...bobNote, commitment: transferResult.newCommitment, leafIndex: 1 };
await tree.insertLeaf(transferResult.newCommitment);
const bobPath = await tree.getProof(1);
const unshieldResult = await proveUnshield(resolvedBob, bobPath, "0xRecipientAddress");
const unshieldCalldata = client.encodeUnshield(
  unshieldResult.proof,
  unshieldResult.nullifierHash,
  unshieldResult.publicAmount,
  unshieldResult.root,
  "0xRecipientAddress"
);
// Pass unshieldCalldata to Cadence transaction via COA
```

## UTXO vs ElGamal Accumulator

| Property | `@openjanus/utxo` | `@openjanus/elgamal` |
|----------|-------------------|----------------------|
| Model | UTXO (spend notes) | Accumulator (add ciphertexts) |
| Unlinkability | YES (sender→receiver link hidden) | NO (same tx chain) |
| Transfer privacy | YES (full unlinkability) | NO (accumulate is public) |
| Amount privacy on spend | Amount revealed | Amount stays private |
| Multiple senders | Anonymous set | Direct accumulation |
| Best for | Shielded transfers | Private balance tracking |
| Complexity | Higher (Merkle proofs) | Lower (direct crypto) |

## Deployed Contracts (Flow EVM Testnet)

| Contract | Address |
|----------|---------|
| UTXOPool | `0x6c1c172068f8325bd1f6564bc2fBa5B0A9BB1725` |
| ShieldGroth16Verifier | `0xCDfc8496C28a6d7e931C2A4FC95709381A43365D` |
| TransferGroth16Verifier | `0x25bd550F8fE81A0A9f5bf43a0BCf40152F9C4674` |
| UnshieldGroth16Verifier | `0xbe5449F55D1edb695aA08a5cee34885AcD60DC50` |
| PoseidonT3 | `0xAA31b4EE06282d2580550C25dC32B5EAF0712F1E` |
| PoseidonT4 | `0xda71Ba9ecAb56dAa64fEc9CD6fC2a8782862CF25` |

These are testnet-grade contracts (single-contributor trusted setup). Do not use for production funds.

## Performance (from testnet run)

| Operation | Gas | Proof time |
|-----------|-----|-----------|
| shield() | ~593k gas | ~374ms |
| transfer() | ~586k gas | ~379ms |
| unshield() | ~266k gas | ~333ms |

## Further Reading

- [ARCHITECTURE.md](ARCHITECTURE.md) — full circuit + contract design
- [USAGE_GUIDE.md](USAGE_GUIDE.md) — step-by-step shield→transfer→unshield
- [PRIVACY_PROPERTIES.md](PRIVACY_PROPERTIES.md) — honest privacy analysis
- [ROADMAP_AURUMFLOW.md](ROADMAP_AURUMFLOW.md) — path to RAILGUN-class production
