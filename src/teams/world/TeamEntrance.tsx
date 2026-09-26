'use client';
/** Seven solid, bevelled letterforms. The central word space is a real passage,
 * not a mask: the same camera moves from their front faces to the world behind. */
import { ExtrudeGeometry, MeshStandardMaterial, Path, Shape, type Texture } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useDisposable } from '@/systems/performance/useDisposable';
import { ENTRY_Z, O } from '../layout';

type Point = [number, number];
const outlines: Record<string, Point[]> = {
  T: [[0,3.5],[2.4,3.5],[2.4,2.83],[1.55,2.83],[1.55,0],[0.85,0],[0.85,2.83],[0,2.83]],
  H: [[0,0],[0.7,0],[0.7,1.43],[1.7,1.43],[1.7,0],[2.4,0],[2.4,3.5],[1.7,3.5],[1.7,2.1],[0.7,2.1],[0.7,3.5],[0,3.5]],
  E: [[0,0],[2.4,0],[2.4,0.66],[0.7,0.66],[0.7,1.45],[2.1,1.45],[2.1,2.1],[0.7,2.1],[0.7,2.84],[2.4,2.84],[2.4,3.5],[0,3.5]],
  A: [[0,0],[0.76,0],[1.02,0.9],[2.02,0.9],[2.28,0],[3.04,0],[1.99,3.5],[1.05,3.5]],
  M: [[0,0],[0.7,0],[0.7,2.34],[1.43,0.98],[1.8,0.98],[2.54,2.34],[2.54,0],[3.24,0],[3.24,3.5],[2.49,3.5],[1.62,1.87],[0.75,3.5],[0,3.5]],
};

export function TeamEntrance({ env }: { env: Texture | null }) {
  const res = useDisposable(() => {
    const parts: ExtrudeGeometry[] = [];
    // Word space centred on x=0. The camera passes with ~0.5 m clearance.
    for (const [word, start] of [['THE', -8.5], ['TEAM', 0.55]] as const) {
      let x = start;
      for (const ch of word) {
        const outline = outlines[ch];
        const shape = new Shape();
        outline.forEach(([px, py], i) => i ? shape.lineTo(px, py) : shape.moveTo(px, py));
        shape.closePath();
        if (ch === 'A') {
          const hole = new Path();
          hole.moveTo(1.18, 1.55); hole.lineTo(1.52, 2.77); hole.lineTo(1.86, 1.55); hole.closePath();
          shape.holes.push(hole);
        }
        const geo = new ExtrudeGeometry(shape, { depth: 1.65, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 2, curveSegments: 1 });
        geo.translate(x, -1.45, 0);
        parts.push(geo);
        x += Math.max(...outline.map(([px]) => px)) + 0.37;
      }
    }
    const geometry = mergeGeometries(parts)!;
    parts.forEach((g) => g.dispose());
    const material = new MeshStandardMaterial({ color: '#d6d1c5', roughness: 0.32, metalness: 0.38, envMap: env, envMapIntensity: 0.85 });
    return { geometry, material };
  }, [env]);
  return <mesh name="the-team-architecture" position={[O.x, O.y + 0.3, O.z + ENTRY_Z]} geometry={res.geometry} material={res.material} />;
}
