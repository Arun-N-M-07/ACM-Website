'use client';
/**
 * Reusable furniture and objects for the facility. Each prop merges its parts
 * per material (1–3 draw calls). Geometry is cached by dimensions so identical
 * props share buffers.
 */
import { useEffect, useMemo, type ReactNode } from 'react';
import { type BufferGeometry, CylinderGeometry } from 'three';
import { merge, metricBox, place } from '@/systems/geometry/build';
import { text } from '@/systems/textures/typeset';
import { useKit } from '../underground/kit';
import { CanvasPanel, type DrawFn } from './CanvasPanel';

type V3 = [number, number, number];

const cache = new Map<string, { geo: BufferGeometry; users: number }>();

/**
 * Shared geometry cache with reference counting (disposed when the last user unmounts).
 *
 * A user is counted when its effect runs, against the geometry it actually renders. An effect can
 * be cleaned up and run again while the component stays mounted (React's strict mode does exactly
 * that; so does Fast Refresh): the cleanup may have disposed the entry and removed it, so the
 * re-run puts the geometry it holds back in the cache — otherwise the component would go on
 * drawing a geometry the cache no longer knew about, and it would never be disposed (a leak each
 * time the room streamed in). A geometry that lost the race to another instance is its holder's
 * alone, and is disposed with it.
 */
export function useCachedGeometry(key: string, build: () => BufferGeometry) {
  const geo = useMemo(() => {
    let entry = cache.get(key);
    if (!entry) {
      entry = { geo: build(), users: 0 };
      cache.set(key, entry);
    }
    return entry.geo;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    let entry = cache.get(key);
    if (!entry) {
      entry = { geo, users: 0 };
      cache.set(key, entry);
    }
    const shared = entry.geo === geo;
    if (shared) entry.users++;
    return () => {
      const e = cache.get(key);
      if (!shared || !e || e.geo !== geo) {
        geo.dispose();
        return;
      }
      e.users--;
      if (e.users <= 0) {
        e.geo.dispose();
        cache.delete(key);
      }
    };
  }, [key, geo]);
  return geo;
}

interface Placed {
  position?: V3;
  rotation?: V3;
}

export function Desk({ width = 1.6, depth = 0.8, height = 0.74, position, rotation, children }: Placed & { width?: number; depth?: number; height?: number; children?: ReactNode }) {
  const kit = useKit();
  const top = useCachedGeometry(`desk-top-${width}-${depth}-${height}`, () => place(metricBox(width, 0.04, depth), { position: [0, height - 0.02, 0] }));
  const legs = useCachedGeometry(`desk-legs-${width}-${depth}-${height}`, () =>
    merge(
      [-1, 1].flatMap((sx) => [
        place(metricBox(0.05, height - 0.04, 0.05), { position: [sx * (width / 2 - 0.06), (height - 0.04) / 2, depth / 2 - 0.06] }),
        place(metricBox(0.05, height - 0.04, 0.05), { position: [sx * (width / 2 - 0.06), (height - 0.04) / 2, -depth / 2 + 0.06] }),
        place(metricBox(0.05, 0.05, depth - 0.1), { position: [sx * (width / 2 - 0.06), height - 0.1, 0] }),
      ]),
    ),
  );
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={top} material={kit.oak} />
      <mesh geometry={legs} material={kit.steel} />
      {children}
    </group>
  );
}

export function Chair({ position, rotation }: Placed) {
  const kit = useKit();
  const fabric = useCachedGeometry('chair-fabric', () =>
    merge([place(metricBox(0.46, 0.08, 0.44), { position: [0, 0.46, 0] }), place(metricBox(0.44, 0.5, 0.06), { position: [0, 0.78, -0.2], rotation: [-0.12, 0, 0] })]),
  );
  const frame = useCachedGeometry('chair-frame', () =>
    merge([
      place(new CylinderGeometry(0.03, 0.03, 0.4, 8), { position: [0, 0.22, 0] }),
      place(metricBox(0.56, 0.03, 0.06), { position: [0, 0.03, 0] }),
      place(metricBox(0.06, 0.03, 0.56), { position: [0, 0.03, 0] }),
    ]),
  );
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={fabric} material={kit.fabric} />
      <mesh geometry={frame} material={kit.steel} />
    </group>
  );
}

