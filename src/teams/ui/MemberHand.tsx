'use client';
/**
 * A domain's people, dealt as a hand of cards.
 *
 * Once the eye comes through a domain's card (camera.ts, entryShot), its
 * people rise out of the card's opening as a small hand of physical cards —
 * DOM and CSS 3D, no WebGL — over the world's own dark atmosphere. No room is
 * built; nothing stands beside the cards. The cards are the objects.
 *
 *   the hand     fanned in depth: each card a little turned, offset and
 *                tilted, the one on top nearest, as a hand holds them, with
 *                small irregularities (a hand, not a grid). CORE's chair
 *                stands a touch proud of the others.
 *   a card       ROLE (mono) over NAME (serif) — the CORE language. Members
 *                have no role in the chapter's data, so they read MEMBER. No
 *                roll numbers, nothing invented.
 *   the pointer  approaching turns the nearest card a little towards you;
 *                reaching it pulls it out of the hand — forward, up, squared
 *                to the eye — while its neighbours give way and the outer
 *                cards sink back, and light slides across its coat.
 *   a click      draws the card: it comes to the centre, square and larger,
 *                and the rest of the hand recedes. Escape or a click beside
 *                it puts it back (TeamsInput); a second one leaves the domain.
 *
 * Motion is critically damped springs (pointer.ts: quick out, slower back, no
 * bounce), stepped in the site's frame loop and written straight to styles —
 * no React render per frame. The deal is keyed on the focus scalar, so it
 * plays backwards exactly as the domain closes. The pointer is the Teams
 * pointer channel; hover is decided from the hand's rest geometry, so a card
 * moving under the cursor never flickers its own hover.
 */
import { type CSSProperties, useEffect, useMemo, useRef } from 'react';
import { type TeamDomain, domainIndexLabel } from '@/content/teams';
import { smooth, useProgressFrame } from '@/components/experience/useProgressFrame';
import { stage as screen } from '@/systems/anchors/anchors';
import { useExperience } from '@/store/experience';
import { applyType, fontsReady, makeCanvas, wrap } from '@/systems/textures/typeset';
import { type Spring, stepSpring } from '../pointer';
import { teamsFrame } from '../state';

interface Person {
  role: string;
  name: string;
}

interface Pose {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
}

interface Layout {
  W: number;
  H: number;
  /** Card width and height (CSS px). */
  u: number;
  ch: number;
  /** The hand's centre on screen. */
  cx: number;
  cy: number;
  /** The spacing of the cards across the hand (px). */
  step: number;
  /** The drawn card: its scale, and its offset from the hand's centre (px, before perspective). */
  ds: number;
  dy: number;
}

interface CardSim {
  /** Pulled out of the hand (hover / keyboard focus). */
  h: Spring;
  /** The pointer approaching. */
  p: Spring;
  /** Drawn (clicked). */
  s: Spring;
  /** Where the pointer is on the card (−1..1), for the tilt. */
  tx: Spring;
  ty: Spring;
  /** The pointer in the card's own frame at rest (−1..1 inside). */
  lx: number;
  ly: number;
  last: string;
  lastVars: string;
}

const PERSPECTIVE = 1600;
const DEG = Math.PI / 180;
const spring = (): Spring => ({ v: 0, dv: 0 });
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** A drawn card comes this far forward (px), and this much larger: together, its size over a resting card's. */
const DRAWN_Z = 170;
const DRAWN_SCALE = 1.22;
const NEAR = PERSPECTIVE / (PERSPECTIVE - DRAWN_Z);

/**
 * The screen's room for the hand, from the chrome that stays over it: the hint and bar above (and,
 * upright, the domain's name, which heads the screen), the controls below.
 */
function chrome(root: Element | null, H: number, portrait: boolean) {
  const q = (sel: string) => root?.querySelector(sel)?.getBoundingClientRect();
  const above = Math.max(q('.domain-scroll')?.bottom ?? 0, portrait ? (q('.hand-ident')?.bottom ?? 0) : 0);
  const below = q('.domain-controls')?.top ?? H;
  return { top: above + 12, bottom: H - below + 12 };
}

