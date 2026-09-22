'use client';
/**
 * Compile every material variant the journey uses while the loader is still
 * up, against the real light rig, so shaders never compile mid-scroll (which
 * would show as a hitch when the descent reaches the facility or the door
 * opens onto the team).
 */
import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  type Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from 'three';
import { useKit } from '@/scenes/underground/kit';

export function ShaderWarmup({ onDone }: { onDone: () => void }) {
  const kit = useKit();
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const group = useRef<Group>(null);

  const extras = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 4;
    const tex = new CanvasTexture(canvas);
    const white = new Color('#ffffff');
    return {
      tex,
      mats: [
        new MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: white, roughness: 0.85 }),
        new MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: white, roughness: 0.85, transparent: true }),
        new MeshBasicMaterial({ map: tex }),
        new MeshBasicMaterial({ map: tex, transparent: true }),
        new MeshStandardMaterial({ vertexColors: true, roughness: 0.72 }),
        new MeshBasicMaterial({ vertexColors: true }),
        new MeshStandardMaterial({ color: '#888', emissive: white, emissiveIntensity: 0.5 }),
        new MeshStandardMaterial({ map: tex, roughness: 0.9 }),
      ] as Material[],
      line: new LineBasicMaterial({ color: '#fff' }),
      geo: new BoxGeometry(0.01, 0.01, 0.01),
    };
  }, []);

  useLayoutEffect(() => {
    const g = group.current;
    if (!g) return;
    const kitMaterials = Object.values(kit as Record<string, unknown>).filter((m): m is Material => (m as Material | null)?.isMaterial === true);
    const all = [...kitMaterials, ...extras.mats];
    all.forEach((m) => {
      const mesh = new Mesh(extras.geo, m);
      mesh.frustumCulled = false;
      g.add(mesh);
    });
    const inst = new InstancedMesh(extras.geo, extras.mats[6], 1);
    inst.frustumCulled = false;
    g.add(inst, new LineSegments(extras.geo, extras.line));
  }, [kit, extras]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const r = gl as typeof gl & { compileAsync?: (s: typeof scene, c: typeof camera) => Promise<unknown> };
        if (r.compileAsync) await r.compileAsync(scene, camera);
        else gl.compile(scene, camera);
      } catch {
        // Warm-up is an optimisation; never block entry on it.
      }
      if (!cancelled) onDone();
    };
    const id = requestAnimationFrame(() => void run());
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [gl, scene, camera, onDone]);

  useEffect(
    () => () => {
      extras.mats.forEach((m) => m.dispose());
      extras.line.dispose();
      extras.geo.dispose();
      extras.tex.dispose();
    },
    [extras],
  );

  return <group ref={group} position={[0, -1000, 0]} />;
}
