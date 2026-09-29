'use client';
/**
 * A content plate: the way this site shows text.
 *
 * Words never float loose over the 3D. Each piece of content is a card that
 * lifts out of the thing it describes — the clock tower, a room's wall, a
 * domain's sign — and stays attached to it with a thin leader line and a pin,
 * like an annotated drawing. The card is real HTML (crisp at any resolution,
 * selectable, readable by assistive tech) over a soft scrim, so it stays
 * legible whatever is behind it.
 *
 * Everything is a pure function of scroll progress, so plates scrub.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { anchorAt, onProjected } from '@/systems/anchors/anchors';
import { progress } from '@/systems/scroll/progress';
import { smooth } from './useProgressFrame';

export interface PlateProps {
  id: string;
  /** Which side of the screen the card docks to (phones always dock at the bottom). */
  side: 'left' | 'right';
  /** World anchor id to point at (see config/anchors.ts). */
  anchor?: string;
  accent?: string;
  /** Progress range where the plate is fully up. */
  range: [number, number];
  /** Fade length in progress units (defaults to a fifth of the range). */
  ramp?: number;
  /** Small label drawn at the pin. */
  pin?: string;
  children: ReactNode;
  className?: string;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * The last value written to each element's attribute or style: the plate is updated every projected
 * frame, but a write that changes nothing still costs the page a style pass, so those are skipped.
 */
const written = new WeakMap<Element, Record<string, string>>();
const record = (el: Element) => {
  let w = written.get(el);
  if (!w) written.set(el, (w = {}));
  return w;
};
function setAttr(el: Element, name: string, value: string) {
  const w = record(el);
  if (w[name] === value) return;
  w[name] = value;
  el.setAttribute(name, value);
}
function setStyle(el: HTMLElement | SVGElement, prop: 'transform' | 'opacity' | 'strokeDasharray' | 'strokeDashoffset', value: string) {
  const w = record(el);
  if (w[prop] === value) return;
  w[prop] = value;
  el.style[prop] = value;
}

