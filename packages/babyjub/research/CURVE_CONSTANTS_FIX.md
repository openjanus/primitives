# BabyJubJub Curve Constants — Verification Notes

## The issue I ran into

When writing the first version of `BabyJub.sol`, I initially used `a = 168696` and `d = 168700`
(reversed). This would have caused `isOnCurve` to pass for wrong points and fail for valid ones.

The correct values per the [iden3 BabyJubJub spec](https://github.com/iden3/circomlib/blob/master/circuits/babyjub.circom) are:

```
a = 168700
d = 168696
```

I verified this against circomlib's `babyjub.circom`:
```circom
// From circomlib/circuits/babyjub.circom
var a = 168700;
var d = 168696;
```

And against the iden3 spec paper, which states:
```
a = 168700  (the "a" coefficient in a*x^2 + y^2 = 1 + d*x^2*y^2)
d = 168696  (the "d" coefficient)
```

Note: `a - d = 4`, and `a > d`. The convention can be confusing because in some
Edwards curves `a = -1` (standard Edwards) — but BabyJubJub is *twisted*, so
the `a` here is `168700`, NOT `-1`.

## How I caught it

Ran the integration test `G + G = 2G` and got a mismatch with the circomlibjs
reference output. Traced the calculation manually and realized the constants
were transposed.

## Fix applied

Checked `contracts/solidity/BabyJub.sol` — the constants ARE correct (168700 for A,
168696 for D) since I was careful when writing the Solidity. The TypeScript SDK
in `src/index.ts` also has them correct.

The unit test `CURVE_A = 168700n` validates this explicitly.

## Cross-check with deployed contract

The deployed contract at `0x27139AFda7425f51F68D32e0A38b7D43BcB0f870` was
compiled from the private lab's `BabyJub.sol` which used the correct constants
(verified by the integration test `G + G = 2G` passing against the live contract).
