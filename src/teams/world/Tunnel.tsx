'use client';
/**
 * PortalTransition's tunnel — what you travel through between the worlds.
 *
 * A few thousand thin streaks of light arranged on nested cylinders around
 * the travel axis, plus faint gates every few metres for a sense of rate.
 * The streaks are fixed in space: the camera's own speed makes them rush
 * past; the shader stretches each one along the axis in proportion to that
 * speed (so they read as motion blur) and turns it to face the lens.
 * Colour runs from the journey's signal blue at the far end to the Teams
 * world's rose and bone at the mouth, and the streaks thin out towards the
 * mouth so you exit into darkness.
 *   uSpeed      0..1 travel speed (stretch + brightness)
 *   uCam        camera position in tunnel space (billboarding)
 *   uLength     tunnel length
 *   uIntensity  overall visibility (only while travelling)
 */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import {
  AdditiveBlending,
  Color,
  type Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
  TorusGeometry,
  Vector3,
} from 'three';
import { rng } from '@/lib/random';
import { useExperience } from '@/store/experience';
import { useDisposable } from '@/systems/performance/useDisposable';
import { TUNNEL_LENGTH } from '../camera';
import { currentTunnel } from '../controller';
import { teams, teamsFrame } from '../state';

const COUNT = { high: 2600, medium: 1700, low: 900 } as const;
const GATES = 11;

const VERT = /* glsl */ `
uniform float uSpeed;
uniform float uLength;
uniform vec3 uCam;
attribute vec4 aStreak; // angle, radius, z, length
attribute float aTone;
varying vec2 vUv;
varying float vTone;
varying float vFade;
void main() {
  vec3 c = vec3(cos(aStreak.x) * aStreak.y, sin(aStreak.x) * aStreak.y, aStreak.z);
  float len = aStreak.w * (0.25 + uSpeed * 7.0);
  vec3 across = normalize(cross(vec3(0.0, 0.0, 1.0), c - uCam));
  float width = 0.018 + 0.02 * aTone;
  vec3 p = c + across * position.x * width + vec3(0.0, 0.0, position.y * len);
  vUv = uv;
  vTone = aStreak.z / uLength;
  vFade = 1.0 - smoothstep(0.93, 1.0, vTone);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform float uIntensity;
uniform float uSpeed;
varying vec2 vUv;
varying float vTone;
varying float vFade;
void main() {
  float across = 1.0 - pow(abs(vUv.x - 0.5) * 2.0, 2.0);
  float along = sin(3.14159 * vUv.y);
  vec3 blue = vec3(0.5, 0.72, 1.0);
  vec3 rose = vec3(1.0, 0.7, 0.78);
  vec3 bone = vec3(1.0, 0.95, 0.9);
  vec3 col = mix(blue, rose, smoothstep(0.2, 0.75, vTone));
  col = mix(col, bone, smoothstep(0.7, 1.0, vTone) * 0.6);
  float a = across * along * vFade * uIntensity * (0.55 + uSpeed * 1.2);
  gl_FragColor = vec4(col * a, a);
}
`;

const _cam = new Vector3();

export function Tunnel() {
  const quality = useExperience((s) => s.quality);
  const group = useRef<Group>(null);
  const res = useDisposable(() => {
    const n = COUNT[quality];
    const r = rng(4410);
    const base = new PlaneGeometry(1, 1);
    const geo = new InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.getAttribute('position'));
    geo.setAttribute('uv', base.getAttribute('uv'));
    const streak = new Float32Array(n * 4);
    const tone = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const shell = r();
      const rad = shell < 0.55 ? 1.6 + r() * 2.2 : shell < 0.9 ? 3.8 + r() * 3.5 : 7.5 + r() * 6;
      streak.set([r() * Math.PI * 2, rad, r() * TUNNEL_LENGTH, 0.4 + r() * 1.4], i * 4);
      tone[i] = r();
    }
    geo.setAttribute('aStreak', new InstancedBufferAttribute(streak, 4));
    geo.setAttribute('aTone', new InstancedBufferAttribute(tone, 1));
    geo.instanceCount = n;
    const mat = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uSpeed: { value: 0 }, uLength: { value: TUNNEL_LENGTH }, uCam: { value: new Vector3() }, uIntensity: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: 2,
    });
    const gate = new TorusGeometry(5.2, 0.012, 6, 96);
    const gateMat = new MeshBasicMaterial({ color: new Color('#9fb8ff'), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false });
    return { base, geo, mat, gate, gateMat };
  }, [quality]);

  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    const st = teams().state;
    const tr = teamsFrame.travel;
    const on = (st === 'portalEntering' || st === 'portalExiting') && tr.inTunnel;
    g.visible = on || tr.speed > 0.01;
    if (!g.visible) return;
    const tun = currentTunnel();
    g.position.copy(tun.start);
    _cam.copy(tun.start).add(tun.dir);
    g.lookAt(_cam);
    g.updateMatrixWorld();
    const u = res.mat.uniforms;
    u.uSpeed.value = tr.speed;
    u.uIntensity.value = on ? 1 : 0;
    _cam.setFromMatrixPosition(camera.matrixWorld);
    (u.uCam.value as Vector3).copy(g.worldToLocal(_cam));
    res.gateMat.opacity = on ? 0.05 + 0.2 * tr.speed : 0;
  });

  return (
    <group ref={group} name="tunnel" visible={false}>
      <mesh geometry={res.geo} material={res.mat} frustumCulled={false} renderOrder={6} />
      {Array.from({ length: GATES }, (_, k) => (
        <mesh key={k} geometry={res.gate} material={res.gateMat} position={[0, 0, ((k + 0.5) / GATES) * TUNNEL_LENGTH * 0.92]} frustumCulled={false} />
      ))}
    </group>
  );
}
