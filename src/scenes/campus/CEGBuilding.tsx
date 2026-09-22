'use client';
/**
 * The CEG red building (see cegModel.ts for how it is derived). Renders the
 * mass, roofs and bespoke parts as meshes and every repeated element as an
 * InstancedMesh — about twenty draw calls for the whole building.
 */
import { useLayoutEffect, useMemo } from 'react';
import {
  BoxGeometry,
  CircleGeometry,
  Color,
  InstancedMesh,
  LatheGeometry,
  type Material,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  TorusGeometry,
  Vector2,
} from 'three';
import { QUALITY } from '@/config/quality';
import { rng } from '@/lib/random';
import { useExperience } from '@/store/experience';
import { useDisposable } from '@/systems/performance/useDisposable';
import { plasterTexture, roofTileTexture } from '@/systems/textures/surfaces';
import { fitSize, makeCanvas, text, toTexture } from '@/systems/textures/typeset';
import { ModelSlot } from '../shared/ModelSlot';
import { type BoxCat, buildCegModel } from './cegModel';

function clockTexture() {
  const { canvas, ctx } = makeCanvas(512, 512);
  const c = 256;
  ctx.fillStyle = '#f7f4ec';
  ctx.beginPath();
  ctx.arc(c, c, 250, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1b1a18';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(c, c, 236, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(c, c, 176, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const r0 = i % 5 === 0 ? 206 : 218;
    ctx.lineWidth = i % 5 === 0 ? 6 : 3;
    ctx.beginPath();
    ctx.moveTo(c + Math.sin(a) * r0, c - Math.cos(a) * r0);
    ctx.lineTo(c + Math.sin(a) * 228, c - Math.cos(a) * 228);
    ctx.stroke();
  }
  const numerals = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  ctx.fillStyle = '#1b1a18';
  ctx.font = '600 34px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  numerals.forEach((n, i) => {
    const a = (i / 12) * Math.PI * 2;
    ctx.save();
    ctx.translate(c + Math.sin(a) * 192, c - Math.cos(a) * 192);
    ctx.rotate(a);
    ctx.fillText(n, 0, 0);
    ctx.restore();
  });
  // Ten to six — the golden hour the journey opens in.
  const hand = (angle: number, len: number, w: number) => {
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(angle);
    ctx.fillStyle = '#141311';
    ctx.beginPath();
    ctx.moveTo(-w / 2, 20);
    ctx.lineTo(w / 2, 20);
    ctx.lineTo(w * 0.15, -len);
    ctx.lineTo(-w * 0.15, -len);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  hand((5 + 50 / 60) * (Math.PI / 6), 120, 16);
  hand((50 / 60) * Math.PI * 2, 190, 11);
  ctx.beginPath();
  ctx.arc(c, c, 12, 0, Math.PI * 2);
  ctx.fill();
  return toTexture(canvas);
}

function signTexture(w: number, h: number) {
  const { canvas, ctx } = makeCanvas(1400, Math.round((1400 * h) / w));
  ctx.fillStyle = '#16171a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(240,236,226,0.8)';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
  const label = 'COLLEGE OF ENGINEERING GUINDY';
  const spec = { family: 'serif' as const, size: 120, weight: 700, color: '#f2efe6', tracking: 0.02 };
  const size = fitSize(ctx, label, canvas.width * 0.92, spec, canvas.height * 0.62);
  text(ctx, label, canvas.width / 2, canvas.height * 0.68, { ...spec, size, align: 'center' });
  return toTexture(canvas);
}

function balusterGeometry() {
  const pts = [
    [0.075, 0],
    [0.075, 0.07],
    [0.045, 0.11],
    [0.058, 0.2],
    [0.078, 0.33],
    [0.05, 0.5],
    [0.034, 0.6],
    [0.052, 0.68],
    [0.075, 0.72],
    [0.075, 0.8],
  ].map(([x, y]) => new Vector2(x, y));
  return new LatheGeometry(pts, 10);
}

