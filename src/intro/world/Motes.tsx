'use client';
/**
 * What the air is made of, close to the lens: droplets hanging in the mist,
 * wisps in the cloud, streaks in the fall, dust in the tunnel's light.
 *
 * A field of particles wrapped around the camera (they never run out, and
 * never visibly pop: each fades as it nears the edge of the field). Each is
 * drawn stretched along the camera's own velocity over a short "shutter", so
 * at walking pace they are specks, and in the dive they become streaks
 * rushing past — the sense of speed comes from the air, not from shaking the
 * camera.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, InstancedBufferAttribute, InstancedBufferGeometry, type Mesh, PlaneGeometry, ShaderMaterial, Vector3 } from 'three';
import { useExperience } from '@/store/experience';
import { useDisposable } from '@/systems/performance/useDisposable';
import { colorTrack, look, numberTrack } from '../look';
import { introFrame } from '../state';
import { T } from '../timeline';
import { hash } from './noise';

const BOX = new Vector3(36, 26, 36);

/** How present the motes are, and what they look like, through the film. */
const amount = numberTrack([
  [0, 0.45],
  [T.build, 0.4],
  [T.reveal, 0.18],
  [T.heroEnd, 0.14],
  [T.cloudIn, 0.5],
  [T.cloudDeep, 0.85],
  [T.descent, 1],
  [50.4, 0.9],
  [T.tunnel, 0.45],
  [T.events, 0.32],
  [T.end, 0],
]);
const tint = colorTrack([
  [0, '#b8c2cc'],
  [T.reveal, '#ffe2bd'],
  [T.cloudIn, '#f2f5f8'],
  [T.descent, '#dfe5ea'],
  [50.2, '#6f7a86'],
  [T.tunnel, '#ffd6a8'],
  [T.end, '#ffd6a8'],
]);

export function Motes() {
  const quality = useExperience((s) => s.quality);
  const reduced = useExperience((s) => s.reducedMotion);
  const count = quality === 'high' ? 1400 : quality === 'medium' ? 900 : 450;
  const mesh = useRef<Mesh>(null);

  const res = useDisposable(() => {
    const base = new PlaneGeometry(1, 1).translate(0, 0.5, 0);
    const geo = new InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.getAttribute('position'));
    const off = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) off.set([hash(i, 1), hash(i, 2), hash(i, 3), hash(i, 4)], i * 4);
    geo.setAttribute('aSeed', new InstancedBufferAttribute(off, 4));
    geo.instanceCount = count;
    const mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      uniforms: {
        uCam: { value: new Vector3() },
        uBox: { value: BOX.clone() },
        uVel: { value: new Vector3() },
        uShutter: { value: 0.034 },
        uSize: { value: 0.03 },
        uTime: { value: 0 },
        uAmount: { value: 0 },
        uTint: { value: new Color() },
      },
      vertexShader: /* glsl */ `
        attribute vec4 aSeed;
        uniform vec3 uCam, uBox, uVel;
        uniform float uShutter, uSize, uTime;
        varying float vAlpha;
        varying float vAcross;
        void main() {
          // Each mote drifts a little on its own, inside a field that wraps around the camera.
          vec3 p = aSeed.xyz * uBox + vec3(sin(uTime * 0.13 + aSeed.w * 40.0), sin(uTime * 0.09 + aSeed.x * 31.0) * 0.6, cos(uTime * 0.11 + aSeed.y * 23.0)) * 1.4;
          p = mod(p - uCam, uBox) + uCam - uBox * 0.5;
          vec3 rel = (p - uCam) / (uBox * 0.5);
          float edge = 1.0 - smoothstep(0.7, 1.0, max(abs(rel.x), max(abs(rel.y), abs(rel.z))));
          vec4 mv = viewMatrix * vec4(p, 1.0);
          float dist = -mv.z;
          // Stretched along the camera's motion over the shutter (the trail points back in time).
          vec3 v = (viewMatrix * vec4(uVel, 0.0)).xyz;
          vec2 d2 = v.xy;
          float l2 = length(d2);
          vec2 dir = l2 > 1e-4 ? d2 / l2 : vec2(0.0, 1.0);
          vec3 q = mv.xyz;
          float size = uSize * (0.6 + 0.8 * aSeed.w);
          q.xy += vec2(-dir.y, dir.x) * (position.x * size);
          q += v * uShutter * position.y + vec3(dir, 0.0) * size * (position.y - 0.5);
          gl_Position = projectionMatrix * vec4(q, 1.0);
          vAlpha = edge * smoothstep(0.35, 1.6, dist) * (1.0 - smoothstep(12.0, 18.0, dist));
          vAcross = position.x * 2.0;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uAmount;
        uniform vec3 uTint;
        varying float vAlpha;
        varying float vAcross;
        void main() {
          float a = (1.0 - vAcross * vAcross) * vAlpha * uAmount;
          if (a < 0.003) discard;
          gl_FragColor = vec4(uTint, a * 0.8);
        }`,
    });
    return { geo, mat, base };
  }, [count]);

  const last = useMemo(() => new Vector3(), []);
  const vel = useMemo(() => new Vector3(), []);
  const tmp = useMemo(() => new Vector3(), []);

  useFrame(({ camera, clock }, dt) => {
    const m = mesh.current;
    if (!m) return;
    const on = introFrame.active && !reduced;
    m.visible = on;
    if (!on) {
      last.copy(camera.position);
      return;
    }
    // The camera's velocity, smoothed (a jump is not a velocity).
    tmp.subVectors(camera.position, last).divideScalar(Math.max(dt, 1e-3));
    if (tmp.length() > 400) tmp.set(0, 0, 0);
    vel.lerp(tmp, 1 - Math.exp(-dt * 10));
    last.copy(camera.position);
    const u = res.mat.uniforms;
    (u.uCam.value as Vector3).copy(camera.position);
    (u.uVel.value as Vector3).copy(vel);
    u.uTime.value = clock.elapsedTime;
    const t = introFrame.t;
    u.uAmount.value = amount(t);
    tint(t, u.uTint.value as Color);
    // Brighter where there is light to catch.
    (u.uTint.value as Color).multiplyScalar(0.7 + 0.5 * Math.min(1, look.sky.intensity + look.sun.intensity * 0.2));
  });

  return <mesh ref={mesh} geometry={res.geo} material={res.mat} frustumCulled={false} renderOrder={8} />;
}
