'use client';
/**
 * The Teams world's sky: not black, but a very low wash — teal high on one
 * side, violet low on the other — fixed to the world's axes, so as the camera
 * orbits the colour slowly swings round behind the spine. It comes up with
 * the arrival ("the environment gains depth") and sinks while a card is open.
 *   uLevel  0..1 overall strength
 */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { BackSide, Color, type Mesh, ShaderMaterial, SphereGeometry } from 'three';
import { TEAM_DOMAINS } from '@/content/teams';
import { smoothstep } from '@/systems/camera/pose';
import { useDisposable } from '@/systems/performance/useDisposable';
import { teamsFrame, teamsWorldActive } from '../state';

export function Backdrop() {
  const mesh = useRef<Mesh>(null);
  const prepared = useRef(false);
  const res = useDisposable(() => {
    const geo = new SphereGeometry(500, 32, 16);
    const mat = new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      uniforms: { uLevel: { value: 0 }, uDomain: { value: new Color() }, uFocus: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uLevel;
        uniform vec3 uDomain;
        uniform float uFocus;
        varying vec3 vDir;
        void main() {
          float teal = pow(max(0.0, dot(vDir, normalize(vec3(0.62, 0.55, -0.55)))), 3.0);
          float violet = pow(max(0.0, dot(vDir, normalize(vec3(-0.6, -0.45, 0.5)))), 2.5);
          vec3 c = vec3(0.012, 0.045, 0.055) * teal + vec3(0.05, 0.02, 0.07) * violet;
          c = mix(c, uDomain * (0.012 + 0.035 * teal), uFocus);
          gl_FragColor = vec4(c * uLevel, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    return { geo, mat };
  }, []);
  useFrame(({ camera }) => {
    const m = mesh.current;
    if (!m) return;
    if (!teamsWorldActive() && prepared.current) return;
    prepared.current = true;
    m.position.copy(camera.position);
    res.mat.uniforms.uLevel.value = smoothstep(0.05, 0.7, teamsFrame.arrival);
    res.mat.uniforms.uFocus.value = teamsFrame.focus;
    const k = Math.max(0, Math.min(TEAM_DOMAINS.length - 1, Math.round(teamsFrame.focusK)));
    res.mat.uniforms.uDomain.value.set(TEAM_DOMAINS[k].tone);
  });
  return <mesh ref={mesh} geometry={res.geo} material={res.mat} renderOrder={-10} frustumCulled={false} />;
}
