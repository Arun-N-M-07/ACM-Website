'use client';
/**
 * The six domain cards: real objects in the world — plates of frosted glass
 * (physical transmission: the spine behind them shows through, blurred) with
 * a typeset face.
 *
 * Every movement is a consequence of something:
 *   position   the helix (layout) · the arrival (each card materialises in
 *              turn, sliding in from the dark) · focus (the chosen card comes
 *              forward; the others give way outward) · hover (a lift, and a
 *              lean towards the pointer)
 *   rotation   faces outward from the spine · leans against scroll velocity
 *              (inertia) · the card under the pointer tilts to meet it ·
 *              turns aside while another is open
 *   idle       the world's slow wave passes down the helix: each card rises
 *              and settles as it passes (a phase per card — not random bobbing)
 *   title      settled on the card in view (and the one under the pointer);
 *              off-centre cards carry it broken up; arriving it stutters in,
 *              leaving it breaks apart (cardFace.ts)
 *   glint      a soft flare follows the pointer across the card it's over
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  ExtrudeGeometry,
  type Group,
  type Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
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
import { drawCardFace, type FaceMode } from './cardFace';

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

const TITLE = { decode: 0.95, leave: 0.5, reseed: [0.35, 0.65] as const };

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
    return { slab, plane, screen };
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
          // Milky frost: roughness × (ior − 1) sets the blur of what's behind.
          color: new Color('#dde0e8').lerp(tone, 0.24),
          metalness: 0,
          roughness: 0.56,
          transmission: 1,
          thickness: 0.6,
          ior: 1.5,
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
          opacity: 0.6,
          clearcoat: 1,
          clearcoatRoughness: 0.14,
          envMap: env,
          envMapIntensity: 1,
          depthWrite: false,
        });
    const faceMat = new MeshBasicMaterial({ map: tex.texture as CanvasTexture, transparent: true, depthWrite: false, toneMapped: false, opacity: 0 });
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
    return { glass, faceMat, screen, screenMap, light, lightMap, base: glass.color.clone() };
  }, [d.tone, transmission, env, tex]);

  // The title's state (see cardFace.ts). Redrawn only while it animates, or
  // when a broken title is re-seeded.
  const title = useRef({ mode: 'glitched' as FaceMode, t: 0, seed: i * 13 + 1, next: 0, tick: -1, dirty: true, placed: false });
  const draw = () => {
    const tt = title.current;
    drawCardFace(tex.ctx, tex.canvas.width, tex.canvas.height, d, i, (comp.corner / comp.cardW) * tex.canvas.width, {
      portrait: comp.portrait,
      mode: tt.mode,
      t: tt.t,
      seed: tt.seed,
    });
    tex.texture.needsUpdate = true;
  };
  useEffect(() => {
    title.current.dirty = true;
    title.current.placed = false;
  }, [tex, d, i, comp.portrait]);

  useFrame(({ clock, camera }, dt) => {
    const g = group.current;
    if (!g) return;
    const f = teamsFrame;
    const t = clock.elapsedTime;
    const st = teams();
    const ex = useExperience.getState();
    const appear = appearAt(i, f.arrival);

    const near = Math.max(0, 1 - Math.abs(f.focusK - i));
    const sel = f.focus * near;
    const others = f.focus * (1 - near);
    const hover = f.hoverAmt[i];
    const cc = 1 - Math.min(1, Math.abs(f.c - i));
    const settle = 1 - sel;
    const hovered = f.hover === i;
    const hx = hovered ? f.hoverAt.x / (comp.cardW / 2) : 0;
    const hy = hovered ? f.hoverAt.y / (comp.cardH / 2) : 0;

    // ── title state ──
    const tt = title.current;
    const live = st.state === 'teamsActive' || st.state === 'cardFocused' || st.state === 'domainDetail';
    const wantSettled =
      ex.reducedMotion ||
      sel > 0.3 ||
      hover > 0.5 ||
      (live && st.current === i && Math.abs(f.c - i) < 0.5) ||
      (st.state === 'teamsEntering' && i === 0 && appear > 0.4);
    if (!tt.placed) {
      // First draw: no animation, just the right state.
      tt.mode = wantSettled ? 'settled' : 'glitched';
      tt.placed = true;
      tt.dirty = true;
    } else if (wantSettled && (tt.mode === 'glitched' || tt.mode === 'leaving')) {
      tt.mode = 'decoding';
      tt.t = 0;
    } else if (!wantSettled && (tt.mode === 'settled' || tt.mode === 'decoding')) {
      tt.mode = 'leaving';
      tt.t = 0;
    }
    if (tt.mode === 'decoding' || tt.mode === 'leaving') {
      tt.t = Math.min(1, tt.t + dt / (tt.mode === 'decoding' ? TITLE.decode : TITLE.leave));
      const tick = Math.floor(t * 30);
      if (tt.t >= 1) {
        tt.mode = tt.mode === 'decoding' ? 'settled' : 'glitched';
        tt.dirty = true;
      } else if (tick !== tt.tick) {
        tt.tick = tick;
        if (tt.mode === 'leaving') tt.seed = tick;
        tt.dirty = true;
      }
    } else if (tt.mode === 'glitched' && t > tt.next && appear > 0.01) {
      tt.seed = Math.floor(t * 17) + i;
      tt.next = t + TITLE.reseed[0] + ((i * 0.37) % 1) * (TITLE.reseed[1] - TITLE.reseed[0]);
      tt.dirty = true;
    }
    if (tt.dirty) {
      tt.dirty = false;
      draw();
    }

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
    mats.faceMat.opacity = appear * (0.9 + 0.1 * Math.max(hover, cc)) * (1 - 0.75 * others);
    // Kept just under the bloom threshold: the glow is baked into the lettering,
    // and a blooming title would haze the whole card.
    mats.faceMat.color.setScalar(0.96 + 0.04 * Math.max(hover, sel));
    mats.screen.opacity = 0.94 * smoothstep(0.35, 0.95, sel);
    mats.light.opacity = appear * (0.2 + 0.06 * Math.max(hover, cc)) * (1 - smoothstep(0.1, 0.6, sel)) * (1 - 0.8 * others);

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
      <mesh geometry={geo.slab} material={mats.glass} />
      <mesh geometry={geo.screen} material={mats.light} position={[0, 0, comp.cardDepth / 2 + 0.018]} renderOrder={3} />
      <mesh geometry={geo.screen} material={mats.screen} position={[0, 0, comp.cardDepth / 2 + 0.02]} renderOrder={4} />
      <mesh ref={face} geometry={geo.plane} material={mats.faceMat} position={[0, 0, comp.cardDepth / 2 + 0.026]} renderOrder={5} />
    </group>
  );
}

/** The flare that follows the pointer across the card it's over. */
function Glint({ comp }: { comp: Composition }) {
  const mesh = useRef<Mesh>(null);
  const amount = useRef(0);
  const last = useRef(-1);
  const res = useDisposable(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.18, 'rgba(255,246,250,0.75)');
    grad.addColorStop(0.45, 'rgba(255,225,240,0.18)');
    grad.addColorStop(1, 'rgba(255,225,240,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const map = new CanvasTexture(c);
    const mat = new MeshBasicMaterial({ map, color: new Color('#fff4f7').multiplyScalar(1.7), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false });
    const geo = new PlaneGeometry(1, 1);
    return { map, mat, geo };
  }, []);
  useFrame(({ camera, clock }, dt) => {
    const m = mesh.current;
    if (!m) return;
    const f = teamsFrame;
    const i = f.hover;
    const target = i >= 0 ? 1 : 0;
    amount.current += (target - amount.current) * (1 - Math.exp(-dt * (target ? 7 : 3.5)));
    if (i >= 0) last.current = i;
    const k = last.current;
    if (k >= 0) {
      m.position.set(f.hoverAt.x, f.hoverAt.y, 0.05).applyMatrix4(cardPick[k].matrix);
    }
    m.quaternion.copy(camera.quaternion);
    m.scale.setScalar(Math.min(comp.cardW, comp.cardH) * 0.42 * (1 + 0.04 * Math.sin(clock.elapsedTime * 3.1)));
    res.mat.opacity = amount.current * (1 - f.focus);
    m.visible = res.mat.opacity > 0.003;
  });
  return <mesh ref={mesh} geometry={res.geo} material={res.mat} renderOrder={7} frustumCulled={false} visible={false} />;
}

export function DomainCards({ comp, env }: { comp: Composition; env: Texture | null }) {
  // Frosted glass on every tier: the transmission pass only has to redraw the
  // spine behind the cards, and TeamsWorld lowers its resolution on smaller tiers.
  const transmission = true;
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
      <Glint comp={comp} />
    </group>
  );
}
