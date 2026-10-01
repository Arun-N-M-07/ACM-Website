'use client';
/**
 * One event room: a walk-in installation. You step through an open portal and
 * the room surrounds you — its back and side walls are one wraparound
 * projection, and a centrepiece performs the event in sync, driven by how far
 * through the visit you've scrolled (so it all rewinds if you scroll back).
 *
 * Generated entirely from the RoomLayout and the EventRecord; which
 * installation a room gets is its event's `artifact` (see exhibits/index.ts).
 * It stands in its bay of the Events matrix (EventsHall) at the bay's scale —
 * built as ever at full size, and scaled as a whole, so it is the same room
 * the camera goes into.
 *
 * Local frame: origin at the centre of the room floor, the portal faces local
 * +z (out of the matrix), local x runs along the opening.
 */
import { useFrame } from '@react-three/fiber';
import { memo, useMemo, useRef } from 'react';
import { AdditiveBlending, CanvasTexture, Color, CylinderGeometry, DoubleSide, type Group, MeshBasicMaterial, PlaneGeometry } from 'three';
import { type RoomLayout } from '@/config/world';
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
      // (Additive and not writing depth, its two faces add up the same in either order: one pass.)
      coneMat: new MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.04, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, toneMapped: false, forceSinglePass: true }),
      poolMat: new MeshBasicMaterial({ map: poolMap, color: tint, transparent: true, opacity: 0.3, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
    };
  }, [height, accent]);
  useFrame(() => {
    res.coneMat.opacity = 0.018 * level.current;
    res.poolMat.opacity = 0.32 * level.current;
  });
  return (
    <group position={[0, 0, -0.9]}>
      <mesh geometry={res.cone} material={res.coneMat} renderOrder={4} />
      <mesh geometry={res.pool} material={res.poolMat} position={[0, 0.015, 0]} renderOrder={2} />
    </group>
  );
}

/**
 * (Its props are the matrix's fixed layout: re-rendering the hall needn't re-render a room. Its light
 * follows it wherever its column of the matrix stands — EventsHall moves them as the matrix opens.)
 */
export const EventRoom = memo(function EventRoom({ layout, total }: Props) {
  const kit = useKit();
  const { event, length: W, depth: D, height: H } = layout;
  const exhibit = EXHIBITS[event.artifact];
  const { Piece } = exhibit;
  const clock = useRoomClock(layout.index);
  const info = useMemo<WallInfo>(() => ({ ev: event, index: layout.index, total }), [event, layout.index, total]);
  // From the room's own ceiling up to the corridor's over its opening.
  const header = layout.ceiling - H;

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
  const signalBlue = useMemo(() => new Color('#83bbff'), []);
  const roomColor = useMemo(() => new Color(event.accent), [event.accent]);

  // Light: brightens while you're inside; a room that "boots" stays dark until it does. (At the
  // room's scale: the reach with it, the intensity as its square — the room lit as it was built. It
  // waits out of reach unless this is the room being visited, so the few pooled lights stay with the
  // hall and the matrix — systems/lighting.)
  const k = layout.scale;
  const anchor = useLightAnchor([layout.center[0], layout.center[1] + (H - 0.7) * k, layout.center[2] - D * 0.1 * k], event.flagship ? '#ffd2a2' : '#ffdcb4', (event.flagship ? 95 : 65) * k * k, (event.flagship ? 20 : 15) * k);
  const group = useRef<Group>(null);
  const level = useRef(0.5);
  const response = useRef(1);
  useFrame((_, dt) => {
    const c = clock.current;
    // (Pointed at in the matrix, across the hall, it asks the pool for a light of its own.)
    if (group.current) {
      group.current.updateWorldMatrix(true, false);
      anchor.position.set(0, H - 0.7, -D * 0.1).applyMatrix4(group.current.matrixWorld);
    }
    // A retired pooled light must stay at its physical fixture while fading, not teleport 10km
    // away. Inactive rooms have no gain and don't compete for slots. Priority/light level follow
    // continuous presence instead of abruptly switching from "hover" to "here" at selection.
    // Physical distance, not hover/entry progress, decides which fixture is
    // closest. A priority boost swapped hall lighting for a tiny room light
    // while the camera was still looking at the entire shelf.
    anchor.priority = 1;
    // The shared blue signal takes on this installation's colour as it performs.
    accentMat.color.copy(signalBlue).lerp(roomColor, sstep(c.u, 0, .85)).multiplyScalar(1.25);
    let target = (0.45 + 0.85 * c.presence) * response.current;
    if (exhibit.darkUntil !== undefined) target *= 0.12 + 0.88 * sstep(c.u, 0.04, exhibit.darkUntil);
    level.current += (target - level.current) * (1 - Math.exp(-dt * 4));
    anchor.gain = c.near ? level.current : 0;
  });

  // The three projection walls.
  const walls = useMemo(() => {
    const flag = !!event.flagship;
    return [
      { wall: 'back' as Wall, width: W - 0.3, height: H - 0.2, position: [0, H / 2, -D / 2 + 0.03] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], ppm: flag ? 92 : 112 },
      { wall: 'left' as Wall, width: D - 0.3, height: H - 0.2, position: [-W / 2 + 0.03, H / 2, 0] as [number, number, number], rotation: [0, Math.PI / 2, 0] as [number, number, number], ppm: flag ? 76 : 88 },
      { wall: 'right' as Wall, width: D - 0.3, height: H - 0.2, position: [W / 2 - 0.03, H / 2, 0] as [number, number, number], rotation: [0, -Math.PI / 2, 0] as [number, number, number], ppm: flag ? 76 : 88 },
    ];
  }, [W, D, H, event.flagship]);
  // Each redraws when what it's drawn from moves — the visit, its canvas, the window's width (a back
  // wall keeps clear of the reading card) — and a wall that plays on time (exhibit.timeWalls) goes on
  // redrawing while the room is near; otherwise it holds its frame. Made once, so re-rendering the
  // room forces no redraw.
  const animates = useMemo(
    () =>
      walls.map((wl) => {
        const live = !!exhibit.timeWalls?.includes(wl.wall);
        let lastU = NaN;
        let lastW = NaN;
        let lastCtx: CanvasRenderingContext2D | null = null;
        return (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
          const c = clock.current;
          const vw = window.innerWidth;
          // Nothing it's drawn from has moved: hold the frame (far away, the one matching where the visit stands).
          if (c.u === lastU && vw === lastW && ctx === lastCtx && !(live && c.near)) return false;
          lastU = c.u;
          lastW = vw;
          lastCtx = ctx;
          exhibit.walls(ctx, w, h, wl.wall, c.u, t, info);
          return true;
        };
      }),
    [walls, exhibit, info, clock],
  );

  return (
    <group ref={group} position={layout.center} scale={layout.scale} name={`room-${event.slug}`}>
      <mesh geometry={geo.shell} material={kit.concreteDark} />
      <mesh geometry={geo.floor} material={kit.floor} />
      <mesh geometry={geo.ceiling} material={kit.ceiling} />
      <mesh geometry={geo.portal} material={accentMat} />
      <mesh geometry={geo.fixture} material={kit.lightWarm} />

      {walls.map((wl, i) => (
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
          animate={animates[i]}
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
      <Piece event={event} index={layout.index} width={W} depth={D} height={H} clock={clock} response={response} />
    </group>
  );
});
