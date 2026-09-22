'use client';
/**
 * One event room: a walk-in installation. You step through an open portal and
 * the room surrounds you — its back and side walls are one wraparound
 * projection, and a centrepiece performs the event in sync, driven by how far
 * through the visit you've scrolled (so it all rewinds if you scroll back).
 *
 * Generated entirely from the RoomLayout and the EventRecord; which
 * installation a room gets is its event's `artifact` (see exhibits/index.ts).
 *
 * Local frame: origin at the centre of the room floor, the portal faces local
 * +z (toward the corridor), local x runs along the corridor.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, CanvasTexture, Color, CylinderGeometry, DoubleSide, MeshBasicMaterial, PlaneGeometry } from 'three';
import { UNDERGROUND, type RoomLayout } from '@/config/world';
import { merge, metricBox, place } from '@/systems/geometry/build';
import { useLightAnchor } from '@/systems/lighting/lightPool';
import { useDisposable } from '@/systems/performance/useDisposable';
import { fitSize, text } from '@/systems/textures/typeset';
import { CanvasPanel } from '../shared/CanvasPanel';
import { useKit } from '../underground/kit';
import { pad2, sstep, useRoomClock, type Wall, type WallInfo } from './exhibits/common';
import { EXHIBITS } from './exhibits';

interface Props {
  layout: RoomLayout;
  total: number;
  active: boolean;
}

/** Map a room-local point to world space. */
function toWorld(layout: RoomLayout, rotY: number, lx: number, ly: number, lz: number): [number, number, number] {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  return [layout.center[0] + lx * c + lz * s, layout.center[1] + ly, layout.center[2] - lx * s + lz * c];
}

/**
 * A soft spot on the centrepiece: a faint cone of light from the ceiling and a
 * warm pool on the floor.
 */
function ExhibitLight({ accent, height, level }: { accent: string; height: number; level: { current: number } }) {
  const res = useDisposable(() => {
    const cone = new CylinderGeometry(0.3, 2.2, height, 40, 1, true);
    cone.translate(0, height / 2, 0);
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,240,215,1)');
    grad.addColorStop(0.55, 'rgba(255,225,185,0.4)');
    grad.addColorStop(1, 'rgba(255,225,185,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const poolMap = new CanvasTexture(c);
    const pool = new PlaneGeometry(5.4, 5.4);
    pool.rotateX(-Math.PI / 2);
    const tint = new Color('#ffe7c4').lerp(new Color(accent), 0.2);
    return {
      cone,
      pool,
      poolMap,
      coneMat: new MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.04, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, toneMapped: false }),
      poolMat: new MeshBasicMaterial({ map: poolMap, color: tint, transparent: true, opacity: 0.3, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
    };
  }, [height, accent]);
  useFrame(() => {
    res.coneMat.opacity = 0.045 * level.current;
    res.poolMat.opacity = 0.32 * level.current;
  });
  return (
    <group position={[0, 0, -0.9]}>
      <mesh geometry={res.cone} material={res.coneMat} renderOrder={4} />
      <mesh geometry={res.pool} material={res.poolMat} position={[0, 0.015, 0]} renderOrder={2} />
    </group>
  );
}

