/**
 * encrypt.ts — Exponential ElGamal encryption on BabyJubjub
 *
 * Scheme: Exponential ElGamal
 *   C1 = r * G        (commitment to randomness)
 *   C2 = v*G + r*PK   (encrypted value, masked by shared secret)
 *
 * Security: IND-CPA under DDH assumption on BabyJubjub.
 * Values must be in [0, 2^48) for BSGS decryption to work.
 */

import { randomFillSync } from "crypto";
import type { Ciphertext, Point } from "./types.js";
import { getBabyJub } from "./babyjub.js";

/**
 * Encrypt a value using exponential ElGamal on BabyJubjub.
 *
 * @param value - plaintext value in [0, 2^48)
 * @param randomness - ephemeral random scalar r (generate with randomScalar())
 * @param recipientPubkey - recipient's BabyJubjub public key point
 * @returns Ciphertext { C1, C2 }
 * @throws if value >= 2^48 (BSGS decryption cannot recover it)
 */
export async function encrypt(
  value: bigint,
  randomness: bigint,
  recipientPubkey: Point
): Promise<Ciphertext> {
  if (value < 0n || value >= 1n << 48n) {
    throw new RangeError(`encrypt: value ${value} out of range [0, 2^48)`);
  }

  const babyjub = await getBabyJub();
  const Fr = babyjub.F;

  // C1 = r * G
  const C1_raw = babyjub.mulPointEscalar(babyjub.Base8, randomness);

  // vG = v * G
  const vG = babyjub.mulPointEscalar(babyjub.Base8, value);

  // rPK = r * recipientPubkey
  const pkPoint = [Fr.e(recipientPubkey[0]), Fr.e(recipientPubkey[1])];
  const rPK = babyjub.mulPointEscalar(pkPoint, randomness);

  // C2 = vG + rPK
  const C2_raw = babyjub.addPoint(vG, rPK);

  const C1: Point = [
    Fr.toObject(C1_raw[0]) as bigint,
    Fr.toObject(C1_raw[1]) as bigint,
  ];
  const C2: Point = [
    Fr.toObject(C2_raw[0]) as bigint,
    Fr.toObject(C2_raw[1]) as bigint,
  ];

  return { C1, C2 };
}

/**
 * Generate a cryptographically secure random scalar for use as ElGamal randomness.
 * Returns a value in [1, BabyJubjub.subOrder).
 */
export async function randomScalar(): Promise<bigint> {
  const babyjub = await getBabyJub();
  const ORDER: bigint = babyjub.subOrder;

  const bytes = new Uint8Array(32);
  randomFillSync(bytes);
  const raw = BigInt("0x" + Buffer.from(bytes).toString("hex"));
  return ((raw % ORDER) + ORDER) % ORDER || 1n;
}

/**
 * Convert a Ciphertext to on-chain uint256 coords.
 */
export function ciphertextToOnChain(ct: Ciphertext): {
  C1x: bigint;
  C1y: bigint;
  C2x: bigint;
  C2y: bigint;
} {
  return {
    C1x: ct.C1[0],
    C1y: ct.C1[1],
    C2x: ct.C2[0],
    C2y: ct.C2[1],
  };
}

/**
 * Convert on-chain coords back to Ciphertext.
 */
export function ciphertextFromOnChain(raw: {
  C1x: bigint;
  C1y: bigint;
  C2x: bigint;
  C2y: bigint;
}): Ciphertext {
  return {
    C1: [raw.C1x, raw.C1y],
    C2: [raw.C2x, raw.C2y],
  };
}