export function Monitor({ position, rotation, draw, drawKey, animate, width = 0.62, height = 0.36 }: Placed & { draw?: DrawFn; drawKey?: string; animate?: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => boolean; width?: number; height?: number }) {
  const kit = useKit();
  const body = useCachedGeometry(`monitor-${width}-${height}`, () =>
    merge([
      place(metricBox(width + 0.03, height + 0.03, 0.03), { position: [0, 0.14 + height / 2, 0] }),
      place(metricBox(0.05, 0.14, 0.04), { position: [0, 0.08, -0.03] }),
      place(metricBox(0.22, 0.015, 0.16), { position: [0, 0.008, -0.02] }),
    ]),
  );
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={body} material={kit.black} />
      {draw ? (
        <CanvasPanel width={width} height={height} pxPerMeter={420} position={[0, 0.14 + height / 2, 0.017]} draw={draw} drawKey={drawKey} shading="glow" glowStrength={0.9} animate={animate} animateEvery={0.25} />
      ) : null}
    </group>
  );
}

export function Laptop({ position, rotation, draw, drawKey, animate }: Placed & { draw?: DrawFn; drawKey?: string; animate?: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => boolean }) {
  const kit = useKit();
  const body = useCachedGeometry('laptop', () =>
    merge([place(metricBox(0.34, 0.015, 0.23), { position: [0, 0.008, 0] }), place(metricBox(0.34, 0.22, 0.01), { position: [0, 0.115, -0.13], rotation: [-0.25, 0, 0] })]),
  );
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={body} material={kit.steelLight} />
      {draw ? (
        <group position={[0, 0.115, -0.123]} rotation={[-0.25, 0, 0]}>
          <CanvasPanel width={0.31} height={0.19} pxPerMeter={520} draw={draw} drawKey={drawKey} shading="glow" glowStrength={0.9} animate={animate} animateEvery={0.3} />
        </group>
      ) : null}
    </group>
  );
}

export function Plinth({ w = 1.2, h = 0.9, d = 1.2, position, rotation, children }: Placed & { w?: number; h?: number; d?: number; children?: ReactNode }) {
  const kit = useKit();
  const geo = useCachedGeometry(`plinth-${w}-${h}-${d}`, () => place(metricBox(w, h, d), { position: [0, h / 2, 0] }));
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={geo} material={kit.concrete} />
      <group position={[0, h, 0]}>{children}</group>
    </group>
  );
}

/** A small typeset label (engraved plate / sign). */
export function Label({
  value,
  sub,
  width = 1.2,
  height = 0.3,
  position,
  rotation,
  color = '#efe9df',
  background,
  align = 'left',
}: Placed & { value: string; sub?: string; width?: number; height?: number; color?: string; background?: string; align?: 'left' | 'center' }) {
  return (
    <CanvasPanel
      width={width}
      height={height}
      pxPerMeter={360}
      position={position}
      rotation={rotation}
      shading="glow"
      glowStrength={0.85}
      transparent={!background}
      drawKey={`${value}|${sub}|${color}|${background}`}
      draw={(ctx, w, h) => {
        if (background) {
          ctx.fillStyle = background;
          ctx.fillRect(0, 0, w, h);
        }
        const x = align === 'center' ? w / 2 : h * 0.18;
        text(ctx, value, x, sub ? h * 0.5 : h * 0.66, { family: 'mono', size: h * (sub ? 0.3 : 0.42), color, tracking: 0.14, align });
        if (sub) text(ctx, sub, x, h * 0.84, { family: 'mono', size: h * 0.2, color: 'rgba(239,233,223,0.55)', tracking: 0.14, align });
      }}
    />
  );
}
