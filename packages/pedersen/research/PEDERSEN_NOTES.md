# Pedersen Commitments — Research Notes

## What is a Pedersen commitment?

A Pedersen commitment is a cryptographic commitment scheme with two properties:

1. **Hiding**: The commitment reveals nothing about the committed value.
2. **Binding**: Once committed, you cannot open the commitment to a different value.

The scheme requires two independent generators `G` and `H` of the same group.
A commitment to value `v` with blinding factor `r` is:

```
C = v*G + r*H
```

"Independent" means nobody knows the discrete log of `H` with respect to `G`
(i.e., nobody knows `k` such that `H = k*G`). This is ensured by a
"nothing-up-my-sleeve" construction: hash a fixed string to get `H`.

## Hiding property

Given a commitment `C`, an adversary learns nothing about `v` — because for any
target value `v'` there exists a blinding `r'` such that `v'*G + r'*H = C`.
The blinding factor `r` is chosen uniformly at random and kept secret.

## Binding property

The scheme is binding under the discrete logarithm assumption: the committer
cannot find two pairs `(v, r)` and `(v', r')` with `v != v'` such that
`v*G + r*H = v'*G + r'*H`, because that would imply `(v-v')*G = (r'-r)*H`,
giving the discrete log of `H` w.r.t. `G`.

## The homomorphic property

Pedersen commitments are **additively homomorphic**:

```
Commit(a, r1) + Commit(b, r2)
  = (a*G + r1*H) + (b*G + r2*H)
  = (a+b)*G + (r1+r2)*H
  = Commit(a+b, r1+r2)
```

This means: you can add two commitments to get a commitment to the sum,
without ever revealing `a`, `b`, or the blindings. This is the key property
for confidential balance updates.

## BabyJubJub Pedersen vs BN254 Pedersen

This package uses BabyJubJub (twisted Edwards) as the underlying group:

| Property | BabyJubJub Pedersen | BN254 Pedersen |
|----------|---------------------|----------------|
| Curve | BabyJubJub (twisted Edwards, embedded in BN254) | BN254 (Weierstrass) |
| ZK circuit cost per commitment | ~3,300 constraints | ~2,000,000 constraints |
| On-chain Cadence add cost | ~16 CU (cross-VM dispatch) | ~47,800 CU (not viable) |
| On-chain EVM gas for add | ~34,511 gas (modexp precompile) | ~100+ gas (ecAdd at 0x06, cheaper) |
| Pattern | Always-private (never open) | Commit-and-reveal |
| Use cases | Confidential balances, private transfers | Sealed auctions, voting |

**Rule of thumb**: use BabyJubJub Pedersen when you will NEVER reveal the value.
Use BN254 Pedersen when you eventually need to open the commitment.

## The two-generator requirement

The generators `G` and `H` must be chosen independently. For BabyJubJub:

- `G` (BASE8): `8 * standard_generator` — used by circomlib's Pedersen hash
  ```
  x = 5299619240641551281634865583518297030282874472190772894086521144482721001553
  y = 16950150798460657717958625567821834550301663161624707787222815936182638968203
  ```

The "nothing-up-my-sleeve" principle requires that the choice of generators
is public and verifiable. circomlib's Pedersen hash uses a specific set of
base points derived by hashing compressed BabyJubJub points.

## Off-chain commitment computation

The commitment function used in this package matches circomlib's Pedersen hash:

```javascript
import { buildBabyjub, buildPedersenHash } from "circomlibjs";

async function commit(value, blinding) {
    const pedersenHash = await buildPedersenHash();
    const babyJub = await buildBabyjub();
    const F = babyJub.F;

    // Pack: value (64 bits LE) || blinding (128 bits LE) = 24 bytes
    const buf = Buffer.alloc(24, 0);
    let v = BigInt(value);
    for (let i = 0; i < 8; i++) { buf[i] = Number(v & 0xffn); v >>= 8n; }
    let b = BigInt(blinding);
    for (let i = 8; i < 24; i++) { buf[i] = Number(b & 0xffn); b >>= 8n; }

    const hash = pedersenHash.hash(buf);
    const point = babyJub.unpackPoint(hash);
    return {
        x: F.toObject(point[0]).toString(),
        y: F.toObject(point[1]).toString(),
    };
}
```

Commitments are ALWAYS computed off-chain. The on-chain module (`PedersenBabyJub.cdc`)
provides only point arithmetic for homomorphic updates — it never computes a commitment.

## Why cross-VM for the point addition?

BabyJubJub addition requires two modular inverses (one per denominator in the
twisted Edwards addition formula). Each inverse via Fermat's little theorem
requires exponentiating to `p-2` mod `p`, which costs:

- Pure Cadence: ~47,800 CU per inverse, ~95,600 CU for a single babyAdd → exceeds
  the 9,999 CU per-transaction limit by 9.5x.
- Via EVM cross-VM: ~16 CU Cadence dispatch + ~34,511 gas (using modexp precompile
  at 0x05 for ~450 gas per inverse). Totally viable.

The cross-VM pattern is the ONLY way to make BabyJubJub point operations
transaction-viable on Flow.

## References

- [Pedersen commitment Wikipedia](https://en.wikipedia.org/wiki/Commitment_scheme#Pedersen_commitment)
- [circomlib Pedersen circuit](https://github.com/iden3/circomlib/blob/master/circuits/pedersen.circom)
- [iden3 Pedersen hash spec](https://iden3-docs.readthedocs.io/en/latest/iden3_repos/research/publications/zkproof-standards-workshop-2/pedersen-hash/pedersen.html)
- [Flow cross-VM architecture](https://developers.flow.com/evm/cadence/cross-vm-bridge)
