'use client';
/**
 * The prologue's one light: a street lamp down the road, burning in the
 * pre-dawn mist. It is what lets the scene be seen at all — the canister
 * rolls out of its glow towards the lens, backlit; its light lies along the
 * damp road as a long streak (the road's own specular, no trick); and later
 * the gas is lit from behind by it. It goes out with the other lamps as the
 * day arrives.
 *
 * The light itself is an anchor in the pooled lighting (no new light is ever
 * added to the scene); the halo is the same soft glow the garden's lamps
 * wear in the mist.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, CanvasTexture, Color, CylinderGeometry, type Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, RepeatWrapping, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { merge, place } from '@/systems/geometry/build';
import { useGainedLightAnchors } from '@/systems/lighting/lightPool';
import { useDisposable } from '@/systems/performance/useDisposable';
import { world } from '@/scenes/shared/blend';
import { patchMist } from '../fog';
import { look } from '../look';
import { introFrame } from '../state';
import { T } from '../timeline';
import { glowTexture } from '../world/noise';
import { GROUND_Y, prologueOn, PX } from './layout';

/** The lamp: at the road's edge, some way down it. */
export const LAMP = { x: PX + 4.7, z: 141, y: GROUND_Y + 4.25 } as const;
/** Another lamp, across the lawn to the right, level with where the smoke will be: never in frame, its light rakes across the smoke's face so every lobe has a lit side and a shadowed one. */
export const LAMP2 = { x: PX + 7.2, z: 161.5, y: GROUND_Y + 4.6 } as const;
/** The damp stretch of road around the prologue. */
const WET = { x0: PX - 2.2, x1: PX + 2.6, z0: 136, z1: 172 } as const;

function puddleTexture() {
  // Roughness: mostly damp (low), with drier patches and fine grain.
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const blobs = Array.from({ length: 22 }, () => ({ x: rnd() * size, y: rnd() * size, r: 12 + rnd() * 40 }));
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let dry = 0;
      for (const b of blobs) {
        const dx = Math.min(Math.abs(x - b.x), size - Math.abs(x - b.x));
        const dy = Math.min(Math.abs(y - b.y), size - Math.abs(y - b.y));
        dry = Math.max(dry, 1 - Math.min(1, Math.hypot(dx, dy) / b.r));
      }
      const grain = rnd() * 0.18;
      const v = Math.min(255, (0.16 + 0.42 * dry * dry + grain) * 255);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(5, 36);
  return t;
}

function edgeAlpha() {
  // The damp patch fades out at its edges (it is the road, not a sheet on it).
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d')!;
  const gx = g.createLinearGradient(0, 0, 64, 0);
  gx.addColorStop(0, 'rgba(255,255,255,0)');
  gx.addColorStop(0.18, 'rgba(255,255,255,1)');
  gx.addColorStop(0.82, 'rgba(255,255,255,1)');
  gx.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gx;
  g.fillRect(0, 0, 64, 256);
  g.globalCompositeOperation = 'destination-in';
  const gy = g.createLinearGradient(0, 0, 0, 256);
  gy.addColorStop(0, 'rgba(0,0,0,0)');
  gy.addColorStop(0.12, 'rgba(0,0,0,1)');
  gy.addColorStop(0.9, 'rgba(0,0,0,1)');
  gy.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gy;
  g.fillRect(0, 0, 64, 256);
  return new CanvasTexture(c);
}

