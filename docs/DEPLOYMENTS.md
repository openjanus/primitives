# Testnet Deployments

All contracts in this registry are deployed on **Flow EVM testnet** (chainId 545)
and **Flow Cadence testnet**. These are the addresses referenced by the test suites.

## DO NOT REDEPLOY

These contracts are the canonical references for the test suites. Redeploying
would change the addresses and break integration tests. If a new version is needed,
deploy alongside the existing contracts and update the SDK constants.

## EVM Contracts (Flow EVM testnet, chainId 545)

| Contract | Address | Deploy Tx | Notes |
|----------|---------|-----------|-------|
| `BabyJub.sol` | `0x27139AFda7425f51F68D32e0A38b7D43BcB0f870` | `3dc189b1da6d54cf799b88962587b1f138b2c1c7a83f30abc00c4231331fb905` | Stateless — babyAdd, isOnCurve, identity, negate |
| `ConfidentialTransferVerifier.sol` | `0x70FA331534619DBd4051b22b7fb19e647be141b0` | `4bd009caa17e774d95fcb9ffd0c13cf16191fee390a6578bf1b9b49f4c0b02f9` | Groth16 verifier for ConfidentialTransfer v2 circuit |
| `ConfidentialToken v2` (reference only) | `0x773F213b557e05B08150014eF861970e79CeA974` | — | Token using confidential balances — not part of primitives |

## Cadence Contracts (Flow Cadence testnet)

| Contract | Address | Notes |
|----------|---------|-------|
| `PedersenBabyJub.cdc` | `0x7599043aea001283` | Cadence module wrapping BabyJub.sol via cross-VM |

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

To verify the BabyJub.sol deployment at `0x27139AFda7425f51F68D32e0A38b7D43BcB0f870`:

```bash
# Call identity() — should return (0, 1)
cast call 0x27139AFda7425f51F68D32e0A38b7D43BcB0f870 \
  "identity()(uint256,uint256)" \
  --rpc-url https://testnet.evm.nodes.onflow.org

# Call babyAdd(G, G) — should return 2G coordinates
cast call 0x27139AFda7425f51F68D32e0A38b7D43BcB0f870 \
  "babyAdd(uint256,uint256,uint256,uint256)(uint256,uint256)" \
  995203441582195749578291179787384436505546430278305826713579947235728471134 \
  5472060717959818805561601436314318772137091100104008585924551046643952123905 \
  995203441582195749578291179787384436505546430278305826713579947235728471134 \
  5472060717959818805561601436314318772137091100104008585924551046643952123905 \
  --rpc-url https://testnet.evm.nodes.onflow.org
# Expected: 1676417244152142056454616115823988517566305896059373631785843290555309632953
#           11563908930482997415800970727888501192209530935490958274440594569809848042842
```

## Gas measurements (empirical, Flow EVM testnet)

| Contract | Function | Gas | Notes |
|----------|----------|-----|-------|
| `BabyJub.sol` | `babyAdd(G, G)` | 34,511 | Two modexp precompile calls |
| `BabyJub.sol` | `isOnCurve(G)` | 23,660 | Pure arithmetic |
| `BabyJub.sol` | `identity()` | 21,600 | Constant return |
| `BabyJub.sol` | `negate(G)` | 23,660 | One subtraction |
| `ConfidentialTransferVerifier.sol` | `verifyProof(...)` | 253,531 | BN254 pairing (6 public inputs) |
