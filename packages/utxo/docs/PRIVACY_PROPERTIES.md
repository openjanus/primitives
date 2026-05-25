# Privacy Properties

An honest assessment of what this package provides and what it does not.

## What is Protected

### Sender-Receiver Unlinkability
The link between who shielded FLOW and who unshielded it is cryptographically hidden:

- **Shield event**: emits `(commitment, leafIndex, newRoot)` — commitment looks random
- **Transfer event**: emits `(oldNullifier, newCommitment, leafIndex, newRoot)` — links note A → note B, but not to the original shield
- **Unshield event**: emits `(nullifier, amount, recipient)` — the nullifier cannot be linked to a commitment without the spending key

An on-chain observer sees: "some note was spent, a new note was created, some note was withdrawn." They CANNOT determine that the shielder and unshielder are related, provided the anonymity set is large enough.

**Validated**: The lab e2e test confirmed that Alice's commitment and Alice's nullifier are unrelated field elements — an observer cannot brute-force the link without `alice_ns`.

### Spending Key Privacy
`nullifier_secret` (the spending key) is never revealed on-chain. An observer cannot determine who owns a note.

### Note Content Privacy
Amount and blinding are never revealed on-chain (except on unshield, where `public_amount` is emitted).

## What is NOT Protected

### Amount Revealed on Unshield
The `Unshielded` event includes `amount`. An observer knows how much FLOW was withdrawn and by whom.

**Mitigation (production)**: Fixed denominations (like Tornado Cash) — users can only deposit/withdraw one denomination, removing amount-based correlation.

### Single-User Anonymity Set
In the spike, only one user deposited and withdrew. An observer can correlate by timing and amount even if the cryptographic link is broken.

**Mitigation (production)**: Large anonymity set (many concurrent users), time-delayed transfers (decouple deposit and withdrawal by hours/days).

### Timing Correlation
Shield and unshield events are on-chain and timestamped. In a small pool, timing can correlate depositor and withdrawer.

**Mitigation (production)**: Require minimum time delay between shield and unshield (Forte decoupling).

### Recipient Bound in Proof
The `recipient` address is a public signal in the unshield proof. This prevents relay front-running but means the recipient identity cannot be changed after proof generation.

**Mitigation (production)**: Use a relayer network — prover submits to relayer, relayer submits on-chain, relayer receives a fee. The recipient's identity is hidden from the relay.

### No Compliance Layer
There is no Proof of Innocence (POI) mechanism. Production privacy systems require compliance metadata to distinguish legitimate use from sanctions evasion.

## Depth-8 Tree Limitation

The tree holds 256 leaves. This means:
- Maximum 256 total notes (shield + transfer receive)
- After 256 operations, the tree is full — new notes cannot be created
- Production would need depth 20+ (1M+ leaves)

## Trusted Setup

The zkeys in `circuits/setup/` were generated with a single-contributor Phase 1 ceremony (pot14). A malicious contributor could have retained a backdoor that allows creating proofs for invalid notes.

**Production requirement**: Multi-party ceremony (MPC) with at least one honest contributor who destroys their randomness. Use Hermez ceremony output (pot28) with an additional Flow block beacon contribution.

## Comparison with RAILGUN

| Feature | @openjanus/utxo | RAILGUN |
|---------|-----------------|---------|
| Note model | UTXO | UTXO |
| Tree depth | 8 (256 leaves) | 16+ (65k+) |
| Multi-token | No (FLOW only) | Yes (ERC20) |
| Denominations | Variable | Variable |
| Relayer | No | Yes |
| POI | No | Yes |
| Trusted setup | Single contributor | MPC ceremony |
| Production | No | Yes |

## Summary

This package demonstrates that UTXO-model privacy is achievable on Flow EVM with:
- Cryptographic sender-receiver unlinkability (confirmed)
- On-chain note commitment + nullifier system (confirmed)
- Groth16 proof verification at ~580k gas (confirmed)

It does NOT provide production privacy. Use it to understand the primitive and build toward production (see [ROADMAP_AURUMFLOW.md](ROADMAP_AURUMFLOW.md)).
