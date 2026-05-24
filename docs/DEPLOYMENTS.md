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

## EVM Contracts (Flow EVM testnet, chainId 545)

| Contract | Address | Deploy Tx | Notes |
|----------|---------|-----------|-------|
| `BabyJub.sol` | `0x2c40513b343B70f2A0B7e6Ad6F997DDa819D6f07` | `1d79ef1240b26d4a9982b995f1cdb49f5f9963154f679bfed4bd2c28a1a8cd45` | Stateless — babyAdd, isOnCurve, identity, negate |
| `ConfidentialTransferVerifier.sol` | `0x0085F286d89af79EC59E27CD0c5CcD1c55f42Cf5` | `204484bef3c5ac3d195066ceea964f203fc219407e4696c2b7ea49fd1421d094` | Groth16 verifier compiled from current canonical zkey |

## Cadence Contracts (Flow Cadence testnet)

| Contract | Address | Notes |
|----------|---------|-------|
| `PedersenBabyJub.cdc` | `0x28fef3d1d6a12800` | Cadence module wrapping BabyJub.sol via cross-VM |

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

To verify the ConfidentialTransferVerifier.sol at `0x0085F286d89af79EC59E27CD0c5CcD1c55f42Cf5`,
generate a fresh proof with the current zkey and submit it. The verifier should return `true`.

## Gas measurements (empirical, Flow EVM testnet)

| Contract | Function | Gas | Notes |
|----------|----------|-----|-------|
| `BabyJub.sol` | `babyAdd(G, G)` | 34,511 | Two modexp precompile calls |
| `BabyJub.sol` | `isOnCurve(G)` | 23,660 | Pure arithmetic |
| `BabyJub.sol` | `identity()` | 21,600 | Constant return |
| `BabyJub.sol` | `negate(G)` | 23,660 | One subtraction |
| `ConfidentialTransferVerifier.sol` | `verifyProof(...)` | 253,531 | BN254 pairing (6 public inputs) |

## Lab experimental addresses (NOT canonical openjanus)

These addresses were created during the private lab development phase.
They are functional but are no longer maintained as official openjanus addresses:

| Contract | Address | Status |
|----------|---------|--------|
| `BabyJub.sol` (lab) | `0x27139AFda7425f51F68D32e0A38b7D43BcB0f870` | Lab only — use openjanus address above |
| `ConfidentialTransferVerifier.sol` (lab) | `0x70FA331534619DBd4051b22b7fb19e647be141b0` | Broken — delta constants do not match current zkey. Use openjanus address above. |
| `PedersenBabyJub.cdc` (lab) | `0x7599043aea001283` | Lab only — use openjanus address above |

**Migration note**: If you were using the lab addresses, update your constants to the
canonical openjanus addresses listed in the tables above. The `DEPLOYED_ADDRESS`,
`VERIFIER_ADDRESS`, and `PEDERSEN_CADENCE_ADDRESS` exports in the SDK packages
already point to the canonical addresses as of this update.