function measure(n: number, root: Element | null): Layout {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const portrait = W / H < 0.9;
  // Fewer cards, larger cards: a lone card is the hero.
  const few = n === 1 ? 1.16 : n === 2 ? 1.08 : 1;
  let u = few * (portrait ? clamp(W * 0.42, 150, 230) : clamp(Math.min(W * 0.21, H * 0.34), 236, 340));
  const k = n === 2 ? 0.8 : n <= 4 ? 0.74 : Math.max(0.42, 2.6 / (n - 1));
  const cx = W * (portrait ? 0.5 : 0.535);
  let cy = H * (portrait ? 0.6 : 0.575);
  const across = n === 1 ? 1.3 : 1 + (n - 1) * k + 0.16;
  const drawn0 = 1.42 * DRAWN_SCALE * NEAR * u;
  const drawnC = cy - 0.04 * u * NEAR;
  // As laid out, wherever the hand — the whole fan, and a card drawn from it — is on screen.
  if ((u * across) / 2 <= Math.min(cx, W - cx) && drawnC - drawn0 / 2 >= 0 && drawnC + drawn0 / 2 <= H) {
    return { W, H, u, ch: u * 1.42, cx, cy, step: k * u, ds: DRAWN_SCALE, dy: -0.04 * u };
  }

  // A phone (upright, or on its side) has less room than that: there the cards come smaller rather
  // than leave the screen — the fan across it, a drawn card clear of the chrome — and a drawn card
  // comes larger instead, so its name and role still read.
  const { top, bottom } = chrome(root, H, portrait);
  const band = Math.max(1, H - top - bottom);
  const room = W - 2 * Math.max(16, W * 0.04);
  const drawnMax = Math.min(room, band / 1.42);
  u = Math.max(40, Math.min(u, room / across, drawnMax / (DRAWN_SCALE * NEAR)));
  const drawnW = Math.min(Math.max(DRAWN_SCALE * NEAR * u, Math.min(0.8 * W, 320)), drawnMax);
  const ch = u * 1.42;
  // The resting hand within the band; the drawn card at its place, or as near it as the band allows.
  cy = clamp(cy, Math.min(top + 0.82 * u, H / 2), Math.max(H - bottom - 0.86 * u, H / 2));
  const drawnH = 1.42 * drawnW;
  const yc = clamp(cy - 0.04 * u * NEAR, top + drawnH / 2, Math.max(top + drawnH / 2, H - bottom - drawnH / 2));
  return { W, H, u, ch, cx, cy, step: k * u, ds: drawnW / (u * NEAR), dy: (yc - cy) / NEAR };
}

/** The name block's width on a card, and its largest type (fractions of the card's width). */
const NAME_W = 0.66;
const NAME_MAX = 0.125;
/** The card's face inside its margins (hand-card__face: padding 0.1 of the width either side). */
const FACE_W = 0.8;

/**
 * A name as large as the card allows in at most three lines, never leaving a
 * lone initial on a line of its own (measured in the loaded serif).
 */
function nameSize(ctx: CanvasRenderingContext2D, name: string, u: number) {
  const width = NAME_W * u;
  let size = NAME_MAX * u;
  let longest = 0;
  for (; size > NAME_MAX * u * 0.7; size *= 0.96) {
    applyType(ctx, { family: 'serif', size });
    const lines = wrap(ctx, name, width);
    longest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const orphan = lines.length > 1 && lines.some((l) => l.replace(/[^\p{L}]/gu, '').length <= 2);
    if (longest <= width && lines.length <= 3 && !orphan) return size;
  }
  // A single long word may run past the name's measure, but never off the card's face.
  applyType(ctx, { family: 'serif', size });
  longest = Math.max(...wrap(ctx, name, width).map((l) => ctx.measureText(l).width));
  return longest > FACE_W * u ? (size * FACE_W * u) / longest : size;
}

/**
 * The hand at rest (px from its centre, degrees). The top card is the last
 * and nearest; every card shows its upper left, where the role and name sit.
 */
