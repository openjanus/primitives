/**
 * @openjanus/pedersen
 *
 * TypeScript SDK for Pedersen commitments on BabyJubJub.
 * Provides:
 *  - Off-chain commitment computation via circomlibjs
 *  - Homomorphic point operations (local BigInt math)
 *  - FCL script helpers for querying the deployed PedersenBabyJub.cdc contract
 */

import { negatePoint, CURVE_P, type BabyJubPoint } from "@openjanus/babyjub";

// ---------------------------------------------------------------------------
// Deployed addresses
// ---------------------------------------------------------------------------

/** PedersenBabyJub.cdc on Flow Cadence testnet */
export const PEDERSEN_CADENCE_ADDRESS = "0x7599043aea001283";

/** BabyJub.sol on Flow EVM testnet (used by the Cadence contract) */
export const BABYJUB_EVM_ADDRESS = "0x27139AFda7425f51F68D32e0A38b7D43BcB0f870";

/** Flow testnet access node */
export const FLOW_TESTNET_ACCESS_NODE = "https://rest-testnet.onflow.org";

// ---------------------------------------------------------------------------
// Re-export babyjub primitives for convenience
// ---------------------------------------------------------------------------

export { CURVE_P, negatePoint } from "@openjanus/babyjub";

// ---------------------------------------------------------------------------
// Pedersen commitment type
// ---------------------------------------------------------------------------

/** A BabyJubJub point representing a Pedersen commitment */
export type PedersenCommitment = BabyJubPoint;

// ---------------------------------------------------------------------------
// Off-chain commitment computation
// ---------------------------------------------------------------------------

/**
 * Compute a Pedersen commitment to (value, blinding) using circomlibjs.
 *
 * Matches the circomlib Pedersen hash with 192-bit input:
 *   value (64 bits LE) || blinding (128 bits LE)
 *
 * The result is a BabyJubJub point C = Pedersen(pack(value, blinding)).
 *
 * @param value - The value to commit to (uint64, max 2^64 - 1)
 * @param blinding - The blinding factor (uint128, max 2^128 - 1)
 * @returns The commitment as a BabyJubJub point {x, y}
 */
export async function computeCommitment(
  value: bigint,
  blinding: bigint
): Promise<PedersenCommitment> {
  // Dynamic import to avoid bundling issues
  const { buildBabyjub, buildPedersenHash } = await import("circomlibjs");

  const pedersenHash = await buildPedersenHash();
  const babyJub = await buildBabyjub();
  const F = babyJub.F;

  // Pack: value (64 bits LE) || blinding (128 bits LE) = 24 bytes
  const buf = Buffer.alloc(24, 0);

  let v = value;
  for (let i = 0; i < 8; i++) {
    buf[i] = Number(v & 0xffn);
    v >>= 8n;
  }

  let b = blinding;
  for (let i = 8; i < 24; i++) {
    buf[i] = Number(b & 0xffn);
    b >>= 8n;
  }

  const hash = pedersenHash.hash(buf);
  const point = babyJub.unpackPoint(hash);

  return {
    x: BigInt(F.toObject(point[0]).toString()),
    y: BigInt(F.toObject(point[1]).toString()),
  };
}

// ---------------------------------------------------------------------------
// Local (off-chain) homomorphic operations
// ---------------------------------------------------------------------------

/**
 * Add two Pedersen commitment points (homomorphic addition).
 *
 * NOTE: This is a PLACEHOLDER — local BigInt cannot efficiently compute
 * BabyJubJub point addition without the modexp precompile.
 * For on-chain use, call addCommits via PedersenBabyJub.cdc / BabyJub.sol.
 *
 * For off-chain use, use circomlibjs babyJub.addPoint() directly.
 */
export async function addCommitmentsLocal(
  c1: PedersenCommitment,
  c2: PedersenCommitment
): Promise<PedersenCommitment> {
  const { buildBabyjub } = await import("circomlibjs");
  const babyJub = await buildBabyjub();
  const F = babyJub.F;

  // Pack points into circomlibjs format (Montgomery form)
  const p1 = [F.e(c1.x.toString()), F.e(c1.y.toString())];
  const p2 = [F.e(c2.x.toString()), F.e(c2.y.toString())];

  const result = babyJub.addPoint(p1, p2);

  return {
    x: BigInt(F.toObject(result[0]).toString()),
    y: BigInt(F.toObject(result[1]).toString()),
  };
}

/**
 * Subtract two Pedersen commitment points: c1 - c2 = c1 + negate(c2)
 */
export async function subCommitmentsLocal(
  c1: PedersenCommitment,
  c2: PedersenCommitment
): Promise<PedersenCommitment> {
  const negC2 = negatePoint(c2.x, c2.y);
  return addCommitmentsLocal(c1, negC2);
}

/**
 * Return the identity element (0, 1) — neutral element for addition.
 */
export function identityCommitment(): PedersenCommitment {
  return { x: 0n, y: 1n };
}

/**
 * Check if a commitment is the identity element.
 */
export function isIdentityCommitment(c: PedersenCommitment): boolean {
  return c.x === 0n && c.y === 1n;
}

// ---------------------------------------------------------------------------
// FCL script helpers — query PedersenBabyJub.cdc on Cadence testnet
// ---------------------------------------------------------------------------

/**
 * Cadence script to call PedersenBabyJub.identity()
 */
export const SCRIPT_IDENTITY = `
import PedersenBabyJub from 0x7599043aea001283

access(all) fun main(): {String: UInt256} {
    return PedersenBabyJub.identity()
}
`;

/**
 * Cadence script to call PedersenBabyJub.negate(point)
 */
export const SCRIPT_NEGATE = `
import PedersenBabyJub from 0x7599043aea001283

access(all) fun main(x: UInt256, y: UInt256): {String: UInt256} {
    return PedersenBabyJub.negate({"x": x, "y": y})
}
`;

/**
 * Cadence script to call PedersenBabyJub.isIdentity(point)
 */
export const SCRIPT_IS_IDENTITY = `
import PedersenBabyJub from 0x7599043aea001283

access(all) fun main(x: UInt256, y: UInt256): Bool {
    return PedersenBabyJub.isIdentity({"x": x, "y": y})
}
`;

// ---------------------------------------------------------------------------
// Helper: encode commitment as hex strings for FCL arguments
// ---------------------------------------------------------------------------

/**
 * Convert a bigint to a UInt256 FCL argument value string
 */
export function commitmentToFclArgs(c: PedersenCommitment): {
  x: string;
  y: string;
} {
  return {
    x: c.x.toString(),
    y: c.y.toString(),
  };
}
