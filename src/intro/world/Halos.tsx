'use client';
/**
 * Lights seen through mist. Before dawn the garden's lamps are the only warm
 * things in the world; in the mist each one wears a soft halo — larger and
 * softer the thicker the air, fading with distance more slowly than the lamp
 * itself (the mist scatters its light). As the day arrives the lamps go out
 * and the halos with them.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, Color, InstancedBufferAttribute, InstancedMesh, Object3D, PlaneGeometry, ShaderMaterial } from 'three';
import { LAMP_SPOTS, LAMP_Y } from '@/scenes/campus/Grounds';
import { world } from '@/scenes/shared/blend';
import { useDisposable } from '@/systems/performance/useDisposable';
import { look } from '../look';
import { glowTexture } from './noise';

const WARM = new Color('#ffcf94');

export function Halos() {
  const mesh = useRef<InstancedMesh>(null);
  const res = useDisposable(() => {
    const geo = new PlaneGeometry(1, 1);
    const seeds = new Float32Array(LAMP_SPOTS.length).map((_, i) => (i * 0.618) % 1);
    geo.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 1));
    const mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
      uniforms: {
        uGlow: { value: glowTexture() },
        uColor: { value: WARM.clone() },
        uSize: { value: 2 },
        uLevel: { value: 1 },
        uDensity: { value: 0.03 },
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uSize, uTime;
        varying vec2 vUv;
        varying float vFade;
        uniform float uDensity;
        void main() {
          vUv = uv;
          vec4 c = viewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float d = -c.z;
          // The mist between here and the lamp dims the halo (less than it dims the lamp).
          float fd = uDensity * max(d, 0.0);
          vFade = exp(-fd * fd * 0.45) * (0.94 + 0.06 * sin(uTime * 1.3 + aSeed * 30.0));
          float size = uSize * (0.9 + 0.2 * aSeed);
          c.xy += position.xy * size;
          gl_Position = projectionMatrix * c;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uGlow;
        uniform vec3 uColor;
        uniform float uLevel;
        varying vec2 vUv;
        varying float vFade;
        void main() {
          // (The glow lives in alpha: a canvas gradient keeps white RGB under it.)
          float g = texture2D(uGlow, vUv).a;
          gl_FragColor = vec4(uColor * g * vFade * uLevel, 1.0);
        }`,
    });
    return { geo, mat };
  }, []);

  const dummy = useMemo(() => new Object3D(), []);
  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    if (!m.userData.placed) {
      LAMP_SPOTS.forEach(([x, z], i) => {
        dummy.position.set(x, LAMP_Y, z);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
      m.userData.placed = true;
    }
    const u = res.mat.uniforms;
    const mist = Math.min(1, look.mist.density / 0.06);
    u.uSize.value = 1.1 + 3.2 * mist;
    u.uLevel.value = look.practicals * world.intro * (0.45 + 0.55 * mist);
    u.uDensity.value = look.fogDensity;
    u.uTime.value = clock.elapsedTime;
    m.visible = u.uLevel.value > 0.01;
  });

  return <instancedMesh ref={mesh} name="intro-halos" args={[res.geo, res.mat, LAMP_SPOTS.length]} frustumCulled={false} renderOrder={5} />;
}