export function EventRoom({ layout, total }: Props) {
  const kit = useKit();
  const { event, length: W, depth: D, height: H } = layout;
  const rotY = layout.side === -1 ? Math.PI / 2 : -Math.PI / 2;
  const exhibit = EXHIBITS[event.artifact];
  const { Piece } = exhibit;
  const clock = useRoomClock(layout.index);
  const info = useMemo<WallInfo>(() => ({ ev: event, index: layout.index, total }), [event, layout.index, total]);
  const header = UNDERGROUND.corridor.height - H;

  const geo = useDisposable(() => {
    const t = 0.35;
    const shell = merge([
      place(metricBox(W + 2 * t, H, t), { position: [0, H / 2, -D / 2 - t / 2] }),
      place(metricBox(t, H, D), { position: [-W / 2 - t / 2, H / 2, 0] }),
      place(metricBox(t, H, D), { position: [W / 2 + t / 2, H / 2, 0] }),
      // Header down from the corridor ceiling to the (lower) room ceiling.
      ...(header > 0.05 ? [place(metricBox(W + 2 * t, header, t), { position: [0, H + header / 2, D / 2 + t / 2] })] : []),
    ]);
    const floor = place(metricBox(W, 0.2, D), { position: [0, -0.1, 0] });
    const ceiling = place(metricBox(W + 2 * t, 0.3, D + t), { position: [0, H + 0.15, -t / 2] });
    // The portal: a lit frame around the opening, and a threshold line.
    const portal = merge([
      place(metricBox(W, 0.06, 0.06), { position: [0, H - 0.03, D / 2] }),
      place(metricBox(0.06, H, 0.06), { position: [-W / 2 + 0.03, H / 2, D / 2] }),
      place(metricBox(0.06, H, 0.06), { position: [W / 2 - 0.03, H / 2, D / 2] }),
      place(metricBox(W, 0.012, 0.08), { position: [0, 0.006, D / 2 - 0.1] }),
    ]);
    const fixture = place(metricBox(W * 0.6, 0.04, 0.14), { position: [0, H - 0.03, -D * 0.1] });
    return { shell, floor, ceiling, portal, fixture };
  }, [W, D, H, header]);

  const accentMat = useDisposable(() => new MeshBasicMaterial({ color: new Color(event.accent).multiplyScalar(1.5), toneMapped: false }), [event.accent]);

  // Light: brightens while you're inside; a room that "boots" stays dark until it does.
  const anchorPos = useMemo(() => toWorld(layout, rotY, 0, H - 0.7, -D * 0.1), [layout, rotY, H, D]);
  const anchor = useLightAnchor(anchorPos, event.flagship ? '#ffd2a2' : '#ffdcb4', event.flagship ? 95 : 65, event.flagship ? 20 : 15);
  const level = useRef(0.5);
  useFrame((_, dt) => {
    const c = clock.current;
    let target = c.here ? 1.3 : c.near ? 0.7 : 0.45;
    if (exhibit.darkUntil !== undefined) target *= 0.12 + 0.88 * sstep(c.u, 0.04, exhibit.darkUntil);
    level.current += (target - level.current) * (1 - Math.exp(-dt * 4));
    anchor.gain = level.current;
  });

  // The three projection walls. They redraw while the room is near; otherwise they hold a frame.
  const walls = useMemo(() => {
    const flag = !!event.flagship;
    return [
      { wall: 'back' as Wall, width: W - 0.3, height: H - 0.2, position: [0, H / 2, -D / 2 + 0.03] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], ppm: flag ? 92 : 112 },
      { wall: 'left' as Wall, width: D - 0.3, height: H - 0.2, position: [-W / 2 + 0.03, H / 2, 0] as [number, number, number], rotation: [0, Math.PI / 2, 0] as [number, number, number], ppm: flag ? 76 : 88 },
      { wall: 'right' as Wall, width: D - 0.3, height: H - 0.2, position: [W / 2 - 0.03, H / 2, 0] as [number, number, number], rotation: [0, -Math.PI / 2, 0] as [number, number, number], ppm: flag ? 76 : 88 },
    ];
  }, [W, D, H, event.flagship]);

  return (
    <group position={layout.center} rotation={[0, rotY, 0]} name={`room-${event.slug}`}>
      <mesh geometry={geo.shell} material={kit.concreteDark} />
      <mesh geometry={geo.floor} material={kit.floor} />
      <mesh geometry={geo.ceiling} material={kit.ceiling} />
      <mesh geometry={geo.portal} material={accentMat} />
      <mesh geometry={geo.fixture} material={kit.lightWarm} />

      {walls.map((wl) => (
        <CanvasPanel
          key={wl.wall}
          width={wl.width}
          height={wl.height}
          pxPerMeter={wl.ppm}
          position={wl.position}
          rotation={wl.rotation}
          shading="glow"
          glowStrength={0.92}
          drawKey={`${event.slug}-${wl.wall}`}
          draw={(ctx, w, h) => exhibit.walls(ctx, w, h, wl.wall, -0.3, 0, info)}
          animate={(() => {
            let lastU = NaN;
            return (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
              const c = clock.current;
              // Far away: hold whatever frame matches where the visit stands.
              if (!c.near && c.u === lastU) return false;
              lastU = c.u;
              exhibit.walls(ctx, w, h, wl.wall, c.u, t, info);
              return true;
            };
          })()}
          animateEvery={wl.wall === 'back' ? 1 / 14 : 1 / 9}
        />
      ))}

      {/* Over the portal, facing the corridor: what's inside. */}
      {header > 0.2 && (
        <CanvasPanel
          width={W - 0.4}
          height={header - 0.08}
          pxPerMeter={200}
          position={[0, H + header / 2, D / 2 + 0.36]}
          shading="glow"
          glowStrength={0.95}
          transparent
          drawKey={`lintel-${event.slug}`}
          draw={(ctx, w, h) => {
            ctx.fillStyle = event.accent;
            ctx.fillRect(0, h * 0.2, h * 0.08, h * 0.6);
            text(ctx, pad2(layout.index + 1), h * 0.3, h * 0.72, { family: 'mono', weight: 500, size: h * 0.5, color: 'rgba(239,233,223,0.7)' });
            const s = fitSize(ctx, event.title, w * 0.6, { family: 'serif', size: h * 0.7 }, h * 0.7);
            text(ctx, event.title, h * 1.5, h * 0.74, { family: 'serif', size: s, color: '#efe9df' });
            text(ctx, event.kind.toUpperCase(), w - h * 0.2, h * 0.66, { family: 'mono', size: h * 0.26, color: event.accent, align: 'right', tracking: 0.2 });
          }}
        />
      )}

      <ExhibitLight accent={event.accent} height={H} level={level} />
      <Piece event={event} width={W} depth={D} height={H} clock={clock} />
    </group>
  );
}
