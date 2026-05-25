/**
 * types.ts — Shared types for @openjanus/elgamal
 */

/** A BabyJubjub curve point represented as [x, y] bigints. */
export type Point = [bigint, bigint];

/** An ElGamal ciphertext: two BabyJubjub points. */
export interface Ciphertext {
  /** Randomness commitment: C1 = r * G */
  C1: Point;
  /** Value + mask: C2 = v*G + r*PK */
  C2: Point;
}

/** A BabyJubjub keypair. */
export interface Keypair {
  /** Private scalar in BabyJubjub scalar field */
  privkey: bigint;
  /** Public key point = privkey * G */
  pubkey: Point;
}

/** BSGS table configuration. */
export interface BsgsConfig {
  /** Number of bits covered: range [0, 2^bits) */
  bits: number;
  /** Square root step size M = 2^(bits/2) */
  M: bigint;
  /** Path to on-disk table file (production mode) */
  tablePath?: string;
}

/** BSGS warmup result. */
export interface BsgsInfo {
  M: bigint;
  bits: number;
  buildTimeMs: number;
  entries: number;
  mode: "memory" | "disk";
}

/** On-chain ciphertext layout (Solidity uint256 coords). */
export interface OnChainCiphertext {
  C1x: bigint;
  C1y: bigint;
  C2x: bigint;
  C2y: bigint;
}

/** Known test vector for cross-implementation compatibility. */
export interface TestVector {
  description: string;
  /** Hex-encoded 32-byte seed for deriveBabyJubKeypair */
  seedHex: string;
  /** Expected privkey as decimal string */
  privkeyDec: string;
  /** Expected pubkey x as decimal string */
  pubkeyXDec: string;
  /** Expected pubkey y as decimal string */
  pubkeyYDec: string;
  /** Deterministic encrypt test: value + fixed randomness */
  encrypt?: {
    value: string;
    randomnessDec: string;
    C1x: string;
    C1y: string;
    C2x: string;
    C2y: string;
  };
}
