/**
 * keypair.ts — BabyJubjub keypair generation and derivation
 *
 * Two modes:
 *   1. generateKeypair()          — random, for new users
 *   2. deriveFromFlowKey(flowKey) — deterministic from a Flow signing key
 *      Uses HKDF-SHA256(IKM=flowKey, salt="openjanus-privacy-v1", info="babyjub-privkey")
 *      then reduces mod BabyJubjub scalar field order.
 */

import { createHmac } from "crypto";
import { randomFillSync } from "crypto";
import type { Keypair, Point } from "./types.js";
import { getBabyJub } from "./babyjub.js";

/**
 * Generate a cryptographically random BabyJubjub keypair.
 */
export async function generateKeypair(): Promise<Keypair> {
  const babyjub = await getBabyJub();
  const Fr = babyjub.F;
  const ORDER: bigint = babyjub.subOrder as bigint;

  const bytes = new Uint8Array(32);
  randomFillSync(bytes);
  const raw = BigInt("0x" + Buffer.from(bytes).toString("hex"));
  const privkey = ((raw % ORDER) + ORDER) % ORDER || 1n;

  const pubkeyPoint = babyjub.mulPointEscalar(babyjub.Base8, privkey);
  const pubkey: Point = [
    Fr.toObject(pubkeyPoint[0]) as bigint,
    Fr.toObject(pubkeyPoint[1]) as bigint,
  ];

  return { privkey, pubkey };
}

/**
 * Derive a BabyJubjub keypair deterministically from a Flow signing key
 * using HKDF-SHA256.
 *
 * @param flowKey - raw bytes (Buffer or hex string) of the Flow account signing key
 * @returns Keypair { privkey, pubkey }
 */
export async function deriveFromFlowKey(flowKey: Buffer | string): Promise<Keypair> {
  const babyjub = await getBabyJub();
  const Fr = babyjub.F;
  const ORDER: bigint = babyjub.subOrder as bigint;

  const keyBuf = Buffer.isBuffer(flowKey)
    ? flowKey
    : Buffer.from(String(flowKey).replace(/^0x/, ""), "hex");

  // HKDF-SHA256 extract: PRK = HMAC-SHA256(salt, IKM)
  const salt = Buffer.from("openjanus-privacy-v1", "utf8");
  const prk = createHmac("sha256", salt).update(keyBuf).digest();

  // HKDF-SHA256 expand: OKM = HMAC-SHA256(PRK, info || 0x01)
  const info = Buffer.from("babyjub-privkey", "utf8");
  const expandInput = Buffer.concat([prk, info, Buffer.from([0x01])]);
  const okm = createHmac("sha256", prk).update(expandInput).digest();

  const raw = BigInt("0x" + okm.toString("hex"));
  const privkey = ((raw % ORDER) + ORDER) % ORDER || 1n;

  const pubkeyPoint = babyjub.mulPointEscalar(babyjub.Base8, privkey);
  const pubkey: Point = [
    Fr.toObject(pubkeyPoint[0]) as bigint,
    Fr.toObject(pubkeyPoint[1]) as bigint,
  ];

  return { privkey, pubkey };
}

/**
 * Verify that a pubkey corresponds to a privkey.
 * Used for sanity checks and key validation.
 */
export async function verifyKeypair(privkey: bigint, pubkey: Point): Promise<boolean> {
  const babyjub = await getBabyJub();
  const Fr = babyjub.F;

  const computed = babyjub.mulPointEscalar(babyjub.Base8, privkey);
  const cx = Fr.toObject(computed[0]) as bigint;
  const cy = Fr.toObject(computed[1]) as bigint;
  return cx === pubkey[0] && cy === pubkey[1];
}

/**
 * Serialize a pubkey to a hex string (x || y, each 32 bytes big-endian).
 */
export function pubkeyToHex(pubkey: Point): string {
  const xHex = pubkey[0].toString(16).padStart(64, "0");
  const yHex = pubkey[1].toString(16).padStart(64, "0");
  return xHex + yHex;
}

/**
 * Deserialize a pubkey from hex (128 hex chars = 64 bytes).
 */
export function pubkeyFromHex(hex: string): Point {
  const clean = hex.replace(/^0x/, "");
  if (clean.length !== 128) throw new Error("pubkeyFromHex: expected 128 hex chars");
  const x = BigInt("0x" + clean.slice(0, 64));
  const y = BigInt("0x" + clean.slice(64, 128));
  return [x, y];
}
