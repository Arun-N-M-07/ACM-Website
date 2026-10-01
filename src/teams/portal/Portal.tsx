'use client';
/**
 * PortalEntry — the gateway at the end of the passage behind the Events
 * matrix (the matrix opens onto it: scenes/events).
 *
 * The passage's end wall is cut with a round opening. In it: a dark
 * brushed-steel ring, a sleeve through the wall, a membrane that recedes like
 * a well, a thin channel of light that fills as you hold, and dust in front
 * that the hold draws in. The blue signal thread that has run the length of
 * the journey leads into it.
 *
 * Every reaction reads `teamsFrame.hold` (0..1 over 2 s), so letting go early
 * runs the whole thing back down smoothly. The DOM prompt and hit target live
 * in teams/ui/PortalHold.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  type Group,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Path,
  PlaneGeometry,
  RingGeometry,
  Shape,
  ShaderMaterial,
  TorusGeometry,
} from 'three';
import { DOOR, FLOOR_Y, PORTAL, UNDERGROUND } from '@/config/world';
import { CanvasPanel } from '@/scenes/shared/CanvasPanel';
import { useKit } from '@/scenes/underground/kit';
import { useLightAnchor } from '@/systems/lighting/lightPool';
import { useDisposable } from '@/systems/performance/useDisposable';
import { fitSize, text } from '@/systems/textures/typeset';
import { smoothstep } from '@/systems/camera/pose';
import { rng } from '@/lib/random';
import { teamsFrame } from '../state';
import { CHANNEL_FRAG, CHANNEL_VERT, MEMBRANE_FRAG, MEMBRANE_VERT, MOTES_FRAG, MOTES_VERT } from './shaders';

/** The passage it closes (as wide and high as the matrix's opening). */
const hw = DOOR.halfWidth;
const WALL_H = DOOR.height + 0.8;
/** The lintel's sign: the width it has always had (its type is sized to it). */
const LINTEL_W = 2 * UNDERGROUND.corridor.halfWidth - 0.6;
const WALL_T = 0.8;
const R = PORTAL.radius;
const CY = PORTAL.y - FLOOR_Y;
const MOTES = 320;

