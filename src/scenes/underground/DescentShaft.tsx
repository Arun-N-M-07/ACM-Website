'use client';
/**
 * The light-well shaft from the garden plaza down to the facility hall: a
 * concrete tube with ring lights every few metres (they stream past the lens
 * and sell the speed of the drop) and painted depth markers.
 */
import { useMemo } from 'react';
import { type BufferGeometry, Color, CylinderGeometry, MeshBasicMaterial, TorusGeometry } from 'three';
import { CAMPUS, FLOOR_Y, UNDERGROUND } from '@/config/world';
import { merge, place } from '@/systems/geometry/build';
import { useDisposable } from '@/systems/performance/useDisposable';
import { text } from '@/systems/textures/typeset';
import { CanvasPanel } from '../shared/CanvasPanel';
import { useKit } from './kit';

const W = CAMPUS.well;
const R = W.r + 0.2;
const TOP = -0.2;
const BOTTOM = FLOOR_Y + UNDERGROUND.hall.height;
const DEPTH = TOP - BOTTOM;
const RING_STEP = 4.5;

/** Flip a geometry so its faces point inward (we look at the tube from inside). */
function insideOut<T extends BufferGeometry>(g: T): T {
  const idx = g.getIndex();
  if (idx) {
    const a = idx.array as Uint16Array | Uint32Array;
    for (let i = 0; i < a.length; i += 3) {
      const t = a[i];
      a[i] = a[i + 2];
      a[i + 2] = t;
    }
    idx.needsUpdate = true;
  }
  const n = g.getAttribute('normal');
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  n.needsUpdate = true;
  return g;
}

export function DescentShaft() {
  const kit = useKit();
  const geo = useDisposable(() => {
    const tube = insideOut(new CylinderGeometry(R, R, DEPTH, 48, 1, true));
    // Metric UVs: u around the circumference, v down the shaft.
    const uv = tube.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * R, uv.getY(i) * DEPTH);
    tube.translate(W.x, BOTTOM + DEPTH / 2, W.z);
    const rings: BufferGeometry[] = [];
    for (let y = TOP - 3; y > BOTTOM + 1; y -= RING_STEP) {
      rings.push(place(new TorusGeometry(R - 0.04, 0.02, 5, 72), { position: [W.x, y, W.z], rotation: [Math.PI / 2, 0, 0], scale: [1, 1, 0.6] }));
    }
    return { tube, rings: merge(rings) };
  }, []);
  // Recessed strip lights: present, not glaring, as they stream past.
  const ringMat = useDisposable(() => new MeshBasicMaterial({ color: new Color('#d8e2f4').multiplyScalar(0.8) }), []);

  // Depth markers on four sides of the tube.
  const markers = useMemo(
    () =>
      [0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        return {
          position: [W.x + Math.sin(a) * (R - 0.03), BOTTOM + DEPTH / 2, W.z + Math.cos(a) * (R - 0.03)] as [number, number, number],
          rotation: [0, a + Math.PI, 0] as [number, number, number],
        };
      }),
    [],
  );

  const drawMarkers = (ctx: CanvasRenderingContext2D, w: number, hpx: number) => {
    const pxPerM = hpx / DEPTH;
    for (let d = 10; d < DEPTH; d += 10) {
      const y = d * pxPerM;
      ctx.fillStyle = 'rgba(239,233,223,0.8)';
      ctx.fillRect(w * 0.08, y - 1, w * 0.3, Math.max(2, pxPerM * 0.04));
      text(ctx, `−${String(d).padStart(2, '0')} M`, w * 0.08, y - pxPerM * 0.18, { family: 'mono', size: pxPerM * 0.5, color: 'rgba(239,233,223,0.75)', tracking: 0.06 });
    }
  };

  return (
    <group name="descent-shaft">
      <mesh geometry={geo.tube} material={kit.concreteDark} />
      <mesh geometry={geo.rings} material={ringMat} />
      {markers.map((f, i) => (
        <CanvasPanel
          key={i}
          width={1.6}
          height={DEPTH}
          pxPerMeter={40}
          position={f.position}
          rotation={f.rotation}
          draw={drawMarkers}
          drawKey="markers"
          shading="glow"
          glowStrength={0.9}
          transparent
        />
      ))}
    </group>
  );
}
