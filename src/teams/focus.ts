/**
 * Choosing a domain.
 *
 *   select(i)  teamsActive → cardFocused (the camera flies to card i — any
 *              card, not just the centred one — while it comes forward and
 *              the rest of the ring gives way) → domainDetail
 *   close()    domainDetail → cardFocused (everything reverses to the exact
 *              orbit pose you left) → teamsActive
 *   step(±1)   domainDetail → the neighbouring domain, arcing around the ring
 *
 * `teamsFrame.focus` (0..1) is the blend from the orbit shot to the focus
 * shot; `teamsFrame.focusK` is the (continuous) card the focus shot is on.
 */
import { gsap } from 'gsap';
import { DOMAIN_COUNT } from '@/content/teams';
import { experience } from '@/store/experience';
import { Vector3 } from 'three';
import { placeScroll } from '@/systems/scroll/ScrollTimeline';
import { ORBIT_FOLLOW, currentComposition } from './controller';
import { pushImpulse } from './dust';
import { O, cardCenter, progressForCarousel } from './layout';
import { teams, teamsFrame } from './state';

const _puff = new Vector3();

let tween: gsap.core.Tween | gsap.core.Timeline | null = null;
const kill = () => {
  tween?.kill();
  tween = null;
};

const DUR = { open: 1.35, close: 1.1, step: 1.1, commit: 0.28 };

/**
 * The entry's timing: the camera's progress along its path (camera.ts,
 * entryShot) over time. Decisive, not cinematic-slow — the card has already
 * answered the click on its own quicker clock (commit); the eye then gathers
 * momentum almost at once, travels, crosses the card's opening surface at
 * speed (about two thirds of the way through), and decelerates softly into
 * the room. Monotone cubic through the beats (Fritsch–Carlson), at rest at
 * both ends: no overshoot, no stall.
 */
const BEATS: [number, number][] = [
  [0, 0],
  [0.1, 0.05],
  [0.36, 0.42],
  [0.62, 0.8],
  [0.8, 0.94],
  [1, 1],
];
const beatSlopes = (() => {
  const n = BEATS.length;
  const d = BEATS.slice(1).map(([t, v], i) => (v - BEATS[i][1]) / (t - BEATS[i][0]));
  const m = BEATS.map((_, i) => (i === 0 || i === n - 1 ? 0 : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const h = Math.hypot(a, b);
    if (h > 3) {
      m[i] = (3 * a * d[i]) / h;
      m[i + 1] = (3 * b * d[i]) / h;
    }
  }
  return m;
})();
function entryEase(t: number) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  let i = 0;
  while (i < BEATS.length - 2 && t > BEATS[i + 1][0]) i++;
  const [t0, v0] = BEATS[i];
  const [t1, v1] = BEATS[i + 1];
  const h = t1 - t0;
  const u = (t - t0) / h;
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * v0 + (u3 - 2 * u2 + u) * h * beatSlopes[i] + (-2 * u3 + 3 * u2) * v1 + (u3 - u2) * h * beatSlopes[i + 1];
}
/** Leaving is the same journey run backwards (a tween from 1 to 0 with this ease retraces it). */
const exitEase = (t: number) => 1 - entryEase(1 - t);

/** The chosen card's acknowledgement runs on its own, quicker clock. */
let ack: gsap.core.Tween | null = null;
function commitTo(v: number, duration: number, ease: string) {
  ack?.kill();
  ack = gsap.to(teamsFrame, { commit: v, duration, ease, onComplete: () => void (ack = null) });
}

export function selectDomain(i: number) {
  const st = teams();
  if (!teamsFrame.inside || st.state !== 'teamsActive') return;
  if (i < 0 || i >= DOMAIN_COUNT) return;
  kill();
  const reduced = experience().reducedMotion;
  // A selection made while the orbit is still moving: the orbit glides on to
  // where its momentum would bring it to rest (a critically damped follower
  // released there settles without reversing), and the scroll is moved there
  // too — so the camera's own motion settles into the entry, nothing resumes
  // stale input afterwards, and closing returns to exactly that place.
  const rest = reduced ? teamsFrame.c : teamsFrame.c + teamsFrame.cV / ORBIT_FOLLOW;
  placeScroll(progressForCarousel(rest));
  teamsFrame.focusK = i;
  teams().set({ state: 'cardFocused', selected: i, focusDir: 'in' });
  commitTo(1, reduced ? 0.01 : DUR.commit, 'power3.out');
  if (!reduced) {
    // The touch lands in the air too: a soft puff outward from the card.
    const cp = currentComposition();
    cardCenter(i, cp, _puff).sub(O);
    pushImpulse(_puff.x, _puff.y, _puff.z, 0, 0, 0, 0.3);
  }
  tween = gsap.to(teamsFrame, {
    focus: 1,
    duration: reduced ? 0.01 : DUR.open * (1 - teamsFrame.focus * 0.6),
    ease: entryEase,
    onComplete: () => {
      tween = null;
      teams().set({ state: 'domainDetail' });
    },
  });
}

export function closeDomain() {
  const st = teams();
  if (st.state !== 'domainDetail' && !(st.state === 'cardFocused' && st.focusDir === 'in')) return;
  kill();
  const reduced = experience().reducedMotion;
  teams().set({ state: 'cardFocused', focusDir: 'out' });
  const duration = reduced ? 0.01 : DUR.close * Math.max(0.4, teamsFrame.focus);
  // The card settles back into the ring as the eye arrives back in orbit.
  commitTo(0, duration, 'power2.in');
  tween = gsap.to(teamsFrame, {
    focus: 0,
    duration,
    ease: exitEase,
    onComplete: () => {
      tween = null;
      teams().set({ state: 'teamsActive', selected: null });
    },
  });
}

/** With a domain open, fly round the ring to another one (and open it). */
export function hopTo(next: number) {
  const st = teams();
  if ((st.state !== 'domainDetail' && st.state !== 'cardFocused') || st.selected === null) return;
  if (next < 0 || next >= DOMAIN_COUNT || next === st.selected) return;
  kill();
  const reduced = experience().reducedMotion;
  // Pull out through the current surface before approaching the next. Never
  // interpolate a camera from inside one plate directly through the spine.
  teams().set({ state: 'cardFocused', focusDir: 'out' });
  tween = gsap
    .timeline({
      onComplete: () => {
        tween = null;
        teams().set({ state: 'domainDetail' });
      },
    })
    .to(teamsFrame, { focus: 0, commit: 0, duration: reduced ? 0.01 : 0.9, ease: exitEase })
    .call(() => {
      teamsFrame.focusK = next;
      teams().set({ selected: next, focusDir: 'in' });
    })
    .to(teamsFrame, { commit: 1, duration: reduced ? 0.01 : DUR.commit, ease: 'power3.out' })
    .to(teamsFrame, { focus: 1, duration: reduced ? 0.01 : DUR.step, ease: entryEase }, '<');
}

/** Next / previous domain while one is open. */
export function stepDomain(dir: 1 | -1) {
  const st = teams();
  if (st.selected === null) return;
  hopTo(st.selected + dir);
}

/** Drop any focus immediately (leaving the world, jumps). */
export function resetFocus() {
  kill();
  ack?.kill();
  ack = null;
  teamsFrame.focus = 0;
  teamsFrame.commit = 0;
}
