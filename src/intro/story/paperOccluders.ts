/**
 * Where each story sheet is, for the smog (prologue/GasVolume): the smog
 * parts around a sheet as it comes, so it is read in a clearing of the air.
 * (The sheets are drawn over the smog, so nothing here has to be exact: this
 * is only where the air is pushed aside, and how much.)
 */
import { Vector3 } from 'three';

export interface PaperOccluder {
  on: boolean;
  center: Vector3;
  /** 0 → 1 as the sheet comes (the smog parts around it). */
  presence: number;
}

export const paperOccluders = new Map<string, PaperOccluder>();

export function paperOccluder(id: string): PaperOccluder {
  let o = paperOccluders.get(id);
  if (!o) {
    o = { on: false, center: new Vector3(), presence: 0 };
    paperOccluders.set(id, o);
  }
  return o;
}

/** The sheet the smog should part around now (the most present one), or null. */
export function activePaper(): PaperOccluder | null {
  let best: PaperOccluder | null = null;
  for (const o of paperOccluders.values()) if (o.on && (!best || o.presence > best.presence)) best = o;
  return best;
}
