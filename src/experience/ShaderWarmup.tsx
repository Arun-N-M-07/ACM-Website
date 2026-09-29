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
  type Object3D,
  type Texture,
  WebGLRenderTarget,
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
      // compile() only visits visible objects, and much of what the opening
      // will show is hidden until the scroll reaches it (the lobby, the door,
      // the corridor behind it, the name). Show everything for the traversal
      // — which happens synchronously, inside the call — then put it back.
      const hidden: Object3D[] = [];
      scene.traverse((o) => {
        if (!o.visible) {
          hidden.push(o);
          o.visible = true;
        }
      });
      try {
        const r = gl as typeof gl & { compileAsync?: (s: typeof scene, c: typeof camera) => Promise<unknown> };
        // (Asynchronously only where the driver links in parallel; elsewhere it would compile the same,
        // with a console warning for want of the extension.)
        const parallel = !!r.compileAsync && gl.extensions.has('KHR_parallel_shader_compile');
        const pending = parallel ? r.compileAsync!(scene, camera) : (gl.compile(scene, camera), null);
        hidden.forEach((o) => (o.visible = false));
        hidden.length = 0;
        // Upload every texture a material holds now too (a large texture's
        // first upload is a visible hitch when it waits for its first frame).
        const seen = new Set<Texture>();
        const take = (v: unknown) => {
          const tex = v as Texture | null;
          if (tex && tex.isTexture && !seen.has(tex) && !(tex as Texture & { isRenderTargetTexture?: boolean }).isRenderTargetTexture) {
            seen.add(tex);
            gl.initTexture(tex);
          }
        };
        scene.traverse((o) => {
          const mats = (o as Mesh).material;
          if (!mats) return;
          for (const m of Array.isArray(mats) ? mats : [mats]) {
            for (const v of Object.values(m as unknown as Record<string, unknown>)) take(v);
            const uniforms = (m as Material & { uniforms?: Record<string, { value: unknown }> }).uniforms;
            if (uniforms) for (const u of Object.values(uniforms)) take(u?.value);
          }
        });
        if (pending) await pending;
        // Then draw the whole world once, everything shown and nothing culled,
        // into a tiny target: whatever compile() could not foresee compiles
        // now, and every geometry is uploaded — behind the loader, not on the
        // frame something first comes into view.
        const shown: Object3D[] = [];
        const unculled: Object3D[] = [];
        scene.traverse((o) => {
          if (!o.visible) {
            shown.push(o);
            o.visible = true;
          }
          if (o.frustumCulled) {
            unculled.push(o);
            o.frustumCulled = false;
          }
        });
        const target = new WebGLRenderTarget(8, 8);
        const prev = gl.getRenderTarget();
        try {
          gl.setRenderTarget(target);
          gl.render(scene, camera);
          // …and once to the canvas itself. Drawing to the screen takes programs of its own (tone
          // mapping, sRGB output) — the Events are drawn straight to it — and a program is only really
          // linked the first time it draws: that was a stall on the frame the film handed over to the
          // Events. (Behind the loader, like the rest.)
          gl.setRenderTarget(null);
          gl.render(scene, camera);
        } finally {
          gl.setRenderTarget(prev);
          target.dispose();
          shown.forEach((o) => (o.visible = false));
          unculled.forEach((o) => (o.frustumCulled = true));
        }
      } catch {
        hidden.forEach((o) => (o.visible = false));
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

  // (The variant materials are kept, not disposed, when this unmounts: disposing the last material
  // that uses a program deletes the program — and these exist to hold the variants that the journey's
  // own materials only take on later, when a room streams in or a panel first draws. They are a
  // handful of tiny materials, freed with the canvas.)

  return <group ref={group} position={[0, -1000, 0]} />;
}
