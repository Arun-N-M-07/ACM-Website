'use client';
/**
 * The domains' rooms — the worlds behind the cards.
 *
 * A card is the compressed form of its domain; the room behind it is the
 * domain at full size. The camera comes through the card's opening surface
 * (camera.ts, entryShot; DomainCards, the aperture) and stands in a gallery
 * built on the card's own axis, far larger than the card:
 *
 *   the room      matte plaster walls and floor, lit from above: a soft wash
 *                 down the back wall, the floor catching it, the corners
 *                 falling into shade. No grid, no glow — architecture.
 *   the name      signage on the back wall, set as the card set it (Archivo,
 *                 expanded): the title you chose, now built into the room,
 *                 with its index above and the count of its people below
 *   the idea      one abstract centrepiece per domain (domainPieces.ts)
 *   the people    printed on a freestanding frosted pane — the card's own
 *                 material, now standing in the room — each name in the
 *                 site's serif, with a quiet index. CORE is its own
 *                 architecture: four frosted stones, one for each office,
 *                 lining the axis of a symmetrical chamber.
 *
 * Arrival is layered on the focus scalar (so leaving reverses it exactly):
 * the room's light comes up over everything in it, then the name inks in,
 * the centrepiece settles into place, and the people ink in.
 * Display type only: the readable, accessible copy is the DOM article in
 * ui/DomainDetail.tsx. No roll numbers are shown.
 *
 * All seven rooms stay mounted (hidden) so their programs compile with the
 * rest of the world; their type is drawn in idle time after mount, so
 * choosing a card never waits on a canvas or a shader.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import {
  BackSide,
  BoxGeometry,
  Color,
  DoubleSide,
  ExtrudeGeometry,
  type Group,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  ShaderMaterial,
  Shape,
  type Texture,
  Vector2,
  Vector3,
} from 'three';
import { QUALITY } from '@/config/quality';
import { TEAM_DOMAINS, type TeamDomain } from '@/content/teams';
import { useExperience } from '@/store/experience';
import { smoothstep } from '@/systems/camera/pose';
import { useDisposable } from '@/systems/performance/useDisposable';
import { applyType, fontsReady, makeCanvas, toTexture, type TypeSpec, wrap } from '@/systems/textures/typeset';
import { FOCUS_PUSH, ROOM_EYE, roomFov, roomSize } from '../camera';
import { cardAngle, cardCenter, type Composition } from '../layout';
import { teams, teamsFrame } from '../state';
import { buildCenterpiece, type PieceMaterial } from './domainPieces';

// ─── The room ────────────────────────────────────────────────────────────────

const SHELL_VERT = /* glsl */ `
varying vec3 vP;
varying vec3 vN;
void main() {
  vP = position;
  vN = normal;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SHELL_FRAG = /* glsl */ `