export function RoadLamp() {
  const halo = useRef<Mesh>(null);
  const lampGroup = useRef<Mesh>(null);
  const wet = useRef<Mesh>(null);
  const res = useDisposable(() => {
    const post = merge([
      place(new CylinderGeometry(0.06, 0.085, LAMP.y - GROUND_Y, 10), { position: [0, (LAMP.y - GROUND_Y) / 2, 0] }),
      place(new CylinderGeometry(0.03, 0.03, 0.9, 8), { position: [-0.42, LAMP.y - GROUND_Y + 0.12, 0], rotation: [0, 0, Math.PI / 2] }),
    ]);
    const postMat = new MeshStandardMaterial({ color: '#1b1d20', roughness: 0.6, metalness: 0.4 });
    patchMist(postMat);
    const globe = new SphereGeometry(0.16, 16, 12);
    const globeMat = new MeshBasicMaterial({ color: new Color('#ffd9a8').multiplyScalar(2.2), toneMapped: false });
    patchMist(globeMat);
    const rough = puddleTexture();
    const alpha = edgeAlpha();
    const wetMat = new MeshStandardMaterial({ color: '#0c0d0f', roughness: 1, roughnessMap: rough, metalness: 0.05, transparent: true, alphaMap: alpha, depthWrite: false });
    patchMist(wetMat);
    const haloMat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
      uniforms: { uGlow: { value: glowTexture() }, uColor: { value: new Color('#ffcf94') }, uLevel: { value: 1 }, uSize: { value: 4 }, uDensity: { value: 0.03 } },
      vertexShader: /* glsl */ `
        uniform float uSize, uDensity;
        varying vec2 vUv;
        varying float vFade;
        void main() {
          vUv = uv;
          vec4 c = viewMatrix * modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float fd = uDensity * max(-c.z, 0.0);
          vFade = exp(-fd * fd * 0.45);
          c.xy += position.xy * uSize;
          gl_Position = projectionMatrix * c;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uGlow;
        uniform vec3 uColor;
        uniform float uLevel;
        varying vec2 vUv;
        varying float vFade;
        void main() {
          float g = texture2D(uGlow, vUv).a;
          gl_FragColor = vec4(uColor * g * vFade * uLevel, 1.0);
        }`,
    });
    return {
      post,
      postMat,
      globe,
      globeMat,
      rough,
      alpha,
      wetGeo: new PlaneGeometry(WET.x1 - WET.x0, WET.z1 - WET.z0).rotateX(-Math.PI / 2),
      wetMat,
      haloGeo: new PlaneGeometry(1, 1),
      haloMat,
    };
  }, []);

  const anchorList = useMemo(
    () => [
      { position: new Vector3(LAMP.x - 0.8, LAMP.y - 0.1, LAMP.z), color: new Color('#ffcf94'), intensity: 105, distance: 40 },
      { position: new Vector3(LAMP2.x, LAMP2.y, LAMP2.z), color: new Color('#ffd6a6'), intensity: 70, distance: 26 },
    ],
    [],
  );
  const [anchor, anchor2] = useGainedLightAnchors(anchorList);

  useFrame(() => {
    const t = introFrame.t;
    const on = introFrame.active && prologueOn(t);
    const level = on ? look.practicals * world.intro : 0;
    anchor.gain = level;
    anchor2.gain = level;
    if (halo.current) halo.current.visible = on;
    if (lampGroup.current) lampGroup.current.visible = on;
    if (wet.current) wet.current.visible = on;
    if (!on) return;
    const mist = Math.min(1, look.mist.density / 0.06);
    const u = res.haloMat.uniforms;
    u.uSize.value = 1.4 + 3.4 * mist;
    u.uLevel.value = level * (0.5 + 0.5 * mist);
    u.uDensity.value = look.fogDensity;
    // The road dries as the scene leaves it behind (nothing to see here after the prologue).
    res.wetMat.opacity = 1 - Math.min(1, Math.max(0, (t - T.dissolve) / 3.5));
  });

  return (
    <group name="prologue-lamp">
      <mesh ref={lampGroup} geometry={res.post} material={res.postMat} position={[LAMP.x, GROUND_Y, LAMP.z]}>
        <mesh geometry={res.globe} material={res.globeMat} position={[-0.8, LAMP.y - GROUND_Y - 0.1, 0]} />
      </mesh>
      <mesh ref={halo} geometry={res.haloGeo} material={res.haloMat} position={[LAMP.x - 0.8, LAMP.y - 0.1, LAMP.z]} renderOrder={5} frustumCulled={false} />
      <mesh ref={wet} geometry={res.wetGeo} material={res.wetMat} position={[(WET.x0 + WET.x1) / 2, GROUND_Y + 0.004, (WET.z0 + WET.z1) / 2]} renderOrder={1} />
    </group>
  );
}
