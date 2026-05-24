# Research Roadmap

What's next after v0.1.0 of the three foundational primitives.

## Near-term (v0.2.0 candidates)

### Stealth addresses on BabyJubJub
Using the BabyJubJub curve and the existing BabyJub.sol, stealth addresses can be
implemented with ECDH key agreement. A sender computes a shared secret with the
recipient's public key (an EC point), derives a one-time address, and sends funds
there. Only the recipient can detect and claim the payment.

Flow's cross-VM makes this interesting: the ECDH computation can happen via BabyJub.sol
(reusing the same contract), and the detection can happen in a Cadence indexer script.

Status: Research phase. Depends on `@openjanus/babyjub` v0.1.0 (done).

### Merkle tree with Pedersen hash
A Merkle tree using BabyJubJub Pedersen hashes as the node hash function.
This is ZK-friendly — the tree can be proven inside Groth16 circuits efficiently.
Standard use case: Tornado Cash / mixer-style privacy pools.

Status: Partially explored in cadence-crypto-lab (mixer pattern L4). Needs clean
public implementation.

### UTXO-style private transfers
Replace the account-based confidential balance with UTXO notes. Each note is a
commitment to (value, blinding, owner_pubkey). The sender creates a ZK proof that
they own an unspent note and the new notes sum correctly.

This is a more powerful privacy model than account-based commitments — it prevents
transaction graph analysis even for a single user.

Status: Design phase. Depends on Merkle tree primitive (above).

## Medium-term (v0.3.0 candidates)

### ERC-7984 — Confidential Token Standard
Standardize the confidential token interface so multiple token implementations
can share the same commitment/verification infrastructure. The verifier at
`0x70FA33...` would be the canonical Groth16 backend.

Status: Monitoring EIP progress. The ConfidentialTransfer circuit already implements
the core mechanics.

### Nova folding scheme (incrementally-verifiable computation)
Nova allows proving multiple iterations of a function with a single growing proof,
then folding at the end. Could enable streaming proofs for continuous transaction
history without re-proving everything.

Status: Pure research. Not tractable with current snarkJS tooling.

### BN254 scalar multiplication in Cadence
Currently, scalar multiplication (needed for generating fresh commitments on-chain)
is not viable in Cadence CU budget. If Flow increases the CU limit or provides native
BabyJubJub precompiles, this becomes possible.

Status: Monitoring Flow protocol roadmap.

## Long-term (post-v0.3.0)

- **MiMC hash on BabyJubJub** — cheaper than Pedersen for some circuit applications
- **EdDSA on BabyJubJub** — signature scheme for anonymous credentials
- **Recursive proof compression** — aggregate multiple circuit proofs into one
- **Cross-VM random beacon** — use Flow's VRF as ZK circuit public input

## What's NOT on the roadmap

- Production deployment without formal audit
- Real-asset confidential transfers (requires audit + production trusted setup)
- Mobile wallet integration (separate product track)
