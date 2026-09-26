'use client';
/** Physical plates, lit ink and articulated mounts share one spatial layout. */
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Color, CylinderGeometry, ExtrudeGeometry, type Group, type Mesh, MeshPhysicalMaterial, MeshStandardMaterial, PlaneGeometry, Shape, type Texture, Vector3 } from 'three';
import { QUALITY } from '@/config/quality';
import { DOMAIN_COUNT, TEAM_DOMAINS, type TeamDomain } from '@/content/teams';
import { useExperience } from '@/store/experience';
import { smoothstep } from '@/systems/camera/pose';
import { useDisposable } from '@/systems/performance/useDisposable';
import { makeCanvas, toTexture } from '@/systems/textures/typeset';
import { FOCUS_PUSH } from '../camera';
import { cardPick } from '../controller';
import { cardAngle, cardCenter, cardY, O, spineAxis, type Composition } from '../layout';
import { teamsFrame } from '../state';
import { drawCardFace } from './cardFace';

function roundedRect(w: number, h: number, r: number) {
  const s = new Shape();
  s.moveTo(-w/2+r, -h/2); s.lineTo(w/2-r, -h/2);
  s.quadraticCurveTo(w/2, -h/2, w/2, -h/2+r); s.lineTo(w/2, h/2-r);
  s.quadraticCurveTo(w/2, h/2, w/2-r, h/2); s.lineTo(-w/2+r, h/2);
  s.quadraticCurveTo(-w/2, h/2, -w/2, h/2-r); s.lineTo(-w/2, -h/2+r);
  s.quadraticCurveTo(-w/2, -h/2, -w/2+r, -h/2);
  return s;
}
export const appearAt = (i: number, arrival: number) => {
  const start = 0.30 + i / Math.max(1, DOMAIN_COUNT - 1) * 0.35;
  return smoothstep(start, start + 0.20, arrival);
};
const c = new Vector3(), anchor = new Vector3(), elbow = new Vector3(), end = new Vector3(), direction = new Vector3(), up = new Vector3(0, 1, 0);
function mount(mesh: Mesh | null, a: Vector3, b: Vector3) {
  if (!mesh) return;
  direction.subVectors(b, a);
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  mesh.scale.set(1, direction.length(), 1);
  mesh.quaternion.setFromUnitVectors(up, direction.normalize());
}