export function Portal() {
  const kit = useKit();
  const gl = useThree((s) => s.gl);
  const ring = useRef<Group>(null);
  const flow = useRef(0);

  const geo = useDisposable(() => {
    // The end wall, with the opening.
    const w = 2 * hw + 0.8;
    const shape = new Shape();
    shape.moveTo(-w / 2, 0);
    shape.lineTo(w / 2, 0);
    shape.lineTo(w / 2, WALL_H);
    shape.lineTo(-w / 2, WALL_H);
    shape.lineTo(-w / 2, 0);
    const hole = new Path();
    hole.absarc(0, CY, R + PORTAL.tube * 0.4, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const wall = new ExtrudeGeometry(shape, { depth: WALL_T, bevelEnabled: false, curveSegments: 96 });
    wall.translate(0, FLOOR_Y, DOOR.z - WALL_T);
    const frame = new TorusGeometry(R, PORTAL.tube, 28, 180);
    const lip = new TorusGeometry(R - PORTAL.tube * 0.9, 0.035, 10, 180);
    const sleeve = new CylinderGeometry(R + PORTAL.tube * 0.4, R + PORTAL.tube * 0.4, WALL_T + 0.1, 128, 1, true);
    sleeve.rotateX(Math.PI / 2);
    const inner = R - PORTAL.tube * 1.15;
    const channel = new RingGeometry(inner - 0.075, inner, 256, 1);
    const membrane = new CircleGeometry(R - PORTAL.tube * 0.5, 128);
    const pool = new PlaneGeometry(9, 7);
    pool.rotateX(-Math.PI / 2);
    // Dust in front of the ring.
    const rnd = rng(8808);
    const pos = new Float32Array(MOTES * 3);
    const seed = new Float32Array(MOTES * 4);
    for (let i = 0; i < MOTES; i++) {
      const a = rnd() * Math.PI * 2;
      const rr = Math.sqrt(rnd()) * (R + 1.6);
      pos[i * 3] = Math.cos(a) * rr;
      pos[i * 3 + 1] = Math.sin(a) * rr * 0.9;
      pos[i * 3 + 2] = 0.2 + rnd() * 4.5;
      seed.set([rnd(), rnd(), rnd(), rnd()], i * 4);
    }
    const motes = new BufferGeometry();
    motes.setAttribute('position', new BufferAttribute(pos, 3));
    motes.setAttribute('aSeed', new BufferAttribute(seed, 4));
    return { wall, frame, lip, sleeve, channel, membrane, pool, motes, inner };
  }, []);

  const mats = useDisposable(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.3)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const poolMap = new CanvasTexture(c);
    return {
      poolMap,
      frame: new MeshStandardMaterial({ color: '#1d2024', roughness: 0.3, metalness: 0.95 }),
      lip: new MeshBasicMaterial({ color: new Color('#9fb8ff').multiplyScalar(0.6), toneMapped: false }),
      sleeve: new MeshStandardMaterial({ color: '#0d0f12', roughness: 0.5, metalness: 0.7, side: BackSide }),
      membrane: new ShaderMaterial({
        vertexShader: MEMBRANE_VERT,
        fragmentShader: MEMBRANE_FRAG,
        uniforms: { uFlow: { value: 0 }, uHold: { value: 0 }, uPressure: { value: 0 }, uTime: { value: 0 }, uPointer: { value: [0, 0] } },
        toneMapped: true,
      }),
      channel: new ShaderMaterial({
        vertexShader: CHANNEL_VERT,
        fragmentShader: CHANNEL_FRAG,
        uniforms: { uHold: { value: 0 }, uTime: { value: 0 }, uPressure: { value: 0 }, uInner: { value: geo.inner - 0.075 }, uOuter: { value: geo.inner } },
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
      motes: new ShaderMaterial({
        vertexShader: MOTES_VERT,
        fragmentShader: MOTES_FRAG,
        uniforms: { uTime: { value: 0 }, uPull: { value: 0 }, uPixelRatio: { value: 1 }, uGlow: { value: 0 } },
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
      pool: new MeshBasicMaterial({ map: poolMap, color: new Color('#a9c2ff'), transparent: true, opacity: 0.1, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
    };
  }, [geo]);

  const lightPos = useMemo<[number, number, number]>(() => [0, PORTAL.y, PORTAL.z + 2], []);
  const light = useLightAnchor(lightPos, '#b8c9ff', 45, 14);

  useFrame(({ clock }, dt) => {
    const f = teamsFrame;
    const h = f.hold;
    const t = clock.elapsedTime;
    // The well speeds up with the hold (integrated, so it never jumps).
    flow.current += dt * (0.1 + h * 1.4 + h * h * h * 4.5);
    const m = mats.membrane.uniforms;
    m.uFlow.value = flow.current;
    m.uHold.value = h;
    m.uPressure.value = Math.min(1, f.pressure * 1.5);
    m.uTime.value = t;
    (m.uPointer.value as number[])[0] = f.pointer.sx;
    (m.uPointer.value as number[])[1] = f.pointer.sy;
    const c = mats.channel.uniforms;
    c.uHold.value = h;
    c.uTime.value = t;
    c.uPressure.value = m.uPressure.value;
    const mo = mats.motes.uniforms;
    mo.uTime.value = t;
    mo.uPull.value = smoothstep(0.375, 1, h);
    mo.uGlow.value = smoothstep(0.25, 0.8, h);
    mo.uPixelRatio.value = gl.getPixelRatio();
    // 0.25 s: the ring answers — it draws in a little.
    if (ring.current) {
      const s = 1 - 0.018 * smoothstep(0.1, 0.25, h) - 0.01 * smoothstep(0.8, 1, h) * (0.5 + 0.5 * Math.sin(t * 40));
      ring.current.scale.setScalar(s);
    }
    mats.lip.color.set('#9fb8ff').multiplyScalar(0.45 + 1.6 * smoothstep(0.2, 0.6, h) + 0.5 * m.uPressure.value);
    mats.pool.opacity = 0.08 + 0.4 * smoothstep(0.2, 1, h);
    light.gain = 0.3 + 0.7 * smoothstep(0.2, 1, h);
  });

  return (
    <group name="portal">
      <mesh geometry={geo.wall} material={kit.concreteDark} />
      <group ref={ring} position={[0, PORTAL.y, PORTAL.z + 0.06]}>
        <mesh geometry={geo.frame} material={mats.frame} />
        <mesh geometry={geo.lip} material={mats.lip} position={[0, 0, 0.1]} />
        <mesh geometry={geo.channel} material={mats.channel} position={[0, 0, 0.02]} renderOrder={3} />
      </group>
      <mesh geometry={geo.sleeve} material={mats.sleeve} position={[0, PORTAL.y, DOOR.z - WALL_T / 2]} />
      <mesh geometry={geo.membrane} material={mats.membrane} position={[0, PORTAL.y, PORTAL.z - 0.3]} />
      <points geometry={geo.motes} material={mats.motes} position={[0, PORTAL.y, PORTAL.z]} renderOrder={4} frustumCulled={false} />
      <mesh geometry={geo.pool} material={mats.pool} position={[0, FLOOR_Y + 0.02, PORTAL.z + 3.2]} renderOrder={2} />
      <CanvasPanel
        width={LINTEL_W}
        height={1.1}
        pxPerMeter={240}
        position={[0, PORTAL.y + R + 1.05, DOOR.z + 0.02]}
        shading="glow"
        glowStrength={0.9}
        transparent
        drawKey="portal-lintel"
        draw={(ctx, w, h) => {
          text(ctx, 'BEYOND THE EVENTS', w / 2, h * 0.3, { family: 'mono', size: h * 0.15, color: 'rgba(239,233,223,0.55)', align: 'center', tracking: 0.32 });
          const s = fitSize(ctx, 'THE CREW', w * 0.62, { family: 'sans', weight: 700, size: h, stretch: 'expanded', tracking: 0.24 }, h * 0.36);
          text(ctx, 'THE CREW', w / 2, h * 0.84, { family: 'sans', weight: 700, size: s, color: '#efe9df', align: 'center', stretch: 'expanded', tracking: 0.2 });
        }}
      />
    </group>
  );
}
