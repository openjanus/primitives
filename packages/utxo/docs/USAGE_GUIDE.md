# Usage Guide: Shield → Transfer → Unshield

Step-by-step walkthrough of the full UTXO lifecycle on Flow EVM.

## Prerequisites

```bash
npm install @openjanus/utxo
```

You need:
- A Flow account with FLOW tokens (for shield)
- A Cadence Owned Account (COA) linked to your Flow account
- The COA address registered with the UTXOPool (it's the `cadenceCOAAddress`)

## Step 1: Shield (Deposit)

```typescript
import {
  createNote,
  proveShield,
  UTXOPoolClient,
  assertCanonicalPoseidon,
} from "@openjanus/utxo";

// Always check canonical Poseidon at startup
await assertCanonicalPoseidon();

const client = UTXOPoolClient.testnet();

// Create a note (keep this secret!)
const aliceNote = await createNote(10n); // 10 attoflow

// Generate the shield proof (~374ms on testnet)
const { proof, commitment, publicAmount, proveMs } = await proveShield(aliceNote);
console.log(`Commitment: 0x${commitment.toString(16)}`);
console.log(`Proof generated in ${proveMs}ms`);

// Encode calldata for the Cadence COA call
const calldata = client.encodeShield(proof, commitment, publicAmount);

// Submit via Cadence transaction (example):
// flow transactions send <cadence-shield.cdc> \
//   "0x6c1c172068f8325bd1f6564bc2fBa5B0A9BB1725" \  // UTXOPool address
//   calldata                                        // encoded calldata
//   --signer my-account --network testnet
```

After the transaction confirms, read the `Shielded` event to get `leafIndex`:
```
Shielded(commitment=0x..., leafIndex=0, newRoot=0x...)
```

## Step 2: Transfer (Private Send)

```typescript
import {
  createNoteFromSecrets,
  resolveNote,
  proveTransfer,
  PoseidonMerkleTree,
  UTXOPoolClient,
} from "@openjanus/utxo";

// Resolve Alice's note with its leaf index (from Shielded event)
const resolvedAlice = resolveNote(aliceNote, 0); // leafIndex = 0

// Bob's note (Alice creates this with Bob's secrets — or Bob creates and sends commitment)
// In practice: Alice and Bob exchange (commitment, nullifierSecret, blinding) off-chain
const bobNote = await createNote(10n); // same amount (full note spend)

// Build local Merkle tree from Shielded events
const tree = await PoseidonMerkleTree.create();
await tree.insertLeaf(aliceNote.commitment!);

// Generate Merkle inclusion proof for Alice's note
const path = await tree.getProof(0);

// Generate transfer proof (~379ms)
const { proof, oldNullifierHash, newCommitment, root, proveMs } = await proveTransfer(
  resolvedAlice,
  bobNote,
  path
);

// Transfer is permissionless — call directly from any EOA
const client = UTXOPoolClient.testnet();
const calldata = client.encodeTransfer(proof, oldNullifierHash, newCommitment, root);
// Submit via ethers.js or any EVM transaction sender
```

After confirmation, read the `Transferred` event:
```
Transferred(oldNullifierHash=0x..., newCommitment=0x..., newLeafIndex=1, newRoot=0x...)
```

Bob's `leafIndex` = 1.

## Step 3: Unshield (Withdraw)

```typescript
import {
  resolveNote,
  proveUnshield,
  PoseidonMerkleTree,
  rebuildTreeFromLeaves,
  UTXOPoolClient,
} from "@openjanus/utxo";

// Bob resolves his note with leaf index from Transferred event
const resolvedBob = resolveNote(bobNote, 1); // leafIndex = 1

// Rebuild local tree with both leaves
const tree = await rebuildTreeFromLeaves([
  aliceNote.commitment!,  // leaf 0 (from Shielded event)
  newCommitment,          // leaf 1 (from Transferred event)
]);

const bobPath = await tree.getProof(1);

// Bob's recipient address (the address that will receive FLOW)
const recipientAddress = "0xYourFlowEVMAddress";

// Generate unshield proof (~333ms)
const { proof, nullifierHash, publicAmount, root, proveMs } = await proveUnshield(
  resolvedBob,
  bobPath,
  recipientAddress
);

const client = UTXOPoolClient.testnet();
const calldata = client.encodeUnshield(
  proof,
  nullifierHash,
  publicAmount,
  root,
  recipientAddress
);

// Submit via Cadence COA transaction (unshield requires COA)
// The Cadence transaction: coa.call(poolAddress, calldata) → then release FLOW from vault
```

## Maintaining Off-Chain Tree State

The off-chain Merkle tree must stay in sync with on-chain events.

```typescript
import { UTXOPoolClient, PoseidonMerkleTree, rebuildTreeFromLeaves } from "@openjanus/utxo";

const client = UTXOPoolClient.testnet();

// Fetch all Shielded events and rebuild tree
const events = await client.getShieldedEvents(fromBlock);
const leaves = events
  .sort((a, b) => Number(a.leafIndex - b.leafIndex))
  .map(e => e.commitment);

const tree = await rebuildTreeFromLeaves(leaves);
console.log(`Tree has ${tree.size} leaves, root: 0x${tree.root.toString(16)}`);
```

Note: This only captures Shield commitments. Transfer events add new commitments (newCommitment) that also become leaves. A production implementation would scan both `Shielded` and `Transferred` events.

## Note Storage

Store your notes securely. Without the note, you cannot spend your FLOW.

```typescript
// Minimum fields needed to spend a note
const noteToStore = {
  amount: aliceNote.amount.toString(),
  nullifierSecret: aliceNote.nullifierSecret.toString(),
  blinding: aliceNote.blinding.toString(),
  commitment: aliceNote.commitment!.toString(),
  leafIndex: resolvedAlice.leafIndex,
};

// Store in encrypted storage (never in plaintext!)
// The nullifierSecret is the spending key — treat it like a private key
```

## Error Handling

```typescript
try {
  const { proof } = await proveShield(note);
} catch (e) {
  if (e instanceof RangeError) {
    // Amount out of [0, 2^48) range
  }
  // Witness generation failed (circuit constraint violation)
  // This usually means the note data is internally inconsistent
}
```

Common errors:
- `RangeError: amount must be in [0, 2^48)` — reduce amount
- `Tree full` — the pool's 256-leaf limit is reached (new deployment needed)
- `NullifierAlreadyUsed` — nullifier was already spent (double-spend attempt)
- `InvalidRoot` — your local tree is out of sync with on-chain state
- `ProofInvalid` — proof generation or encoding error
