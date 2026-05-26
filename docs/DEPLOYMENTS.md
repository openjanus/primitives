# Testnet Deployments

All contracts in this registry are deployed on **Flow EVM testnet** (chainId 545)
and **Flow Cadence testnet**. These are the canonical openjanus addresses referenced
by the SDK constants and test suites.

## Canonical openjanus account

| Item | Value |
|------|-------|
| Cadence account | `0x28fef3d1d6a12800` |
| COA EVM address | `0x0000000000000000000000027eb18dc34b9966fd` |
| COA deploy tx | `cd361268e40aad6ea598b1ed9f0c7d1d95c442c164bfac9488cac16a222c6fab` |

All EVM contracts in this registry are deployed from the openjanus COA address. This
ensures a consistent deployer identity and clear ownership.

## EVM Contracts — v0.2.0 (Flow EVM testnet, chainId 545)

Trusted setup: Hermez pot14 (200+ contributors) + Flow VRF beacon
(testnet block 323555648, hash `30f1f68eed7ea6e7b4964e798ff8a0e2b77e7ca073ed80ac44d39ddc5fb395e7`).

| Contract | Address | Deploy Tx | Notes |
|----------|---------|-----------|-------|
| `BabyJub.sol` | `0x2c40513b343B70f2A0B7e6Ad6F997DDa819D6f07` | `1d79ef1240b26d4a9982b995f1cdb49f5f9963154f679bfed4bd2c28a1a8cd45` | Stateless — babyAdd, isOnCurve, identity, negate |
| `ConfidentialTransferVerifier.sol` | `0x0085F286d89af79EC59E27CD0c5CcD1c55f42Cf5` | `204484bef3c5ac3d195066ceea964f203fc219407e4696c2b7ea49fd1421d094` | Groth16 verifier compiled from current canonical zkey |

### JanusToken v0.2.0 contracts (openjanus/contracts — ceremony-backed)

| Contract | Address | Deploy Tx | Notes |
|----------|---------|-----------|-------|
| `JanusToken.sol` | `0xb12E600fFcde967210cFD81CF9f32bBB6e68a499` | `e477d1f0a6d61ad05aef86429b13e67c4cc07810925000f93b7c56d0e8505842` | ElGamal accumulator |
| `EncryptConsistencyVerifier` | `0x0C1e731036f4632CF9620bf6C6BB8204eD3a3B1e` | `756fb51756372a29111d4926e882267521746621e0889b04fda67c29f9839b38` | Groth16, encrypt_consistency circuit |
| `DecryptOpenVerifier` | `0x1c248dA94aab9f4A03005E7944a8b745a6236Dbc` | `c72c0f0e9579e4b25e66ff1ccbb42ab9833785a45b87c14b3014e5b9dbf68ed8` | Groth16, decrypt_open circuit |
| `BabyJub.sol` (lab, reused) | `0x27139AFda7425f51F68D32e0A38b7D43BcB0f870` | — | Stateless, unchanged from v0.1.0 |

## Cadence Contracts (Flow Cadence testnet)

| Contract | Address | Notes |
|----------|---------|-------|
| `PedersenBabyJub.cdc` | `0x28fef3d1d6a12800` | Cadence module wrapping BabyJub.sol via cross-VM |
| `JanusFlow.cdc` | `0x28fef3d1d6a12800` | Legacy v1 (Pedersen architecture). See note below. |

**JanusFlow Cadence note:** The on-chain JanusFlow contract at `0x28fef3d1d6a12800` is
legacy v1 (Pedersen commitment architecture, deployed in an earlier sprint). Flow protocol
requires FlowServiceAccount authorization to remove a contract, which was not available
during the v0.2.0 sprint. For v0.2.0, use JanusToken EVM directly via COA. A wrapper
redeploy under an alternative name is planned for v0.3.0.

## EVM RPC Endpoints

| Network | RPC | Chain ID |
|---------|-----|----------|
| Flow EVM testnet | `https://testnet.evm.nodes.onflow.org` | 545 |
| Flow EVM mainnet | `https://mainnet.evm.nodes.onflow.org` | 747 |

## Cadence Access Nodes

