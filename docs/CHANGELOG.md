# Changelog

## v0.1.0 (2026-05-24)

### @openjanus/babyjub

**New package.** BabyJubJub twisted Edwards curve operations on Flow EVM.

- `BabyJub.sol` — `babyAdd`, `isOnCurve`, `identity`, `negate`
- TypeScript SDK — `babyAddOnChain`, `isOnCurveOnChain`, `negatePoint`, `encodeBabyAdd`
- Deployed at `0x27139AFda7425f51F68D32e0A38b7D43BcB0f870` (Flow EVM testnet)
- 52 tests (20 unit + 16 integration + 16 edge case) — all passing against live testnet

### @openjanus/pedersen

**New package.** Pedersen commitments on BabyJubJub via Flow cross-VM.

- `PedersenBabyJub.cdc` — `addCommits`, `subCommits`, `negate`, `identity`, `isIdentity`
- TypeScript SDK — `computeCommitment`, `addCommitmentsLocal`, `subCommitmentsLocal`
- Deployed at `0x7599043aea001283` (Flow Cadence testnet)
- 14 tests (all local/unit via circomlibjs reference vectors)

### @openjanus/groth16

**New package.** Groth16 verifier infrastructure on Flow EVM.

- `Groth16Verifier.sol` — abstract template / interface
- `ConfidentialTransferVerifier.sol` — reference implementation (6 public signals)
- TypeScript SDK — `proofToEVMFormat` (pi_b swap), `verifyOnChain`, `verifyLocally`, `parsePublicSignals`
- Deployed at `0x70FA331534619DBd4051b22b7fb19e647be141b0` (Flow EVM testnet)
- 10 unit tests passing; integration test blocked by zkey mismatch (see DEPLOYMENTS.md)

### Cross-cutting

- Monorepo workspace structure with npm workspaces
- Research notes: BabyJubJub curve theory, Pedersen commitments, Groth16 mechanics
- pi_b swap documentation (real bug found during development)
- Testnet deployment registry (`deployments/testnet.json`)
- GitHub Actions CI workflow (unit tests + TypeScript type check)
- RESEARCH_ROADMAP.md — stealth addresses, UTXO transfers, ERC-7984

## Known issues in v0.1.0

- **ConfidentialTransfer zkey mismatch**: The deployed verifier was compiled from a different
  trusted setup than the current `verification_key.json`. End-to-end proof generation + on-chain
  verification requires matching zkey recovery or redeployment.
- **snarkJS + Vitest worker incompatibility**: snarkJS uses web workers that are incompatible
  with Vitest's test environment. The integration test runs snarkjs outside the test runner.
