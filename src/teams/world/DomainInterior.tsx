'use client';
/** Content is a lit surface beyond the selected plate, not a screen-space modal. */
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { type Mesh, MeshStandardMaterial, PlaneGeometry, Vector3 } from 'three';
import { TEAM_DOMAINS } from '@/content/teams';
import { useDisposable } from '@/systems/performance/useDisposable';
import { applyType, fontsReady, makeCanvas, paragraph, text, toTexture } from '@/systems/textures/typeset';
import { FOCUS_PUSH } from '../camera';
import { cardAngle, cardCenter, type Composition } from '../layout';
import { teamsFrame, useTeams } from '../state';

const position = new Vector3();
function Interior({ index, comp }: { index: number; comp: Composition }) {
  const mesh = useRef<Mesh>(null);
  const d = TEAM_DOMAINS[index];
  // Fit a readable composition to each viewport; portrait uses a single column.
  const h = 2 * 3 * Math.tan(comp.detailFov * Math.PI / 360) * 0.70;
  const w = h * comp.aspect * 0.86 / 0.70;
  const res = useDisposable(() => {
    const { canvas, ctx } = makeCanvas(1200 * w / h, 1200);
    const texture = toTexture(canvas);
    const material = new MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: '#ffffff', emissiveIntensity: 0.65, roughness: 0.85, transparent: true, depthWrite: false, opacity: 0 });
    return { canvas, ctx, texture, material, geometry: new PlaneGeometry(w, h) };
  }, [w, h]);
  useEffect(() => {
    let alive = true;
    const draw = () => {
      if (!alive) return;
      const { ctx, canvas } = res, width = canvas.width;
      ctx.clearRect(0, 0, width, 1200);
      const pad = comp.portrait ? 14 : 60;
      text(ctx, `ACM CEG / ${String(index + 1).padStart(2, '0')}`, pad, 55, { family: 'mono', size: 24, tracking: 0.12, color: d.tone });
      const y = paragraph(ctx, d.name, pad, 180, width - pad * 2, comp.portrait ? 83 : 118, { family: 'sans', size: comp.portrait ? 76 : 110, weight: 500, tracking: -0.035 });
      const start = Math.max(comp.portrait ? 335 : 440, y + 65);
      if (d.officers) {
        d.officers.forEach((officer, i) => {
          const x = pad + (comp.portrait ? 0 : i % 2 * (width - pad * 2) / 2);
          const top = start + (comp.portrait ? i * 190 : Math.floor(i / 2) * 270);
          text(ctx, officer.role.toUpperCase(), x, top, { family: 'mono', size: 23, tracking: 0.10, color: d.tone });
          text(ctx, officer.name, x, top + 63, { family: 'sans', size: comp.portrait ? 43 : 52, weight: 500 });
          text(ctx, officer.rollNumber, x, top + 110, { family: 'mono', size: 28, color: '#a4b2b7' });
        });
      } else {
        text(ctx, 'DOMAIN DIRECTORS', pad, start, { family: 'mono', size: 24, tracking: 0.10, color: d.tone });
        d.members.forEach((name, i) => {
          // Preserve every name; long names wrap rather than truncate.
          applyType(ctx, { family: 'sans', size: comp.portrait ? 48 : 62 });
          paragraph(ctx, name, pad, start + 100 + i * 140, width - pad * 2, 62, { family: 'sans', size: comp.portrait ? 48 : 62 });
        });
      }
      res.texture.needsUpdate = true;
    };
    draw(); void fontsReady().then(draw);
    return () => { alive = false; };
  }, [d, index, comp.portrait, res]);
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const a = cardAngle(index);
    cardCenter(index, comp, position, FOCUS_PUSH - 3.8);
    m.position.copy(position);
    m.rotation.y = a;
    m.visible = teamsFrame.domainReveal > 0.001;
    res.material.opacity = teamsFrame.domainReveal;
  });
  return <mesh ref={mesh} name={`interior-${d.slug}`} geometry={res.geometry} material={res.material} />;
}
export function DomainInterior({ comp }: { comp: Composition }) {
  const selected = useTeams(s => s.selected);
  return selected === null ? null : <Interior key={selected} index={selected} comp={comp} />;
}