| Network | REST API |
|---------|---------|
| Flow testnet | `https://rest-testnet.onflow.org` |
| Flow mainnet | `https://rest-mainnet.onflow.org` |

## Verification

To verify the BabyJub.sol deployment at `0x2c40513b343B70f2A0B7e6Ad6F997DDa819D6f07`:

```bash
# Call identity() — should return (0, 1)
cast call 0x2c40513b343B70f2A0B7e6Ad6F997DDa819D6f07 \
  "identity()(uint256,uint256)" \
  --rpc-url https://testnet.evm.nodes.onflow.org

# Call babyAdd(G, G) — should return 2G coordinates
cast call 0x2c40513b343B70f2A0B7e6Ad6F997DDa819D6f07 \
  "babyAdd(uint256,uint256,uint256,uint256)(uint256,uint256)" \
  995203441582195749578291179787384436505546430278305826713579947235728471134 \
  5472060717959818805561601436314318772137091100104008585924551046643952123905 \
  995203441582195749578291179787384436505546430278305826713579947235728471134 \
  5472060717959818805561601436314318772137091100104008585924551046643952123905 \
  --rpc-url https://testnet.evm.nodes.onflow.org
# Expected: 1676417244152142056454616115823988517566305896059373631785843290555309632953
#           11563908930482997415800970727888501192209530935490958274440594569809848042842
```

To verify the JanusToken v0.2.0 verifiers, generate a fresh proof with the
ceremony zkeys (`packages/elgamal/circuits/setup/`) and submit to the verifier.
The verifier should return `true`.

## Gas measurements (empirical, Flow EVM testnet)

| Contract | Function | Gas | Notes |
|----------|----------|-----|-------|
| `BabyJub.sol` | `babyAdd(G, G)` | 34,511 | Two modexp precompile calls |
| `BabyJub.sol` | `isOnCurve(G)` | 23,660 | Pure arithmetic |
| `BabyJub.sol` | `identity()` | 21,600 | Constant return |
| `BabyJub.sol` | `negate(G)` | 23,660 | One subtraction |
| `ConfidentialTransferVerifier.sol` | `verifyProof(...)` | 253,531 | BN254 pairing (6 public inputs) |
| `JanusToken.sol` | `registerPubkey()` | ~80,000 | One-time per account |
| `JanusToken.sol` | `wrap() with ZK proof` | ~326,000 | EncryptConsistency verify + slot update |

## DEPRECATED — v0.1.0 addresses (2026-05-25, single-contributor lab setup)

These addresses used a lab pot14 setup (single contributor, no ceremony).
DO NOT USE for any new integrations.

| Contract | DEPRECATED Address | Replacement |
|----------|--------------------|-------------|
| `JanusToken.sol` | `0xC715b3647536F671Aa25A6B6Ea1d7f5a0b9fA63D` | `0xb12E600fFcde967210cFD81CF9f32bBB6e68a499` |
| `EncryptConsistencyVerifier` | `0x6F8Cc93dd6aA7B3ED0a3DaA75271815558ad9b5C` | `0x0C1e731036f4632CF9620bf6C6BB8204eD3a3B1e` |
| `DecryptOpenVerifier` | `0x3bB139B5404fD6b152813bC3532367AAa096638b` | `0x1c248dA94aab9f4A03005E7944a8b745a6236Dbc` |

## Lab experimental addresses (NOT canonical openjanus)

These addresses were created during the private lab development phase.
They are functional but are no longer maintained as official openjanus addresses:

| Contract | Address | Status |
|----------|---------|--------|
| `BabyJub.sol` (lab) | `0x27139AFda7425f51F68D32e0A38b7D43BcB0f870` | Lab/reuse — stateless, safe to call |
| `ConfidentialTransferVerifier.sol` (lab) | `0x70FA331534619DBd4051b22b7fb19e647be141b0` | Broken — delta constants do not match current zkey. Use openjanus address above. |
| `PedersenBabyJub.cdc` (lab) | `0x7599043aea001283` | Lab only — use openjanus address above |

**Migration note**: If you were using the lab addresses, update your constants to the
canonical openjanus addresses listed in the tables above.
