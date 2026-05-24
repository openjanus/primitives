# Contributing to openjanus/primitives

## Overview

This repo contains cryptographic primitives for ZK/privacy applications on Flow.
Contributions should maintain the same bar: functional, tested against live testnet deployments.

## Getting started

```bash
git clone https://github.com/openjanus/primitives.git
cd primitives
npm install
npm test  # unit tests, no network required
```

## Project structure

```
packages/
  babyjub/   BabyJub.sol + TypeScript SDK
  pedersen/  PedersenBabyJub.cdc + SDK
  groth16/   Groth16 verifier + SDK
docs/        Architecture, deployments, roadmap
```

## Adding a new primitive

1. Create `packages/<name>/` following the existing structure
2. Add a `research/` directory with notes before writing code
3. Write the contract first, then the TypeScript SDK
4. Tests must cover: unit (local, no network) + integration (live testnet)
5. Integration tests must pass against LIVE deployed contracts — no mocks

## Commit style

Conventional commits (`feat`, `fix`, `test`, `docs`, `chore`).
English only. Scoped to the package: `feat(babyjub): ...`

## Testing requirements

- All PRs must pass unit tests (`npm test`)
- Integration tests (`RUN_INTEGRATION=1 npm test`) must pass against testnet
- If adding a new contract, it must be deployed and the address documented

## Security

If you find a security issue, do not open a public issue. Contact via GitHub private
security advisory. These are experimental primitives — not for production use.
