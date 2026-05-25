/**
 * homomorphic.ts — Homomorphic operations on ElGamal ciphertexts
 *
 * Additive homomorphism on BabyJubjub:
 *   add(E(v1,r1,pk), E(v2,r2,pk)) = E(v1+v2, r1+r2, pk)
 *   negate(E(v,r,pk)) = E(-v, -r, pk)  [useful for subtraction]
 *   scalarMul(E(v,r,pk), k) = E(k*v, k*r, pk)
 *
 * These operations work on ciphertexts encrypted under the SAME public key.
 * Mixing ciphertexts from different keys is cryptographically meaningless.
 */

import type { Ciphertext, Point } from "./types.js";
import { getBabyJub } from "./babyjub.js";

/**
 * Homomorphically add two ciphertexts (must be under the same public key).
 *
 * E(v1,r1,pk) + E(v2,r2,pk) = E(v1+v2, r1+r2, pk)
 */
export async function add(ct1: Ciphertext, ct2: Ciphertext): Promise<Ciphertext> {
  const babyjub = await getBabyJub();
  const Fr = babyjub.F;

  const C1a = [Fr.e(ct1.C1[0]), Fr.e(ct1.C1[1])];
  const C1b = [Fr.e(ct2.C1[0]), Fr.e(ct2.C1[1])];
  const C2a = [Fr.e(ct1.C2[0]), Fr.e(ct1.C2[1])];
  const C2b = [Fr.e(ct2.C2[0]), Fr.e(ct2.C2[1])];

  const C1sum = babyjub.addPoint(C1a, C1b);
  const C2sum = babyjub.addPoint(C2a, C2b);

  return {
    C1: [Fr.toObject(C1sum[0]) as bigint, Fr.toObject(C1sum[1]) as bigint],
    C2: [Fr.toObject(C2sum[0]) as bigint, Fr.toObject(C2sum[1]) as bigint],
  };
}

/**
 * Negate a ciphertext: E(-v, -r, pk).
 * Enables subtraction: add(E(a), negate(E(b))) = E(a-b).
 *
 * BabyJubjub Twisted Edwards negation: (x, y) -> (-x mod p, y)
 */
export async function negate(ct: Ciphertext): Promise<Ciphertext> {
  const babyjub = await getBabyJub();
  const Fr = babyjub.F;

  const negC1: Point = [
    Fr.toObject(Fr.neg(Fr.e(ct.C1[0]))) as bigint,
    ct.C1[1],
  ];
  const negC2: Point = [
    Fr.toObject(Fr.neg(Fr.e(ct.C2[0]))) as bigint,
    ct.C2[1],
  ];

  return { C1: negC1, C2: negC2 };
}

/**
 * Scalar multiply a ciphertext by k:
 * scalarMul(E(v,r,pk), k) = E(k*v, k*r, pk)
 *
 * Implemented as k additions. For large k this is O(k) — use only for small k
 * or implement double-and-add if needed for large scalars.
 *
 * @param ct - input ciphertext
 * @param k - positive integer scalar
 */
export async function scalarMul(ct: Ciphertext, k: bigint): Promise<Ciphertext> {
  if (k < 0n) throw new RangeError("scalarMul: k must be non-negative");
  if (k === 0n) {
    // Return identity ciphertext E(0, 0): C1=C2=identity point (0,1)
    return {
      C1: [0n, 1n],
      C2: [0n, 1n],
    };
  }
  if (k === 1n) return ct;

  // Double-and-add for efficiency
  const babyjub = await getBabyJub();
  const Fr = babyjub.F;

  function pointDouble(p: Point): Point {
    const pa = [Fr.e(p[0]), Fr.e(p[1])];
    const r = babyjub.addPoint(pa, pa);
    return [Fr.toObject(r[0]) as bigint, Fr.toObject(r[1]) as bigint];
  }

  function pointAdd(a: Point, b: Point): Point {
    const pa = [Fr.e(a[0]), Fr.e(a[1])];
    const pb = [Fr.e(b[0]), Fr.e(b[1])];
    const r = babyjub.addPoint(pa, pb);
    return [Fr.toObject(r[0]) as bigint, Fr.toObject(r[1]) as bigint];
  }

  function ctAdd(a: Ciphertext, b: Ciphertext): Ciphertext {
    return {
      C1: pointAdd(a.C1, b.C1),
      C2: pointAdd(a.C2, b.C2),
    };
  }

  function ctDouble(a: Ciphertext): Ciphertext {
    return {
      C1: pointDouble(a.C1),
      C2: pointDouble(a.C2),
    };
  }

  // Binary double-and-add
  const IDENTITY: Ciphertext = { C1: [0n, 1n], C2: [0n, 1n] };
  let result = IDENTITY;
  let base = ct;
  let exp = k;

  while (exp > 0n) {
    if (exp & 1n) {
      result = ctAdd(result, base);
    }
    base = ctDouble(base);
    exp >>= 1n;
  }

  return result;
}

/**
 * Reduce an array of ciphertexts to their sum.
 * Equivalent to calling add() repeatedly but slightly cleaner API.
 */
export async function sum(ciphertexts: Ciphertext[]): Promise<Ciphertext> {
  if (ciphertexts.length === 0) {
    throw new Error("sum: need at least one ciphertext");
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  let acc: Ciphertext = ciphertexts[0]!;
  for (let i = 1; i < ciphertexts.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    acc = await add(acc, ciphertexts[i]!);
  }
  return acc;
}