function restPose(i: number, n: number, L: Layout, lead: boolean): Pose {
  // Small, fixed irregularities, −0.5..0.5 per card.
  const j = (k: number) => Math.sin(i * 12.9898 + k * 78.233 + n) * 0.5;
  if (n === 1) return { x: L.u * 0.12, y: 0, z: 0, rx: 3, ry: -9, rz: -2.4 };
  const t = i - (n - 1) / 2;
  const step = L.step;
  const turn = n === 2 ? 3.2 : Math.min(4.6, 16 / (n - 1));
  return {
    x: t * step + j(1) * 0.03 * L.u,
    // A gentle arc (the outer cards lower), the lead card standing proud.
    y: (t * t * 0.045 + j(2) * 0.025 - (lead && i === 0 ? 0.06 : 0)) * L.u,
    // Stacked in depth, the top card nearest: far enough apart that turned
    // neighbours never cut through each other.
    z: (i - (n - 1)) * 36 + j(3) * 4,
    rx: 2.5,
    ry: -t * 2.4,
    rz: t * turn + j(4) * 1.2 - 1.2,
  };
}

export function MemberHand({ domain, index, open }: { domain: TeamDomain; index: number; open: boolean }) {
  const people = useMemo<Person[]>(
    () => (domain.officers ? domain.officers.map((o) => ({ role: o.role, name: o.name })) : domain.members.map((name) => ({ role: 'Member', name }))),
    [domain],
  );
  const n = people.length;
  const lead = !!domain.officers;
  const stage = useRef<HTMLDivElement>(null);
  const ident = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const slots = useRef<(HTMLLIElement | null)[]>([]);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const layout = useRef<Layout | null>(null);
  const rest = useRef<Pose[]>([]);
  const sims = useRef<CardSim[]>([]);
  const hovered = useRef(-1);
  const keyboard = useRef(-1);
  const drawnShown = useRef(-2);

  useEffect(() => {
    sims.current = people.map(() => ({ h: spring(), p: spring(), s: spring(), tx: spring(), ty: spring(), lx: 9, ly: 9, last: '', lastVars: '' }));
    teamsFrame.member = -1;
    const place = () => {
      const L = measure(n, stage.current?.closest('.domain-detail') ?? null);
      layout.current = L;
      rest.current = people.map((_, i) => restPose(i, n, L, lead));
      const el = stage.current;
      if (!el) return;
      el.style.setProperty('--u', `${L.u}px`);
      el.style.setProperty('--ch', `${L.ch}px`);
      el.style.setProperty('--cx', `${L.cx}px`);
      el.style.setProperty('--cy', `${L.cy}px`);
      // Each name set as large as its card allows (once the serif has loaded).
      void fontsReady().then(() => {
        if (layout.current !== L) return;
        const { ctx } = makeCanvas(2, 2);
        people.forEach((p, i) => slots.current[i]?.style.setProperty('--name', `${nameSize(ctx, p.name, L.u).toFixed(1)}px`));
      });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [people, n, lead]);

  useEffect(() => {
    if (open) heading.current?.focus({ preventScroll: true });
  }, [open]);

  useProgressFrame((_, dtRaw) => {
    const L = layout.current;
    const el = stage.current;
    if (!L || !el || sims.current.length !== n) return;
    const f = teamsFrame;
    const dt = clamp(dtRaw, 0, 0.05);
    const reduced = useExperience.getState().reducedMotion;
    const R = rest.current;
    const S = sims.current;

    // The deal: the hand rises out of the card's opening as the eye crosses it.
    const deal = smooth(0.66, 1, f.focus);
    const ready = open && deal > 0.98;
    el.style.setProperty('--deal', deal.toFixed(3));
    if (ident.current) {
      const k = smooth(0.25, 1, deal);
      ident.current.style.opacity = k.toFixed(3);
      ident.current.style.transform = `translate3d(0, ${((1 - easeOut(k)) * 14).toFixed(2)}px, 0)`;
    }

    const drawn = ready ? f.member : -1;
    if (drawn !== drawnShown.current) {
      drawnShown.current = drawn;
      buttons.current.forEach((b, i) => b?.setAttribute('aria-pressed', String(drawn === i)));
    }

    // The pointer, in CSS px, and where it is on each card at rest.
    const pointerOn = ready && f.pointer.active && !reduced;
    const px = (f.pointer.x + 1) * 0.5 * (screen.w || L.W);
    const py = (1 - f.pointer.y) * 0.5 * (screen.h || L.H);
    let hit = -1;
    let keep = false;
    let near = -1;
    let nearD = Infinity;
    for (let i = n - 1; i >= 0; i--) {
      const r = R[i];
      const k = PERSPECTIVE / (PERSPECTIVE - r.z);
      const dx = px - (L.cx + r.x * k);
      const dy = py - (L.cy + r.y * k);
      const c = Math.cos(r.rz * DEG);
      const sn = Math.sin(r.rz * DEG);
      const lx = (dx * c + dy * sn) / (L.u * 0.5 * k);
      const ly = (-dx * sn + dy * c) / (L.ch * 0.5 * k);
      S[i].lx = lx;
      S[i].ly = ly;
      if (!pointerOn || drawn >= 0) continue;
      const d = Math.max(Math.abs(lx), Math.abs(ly));
      // The card being pulled keeps the pointer a little past its rest edge.
      if (i === hovered.current && d <= 1.1) keep = true;
      if (d <= 1 && hit < 0) hit = i;
      if (d < nearD) {
        nearD = d;
        near = i;
      }
    }
    if (keep) hit = hovered.current;
    hovered.current = hit;
    const active = hit >= 0 ? hit : drawn < 0 && ready ? keyboard.current : -1;

    // Springs: quick out of the hand, a little slower back into it.
    let drawnAmt = 0;
    for (let i = 0; i < n; i++) {
      const s = S[i];
      const tH = active === i ? 1 : 0;
      const tP = hit < 0 && near === i ? 1 - smooth(1, 1.6, nearD) : 0;
      const tS = drawn === i ? 1 : 0;
      const tX = active === i && hit === i ? clamp(s.lx, -1, 1) : 0;
      const tY = active === i && hit === i ? clamp(s.ly, -1, 1) : 0;
      if (reduced) {
        for (const [sp, t] of [[s.h, tH], [s.p, 0], [s.s, tS], [s.tx, 0], [s.ty, 0]] as const) {
          sp.v = t;
          sp.dv = 0;
        }
      } else {
        stepSpring(s.h, tH, dt, 24, 15);
        stepSpring(s.p, tP, dt, 12, 8);
        stepSpring(s.s, tS, dt, 16, 12);
        stepSpring(s.tx, tX, dt, 18, 12);
        stepSpring(s.ty, tY, dt, 18, 12);
      }
      drawnAmt = Math.max(drawnAmt, s.s.v);
    }

    for (let i = 0; i < n; i++) {
      const s = S[i];
      const r = R[i];
      const slot = slots.current[i];
      if (!slot) continue;
      const h = clamp(s.h.v, 0, 1.2);
      const p = clamp(s.p.v, 0, 1);
      const d = clamp(s.s.v, 0, 1.2);
      // The hand as one composition: the others give way to the card being
      // pulled (the nearest most), and recede when one is drawn.
      let x = r.x;
      let y = r.y;
      let z = r.z;
      for (let k = 0; k < n; k++) {
        if (k === i) continue;
        const g = clamp(S[k].h.v, 0, 1.2);
        const gap = Math.abs(i - k);
        // The cards above it in the hand (to its right) make the most room:
        // it comes out over them, and their names sit on their left.
        const room = i > k ? (gap === 1 ? 0.14 : 0.06) : gap === 1 ? -0.05 : -0.025;
        x += room * L.u * g;
        z -= (gap === 1 ? 14 : 26) * g;
      }
      let rx = r.rx;
      let ry = r.ry;
      let rz = r.rz;
      let sc = 1;
      // Approached: it turns a little to meet the pointer.
      z += 12 * p;
      rz *= 1 - 0.2 * p;
      // Pulled out — forward, up and a little towards its own open side (as a
      // card is drawn from a hand), squared to the eye, following the pointer.
      z += 95 * h;
      y -= 0.07 * L.u * h;
      if (n > 1) x -= 0.08 * L.u * h;
      rz *= 1 - 0.85 * h;
      ry *= 1 - 0.8 * h;
      rx = rx * (1 - h) - s.ty.v * 3.2 * h;
      ry += s.tx.v * 4.2 * h;
      sc *= 1 + 0.03 * h;
      // Drawn: to the centre, square and larger; the rest step back from it.
      const others = drawnAmt - d;
      if (others > 0 && drawn >= 0) {
        x += Math.sign(i - drawn) * 0.32 * L.u * others;
        z -= 150 * others;
        rz += Math.sign(i - drawn) * 3 * others;
      }
      x = mix(x, 0, d);
      y = mix(y, L.dy, d);
      z = mix(z, DRAWN_Z, d);
      rx = mix(rx, -s.ty.v * 2, d);
      ry = mix(ry, s.tx.v * 3, d);
      rz = mix(rz, 0, d);
      sc = mix(sc, L.ds, d);
      // The deal: out of a stack at the opening, in the order they lie, the
      // depth order kept all the way (so no card passes through another).
      const lag = n > 1 ? 0.08 : 0;
      const e = easeOut(clamp((deal - i * lag) / (1 - (n - 1) * lag), 0, 1));
      const ez = easeOut(deal);
      x = mix(0, x, e);
      y = mix(0.06 * L.u, y, e);
      z = mix(-240 + i * 4, z, ez);
      rx = mix(10, rx, e);
      ry = mix(0, ry, e);
      rz = mix(0, rz, e);
      sc = mix(0.7, sc, e);
      // Opaque almost as soon as it leaves the stack: cards never ghost through one another.
      const opacity = smooth(0, 0.14, e) * (1 - 0.72 * clamp(others, 0, 1));
      const tf = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${z.toFixed(2)}px) rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg) rotateZ(${rz.toFixed(3)}deg) scale(${sc.toFixed(4)})|${opacity.toFixed(3)}`;
      if (tf !== s.last) {
        s.last = tf;
        const [t, o] = tf.split('|');
        slot.style.transform = t;
        slot.style.opacity = o;
      }
      // Light sliding across the coat: from where the pointer is over the card.
      const lift = Math.max(h, d);
      const lx = pointerOn ? clamp(50 + s.lx * 42, -30, 130) : 30;
      const ly = pointerOn ? clamp(50 + s.ly * 42, -30, 130) : 18;
      const lit = (pointerOn ? 0.22 + 0.5 * h + 0.18 * p : 0.18) + 0.25 * d;
      const vars = `${lx.toFixed(1)}|${ly.toFixed(1)}|${lit.toFixed(3)}|${lift.toFixed(3)}`;
      if (vars !== s.lastVars) {
        s.lastVars = vars;
        slot.style.setProperty('--lx', `${lx.toFixed(1)}%`);
        slot.style.setProperty('--ly', `${ly.toFixed(1)}%`);
        slot.style.setProperty('--lit', lit.toFixed(3));
        slot.style.setProperty('--lift', clamp(lift, 0, 1).toFixed(3));
        slot.style.setProperty('--drawn', clamp(d, 0, 1).toFixed(3));
      }
    }
  });

  const count = `${n} ${domain.officers ? (n === 1 ? 'Officer' : 'Officers') : n === 1 ? 'Member' : 'Members'}`;
  return (
    <div ref={stage} className="hand-stage" style={{ '--tone': domain.tone } as CSSProperties}>
      <header ref={ident} className="hand-ident" style={{ opacity: 0 }}>
        <p className="hand-index">{domainIndexLabel(index)}</p>
        <h2 id="domain-detail-title" ref={heading} tabIndex={-1} className="hand-title">
          {domain.name}
        </h2>
        <p className="hand-count">{count}</p>
      </header>
      <ul className="hand" aria-labelledby="domain-detail-title">
        {people.map((person, i) => (
          <li key={person.name} ref={(el) => void (slots.current[i] = el)} className="hand-slot" style={{ opacity: 0 }}>
            <button
              ref={(el) => void (buttons.current[i] = el)}
              type="button"
              className="hand-card"
              disabled={!open}
              onClick={() => {
                teamsFrame.member = teamsFrame.member === i ? -1 : i;
              }}
              onFocus={() => void (keyboard.current = i)}
              onBlur={() => void (keyboard.current === i && (keyboard.current = -1))}
            >
              <span className="hand-card__shade" aria-hidden="true" />
              <span className="hand-card__face">
                <span className="hand-card__rule" aria-hidden="true" />
                <span className="hand-card__role">{person.role}</span>
                <span className="hand-card__name">{person.name}</span>
                <span className="hand-card__foot" aria-hidden="true">
                  {n > 1 && <span>{`${String(i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`}</span>}
                  <span className="hand-card__domain">{domain.name}</span>
                </span>
              </span>
              <span className="hand-card__sheen" aria-hidden="true" />
              <span className="hand-card__edge" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
