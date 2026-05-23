declare module "circomlibjs" {
  export function buildBabyjub(): Promise<{
    F: {
      toObject(elem: unknown): bigint;
      fromObject(n: bigint): unknown;
    };
    addPoint(p1: unknown[], p2: unknown[]): unknown[];
    mulPointEscalar(p: unknown[], n: bigint): unknown[];
    inSubgroup(p: unknown[]): boolean;
    packPoint(p: unknown[]): Uint8Array;
    unpackPoint(packed: Uint8Array): unknown[];
    p: bigint;
    Generator: unknown[];
    Base8: unknown[];
  }>;
  export function buildPedersenHash(): Promise<{
    hash(msg: Buffer | Uint8Array): Uint8Array;
  }>;
  export function buildMimc7(): Promise<unknown>;
  export function buildMimcSponge(): Promise<unknown>;
  export function buildPoseidon(): Promise<unknown>;
}
