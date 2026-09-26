'use client';
/** Six physical plates on radial mounts. Typography shares each plate's
 * transform and lighting; selection uses the rendered surface matrix. */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  CanvasTexture,
  Color,
  ExtrudeGeometry,
  type Group,
  type Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  CylinderGeometry,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  type Texture,
  Vector3,
} from 'three';
import { QUALITY } from '@/config/quality';
import { TEAM_DOMAINS, type TeamDomain } from '@/content/teams';
import { useExperience } from '@/store/experience';
import { smoothstep } from '@/systems/camera/pose';
import { useDisposable } from '@/systems/performance/useDisposable';
import { makeCanvas, toTexture } from '@/systems/textures/typeset';
import { FOCUS_PUSH } from '../camera';
import { cardPick } from '../controller';
import { cardAngle, cardCenter, STEP, type Composition } from '../layout';
import { emitCardRect, teams, teamsFrame } from '../state';
import { drawCardFace } from './cardFace';

function roundedRect(w: number, h: number, r: number) {
  const s = new Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return s;
}

/** When card i materialises during the arrival (0..1). */
export const appearAt = (i: number, arrival: number) => smoothstep(0.5 + i * 0.065, 0.66 + i * 0.065, arrival);

const _c = new Vector3();
const _corner = new Vector3();
const _right = new Vector3();


