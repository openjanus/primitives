// SPDX-License-Identifier: MIT
// PoseidonT4.sol — 3-input Poseidon (note commitment: H(amount, ns, blinding))
//
// Deployed at: 0xda71Ba9ecAb56dAa64fEc9CD6fC2a8782862CF25 (Flow EVM testnet)
//
// Spike note: This contract implements Poseidon(3) using chained Poseidon(2):
//   poseidon3(a, b, c) = Poseidon2(Poseidon2(a, b), c)
//
// This is NOT the same as the native Poseidon t=4 used by circomlib's Poseidon(3)
// template. The commitment circuit uses circomlib's native 3-input Poseidon.
//
// Key insight: on-chain commitment verification is done by the ZK verifier,
// NOT by calling this contract. UTXOPool only uses PoseidonT3 (2-input) for
// incremental Merkle tree hashing. PoseidonT4 is provided for off-chain
// reference only.
//
// For production:
//   Generate using: circomlibjs.poseidonContract.createCode(3)
//   This produces the canonical t=4 Poseidon matching circomlib's template.
//
// Canonical deployed address: 0xda71Ba9ecAb56dAa64fEc9CD6fC2a8782862CF25
// Chain: Flow EVM testnet (chainId 545)
// See PoseidonContracts.sol for the full implementation.

pragma solidity ^0.8.24;

// Full implementation in PoseidonContracts.sol
// This stub file documents the canonical deployed address.
