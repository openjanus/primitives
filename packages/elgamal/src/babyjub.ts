/**
 * babyjub.ts — Lazy singleton for the circomlibjs BabyJubjub instance.
 *
 * circomlibjs's buildBabyjub() is async and expensive (~100ms).
 * We cache it once per process.
 */

// circomlibjs has no @types package; suppress the implicit-any warning.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { buildBabyjub } from "circomlibjs";

// circomlibjs does not export types; we declare a minimal shape.
export interface BabyJub {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  F: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Base8: any[];
  subOrder: bigint;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mulPointEscalar(point: any[], scalar: bigint): any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addPoint(a: any[], b: any[]): any[];
  // circomlibjs uses inCurve (not isOnCurve)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inCurve(point: any[]): boolean;
}

let _instance: BabyJub | null = null;

/**
 * Return (or build) the singleton BabyJubjub instance.
 */
export async function getBabyJub(): Promise<BabyJub> {
  if (!_instance) {
    _instance = (await buildBabyjub()) as BabyJub;
  }
  return _instance;
}