function DomainCard({ d, i, comp, env, transmission }: { d: TeamDomain; i: number; comp: Composition; env: Texture | null; transmission: boolean }) {
  const group = useRef<Group>(null);
  const face = useRef<Mesh>(null);
  const size = useThree((s) => s.size);
  const quality = useExperience((s) => s.quality);
  const scale = QUALITY[quality].textureScale;

  const geo = useDisposable(() => {
    const slab = new ExtrudeGeometry(roundedRect(comp.cardW, comp.cardH, comp.corner), {
      depth: comp.cardDepth,
      bevelEnabled: true,
      bevelThickness: 0.014,
      bevelSize: 0.014,
      bevelSegments: 3,
      curveSegments: 8,
    });
    slab.translate(0, 0, -comp.cardDepth / 2);
    const plane = new PlaneGeometry(comp.cardW, comp.cardH);
    const screen = new ShapeGeometry(roundedRect(comp.cardW - 0.03, comp.cardH - 0.03, comp.corner * 0.9), 8);
    // Shape UVs are in metres; normalise them so the screen's gradient spans the card.
    const sp = screen.getAttribute('position');
    const suv = screen.getAttribute('uv');
    for (let k = 0; k < sp.count; k++) suv.setXY(k, sp.getX(k) / comp.cardW + 0.5, sp.getY(k) / comp.cardH + 0.5);
    const arm = new CylinderGeometry(0.028, 0.065, comp.radius - 0.65, 8);
    arm.rotateX(Math.PI / 2);
    arm.translate(0, 0, -(comp.radius - 0.65) / 2);
    return { slab, plane, screen, arm };
  }, [comp.cardW, comp.cardH, comp.corner, comp.cardDepth]);

  const tex = useDisposable(() => {
    const pxW = Math.round((comp.portrait ? 720 : 1024) * Math.max(0.6, scale));
    const pxH = Math.round((pxW * comp.cardH) / comp.cardW);
    const { canvas, ctx } = makeCanvas(pxW, pxH);
    const texture = toTexture(canvas, { anisotropy: 8 });
    return { canvas, ctx, texture };
  }, [comp.portrait, comp.cardW, comp.cardH, scale]);

  const mats = useDisposable(() => {
    const tone = new Color(d.tone);
    const glass = transmission
      ? new MeshPhysicalMaterial({
          // Smoked resin: restrained transmission with a sharp edge reflection.
          color: new Color('#263239').lerp(tone, 0.22),
          metalness: 0.16,
          roughness: 0.22,
          transmission: quality === 'high' ? 0.28 : 0.14,
          thickness: 0.12,
          ior: 1.3,
          attenuationColor: tone.clone().lerp(new Color('#ffffff'), 0.45),
          attenuationDistance: 2.6,
          clearcoat: 1,
          clearcoatRoughness: 0.14,
          envMap: env,
          envMapIntensity: 1.1,
        })
      : new MeshPhysicalMaterial({
          color: tone.clone().multiplyScalar(0.45),
          metalness: 0.1,
          roughness: 0.28,
          transparent: true,
          opacity: 0.94,
          clearcoat: 1,
          clearcoatRoughness: 0.14,
          envMap: env,
          envMapIntensity: 1,
          depthWrite: false,
        });
    const faceMat = new MeshStandardMaterial({ map: tex.texture as CanvasTexture, emissiveMap: tex.texture, emissive: '#ffffff', emissiveIntensity: 0.32, roughness: 0.65, metalness: 0.12, transparent: true, depthWrite: false, opacity: 0 });
    const mount = new MeshStandardMaterial({ color: '#647076', metalness: 0.7, roughness: 0.3, envMap: env });
    // The screen that switches on behind the name as the card opens.
    const sc = document.createElement('canvas');
    sc.width = 64;
    sc.height = 64;
    const sg = sc.getContext('2d')!;
    const lin = sg.createLinearGradient(0, 0, 0, 64);
    lin.addColorStop(0, `#${new Color('#0e1a1f').lerp(tone, 0.16).getHexString()}`);
    lin.addColorStop(1, '#06090b');
    sg.fillStyle = lin;
    sg.fillRect(0, 0, 64, 64);
    const rad = sg.createRadialGradient(32, 28, 2, 32, 32, 44);
    rad.addColorStop(0, 'rgba(255,255,255,0.07)');
    rad.addColorStop(1, 'rgba(255,255,255,0)');
    sg.fillStyle = rad;
    sg.fillRect(0, 0, 64, 64);
    const screenMap = new CanvasTexture(sc);
    screenMap.colorSpace = SRGBColorSpace;
    const screen = new MeshBasicMaterial({ map: screenMap, transparent: true, opacity: 0, depthWrite: false });
    // At rest the plate is lit from within — milky light high up, the domain's
    // tone lower down — the way the reference's cards glow with their media.
    const lc = document.createElement('canvas');
    lc.width = 8;
    lc.height = 64;
    const lg = lc.getContext('2d')!;
    const lgr = lg.createLinearGradient(0, 0, 0, 64);
    lgr.addColorStop(0, `#${new Color('#ffffff').lerp(tone, 0.25).getHexString()}`);
    lgr.addColorStop(0.6, `#${new Color('#ffffff').lerp(tone, 0.6).getHexString()}`);
    lgr.addColorStop(1, `#${tone.getHexString()}`);
    lg.fillStyle = lgr;
    lg.fillRect(0, 0, 8, 64);
    const lightMap = new CanvasTexture(lc);
    lightMap.colorSpace = SRGBColorSpace;
    const light = new MeshBasicMaterial({ map: lightMap, transparent: true, opacity: 0, depthWrite: false });
    return { glass, faceMat, mount, screen, screenMap, light, lightMap, base: glass.color.clone() };
  }, [d.tone, transmission, quality, env, tex]);

  useEffect(() => {
    drawCardFace(tex.ctx, tex.canvas.width, tex.canvas.height, d, i, (comp.corner / comp.cardW) * tex.canvas.width, {
      portrait: comp.portrait, mode: 'settled', t: 1, seed: i,
    });
    tex.texture.needsUpdate = true;
  }, [tex, d, i, comp]);

  useFrame(({ clock, camera }, dt) => {
    const g = group.current;
    if (!g) return;
    const f = teamsFrame;
    const t = useExperience.getState().reducedMotion ? 0 : clock.elapsedTime;
    const st = teams();
    const appear = appearAt(i, f.reveal);

    const near = Math.max(0, 1 - Math.abs(f.focusK - i));
    const sel = f.focus * near;
    const others = f.focus * (1 - near);
    const hover = f.hoverAmt[i];
    const cc = 1 - Math.min(1, Math.abs(f.c - i));
    const settle = 1 - sel;
    const hovered = f.hover === i;
    const hx = hovered ? f.hoverAt.x / (comp.cardW / 2) : 0;
    const hy = hovered ? f.hoverAt.y / (comp.cardH / 2) : 0;

    // ── placement ──
    const radial = FOCUS_PUSH * sel + 1.4 * others + hover * 0.14 + (1 - appear) * 2.6;
    cardCenter(i, comp, _c, radial);
    // The world's wave passes down the helix: a phase per card.
    const wave = Math.sin(t * 0.6 - i * 0.9);
    _c.y += wave * 0.035 * settle - (1 - appear) * 0.9;
    // Hovered: a small drift towards the pointer, across the card's own face.
    const a = cardAngle(i);
    _right.set(Math.cos(a), 0, -Math.sin(a));
    _c.addScaledVector(_right, hx * 0.05 * hover * settle);
    _c.y += hy * 0.03 * hover * settle;
    g.position.copy(_c);

    const vel = Math.max(-2.5, Math.min(2.5, f.cVel));
    // Cards turn part-way towards the orbiting camera, so neighbours show more
    // of their face and each card squares up as it comes into the centre.
    const toward = Math.max(-0.45, Math.min(0.45, (f.c * STEP - a) * 0.3));
    g.rotation.order = 'YXZ';
    g.rotation.y =
      a +
      toward * settle -
      vel * 0.05 * settle +
      f.pointer.sx * 0.03 * cc * settle +
      hx * 0.08 * hover * settle +
      Math.sign(i - f.focusK) * 0.3 * others +
      (1 - appear) * 0.5;
    g.rotation.x = Math.sin(t * 0.6 - i * 0.9 + 1.2) * 0.012 * settle - f.pointer.sy * 0.02 * cc * settle - hy * 0.07 * hover * settle;
    g.rotation.z = -vel * 0.012 * settle;
    g.scale.setScalar((0.84 + 0.16 * appear) * (1 + 0.025 * hover + 0.02 * sel));
    g.visible = appear > 0.002;

    // Others recede into the dark while one is open; the chosen one lights up.
    mats.glass.color.copy(mats.base).multiplyScalar(1 - 0.72 * others);
    mats.glass.envMapIntensity = (0.4 + 0.7 * appear) * (1 - 0.7 * others) * (1 + 0.4 * hover);
    mats.faceMat.opacity = appear * (0.9 + 0.1 * Math.max(hover, cc)) * (1 - 0.9 * others) * (1 - smoothstep(0.7, 0.92, sel));
    // Kept just under the bloom threshold: the glow is baked into the lettering,
    // and a blooming title would haze the whole card.
    mats.faceMat.color.setScalar(0.96 + 0.04 * Math.max(hover, sel));
    mats.screen.opacity = 0.45 * smoothstep(0.35, 0.75, sel) * (1 - smoothstep(0.8, 1, sel));
    mats.light.opacity = appear * 0.035 * (1 - sel) * (1 - others);

    // Publish for picking (and, when chosen, for the detail layer).
    g.updateMatrixWorld();
    const pick = cardPick[i];
    if (face.current) pick.matrix.copy(face.current.matrixWorld);
    pick.hw = comp.cardW / 2;
    pick.hh = comp.cardH / 2;
    pick.live = appear > 0.9 && others < 0.5;

    if (st.selected === i && face.current && f.focus > 0.001) {
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]) {
        _corner.set((sx * comp.cardW) / 2, (sy * comp.cardH) / 2, 0).applyMatrix4(face.current.matrixWorld).project(camera);
        const px = (_corner.x * 0.5 + 0.5) * size.width;
        const py = (-_corner.y * 0.5 + 0.5) * size.height;
        x0 = Math.min(x0, px);
        y0 = Math.min(y0, py);
        x1 = Math.max(x1, px);
        y1 = Math.max(y1, py);
      }
      const r = f.cardRect;
      r.x = x0;
      r.y = y0;
      r.w = x1 - x0;
      r.h = y1 - y0;
      r.visible = true;
      emitCardRect();
    }
  });

  return (
    <group ref={group} name={`card-${d.slug}`}>
      <mesh geometry={geo.arm} material={mats.mount} />
      <mesh geometry={geo.slab} material={mats.glass} />
      <mesh geometry={geo.screen} material={mats.light} position={[0, 0, comp.cardDepth / 2 + 0.018]} renderOrder={3} />
      <mesh geometry={geo.screen} material={mats.screen} position={[0, 0, comp.cardDepth / 2 + 0.02]} renderOrder={4} />
      <mesh ref={face} geometry={geo.plane} material={mats.faceMat} position={[0, 0, comp.cardDepth / 2 + 0.026]} renderOrder={5} />
    </group>
  );
}

export function DomainCards({ comp, env }: { comp: Composition; env: Texture | null }) {
  // Low tier keeps the same silhouette and ink without a transmission pass.
  const quality = useExperience((s) => s.quality);
  const transmission = quality !== 'low';
  const cards = useMemo(() => TEAM_DOMAINS.map((d, i) => ({ d, i })), []);
  useEffect(
    () => () => {
      for (const p of cardPick) p.live = false;
      teamsFrame.cardRect.visible = false;
    },
    [],
  );
  return (
    <group name="domain-cards">
      {cards.map(({ d, i }) => (
        <DomainCard key={`${d.slug}-${comp.portrait ? 'p' : 'l'}`} d={d} i={i} comp={comp} env={env} transmission={transmission} />
      ))}
    </group>
  );
}
