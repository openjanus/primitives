# Roadmap: AurumFlow — RAILGUN-Class Privacy on Flow

This package is the foundation. AurumFlow is the production vision.

## Current State (this package)

- Depth-8 Merkle tree (256 leaves)
- Single-contributor trusted setup (testnet-grade)
- No relayer (unshield caller observable)
- FLOW-only (no ERC20)
- Amount revealed on unshield
- No POI/compliance layer
- Validated: 4/4 e2e scenarios on Flow EVM testnet

## Gap Analysis: spike → production

| Gap | Current | Production target |
|-----|---------|-------------------|
| Tree depth | 8 (256 leaves) | 20+ (1M+ leaves) |
| Trusted setup | Single contributor | MPC ceremony + beacon |
| Tokens | FLOW only | ERC20 + native FLOW |
| Denominations | Variable | Fixed (privacy) |
| Relayer | None | Decentralized relay network |
| POI | None | Zero-knowledge compliance |
| Anonymity set | 1 (lab) | 1000+ concurrent users |

## L8 — Production Merkle Tree

Replace depth-8 with depth-20 incremental Merkle tree:
- 1,048,576 leaves
- Same Poseidon hash function — circuit changes only in depth parameter
- Tree state stored in events (not on-chain full tree)
- Off-chain indexer required for efficient path queries

## L9 — ERC20 Multi-Token Support

Extend UTXOPool to support arbitrary ERC20 tokens:
- Note commitment includes token address: `Poseidon(amount, token, ns, blinding)`
- Shield/unshield handle ERC20 transferFrom/transfer
- Separate anonymity sets per token denomination

## L10 — MPC Trusted Setup + Beacon

Production-grade trusted setup:
1. Phase 1: Hermez ceremony (pot28_final.ptau — 27 contributors)
2. Phase 2: Per-circuit MPC with 10+ contributors
3. Beacon: Add Flow block hash entropy post-ceremony
4. Redeploy all three verifiers + fresh UTXOPool

## L11 — Relayer Network

Zero-knowledge relayer for recipient privacy:
- Prover generates proof with `recipient = relayer_fee_recipient`
- Relayer submits transaction, pays gas, earns fee
- Recipient receives FLOW at fresh address (never linked to prover)
- Relay network = multiple competing relayers (decentralized)

## L12 — Fixed Denominations

RAILGUN/Tornado-style denomination system:
- Pools: 1 FLOW, 10 FLOW, 100 FLOW, 1000 FLOW
- Users can only deposit/withdraw in fixed amounts
- Amount correlation eliminated from the anonymity analysis
- Multiple pools increase anonymity set per denomination

## L13 — Proof of Innocence (POI)

Compliance layer for institutional use:
- Blocklist of known-bad nullifiers (OFAC, Chainalysis)
- ZK proof: "my note's history does NOT include blocked nullifiers"
- Compatible with RAILGUN POI v2 design
- Allows compliant users to demonstrate clean funds without revealing history

## L14 — AurumFlow Production Launch

Full RAILGUN-class privacy app on Flow:
- Cadence UI: shield/unshield from Blocto/Flow wallet
- EVM SDK: JavaScript SDK for dApp integration
- Relayer network: 5+ independent relayers
- Audit: 2x independent security reviews
- Bug bounty: $50k cap

## Relationship to @openjanus/elgamal

`@openjanus/elgamal` (ElGamal accumulator) and `@openjanus/utxo` (UTXO pool) solve different problems:

- **ElGamal**: Multiple senders contribute encrypted amounts; recipient learns only the total.
  Use for: private payroll, anonymous donations, sealed-bid auctions.

- **UTXO**: Notes are transferred without linking sender to receiver.
  Use for: private transfers, shielded holdings, fungible privacy.

A complete AurumFlow privacy wallet would combine both:
- UTXO model for note transfer (unlinkability)
- ElGamal accumulator for multi-party privacy pools (anonymity)

## Timeline Estimate

| Milestone | Estimate |
|-----------|----------|
| L8 (deeper tree) | 2 weeks |
| L9 (ERC20) | 4 weeks |
| L10 (MPC setup) | 6 weeks (ceremony coordination) |
| L11 (relayer) | 6 weeks |
| L12 (denominations) | 2 weeks |
| L13 (POI) | 8 weeks |
| L14 (production launch) | 12 weeks |

**Estimated total: ~10 months from L8 to production**

Contribution welcome. See the openjanus/primitives repository for development discussion.
