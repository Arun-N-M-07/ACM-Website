/**
 * Spatial composition of the Teams world.
 *
 * The world is a vertical spine with the six domain cards on a descending
 * helix around it, 60° apart — so the ring closes exactly on the sixth card.
 * Cards face outward. The camera orbits outside the ring at the angle of the
 * card in focus and descends with it: the focused card sits square to the
 * lens with the spine standing behind it, its neighbours turn away at the
 * edges of frame, and the far side of the ring shows through, lower down.
 *
 * Portrait screens are *re-composed*, not scaled: portrait cards, a tighter
 * ring, a steeper helix and a wider lens.
 *
 * Everything is authored relative to TEAMS_ORIGIN (a point on the spine axis
 * at the height of card 01).
 */
import { Vector3 } from 'three';
import { PORTAL_GATE, SCROLL_LENGTH_VH, SEGMENTS, segmentProgress } from '@/config/timeline';
import { TEAMS_ORIGIN } from '@/config/world';
import { DOMAIN_COUNT } from '@/content/teams';

export const O = new Vector3(...TEAMS_ORIGIN);
/** Angle between neighbouring cards. */
export const STEP = (Math.PI * 2) / DOMAIN_COUNT;
export const LAST = DOMAIN_COUNT - 1;

export interface Composition {
  portrait: boolean;
  aspect: number;
  /** Ring radius (spine axis → card centre). */
  radius: number;
  cardW: number;
  cardH: number;
  cardDepth: number;
  /** Corner radius. */
  corner: number;
  /** Vertical drop per card along the helix. */
  drop: number;
  /** Lens (vertical FOV, degrees) while orbiting. */
  fov: number;
  /** Camera distance in front of the focused card while orbiting. */
  orbitDist: number;
  /** Camera height above the focused card's centre. */
  lift: number;
  /** Lens and distance with a card open. */
  detailFov: number;
  detailDist: number;
}

const tanHalf = (fovDeg: number) => Math.tan((fovDeg * Math.PI) / 360);

/** Distance at which a w×h card fills `fw` of the frame's width and at most `fh` of its height. */
function fitDistance(w: number, h: number, fovDeg: number, aspect: number, fw: number, fh: number) {
  const t = 2 * tanHalf(fovDeg);
  return Math.max(w / (fw * t * aspect), h / (fh * t));
}

export function composition(aspect: number): Composition {
  const portrait = aspect < 0.9;
  if (portrait) {
    const cardW = 2.2;
    const cardH = 3.0;
    const fov = 48;
    const detailFov = 44;
    return {
      portrait,
      aspect,
      radius: 2.7,
      cardW,
      cardH,
      cardDepth: 0.11,
      corner: 0.12,
      drop: 1.25,
      fov,
      orbitDist: fitDistance(cardW, cardH, fov, aspect, 0.74, 0.5),
      lift: 0.3,
      detailFov,
      detailDist: fitDistance(cardW, cardH, detailFov, aspect, 0.8, 0.46),
    };
  }
  const cardW = 3.2;
  const cardH = 2.2;
  const fov = 44;
  const detailFov = 36;
  return {
    portrait,
    aspect,
    radius: 3.65,
    cardW,
    cardH,
    cardDepth: 0.11,
    corner: 0.12,
    drop: 1.05,
    fov,
    orbitDist: fitDistance(cardW, cardH, fov, aspect, 0.53, 0.56),
    lift: 0.3,
    detailFov,
    detailDist: fitDistance(cardW, cardH, detailFov, aspect, 0.6, 0.68),
  };
}

// ─── Scroll → orbit ──────────────────────────────────────────────────────────

/** Orbit coordinate at the start of the Teams segment (an establishing view before card 01)… */
export const C_START = -2;
/** Solid typography sits in front of the same world; its central word space is the passage. */
export const ENTRY_Z = 22;
/** …and at the end (past card 06: the pull-back over the whole ring). */
export const C_END = LAST + 0.9;
/**
 * Scroll is shaped so each card holds the centre a little longer than the
 * travel between them (0 = linear; must stay < 1 to remain monotonic).
 */
const SHAPE = 0.55;

const shape = (r: number) => r - (SHAPE * Math.sin(2 * Math.PI * r)) / (2 * Math.PI);