function ProceduralBuilding() {
  const quality = useExperience((s) => s.quality);
  const q = QUALITY[quality];
  const model = useDisposable(() => buildCegModel({ mullions: quality !== 'low', clerestory: quality !== 'low' }), [quality]);

  const res = useDisposable(() => {
    const plaster = plasterTexture(q.textureScale);
    plaster.texture.repeat.set(1 / plaster.tile, 1 / plaster.tile);
    const tiles = roofTileTexture(q.textureScale);
    tiles.texture.repeat.set(1 / tiles.tile, 1 / tiles.tile);
    const wall = new MeshStandardMaterial({ map: plaster.texture, roughness: 0.9 });
    const trim = new MeshStandardMaterial({ color: '#e4d6ba', roughness: 0.82 });
    const quoin = new MeshStandardMaterial({ color: '#ecdfc3', roughness: 0.8 });
    const mats: Record<BoxCat | 'lit', Material> = {
      wall,
      trim,
      quoin,
      white: new MeshStandardMaterial({ color: '#f2f1eb', roughness: 0.55 }),
      glass: new MeshStandardMaterial({ color: '#1b2229', roughness: 0.12, metalness: 0.55 }),
      lit: new MeshBasicMaterial({ color: new Color('#f0a458').multiplyScalar(1.05) }),
      hood: new MeshStandardMaterial({ color: '#7c3427', roughness: 0.92 }),
      dark: new MeshStandardMaterial({ color: '#221c18', roughness: 0.9 }),
      dome: new MeshStandardMaterial({ color: '#f3f0e8', roughness: 0.5 }),
    };
    return {
      textures: [plaster.texture, tiles.texture],
      mats,
      roof: new MeshStandardMaterial({ map: tiles.texture, roughness: 0.95 }),
      shadowDark: new MeshStandardMaterial({ color: '#120e0c', roughness: 1 }),
      domeMat: new MeshStandardMaterial({ color: '#f5f2eb', roughness: 0.45 }),
      unitBox: new BoxGeometry(1, 1, 1),
      baluster: balusterGeometry(),
      clockTex: clockTexture(),
      clockGeo: new CircleGeometry(1.12, 48),
      clockRing: new TorusGeometry(1.16, 0.07, 8, 48),
      signTex: signTexture(model.sign.width, model.sign.height),
      signGeo: new PlaneGeometry(model.sign.width, model.sign.height),
    };
  }, [q.textureScale, model]);

  // Instanced meshes, built once per model.
  const instanced = useMemo(() => {
    const out: InstancedMesh[] = [];
    const r = rng(44);
    (Object.keys(model.batch) as BoxCat[]).forEach((cat) => {
      const arr = model.batch[cat];
      const count = arr.length / 16;
      if (!count) return;
      if (cat === 'glass') {
        // A quarter of the rooms have their lights on at dusk.
        const lit: number[] = [];
        const dark: number[] = [];
        for (let i = 0; i < count; i++) (r() < 0.14 ? lit : dark).push(...arr.slice(i * 16, i * 16 + 16));
        for (const [list, mat] of [
          [dark, res.mats.glass],
          [lit, res.mats.lit],
        ] as const) {
          if (!list.length) continue;
          const m = new InstancedMesh(res.unitBox, mat, list.length / 16);
          m.instanceMatrix.array.set(list);
          m.computeBoundingSphere();
          out.push(m);
        }
        return;
      }
      const m = new InstancedMesh(res.unitBox, res.mats[cat], count);
      m.instanceMatrix.array.set(arr);
      m.computeBoundingSphere();
      m.castShadow = q.shadows && (cat === 'wall' || cat === 'trim' || cat === 'quoin');
      m.receiveShadow = q.shadows;
      out.push(m);
    });
    const bal = new InstancedMesh(res.baluster, res.mats.quoin, model.balusters.length / 16);
    bal.instanceMatrix.array.set(model.balusters);
    bal.computeBoundingSphere();
    out.push(bal);
    return out;
  }, [model, res, q.shadows]);

  useLayoutEffect(() => () => instanced.forEach((m) => m.dispose()), [instanced]);

  return (
    <group name="ceg-building">
      <mesh geometry={model.mass} material={res.mats.wall} castShadow={q.shadows} receiveShadow={q.shadows} />
      <mesh geometry={model.roofs} material={res.roof} castShadow={q.shadows} receiveShadow={q.shadows} />
      <mesh geometry={model.porchWalls} material={res.mats.wall} castShadow={q.shadows} receiveShadow={q.shadows} />
      <mesh geometry={model.darkShapes} material={res.shadowDark} />
      <mesh geometry={model.archivolts} material={res.mats.quoin} />
      <mesh geometry={model.drum} material={res.mats.quoin} castShadow={q.shadows} />
      <mesh geometry={model.dome} material={res.domeMat} castShadow={q.shadows} />
      {instanced.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
      {model.clocks.map((c, i) => (
        <group key={i} position={c.position} rotation={[0, c.ry, 0]}>
          <mesh geometry={res.clockGeo}>
            <meshBasicMaterial map={res.clockTex} toneMapped />
          </mesh>
          <mesh geometry={res.clockRing} material={res.mats.dark} />
        </group>
      ))}
      <mesh geometry={res.signGeo} position={model.sign.position}>
        <meshStandardMaterial map={res.signTex} roughness={0.6} emissiveMap={res.signTex} emissive="#ffffff" emissiveIntensity={0.25} />
      </mesh>
    </group>
  );
}

export function CEGBuilding() {
  return (
    <ModelSlot id="cegBuilding">
      <ProceduralBuilding />
    </ModelSlot>
  );
}
