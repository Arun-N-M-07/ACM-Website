'use client';
/**
 * THE CREW — the entrance to the world, set as architecture.
 *
 * The site's own display face (letters.ts) extruded into solid slabs at the
 * scale of a building. The space between the words is a real passage: the
 * camera flies through it (camera.ts, the entrance path for c < 0), the
 * letter walls sweep past the lens, and the words stay behind it. Once the
 * orbit is under way they stop drawing (they're behind the camera by then),
 * and scrolling back brings them back.
 */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { ExtrudeGeometry, type Mesh, MeshPhysicalMaterial, Path, Shape, type Texture } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useDisposable } from '@/systems/performance/useDisposable';
import { ENTRY_Z, O, type Composition } from '../layout';
import { teams, teamsFrame, teamsWorldActive } from '../state';
import { LETTER_CAP, LETTER_DEPTH, letterLayout, type Point } from './letters';

const trace = (s: Shape | Path, pts: Point[], x: number, y: number) => {
  pts.forEach(([px, py], i) => (i ? s.lineTo(x + px * LETTER_CAP, y + py * LETTER_CAP) : s.moveTo(x + px * LETTER_CAP, y + py * LETTER_CAP)));
  s.closePath();
};

/** Past this orbit coordinate the letters are behind the camera for good. */
const HIDE_AFTER = 0.7;

export function TeamEntrance({ env, comp }: { env: Texture | null; comp: Composition }) {
  const mesh = useRef<Mesh>(null);
  const prepared = useRef(false);
  const res = useDisposable(() => {
    const parts: ExtrudeGeometry[] = [];
    for (const { glyph, x, y } of letterLayout(comp.portrait).glyphs) {
      const shape = new Shape();
      trace(shape, glyph.outline, x, y);
      for (const hole of glyph.holes ?? []) {
        const h = new Path();
        trace(h, hole, x, y);
        shape.holes.push(h);
      }
      parts.push(new ExtrudeGeometry(shape, { depth: LETTER_DEPTH, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.035, bevelSegments: 3, curveSegments: 1 }));
    }
    const geometry = mergeGeometries(parts)!;
    parts.forEach((g) => g.dispose());
    // Centred in depth on ENTRY_Z, front faces towards the approaching camera.
    geometry.translate(0, 0, -LETTER_DEPTH / 2);
    geometry.computeBoundingSphere();
    // Warm bone satin: the faces read as solid, the bevels catch the studio light.
    const material = new MeshPhysicalMaterial({
      color: '#cdc5b6',
      roughness: 0.46,
      metalness: 0.18,
      clearcoat: 0.35,
      clearcoatRoughness: 0.3,
      envMap: env,
      envMapIntensity: 1.1,
    });
    return { geometry, material };
  }, [env, comp.portrait]);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    if (!teamsWorldActive() && prepared.current) return;
    prepared.current = true;
    const s = teams().state;
    const travelling = s === 'portalEntering' || s === 'portalExiting';
    m.visible = travelling || teamsFrame.c < HIDE_AFTER;
  });

  return <mesh ref={mesh} name="the-crew-architecture" position={[O.x, O.y, O.z + ENTRY_Z]} geometry={res.geometry} material={res.material} />;
}