uniform vec3 uTone;
uniform float uReveal;
uniform vec3 uSize;
uniform float uFloor;
uniform float uCore;
varying vec3 vP;
varying vec3 vN;
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
}
void main() {
  vec3 n = normalize(vN);
  float back = step(0.5, -n.z);
  float front = step(0.5, n.z);
  float floorW = step(0.5, -n.y);
  float ceilW = step(0.5, n.y);
  float side = (1.0 - back) * (1.0 - front) * (1.0 - floorW) * (1.0 - ceilW);
  float hy = (vP.y + uFloor) / uSize.y;           // 0 floor .. 1 ceiling
  float dz = clamp(-vP.z / uSize.z, 0.0, 1.0);    // 0 entrance .. 1 back wall
  float ex = abs(vP.x) / (uSize.x * 0.5);         // 0 centre .. 1 side wall
  // Plaster: broad, quiet mottling (no pattern that reads as texture).
  vec2 q = back > 0.5 || front > 0.5 ? vP.xy : (side > 0.5 ? vP.zy : vP.xz);
  float mott = vnoise(q * 0.9) * 0.55 + vnoise(q * 3.3) * 0.3 + vnoise(q * 11.0) * 0.15;
  // The light: a slot in the ceiling just before the back wall washes it
  // from above; the side walls, ceiling and floor fall away into shade
  // towards the entrance, and a soft pool lies on the floor where the room's
  // centrepiece stands. The box's edges dissolve; the far wall holds the eye.
  float wash = back * (0.42 + 0.62 * smoothstep(0.0, 0.92, hy)) * (1.0 - 0.5 * smoothstep(0.25, 1.0, ex));
  float walls = side * (0.02 + 0.6 * pow(dz, 3.2)) * (0.7 + 0.3 * hy);
  float pool = exp(-pow((dz - 0.6) * 3.0, 2.0) - pow(vP.x / (uSize.x * 0.36), 2.0));
  float fl = floorW * (0.04 + 0.5 * pow(dz, 2.4) + 0.3 * pool) * (1.0 - 0.45 * ex * ex);
  float ce = ceilW * (0.025 + 0.14 * pow(dz, 3.0));
  float slot = ceilW * (1.0 - smoothstep(0.003, 0.016, abs(dz - 0.955))) * (1.0 - smoothstep(0.8, 0.95, ex));
  float lit = wash + walls + fl + ce + front * 0.02;
  // Where surfaces meet, a soft shade (no hard seams).
  float aoY = smoothstep(0.0, 0.16, hy) * (1.0 - 0.7 * smoothstep(0.84, 1.0, hy));
  float aoX = 1.0 - smoothstep(0.78, 1.0, ex);
  float aoZ = smoothstep(0.0, 0.1, 1.0 - dz);
  float ao = mix(0.45, 1.0, back > 0.5 ? min(aoY, aoX) : side > 0.5 ? min(aoY, aoZ) : min(aoX, aoZ));
  vec3 plaster = mix(vec3(0.16, 0.152, 0.14), uTone * 0.22 + vec3(0.03), 0.3);
  vec3 col = plaster * lit * ao * (0.88 + 0.24 * mott);
  col += slot * mix(vec3(0.62, 0.58, 0.52), uTone, 0.25) * 0.55;
  // CORE: an inlaid line down the axis of the floor, towards its name.
  col += uCore * floorW * (1.0 - smoothstep(0.012, 0.026, abs(vP.x))) * mix(vec3(0.5, 0.46, 0.4), uTone, 0.4) * 0.22 * (0.4 + 0.6 * dz);
  gl_FragColor = vec4(col * uReveal, 1.0);
  #include <colorspace_fragment>
}
`;

// ─── Type: two inks in two channels ──────────────────────────────────────────
// Canvases are drawn opaque black with names in red and labels in green, so
// there are no premultiplied-alpha fringes; shaders read the coverage of each.

const SIGN_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const SIGN_FRAG = /* glsl */ `
uniform sampler2D uTex;
uniform vec3 uInk;
uniform vec3 uTone;
uniform float uK;
varying vec2 vUv;
void main() {
  vec4 t = texture2D(uTex, vUv);
  float a = max(t.r, t.g) * uK;
  if (a < 0.004) discard;
  vec3 c = (uInk * t.r + uTone * t.g) / max(1e-3, t.r + t.g);
  gl_FragColor = vec4(c, a);
  #include <colorspace_fragment>
}
`;

type Ink = 'name' | 'label';
const INK: Record<Ink, string> = { name: '#ff0000', label: '#00ff00' };

function typeset(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spec: Omit<TypeSpec, 'color'>, ink: Ink) {
  applyType(ctx, { ...spec, color: INK[ink] });
  ctx.fillText(text, x, y);
}

/** A frosted pane with type printed into its front face (the cards' technique). */
function printedGlass(tex: Texture, w: number, h: number, env: Texture | null, tone: Color, transmission: number) {
  const m = new MeshPhysicalMaterial({
    color: new Color('#e2e5e5').lerp(tone, 0.18),
    roughness: 0.6,
    metalness: 0,
    transmission,
    thickness: 0.4,
    ior: 1.5,
    attenuationColor: tone.clone().lerp(new Color('#ffffff'), 0.5),
    attenuationDistance: 1.4,
    // A satin coat: on a 12 mm bevel a sharper one focuses the room's key into
    // a hot point and a dashed, aliased line along the edge.
    clearcoat: 0.6,
    clearcoatRoughness: 0.34,
    envMap: env,
    envMapIntensity: 0.8,
  });
  const uniforms = { uFace: { value: tex }, uCard: { value: new Vector2(w, h) }, uInkK: { value: 0 }, uInk: { value: new Color('#f3eee5') }, uTone: { value: tone.clone().lerp(new Color('#ffffff'), 0.25) } };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPaneP;\nvarying float vPaneNz;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPaneP = position;\nvPaneNz = normal.z;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform sampler2D uFace;\nuniform vec2 uCard;\nuniform float uInkK;\nuniform vec3 uInk;\nuniform vec3 uTone;\nvarying vec3 vPaneP;\nvarying float vPaneNz;',
      )
      .replace(
        '#include <map_fragment>',
        '#include <map_fragment>\nvec4 paneInk = texture2D(uFace, vPaneP.xy / uCard + 0.5);\nfloat paneA = max(paneInk.r, paneInk.g) * smoothstep(0.55, 0.9, vPaneNz) * uInkK;\nvec3 paneCol = (uInk * paneInk.r + uTone * paneInk.g) / max(1e-3, paneInk.r + paneInk.g);',
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.55, paneA);')
      .replace('#include <transmission_fragment>', '#include <transmission_fragment>\ntotalDiffuse = mix(totalDiffuse, paneCol * 0.85, paneA);');
  };
  m.customProgramCacheKey = () => 'teams-room-pane-v1';
  return { material: m, uniforms, base: m.color.clone() };
}

function roundedSlab(w: number, h: number, r: number, depth: number) {
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
  const g = new ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 8 });
  g.translate(0, 0, -depth / 2);
  return g;
}

// ─── Layout ──────────────────────────────────────────────────────────────────

interface Pane {
  w: number;
  h: number;
  x: number;
  /** Height of the pane's centre above the floor. */
  y: number;
  z: number;
  ry: number;
  draw: (ctx: CanvasRenderingContext2D, W: number, H: number) => void;
}

interface RoomPlan {
  sign: { w: number; x: number; top: number; align: 'left' | 'center' };
  panes: Pane[];
  piece: { x: number; z: number; scale: number } | null;
}

const pad2 = (i: number) => String(i).padStart(2, '0');

function plan(d: TeamDomain, comp: Composition): RoomPlan {
  const size = roomSize(comp);
  const core = !!d.officers;
  const P = comp.portrait;
  if (core) {
    // CORE: a symmetrical chamber — four stones, one for each office, lining the axis.
    const w = P ? 0.9 : 1.0;
    const h = P ? 1.95 : 2.1;
    // A converging nave: the nearer pair wide, the farther pair closer to the
    // axis, so all four stand in view and lead the eye to the name.
    const xNear = P ? 1.0 : 1.55;
    const xFar = P ? 0.6 : 0.9;
    const zs = P ? [-3.9, -5.9] : [-3.9, -5.7];
    const ry = P ? 0.38 : 0.5;
    const officers = d.officers!;
    // Chair and vice-chair nearest, secretary and treasurer beyond.
    const spots = [
      { x: -xNear, z: zs[0], ry },
      { x: xNear, z: zs[0], ry: -ry },
      { x: -xFar, z: zs[1], ry: ry * 0.6 },
      { x: xFar, z: zs[1], ry: -ry * 0.6 },
    ];
    return {
      sign: { w: P ? 3.6 : 3.4, x: 0, top: size.h - size.floor - (P ? 0.9 : 0.55), align: 'center' },
      piece: null,
      panes: officers.map((o, i) => ({
        w,
        h,
        x: spots[i].x,
        y: 0.14 + h / 2,
        z: spots[i].z,
        ry: spots[i].ry,
        draw: (ctx, W, H) => {
          const u = W / 512;
          const left = 44 * u;
          typeset(ctx, o.role.toUpperCase(), left, H * 0.5, { family: 'mono', size: 24 * u, weight: 500, tracking: 0.16 }, 'label');
          // The name as large as the stone allows, never leaving a lone initial on its own line.
          let size = 84 * u;
          let lines: string[] = [];
          for (; size > 40 * u; size *= 0.94) {
            applyType(ctx, { family: 'serif', size, color: INK.name });
            lines = wrap(ctx, o.name, W - left * 2);
            if (lines.length <= 2 && lines[lines.length - 1].length > 2) break;
          }
          lines.forEach((l, li) => ctx.fillText(l, left, H * 0.5 + size * 1.15 + li * size * 1.02));
          ctx.fillStyle = INK.label;
          ctx.fillRect(left, H * 0.5 - 52 * u, 34 * u, Math.max(1, 2 * u));
        },
      })),
    };
  }
  const members = d.members;
  const pane: Pane = P
    ? { w: 1.7, h: 1.1, x: -0.45, y: 0.9, z: -3.4, ry: 0.2, draw: () => undefined }
    : { w: 1.9, h: 1.15, x: 0, y: 1.15, z: -4.0, ry: 0.3, draw: () => undefined };
  if (!P) {
    // As tall as its names need (the layout below, in 1024ths of its width), its top edge level.
    const top = pane.y + pane.h / 2;
    pane.h = (pane.w * (380 + 150 * (members.length - 1))) / 1024;
    pane.y = top - pane.h / 2;
    // Stand the pane to the left of the axis, its outer edge kept inside the
    // frame at any window shape (the eye rests at z = -ROOM_EYE).
    const tanX = Math.tan(((roomFov(comp) / 2) * Math.PI) / 180) * comp.aspect;
    const ex = (pane.w / 2) * Math.cos(pane.ry);
    const ez = pane.z + (pane.w / 2) * Math.sin(pane.ry);
    pane.x = -Math.max(0.7, Math.min(1.3, 0.86 * (-ez - ROOM_EYE) * tanX - ex));
  }
  pane.draw = (ctx, W, H) => {
    const u = W / 1024;
    const left = 70 * u;
    let y = 96 * u;
    typeset(ctx, 'MEMBERS', left, y, { family: 'mono', size: 24 * u, weight: 500, tracking: 0.18 }, 'label');
    ctx.fillStyle = INK.label;
    ctx.fillRect(left, y + 26 * u, W - left * 2, Math.max(1, 1.5 * u));
    y += 130 * u;
    members.forEach((name, i) => {
      typeset(ctx, pad2(i + 1), left, y - 10 * u, { family: 'mono', size: 24 * u, tracking: 0.12 }, 'label');
      applyType(ctx, { family: 'serif', size: 82 * u, color: INK.name });
      const lines = wrap(ctx, name, W - left * 2 - 90 * u);
      lines.forEach((l, li) => ctx.fillText(l, left + 90 * u, y + li * 80 * u));
      y += Math.max(1, lines.length) * 80 * u + 70 * u;
    });
    void H;
  };
  return {
    sign: P ? { w: 3.8, x: 0, top: size.h - size.floor - 0.9, align: 'center' } : { w: 3.9, x: -3.1, top: size.h - size.floor - 0.55, align: 'left' },
    panes: [pane],
    piece: P ? { x: 0.35, z: -5.7, scale: 0.8 } : { x: 1.55, z: -5.2, scale: 1 },
  };
}

/** The back-wall signage: index, the domain's name as the card set it, the count of its people. */
function drawSign(ctx: CanvasRenderingContext2D, W: number, H: number, d: TeamDomain, index: number, align: 'left' | 'center') {
  const u = W / 1024;
  const x = align === 'center' ? W / 2 : 8 * u;
  const tAlign: CanvasTextAlign = align === 'center' ? 'center' : 'left';
  let y = 40 * u;
  typeset(ctx, `${pad2(index + 1)} / ${pad2(TEAM_DOMAINS.length)}`, x, y, { family: 'mono', size: 26 * u, weight: 500, tracking: 0.2, align: tAlign }, 'label');
  // The name: as large as it sits in three lines at most.
  let size = 96 * u;
  let lines: string[] = [];
  for (; size > 30 * u; size *= 0.94) {
    applyType(ctx, { family: 'sans', size, weight: 600, stretch: 'expanded', tracking: 0.01, color: INK.name, align: tAlign });
    lines = wrap(ctx, d.name, W - 16 * u);
    if (lines.length <= 3 && Math.max(...lines.map((l) => ctx.measureText(l).width)) <= W - 16 * u) break;
  }
  y += 34 * u + size * 0.9;
  applyType(ctx, { family: 'sans', size, weight: 600, stretch: 'expanded', tracking: 0.01, color: INK.name, align: tAlign });
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * size * 1.02));
  y += (lines.length - 1) * size * 1.02 + 60 * u;
  const people = d.officers ? d.officers.length : d.members.length;
  const count = `${people} ${d.officers ? (people === 1 ? 'OFFICER' : 'OFFICERS') : people === 1 ? 'MEMBER' : 'MEMBERS'}`;
  ctx.fillStyle = INK.label;
  ctx.fillRect(align === 'center' ? W / 2 - 22 * u : x, y - 26 * u, 44 * u, Math.max(1, 2 * u));
  typeset(ctx, count, x, y + 12 * u, { family: 'mono', size: 22 * u, tracking: 0.2, align: tAlign }, 'label');
  void H;
}

// ─── A room ──────────────────────────────────────────────────────────────────

interface Shared {
  stone: MeshStandardMaterial;
  metal: MeshStandardMaterial;
  dark: MeshStandardMaterial;
  glass: MeshPhysicalMaterial;
  base: Record<'stone' | 'metal' | 'dark' | 'glass', Color>;
}

function Room({ index, comp, env, shared }: { index: number; comp: Composition; env: Texture | null; shared: Shared }) {
  const group = useRef<Group>(null);
  const piece = useRef<Group>(null);
  const gl = useThree((s) => s.gl);
  const d = TEAM_DOMAINS[index];
  const quality = useExperience((s) => s.quality);
  const scale = Math.max(0.5, QUALITY[quality].textureScale);
  const size = roomSize(comp);

  const res = useDisposable(() => {
    const layout = plan(d, comp);
    const tone = new Color(d.tone);
    const shellGeo = new BoxGeometry(size.w, size.h, size.depth);
    shellGeo.translate(0, size.h / 2 - size.floor, -size.depth / 2);
    const shell = new ShaderMaterial({
      vertexShader: SHELL_VERT,
      fragmentShader: SHELL_FRAG,
      side: BackSide,
      uniforms: {
        uTone: { value: tone.clone() },
        uReveal: { value: 0 },
        uSize: { value: new Vector3(size.w, size.h, size.depth) },
        uFloor: { value: size.floor },
        uCore: { value: d.officers ? 1 : 0 },
      },
    });
    // Signage on the back wall.
    const signW = Math.round(1024 * scale);
    const signH = Math.round(signW * 0.5);
    const sign = makeCanvas(signW, signH);
    const signTex = toTexture(sign.canvas, { anisotropy: 8 });
    const signPlaneW = layout.sign.w;
    const signPlaneH = signPlaneW * 0.5;
    const signGeo = new PlaneGeometry(signPlaneW, signPlaneH);
    const signMat = new ShaderMaterial({
      vertexShader: SIGN_VERT,
      fragmentShader: SIGN_FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: { uTex: { value: signTex }, uInk: { value: new Color('#e9e3d7') }, uTone: { value: tone.clone().lerp(new Color('#ffffff'), 0.2) }, uK: { value: 0 } },
    });
    // The people's panes (or CORE's stones).
    const transmission = quality === 'low' ? 0.8 : 0.88;
    const panes = layout.panes.map((p) => {
      const W = Math.round((d.officers ? 512 : 1024) * scale);
      const cv = makeCanvas(W, Math.round((W * p.h) / p.w));
      const tex = toTexture(cv.canvas, { anisotropy: 8 });
      const geo = roundedSlab(p.w, p.h, 0.05, 0.06);
      const glass = printedGlass(tex, p.w, p.h, env, tone, transmission);
      // A low stone foot and two fine posts.
      const foot = new BoxGeometry(p.w * 0.72, 0.1, 0.32);
      return { p, cv, tex, geo, glass, foot };
    });
    const postGeo = new BoxGeometry(0.012, 1, 0.012);
    // The centerpiece.
    const parts = layout.piece ? buildCenterpiece(d.slug) : {};
    const accent = new MeshStandardMaterial({ color: tone.clone(), emissive: tone.clone(), emissiveIntensity: 0.55, roughness: 0.4, metalness: 0.1 });
    return { layout, shellGeo, shell, sign, signTex, signGeo, signMat, panes, postGeo, parts, accent, accentBase: tone.clone() };
  }, [d, index, comp.portrait, comp.aspect, env, quality, scale]);

  // Type is drawn in idle time after mount (staggered by room), then uploaded,
  // so choosing a card never waits on a canvas.
  useEffect(() => {
    let alive = true;
    let handle = 0;
    const draw = () => {
      if (!alive) return;
      const { sign, signTex, panes, layout } = res;
      sign.ctx.fillStyle = '#000';
      sign.ctx.fillRect(0, 0, sign.canvas.width, sign.canvas.height);
      drawSign(sign.ctx, sign.canvas.width, sign.canvas.height, d, index, layout.sign.align);
      signTex.needsUpdate = true;
      gl.initTexture(signTex);
      for (const pn of panes) {
        pn.cv.ctx.fillStyle = '#000';
        pn.cv.ctx.fillRect(0, 0, pn.cv.canvas.width, pn.cv.canvas.height);
        pn.p.draw(pn.cv.ctx, pn.cv.canvas.width, pn.cv.canvas.height);
        pn.tex.needsUpdate = true;
        gl.initTexture(pn.tex);
      }
    };
    const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (h: number) => void };
    void fontsReady().then(() => {
      if (!alive) return;
      const run = () => draw();
      const delay = 300 + index * 180;
      const t = window.setTimeout(() => {
        if (w.requestIdleCallback) handle = w.requestIdleCallback(run, { timeout: 600 });
        else run();
      }, delay);
      handle = t;
    });
    return () => {
      alive = false;
      window.clearTimeout(handle);
      w.cancelIdleCallback?.(handle);
    };
  }, [res, d, index, gl]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const f = teamsFrame.focus;
    const mine = teams().selected === index;
    // The room's light comes up behind the glass as the eye closes on it…
    const reveal = mine ? smoothstep(0.45, 0.8, f) : 0;
    g.visible = reveal > 0.001;
    if (!g.visible) return;
    cardCenter(index, comp, g.position, FOCUS_PUSH);
    g.rotation.set(0, cardAngle(index), 0);
    res.shell.uniforms.uReveal.value = reveal;
    // …then, as it arrives: the name, the idea, the people.
    const kSign = smoothstep(0.74, 0.9, f);
    const kPiece = smoothstep(0.78, 0.95, f);
    const kPeople = smoothstep(0.82, 0.99, f);
    res.signMat.uniforms.uK.value = kSign;
    // Materials come up with the room's own light (never black cut-outs against a
    // lit wall); what arrives in layers is the information: the name inks in,
    // the piece settles into place, the people ink in.
    for (const k of ['stone', 'metal', 'dark', 'glass'] as const) shared[k].color.copy(shared.base[k]).multiplyScalar(0.15 + 0.85 * reveal);
    res.accent.color.copy(res.accentBase).multiplyScalar(0.2 + 0.8 * kPiece);
    res.accent.emissiveIntensity = 0.55 * kPiece;
    if (piece.current) piece.current.position.y = -size.floor - 0.12 * (1 - kPiece);
    for (const pn of res.panes) {
      pn.glass.uniforms.uInkK.value = kPeople;
      pn.glass.material.color.copy(pn.glass.base).multiplyScalar(0.2 + 0.8 * reveal);
    }
  });

  const { layout } = res;
  const pieceMats: Record<PieceMaterial, MeshStandardMaterial | MeshPhysicalMaterial> = { stone: shared.stone, metal: shared.metal, dark: shared.dark, glass: shared.glass, accent: res.accent };
  return (
    <group ref={group} name={`room-${d.slug}`} visible={false}>
      <mesh geometry={res.shellGeo} material={res.shell} frustumCulled={false} />
      <mesh
        geometry={res.signGeo}
        material={res.signMat}
        position={[layout.sign.align === 'center' ? 0 : layout.sign.x + layout.sign.w / 2, layout.sign.top - (layout.sign.w * 0.5) / 2, -size.depth + 0.015]}
      />
      {res.panes.map((pn, i) => (
        <group key={i} position={[pn.p.x, pn.p.y - size.floor, pn.p.z]} rotation={[0, pn.p.ry, 0]}>
          <mesh geometry={pn.geo} material={pn.glass.material} />
          <mesh geometry={pn.foot} material={shared.stone} position={[0, -pn.p.y + 0.05, 0]} />
          {[-0.3, 0.3].map((sx) => (
            <mesh key={sx} geometry={res.postGeo} material={shared.metal} position={[sx * pn.p.w, -pn.p.y / 2 - pn.p.h / 4 + 0.05, 0]} scale={[1, Math.max(0.01, pn.p.y - pn.p.h / 2 - 0.1), 1]} />
          ))}
        </group>
      ))}
      {layout.piece && (
        <group ref={piece} position={[layout.piece.x, -size.floor, layout.piece.z]} scale={layout.piece.scale}>
          {(Object.keys(res.parts) as PieceMaterial[]).map((k) => (
            <mesh key={k} geometry={res.parts[k]} material={pieceMats[k]} />
          ))}
        </group>
      )}
    </group>
  );
}

// ─── All of them ─────────────────────────────────────────────────────────────

export function DomainInterior({ comp, env }: { comp: Composition; env: Texture | null }) {
  const quality = useExperience((s) => s.quality);
  const shared = useDisposable(() => {
    const stone = new MeshStandardMaterial({ color: '#d2cbbe', roughness: 0.86, metalness: 0.03, envMap: env, envMapIntensity: 0.45 });
    const metal = new MeshStandardMaterial({ color: '#c7c1b6', roughness: 0.3, metalness: 0.9, envMap: env, envMapIntensity: 1.0 });
    const dark = new MeshStandardMaterial({ color: '#15171b', roughness: 0.18, metalness: 0.35, envMap: env, envMapIntensity: 1.1 });
    const glass = new MeshPhysicalMaterial({
      color: '#dfe3e4',
      roughness: 0.55,
      transmission: quality === 'low' ? 0.8 : 0.9,
      thickness: 0.3,
      ior: 1.5,
      clearcoat: 0.8,
      clearcoatRoughness: 0.34,
      envMap: env,
      envMapIntensity: 0.8,
      side: DoubleSide,
    });
    return { stone, metal, dark, glass, base: { stone: stone.color.clone(), metal: metal.color.clone(), dark: dark.color.clone(), glass: glass.color.clone() } };
  }, [env, quality]);
  return (
    <group name="domain-rooms">
      {TEAM_DOMAINS.map((d, i) => (
        <Room key={`${d.slug}-${comp.portrait}`} index={i} comp={comp} env={env} shared={shared} />
      ))}
    </group>
  );
}

/** A point in a domain's room (room-local metres: x right, y up from the eye, z into the room negative) in world space. */
export function roomPoint(index: number, comp: Composition, x: number, y: number, z: number, out: Vector3) {
  const a = cardAngle(index);
  cardCenter(index, comp, out, FOCUS_PUSH);
  out.x += Math.cos(a) * x + Math.sin(a) * z;
  out.y += y;
  out.z += -Math.sin(a) * x + Math.cos(a) * z;
  return out;
}
