'use client';
/**
 * Dusk sky dome: a camera-centred gradient with a warm glow toward the sun.
 * One draw call, no textures. Hidden once the camera is underground.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { BackSide, Color, type Mesh, ShaderMaterial, Vector3 } from 'three';
import { PALETTE } from '@/config/palette';
import { useDisposable } from '@/systems/performance/useDisposable';
import { world } from '../shared/blend';

/** Low golden-hour sun from the east-south-east: raking light across the red facade. */
export const SUN_DIRECTION = new Vector3(0.8, 0.2, 0.55).normalize();

export function Sky() {
  const ref = useRef<Mesh>(null);
  const material = useDisposable(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          zenith: { value: new Color(PALETTE.skyZenith) },
          mid: { value: new Color(PALETTE.skyMid) },
          horizon: { value: new Color(PALETTE.skyHorizon) },
          sunColor: { value: new Color(PALETTE.sun) },
          sunDir: { value: SUN_DIRECTION },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_Position = p.xyww;
          }`,
        fragmentShader: /* glsl */ `
          precision highp float;
          uniform vec3 zenith; uniform vec3 mid; uniform vec3 horizon; uniform vec3 sunColor; uniform vec3 sunDir;
          varying vec3 vDir;
          void main() {
            float h = clamp(vDir.y, -0.2, 1.0);
            vec3 col = mix(horizon, mid, smoothstep(0.0, 0.38, h));
            col = mix(col, zenith, smoothstep(0.28, 0.95, h));
            col = mix(col, horizon * 0.55, 1.0 - smoothstep(-0.2, 0.0, h));
            float s = max(dot(normalize(vDir), sunDir), 0.0);
            col += sunColor * (pow(s, 8.0) * 0.35 + pow(s, 180.0) * 1.2) * smoothstep(-0.05, 0.1, h + 0.05);
            gl_FragColor = vec4(col, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }),
    [],
  );
  const geometryArgs = useMemo(() => [1, 32, 16] as [number, number, number], []);

  useFrame(({ camera }) => {
    const m = ref.current;
    if (!m) return;
    m.position.copy(camera.position);
    m.visible = world.underground < 0.98;
  });

  return (
    <mesh ref={ref} scale={2000} renderOrder={-1} frustumCulled={false} material={material}>
      <sphereGeometry args={geometryArgs} />
    </mesh>
  );
}
