'use client';
/**
 * Fog, background and environment lighting that blend continuously from the
 * dusk campus to the underground facility as the camera goes below ground.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Color, FogExp2, PMREMGenerator } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PALETTE } from '@/config/palette';
import { QUALITY } from '@/config/quality';
import { TEAM_ORIGIN } from '@/config/world';
import { lerp, smoothstep } from '@/systems/camera/pose';
import { useExperience } from '@/store/experience';
import { world } from './blend';

const campusFog = new Color('#b98a6c');
const undergroundFog = new Color(PALETTE.undergroundFog);
const campusBg = new Color(PALETTE.skyHorizon);
const undergroundBg = new Color(PALETTE.underground);

export function Atmosphere() {
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const quality = useExperience((s) => s.quality);
  const fog = useMemo(() => new FogExp2(campusFog.getHex(), 0.0021), []);
  const bg = useMemo(() => campusBg.clone(), []);

  useEffect(() => {
    scene.fog = fog;
    scene.background = bg;
    return () => {
      scene.fog = null;
      scene.background = null;
    };
  }, [scene, fog, bg]);

  // A cheap procedural environment map for believable steel / glass / floor reflections.
  useEffect(() => {
    if (!QUALITY[quality].environmentMap) return;
    const pmrem = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    scene.environment = env;
    room.dispose();
    pmrem.dispose();
    return () => {
      scene.environment = null;
      env.dispose();
    };
  }, [gl, scene, quality]);

  useFrame(({ camera, clock }) => {
    world.time = clock.elapsedTime;
    const u = smoothstep(3, -16, camera.position.y);
    world.underground = u;
    // Inside the team hall the air is a touch clearer so the whole room reads.
    const inTeam = camera.position.z < TEAM_ORIGIN[2] + 1;
    fog.color.copy(campusFog).lerp(undergroundFog, u);
    fog.density = lerp(0.0021, inTeam ? 0.017 : 0.028, u);
    bg.copy(campusBg).lerp(undergroundBg, u);
    scene.environmentIntensity = lerp(0.35, inTeam ? 0.55 : 0.45, u);
  });

  return null;
}
