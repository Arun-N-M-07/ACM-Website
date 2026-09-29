'use client';
/**
 * Every light in the world, mounted once for the whole journey.
 *
 * three.js recompiles every shader when the number of lights in the scene
 * changes, so chapters never add or remove lights — this rig keeps a constant
 * set and only moves intensities: golden-hour sun and sky above ground, a cool
 * light-well fill below (dimmed while the portal is held, off in the Teams
 * world, which brings its own), and the pooled
 * point lights that follow the camera through the facility's fixtures.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Color, type DirectionalLight, type HemisphereLight, Vector3 } from 'three';
import { PALETTE } from '@/config/palette';
import { QUALITY } from '@/config/quality';
import { TEAMS_ORIGIN } from '@/config/world';
import { experience, useExperience } from '@/store/experience';
import { smoothstep } from '@/systems/camera/pose';
import { teamsFrame } from '@/teams/state';
import { LightPool } from '@/systems/lighting/lightPool';
import { SUN_DIRECTION } from '../campus/Sky';
import { look } from '@/intro/look';
import { world } from './blend';

const COOL_SKY = new Color('#9fb4d6');
const SKY_TOP = new Color('#9db0d4');
const SKY_GROUND = new Color('#4a3426');

const SUN_POS = SUN_DIRECTION.clone().multiplyScalar(260).add(new Vector3(0, 0, 10));
const _away = new Vector3();

/** How far the sun may move (m², at 260 m) before its shadows are drawn again: ~0.04°, far under a shadow texel. */
const SUN_MOVED = 0.04;
/** A slow backstop: the shadows are drawn again at least this often while the sun is up (s). */
const SHADOW_REFRESH = 4;

export function WorldLights() {
  const gl = useThree((s) => s.gl);
  const quality = useExperience((s) => s.quality);
  const q = QUALITY[quality];
  const sun = useRef<DirectionalLight>(null);
  const sky = useRef<HemisphereLight>(null);
  const below = useRef<HemisphereLight>(null);
  const top = useRef<DirectionalLight>(null);
  const shade = useRef({ on: false, ready: false, age: 0, at: new Vector3() });

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
    // Holding the portal draws the light out of the corridor and into the ring.
    const pull = 1 - 0.45 * smoothstep(0.45, 1, teamsFrame.hold);
    // The Teams world is lit by its own rig (teams/world); these stand down there.
    const away = 1 - world.teams;
    if (sun.current) sun.current.intensity = 3.1 * (1 - u) * away;
    if (sky.current) sky.current.intensity = 0.9 * (1 - u) * away;
    if (below.current) {
      below.current.intensity = u * 0.42 * pull * away;
      below.current.color.copy(COOL_SKY);
    }
    if (top.current) top.current.intensity = u * 0.35 * pull * away;

    // In the Teams world the same lights become a studio rig: a cool key from
    // high on one side, a rose rim from behind the spine (it follows the orbit,
    // always opposite the camera), and a low blue fill.
    const tw = world.teams;
    if (tw > 0) {
      if (top.current) {
        top.current.position.set(-26, 44, 30);
        top.current.color.set('#dfe7ff');
        top.current.intensity = 0.9 * tw;
      }
      if (sun.current) {
        _away.set(TEAMS_ORIGIN[0] - camera.position.x, 0, TEAMS_ORIGIN[2] - camera.position.z).normalize();
        const t = sun.current.target.position;
        sun.current.position.set(t.x + _away.x * 200, t.y + 90, t.z + _away.z * 200);
        sun.current.color.set('#ffc3d2');
        sun.current.intensity = 1.5 * tw;
      }
      if (below.current) {
        below.current.color.set('#8ea3d6');
        below.current.intensity = 0.3 * tw;
      }
    } else {
      if (top.current) {
        top.current.position.set(4, 40, 10);
        top.current.color.set('#dfe6f2');
      }
      if (sun.current) {
        sun.current.position.set(SUN_POS.x, SUN_POS.y, SUN_POS.z);
        sun.current.color.set(PALETTE.sun);
      }
      if (sky.current) {
        sky.current.color.copy(SKY_TOP);
        sky.current.groundColor.copy(SKY_GROUND);
      }
    }

    // The opening film lights the campus by its own colour script (before
    // dawn, first light, morning — src/intro/look.ts). Above ground only: below
    // it, the facility's rig above takes over as it always has.
    const k = world.intro * (1 - u);
    if (k > 0) {
      if (sun.current) {
        const t = sun.current.target.position;
        const d = look.sun.dir;
        sun.current.position.set(t.x + d.x * 260, t.y + d.y * 260, t.z + d.z * 260);
        sun.current.color.lerp(look.sun.color, k);
        sun.current.intensity += (look.sun.intensity - sun.current.intensity) * k;
      }
      if (sky.current) {
        sky.current.color.lerp(look.sky.top, k);
        sky.current.groundColor.lerp(look.sky.bottom, k);
        sky.current.intensity += (look.sky.intensity - sky.current.intensity) * k;
      }
    }
    // The opening's shaft and lobby are darker than the facility (the door's light is
    // the story there); the factor is back to 1 at the handoff.
    if (world.intro > 0 && u > 0) {
      const g = 1 + (look.tunnelAmbient - 1) * world.intro;
      if (below.current) below.current.intensity *= g;
      if (top.current) top.current.intensity *= g;
    }
    // The sun's shadow map is drawn again only when it would come out different: the sun has moved
    // (it follows the colour script, and the lightning) or come up, or what casts has changed (the
    // campus arriving). Nothing that casts moves, so a still frame — and the whole film before dawn,
    // where the sun is out — draws none. (Never underground, as before.)
    gl.shadowMap.autoUpdate = false;
    const s = sun.current;
    const sh = shade.current;
    if (s) {
      const on = u < 0.99 && s.intensity > 1e-3;
      const ready = experience().campusReady;
      sh.age += dt;
      if (on && (!sh.on || ready !== sh.ready || sh.age > SHADOW_REFRESH || s.position.distanceToSquared(sh.at) > SUN_MOVED)) {
        gl.shadowMap.needsUpdate = true;
        sh.at.copy(s.position);
        sh.age = 0;
      }
      sh.on = on;
      sh.ready = ready;
    }
  });

  const d = SUN_POS;
  return (
    <>
      <hemisphereLight ref={sky} args={['#9db0d4', '#4a3426', 0.9]} />
      <directionalLight
        ref={sun}
        color={PALETTE.sun}
        position={[d.x, d.y, d.z]}
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
