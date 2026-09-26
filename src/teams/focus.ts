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
import { teams, teamsFrame } from './state';

let tween: gsap.core.Tween | gsap.core.Timeline | null = null;
const kill = () => {
  tween?.kill();
  tween = null;
};

const DUR = { open: 1.35, close: 1.15, step: 1.3 };

export function selectDomain(i: number) {
  const st = teams();
  if (!teamsFrame.inside || (st.state !== 'teamsActive' && st.state !== 'cardFocused')) return;
  if (i < 0 || i >= DOMAIN_COUNT) return;
  kill();
  const reduced = experience().reducedMotion;
  // Re-opening while a close is still in flight: reverse from where it is.
  if (st.state !== 'cardFocused' || teamsFrame.focus < 0.02) teamsFrame.focusK = i;
  else if (Math.round(teamsFrame.focusK) !== i) teamsFrame.focusK = i;
  teams().set({ state: 'cardFocused', selected: i, focusDir: 'in' });
  tween = gsap.to(teamsFrame, {
    focus: 1,
    duration: reduced ? 0.01 : DUR.open * (1 - teamsFrame.focus * 0.6),
    ease: 'power3.inOut',
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
  tween = gsap.to(teamsFrame, {
    focus: 0,
    duration: reduced ? 0.01 : DUR.close * Math.max(0.4, teamsFrame.focus),
    ease: 'power3.inOut',
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
  const dist = Math.abs(next - teamsFrame.focusK);
  teams().set({ selected: next, state: 'cardFocused', focusDir: 'in' });
  tween = gsap
    .timeline({
      onComplete: () => {
        tween = null;
        teams().set({ state: 'domainDetail' });
      },
    })
    .to(teamsFrame, { focus: 1, duration: reduced ? 0.01 : 0.4, ease: 'power2.out' }, 0)
    .to(teamsFrame, { focusK: next, duration: reduced ? 0.01 : DUR.step * (0.75 + dist * 0.25), ease: 'power2.inOut' }, 0);
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
  teamsFrame.focus = 0;
}
