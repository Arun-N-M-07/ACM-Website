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
import { SEGMENTS, segmentProgress } from '@/config/timeline';
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
      radius: 2.35,
      cardW,
      cardH,
      cardDepth: 0.07,
      corner: 0.12,
      drop: 1.55,
      fov,
      orbitDist: fitDistance(cardW, cardH, fov, aspect, 0.74, 0.5),
      lift: 0.3,
      detailFov,
      detailDist: fitDistance(cardW, cardH, detailFov, aspect, 0.8, 0.46),
    };
  }
  const cardW = 3.2;
  const cardH = 2.2;
  const fov = 38;
  const detailFov = 36;
  return {
    portrait,
    aspect,
    radius: 3.3,
    cardW,
    cardH,
    cardDepth: 0.07,
    corner: 0.13,
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
export const C_START = -0.24;
/** …and at the end (past card 06: the pull-back over the whole ring). */
export const C_END = 5.9;
/**
 * Scroll is shaped so each card holds the centre a little longer than the
 * travel between them (0 = linear; must stay < 1 to remain monotonic).
 */
const SHAPE = 0.55;

const shape = (r: number) => r - (SHAPE * Math.sin(2 * Math.PI * r)) / (2 * Math.PI);

/** Orbit coordinate for scroll progress p. */
export function carouselAt(p: number) {
  const u = segmentProgress(p, 'teams');
  return shape(C_START + (C_END - C_START) * u);
}

/** Scroll progress at which orbit coordinate `c` is reached (exact at whole cards). */
export function progressForCarousel(c: number) {
  const s = SEGMENTS.teams;
  return s.start + ((s.end - s.start) * (c - C_START)) / (C_END - C_START);
}

/** Scroll progress with domain `i` centred. */
export const progressForDomain = (i: number) => progressForCarousel(i);

/** The establishing coordinate the world opens on. */
export const C_ENTRY = shape(C_START);
/** Where the outro begins and ends. */
export const C_OUTRO = LAST;
export const C_FINAL = shape(C_END);

/** Nearest card to the centre for an orbit coordinate. */
export const nearestCard = (c: number) => Math.max(0, Math.min(LAST, Math.round(c)));

// ─── Placement ───────────────────────────────────────────────────────────────

export const cardAngle = (i: number) => i * STEP;
export const cardY = (i: number, comp: Composition) => -i * comp.drop;

/** World-space centre of card i, pushed `radial` metres out from its ring position. */
export function cardCenter(i: number, comp: Composition, out: Vector3, radial = 0) {
  const a = cardAngle(i);
  const r = comp.radius + radial;
  return out.set(O.x + Math.sin(a) * r, O.y + cardY(i, comp), O.z + Math.cos(a) * r);
}

/** The spine's vertical extent (relative to O), covering the helix with room above and below. */
export const SPINE_TOP = 9;
export const SPINE_BOTTOM = -19;
