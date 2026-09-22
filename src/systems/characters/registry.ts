/**
 * Frame-rate shared state between the player controller, NPCs and the
 * handshake camera / hand. Plain mutable objects — no React involved.
 */
import { Vector3 } from 'three';

export const player = {
  position: new Vector3(),
  yaw: 0,
  pitch: 0,
  speed: 0,
  /** True while the visitor is in the team workspace (explore / finale). */
  present: false,
};

export interface NpcAnchors {
  head: Vector3;
  hand: Vector3;
  position: Vector3;
}

export const npcAnchors = new Map<string, NpcAnchors>();

/** Only one NPC may walk over for a handshake at a time. */
export const interaction = {
  owner: null as string | null,
};
