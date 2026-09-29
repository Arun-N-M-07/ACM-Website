'use client';
/**
 * Screen-space effects: canvas blur (CSS filter), vignette and
 * fades for cuts, plus a fine film grain. Values come from the camera system
 * (systems/camera/effects) and are applied once per rendered frame.
 *
 * And the opening's mist (fx.mist, set by JourneyLoop): the atmosphere the
 * journey begins in, over the world — never the interface — as the world is
 * swallowed by it at the end, and as the opening emerges from it again. It is
 * the same layer over every world (the Teams world and the opening render
 * through different passes), so where the two ends of the journey meet there
 * is no seam. Its tones are the opening's own first frame's (upper mist, the
 * darker road below); over them, two slow layers of cloud, denser here and
 * thinner there, so the world goes into it unevenly, as into weather.
 */
import { useEffect, useRef } from 'react';
import { fx } from '@/systems/camera/effects';
import { useProgressFrame } from './useProgressFrame';

/** A soft cloud texture (tileable value-noise fbm, white with alpha), made once. */
function cloudTexture(seed: number) {
  const N = 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  if (!g) return '';
  const hash = (x: number, y: number, s: number) => {
    const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const noise = (x: number, y: number, period: number, s: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const at = (i: number, j: number) => hash(((i % period) + period) % period, ((j % period) + period) % period, s);
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * u;
    const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * u;
    return a + (b - a) * v;
  };
  const img = g.createImageData(N, N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let f = 0;
      let amp = 0.55;
      for (let o = 0, period = 4; o < 5; o++, period *= 2, amp *= 0.5) f += amp * noise((x / N) * period, (y / N) * period, period, seed + o);
      const d = Math.min(1, Math.max(0, (f - 0.32) / 0.5));
      const i = (y * N + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(255 * d * d * (3 - 2 * d));
    }
  g.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

export function ScreenFx() {
  const vignette = useRef<HTMLDivElement>(null);
  const fade = useRef<HTMLDivElement>(null);
  const flash = useRef<HTMLDivElement>(null);
  const mist = useRef<HTMLDivElement>(null);
  const mistBase = useRef<HTMLDivElement>(null);
  const mistA = useRef<HTMLDivElement>(null);
  const mistB = useRef<HTMLDivElement>(null);
  const last = useRef({ blur: -1, mist: -1, vignette: '', fade: '', flash: '' });
  const canvasEl = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (mistA.current) mistA.current.style.backgroundImage = `url(${cloudTexture(3)})`;
    if (mistB.current) mistB.current.style.backgroundImage = `url(${cloudTexture(11)})`;
  }, []);

  useProgressFrame(() => {
    // (Found once, and again only if the canvas is replaced; styles are written only when they change —
    // an unchanged write still costs the page a style pass every frame.)
    if (!canvasEl.current?.isConnected) canvasEl.current = document.querySelector<HTMLCanvasElement>('.experience-canvas canvas');
    const canvas = canvasEl.current;
    const was = last.current;
    const blur = Math.round(fx.blur * 10) / 10;
    if (canvas && blur !== was.blur) {
      canvas.style.filter = blur > 0.05 ? `blur(${blur}px)` : '';
      was.blur = blur;
    }
    const vig = String(0.55 + fx.vignette * 0.45);
    if (vignette.current && vig !== was.vignette) {
      vignette.current.style.opacity = vig;
      was.vignette = vig;
    }
    const fd = String(fx.fade);
    if (fade.current && fd !== was.fade) {
      fade.current.style.opacity = fd;
      was.fade = fd;
    }
    const fl = String(Math.round(fx.flash * 100) / 100);
    if (flash.current && fl !== was.flash) {
      flash.current.style.opacity = fl;
      was.flash = fl;
    }
    // The mist: the clouds come first, unevenly; the even body of the mist closes behind them.
    const m = Math.round(fx.mist * 1000) / 1000;
    // Deep in it, the interface recedes too (the journey's chrome changes where its two ends meet).
    // (…and as the world comes apart into tiles, ahead of it: experience/mosaic.)
    const deep = m > 0.8 || fx.mosaic > 0.45;
    if (deep !== (document.documentElement.dataset.mist === 'deep')) {
      if (deep) document.documentElement.dataset.mist = 'deep';
      else delete document.documentElement.dataset.mist;
    }
    const el = mist.current;
    if (el && (m > 0 || last.current.mist !== 0)) {
      el.style.visibility = m > 0 ? 'visible' : 'hidden';
      if (mistBase.current) mistBase.current.style.opacity = String(Math.min(1, Math.max(0, (m - 0.35) / 0.65)) ** 1.4);
      const clouds = Math.min(1, m * 1.7);
      // (They drift on their own — the air is alive when the scroll stops — and rise with the mist.)
      const s = performance.now() / 1000;
      if (mistA.current) {
        mistA.current.style.opacity = String(clouds);
        mistA.current.style.transform = `translate3d(${(-s * 1.1) % 100}vw, ${-m * 6}vh, 0) scale(1.15)`;
      }
      if (mistB.current) {
        mistB.current.style.opacity = String(clouds * 0.8);
        mistB.current.style.transform = `translate3d(${(s * 0.7) % 100}vw, ${-m * 11}vh, 0) scale(1.4)`;
      }
      last.current.mist = m;
    }
  });

  return (
    <>
      <div className="fx-mist" ref={mist} aria-hidden="true">
        <div className="fx-mist-base" ref={mistBase} />
        <div className="fx-mist-cloud" ref={mistA} />
        <div className="fx-mist-cloud fx-mist-cloud-b" ref={mistB} />
      </div>
      <div className="fx-vignette" ref={vignette} aria-hidden="true" />
      <div className="fx-grain" aria-hidden="true" />
      <div className="fx-fade" ref={fade} aria-hidden="true" />
      <div className="fx-flash" ref={flash} aria-hidden="true" />
    </>
  );
}
