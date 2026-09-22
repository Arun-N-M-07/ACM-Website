/**
 * Team workspace layout, derived from content: where each member stands or
 * sits for their domain's set, and what they're doing there.
 *
 * Coordinates: "hall-local" (x, z) with the entrance at z = 0 and the hall
 * extending to −z; bay-local positions have +z toward the aisle (the visitor).
 */
import type { Activity } from '@/content/avatar';
import type { DomainId, StationKind } from '@/content/domains';
import { DIRECTORS, type TeamMember } from '@/content/team';
import { TEAM_HALL, TEAM_LAYOUT, TEAM_ORIGIN, type BayLayout } from '@/config/world';
import { SEATED } from '@/systems/characters/poses';

export interface Spot {
  x: number;
  z: number;
  /** Bay-local facing (0 = toward the aisle). */
  yaw: number;
  seated: boolean;
  activity: Activity;
  /** What this person does in the set's moment (see scenes/team/sets). */
  role: string;
  /** Standing on something (the events stage), metres above the floor. */
  y?: number;
}

/** Staging for each set, in member order within the domain. */
export const STATION_SPOTS: Record<StationKind, Spot[]> = {
  commons: [],
  grind: [
    { x: -2.6, z: -4.3, yaw: Math.PI, seated: false, activity: 'boardwork', role: 'board' },
    { x: 0.65, z: -0.55, yaw: Math.PI, seated: true, activity: 'watching', role: 'watch' },
    { x: 1.95, z: -0.6, yaw: Math.PI, seated: true, activity: 'watching', role: 'watch' },
  ],
  'terminal-wall': [
    { x: -0.4, z: -2.3, yaw: Math.PI, seated: true, activity: 'typing', role: 'dev' },
    { x: 2.2, z: -2.3, yaw: Math.PI, seated: true, activity: 'typing', role: 'dev' },
  ],
  studio: [
    { x: 2.2, z: 0.05, yaw: Math.PI, seated: false, activity: 'reviewing', role: 'photographer' },
    { x: -1.5, z: -4.0, yaw: -2.4, seated: false, activity: 'presenting', role: 'designer' },
  ],
  newsroom: [{ x: 0, z: -2.35, yaw: 0, seated: true, activity: 'writing', role: 'editor' }],
  stage: [
    { x: -0.9, z: -3.5, yaw: 0, seated: false, activity: 'clipboard', role: 'host', y: 0.45 },
    { x: 3.2, z: -0.9, yaw: -0.9, seated: false, activity: 'clipboard', role: 'crew' },
  ],
  'people-desk': [{ x: 0, z: -2.4, yaw: 0, seated: true, activity: 'writing', role: 'hr' }],
  pitch: [{ x: 2.75, z: -3.9, yaw: -0.5, seated: false, activity: 'presenting', role: 'presenter' }],
  outreach: [{ x: 1.3, z: -1.9, yaw: 0.35, seated: false, activity: 'phone', role: 'caller' }],
  'poster-wall': [{ x: 1.9, z: -4.35, yaw: Math.PI, seated: false, activity: 'pinning', role: 'pinner' }],
  warehouse: [{ x: 1.4, z: -2.6, yaw: 0.2, seated: false, activity: 'clipboard', role: 'checker' }],
};

/** The office bearers gather round the commons island by the entrance. */
const COMMONS_SPOTS: { x: number; z: number; yaw: number; activity: Activity }[] = [
  { x: -1.3, z: TEAM_HALL.commons.z + 0.5, yaw: 0.15, activity: 'reviewing' },
  { x: 1.5, z: TEAM_HALL.commons.z + 0.1, yaw: -0.25, activity: 'presenting' },
  { x: -3.4, z: TEAM_HALL.commons.z - 1.7, yaw: 0.55, activity: 'clipboard' },
  { x: 3.6, z: TEAM_HALL.commons.z - 1.9, yaw: -0.65, activity: 'reviewing' },
];

export interface MemberPlacement {
  member: TeamMember;
  /** World position (floor) and facing. */
  x: number;
  z: number;
  yaw: number;
  seated: boolean;
  activity: Activity;
  role: string;
  /** Height of whatever they stand on. */
  y: number;
  domain: DomainId;
  bay?: BayLayout;
  /** Index within the domain. */
  order: number;
}

/** Transform a bay-local point to hall-local. */
export function bayToHall(bay: BayLayout, x: number, z: number): [number, number] {
  const c = Math.cos(bay.rotationY);
  const s = Math.sin(bay.rotationY);
  return [bay.x + x * c + z * s, bay.z - x * s + z * c];
}

/** Bay-local point → world. */
export function bayToWorld(bay: BayLayout, x: number, z: number, y = 0): [number, number, number] {
  const [hx, hz] = bayToHall(bay, x, z);
  return [TEAM_ORIGIN[0] + hx, TEAM_ORIGIN[1] + y, TEAM_ORIGIN[2] + hz];
}

export function buildPlacements(): MemberPlacement[] {
  const out: MemberPlacement[] = [];
  const byDomain = new Map<DomainId, TeamMember[]>();
  for (const m of DIRECTORS) byDomain.set(m.domain, [...(byDomain.get(m.domain) ?? []), m]);

  (byDomain.get('office') ?? []).forEach((m, i) => {
    const s = COMMONS_SPOTS[i % COMMONS_SPOTS.length];
    const ring = Math.floor(i / COMMONS_SPOTS.length);
    out.push({
      member: m,
      x: TEAM_ORIGIN[0] + s.x,
      z: TEAM_ORIGIN[2] + s.z - ring * 1.5,
      yaw: s.yaw,
      seated: false,
      activity: s.activity,
      role: i === 0 ? 'host' : 'bearer',
      y: 0,
      domain: 'office',
      order: i,
    });
  });

  for (const bay of TEAM_LAYOUT.bays) {
    const members = byDomain.get(bay.domain.id) ?? [];
    const spots = STATION_SPOTS[bay.domain.station];
    members.forEach((m, i) => {
      const spot: Spot = spots[i] ?? { x: (i - 1) * 1.6, z: 1.2, yaw: 0, seated: false, activity: m.activity, role: 'extra' };
      const seated = spot.seated && SEATED[spot.activity];
      const [hx, hz] = bayToHall(bay, spot.x, spot.z);
      out.push({
        member: m,
        x: TEAM_ORIGIN[0] + hx,
        z: TEAM_ORIGIN[2] + hz,
        yaw: bay.rotationY + spot.yaw,
        seated,
        activity: spot.activity,
        role: spot.role,
        y: spot.y ?? 0,
        domain: bay.domain.id,
        bay,
        order: i,
      });
    });
  }
  return out;
}

export const CORE = {
  x: TEAM_ORIGIN[0],
  z: TEAM_ORIGIN[2] + TEAM_HALL.core.z,
  radius: TEAM_HALL.core.radius,
};
