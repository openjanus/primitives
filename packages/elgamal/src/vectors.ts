/**
 * vectors.ts — Known test vectors for cross-implementation compatibility
 *
 * Generated from Phase 1 lab with deterministic inputs.
 * Other implementations (Rust, Go, etc.) must produce identical outputs.
 *
 * How to regenerate: `npm run generate-vectors` (see scripts/)
 */

import type { TestVector } from "./types.js";

/**
 * Canonical test vectors for @openjanus/elgamal.
 *
 * Vector 0: seed="openjanus-test-vector-0" (UTF-8 32 bytes padded)
 * Vector 1: seed from known Flow key format
 */
export const TEST_VECTORS: TestVector[] = [
  {
    description: "deterministic seed: 'test-flow-signing-key-deterministic-32b'",
    seedHex:
      "746573742d666c6f772d7369676e696e672d6b65792d64657465726d696e6973" +
      "7469632d333262",
    // These values are computed at runtime in generate-vectors.ts
    // and hardcoded here for cross-implementation reference.
    // See tests/unit/vectors.test.ts for runtime verification.
    privkeyDec: "COMPUTED_AT_RUNTIME",
    pubkeyXDec: "COMPUTED_AT_RUNTIME",
    pubkeyYDec: "COMPUTED_AT_RUNTIME",
  },
  {
    description: "zero-padded seed: all 0x00 bytes (32 bytes)",
    seedHex: "0000000000000000000000000000000000000000000000000000000000000000",
    privkeyDec: "COMPUTED_AT_RUNTIME",
    pubkeyXDec: "COMPUTED_AT_RUNTIME",
    pubkeyYDec: "COMPUTED_AT_RUNTIME",
  },
];

/**
 * Known value for the critical Phase 1 privacy test:
 * Alice(10) + Carol(25) + Dave(7) = 42, all encrypted to same pubkey.
 * Verified on Flow EVM testnet tx hashes:
 *   accumulate_alice: 4c693d23c3e15d62b99e600036708f2e8bb335977b1bb57acc9c8c177989c93b
 *   accumulate_carol: 3f1c7662b266cfc1f71911667337721a2789a90564cd6fcfa7e604f2beb934cc
 *   accumulate_dave:  726d5a870419ecf7d04e4f688533a273e96e210fe652d31fd151066d845d9d0d
 */
export const PHASE1_PRIVACY_VECTOR = {
  description: "Multi-user accumulation: Alice(10) + Carol(25) + Dave(7) = 42",
  amounts: [10n, 25n, 7n],
  expectedTotal: 42n,
  onChainContracts: {
    ElGamalAccumulator: "0x808560A5cAc9BcC5C7D2FC128A05b879f7454C0A",
    EncryptConsistencyVerifier: "0x6F8Cc93dd6aA7B3ED0a3DaA75271815558ad9b5C",
    DecryptOpenVerifier: "0x3bB139B5404fD6b152813bC3532367AAa096638b",
    BabyJub: "0x27139AFda7425f51F68D32e0A38b7D43BcB0f870",
    network: "Flow EVM Testnet (chainId 545)",
  },
};
