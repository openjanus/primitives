# BabyJubJub — Research Notes

## What is BabyJubJub?

BabyJubJub is a twisted Edwards elliptic curve designed to be efficient inside
BN254 Groth16 ZK circuits. It was introduced by the iden3 team and is the curve
used by circomlib's Pedersen hash, EdDSA implementation, and many other circom
components.

The name "BabyJub" comes from Lewis Carroll's "Jabberwocky" — the curve is
embedded in BN254's scalar field (the "big" JubJub).

### Twisted Edwards form

The curve equation is:

```
a * x^2 + y^2 = 1 + d * x^2 * y^2   (over F_p)
```

where:
- `p = 21888242871839275222246405745257275088548364400416034343698204186575808495617`
  (= BN254 scalar field prime, also called Fr)
- `a = 168700`
- `d = 168696`

### Why twisted Edwards?

The twisted Edwards form has a **complete addition law** — the formula works
for all pairs of points including the identity, without requiring special cases
for point-at-infinity or when P1 = P2. This is essential for circuit efficiency:

- Weierstrass addition (used by secp256k1, BN254) requires special cases.
- Edwards/twisted Edwards addition is complete (no branches) — much cheaper in circuits.

BabyJubJub's addition formula requires only 6 multiplications and 4 additions
modulo `p`, compared to 10+ for Weierstrass.

## The addition law

For points `(x1, y1)` and `(x2, y2)` on `a*x^2 + y^2 = 1 + d*x^2*y^2`:

```
x3 = (x1*y2 + y1*x2) / (1 + d*x1*x2*y1*y2)
y3 = (y1*y2 - a*x1*x2) / (1 - d*x1*x2*y1*y2)
```

Division modulo `p` is implemented via Fermat's little theorem:
`a^{-1} mod p = a^{p-2} mod p` (since p is prime).

On EVM, the `modexp` precompile at address `0x05` computes `b^e mod m` in
~450 gas. `babyAdd` calls it twice (once per denominator), for ~900 gas total
plus ~4,400 gas for the field arithmetic — about 5,300 gas total.

## Identity element

The identity (neutral element) for BabyJubJub is `(0, 1)`.

Verification: substituting `x=0, y=1` into `a*x^2 + y^2 = 1 + d*x^2*y^2`:
- LHS: `0 + 1 = 1`
- RHS: `1 + 0 = 1` ✓

Adding any point `P` to identity returns `P` unchanged — the addition formula
yields `(x3, y3) = (x, y)` when `(x2, y2) = (0, 1)`.

## Negation

In twisted Edwards coordinates, the additive inverse of `(x, y)` is `(-x, y)`.

So `-x mod p = p - x` for `x != 0`, and `0` for `x = 0`.

This is trivially cheap — no modexp call, just one subtraction.

## Generators used in circomlib

circomlib uses two generator conventions:

1. **Standard generator `G`**: the base generator of the prime-order subgroup
   - `x = 995203441582195749578291179787384436505546430278305826713579947235728471134`
   - `y = 5472060717959818805561601436314318772137091100104008585924551046643952123905`

2. **BASE8** (= 8 * G): what circomlib's Pedersen hash uses as its base point
   - `x = 5299619240641551281634865583518297030282874472190772894086521144482721001553`
   - `y = 16950150798460657717958625567821834550301663161624707787222815936182638968203`

For Pedersen commitments specifically, circomlib uses BASE8 (and derived points)
as generators, not the raw G above. The `buildPedersenHash` function from
`@iden3/circomlibjs` handles this internally.

## Why use BabyJubJub on Flow EVM?

The primary reason is circuit efficiency:

- An in-circuit BN254 EC point addition costs ~2 million constraints.
- An in-circuit BabyJubJub point addition costs ~6 constraints.
  (BabyJubJub lives in BN254's scalar field, so field elements ARE native in-circuit.)

This makes BabyJubJub Pedersen commitments the only practical approach for
always-private confidential balances with Groth16 proofs.

On-chain (Flow EVM), BabyJubJub operations are not natively supported but can
be implemented with `mulmod` / `addmod` plus the `modexp` precompile for
field inverses. The `BabyJub.sol` contract in this package does exactly that.

## Relationship to this package

`packages/babyjub/` provides:
1. `contracts/solidity/BabyJub.sol` — the on-chain primitive
2. `src/` — TypeScript SDK for off-chain operations + cross-VM call helpers
3. `tests/` — tests against the deployed contract at `0x27139AFda7425f51F68D32e0A38b7D43BcB0f870`

## References

- [BabyJubJub spec (iden3)](https://iden3-docs.readthedocs.io/en/latest/iden3_repos/research/publications/zkproof-standards-workshop-2/baby-jubjub/baby-jubjub.html)
- [circomlib BabyJub circuit](https://github.com/iden3/circomlib/blob/master/circuits/babyjub.circom)
- [circomlibjs addPoint implementation](https://github.com/iden3/circomlibjs/blob/main/src/babyjub.js)
- [EIP-197 — BN128 precompiles](https://eips.ethereum.org/EIPS/eip-197)