function DomainCard({ d, i, comp, env }: { d: TeamDomain; i: number; comp: Composition; env: Texture | null }) {
  const group = useRef<Group>(null), face = useRef<Mesh>(null), armA = useRef<Mesh>(null), armB = useRef<Mesh>(null), arms = useRef<Group>(null);
  const quality = useExperience(s => s.quality);
  const scale = QUALITY[quality].textureScale;
  const geo = useDisposable(() => {
    const slab = new ExtrudeGeometry(roundedRect(comp.cardW, comp.cardH, comp.corner), {
      depth: comp.cardDepth, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 8,
    });
    slab.translate(0, 0, -comp.cardDepth/2);
    return { slab, plane: new PlaneGeometry(comp.cardW, comp.cardH), arm: new CylinderGeometry(0.025, 0.045, 1, 8) };
  }, [comp.cardW, comp.cardH, comp.corner, comp.cardDepth]);
  const tex = useDisposable(() => {
    const w = Math.round((comp.portrait ? 720 : 1024) * Math.max(0.6, scale));
    const { canvas, ctx } = makeCanvas(w, Math.round(w * comp.cardH / comp.cardW));
    return { canvas, ctx, texture: toTexture(canvas, { anisotropy: 8 }) };
  }, [comp.cardW, comp.cardH, comp.portrait, scale]);
  const mats = useDisposable(() => {
    const tone = new Color(d.tone);
    const glass = new MeshPhysicalMaterial({
      color: new Color('#a0acae').lerp(tone, 0.32), metalness: 0.04, roughness: 0.25,
      transmission: quality === 'high' ? 0.62 : quality === 'medium' ? 0.48 : 0,
      thickness: comp.cardDepth, ior: 1.28, attenuationColor: tone.clone().lerp(new Color('white'), 0.65), attenuationDistance: 3,
      clearcoat: 0.45, clearcoatRoughness: 0.22, envMap: env, envMapIntensity: 0.8,
      transparent: quality === 'low', opacity: quality === 'low' ? 0.76 : 1, depthWrite: quality !== 'low',
    });
    // Microscopic surface variation, not another blur/refraction pass.
    glass.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + 0.012 * sin(vViewPosition.x * 191.0) * sin(vViewPosition.y * 173.0), 0.0, 1.0);');
    };
    glass.customProgramCacheKey = () => 'teams-satin-plate-v1';
    const ink = new MeshStandardMaterial({ map: tex.texture, emissiveMap: tex.texture, emissive: 'white', emissiveIntensity: 0.16, roughness: 0.68, metalness: 0.08, transparent: true, depthWrite: false });
    const mountMaterial = new MeshStandardMaterial({ color: '#6e7778', metalness: 0.7, roughness: 0.38, envMap: env });
    return { glass, ink, mountMaterial, base: glass.color.clone() };
  }, [d.tone, quality, env, tex, comp.cardDepth]);
  useEffect(() => {
    drawCardFace(tex.ctx, tex.canvas.width, tex.canvas.height, d, i, comp.corner / comp.cardW * tex.canvas.width, { portrait: comp.portrait, mode: 'settled', t: 1, seed: i });
    tex.texture.needsUpdate = true;
  }, [tex, d, i, comp]);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const f = teamsFrame, reduced = useExperience.getState().reducedMotion;
    const appear = appearAt(i, f.reveal), near = Math.max(0, 1 - Math.abs(f.focusK - i));
    const selected = smoothstep(0, 0.28, f.focus) * near, others = f.focus * (1 - near);
    const hover = f.hoverAmt[i] * (1 - selected), a = cardAngle(i);
    const hx = f.hover === i ? f.hoverAt.x / (comp.cardW/2) : 0;
    const hy = f.hover === i ? f.hoverAt.y / (comp.cardH/2) : 0;
    cardCenter(i, comp, c, FOCUS_PUSH * selected + 0.8 * others + hover * 0.035 + (1 - appear) * 1.4);
    c.y += (reduced ? 0 : Math.sin(clock.elapsedTime * 0.5 - i) * 0.012) * (1 - selected);
    g.position.copy(c);
    const toward = Math.max(-0.18, Math.min(0.18, (cardAngle(Math.max(0, f.c)) - a) * 0.16));
    g.rotation.set(-hy * hover * 0.018, a + toward * (1 - selected) + hx * hover * 0.02 + Math.sign(i - f.focusK) * others * 0.12, 0, 'YXZ');
    g.scale.setScalar(0.94 + appear * 0.06);
    g.visible = appear > 0.002 && (near > 0.5 || f.focus < 0.96);
    mats.glass.color.copy(mats.base).multiplyScalar(1 - 0.8 * others);
    mats.glass.envMapIntensity = (0.65 + 0.15 * appear + 0.08 * hover) * (1 - 0.8 * others);
    mats.glass.roughness = 0.25 - hover * 0.015;
    mats.ink.opacity = appear * (1 - 0.95 * others) * (1 - smoothstep(0.65, 0.9, f.focus * near));
    // Articulated struts connect the moving plate to the same curve as the spine.
    spineAxis(cardY(i, comp), anchor).add(O);
    elbow.copy(anchor); elbow.x += Math.sin(a) * 1.05; elbow.z += Math.cos(a) * 1.05; elbow.y -= 0.22;
    end.copy(c); end.x -= Math.sin(a) * comp.cardDepth/2; end.z -= Math.cos(a) * comp.cardDepth/2;
    mount(armA.current, anchor, elbow); mount(armB.current, elbow, end);
    if (arms.current) arms.current.visible = g.visible && f.focus < 0.9;
    g.updateMatrixWorld();
    const pick = cardPick[i];
    if (face.current) pick.matrix.copy(face.current.matrixWorld);
    pick.hw = comp.cardW/2; pick.hh = comp.cardH/2; pick.radius = comp.corner;
    pick.live = g.visible && appear > 0.9 && f.focus < 0.02;
  });
  return <>
    <group ref={arms}><mesh ref={armA} geometry={geo.arm} material={mats.mountMaterial} /><mesh ref={armB} geometry={geo.arm} material={mats.mountMaterial} /></group>
    <group ref={group} name={`card-${d.slug}`}>
      <mesh geometry={geo.slab} material={mats.glass} />
      <mesh ref={face} geometry={geo.plane} material={mats.ink} position={[0, 0, comp.cardDepth/2 + 0.015]} />
    </group>
  </>;
}
export function DomainCards({ comp, env }: { comp: Composition; env: Texture | null }) {
  useEffect(() => () => { for (const p of cardPick) p.live = false; }, []);
  return <group name="domain-cards">{TEAM_DOMAINS.map((d, i) => <DomainCard key={`${d.slug}-${comp.portrait}`} d={d} i={i} comp={comp} env={env} />)}</group>;
}
