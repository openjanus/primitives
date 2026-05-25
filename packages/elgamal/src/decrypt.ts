/**
 * decrypt.ts — ElGamal decryption using BSGS discrete log solver
 *
 * Decryption process:
 *   1. Compute shared secret: skC1 = privkey * C1
 *   2. Recover: vG = C2 - skC1  (point subtraction)
 *   3. Solve: find v such that v*G = vG  (BSGS)
 *
 * The BSGS table is initialized lazily on first call.
 * For performance-critical applications, call warmupDecrypt() at startup.
 */

import type { Ciphertext, BsgsInfo, Point } from "./types.js";
import { getBabyJub } from "./babyjub.js";
import { solveDL, warmup, initFromDisk, DEFAULT_BITS } from "./bsgs.js";

/**
 * Decrypt an ElGamal ciphertext using the private key.
 *
 * @param ciphertext - { C1, C2 } from encrypt()
 * @param privkey    - recipient's BabyJubjub private scalar
 * @param bits       - BSGS range (default: 32, covers [0, 2^32))
 * @returns decrypted value as bigint
 * @throws if value not in BSGS range
 */
export async function decrypt(
  ciphertext: Ciphertext,
  privkey: bigint,
  bits: number = DEFAULT_BITS
): Promise<bigint> {
  const babyjub = await getBabyJub();
  const Fr = babyjub.F;

  const C1 = [Fr.e(ciphertext.C1[0]), Fr.e(ciphertext.C1[1])];
  const C2 = [Fr.e(ciphertext.C2[0]), Fr.e(ciphertext.C2[1])];

  // skC1 = privkey * C1
  const skC1 = babyjub.mulPointEscalar(C1, privkey);

  // vG = C2 - skC1 = C2 + negate(skC1)
  // BabyJubjub Twisted Edwards negation: negate x-coordinate
  const negSkC1 = [Fr.neg(skC1[0]), skC1[1]];
  const vG_raw = babyjub.addPoint(C2, negSkC1);

  const vG: Point = [
    Fr.toObject(vG_raw[0]) as bigint,
    Fr.toObject(vG_raw[1]) as bigint,
  ];

  // Solve the discrete log
  return solveDL(babyjub, vG, bits);
}

/**
 * Warm up BSGS table before first decrypt call.
 * Avoids first-decrypt latency spike.
 *
 * @param bits      BSGS range bits (default DEFAULT_BITS)
 * @param tablePath Optional path to disk-cached table
 * @returns BsgsInfo with build timing
 */
export async function warmupDecrypt(
  bits: number = DEFAULT_BITS,
  tablePath?: string
): Promise<BsgsInfo> {
  const babyjub = await getBabyJub();
  if (tablePath) {
    return initFromDisk(babyjub, tablePath, bits);
  }
  return warmup(babyjub, bits);
}
