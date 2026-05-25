// SPDX-License-Identifier: MIT
// PoseidonT3.sol — 2-input Poseidon (Merkle tree hash function)
//
// Deployed at: 0xAA31b4EE06282d2580550C25dC32B5EAF0712F1E (Flow EVM testnet)
//
// WARNING: This is a hand-written Yul Poseidon implementation from the spike.
// See vuln #012: hand-written Yul Poseidon implementations can produce incorrect
// hashes. This specific instance was tested against circomlib's Poseidon(2) output
// and matches for the inputs used in the spike.
//
// For production:
//   Generate PoseidonT3 using: circomlibjs.poseidonContract.createCode(2)
//   This produces the canonical implementation verified against circomlib.
//
// Canonical check: poseidon([0, 0]) MUST equal 0x2098f5fb9e239eab...
// If it does not, this contract is broken and MUST NOT be used.
//
// The UTXOPool constructor initializes Merkle tree zeros using this contract.
// If zeros are wrong, all proofs will fail verification.
//
// This file is included for reference. For fresh deployments, generate
// PoseidonT3/T4 from circomlibjs.poseidonContract.createCode(N).

pragma solidity ^0.8.24;

// See contracts/evm/PoseidonContracts.sol in the original lab spike for the full
// implementation. This file intentionally references the deployed canonical address.

// Canonical deployed address: 0xAA31b4EE06282d2580550C25dC32B5EAF0712F1E
// Chain: Flow EVM testnet (chainId 545)
// Use this address — do not redeploy unless you are creating a fresh UTXOPool instance.
