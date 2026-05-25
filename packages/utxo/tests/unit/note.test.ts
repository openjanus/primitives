/**
 * note.test.ts — Unit tests for Note class and commitment derivation.
 */

import { describe, it, expect } from "vitest";
import {
  createNote,
  createNoteFromSecrets,
  deriveCommitment,
  resolveNote,
  verifyNoteCommitment,
  randomFieldElement,
} from "../../src/note.js";
import { POSEIDON_CANONICAL_HASH_0_0 } from "../../src/poseidon.js";

describe("createNote", () => {
  it("creates a note with random secrets", async () => {
    const note = await createNote(10n);
    expect(note.amount).toBe(10n);
    expect(note.nullifierSecret).toBeGreaterThan(0n);
    expect(note.blinding).toBeGreaterThan(0n);
    expect(note.commitment).toBeGreaterThan(0n);
  });

  it("each call produces a different note (random secrets)", async () => {
    const n1 = await createNote(10n);
    const n2 = await createNote(10n);
    expect(n1.nullifierSecret).not.toBe(n2.nullifierSecret);
    expect(n1.commitment).not.toBe(n2.commitment);
  });

  it("rejects amount out of [0, 2^48) range", async () => {
    await expect(createNote((1n << 48n))).rejects.toThrow(RangeError);
    await expect(createNote(-1n)).rejects.toThrow(RangeError);
  });

  it("accepts amount = 0", async () => {
    const note = await createNote(0n);
    expect(note.amount).toBe(0n);
  });

  it("accepts max valid amount (2^48 - 1)", async () => {
    const note = await createNote((1n << 48n) - 1n);
    expect(note.amount).toBe((1n << 48n) - 1n);
  });
});

describe("createNoteFromSecrets", () => {
  it("produces deterministic commitment from fixed inputs", async () => {
    const ns = 0x1234n;
    const b  = 0x5678n;
    const n1 = await createNoteFromSecrets(10n, ns, b);
    const n2 = await createNoteFromSecrets(10n, ns, b);
    expect(n1.commitment).toBe(n2.commitment);
  });

  it("commitment differs with different blinding", async () => {
    const ns = 0xdeadn;
    const n1 = await createNoteFromSecrets(10n, ns, 1n);
    const n2 = await createNoteFromSecrets(10n, ns, 2n);
    expect(n1.commitment).not.toBe(n2.commitment);
  });

  it("commitment differs with different amount", async () => {
    const ns = 0xbeefn;
    const b  = 0xcafen;
    const n1 = await createNoteFromSecrets(10n, ns, b);
    const n2 = await createNoteFromSecrets(20n, ns, b);
    expect(n1.commitment).not.toBe(n2.commitment);
  });

  it("commitment is in BN254 field range", async () => {
    const BN254_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
    const note = await createNoteFromSecrets(42n, 0x1n, 0x2n);
    expect(note.commitment).toBeLessThan(BN254_PRIME);
    expect(note.commitment).toBeGreaterThan(0n);
  });
});

describe("deriveCommitment", () => {
  it("matches createNoteFromSecrets commitment", async () => {
    const amount = 99n;
    const ns = 0xabcdefn;
    const b  = 0x123456n;
    const note = await createNoteFromSecrets(amount, ns, b);
    const direct = await deriveCommitment(amount, ns, b);
    expect(note.commitment).toBe(direct);
  });

  it("rejects invalid amount", async () => {
    await expect(deriveCommitment(-1n, 1n, 1n)).rejects.toThrow(RangeError);
    await expect(deriveCommitment(1n << 48n, 1n, 1n)).rejects.toThrow(RangeError);
  });
});

describe("resolveNote", () => {
  it("adds leafIndex to note", async () => {
    const note = await createNoteFromSecrets(5n, 1n, 2n);
    const resolved = resolveNote(note, 7);
    expect(resolved.leafIndex).toBe(7);
    expect(resolved.amount).toBe(5n);
  });

  it("preserves all original note fields", async () => {
    const note = await createNoteFromSecrets(10n, 0x1n, 0x2n);
    const resolved = resolveNote(note, 0);
    expect(resolved.amount).toBe(note.amount);
    expect(resolved.nullifierSecret).toBe(note.nullifierSecret);
    expect(resolved.blinding).toBe(note.blinding);
    expect(resolved.commitment).toBe(note.commitment);
  });
});

describe("verifyNoteCommitment", () => {
  it("returns true for correct commitment", async () => {
    const note = await createNoteFromSecrets(10n, 0x1n, 0x2n);
    const ok = await verifyNoteCommitment(note, note.commitment);
    expect(ok).toBe(true);
  });

  it("returns false for wrong commitment", async () => {
    const note = await createNoteFromSecrets(10n, 0x1n, 0x2n);
    const ok = await verifyNoteCommitment(note, note.commitment + 1n);
    expect(ok).toBe(false);
  });
});

describe("randomFieldElement", () => {
  it("returns a bigint > 0", () => {
    const r = randomFieldElement();
    expect(typeof r).toBe("bigint");
    expect(r).toBeGreaterThan(0n);
  });

  it("stays below BN254 field prime", () => {
    const BN254_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
    for (let i = 0; i < 5; i++) {
      const r = randomFieldElement();
      expect(r).toBeLessThan(BN254_PRIME);
    }
  });

  it("produces distinct values each call", () => {
    const r1 = randomFieldElement();
    const r2 = randomFieldElement();
    expect(r1).not.toBe(r2);
  });
});
