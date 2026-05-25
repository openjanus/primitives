/**
 * @openjanus/elgamal — Homomorphic ElGamal encryption on BabyJubjub
 *
 * Public API surface. Import from this file only.
 *
 * @example
 * ```ts
 * import { encrypt, decrypt, add, generateKeypair, warmupDecrypt } from "@openjanus/elgamal";
 *
 * // One-time warmup (builds BSGS table)
 * await warmupDecrypt();
 *
 * const recipient = await generateKeypair();
 * const r = await randomScalar();
 * const ct = await encrypt(42n, r, recipient.pubkey);
 * const v = await decrypt(ct, recipient.privkey);
 * console.log(v); // 42n
 * ```
 */

// Core primitives
export { encrypt, randomScalar, ciphertextToOnChain, ciphertextFromOnChain } from "./encrypt.js";
export { decrypt, warmupDecrypt } from "./decrypt.js";
export { add, negate, scalarMul, sum } from "./homomorphic.js";
export {
  generateKeypair,
  deriveFromFlowKey,
  verifyKeypair,
  pubkeyToHex,
  pubkeyFromHex,
} from "./keypair.js";

// BSGS internals (for advanced use / precompute script)
export {
  buildTable,
  initTable,
  solveDL,
  warmup,
  saveTableToDisk,
  loadTableFromDisk,
  initFromDisk,
  DEFAULT_BITS,
  BSGS_BITS,
  TEST_BITS,
} from "./bsgs.js";

// BabyJubjub singleton
export { getBabyJub } from "./babyjub.js";

// Types
export type {
  Point,
  Ciphertext,
  Keypair,
  BsgsConfig,
  BsgsInfo,
  OnChainCiphertext,
  TestVector,
} from "./types.js";

// Test vectors (for cross-implementation compatibility)
export { TEST_VECTORS, PHASE1_PRIVACY_VECTOR } from "./vectors.js";
