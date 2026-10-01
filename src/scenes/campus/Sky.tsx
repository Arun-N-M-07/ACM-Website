'use client';
/**
 * Sky dome: a camera-centred gradient with a warm glow toward the sun. One
 * draw call, no textures. Hidden once the camera is underground.
 *
 * During the opening film its colours, its sun and its mist follow the film's
 * colour script (src/intro/look.ts): the ground mist is integrated along each
 * view direction exactly as it is for the materials (src/intro/fog.ts), so
 * the sky is lost in it towards the horizon and shows through overhead.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { BackSide, Color, type Mesh, ShaderMaterial, Vector3 } from 'three';
import { PALETTE } from '@/config/palette';
import { useDisposable } from '@/systems/performance/useDisposable';
import { world } from '../shared/blend';
import { look } from '@/intro/look';
import { mistUniforms } from '@/intro/fog';

const Z0 = new Color(PALETTE.skyZenith);
const M0 = new Color(PALETTE.skyMid);
const H0 = new Color(PALETTE.skyHorizon);
const S0 = new Color(PALETTE.sun);

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
          sunDir: { value: SUN_DIRECTION.clone() },
          uFog: { value: new Color() },
          uHaze: { value: 0 },
          uBelow: { value: new Color() },
          uBelowSpan: { value: 0.2 },
          uGoldDir: { value: new Vector3(0, 0, -1) },
          uGold: { value: new Color(0, 0, 0) },
          ...mistUniforms,
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
          uniform vec3 uFog; uniform float uHaze;
          uniform vec3 uBelow; uniform float uBelowSpan;
          uniform vec3 uGoldDir; uniform vec3 uGold;
          uniform vec4 uMist; uniform vec3 uMistSun; uniform vec3 uMistGlow;
          varying vec3 vDir;
          void main() {
            float h = clamp(vDir.y, -0.2, 1.0);
            vec3 col = mix(horizon, mid, smoothstep(0.0, 0.38, h));
            col = mix(col, zenith, smoothstep(0.28, 0.95, h));
            col = mix(col, uBelow, 1.0 - smoothstep(-uBelowSpan, 0.0, h));
            float s = max(dot(normalize(vDir), sunDir), 0.0);
            col += sunColor * (pow(s, 8.0) * 0.35 + pow(s, 180.0) * 1.2) * smoothstep(-0.05, 0.1, h + 0.05);
            // The film's mist and haze (zero outside it).
            if (uMist.w > 0.0 || uHaze > 0.0) {
              vec3 d = normalize(vDir);
              float H = max(uMist.y, 0.1);
              float oy = clamp(cameraPosition.y - uMist.z, -30.0, 400.0);
              float depth = uMist.x * exp(-oy / H) * H / max(d.y, 0.035);
              float mist = (1.0 - exp(-depth)) * uMist.w;
              float f = 1.0 - (1.0 - mist) * (1.0 - uHaze);
              float toward = pow(max(dot(d, uMistSun), 0.0), 5.0);
              col = mix(col, mix(uFog, uMistGlow, toward * 0.85), f);
            }
            // The film's light inside the cloud ahead (look.gold): the sky low above it glows with it — a
            // band along the horizon, brightest over the light, that the cloud in front of it hides.
            if (uGold.r + uGold.g + uGold.b > 0.0) {
              vec3 d = normalize(vDir);
              float g = max(dot(d, uGoldDir), 0.0);
              float band = exp(-abs(d.y - uGoldDir.y - 0.02) * 14.0);
              col += uGold * (0.35 * pow(g, 3.0) * band + 0.25 * pow(g, 28.0) + 0.12 * band);
            }
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
    const u = material.uniforms;
    const k = world.intro * (1 - world.underground);
    (u.zenith.value as Color).copy(Z0).lerp(look.dome.zenith, k);
    (u.mid.value as Color).copy(M0).lerp(look.dome.mid, k);
    (u.horizon.value as Color).copy(H0).lerp(look.dome.horizon, k);
    (u.sunColor.value as Color).copy(S0).lerp(look.sun.color, k);
    (u.sunDir.value as Vector3).copy(SUN_DIRECTION).lerp(look.sun.dir, k).normalize();
    (u.uFog.value as Color).copy(look.fogColor);
    // Below the horizon the dome stands in for ground beyond the ground's edge. In the film that ground is
    // lost in the air (seen from the flight, the campus's edge lies far off in the fog), so there the dome
    // is the fog's colour from just under the horizon — else the ground's edge shows as a straight line
    // wherever the cloud below the flight parts.
    (u.uBelow.value as Color).copy(u.horizon.value as Color).multiplyScalar(0.55).lerp(look.fogColor, k);
    u.uBelowSpan.value = 0.2 - 0.17 * k;
    // Haze: the denser the air, the less sky (the cloud takes it all).
    const haze = Math.min(1, Math.max(0, (look.fogDensity - 0.0035) / 0.02));
    u.uHaze.value = k * Math.max(haze * 0.96, look.cloud);
    (u.uGoldDir.value as Vector3).subVectors(look.gold.pos, camera.position).normalize();
    (u.uGold.value as Color).copy(look.gold.color).multiplyScalar(k * (1 - look.cloud));
  });

  return (
    <mesh ref={ref} scale={2000} renderOrder={-1} frustumCulled={false} material={material}>
      <sphereGeometry args={geometryArgs} />
    </mesh>
  );
}