export function Plate({ id, side, anchor, accent, range, ramp, pin, children, className }: PlateProps) {
  const root = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const path = useRef<SVGPathElement>(null);
  const dot = useRef<SVGCircleElement>(null);
  const ring = useRef<SVGCircleElement>(null);
  const label = useRef<SVGTextElement>(null);
  const shown = useRef(-1);

  useEffect(() => {
    const [a, b] = range;
    const r = ramp ?? Math.max(0.0015, (b - a) * 0.2);
    // The card's docked box. It only moves with the layout (a resize, the card's own size, its side),
    // never with the scroll, so it is measured then — not read back after this frame's writes, which
    // forced a layout every frame the plate was up.
    const box = { left: 0, top: 0, w: 0, h: 0 };
    const measure = () => {
      const c = card.current;
      if (!c) return;
      box.left = c.offsetLeft;
      box.top = c.offsetTop;
      box.w = c.offsetWidth;
      box.h = c.offsetHeight;
    };
    const update = () => {
      const el = root.current;
      const c = card.current;
      if (!el || !c) return;
      const p = progress.value;
      const v = smooth(a - r, a, p) * (1 - smooth(b, b + r, p));
      if (v !== shown.current) {
        const was = shown.current > 0.004;
        shown.current = v;
        el.style.setProperty('--v', String(v));
        const on = v > 0.004;
        el.style.visibility = on ? 'visible' : 'hidden';
        el.setAttribute('aria-hidden', on ? 'false' : 'true');
        if (on && !was) measure();
      }
      if (v <= 0.004) return;

      // Lift: the card starts at the anchor and settles into its dock.
      const e = v * v * (3 - 2 * v);
      const at = anchorAt(anchor);
      const { left, top, w, h } = box;
      const cx = left + w / 2;
      const cy = top + h / 2;
      const towards = at?.visible ? at : null;
      const dx = towards ? (towards.x - cx) * (1 - e) * 0.5 : 0;
      const dy = towards ? (towards.y - cy) * (1 - e) * 0.5 : (1 - e) * 22;
      setStyle(c, 'transform', `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${(0.9 + 0.1 * e).toFixed(3)})`);

      // Leader line from the card's edge to the pin.
      const pth = path.current;
      if (!pth) return;
      if (!towards) {
        setStyle(pth, 'opacity', '0');
        if (dot.current) setStyle(dot.current, 'opacity', '0');
        if (ring.current) setStyle(ring.current, 'opacity', '0');
        if (label.current) setStyle(label.current, 'opacity', '0');
        return;
      }
      // From the side facing the pin; from the top edge when the pin is above a
      // full-width card (phones).
      const overhead = towards.y < top - 12 && towards.x > left + 18 && towards.x < left + w - 18;
      const fromRight = towards.x > left + w / 2;
      let ex: number;
      let ey: number;
      let kx: number;
      let ky: number;
      if (overhead) {
        ex = clamp(towards.x, left + 18, left + w - 18);
        ey = top;
        kx = ex;
        ky = top - 22;
      } else {
        ex = fromRight ? left + w : left;
        ey = clamp(towards.y, top + 18, top + h - 18);
        kx = ex + (fromRight ? 22 : -22);
        ky = ey;
      }
      setAttr(pth, 'd', `M ${ex.toFixed(1)} ${ey.toFixed(1)} L ${kx.toFixed(1)} ${ky.toFixed(1)} L ${towards.x.toFixed(1)} ${towards.y.toFixed(1)}`);
      const len = Math.hypot(towards.x - kx, towards.y - ky) + Math.hypot(kx - ex, ky - ey);
      setStyle(pth, 'strokeDasharray', `${len.toFixed(0)}`);
      setStyle(pth, 'strokeDashoffset', `${(len * (1 - e)).toFixed(0)}`);
      setStyle(pth, 'opacity', String(v * 0.85));
      const px = towards.x.toFixed(1);
      const py = towards.y.toFixed(1);
      for (const n of [dot.current, ring.current]) {
        if (!n) continue;
        setAttr(n, 'cx', px);
        setAttr(n, 'cy', py);
        setStyle(n, 'opacity', String(v));
      }
      if (label.current) {
        setAttr(label.current, 'x', (towards.x + (fromRight ? 14 : -14)).toFixed(1));
        setAttr(label.current, 'y', (towards.y - 12).toFixed(1));
        setAttr(label.current, 'text-anchor', fromRight ? 'start' : 'end');
        setStyle(label.current, 'opacity', String(v * 0.9));
      }
    };
    measure();
    update();
    // Layout changes: the viewport, the card's own size (its text reflowing), the layer it docks in.
    const relayout = () => {
      measure();
      update();
    };
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(relayout);
    if (ro && card.current) ro.observe(card.current);
    if (ro && root.current) ro.observe(root.current);
    window.addEventListener('resize', relayout);
    const unsubscribe = onProjected(update);
    return () => {
      unsubscribe();
      ro?.disconnect();
      window.removeEventListener('resize', relayout);
    };
  }, [range, ramp, anchor, side]);

  return (
    <div ref={root} className={`plate ${className ?? ''}`} data-side={side} data-plate={id} style={{ ['--accent' as string]: accent ?? 'var(--bone)' }}>
      <div className="plate-scrim" aria-hidden="true" />
      <svg className="plate-leader" aria-hidden="true">
        <path ref={path} />
        <circle ref={ring} className="plate-ring" r="11" />
        <circle ref={dot} className="plate-dot" r="3" />
        {pin ? (
          <text ref={label} className="plate-pin">
            {pin}
          </text>
        ) : null}
      </svg>
      <div ref={card} className="plate-card">
        {children}
      </div>
    </div>
  );
}

export function PlateFacts({ facts }: { facts: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="plate-facts">
      {facts.map((f, i) => (
        <div key={`${i}-${f.label}`}>
          <dt>{f.label}</dt>
          <dd>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}
