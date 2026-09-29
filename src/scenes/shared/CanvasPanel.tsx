'use client';
/**
 * A flat panel whose texture is drawn with Canvas 2D — every sign, poster,
 * wall graphic and screen in the world is one of these. The texture is sized
 * from the panel's physical size × pixels-per-metre × the device quality scale,
 * and is disposed with the panel.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { Color, type CanvasTexture, type Mesh, MeshBasicMaterial, MeshStandardMaterial, type Object3D } from 'three';
import { QUALITY } from '@/config/quality';
import { experience, useExperience } from '@/store/experience';
import { fx } from '@/systems/camera/effects';
import { makeCanvas, toTexture } from '@/systems/textures/typeset';

export type DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number) => void | Promise<void>;

/** Whether an object is shown: it and everything it hangs from are visible. */
function shown(o: Object3D | null) {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
}

/**
 * First draws of panels made once the journey is running — the Events' rooms, streamed in ahead of
 * the camera — are queued and done a few milliseconds' worth a frame, each with its texture's upload,
 * instead of all in the one commit that builds a room (the frame that dropped as the corridor was
 * walked). A queued panel is hidden until it is drawn, never shown blank; under a jump's fade (a room
 * built where the camera is about to be) everything queued is drawn at once. Panels made while the
 * world loads draw at once, as they always did, so the warm-up uploads them finished.
 */
type FirstDraw = { run: () => void; cancelled: boolean };
const firstDraws: FirstDraw[] = [];
const FIRST_DRAW_BUDGET_MS = 3;
let drainedAt = -1;
function drainFirstDraws(frame: number) {
  const all = fx.fade > 0.3;
  if (!all && drainedAt === frame) return;
  drainedAt = frame;
  const t0 = performance.now();
  while (firstDraws.length) {
    const job = firstDraws.shift()!;
    if (job.cancelled) continue;
    job.run();
    if (!all && performance.now() - t0 > FIRST_DRAW_BUDGET_MS) break;
  }
}

interface Props {
  width: number;
  height: number;
  draw: DrawFn;
  /** Redraw key: change it to regenerate the texture. */
  drawKey?: string | number;
  pxPerMeter?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** 'lit' reacts to scene lights with a readable emissive floor; 'glow' is self-lit (screens, signage). */
  shading?: 'lit' | 'glow';
  glowStrength?: number;
  transparent?: boolean;
  /** Called every frame with the canvas; return true when it changed (animated screens). */
  animate?: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => boolean;
  animateEvery?: number;
  children?: ReactNode;
  renderOrder?: number;
}

export function CanvasPanel({
  width,
  height,
  draw,
  drawKey,
  pxPerMeter = 256,
  position,
  rotation,
  shading = 'lit',
  glowStrength = 1,
  transparent = false,
  animate,
  animateEvery = 0.5,
  children,
  renderOrder,
}: Props) {
  const quality = useExperience((s) => s.quality);
  const scale = QUALITY[quality].textureScale;
  const pw = Math.min(2048, Math.round(width * pxPerMeter * scale));
  const ph = Math.min(2048, Math.round(height * pxPerMeter * scale));

  const { canvas, ctx, texture, material } = useMemo(() => {
    const { canvas, ctx } = makeCanvas(pw, ph);
    const texture = toTexture(canvas);
    const material =
      shading === 'glow'
        ? new MeshBasicMaterial({ map: texture, transparent, depthWrite: !transparent, color: new Color(1, 1, 1).multiplyScalar(glowStrength) })
        : new MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: new Color('#ffffff'), emissiveIntensity: 0.32 * glowStrength, roughness: 0.85, transparent, depthWrite: !transparent });
    return { canvas, ctx, texture, material };
  }, [pw, ph, shading, transparent, glowStrength]);

  useEffect(() => () => {
    texture.dispose();
    material.dispose();
  }, [texture, material]);

  const gl = useThree((s) => s.gl);
  const mesh = useRef<Mesh>(null);
  /** Which texture has had its first draw (a redraw of a drawn one — a new drawKey — is never deferred). */
  const drawnFor = useRef<CanvasTexture | null>(null);
  const pending = useRef(false);
  // (Hidden from the commit itself when its first draw will wait, so no frame can show it blank.)
  useLayoutEffect(() => {
    const ph = experience().phase;
    if (drawnFor.current !== texture && ph !== 'loading' && ph !== 'ready' && mesh.current) mesh.current.visible = false;
  }, [texture]);
  useEffect(() => {
    let cancelled = false;
    const paint = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const result = draw(ctx, canvas.width, canvas.height);
      texture.needsUpdate = true;
      drawnFor.current = texture;
      if (result && typeof (result as Promise<void>).then === 'function') {
        (result as Promise<void>).then(() => {
          if (!cancelled) texture.needsUpdate = true;
        });
      }
    };
    const ph = experience().phase;
    if (drawnFor.current === texture || ph === 'loading' || ph === 'ready') {
      paint();
      if (mesh.current) mesh.current.visible = true;
      return () => {
        cancelled = true;
      };
    }
    pending.current = true;
    if (mesh.current) mesh.current.visible = false;
    const job: FirstDraw = {
      cancelled: false,
      run: () => {
        paint();
        gl.initTexture(texture);
        pending.current = false;
        if (mesh.current) mesh.current.visible = true;
      },
    };
    firstDraws.push(job);
    return () => {
      cancelled = true;
      job.cancelled = true;
      if (pending.current && mesh.current) mesh.current.visible = true;
      pending.current = false;
    };
    // draw is intentionally keyed by drawKey to avoid redrawing on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, canvas, texture, drawKey, gl]);

  const acc = useRef(0);
  useFrame(({ clock }, dt) => {
    if (firstDraws.length) drainFirstDraws(clock.elapsedTime);
    if (!animate || pending.current) return;
    acc.current += dt;
    if (acc.current < animateEvery) return;
    // Hidden (it, or what it hangs in): nothing to draw for — it draws the frame it comes back.
    if (!shown(mesh.current)) return;
    acc.current = 0;
    if (animate(ctx, canvas.width, canvas.height, clock.elapsedTime)) (texture as CanvasTexture).needsUpdate = true;
  });

  return (
    <mesh ref={mesh} position={position} rotation={rotation} material={material} renderOrder={renderOrder}>
      <planeGeometry args={[width, height]} />
      {children}
    </mesh>
  );
}
