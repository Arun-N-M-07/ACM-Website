'use client';
/**
 * Every light in the world, mounted once for the whole journey.
 *
 * three.js recompiles every shader when the number of lights in the scene
 * changes, so chapters never add or remove lights — this rig keeps a constant
 * set and only moves intensities: golden-hour sun and sky above ground, a cool
 * light-well fill below, warmer fill in the team workspace, and the pooled
 * point lights that follow the camera through the facility's fixtures.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Color, type DirectionalLight, type HemisphereLight } from 'three';
import { PALETTE } from '@/config/palette';
import { QUALITY } from '@/config/quality';
import { TEAM_ORIGIN } from '@/config/world';
import { useExperience } from '@/store/experience';
import { lerp } from '@/systems/camera/pose';
import { LightPool } from '@/systems/lighting/lightPool';
import { SUN_DIRECTION } from '../campus/Sky';
import { world } from './blend';

const COOL_SKY = new Color('#9fb4d6');
const WARM_SKY = new Color('#ffe6c8');

export function WorldLights() {
  const gl = useThree((s) => s.gl);
  const quality = useExperience((s) => s.quality);
  const q = QUALITY[quality];
  const sun = useRef<DirectionalLight>(null);
  const sky = useRef<HemisphereLight>(null);
  const below = useRef<HemisphereLight>(null);
  const top = useRef<DirectionalLight>(null);
  const team = useRef(0);

  useEffect(() => {
    const s = sun.current;
    if (!s) return;
    s.target.position.set(0, 0, 10);
    s.target.updateMatrixWorld();
    const cam = s.shadow.camera;
    cam.left = -95;
    cam.right = 95;
    cam.top = 95;
    cam.bottom = -95;
    cam.near = 10;
    cam.far = 520;
    cam.updateProjectionMatrix();
    s.shadow.bias = -0.0006;
    s.shadow.normalBias = 0.04;
  }, []);

  useFrame(({ camera }, dt) => {
    const u = world.underground;
    const inTeam = u > 0.5 && camera.position.z < TEAM_ORIGIN[2] + 2 ? 1 : 0;
    team.current += (inTeam - team.current) * (1 - Math.exp(-dt * 2));
    const t = team.current;
    if (sun.current) sun.current.intensity = 3.1 * (1 - u);
    if (sky.current) sky.current.intensity = 0.9 * (1 - u);
    if (below.current) {
      below.current.intensity = u * lerp(0.42, 0.75, t);
      below.current.color.copy(COOL_SKY).lerp(WARM_SKY, t);
    }
    if (top.current) top.current.intensity = u * lerp(0.35, 0.55, t);
    // No need to re-render the sun's shadow map once we're underground.
    gl.shadowMap.autoUpdate = u < 0.99;
  });

  const d = SUN_DIRECTION.clone().multiplyScalar(260);
  return (
    <>
      <hemisphereLight ref={sky} args={['#9db0d4', '#4a3426', 0.9]} />
      <directionalLight
        ref={sun}
        color={PALETTE.sun}
        position={[d.x, d.y, d.z + 10]}
        intensity={3.1}
        castShadow={q.shadows}
        shadow-mapSize-width={q.shadowMapSize}
        shadow-mapSize-height={q.shadowMapSize}
      />
      <hemisphereLight ref={below} args={['#9fb4d6', '#1a1512', 0]} />
      <directionalLight ref={top} position={[4, 40, 10]} intensity={0} color="#dfe6f2" />
      <LightPool />
    </>
  );
}
