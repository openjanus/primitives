# openjanus/primitives

Cryptographic primitives for privacy applications on Flow blockchain.

This monorepo provides production-ready building blocks for zero-knowledge and commitment-based privacy systems running on [Flow](https://flow.com) — specifically targeting the unique cross-VM architecture where Cadence transactions call into Flow EVM atomically.

## SDK

The TypeScript SDKs for these primitives have been consolidated into [`@openjanus/sdk`](https://github.com/openjanus/sdk).

```bash
npm install @openjanus/sdk
```

```typescript
import { primitives } from "@openjanus/sdk";
// primitives.babyjub, primitives.pedersen, primitives.groth16
```

This repository now contains only the Cadence and Solidity contracts (non-TypeScript artifacts).

## Packages (contracts only)

| Package | Description | Status |
|---------|-------------|--------|
| [`@openjanus/babyjub`](./packages/babyjub/) | BabyJub.sol — BabyJubJub EC on Flow EVM | v0.1.0 |
| [`@openjanus/pedersen`](./packages/pedersen/) | PedersenBabyJub.cdc — Pedersen on Cadence | v0.1.0 |
| [`@openjanus/groth16`](./packages/groth16/) | ConfidentialTransferVerifier.sol — Groth16 | v0.1.0 |

## Why Flow?

Flow's cross-VM architecture lets Cadence contracts call EVM contracts atomically within a single transaction. This creates an unusual design space:

- **EVM side**: BN254 precompiles (`ecAdd` at 0x06, `ecMul` at 0x07, `modexp` at 0x05) are available and fast.
- **Cadence side**: Cadence Owned Accounts (COAs) dispatch EVM calls with ~16 CU overhead, far cheaper than reimplementing field arithmetic natively.
- **Result**: BabyJubJub point addition (`babyAdd`) costs ~35k EVM gas but only ~16 Cadence CU, well within the 9,999 CU per-transaction limit.

This combination makes confidential balances — historically a research exercise — practically deployable on Flow.

## Deployed contracts (Flow testnet)

| Contract | Chain | Address |
|----------|-------|---------|
| `BabyJub.sol` | Flow EVM testnet | `0x27139AFda7425f51F68D32e0A38b7D43BcB0f870` |
| `PedersenBabyJub.cdc` | Flow Cadence testnet | `0x7599043aea001283` |
| `ConfidentialTransferVerifier.sol` | Flow EVM testnet | `0x70FA331534619DBd4051b22b7fb19e647be141b0` |

Full registry: [docs/DEPLOYMENTS.md](./docs/DEPLOYMENTS.md)

## Quick start

```bash
# Install all workspace dependencies
npm install

# Build all packages
npm run build

# Run unit tests (no network required)
npm test

# Run integration tests against live testnet deployments
npm run test:integration
```

## Architecture overview

```
packages/
  babyjub/     BabyJub.sol (Solidity) + TypeScript SDK
               Deployed once, callable from any EVM or COA transaction
               
  pedersen/    PedersenBabyJub.cdc (Cadence) wrapping BabyJub.sol cross-VM
               Homomorphic add/sub on commitment points
               
  groth16/     Groth16Verifier.sol template + ConfidentialTransferVerifier reference
               Generic BN254 Groth16 verification infrastructure
```

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the full design.

## Security notes

**EXPERIMENTAL — not audited. Do not use with real funds.**

- Groth16 zkey uses a single-contributor phase 2 trusted setup — not safe for production.
- Range constraints in the circuit have not been formally audited for underconstrained Num2Bits issues.
- BabyJub.sol has been tested against circomlib reference vectors but has not undergone a formal audit.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
