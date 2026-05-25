/**
 * merkle.test.ts — Off-chain Merkle tree matches on-chain Poseidon structure.
 */

import { describe, it, expect } from "vitest";
import {
  PoseidonMerkleTree,
  rebuildTreeFromLeaves,
  TREE_DEPTH,
  MAX_LEAVES,
} from "../../src/merkle.js";
import { poseidon2 } from "../../src/poseidon.js";

describe("PoseidonMerkleTree initialization", () => {
  it("creates a tree with correct depth and zero initialization", async () => {
    const tree = await PoseidonMerkleTree.create();
    expect(tree.depth).toBe(TREE_DEPTH);
    expect(tree.size).toBe(0);
  });

  it("zeros[0] = 0n (empty leaf value)", async () => {
    const tree = await PoseidonMerkleTree.create();
    expect(tree.getZero(0)).toBe(0n);
  });

  it("zeros[i] = Poseidon(zeros[i-1], zeros[i-1])", async () => {
    const tree = await PoseidonMerkleTree.create();
    for (let i = 1; i <= TREE_DEPTH; i++) {
      const expected = await poseidon2(tree.getZero(i - 1), tree.getZero(i - 1));
      expect(tree.getZero(i)).toBe(expected);
    }
  });

  it("initial root = zeros[TREE_DEPTH]", async () => {
    const tree = await PoseidonMerkleTree.create();
    expect(tree.root).toBe(tree.getZero(TREE_DEPTH));
  });

  it("TREE_DEPTH = 8, MAX_LEAVES = 256", () => {
    expect(TREE_DEPTH).toBe(8);
    expect(MAX_LEAVES).toBe(256);
  });
});

describe("leaf insertion", () => {
  it("first insertion returns leafIndex = 0", async () => {
    const tree = await PoseidonMerkleTree.create();
    const { leafIndex } = await tree.insertLeaf(42n);
    expect(leafIndex).toBe(0);
    expect(tree.size).toBe(1);
  });

  it("sequential insertions return sequential leaf indices", async () => {
    const tree = await PoseidonMerkleTree.create();
    const r0 = await tree.insertLeaf(1n);
    const r1 = await tree.insertLeaf(2n);
    const r2 = await tree.insertLeaf(3n);
    expect(r0.leafIndex).toBe(0);
    expect(r1.leafIndex).toBe(1);
    expect(r2.leafIndex).toBe(2);
  });

  it("root changes after each insertion", async () => {
    const tree = await PoseidonMerkleTree.create();
    const root0 = tree.root;
    await tree.insertLeaf(1n);
    const root1 = tree.root;
    await tree.insertLeaf(2n);
    const root2 = tree.root;
    expect(root0).not.toBe(root1);
    expect(root1).not.toBe(root2);
  });

  it("same leaf value produces different root depending on position", async () => {
    const leaf = 0xabc123n;
    const tree1 = await PoseidonMerkleTree.create();
    await tree1.insertLeaf(leaf);
    const root1 = tree1.root;

    const tree2 = await PoseidonMerkleTree.create();
    await tree2.insertLeaf(0xdeadn);
    await tree2.insertLeaf(leaf);
    const root2 = tree2.root;

    expect(root1).not.toBe(root2);
  });

  it("rejects insertion when tree is full", async () => {
    const tree = await PoseidonMerkleTree.create(2); // depth 2 = 4 leaves
    await tree.insertLeaf(1n);
    await tree.insertLeaf(2n);
    await tree.insertLeaf(3n);
    await tree.insertLeaf(4n);
    await expect(tree.insertLeaf(5n)).rejects.toThrow(/full/);
  });
});

describe("Merkle proof generation", () => {
  it("generates a valid proof for leaf 0", async () => {
    const tree = await PoseidonMerkleTree.create();
    await tree.insertLeaf(42n);
    const proof = await tree.getProof(0);
    expect(proof.pathElements).toHaveLength(TREE_DEPTH);
    expect(proof.pathIndices).toHaveLength(TREE_DEPTH);
    expect(proof.root).toBe(tree.root);
  });

  it("proof pathIndices[0] = 0 for even leaf index", async () => {
    const tree = await PoseidonMerkleTree.create();
    await tree.insertLeaf(1n);
    const proof = await tree.getProof(0);
    // Leaf 0 is left child at level 0 => pathIndices[0] = 0
    expect(proof.pathIndices[0]).toBe(0);
  });

  it("proof pathIndices[0] = 1 for odd leaf index", async () => {
    const tree = await PoseidonMerkleTree.create();
    await tree.insertLeaf(1n);
    await tree.insertLeaf(2n);
    const proof = await tree.getProof(1);
    // Leaf 1 is right child at level 0 => pathIndices[0] = 1
    expect(proof.pathIndices[0]).toBe(1);
  });

  it("proof can be verified by recomputing root", async () => {
    const tree = await PoseidonMerkleTree.create();
    const leaf = 0x1234567890n;
    await tree.insertLeaf(leaf);
    const proof = await tree.getProof(0);

    // Manually recompute root from proof
    let current = leaf;
    for (let i = 0; i < TREE_DEPTH; i++) {
      const sibling = proof.pathElements[i]!;
      const isRight = proof.pathIndices[i] === 1;
      const left  = isRight ? sibling : current;
      const right = isRight ? current : sibling;
      current = await poseidon2(left, right);
    }
    expect(current).toBe(proof.root);
  });

  it("rejects proof request for out-of-range index", async () => {
    const tree = await PoseidonMerkleTree.create();
    await tree.insertLeaf(1n);
    await expect(tree.getProof(1)).rejects.toThrow(RangeError);
    await expect(tree.getProof(-1)).rejects.toThrow(RangeError);
  });
});

describe("rebuildTreeFromLeaves", () => {
  it("rebuilds same root from same leaves", async () => {
    const tree1 = await PoseidonMerkleTree.create();
    await tree1.insertLeaf(1n);
    await tree1.insertLeaf(2n);
    await tree1.insertLeaf(3n);

    const tree2 = await rebuildTreeFromLeaves([1n, 2n, 3n]);
    expect(tree2.root).toBe(tree1.root);
  });

  it("rebuilds with correct size", async () => {
    const tree = await rebuildTreeFromLeaves([10n, 20n]);
    expect(tree.size).toBe(2);
  });
});
