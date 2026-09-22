'use client';
/**
 * Screen-space effects: impact blur (CSS filter on the canvas), vignette and
 * fades for cuts, plus a fine film grain. Values come from the camera system
 * (systems/camera/effects) and are applied once per rendered frame.
 */
import { useRef } from 'react';
import { fx } from '@/systems/camera/effects';
import { useProgressFrame } from './useProgressFrame';

export function ScreenFx() {
  const vignette = useRef<HTMLDivElement>(null);
  const fade = useRef<HTMLDivElement>(null);
  const flash = useRef<HTMLDivElement>(null);
  const last = useRef({ blur: -1 });

  useProgressFrame(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.experience-canvas canvas');
    const blur = Math.round(fx.blur * 10) / 10;
    if (canvas && blur !== last.current.blur) {
      canvas.style.filter = blur > 0.05 ? `blur(${blur}px)` : '';
      last.current.blur = blur;
    }
    if (vignette.current) vignette.current.style.opacity = String(0.55 + fx.vignette * 0.45);
    if (fade.current) fade.current.style.opacity = String(fx.fade);
    if (flash.current) flash.current.style.opacity = String(Math.round(fx.flash * 100) / 100);
  });

  return (
    <>
      <div className="fx-vignette" ref={vignette} aria-hidden="true" />
      <div className="fx-grain" aria-hidden="true" />
      <div className="fx-fade" ref={fade} aria-hidden="true" />
      <div className="fx-flash" ref={flash} aria-hidden="true" />
    </>
  );
}