/** Orbit coordinate for scroll progress p. */
export function carouselAt(p: number) {
  const u = segmentProgress(p, 'teams');
  const c = C_START + (C_END - C_START) * u;
  return c < 0 ? c : shape(c);
}

/** Scroll progress at which orbit coordinate `c` is reached (exact at whole cards). */
export function progressForCarousel(c: number) {
  const s = SEGMENTS.teams;
  // Invert the monotonic dwell curve, including fractional debug/navigation stops.
  let lo = 0, hi = C_END;
  if (c >= 0) {
    for (let i = 0; i < 32; i++) {
      const mid = (lo + hi) / 2;
      if (shape(mid) < c) lo = mid; else hi = mid;
    }
  }
  const raw = c < 0 ? c : (lo + hi) / 2;
  return s.start + ((s.end - s.start) * (raw - C_START)) / (C_END - C_START);
}

/** Scroll progress with domain `i` centred. */
export const progressForDomain = (i: number) => progressForCarousel(i);

/**
 * The floor of the world's scroll: a hair inside the Teams segment (a few
 * pixels past the portal gate), so the rest pose belongs to the Teams chapter
 * and not to the portal it just came through.
 */
export const TEAMS_FLOOR = PORTAL_GATE + 0.6 / SCROLL_LENGTH_VH;

/** Framed stills inside the world for reduced motion: the entrance, then every domain. */
export const teamsStops = () => [TEAMS_FLOOR, ...Array.from({ length: DOMAIN_COUNT }, (_, i) => progressForDomain(i))];

/** The establishing coordinate the world opens on. */
export const C_ENTRY = C_START;
/** Where the outro begins and ends. */
export const C_OUTRO = LAST;
export const C_FINAL = shape(C_END);

/** Nearest card to the centre for an orbit coordinate. */
export const nearestCard = (c: number) => Math.max(0, Math.min(LAST, Math.round(c)));

// ─── Placement ───────────────────────────────────────────────────────────────

// Authored stations, not an evenly spaced carousel. Cubic interpolation keeps
// the camera's direction continuous between the discrete physical cards.
const ANGLES = [0, 0.91, 1.98, 2.80, 3.86, 4.83, 5.82];
const HEIGHTS = [0, -1.04, -2.31, -3.24, -4.63, -5.69, -6.95];
const RADII = [0, 0.32, -0.15, 0.42, 0.03, 0.28, -0.12];
function station(values: number[], c: number) {
  const at = (i: number): number => i < 0 ? values[0] + i * (values[1] - values[0]) : i > LAST ? values[LAST] + (i - LAST) * (values[LAST] - values[LAST - 1]) : values[i];
  const i = Math.floor(c), t = c - i;
  const a = at(i), b = at(i + 1), m0 = (b - at(i - 1)) / 2, m1 = (at(i + 2) - a) / 2;
  return (2*t*t*t - 3*t*t + 1)*a + (t*t*t - 2*t*t + t)*m0 + (-2*t*t*t + 3*t*t)*b + (t*t*t - t*t)*m1;
}
export const cardAngle = (i: number) => station(ANGLES, i);
export const cardY = (i: number, comp: Composition) => station(HEIGHTS, i) * comp.drop;
export const cardRadius = (i: number, comp: Composition) => comp.radius + station(RADII, i) * (comp.portrait ? 0.65 : 1);

/** Shared by the sculpted column, its mounts and the camera track. */
export function spineAxis(y: number, out: Vector3) {
  return out.set(0.48 * Math.sin(y * 0.32), y, 0.42 * Math.sin(y * 0.27));
}

/** World-space centre of card i, pushed `radial` metres out from its ring position. */
export function cardCenter(i: number, comp: Composition, out: Vector3, radial = 0) {
  const a = cardAngle(i);
  const r = cardRadius(i, comp) + radial;
  spineAxis(cardY(i, comp), out).add(O);
  out.x += Math.sin(a) * r;
  out.z += Math.cos(a) * r;
  return out;
}

/** The spine's vertical extent (relative to O), covering the helix with room above and below. */
export const SPINE_TOP = 6;
export const SPINE_BOTTOM = -12;
